package de.lizzy.kuschelrad.client.net;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import de.lizzy.kuschelrad.Action;
import de.lizzy.kuschelrad.Kuschelrad;
import de.lizzy.kuschelrad.Reason;
import de.lizzy.kuschelrad.client.InteractionManager;
import de.lizzy.kuschelrad.client.KuschelConfig;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import net.minecraft.client.Minecraft;
import net.minecraft.client.User;

/**
 * Verbindet sich mit einem kleinen WebSocket-Relay, damit Kuschelrad auch auf Servern
 * ohne Mod funktioniert. Alle Spieler auf derselben Server-Adresse landen im selben „Raum".
 *
 * Damit niemand sich als jemand anderes ausgeben kann, beweist der Client seine Identität
 * wie beim Einloggen auf einen Server: Er meldet bei Mojang ein vom Relay vorgegebenes
 * serverId an, und das Relay prüft das über sessionserver.mojang.com/hasJoined.
 * Das Access-Token geht dabei nur an Mojang, nie an das Relay.
 */
public final class RelayTransport implements Transport, WebSocket.Listener {
	public static final RelayTransport INSTANCE = new RelayTransport();

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
	private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
		Thread t = new Thread(r, "Kuschelrad-Relay");
		t.setDaemon(true);
		return t;
	});

	private volatile WebSocket socket;
	private volatile boolean ready;
	private volatile String room;
	/** Wird bei jedem connect/disconnect erhöht, damit alte Verbindungen nichts mehr auslösen. */
	private volatile int generation;
	private int retryDelaySeconds = 5;
	private final StringBuilder partial = new StringBuilder();

	private RelayTransport() {
	}

	@Override
	public boolean isReady() {
		return ready && socket != null;
	}

	/** Beim Betreten eines Servers aufrufen. {@code address} ist z. B. "play.example.net:25565". */
	public synchronized void connect(String address) {
		disconnect();
		String url = KuschelConfig.get().relayUrl;
		if (url == null || url.isBlank() || address == null) {
			return;
		}
		room = roomFor(address);
		retryDelaySeconds = 5;
		open(url.trim(), ++generation);
	}

	public synchronized void disconnect() {
		generation++;
		ready = false;
		room = null;
		WebSocket ws = socket;
		socket = null;
		if (ws != null) {
			ws.sendClose(WebSocket.NORMAL_CLOSURE, "bye");
		}
	}

	private void open(String url, int gen) {
		http.newWebSocketBuilder()
			.connectTimeout(Duration.ofSeconds(10))
			.buildAsync(URI.create(url), this)
			.whenComplete((ws, error) -> {
				if (gen != generation) {
					if (ws != null) {
						ws.sendClose(WebSocket.NORMAL_CLOSURE, "stale");
					}
					return;
				}
				if (error != null) {
					Kuschelrad.LOGGER.info("Relay nicht erreichbar ({}), neuer Versuch in {}s", error.getMessage(), retryDelaySeconds);
					scheduleReconnect(url, gen);
					return;
				}
				socket = ws;
				User user = Minecraft.getInstance().getUser();
				JsonObject hello = new JsonObject();
				hello.addProperty("t", "hello");
				hello.addProperty("v", 1);
				hello.addProperty("name", user.getName());
				hello.addProperty("uuid", user.getProfileId().toString());
				hello.addProperty("room", room);
				send(hello);
			});
	}

	private void scheduleReconnect(String url, int gen) {
		int delay = retryDelaySeconds;
		retryDelaySeconds = Math.min(retryDelaySeconds * 2, 120);
		scheduler.schedule(() -> {
			if (gen == generation) {
				open(url, gen);
			}
		}, delay, TimeUnit.SECONDS);
	}

	private void send(JsonObject message) {
		WebSocket ws = socket;
		if (ws != null) {
			ws.sendText(message.toString(), true);
		}
	}

	@Override
	public void request(UUID target, Action action) {
		JsonObject msg = new JsonObject();
		msg.addProperty("t", "request");
		msg.addProperty("to", target.toString());
		msg.addProperty("action", action.key);
		send(msg);
	}

	@Override
	public void answer(int requestId, boolean accept, Reason reason) {
		JsonObject msg = new JsonObject();
		msg.addProperty("t", "answer");
		msg.addProperty("id", requestId);
		msg.addProperty("accept", accept);
		if (!accept) {
			msg.addProperty("reason", reason.key);
		}
		send(msg);
	}

	@Override
	public void onOpen(WebSocket webSocket) {
		webSocket.request(1);
	}

	@Override
	public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
		partial.append(data);
		if (last) {
			String text = partial.toString();
			partial.setLength(0);
			if (webSocket == socket) {
				try {
					handle(webSocket, JsonParser.parseString(text).getAsJsonObject());
				} catch (Exception e) {
					Kuschelrad.LOGGER.debug("Ungültige Relay-Nachricht: {}", text, e);
				}
			}
		}
		webSocket.request(1);
		return null;
	}

	private void handle(WebSocket ws, JsonObject msg) {
		Minecraft mc = Minecraft.getInstance();
		switch (msg.get("t").getAsString()) {
			case "challenge" -> {
				String serverId = msg.get("serverId").getAsString();
				int gen = generation;
				CompletableFuture.runAsync(() -> {
					try {
						User user = mc.getUser();
						mc.services().sessionService().joinServer(user.getProfileId(), user.getAccessToken(), serverId);
					} catch (Exception e) {
						// Trotzdem weiter: das Relay entscheidet (ein Test-Relay mit --offline lässt das zu).
						Kuschelrad.LOGGER.warn("Relay-Anmeldung bei Mojang fehlgeschlagen: {}", e.getMessage());
					}
					if (gen == generation) {
						JsonObject auth = new JsonObject();
						auth.addProperty("t", "auth");
						send(auth);
					}
				}, scheduler);
			}
			case "ready" -> {
				ready = true;
				retryDelaySeconds = 5;
				Kuschelrad.LOGGER.info("Mit Kuschelrad-Relay verbunden");
			}
			case "incoming" -> {
				int id = msg.get("id").getAsInt();
				UUID from = UUID.fromString(msg.get("from").getAsString());
				Action action = Action.byKey(msg.get("action").getAsString());
				if (action != null) {
					mc.execute(() -> InteractionManager.onIncoming(this, id, from, action));
				}
			}
			case "play" -> {
				UUID initiator = UUID.fromString(msg.get("initiator").getAsString());
				UUID receiver = UUID.fromString(msg.get("receiver").getAsString());
				Action action = Action.byKey(msg.get("action").getAsString());
				if (action != null) {
					mc.execute(() -> InteractionManager.onPlay(initiator, receiver, action));
				}
			}
			case "refused" -> {
				UUID target = UUID.fromString(msg.get("target").getAsString());
				Action action = Action.byKey(msg.get("action").getAsString());
				Reason reason = Reason.byKey(msg.get("reason").getAsString());
				if (action != null) {
					mc.execute(() -> InteractionManager.onRefused(target, action, reason));
				}
			}
			case "error" -> Kuschelrad.LOGGER.warn("Relay meldet: {}", msg.has("message") ? msg.get("message").getAsString() : "?");
			default -> {
			}
		}
	}

	@Override
	public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
		lost(webSocket);
		return null;
	}

	@Override
	public void onError(WebSocket webSocket, Throwable error) {
		Kuschelrad.LOGGER.info("Relay-Verbindung verloren: {}", error.getMessage());
		lost(webSocket);
	}

	private synchronized void lost(WebSocket webSocket) {
		if (webSocket != socket) {
			return;
		}
		socket = null;
		ready = false;
		String url = KuschelConfig.get().relayUrl;
		if (room != null && url != null && !url.isBlank()) {
			scheduleReconnect(url.trim(), generation);
		}
	}

	/** Raum-ID: Hash der Server-Adresse, damit das Relay nicht erfährt, auf welchem Server man spielt. */
	static String roomFor(String address) {
		String normalized = address.trim().toLowerCase(Locale.ROOT);
		if (normalized.endsWith(":25565")) {
			normalized = normalized.substring(0, normalized.length() - 6);
		}
		try {
			byte[] hash = MessageDigest.getInstance("SHA-256").digest(normalized.getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(hash, 0, 16);
		} catch (Exception e) {
			throw new IllegalStateException(e);
		}
	}
}

package de.lizzy.kuschelrad.server;

import de.lizzy.kuschelrad.Action;
import de.lizzy.kuschelrad.Reason;
import de.lizzy.kuschelrad.net.Payloads;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.PlayerLookup;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

/**
 * Vermittelt Anfragen, wenn Kuschelrad auch auf dem Server installiert ist.
 * Der Server prüft Abstand, Cooldown und dass nur der Angefragte annehmen kann.
 */
public final class ServerHub {
	private static final int TIMEOUT_TICKS = 15 * 20;
	private static final int COOLDOWN_TICKS = 30;

	private record Pending(int id, UUID from, UUID to, Action action, long expiresAt) {
	}

	private static final Map<Integer, Pending> PENDING = new HashMap<>();
	private static final Map<UUID, Long> LAST_REQUEST = new HashMap<>();
	private static int nextId = 1;
	private static long tick;

	private ServerHub() {
	}

	public static void register() {
		ServerPlayNetworking.registerGlobalReceiver(Payloads.Request.TYPE, (payload, context) -> onRequest(context.server(), context.player(), payload));
		ServerPlayNetworking.registerGlobalReceiver(Payloads.Answer.TYPE, (payload, context) -> onAnswer(context.server(), context.player(), payload));
		ServerTickEvents.END_SERVER_TICK.register(ServerHub::onTick);
		ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
			PENDING.clear();
			LAST_REQUEST.clear();
		});
	}

	private static void onRequest(MinecraftServer server, ServerPlayer from, Payloads.Request request) {
		Long last = LAST_REQUEST.get(from.getUUID());
		if (last != null && tick - last < COOLDOWN_TICKS) {
			refuse(from, request.target(), request.action(), Reason.COOLDOWN);
			return;
		}
		LAST_REQUEST.put(from.getUUID(), tick);

		ServerPlayer target = server.getPlayerList().getPlayer(request.target());
		if (target == null || target == from || !closeEnough(from, target)) {
			refuse(from, request.target(), request.action(), Reason.TOO_FAR);
			return;
		}
		if (!ServerPlayNetworking.canSend(target, Payloads.Incoming.TYPE)) {
			refuse(from, request.target(), request.action(), Reason.NO_MOD);
			return;
		}
		// Pro Spieler nur eine offene Anfrage.
		PENDING.values().removeIf(p -> p.from().equals(from.getUUID()));
		Pending pending = new Pending(nextId++, from.getUUID(), target.getUUID(), request.action(), tick + TIMEOUT_TICKS);
		PENDING.put(pending.id(), pending);
		ServerPlayNetworking.send(target, new Payloads.Incoming(pending.id(), from.getUUID(), request.action()));
	}

	private static void onAnswer(MinecraftServer server, ServerPlayer answerer, Payloads.Answer answer) {
		Pending pending = PENDING.get(answer.requestId());
		if (pending == null || !pending.to().equals(answerer.getUUID())) {
			return;
		}
		PENDING.remove(pending.id());
		ServerPlayer from = server.getPlayerList().getPlayer(pending.from());
		if (from == null) {
			return;
		}
		if (!answer.accept()) {
			refuse(from, pending.to(), pending.action(), Reason.DECLINED);
			return;
		}
		if (!closeEnough(from, answerer)) {
			refuse(from, pending.to(), pending.action(), Reason.TOO_FAR);
			return;
		}
		Payloads.Play play = new Payloads.Play(from.getUUID(), answerer.getUUID(), pending.action());
		Set<ServerPlayer> viewers = new HashSet<>(PlayerLookup.tracking(from));
		viewers.addAll(PlayerLookup.tracking(answerer));
		viewers.add(from);
		viewers.add(answerer);
		for (ServerPlayer viewer : viewers) {
			if (ServerPlayNetworking.canSend(viewer, Payloads.Play.TYPE)) {
				ServerPlayNetworking.send(viewer, play);
			}
		}
	}

	private static void onTick(MinecraftServer server) {
		tick++;
		Iterator<Pending> it = PENDING.values().iterator();
		while (it.hasNext()) {
			Pending pending = it.next();
			if (pending.expiresAt() <= tick) {
				it.remove();
				ServerPlayer from = server.getPlayerList().getPlayer(pending.from());
				if (from != null) {
					refuse(from, pending.to(), pending.action(), Reason.TIMEOUT);
				}
			}
		}
		if (tick % 1200 == 0) {
			LAST_REQUEST.values().removeIf(t -> tick - t > COOLDOWN_TICKS);
		}
	}

	private static boolean closeEnough(ServerPlayer a, ServerPlayer b) {
		// Etwas großzügiger als der Client, wegen Bewegung während der Anfrage.
		double max = Action.MAX_DISTANCE + 1.5;
		return a.level() == b.level() && a.distanceToSqr(b) <= max * max;
	}

	private static void refuse(ServerPlayer to, UUID target, Action action, Reason reason) {
		ServerPlayNetworking.send(to, new Payloads.Refused(target, action, reason));
	}
}

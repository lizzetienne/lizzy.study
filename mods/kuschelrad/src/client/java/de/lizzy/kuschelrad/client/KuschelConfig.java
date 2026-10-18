package de.lizzy.kuschelrad.client;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import de.lizzy.kuschelrad.Kuschelrad;
import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import net.fabricmc.loader.api.FabricLoader;

/** Einstellungen in config/kuschelrad.json. */
public final class KuschelConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path PATH = FabricLoader.getInstance().getConfigDir().resolve("kuschelrad.json");
	private static KuschelConfig instance = new KuschelConfig();

	/** WebSocket-Adresse des Relays (wss://…). Leer = nur über Server-Mod. */
	public String relayUrl = "";
	/**
	 * Ohne Server-Mod und Relay die Animation einfach bei sich selbst abspielen
	 * (nur man selbst sieht sie, es gibt keine Anfrage).
	 */
	public boolean soloMode = true;
	/** Anfragen anderer Spieler überhaupt anzeigen. */
	public boolean acceptRequests = true;
	/** E gedrückt halten öffnet das Rad, wenn man einen Spieler anschaut. */
	public boolean useInventoryKey = true;
	/** Wie lange E gehalten werden muss, bevor das Rad statt des Inventars aufgeht. */
	public int holdMillis = 250;
	public boolean particles = true;
	public boolean sounds = true;
	/** Spielernamen, deren Anfragen still abgelehnt werden. */
	public List<String> blocked = new ArrayList<>();

	public static KuschelConfig get() {
		return instance;
	}

	public boolean isBlocked(String name) {
		String lower = name.toLowerCase(Locale.ROOT);
		return blocked.stream().anyMatch(b -> b.toLowerCase(Locale.ROOT).equals(lower));
	}

	public static void load() {
		if (Files.exists(PATH)) {
			try (Reader reader = Files.newBufferedReader(PATH)) {
				KuschelConfig loaded = GSON.fromJson(reader, KuschelConfig.class);
				if (loaded != null) {
					if (loaded.blocked == null) {
						loaded.blocked = new ArrayList<>();
					}
					if (loaded.relayUrl == null) {
						loaded.relayUrl = "";
					}
					instance = loaded;
				}
			} catch (Exception e) {
				Kuschelrad.LOGGER.warn("Konnte {} nicht lesen, nutze Standardwerte", PATH, e);
			}
		}
		save();
	}

	public static void save() {
		try {
			Files.createDirectories(PATH.getParent());
			try (Writer writer = Files.newBufferedWriter(PATH)) {
				GSON.toJson(instance, writer);
			}
		} catch (IOException e) {
			Kuschelrad.LOGGER.warn("Konnte {} nicht schreiben", PATH, e);
		}
	}
}

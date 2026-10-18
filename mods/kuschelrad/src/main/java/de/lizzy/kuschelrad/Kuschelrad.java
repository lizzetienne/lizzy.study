package de.lizzy.kuschelrad;

import de.lizzy.kuschelrad.net.Payloads;
import de.lizzy.kuschelrad.server.ServerHub;
import net.fabricmc.api.ModInitializer;
import net.minecraft.resources.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class Kuschelrad implements ModInitializer {
	public static final String MOD_ID = "kuschelrad";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	public static Identifier id(String path) {
		return Identifier.fromNamespaceAndPath(MOD_ID, path);
	}

	@Override
	public void onInitialize() {
		Payloads.register();
		ServerHub.register();
	}
}

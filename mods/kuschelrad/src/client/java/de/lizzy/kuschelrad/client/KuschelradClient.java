package de.lizzy.kuschelrad.client;

import com.mojang.blaze3d.platform.InputConstants;
import de.lizzy.kuschelrad.Kuschelrad;
import de.lizzy.kuschelrad.client.anim.AnimationManager;
import de.lizzy.kuschelrad.client.gui.RequestHud;
import de.lizzy.kuschelrad.client.gui.WheelInput;
import de.lizzy.kuschelrad.client.net.RelayTransport;
import de.lizzy.kuschelrad.client.net.ServerTransport;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.multiplayer.ServerData;

public class KuschelradClient implements ClientModInitializer {
	@Override
	public void onInitializeClient() {
		KuschelConfig.load();

		KeyMapping.Category category = KeyMapping.Category.register(Kuschelrad.id("main"));
		WheelInput.wheelKey = KeyMappingHelper.registerKeyMapping(
			new KeyMapping("key.kuschelrad.wheel", InputConstants.Type.KEYSYM, InputConstants.UNKNOWN.getValue(), category));
		WheelInput.acceptKey = KeyMappingHelper.registerKeyMapping(
			new KeyMapping("key.kuschelrad.accept", InputConstants.KEY_Y, category));
		WheelInput.declineKey = KeyMappingHelper.registerKeyMapping(
			new KeyMapping("key.kuschelrad.decline", InputConstants.KEY_N, category));

		ServerTransport.register();
		HudElementRegistry.addLast(Kuschelrad.id("request"), RequestHud::extract);

		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			WheelInput.tick(mc);
			InteractionManager.tick();
			AnimationManager.tick(mc);
			DevTest.tick(mc);
		});

		ClientPlayConnectionEvents.JOIN.register((handler, sender, mc) -> {
			// Hat der Server Kuschelrad, läuft alles darüber – sonst übers Relay.
			if (!ServerTransport.INSTANCE.isReady()) {
				ServerData server = mc.getCurrentServer();
				String address = server != null ? server.ip : DevTest.hostAddress();
				RelayTransport.INSTANCE.connect(address);
			}
		});
		ClientPlayConnectionEvents.DISCONNECT.register((handler, mc) -> {
			RelayTransport.INSTANCE.disconnect();
			InteractionManager.reset();
			AnimationManager.reset();
		});
	}
}

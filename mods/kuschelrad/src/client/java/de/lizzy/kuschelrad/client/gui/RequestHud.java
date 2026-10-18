package de.lizzy.kuschelrad.client.gui;

import de.lizzy.kuschelrad.client.InteractionManager;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.PlayerFaceExtractor;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Player;

/** Karte oben in der Mitte: „Levi möchte dich küssen – [Y] Annehmen / [N] Ablehnen". */
public final class RequestHud {
	private static final int WIDTH = 190;
	private static final int HEIGHT = 34;

	private RequestHud() {
	}

	public static void extract(GuiGraphicsExtractor graphics, DeltaTracker delta) {
		InteractionManager.IncomingRequest request = InteractionManager.currentIncoming();
		Minecraft mc = Minecraft.getInstance();
		if (request == null) {
			return;
		}
		Font font = mc.font;
		Component title = Component.translatable("kuschelrad.request." + request.action().key, request.fromName());
		Component keys = Component.translatable("kuschelrad.request.keys",
			WheelInput.acceptKey.getTranslatedKeyMessage(), WheelInput.declineKey.getTranslatedKeyMessage());
		int width = Math.max(WIDTH, Math.max(font.width(title), font.width(keys)) + 36);
		int x = (graphics.guiWidth() - width) / 2;
		int y = 28;

		graphics.fill(x, y, x + width, y + HEIGHT, 0xD0181018);
		graphics.outline(x, y, width, HEIGHT, 0xFFF0609C);
		int barWidth = Math.round((width - 2) * request.remaining());
		graphics.fill(x + 1, y + HEIGHT - 3, x + 1 + barWidth, y + HEIGHT - 1, 0xFFF0609C);

		Player sender = mc.level != null ? mc.level.getPlayerByUUID(request.from()) : null;
		if (sender instanceof AbstractClientPlayer player) {
			PlayerFaceExtractor.extractRenderState(graphics, player.getSkin(), x + 7, y + 8, 16);
		}
		graphics.text(font, title, x + 30, y + 6, 0xFFFFFFFF);
		graphics.text(font, keys, x + 30, y + 18, 0xFFC8B8C8);
	}
}

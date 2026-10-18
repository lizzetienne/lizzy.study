package de.lizzy.kuschelrad.client.gui;

import de.lizzy.kuschelrad.Action;
import de.lizzy.kuschelrad.Kuschelrad;
import de.lizzy.kuschelrad.client.InteractionManager;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.PlayerFaceExtractor;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.player.Player;

/** Das Kuschelrad: Maus in eine Richtung, Taste loslassen (oder klicken) zum Auswählen. */
public class WheelScreen extends Screen {
	private static final Action[] OPTIONS = {Action.KISS, Action.HEADPAT, Action.HUG};
	/** Richtung der Optionen in Grad (0 = rechts, -90 = oben). */
	private static final float[] ANGLES = {-90.0F, 30.0F, 150.0F};
	private static final int DISTANCE = 56;
	private static final int BUBBLE = 24;
	private static final int DEAD_ZONE = 16;
	private static final int COLOR_SHADE = 0x50000000;
	private static final int COLOR_BUBBLE = 0xC0201820;
	private static final int COLOR_HOVER = 0xE0F0609C;
	private static final int COLOR_CENTER = 0xD0100C10;

	private final Player target;
	private final KeyMapping trigger;
	private int hovered = -1;

	public WheelScreen(Player target, KeyMapping trigger) {
		super(Component.translatable("kuschelrad.wheel.title"));
		this.target = target;
		this.trigger = trigger;
	}

	private static Identifier icon(Action action) {
		return Kuschelrad.id("textures/gui/" + action.key + ".png");
	}

	@Override
	public boolean isPauseScreen() {
		return false;
	}

	@Override
	public void tick() {
		if (minecraft != null && !TargetFinder.isCandidate(minecraft, target)) {
			onClose();
		}
	}

	@Override
	public void extractBackground(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float a) {
		// Kein Blur, damit man die Welt (und den Partner) weiter sieht.
		graphics.fill(0, 0, width, height, COLOR_SHADE);
	}

	@Override
	public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float a) {
		super.extractRenderState(graphics, mouseX, mouseY, a);
		int cx = width / 2;
		int cy = height / 2;
		hovered = optionAt(mouseX - cx, mouseY - cy);

		for (int i = 0; i < OPTIONS.length; i++) {
			boolean hover = i == hovered;
			int bx = cx + Math.round(Mth.cos(ANGLES[i] * Mth.DEG_TO_RAD) * DISTANCE);
			int by = cy + Math.round(Mth.sin(ANGLES[i] * Mth.DEG_TO_RAD) * DISTANCE);
			int radius = hover ? BUBBLE + 4 : BUBBLE;
			disc(graphics, bx, by, radius, hover ? COLOR_HOVER : COLOR_BUBBLE);
			int iconSize = hover ? 36 : 32;
			int ix = bx - iconSize / 2;
			int iy = by - iconSize / 2 - 4;
			graphics.blit(icon(OPTIONS[i]), ix, iy, ix + iconSize, iy + iconSize, 0.0F, 1.0F, 0.0F, 1.0F);
			Component label = Component.translatable("kuschelrad.action." + OPTIONS[i].key);
			graphics.centeredText(font, label, bx, by + radius - 12, hover ? 0xFFFFFFFF : 0xFFE0D0DC);
		}

		disc(graphics, cx, cy, 18, COLOR_CENTER);
		if (target instanceof AbstractClientPlayer player) {
			PlayerFaceExtractor.extractRenderState(graphics, player.getSkin(), cx - 8, cy - 8, 16);
		}
		graphics.centeredText(font, target.getName(), cx, cy + DISTANCE + BUBBLE + 14, 0xFFFFFFFF);
		Component hint = Component.translatable(trigger.isUnbound() ? "kuschelrad.wheel.hint_click" : "kuschelrad.wheel.hint",
			trigger.getTranslatedKeyMessage());
		graphics.centeredText(font, hint, cx, cy + DISTANCE + BUBBLE + 26, 0xFFB0A0B0);
	}

	/** Welche Option liegt in Richtung (dx, dy)? Jede deckt 120° ab. */
	private static int optionAt(double dx, double dy) {
		if (dx * dx + dy * dy < DEAD_ZONE * DEAD_ZONE) {
			return -1;
		}
		float angle = (float) (Mth.atan2(dy, dx) * Mth.RAD_TO_DEG);
		int best = -1;
		float bestDiff = Float.MAX_VALUE;
		for (int i = 0; i < ANGLES.length; i++) {
			float diff = Math.abs(Mth.wrapDegrees(angle - ANGLES[i]));
			if (diff < bestDiff) {
				bestDiff = diff;
				best = i;
			}
		}
		return best;
	}

	private static void disc(GuiGraphicsExtractor graphics, int cx, int cy, int radius, int color) {
		for (int dy = -radius; dy <= radius; dy++) {
			int half = (int) Math.round(Math.sqrt(radius * radius - dy * dy));
			graphics.fill(cx - half, cy + dy, cx + half, cy + dy + 1, color);
		}
	}

	private void confirm() {
		int choice = hovered;
		onClose();
		if (choice >= 0) {
			InteractionManager.sendRequest(target, OPTIONS[choice]);
		}
	}

	@Override
	public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
		if (event.button() == 0) {
			int choice = optionAt(event.x() - width / 2.0, event.y() - height / 2.0);
			if (choice >= 0) {
				hovered = choice;
				confirm();
				return true;
			}
		}
		return super.mouseClicked(event, doubleClick);
	}

	@Override
	public boolean keyReleased(KeyEvent event) {
		if (trigger.matches(event)) {
			confirm();
			return true;
		}
		return super.keyReleased(event);
	}
}

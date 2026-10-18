package de.lizzy.kuschelrad.client.gui;

import de.lizzy.kuschelrad.client.InteractionManager;
import de.lizzy.kuschelrad.client.KuschelConfig;
import net.minecraft.ChatFormatting;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.inventory.InventoryScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Player;

/**
 * „E gedrückt halten" beim Anschauen eines Spielers öffnet das Kuschelrad.
 * Kurzes Antippen öffnet wie gewohnt das Inventar.
 */
public final class WheelInput {
	public static KeyMapping wheelKey;
	public static KeyMapping acceptKey;
	public static KeyMapping declineKey;

	private static Player holdTarget;
	private static long holdStart;

	private WheelInput() {
	}

	/** Aus Minecraft#handleKeybinds, bevor Vanilla die Inventar-Taste auswertet. */
	public static void beforeVanillaKeybinds(Minecraft mc) {
		if (mc.player == null || !KuschelConfig.get().useInventoryKey) {
			return;
		}
		KeyMapping inventory = mc.options.keyInventory;
		if (holdTarget != null) {
			// Während wir auf „lang genug gehalten" warten, nichts an Vanilla durchlassen.
			while (inventory.consumeClick()) {
			}
			return;
		}
		// Nur abfangen, wenn die Taste noch unten ist: ganz kurzes Tippen geht direkt durch.
		if (!inventory.isDown()) {
			return;
		}
		Player target = TargetFinder.find(mc);
		if (target == null) {
			return;
		}
		boolean clicked = false;
		while (inventory.consumeClick()) {
			clicked = true;
		}
		if (clicked) {
			holdTarget = target;
			holdStart = System.currentTimeMillis();
		}
	}

	/** Am Ende jedes Client-Ticks. */
	public static void tick(Minecraft mc) {
		while (acceptKey.consumeClick()) {
			InteractionManager.answerCurrent(true);
		}
		while (declineKey.consumeClick()) {
			InteractionManager.answerCurrent(false);
		}
		while (wheelKey.consumeClick()) {
			if (mc.gui.screen() == null) {
				Player target = TargetFinder.find(mc);
				if (target != null) {
					mc.gui.setScreen(new WheelScreen(target, wheelKey));
				} else if (mc.player != null) {
					mc.player.sendOverlayMessage(Component.translatable("kuschelrad.msg.no_target").withStyle(ChatFormatting.GRAY));
				}
			}
		}

		if (holdTarget == null) {
			return;
		}
		if (mc.player == null || mc.gui.screen() != null) {
			holdTarget = null;
			return;
		}
		if (mc.options.keyInventory.isDown()) {
			if (System.currentTimeMillis() - holdStart >= KuschelConfig.get().holdMillis) {
				Player target = holdTarget;
				holdTarget = null;
				if (TargetFinder.isCandidate(mc, target)) {
					mc.gui.setScreen(new WheelScreen(target, mc.options.keyInventory));
				}
			}
		} else {
			holdTarget = null;
			openInventory(mc);
		}
	}

	/** Dasselbe wie Vanilla in Minecraft#handleKeybinds. */
	private static void openInventory(Minecraft mc) {
		if (mc.gameMode == null || mc.player == null) {
			return;
		}
		if (mc.gameMode.isServerControlledInventory()) {
			mc.player.sendOpenInventory();
		} else {
			mc.getTutorial().onOpenInventory();
			mc.gui.setScreen(new InventoryScreen(mc.player));
		}
	}
}

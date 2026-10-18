package de.lizzy.kuschelrad.client.gui;

import de.lizzy.kuschelrad.Action;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.phys.Vec3;

/** Welcher Spieler ist gemeint? Fadenkreuz zuerst, sonst der nächste in einem kleinen Blickkegel. */
public final class TargetFinder {
	/** cos(20°) */
	private static final double MIN_COS = 0.94;

	private TargetFinder() {
	}

	public static Player find(Minecraft mc) {
		if (mc.player == null || mc.level == null || mc.player.isSpectator()) {
			return null;
		}
		if (mc.crosshairPickEntity instanceof Player picked && isCandidate(mc, picked)) {
			return picked;
		}
		Vec3 eye = mc.player.getEyePosition();
		Vec3 look = mc.player.getViewVector(1.0F);
		Player best = null;
		double bestCos = MIN_COS;
		for (AbstractClientPlayer player : mc.level.players()) {
			if (!isCandidate(mc, player)) {
				continue;
			}
			Vec3 to = player.getBoundingBox().getCenter().subtract(eye);
			double cos = to.normalize().dot(look);
			if (cos > bestCos && mc.player.hasLineOfSight(player)) {
				bestCos = cos;
				best = player;
			}
		}
		return best;
	}

	public static boolean isCandidate(Minecraft mc, Player player) {
		return player != mc.player
			&& player.isAlive()
			&& !player.isSpectator()
			&& !player.isInvisibleTo(mc.player)
			&& mc.player.distanceTo(player) <= Action.MAX_DISTANCE;
	}
}

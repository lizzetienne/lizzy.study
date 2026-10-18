package de.lizzy.kuschelrad.client.anim;

import de.lizzy.kuschelrad.Action;
import de.lizzy.kuschelrad.Kuschelrad;
import de.lizzy.kuschelrad.client.KuschelConfig;
import java.util.Collections;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.particles.SimpleParticleType;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.Mth;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.phys.Vec3;

/** Laufende Interaktionen zwischen zwei Spielern, plus Partikel und Sounds dazu. */
public final class AnimationManager {
	private static final float FADE_IN = 0.45F;
	private static final float FADE_OUT = 0.5F;
	/** Weiter als das schieben sich die Modelle nicht zueinander. */
	private static final double MAX_APPROACH = 1.4;

	public static final SoundEvent KISS_SOUND = SoundEvent.createVariableRangeEvent(Kuschelrad.id("kiss"));
	public static final SoundEvent PAT_SOUND = SoundEvent.createVariableRangeEvent(Kuschelrad.id("pat"));
	public static final SoundEvent HUG_SOUND = SoundEvent.createVariableRangeEvent(Kuschelrad.id("hug"));

	private static final class Active {
		final UUID initiator;
		final UUID receiver;
		final Action action;
		final long startNanos;
		float lastEffectTime = -1.0F;

		Active(UUID initiator, UUID receiver, Action action) {
			this.initiator = initiator;
			this.receiver = receiver;
			this.action = action;
			this.startNanos = System.nanoTime();
		}

		float time() {
			return (System.nanoTime() - startNanos) / 1.0E9F;
		}
	}

	private static final Map<UUID, Active> BY_PLAYER = new HashMap<>();

	private AnimationManager() {
	}

	public static void start(UUID initiator, UUID receiver, Action action) {
		stop(initiator);
		stop(receiver);
		Active active = new Active(initiator, receiver, action);
		BY_PLAYER.put(initiator, active);
		BY_PLAYER.put(receiver, active);
	}

	private static void stop(UUID player) {
		Active old = BY_PLAYER.remove(player);
		if (old != null) {
			BY_PLAYER.remove(old.initiator);
			BY_PLAYER.remove(old.receiver);
		}
	}

	public static boolean isAnimating(UUID player) {
		Active active = BY_PLAYER.get(player);
		return active != null && active.time() < active.action.duration;
	}

	public static void reset() {
		BY_PLAYER.clear();
	}

	/** Pose für das Spielermodell im aktuellen Frame, oder {@code null} wenn nichts läuft. */
	public static AnimPose poseFor(Entity entity, float partialTicks) {
		if (BY_PLAYER.isEmpty()) {
			return null;
		}
		Active active = BY_PLAYER.get(entity.getUUID());
		if (active == null || entity.level() == null) {
			return null;
		}
		float t = active.time();
		if (t >= active.action.duration) {
			return null;
		}
		boolean isInitiator = entity.getUUID().equals(active.initiator);
		Player partner = entity.level().getPlayerByUUID(isInitiator ? active.receiver : active.initiator);
		if (partner == null) {
			return null;
		}
		Vec3 self = entity.getPosition(partialTicks);
		Vec3 other = partner.getPosition(partialTicks);
		double dx = other.x - self.x;
		double dz = other.z - self.z;
		double distance = Math.sqrt(dx * dx + dz * dz);
		if (distance > Action.MAX_DISTANCE + 3.0) {
			return null;
		}
		// Minecraft-Yaw: Blickrichtung ist (-sin, cos).
		float faceYaw = (float) (Mth.atan2(-dx, dz) * Mth.RAD_TO_DEG);
		double approach = approach(distance, active.action);
		float heightDiff = (float) (other.y - self.y);
		return new AnimPose(active.action, isInitiator, t, envelope(t, active.action.duration), faceYaw, (float) approach, heightDiff);
	}

	private static double approach(double distance, Action action) {
		return Mth.clamp((distance - action.contactDistance) / 2.0, 0.0, MAX_APPROACH);
	}

	/** Wo das Modell gerade steht: echte Position plus das Stück, das es zum Partner gerutscht ist. */
	private static Vec3 visualPosition(Player self, Player partner, Action action) {
		Vec3 delta = partner.position().subtract(self.position());
		Vec3 flat = new Vec3(delta.x, 0.0, delta.z);
		double distance = flat.length();
		if (distance < 1.0E-4) {
			return self.position();
		}
		return self.position().add(flat.scale(approach(distance, action) / distance));
	}

	static float envelope(float t, float duration) {
		float in = smooth(Mth.clamp(t / FADE_IN, 0.0F, 1.0F));
		float out = smooth(Mth.clamp((duration - t) / FADE_OUT, 0.0F, 1.0F));
		return in * out;
	}

	static float smooth(float x) {
		return x * x * (3.0F - 2.0F * x);
	}

	/** Pro Client-Tick: abgelaufene Animationen aufräumen, Effekte auslösen. */
	public static void tick(Minecraft mc) {
		if (BY_PLAYER.isEmpty()) {
			return;
		}
		ClientLevel level = mc.level;
		if (level == null) {
			BY_PLAYER.clear();
			return;
		}
		// Jede Interaktion steht zweimal in der Map (einmal pro Spieler).
		Set<Active> seen = Collections.newSetFromMap(new IdentityHashMap<>());
		for (Active active : BY_PLAYER.values()) {
			if (!seen.add(active)) {
				continue;
			}
			float t = active.time();
			Player a = level.getPlayerByUUID(active.initiator);
			Player b = level.getPlayerByUUID(active.receiver);
			if (a != null && b != null) {
				effects(level, active, a, b, active.lastEffectTime, t);
			}
			active.lastEffectTime = t;
		}
		BY_PLAYER.values().removeIf(active -> active.time() >= active.action.duration);
	}

	private static boolean crossed(float from, float to, float at) {
		return from < at && to >= at;
	}

	private static void effects(ClientLevel level, Active active, Player initiator, Player receiver, float from, float to) {
		KuschelConfig config = KuschelConfig.get();
		RandomSource random = level.getRandom();
		Vec3 mid = initiator.position().add(receiver.position()).scale(0.5);
		Vec3 receiverPos = visualPosition(receiver, initiator, active.action);
		double headY = Math.max(initiator.getY(), receiver.getY()) + 1.75;
		switch (active.action) {
			case KISS -> {
				if (crossed(from, to, 1.05F)) {
					sound(level, config, mid, KISS_SOUND, 1.0F, 0.95F + random.nextFloat() * 0.15F);
					burst(level, config, ParticleTypes.HEART, mid.x, headY + 0.2, mid.z, 5, 0.35);
				}
				if (to > 1.2F && to < 2.2F && random.nextFloat() < 0.25F) {
					burst(level, config, ParticleTypes.HEART, receiverPos.x, receiverPos.y + 2.1, receiverPos.z, 1, 0.25);
				}
			}
			case HUG -> {
				if (crossed(from, to, 0.5F)) {
					sound(level, config, mid, HUG_SOUND, 0.9F, 1.0F);
				}
				for (float at : new float[] {0.8F, 1.7F, 2.6F}) {
					if (crossed(from, to, at)) {
						burst(level, config, ParticleTypes.HEART, mid.x, headY + 0.35, mid.z, 2, 0.4);
					}
				}
			}
			case HEADPAT -> {
				// Synchron zu Poses.patStroke: Tiefpunkt jeder Bewegung.
				for (int i = 0; i < 12; i++) {
					float at = Poses.PAT_START + (i + 0.5F) / Poses.PAT_FREQUENCY;
					if (at > active.action.duration - Poses.PAT_END_MARGIN) {
						break;
					}
					if (crossed(from, to, at)) {
						sound(level, config, receiverPos, PAT_SOUND, 0.7F, 0.9F + random.nextFloat() * 0.3F);
						burst(level, config, ParticleTypes.HAPPY_VILLAGER, receiverPos.x, receiverPos.y + 2.05, receiverPos.z, 2, 0.3);
					}
				}
			}
		}
	}

	private static void sound(ClientLevel level, KuschelConfig config, Vec3 pos, SoundEvent sound, float volume, float pitch) {
		if (config.sounds) {
			level.playLocalSound(pos.x, pos.y + 1.5, pos.z, sound, SoundSource.PLAYERS, volume, pitch, false);
		}
	}

	private static void burst(ClientLevel level, KuschelConfig config, SimpleParticleType type, double x, double y, double z, int count, double spread) {
		if (!config.particles) {
			return;
		}
		RandomSource random = level.getRandom();
		for (int i = 0; i < count; i++) {
			level.addParticle(type,
				x + (random.nextDouble() - 0.5) * spread,
				y + random.nextDouble() * spread * 0.5,
				z + (random.nextDouble() - 0.5) * spread,
				0.0, 0.03, 0.0);
		}
	}
}

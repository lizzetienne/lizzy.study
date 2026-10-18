package de.lizzy.kuschelrad.client.anim;

import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.player.PlayerModel;
import net.minecraft.util.Mth;

/**
 * Die eigentlichen Körperhaltungen. Läuft nach Vanilla-setupAnim, blendet also mit
 * {@link AnimPose#weight()} von der normalen Pose (Laufen, Item halten …) in unsere über.
 *
 * Modellraum: +Y zeigt nach unten, -Z nach vorne, Einheit 1/16 Block (vor Skalierung).
 * Arme hängen nach +Y; xRot < 0 hebt sie nach vorne, für den rechten Arm zeigt yRot < 0 nach innen.
 */
public final class Poses {
	static final float PAT_START = 0.55F;
	static final float PAT_FREQUENCY = 2.4F;
	static final float PAT_END_MARGIN = 0.55F;
	/** Abstand Hals → Fußsohle im Modell. */
	private static final float NECK_TO_FEET = 24.0F;
	/** Spieler werden mit 0.9375 gerendert (AvatarRenderer.scale). */
	private static final float PLAYER_SCALE = 0.9375F;

	private Poses() {
	}

	public static void apply(PlayerModel model, AnimPose pose, float entityScale) {
		float w = pose.weight();
		float t = pose.time();
		ModelPart root = model.root();
		float unitsPerBlock = 16.0F / (PLAYER_SCALE * entityScale);
		root.z -= pose.approach() * unitsPerBlock * w;

		switch (pose.action()) {
			case KISS -> kiss(model, pose, w);
			case HUG -> hug(model, pose, w, t);
			case HEADPAT -> headpat(model, pose, w, t);
		}
	}

	private static void kiss(PlayerModel m, AnimPose pose, float w) {
		lean(m.root(), 0.17F * w);
		blend(m.head, w, 0.05F, 0.0F, 0.22F);
		if (pose.initiator()) {
			// Hand an Wange/Schulter des Partners
			blend(m.rightArm, w, -1.15F, -0.3F, 0.1F);
			blend(m.leftArm, w, -0.25F, 0.0F, -0.05F);
		} else {
			// Hände hinter dem Rücken, ein Fuß hochgezogen
			blend(m.rightArm, w, 0.45F, 0.0F, -0.15F);
			blend(m.leftArm, w, 0.45F, 0.0F, 0.15F);
			m.leftLeg.xRot = Mth.lerp(w, m.leftLeg.xRot, 0.65F);
			m.rightLeg.xRot = Mth.lerp(w, m.rightLeg.xRot, 0.0F);
		}
	}

	private static void hug(PlayerModel m, AnimPose pose, float w, float t) {
		lean(m.root(), 0.07F * w);
		m.root().zRot += 0.07F * Mth.sin(t * 3.0F) * w;
		// Arme leicht versetzt, damit sie sich nicht überschneiden
		float armX = pose.initiator() ? -1.5F : -1.25F;
		blend(m.rightArm, w, armX, -0.6F, 0.0F);
		blend(m.leftArm, w, armX, 0.6F, 0.0F);
		// Kopf über die Schulter des anderen
		blend(m.head, w, 0.1F, 0.5F, 0.12F);
		m.leftLeg.xRot = Mth.lerp(w, m.leftLeg.xRot, 0.0F);
		m.rightLeg.xRot = Mth.lerp(w, m.rightLeg.xRot, 0.0F);
	}

	private static void headpat(PlayerModel m, AnimPose pose, float w, float t) {
		float stroke = patStroke(t, pose.action().duration);
		if (pose.initiator()) {
			lean(m.root(), 0.08F * w);
			blend(m.rightArm, w, -2.25F + 0.28F * stroke, -0.35F, 0.0F);
			blend(m.head, w, 0.35F, 0.0F, 0.0F);
		} else {
			blend(m.head, w, 0.3F + 0.12F * stroke, 0.0F, 0.12F * Mth.sin(t * 7.0F));
			blend(m.rightArm, w, -0.45F, -0.4F, 0.0F);
			blend(m.leftArm, w, -0.45F, 0.4F, 0.0F);
		}
	}

	/** 0 = Hand oben, 1 = Hand auf dem Kopf. Tiefpunkte bei PAT_START + (i + 0.5) / PAT_FREQUENCY. */
	static float patStroke(float t, float duration) {
		if (t < PAT_START || t > duration - PAT_END_MARGIN) {
			return 0.0F;
		}
		return (1.0F - Mth.cos((t - PAT_START) * PAT_FREQUENCY * Mth.TWO_PI)) * 0.5F;
	}

	/** Ganzen Körper nach vorne neigen, Drehpunkt an den Füßen statt am Hals. */
	private static void lean(ModelPart root, float angle) {
		root.xRot += angle;
		root.y += NECK_TO_FEET * (1.0F - Mth.cos(angle));
		root.z -= NECK_TO_FEET * Mth.sin(angle);
	}

	private static void blend(ModelPart part, float w, float xRot, float yRot, float zRot) {
		part.xRot = Mth.lerp(w, part.xRot, xRot);
		part.yRot = Mth.lerp(w, part.yRot, yRot);
		part.zRot = Mth.lerp(w, part.zRot, zRot);
	}
}

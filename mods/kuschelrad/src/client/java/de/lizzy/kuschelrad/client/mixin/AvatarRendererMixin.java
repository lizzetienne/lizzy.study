package de.lizzy.kuschelrad.client.mixin;

import de.lizzy.kuschelrad.client.anim.AnimPose;
import de.lizzy.kuschelrad.client.anim.AnimationManager;
import net.minecraft.client.renderer.entity.player.AvatarRenderer;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.Avatar;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/** Legt die Pose in den Render-State und dreht beide Spieler zueinander. */
@Mixin(AvatarRenderer.class)
public abstract class AvatarRendererMixin {
	@Inject(
		method = "extractRenderState(Lnet/minecraft/world/entity/Avatar;Lnet/minecraft/client/renderer/entity/state/AvatarRenderState;F)V",
		at = @At("TAIL")
	)
	private void kuschelrad$extractPose(Avatar entity, AvatarRenderState state, float partialTicks, CallbackInfo ci) {
		AnimPose pose = AnimationManager.poseFor(entity, partialTicks);
		state.setData(AnimPose.KEY, pose);
		if (pose != null) {
			float w = pose.weight();
			state.bodyRot = Mth.rotLerp(w, state.bodyRot, pose.faceYaw());
			state.yRot = Mth.lerp(w, state.yRot, 0.0F);
			state.xRot = Mth.lerp(w, state.xRot, 0.0F);
			if (state.nameTagAttachment != null) {
				// Namensschild wandert mit dem Modell zum Partner.
				float shift = pose.approach() * w;
				float yawRad = pose.faceYaw() * Mth.DEG_TO_RAD;
				state.nameTagAttachment = state.nameTagAttachment.add(-Mth.sin(yawRad) * shift, 0.0, Mth.cos(yawRad) * shift);
			}
		}
	}
}

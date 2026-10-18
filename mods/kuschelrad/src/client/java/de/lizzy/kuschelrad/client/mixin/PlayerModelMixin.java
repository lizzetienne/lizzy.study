package de.lizzy.kuschelrad.client.mixin;

import de.lizzy.kuschelrad.client.anim.AnimPose;
import de.lizzy.kuschelrad.client.anim.Poses;
import net.minecraft.client.model.player.PlayerModel;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(PlayerModel.class)
public abstract class PlayerModelMixin {
	@Inject(method = "setupAnim(Lnet/minecraft/client/renderer/entity/state/AvatarRenderState;)V", at = @At("TAIL"))
	private void kuschelrad$applyPose(AvatarRenderState state, CallbackInfo ci) {
		AnimPose pose = state.getData(AnimPose.KEY);
		if (pose != null) {
			Poses.apply((PlayerModel) (Object) this, pose, state.scale);
		}
	}
}

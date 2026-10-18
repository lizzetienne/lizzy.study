package de.lizzy.kuschelrad.client.mixin;

import de.lizzy.kuschelrad.client.gui.WheelInput;
import net.minecraft.client.Minecraft;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Fängt den Inventar-Tastendruck ab, bevor Vanilla ihn verarbeitet – aber nur, wenn man
 * gerade einen Spieler anschaut. Kurz drücken öffnet danach trotzdem das Inventar.
 */
@Mixin(Minecraft.class)
public abstract class MinecraftMixin {
	@Inject(method = "handleKeybinds", at = @At("HEAD"))
	private void kuschelrad$interceptInventoryKey(CallbackInfo ci) {
		WheelInput.beforeVanillaKeybinds((Minecraft) (Object) this);
	}
}

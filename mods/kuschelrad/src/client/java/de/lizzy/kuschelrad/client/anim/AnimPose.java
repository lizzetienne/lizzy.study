package de.lizzy.kuschelrad.client.anim;

import de.lizzy.kuschelrad.Action;
import net.fabricmc.fabric.api.client.rendering.v1.RenderStateDataKey;

/**
 * Was das Spielermodell in diesem Frame tun soll.
 *
 * @param time       Sekunden seit Start
 * @param weight     0..1, blendet die Pose weich ein und aus
 * @param faceYaw    Yaw (Grad), mit dem der Spieler zum Partner schaut
 * @param approach   Blöcke, die das Modell Richtung Partner rutscht
 * @param heightDiff Partner minus eigene Höhe (Blöcke)
 */
public record AnimPose(Action action, boolean initiator, float time, float weight, float faceYaw, float approach, float heightDiff) {
	public static final RenderStateDataKey<AnimPose> KEY = RenderStateDataKey.create(() -> "kuschelrad:pose");
}

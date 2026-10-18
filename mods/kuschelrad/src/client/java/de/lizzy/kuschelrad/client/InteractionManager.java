package de.lizzy.kuschelrad.client;

import de.lizzy.kuschelrad.Action;
import de.lizzy.kuschelrad.Reason;
import de.lizzy.kuschelrad.client.anim.AnimationManager;
import de.lizzy.kuschelrad.client.net.RelayTransport;
import de.lizzy.kuschelrad.client.net.ServerTransport;
import de.lizzy.kuschelrad.client.net.Transport;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.UUID;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Player;

/** Ausgehende und eingehende Anfragen; verteilt Ergebnisse an Animationen und HUD. */
public final class InteractionManager {
	public static final long REQUEST_TIMEOUT_MS = 15_000;
	private static final long SEND_COOLDOWN_MS = 1_500;

	public record IncomingRequest(Transport transport, int id, UUID from, String fromName, Action action, long receivedAt) {
		public float remaining() {
			return 1.0F - Math.min(1.0F, (System.currentTimeMillis() - receivedAt) / (float) REQUEST_TIMEOUT_MS);
		}
	}

	private static final Deque<IncomingRequest> INCOMING = new ArrayDeque<>();
	private static long lastSent;

	private InteractionManager() {
	}

	public static Transport transport() {
		if (ServerTransport.INSTANCE.isReady()) {
			return ServerTransport.INSTANCE;
		}
		if (RelayTransport.INSTANCE.isReady()) {
			return RelayTransport.INSTANCE;
		}
		return null;
	}

	public static IncomingRequest currentIncoming() {
		return INCOMING.peekFirst();
	}

	/** Aus dem Kuschelrad heraus: Anfrage an {@code target} schicken. */
	public static void sendRequest(Player target, Action action) {
		Minecraft mc = Minecraft.getInstance();
		if (mc.player == null) {
			return;
		}
		Transport transport = transport();
		if (transport == null && KuschelConfig.get().soloMode) {
			if (mc.player.distanceTo(target) > Action.MAX_DISTANCE) {
				overlay(Component.translatable("kuschelrad.refused.too_far", target.getName()).withStyle(ChatFormatting.RED));
				return;
			}
			// Solo-Modus: niemand wird gefragt, nur dieser Client sieht die Animation.
			AnimationManager.start(mc.player.getUUID(), target.getUUID(), action);
			overlay(Component.translatable("kuschelrad.msg.solo").withStyle(ChatFormatting.GRAY));
			return;
		}
		if (transport == null) {
			String relay = KuschelConfig.get().relayUrl;
			overlay(Component.translatable(relay == null || relay.isBlank() ? "kuschelrad.msg.no_transport" : "kuschelrad.msg.relay_offline")
				.withStyle(ChatFormatting.RED));
			return;
		}
		if (mc.player.distanceTo(target) > Action.MAX_DISTANCE) {
			overlay(Component.translatable("kuschelrad.refused.too_far", target.getName()).withStyle(ChatFormatting.RED));
			return;
		}
		long now = System.currentTimeMillis();
		if (now - lastSent < SEND_COOLDOWN_MS) {
			overlay(Component.translatable("kuschelrad.refused.cooldown").withStyle(ChatFormatting.GRAY));
			return;
		}
		lastSent = now;
		transport.request(target.getUUID(), action);
		overlay(Component.translatable("kuschelrad.msg.sent." + action.key, target.getName()).withStyle(ChatFormatting.LIGHT_PURPLE));
	}

	/** Eingehende Anfrage – vom Server-Mod oder Relay. */
	public static void onIncoming(Transport transport, int id, UUID from, Action action) {
		Minecraft mc = Minecraft.getInstance();
		if (mc.level == null || mc.player == null) {
			transport.answer(id, false, Reason.TOO_FAR);
			return;
		}
		Player sender = mc.level.getPlayerByUUID(from);
		// Über das Relay kann jeder aus dem Raum anfragen; nur Spieler in der Nähe zulassen.
		if (sender == null || sender == mc.player || mc.player.distanceTo(sender) > Action.MAX_DISTANCE + 1.5) {
			transport.answer(id, false, Reason.TOO_FAR);
			return;
		}
		KuschelConfig config = KuschelConfig.get();
		String name = sender.getName().getString();
		if (!config.acceptRequests || config.isBlocked(name)) {
			transport.answer(id, false, Reason.DISABLED);
			return;
		}
		INCOMING.removeIf(r -> r.from().equals(from));
		if (INCOMING.size() >= 5) {
			IncomingRequest dropped = INCOMING.pollLast();
			dropped.transport().answer(dropped.id(), false, Reason.BUSY);
		}
		INCOMING.addLast(new IncomingRequest(transport, id, from, name, action, System.currentTimeMillis()));
		if (config.sounds) {
			mc.player.playSound(net.minecraft.sounds.SoundEvents.AMETHYST_BLOCK_CHIME, 0.8F, 1.4F);
		}
	}

	/** Taste „Annehmen"/„Ablehnen" für die älteste offene Anfrage. */
	public static void answerCurrent(boolean accept) {
		IncomingRequest request = INCOMING.pollFirst();
		if (request == null) {
			return;
		}
		request.transport().answer(request.id(), accept, Reason.DECLINED);
		if (!accept) {
			overlay(Component.translatable("kuschelrad.msg.you_declined", request.fromName()).withStyle(ChatFormatting.GRAY));
		}
	}

	public static void onPlay(UUID initiator, UUID receiver, Action action) {
		AnimationManager.start(initiator, receiver, action);
	}

	public static void onRefused(UUID target, Action action, Reason reason) {
		Minecraft mc = Minecraft.getInstance();
		Component name = Component.literal("?");
		if (mc.level != null) {
			Player player = mc.level.getPlayerByUUID(target);
			if (player != null) {
				name = player.getName();
			}
		}
		overlay(Component.translatable("kuschelrad.refused." + reason.key, name).withStyle(ChatFormatting.RED));
	}

	public static void tick() {
		long now = System.currentTimeMillis();
		INCOMING.removeIf(r -> now - r.receivedAt() > REQUEST_TIMEOUT_MS);
	}

	public static void reset() {
		INCOMING.clear();
	}

	private static void overlay(Component message) {
		Minecraft mc = Minecraft.getInstance();
		if (mc.player != null) {
			mc.player.sendOverlayMessage(message);
		}
	}
}

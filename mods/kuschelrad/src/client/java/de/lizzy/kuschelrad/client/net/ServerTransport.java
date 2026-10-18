package de.lizzy.kuschelrad.client.net;

import de.lizzy.kuschelrad.Action;
import de.lizzy.kuschelrad.Reason;
import de.lizzy.kuschelrad.client.DevTest;
import de.lizzy.kuschelrad.client.InteractionManager;
import de.lizzy.kuschelrad.net.Payloads;
import java.util.UUID;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;

/** Nutzt die Pakete, wenn der Server Kuschelrad installiert hat. */
public final class ServerTransport implements Transport {
	public static final ServerTransport INSTANCE = new ServerTransport();

	private ServerTransport() {
	}

	public static void register() {
		ClientPlayNetworking.registerGlobalReceiver(Payloads.Incoming.TYPE,
			(p, ctx) -> InteractionManager.onIncoming(INSTANCE, p.requestId(), p.from(), p.action()));
		ClientPlayNetworking.registerGlobalReceiver(Payloads.Play.TYPE,
			(p, ctx) -> InteractionManager.onPlay(p.initiator(), p.receiver(), p.action()));
		ClientPlayNetworking.registerGlobalReceiver(Payloads.Refused.TYPE,
			(p, ctx) -> InteractionManager.onRefused(p.target(), p.action(), p.reason()));
	}

	@Override
	public boolean isReady() {
		return !DevTest.FORCE_RELAY && ClientPlayNetworking.canSend(Payloads.Request.TYPE);
	}

	@Override
	public void request(UUID target, Action action) {
		ClientPlayNetworking.send(new Payloads.Request(target, action));
	}

	@Override
	public void answer(int requestId, boolean accept, Reason reason) {
		ClientPlayNetworking.send(new Payloads.Answer(requestId, accept));
	}
}

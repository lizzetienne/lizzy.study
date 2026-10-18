package de.lizzy.kuschelrad.client.net;

import de.lizzy.kuschelrad.Action;
import de.lizzy.kuschelrad.Reason;
import java.util.UUID;

/** Weg, über den Anfragen zu anderen Spielern gelangen: Server-Mod oder Relay. */
public interface Transport {
	boolean isReady();

	void request(UUID target, Action action);

	void answer(int requestId, boolean accept, Reason reason);
}

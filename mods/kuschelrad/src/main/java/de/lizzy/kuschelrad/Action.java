package de.lizzy.kuschelrad;

/** Die drei Interaktionen im Kuschelrad. */
public enum Action {
	KISS("kiss", 2.8F, 1.1),
	HUG("hug", 3.4F, 0.55),
	HEADPAT("headpat", 3.2F, 0.95);

	/** Spielerabstand (Blöcke), über dem keine Anfrage gestellt werden darf. */
	public static final double MAX_DISTANCE = 4.5;

	public final String key;
	/** Gesamtdauer der Animation in Sekunden. */
	public final float duration;
	/** Abstand der beiden Körpermitten (Blöcke), auf den die Modelle sich zubewegen. */
	public final double contactDistance;

	Action(String key, float duration, double contactDistance) {
		this.key = key;
		this.duration = duration;
		this.contactDistance = contactDistance;
	}

	public static Action byId(int id) {
		Action[] values = values();
		return id >= 0 && id < values.length ? values[id] : KISS;
	}

	public static Action byKey(String key) {
		for (Action action : values()) {
			if (action.key.equals(key)) {
				return action;
			}
		}
		return null;
	}
}

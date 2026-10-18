package de.lizzy.kuschelrad;

/** Warum eine Anfrage nicht zu einer Animation geführt hat. */
public enum Reason {
	DECLINED("declined"),
	NO_MOD("no_mod"),
	TOO_FAR("too_far"),
	BUSY("busy"),
	TIMEOUT("timeout"),
	DISABLED("disabled"),
	COOLDOWN("cooldown");

	public final String key;

	Reason(String key) {
		this.key = key;
	}

	public static Reason byId(int id) {
		Reason[] values = values();
		return id >= 0 && id < values.length ? values[id] : DECLINED;
	}

	public static Reason byKey(String key) {
		for (Reason reason : values()) {
			if (reason.key.equals(key)) {
				return reason;
			}
		}
		return DECLINED;
	}
}

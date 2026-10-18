package de.lizzy.kuschelrad.net;

import de.lizzy.kuschelrad.Action;
import de.lizzy.kuschelrad.Kuschelrad;
import de.lizzy.kuschelrad.Reason;
import java.util.UUID;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.minecraft.core.UUIDUtil;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;

/**
 * Pakete für Server, auf denen Kuschelrad ebenfalls installiert ist.
 * Ohne Server-Mod läuft dieselbe Logik über das Relay (siehe client.net.RelayTransport).
 */
public final class Payloads {
	private Payloads() {
	}

	private static final StreamCodec<RegistryFriendlyByteBuf, Action> ACTION =
		ByteBufCodecs.VAR_INT.map(Action::byId, Action::ordinal).cast();
	private static final StreamCodec<RegistryFriendlyByteBuf, Reason> REASON =
		ByteBufCodecs.VAR_INT.map(Reason::byId, Reason::ordinal).cast();
	private static final StreamCodec<RegistryFriendlyByteBuf, UUID> UUID_CODEC = UUIDUtil.STREAM_CODEC.cast();

	private static <T extends CustomPacketPayload> CustomPacketPayload.Type<T> payloadType(String path) {
		return new CustomPacketPayload.Type<>(Kuschelrad.id(path));
	}

	/** Client → Server: „Ich möchte {@code target} …". */
	public record Request(UUID target, Action action) implements CustomPacketPayload {
		public static final Type<Request> TYPE = payloadType("request");
		public static final StreamCodec<RegistryFriendlyByteBuf, Request> CODEC =
			StreamCodec.composite(UUID_CODEC, Request::target, ACTION, Request::action, Request::new);

		@Override
		public Type<Request> type() {
			return TYPE;
		}
	}

	/** Client → Server: Antwort auf eine eingehende Anfrage. */
	public record Answer(int requestId, boolean accept) implements CustomPacketPayload {
		public static final Type<Answer> TYPE = payloadType("answer");
		public static final StreamCodec<RegistryFriendlyByteBuf, Answer> CODEC =
			StreamCodec.composite(ByteBufCodecs.VAR_INT, Answer::requestId, ByteBufCodecs.BOOL, Answer::accept, Answer::new);

		@Override
		public Type<Answer> type() {
			return TYPE;
		}
	}

	/** Server → Client: jemand fragt dich an. */
	public record Incoming(int requestId, UUID from, Action action) implements CustomPacketPayload {
		public static final Type<Incoming> TYPE = payloadType("incoming");
		public static final StreamCodec<RegistryFriendlyByteBuf, Incoming> CODEC =
			StreamCodec.composite(ByteBufCodecs.VAR_INT, Incoming::requestId, UUID_CODEC, Incoming::from, ACTION, Incoming::action, Incoming::new);

		@Override
		public Type<Incoming> type() {
			return TYPE;
		}
	}

	/** Server → Client: Animation zwischen {@code initiator} und {@code receiver} abspielen. */
	public record Play(UUID initiator, UUID receiver, Action action) implements CustomPacketPayload {
		public static final Type<Play> TYPE = payloadType("play");
		public static final StreamCodec<RegistryFriendlyByteBuf, Play> CODEC =
			StreamCodec.composite(UUID_CODEC, Play::initiator, UUID_CODEC, Play::receiver, ACTION, Play::action, Play::new);

		@Override
		public Type<Play> type() {
			return TYPE;
		}
	}

	/** Server → Client: deine Anfrage an {@code target} hat nicht geklappt. */
	public record Refused(UUID target, Action action, Reason reason) implements CustomPacketPayload {
		public static final Type<Refused> TYPE = payloadType("refused");
		public static final StreamCodec<RegistryFriendlyByteBuf, Refused> CODEC =
			StreamCodec.composite(UUID_CODEC, Refused::target, ACTION, Refused::action, REASON, Refused::reason, Refused::new);

		@Override
		public Type<Refused> type() {
			return TYPE;
		}
	}

	public static void register() {
		PayloadTypeRegistry.serverboundPlay().register(Request.TYPE, Request.CODEC);
		PayloadTypeRegistry.serverboundPlay().register(Answer.TYPE, Answer.CODEC);
		PayloadTypeRegistry.clientboundPlay().register(Incoming.TYPE, Incoming.CODEC);
		PayloadTypeRegistry.clientboundPlay().register(Play.TYPE, Play.CODEC);
		PayloadTypeRegistry.clientboundPlay().register(Refused.TYPE, Refused.CODEC);
	}
}

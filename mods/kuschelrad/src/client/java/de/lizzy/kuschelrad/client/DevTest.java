package de.lizzy.kuschelrad.client;

import de.lizzy.kuschelrad.Action;
import de.lizzy.kuschelrad.Kuschelrad;
import de.lizzy.kuschelrad.client.anim.AnimationManager;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.CameraType;
import net.minecraft.client.gui.screens.TitleScreen;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.Difficulty;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.LevelSettings;
import net.minecraft.world.level.WorldDataConfiguration;
import net.minecraft.world.level.levelgen.WorldOptions;
import net.minecraft.world.level.levelgen.presets.WorldPresets;
import net.minecraft.client.Minecraft;
import net.minecraft.client.Screenshot;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.util.Mth;

/**
 * Nur in der Entwicklungsumgebung: zwei Clients spielen sich automatisch alle Interaktionen vor.
 * -Dkuschelrad.devtest=a fragt an und macht Screenshots, -Dkuschelrad.devtest=b nimmt an.
 */
public final class DevTest {
	private static final String ROLE = FabricLoader.getInstance().isDevelopmentEnvironment() ? System.getProperty("kuschelrad.devtest") : null;
	public static final boolean FORCE_RELAY = ROLE != null && Boolean.getBoolean("kuschelrad.forceRelay");
	private static final Action[] SEQUENCE = {Action.KISS, Action.HUG, Action.HEADPAT};
	private static final float[] SHOTS = {0.3F, 1.1F, 1.9F};

	private static int ticks;
	private static int step;
	private static long playStart = -1;
	private static int shot;

	private DevTest() {
	}

	/** Der LAN-Host hat keine ServerData; im Relay-Test denselben Raum wie Client B nehmen. */
	public static String hostAddress() {
		return FORCE_RELAY ? "localhost:25599" : null;
	}

	public static boolean active() {
		return ROLE != null;
	}

	private static boolean worldRequested;
	private static boolean published;
	private static boolean setupDone;

	public static void tick(Minecraft mc) {
		if (ROLE == null) {
			return;
		}
		if (ROLE.equals("a") && !worldRequested && mc.level == null && mc.gui.screen() instanceof TitleScreen screen) {
			worldRequested = true;
			LevelSettings settings = new LevelSettings("kuschel-test", GameType.CREATIVE,
				new LevelSettings.DifficultySettings(Difficulty.PEACEFUL, false, false), true, WorldDataConfiguration.DEFAULT);
			mc.createWorldOpenFlows().createFreshLevel("kuschel-test-" + System.currentTimeMillis(), settings,
				new WorldOptions(42L, false, false), WorldPresets::createTestWorldDimensions, screen);
			return;
		}
		if (mc.player == null || mc.level == null) {
			return;
		}
		ticks++;
		if (ROLE.equals("a") && !published && ticks > 40 && mc.getSingleplayerServer() != null) {
			// Test-Accounts sind offline, also LAN ohne Mojang-Anmeldung.
			mc.getSingleplayerServer().setUsesAuthentication(false);
			published = mc.getSingleplayerServer().publishServer(MinecraftServer.MultiplayerScope.LAN, GameType.CREATIVE, true, 25599);
			Kuschelrad.LOGGER.info("DEVTEST LAN {}", published);
		}
		if (ROLE.equals("b")) {
			if (InteractionManager.currentIncoming() != null && ticks % 10 == 0) {
				InteractionManager.answerCurrent(true);
			}
			return;
		}
		AbstractClientPlayer partner = mc.level.players().stream().filter(p -> p != mc.player).findFirst().orElse(null);
		if (partner == null) {
			return;
		}
		if (!setupDone) {
			setupDone = true;
			mc.player.connection.sendCommand("time set noon");
			mc.player.connection.sendCommand("weather clear");
			mc.player.connection.sendCommand(String.format(java.util.Locale.ROOT, "tp %s %.2f %.2f %.2f",
				partner.getName().getString(), mc.player.getX() + 2.0, mc.player.getY(), mc.player.getZ()));
			ticks = 100;
		}
		// Seitlich auf beide schauen: Kamera hinter uns, 90° zum Partner gedreht.
		mc.options.setCameraType(CameraType.THIRD_PERSON_BACK);
		double dx = partner.getX() - mc.player.getX();
		double dz = partner.getZ() - mc.player.getZ();
		float toPartner = (float) (Mth.atan2(-dx, dz) * Mth.RAD_TO_DEG);
		mc.player.setYRot(toPartner + (step == 2 ? -90.0F : 90.0F));
		mc.player.setXRot(10.0F);

		if (playStart < 0 && ticks > 200 && ticks % 160 == 0 && step < SEQUENCE.length) {
			InteractionManager.sendRequest(partner, SEQUENCE[step]);
		}
		if (playStart < 0 && AnimationManager.isAnimating(mc.player.getUUID())) {
			playStart = System.nanoTime();
			shot = 0;
		}
		if (playStart >= 0) {
			float t = (System.nanoTime() - playStart) / 1.0E9F;
			if (shot < SHOTS.length && t >= SHOTS[shot]) {
				String name = "devtest-" + SEQUENCE[step].key + "-" + shot + ".png";
				Screenshot.grab(mc.gameDirectory, name, mc.gameRenderer.mainRenderTarget(), 1, msg -> Kuschelrad.LOGGER.info("Screenshot {}", name));
				shot++;
			}
			if (!AnimationManager.isAnimating(mc.player.getUUID())) {
				playStart = -1;
				step++;
				if (step >= SEQUENCE.length) {
					Kuschelrad.LOGGER.info("DEVTEST FERTIG");
				}
			}
		}
	}
}

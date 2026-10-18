# Kuschelrad 💋🤗✋

Fabric-Mod für Minecraft **26.2**: Schau einen Spieler an, **halte E gedrückt** und wähle im Rad:

- **Küssen** – beide lehnen sich vor, Herzchen, Schmatz
- **Umarmen** – Arme umeinander, leichtes Wiegen
- **Kopf tätscheln** – Hand auf den Kopf, tätschel-tätschel, Glitzer

Der andere bekommt erst eine **Anfrage** und muss mit **Y** annehmen (oder **N** ablehnen).
Kurz auf E tippen öffnet ganz normal das Inventar.

## Wer sieht die Animation?

Alle Spieler in der Nähe, **die Kuschelrad installiert haben**. Wer die Mod nicht hat, sieht nichts davon –
deshalb ist sie auf jedem Server unauffällig und schickt keine fremden Pakete an Vanilla-Server.

Es gibt zwei Wege, wie die Anfragen ankommen:

1. **Server hat Kuschelrad installiert** (optional): läuft komplett über den Minecraft-Server.
2. **Server hat es nicht** (der Normalfall): über ein kleines **Relay** (WebSocket).
   Die Relay-Adresse steht in `config/kuschelrad.json` unter `relayUrl`.

## Einstellungen – `config/kuschelrad.json`

| Feld | Standard | Bedeutung |
|---|---|---|
| `relayUrl` | `""` | z. B. `wss://kuschel.example.net` – leer = nur Server-Mod |
| `acceptRequests` | `true` | `false` lehnt alle Anfragen still ab |
| `useInventoryKey` | `true` | E halten öffnet das Rad; sonst nur die eigene Taste (Steuerung → Kuschelrad) |
| `holdMillis` | `250` | so lange muss E gehalten werden |
| `particles` / `sounds` | `true` | Herzchen und Geräusche |
| `blocked` | `[]` | Spielernamen, deren Anfragen still abgelehnt werden |

Tasten (änderbar unter Optionen → Steuerung → Kuschelrad): Annehmen **Y**, Ablehnen **N**,
optional eine eigene Taste fürs Rad.

## Relay betreiben

Das Relay ist ein einzelnes Python-Skript in [`relay/`](relay/):

```bash
cd relay
python3 -m venv venv && venv/bin/pip install -r requirements.txt
venv/bin/python relay.py --port 8765
```

Davor gehört ein Reverse-Proxy mit TLS (Caddy, nginx …), damit Clients `wss://` nutzen können, z. B. mit Caddy:

```
kuschel.example.net {
	reverse_proxy 127.0.0.1:8765
}
```

**Sicherheit:** Jeder Client beweist seine Identität wie beim Einloggen auf einen Server – er meldet eine
vom Relay erzeugte `serverId` bei Mojang an, und das Relay prüft sie über `sessionserver.mojang.com/hasJoined`.
Das Access-Token geht nur an Mojang, nie ans Relay. Räume sind SHA-256-Hashes der Server-Adresse.
`--offline` schaltet die Prüfung ab und ist nur zum lokalen Testen gedacht.

## Bauen

Java 25 wird benötigt.

```bash
./gradlew build          # → build/libs/kuschelrad-<version>.jar
./gradlew runDevA        # Testwelt, öffnet sich fürs LAN
./gradlew runDevB        # zweiter Spieler tritt bei, beide spielen sich alles vor
```

## Kompatibilität

- Nur Mixins an zwei Stellen fürs Modell (`PlayerModel#setupAnim` TAIL, `AvatarRenderer#extractRenderState` TAIL)
  und eine an `Minecraft#handleKeybinds` HEAD – nichts wird überschrieben.
- Daten laufen über die Fabric-Render-State-API, verträgt sich mit Sodium, Iris, Figura, Emotecraft & Co.
- Keine Registry-Einträge → kein Registry-Sync-Problem auf Vanilla-Servern.

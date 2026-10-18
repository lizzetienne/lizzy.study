"""Kuschelrad-Relay: vermittelt Anfragen zwischen Spielern, deren Server die Mod nicht hat.

Ablauf pro Verbindung:
  Client  -> hello {name, uuid, room}
  Relay   -> challenge {serverId}
  Client meldet serverId bei Mojang an (wie beim Server-Login), dann -> auth
  Relay prüft sessionserver.mojang.com/hasJoined und antwortet -> ready

Danach:
  request {to, action}          -> an Ziel: incoming {id, from, action}
  answer {id, accept, reason?}  -> an alle im Raum: play {initiator, receiver, action}
                                   oder an Anfragenden: refused {target, action, reason}

Räume sind SHA-256-Hashes der Server-Adresse; das Relay sieht also nicht, wo gespielt wird.
Start: python relay.py --port 8765   (hinter einem Reverse-Proxy mit TLS → wss://)
"""

import argparse
import asyncio
import itertools
import json
import logging
import re
import secrets
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass, field

import websockets

log = logging.getLogger("kuschelrad-relay")

ACTIONS = {"kiss", "hug", "headpat"}
REASONS = {"declined", "no_mod", "too_far", "busy", "timeout", "disabled", "cooldown"}
NAME_RE = re.compile(r"^[A-Za-z0-9_]{1,16}$")
ROOM_RE = re.compile(r"^[0-9a-f]{32}$")
REQUEST_TIMEOUT = 15.0
REQUEST_COOLDOWN = 1.5
AUTH_TIMEOUT = 20.0
HAS_JOINED_URL = "https://sessionserver.mojang.com/session/minecraft/hasJoined"


@dataclass(eq=False)
class Client:
    ws: object
    name: str = ""
    uuid: str = ""
    room: str = ""
    server_id: str = ""
    authed: bool = False
    last_request: float = 0.0


@dataclass
class Pending:
    id: int
    sender: Client
    target: Client
    action: str
    task: asyncio.Task = field(default=None, repr=False)


rooms: dict[str, dict[str, Client]] = {}
pending: dict[int, Pending] = {}
ids = itertools.count(1)
offline_mode = False


async def send(client: Client, **msg):
    try:
        await client.ws.send(json.dumps(msg))
    except websockets.ConnectionClosed:
        pass


def has_joined(name: str, server_id: str) -> str | None:
    query = urllib.parse.urlencode({"username": name, "serverId": server_id})
    with urllib.request.urlopen(f"{HAS_JOINED_URL}?{query}", timeout=10) as resp:
        if resp.status != 200:
            return None
        return json.load(resp).get("id")


async def authenticate(client: Client) -> bool:
    if offline_mode:
        return True
    try:
        profile_id = await asyncio.to_thread(has_joined, client.name, client.server_id)
    except Exception as e:  # Netzwerkfehler, kaputtes JSON …
        log.warning("hasJoined für %s fehlgeschlagen: %s", client.name, e)
        return False
    return profile_id is not None and profile_id.lower() == client.uuid.replace("-", "").lower()


async def expire(p: Pending):
    await asyncio.sleep(REQUEST_TIMEOUT)
    if pending.pop(p.id, None) is not None:
        await send(p.sender, t="refused", target=p.target.uuid, action=p.action, reason="timeout")


async def on_request(client: Client, msg: dict):
    to, action = str(msg.get("to", "")), msg.get("action")
    if action not in ACTIONS:
        return
    now = time.monotonic()
    if now - client.last_request < REQUEST_COOLDOWN:
        await send(client, t="refused", target=to, action=action, reason="cooldown")
        return
    client.last_request = now
    target = rooms.get(client.room, {}).get(to.lower())
    if target is None or target is client:
        await send(client, t="refused", target=to, action=action, reason="no_mod")
        return
    # Pro Spieler nur eine offene Anfrage.
    for old in [p for p in pending.values() if p.sender is client]:
        pending.pop(old.id, None)
        old.task.cancel()
    p = Pending(next(ids), client, target, action)
    p.task = asyncio.create_task(expire(p))
    pending[p.id] = p
    await send(target, t="incoming", id=p.id, **{"from": client.uuid}, action=action)


async def on_answer(client: Client, msg: dict):
    p = pending.get(msg.get("id"))
    if p is None or p.target is not client:
        return
    pending.pop(p.id, None)
    p.task.cancel()
    if msg.get("accept") is True:
        play = json.dumps({"t": "play", "initiator": p.sender.uuid, "receiver": client.uuid, "action": p.action})
        # Alle im Raum: Zuschauer mit der Mod sehen die Animation auch.
        websockets.broadcast([c.ws for c in rooms.get(client.room, {}).values()], play)
    else:
        reason = msg.get("reason") if msg.get("reason") in REASONS else "declined"
        await send(p.sender, t="refused", target=client.uuid, action=p.action, reason=reason)


async def handler(ws):
    client = Client(ws)
    try:
        hello = json.loads(await asyncio.wait_for(ws.recv(), AUTH_TIMEOUT))
        name, uuid, room = str(hello.get("name", "")), str(hello.get("uuid", "")).lower(), str(hello.get("room", ""))
        if hello.get("t") != "hello" or not NAME_RE.match(name) or not ROOM_RE.match(room) or len(uuid) != 36:
            await send(client, t="error", message="bad hello")
            return
        client.name, client.uuid, client.room = name, uuid, room
        client.server_id = secrets.token_hex(16)
        await send(client, t="challenge", serverId=client.server_id)

        auth = json.loads(await asyncio.wait_for(ws.recv(), AUTH_TIMEOUT))
        if auth.get("t") != "auth" or not await authenticate(client):
            await send(client, t="error", message="auth failed")
            return
        client.authed = True
        members = rooms.setdefault(room, {})
        old = members.get(uuid)
        members[uuid] = client
        if old is not None:
            await old.ws.close(4000, "replaced")
        await send(client, t="ready")
        log.info("%s verbunden (Raum %s…, %d Spieler)", name, room[:8], len(members))

        async for raw in ws:
            if len(raw) > 1024:
                continue
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            kind = msg.get("t")
            if kind == "request":
                await on_request(client, msg)
            elif kind == "answer":
                await on_answer(client, msg)
    except (asyncio.TimeoutError, websockets.ConnectionClosed, json.JSONDecodeError):
        pass
    finally:
        members = rooms.get(client.room)
        if members is not None and members.get(client.uuid) is client:
            del members[client.uuid]
            if not members:
                del rooms[client.room]
        for p in [p for p in pending.values() if client in (p.sender, p.target)]:
            pending.pop(p.id, None)
            p.task.cancel()


async def main():
    global offline_mode
    parser = argparse.ArgumentParser(description="Kuschelrad-Relay")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--offline", action="store_true", help="Mojang-Prüfung abschalten (nur zum lokalen Testen!)")
    args = parser.parse_args()
    offline_mode = args.offline
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if offline_mode:
        log.warning("OFFLINE-MODUS: Identitäten werden nicht geprüft")
    async with websockets.serve(handler, args.host, args.port, max_size=4096, ping_interval=30):
        log.info("Relay läuft auf ws://%s:%d", args.host, args.port)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())

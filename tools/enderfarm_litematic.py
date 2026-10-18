"""Enderman-XP-Farm als .litematic schreiben (gleicher Aufbau wie enderfarm/index.html).

Aufruf: python3 tools/enderfarm_litematic.py ZIEL.litematic [RINGE] [RADIUS]
"""
import gzip, struct, sys, time, math

dst = sys.argv[1]
RINGS = int(sys.argv[2]) if len(sys.argv) > 2 else 12
R = int(sys.argv[3]) if len(sys.argv) > 3 else 10
N, m = 2 * R + 1, R

# --- minimaler NBT-Schreiber (wie tools/litematic.py) ---
class Int(int): pass
class Long(int): pass
class LongArr(list): pass
def tag(v):
    if isinstance(v, Long): return 4
    if isinstance(v, int): return 3
    if isinstance(v, str): return 8
    if isinstance(v, LongArr): return 12
    if isinstance(v, list): return 9
    if isinstance(v, dict): return 10
    raise TypeError(v)
def s(x): b = x.encode(); return struct.pack('>H', len(b)) + b
def payload(v):
    t = tag(v)
    if t == 3: return struct.pack('>i', v)
    if t == 4: return struct.pack('>q', v)
    if t == 8: return s(v)
    if t == 12: return struct.pack('>i', len(v)) + b''.join(struct.pack('>q', x) for x in v)
    if t == 9:
        et = tag(v[0]) if v else 0
        return bytes([et]) + struct.pack('>i', len(v)) + b''.join(payload(x) for x in v)
    if t == 10:
        return b''.join(bytes([tag(x)]) + s(k) + payload(x) for k, x in v.items()) + b'\x00'
def signed(u): return u - (1 << 64) if u >= 1 << 63 else u

# --- Blockzustände ---
LEAVES = ('oak_leaves', {'distance': '7', 'persistent': 'true', 'waterlogged': 'false'})
STONE = ('stone', {})
DIRT = ('dirt', {})
def hopper(f): return ('hopper', {'enabled': 'true', 'facing': f})
def chest(t): return ('chest', {'facing': 'east', 'type': t, 'waterlogged': 'false'})
CARPET = ('white_carpet', {})
SLAB = ('smooth_stone_slab', {'type': 'top', 'waterlogged': 'false'})
# offene Falltür: Platte liegt an der Seite gegenüber von "facing"
def trapdoor(f): return ('oak_trapdoor', {'facing': f, 'half': 'bottom', 'open': 'true', 'powered': 'false', 'waterlogged': 'false'})
BARS = ('iron_bars', {'east': 'false', 'north': 'false', 'south': 'false', 'waterlogged': 'false', 'west': 'false'})
RAIL = ('rail', {'shape': 'north_south', 'waterlogged': 'false'})
LADDER = ('ladder', {'facing': 'north', 'waterlogged': 'false'})

# --- Aufbau: x = Spalte, z = Reihe, Spielerseite (Kisten) = größeres z ---
cells, y = {}, 0
def put(x, z, b): cells[(x, y, z)] = b
def ring(b, skip=None):
    for z in range(m - 2, m + 3):
        for x in range(m - 2, m + 3):
            if max(abs(z - m), abs(x - m)) == 2 and not (skip and skip(x, z)): put(x, z, b)
front_mid = lambda x, z: z == m + 2 and abs(x - m) <= 1

for z in range(m - 1, m + 4):                       # 1 Laubboden
    for x in range(m - 2, m + 3): put(x, z, LEAVES)
y += 1                                               # 2 Trichter + Kisten
for z in range(m - 1, m + 2):
    for x in range(m - 1, m + 2): put(x, z, hopper('south'))
for x in range(m - 1, m + 2):
    put(x, m + 2, chest('left')); put(x, m + 3, chest('right'))
ring(LEAVES, front_mid)
y += 1                                               # 3 Teppich
for z in range(m - 1, m + 2):
    for x in range(m - 1, m + 2): put(x, z, CARPET)
ring(LEAVES, front_mid)
y += 1; ring(LEAVES, front_mid)                      # 4 vorne offen
y += 1; ring(LEAVES, front_mid)                      # 5 Stufen
for x in range(m - 1, m + 2): put(x, m + 2, SLAB)
for k in range(RINGS):                               # Schacht: Lücke, Ring …
    y += 2; ring(LEAVES)
y += 2                                               # Plattform
for z in range(N):
    for x in range(N):
        dz, dx = z - m, x - m
        if max(abs(dz), abs(dx)) > 1: put(x, z, STONE)
        elif not dz and not dx: put(x, z, DIRT)
        else: put(x, z, trapdoor('south' if dz == -1 else 'north' if dz == 1 else 'east' if dx == -1 else 'west'))
for _ in range(3): y += 1; put(m, m, DIRT)           # Erdsäule
y += 1; put(m, m, BARS)
y += 1; put(m, m, DIRT); put(m, m + 1, DIRT)         # 2 × 1 Boden
def wall():
    for z in range(m - 1, m + 3):
        for x in range(m - 1, m + 2):
            if not (x == m and z in (m, m + 1)): put(x, z, DIRT)
y += 1; wall(); put(m, m, RAIL); put(m, m + 1, LADDER)
y += 1; wall(); put(m, m + 1, LADDER)

# --- schreiben ---
SX, SY, SZ = N, y + 1, N
key = lambda b: (b[0], tuple(sorted(b[1].items())))
used = sorted({key(b) for b in cells.values()})
palette = [{'Name': 'minecraft:air'}] + [
    {'Name': 'minecraft:' + n, **({'Properties': dict(p)} if p else {})} for n, p in used]
pidx = {k: i + 1 for i, k in enumerate(used)}
bits = max(2, math.ceil(math.log2(len(palette))))
vol = SX * SY * SZ
words = [0] * math.ceil(vol * bits / 64)
for (x, yy, z), b in cells.items():
    i = (yy * SZ + z) * SX + x
    v, bit = pidx[key(b)], i * bits
    w, o = bit // 64, bit % 64
    words[w] |= (v << o) & ((1 << 64) - 1)
    if o + bits > 64: words[w + 1] |= v >> (64 - o)
now = Long(int(time.time() * 1000))
size = {'x': Int(SX), 'y': Int(SY), 'z': Int(SZ)}
root = {
    'MinecraftDataVersion': Int(4903), 'Version': Int(7), 'SubVersion': Int(1),
    'Metadata': {'Name': 'Enderman-XP-Farm', 'Author': 'lizzy',
                 'Description': f'{N}x{N} Plattform, {RINGS} Laub-Ringe. Endermite in Lore selbst einsetzen.',
                 'RegionCount': Int(1), 'TotalBlocks': Int(len(cells)), 'TotalVolume': Int(vol),
                 'TimeCreated': now, 'TimeModified': now, 'EnclosingSize': size},
    'Regions': {'Enderfarm': {'Position': {'x': Int(0), 'y': Int(0), 'z': Int(0)}, 'Size': size,
                              'BlockStatePalette': palette, 'BlockStates': LongArr(signed(w) for w in words),
                              'TileEntities': [], 'Entities': [], 'PendingBlockTicks': [], 'PendingFluidTicks': []}},
}
with gzip.open(dst, 'wb') as f: f.write(b'\x0a' + s('') + payload(root))
print(len(cells), 'Blöcke,', len(palette), 'Paletteneinträge,', bits, 'bits,', SX, SY, SZ)

# Gegenprobe: zurücklesen
chk = 0
for (x, yy, z), b in cells.items():
    i = (yy * SZ + z) * SX + x; bit = i * bits; w, o = bit // 64, bit % 64
    val = words[w] >> o
    if o + bits > 64: val |= words[w + 1] << (64 - o)
    chk += (val & ((1 << bits) - 1)) == pidx[key(b)]
print('Gegenprobe ok:', chk == len(cells))

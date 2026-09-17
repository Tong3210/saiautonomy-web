"""Plan-view drawing for the story section. Geometry in feet, computed with shapely; emitted as SVG."""
from shapely.geometry import Polygon, LineString, Point, MultiLineString
from shapely.ops import unary_union
import math

PX = 3.0                       # px per foot
X0, YTOP = -38.0, 110.0        # world origin: x=-38 ft at left edge, y=110 ft at top edge
def P(x, y): return (round((x - X0) * PX, 2), round((YTOP - y) * PX, 2))
def fmt(pts): return ' '.join(f'{x} {y}' for x, y in pts)
def path_from_coords(coords, close=False):
    pts = [P(x, y) for x, y in coords]
    d = 'M' + fmt(pts[:1]) + ' L' + fmt(pts[1:])
    return d + (' Z' if close else '')

# structure: a block with a bay the plan did not account for
footprint = Polygon([(0,0),(130,0),(130,60),(85,60),(85,72),(45,72),(45,60),(0,60)])
STANDOFF_PLANNED = 25.0        # the pass was drawn 25 ft off the main wall
LIMIT = 20.0                   # the job allows no closer than 20 ft to the structure
pass_y = 60 + STANDOFF_PLANNED
pass_line = LineString([(-20, pass_y), (150, pass_y)])
waypoints = [(-20, pass_y), (22, pass_y), (64, pass_y), (107, pass_y), (150, pass_y)]

limit = footprint.buffer(LIMIT, join_style='round', quad_segs=24)
ring = list(limit.exterior.coords)
# start the ring at its leftmost point so the line draws from the left
i0 = min(range(len(ring)), key=lambda i: (ring[i][0], -ring[i][1]))
ring = ring[i0:] + ring[1:i0+1]

hits = pass_line.intersection(limit.exterior)
xs = sorted(g.x for g in (hits.geoms if hasattr(hits, 'geoms') else [hits]))
x_enter = xs[0]                                     # first point where the pass enters the limit
hold = Point(x_enter, pass_y)
nearest = min(((Point(c).distance(hold), c) for c in footprint.exterior.coords), key=lambda t: t[0])
corner = nearest[1]
assert abs(nearest[0] - LIMIT) < 0.05, nearest  # buffer arc is polygonal

# hatch: 45° lines every 1.5 m clipped to the footprint
lines = [LineString([(-100 + k, -100), (200 + k, 200)]) for k in range(-200, 260, 7)]
hatch = [g for g in (l.intersection(footprint) for l in lines) if not g.is_empty]
hatch_d = ' '.join('M' + fmt([P(*c) for c in g.coords]) for seg in hatch for g in (seg.geoms if hasattr(seg, 'geoms') else [seg]))

grid_minor = ''.join(f'M{P(x,-4)[0]} 0V400 ' for x in range(-10, 51, 5)) + ''.join(f'M0 {P(0,y)[1]}H600 ' for y in range(-4, 37, 4) if (y % 5 == 0))
grid_minor = ''.join(f'M{P(x,0)[0]} 0V440 ' for x in range(-20, 161, 20)) + ''.join(f'M0 {P(0,y)[1]}H600 ' for y in range(-20, 111, 20))

hx, hy = P(*hold.coords[0]); cx, cy = P(*corner)
sx = P(-20, pass_y)[0]
travel_px = round(hx - sx, 2)
wp_d = ' '.join(f'M{P(x,y)[0]-3} {P(x,y)[1]-3}h6v6h-6z' for x, y in waypoints)
struct_d = path_from_coords(list(footprint.exterior.coords)[:-1], close=True)
limit_d = path_from_coords(ring)
plan_d = path_from_coords([(-20, pass_y), (150, pass_y)])
ghost_d = f'M{hx} {hy} L{P(150, pass_y)[0]} {hy}'
wall_y = P(0, 60)[1]
dim1_len = round(wall_y - hy, 2)         # 25 ft in px
dim2 = f'M{hx} {hy} L{cx} {cy}'

svg = f'''<svg class="scene" viewBox="0 0 600 440" fill="none" aria-hidden="true">
  <defs>
    <marker id="tick" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 6L6 0" stroke="currentColor" stroke-width="1"/></marker>
  </defs>
  <g class="g-grid"><path d="{grid_minor}" stroke="currentColor" stroke-width="0.5" opacity="0.18"/></g>
  <g class="g-sheet">
    <g transform="translate(28 30)"><path d="M0 14V-10 M-5 -2L0 -10L5 -2" stroke="currentColor" stroke-width="1"/><text x="0" y="28" text-anchor="middle" class="t">N</text></g>
    <g transform="translate(20 424)"><path d="M0 0H60 M0 -4V4 M30 -3V3 M60 -4V4" stroke="currentColor" stroke-width="1"/><text x="0" y="14" class="t">0</text><text x="60" y="14" text-anchor="middle" class="t">20 ft</text></g>
    <text x="{P(65,28)[0]}" y="{P(65,28)[1]}" text-anchor="middle" class="t">structure</text>
    <text x="{sx}" y="{hy-10}" class="t">plan</text>
  </g>
  <g class="g-struct"><path class="d d-struct" pathLength="1" d="{struct_d}" stroke="currentColor" stroke-width="1.5"/></g>
  <g class="g-hatch"><path d="{hatch_d}" stroke="currentColor" stroke-width="0.6" opacity="0.5"/></g>
  <g class="g-plan"><path class="d d-plan" pathLength="1" d="{plan_d}" stroke="currentColor" stroke-width="1"/></g>
  <g class="g-wp"><path d="{wp_d}" stroke="currentColor" stroke-width="1"/></g>
  <g class="g-limit"><path class="d d-limit" pathLength="1" d="{limit_d}" stroke="currentColor" stroke-width="1.25" stroke-dasharray="1"/></g>
  <g class="g-limitlabel"><text x="{P(65,-26)[0]}" y="{P(65,-26)[1]}" text-anchor="middle" class="t tl">limit</text></g>
  <g class="g-ghost"><path d="{ghost_d}" stroke="currentColor" stroke-width="1" stroke-dasharray="2 4"/></g>
  <g class="g-craft" style="--travel:{travel_px}px">
    <g transform="translate({sx} {hy})">
      <g class="dim1"><path d="M0 0V{dim1_len}" stroke="currentColor" stroke-width="0.75" marker-start="url(#tick)" marker-end="url(#tick)"/><text x="6" y="{dim1_len/2+4}" class="t">25 ft</text></g>
      <circle r="4.5" fill="currentColor" stroke="none"/>
    </g>
  </g>
  <g class="g-dim2"><path d="{dim2}" stroke="currentColor" stroke-width="0.75" marker-start="url(#tick)" marker-end="url(#tick)"/><text x="{(hx+cx)/2+8}" y="{(hy+cy)/2-4}" class="t">20 ft</text></g>
  <g transform="translate({hx} {hy})"><g class="g-hold"><circle r="13" stroke="currentColor" stroke-width="1"/><circle r="22" stroke="currentColor" stroke-width="0.75" opacity="0.5"/></g></g>
</svg>'''
open('scene.svg', 'w').write(svg)
print(f"enter x={x_enter:.3f} ft -> px {hx},{hy}; corner {corner} -> px {cx},{cy}; travel {travel_px}px; dim1 {dim1_len}px; ring pts {len(ring)}; hatch segs {len(hatch)}")

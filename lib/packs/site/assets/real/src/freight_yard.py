# freight / yard: a distribution centre's loading dock at dusk. Dropped box trailers backed into the dock seals on
# their landing gear, empty bays between them, warm wall-packs over each door. Corrugated
# cladding, concrete dock apron, damp asphalt (Poly Haven, CC0), Blender's physical sky.
# Accent colour: the trailers' amber clearance markers. Usage: python freight_yard.py [--preview]
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import bpy, mathutils
from mathutils import Vector

E = os.environ.get
W, H = 1500, 900
sc = C.reset()
C.setup(sc, W, H, samples=int(E('SAMPLES', '96')), exposure=float(E('EXPO', '0')))
sc.cycles.max_bounces = 8
rng = random.Random(9)

# ---------- sky: same blue-hour sky as the hero ----------
nt = sc.world.node_tree
nt.nodes.clear()
sky = nt.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'MULTIPLE_SCATTERING'
sky.sun_elevation = math.radians(float(E('SUNEL', '-3.5')))
sky.sun_rotation = math.radians(float(E('SUNROT', '35')))
sky.altitude = 100
sky.aerosol_density = float(E('AEROSOL', '2.5'))
sky.sun_disc = False
bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = float(E('SKY', '0.5'))
out = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(sky.outputs['Color'], bg.inputs['Color']); nt.links.new(bg.outputs['Background'], out.inputs['Surface'])


def box(name, x0, x1, y0, y1, z0, z1, mat, bevel=0.0, seg=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.object; o.name = name
    o.scale = (x1 - x0, y1 - y0, z1 - z0)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = seg; b.limit_method = 'ANGLE'
        o.data.shade_smooth(); C.smooth(o)
    o.data.materials.append(mat)
    return o


def cyl(name, r, depth, loc, rot, mat, verts=32):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object; o.name = name; C.smooth(o); o.data.materials.append(mat)
    return o


# ---------- materials ----------
def cladding():
    """Painted trapezoidal steel cladding: vertical ribs from a wave texture into bump, light streaking and dirt."""
    m = C.principled('cladding', color=(0.19, 0.2, 0.21), rough=0.45, metal=0.6)
    nt = m.node_tree; N, L = nt.nodes, nt.links; b = N['Principled BSDF']
    tc = N.new('ShaderNodeTexCoord')
    wv = N.new('ShaderNodeTexWave'); wv.wave_type = 'BANDS'; wv.bands_direction = 'X'; wv.wave_profile = 'TRI'
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (float(E('RIB', '0.8')),) * 3  # rib pitch
    L.new(tc.outputs['Object'], mp.inputs['Vector']); L.new(mp.outputs['Vector'], wv.inputs['Vector'])
    wv.inputs['Scale'].default_value = 1.0
    cr = N.new('ShaderNodeMapRange'); cr.inputs['From Min'].default_value = 0.35; cr.inputs['From Max'].default_value = 0.65
    L.new(wv.outputs['Fac'], cr.inputs['Value'])
    bm = N.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = 0.6; bm.inputs['Distance'].default_value = 0.03
    L.new(cr.outputs['Result'], bm.inputs['Height']); L.new(bm.outputs['Normal'], b.inputs['Normal'])
    # vertical streaks of grime
    ns = N.new('ShaderNodeTexNoise'); ns.inputs['Scale'].default_value = 3.0; ns.inputs['Detail'].default_value = 8
    mp2 = N.new('ShaderNodeMapping'); mp2.inputs['Scale'].default_value = (1.0, 1.0, 0.08)
    L.new(tc.outputs['Object'], mp2.inputs['Vector']); L.new(mp2.outputs['Vector'], ns.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB'); e = ramp.color_ramp.elements
    e[0].position = 0.3; e[0].color = (0.12, 0.125, 0.13, 1); e[1].position = 0.7; e[1].color = (0.22, 0.23, 0.24, 1)
    L.new(ns.outputs['Fac'], ramp.inputs['Fac']); L.new(ramp.outputs['Color'], b.inputs['Base Color'])
    return m


clad = cladding()
conc_t = C.texture('concrete_wall_008', '2k')
apron = C.pbr('dock_concrete', conc_t, scale=1.0, color_mult=(0.42, 0.42, 0.42), hue_sat=(0.5, 0.3, 1.0), bump=1.0)
door_m = C.principled('door_panels', color=(0.42, 0.43, 0.44), rough=0.4, metal=0.5)
rubber = C.principled('seal_rubber', color=(0.012, 0.012, 0.013), rough=0.7)
yellow = C.principled('safety_yellow', color=(0.75, 0.52, 0.04), rough=0.5, **{'Coat Weight': 0.3})
trailer_m = C.principled('trailer_skin', color=(0.56, 0.57, 0.58), rough=0.4, metal=0.15, **{'Coat Weight': 0.3, 'Coat Roughness': 0.15})
alu = C.principled('alu', color=(0.72, 0.73, 0.75), rough=0.25, metal=1.0)
frame_m = C.principled('chassis', color=(0.02, 0.02, 0.02), rough=0.5, metal=0.4)
tyre_m = C.principled('tyre', color=(0.02, 0.02, 0.02), rough=0.75)
amber = C.emission('marker_amber', (1.0, 0.42, 0.05), float(E('AMBER', '10')))
pack_m = C.emission('wallpack', C.kelvin(3000), float(E('PACK', '40')))
inside_m = C.emission('warehouse_inside', C.kelvin(3800), float(E('INSIDE', '0.9')))

# ---------- building: dock wall along x at y=0, yard toward -y ----------
DOCK = 1.25      # dock floor height
WX0, WX1 = -40.0, 26.0
box('wall', WX0, WX1, 0.0, 0.4, DOCK, 10.0, clad)
box('apron', WX0, WX1, -0.05, 0.4, 0.0, DOCK, apron)
box('parapet', WX0, WX1, -0.08, 0.45, 10.0, 10.35, alu)
C.uv_box(bpy.data.objects['apron'], 0.35)
DOORS = [-22.0 + 4.4 * i for i in range(11)]
TRAILERS = {1, 2, 4, 7, 8}        # bays with a trailer backed in
OPEN = set()                      # bays with the door rolled up (a flat glow read fake without an interior, so none)
for i, x in enumerate(DOORS):
    hw = 1.35
    if i in OPEN:
        box('door_open', x - hw, x + hw, -0.02, 0.0, DOCK, DOCK + 2.75, inside_m)
        box('door_roll', x - hw, x + hw, -0.02, 0.1, DOCK + 2.75, DOCK + 3.05, door_m)
    else:
        box('door', x - hw, x + hw, -0.04, 0.05, DOCK, DOCK + 3.0, door_m)
        for k in range(1, 6):   # panel joints
            box('joint', x - hw, x + hw, -0.05, -0.035, DOCK + k * 0.5, DOCK + k * 0.5 + 0.012, rubber)
    # dock shelter: two side pads and a header curtain
    for s in (-1, 1):
        box('pad', x + s * hw + (0 if s > 0 else -0.5), x + s * hw + (0.5 if s > 0 else 0), -0.55, 0.0, DOCK, DOCK + 3.3, rubber, bevel=0.04)
        box('pad_stripe', x + s * (hw + 0.24) - 0.05, x + s * (hw + 0.24) + 0.05, -0.565, -0.55, DOCK + 0.2, DOCK + 3.2, yellow)
    box('header', x - hw - 0.5, x + hw + 0.5, -0.6, 0.0, DOCK + 3.05, DOCK + 3.65, rubber, bevel=0.04)
    # bumpers, leveler lip and a yellow guard post
    for s in (-1, 1):
        box('bumper', x + s * 1.05 - 0.13, x + s * 1.05 + 0.13, -0.16, -0.05, DOCK - 0.45, DOCK - 0.02, rubber, bevel=0.015)
    box('leveler', x - 1.0, x + 1.0, -0.12, 0.0, DOCK - 0.03, DOCK + 0.0, alu)
    cyl('bollard', 0.1, 1.2, (x - 2.0, -1.1, 0.6), (0, 0, 0), yellow)
    # wall-pack over each door, a warm downlight
    box('pack', x - 0.18, x + 0.18, -0.22, 0.0, DOCK + 4.4, DOCK + 4.62, frame_m, bevel=0.01)
    box('pack_lens', x - 0.15, x + 0.15, -0.21, -0.02, DOCK + 4.38, DOCK + 4.4, pack_m)
    C.light(sc, 'SPOT', (x, -0.3, DOCK + 4.35), target=(x, -5.0, 0.0), energy=float(E('PACKW', '700')), color=C.kelvin(3000),
            size=0.2, spot=math.radians(110), blend=0.8, name='pack')
    # door number plate: a blank sign (no text)
    box('plate', x - 0.3, x + 0.3, -0.03, 0.0, DOCK + 3.85, DOCK + 4.2, C.principled('plate', color=(0.22, 0.22, 0.23), rough=0.5))
# light from the open door spilling out
for x in [DOORS[i] for i in OPEN]:
    C.light(sc, 'AREA', (x, 0.3, DOCK + 1.5), target=(x, -6, 0.0), energy=float(E('SPILL', '900')), color=C.kelvin(3800), size=2.6,
            size_y=3.0, shape='RECTANGLE', name='spill')


# ---------- trailers (dropped on landing gear, rear in the seal) ----------
def trailer(x, length=14.6, seed=0):
    r = random.Random(seed)
    y0, y1 = -0.5 - length, -0.5
    box('trailer', x - 1.29, x + 1.29, y0, y1, 1.35, 4.1, trailer_m, bevel=0.03)
    for i in range(int(length / 0.6)):
        y = y0 + 0.3 + i * 0.6
        for s in (-1, 1):
            box('rib', x + s * 1.29 - 0.012, x + s * 1.29 + 0.012, y, y + 0.05, 1.37, 4.08, trailer_m)
    box('rail', x - 1.31, x + 1.31, y0, y1, 1.27, 1.4, alu)
    box('front_cap', x - 1.3, x + 1.3, y0 - 0.04, y0 + 0.02, 3.95, 4.12, alu)
    # nose: front corner markers (amber), glad-hand box, kingpin plate
    for s in (-1, 1):
        box('nose_marker', x + s * 1.2 - 0.05, x + s * 1.2 + 0.05, y0 - 0.06, y0 - 0.02, 3.98, 4.06, amber, bevel=0.01)
    box('gladhands', x - 0.25, x + 0.25, y0 - 0.12, y0, 1.6, 1.85, frame_m, bevel=0.01)
    box('upper_coupler', x - 1.0, x + 1.0, y0, y0 + 2.2, 1.22, 1.35, frame_m)
    # landing gear down on sand shoes
    for s in (-1, 1):
        box('leg', x + s * 0.9 - 0.06, x + s * 0.9 + 0.06, y0 + 2.4, y0 + 2.52, 0.12, 1.3, frame_m)
        box('shoe', x + s * 0.9 - 0.14, x + s * 0.9 + 0.14, y0 + 2.31, y0 + 2.61, 0.0, 0.1, frame_m)
    box('gear_brace', x - 0.9, x + 0.9, y0 + 2.42, y0 + 2.5, 0.7, 0.78, frame_m)
    # side markers and skirts
    for i in range(5):
        yy = y0 + 0.8 + i * (length - 1.6) / 4
        for s in (-1, 1):
            box('side_marker', x + s * 1.31 - 0.012, x + s * 1.31 + 0.012, yy, yy + 0.1, 1.31, 1.37, amber)
    box('skirt', x - 1.28, x + 1.28, y0 + 5.0, y0 + 10.5, 0.55, 1.27, frame_m)
    # rear axles
    for yy in (y1 - 3.4, y1 - 2.1):
        for s in (-1, 1):
            for k in (0.0, 0.32):
                cyl('tyre', 0.52, 0.3, (x + s * (0.8 + k), yy, 0.52), (0, math.radians(90), 0), tyre_m, verts=40)
            cyl('rim', 0.3, 0.32, (x + s * 1.14, yy, 0.52), (0, math.radians(90), 0), alu, verts=32)


for i in sorted(TRAILERS):
    trailer(DOORS[i] + rng.uniform(-0.04, 0.04), length=[14.6, 16.2, 14.6, 16.2, 13.6][sorted(TRAILERS).index(i)], seed=i)

# ---------- yard surface ----------
asph = C.texture('asphalt_pit_lane', '2k')
road_m = C.pbr('asphalt', asph, scale=0.25, rough_mult=float(E('WETR', '0.75')), bump=0.8)
b = road_m.node_tree.nodes['Principled BSDF']
N, L = road_m.node_tree.nodes, road_m.node_tree.links
rough_src = b.inputs['Roughness'].links[0].from_socket
wn = N.new('ShaderNodeTexNoise'); wn.inputs['Scale'].default_value = 0.12; wn.inputs['Detail'].default_value = 6
cr = N.new('ShaderNodeMapRange'); cr.inputs['From Min'].default_value = 0.45; cr.inputs['From Max'].default_value = 0.62
cr.inputs['To Min'].default_value = 1.0; cr.inputs['To Max'].default_value = 0.3
L.new(wn.outputs['Fac'], cr.inputs['Value'])
mu = N.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'
L.new(rough_src, mu.inputs[0]); L.new(cr.outputs['Result'], mu.inputs[1]); L.new(mu.outputs[0], b.inputs['Roughness'])
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -100, 0))
yard = bpy.context.object; yard.scale = (400, 200, 1); bpy.ops.object.transform_apply(scale=True)
yard.data.materials.append(road_m)
for lp in yard.data.loops:
    v = yard.data.vertices[lp.vertex_index].co
    yard.data.uv_layers.active.data[lp.index].uv = (v.x, v.y)
line_m = C.principled('bay_paint', color=(0.62, 0.5, 0.16), rough=0.65)
for x in DOORS:
    for s in (-1, 1):
        box('bay_line', x + s * 2.2 - 0.06, x + s * 2.2 + 0.06, -19.0, -0.6, 0.0, 0.004, line_m)
# yard light poles, far side, for scale
for px, py in ((-30.0, -34.0), (6.0, -40.0)):
    cyl('pole', 0.12, 12.0, (px, py, 6.0), (0, 0, 0), frame_m)
    box('flood', px - 0.4, px + 0.4, py + 0.1, py + 0.6, 11.6, 11.9, frame_m)
    box('flood_lens', px - 0.36, px + 0.36, py + 0.62, py + 0.64, 11.62, 11.88, C.emission('flood', C.kelvin(4300), 30))
    C.light(sc, 'SPOT', (px, py + 0.7, 11.6), target=(px + 4, py + 30, 0), energy=float(E('FLOOD', '12000')), color=C.kelvin(4300),
            size=0.5, spot=math.radians(70), blend=0.6, name='flood')

# ---------- camera: standing in the yard, three-quarter along the dock ----------
cam = C.camera(sc, (float(E('CX', '-34')), float(E('CY', '-30')), float(E('CZ', '1.7'))), (float(E('TX', '-6')), float(E('TYT', '-2')), float(E('TZ', '3.9'))),
               lens=float(E('LENS', '40')), fstop=float(E('FSTOP', '5.6')))
cam.data.dof.focus_distance = (Vector((-12.0, -8.0, 2.5)) - cam.location).length
C.render(sc, 'freight', 'yard')

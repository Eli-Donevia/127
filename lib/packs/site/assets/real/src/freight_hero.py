# freight / hero: a cab-over tractor-trailer coming down an empty divided highway at blue hour, headlights on, shot
# from the shoulder on a long lens. Truck modelled procedurally at real scale; asphalt from Poly Haven (CC0);
# sky from Blender's physical sky with the sun just under the horizon. Accent: the amber clearance lights.
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common as C
import bpy, mathutils

W, H = 1600, 1000
E = os.environ.get
sc = C.reset()
C.setup(sc, W, H, samples=int(E('SAMPLES', '96')), exposure=float(E('EXPO', '0')))
sc.cycles.max_bounces = 8
rng = random.Random(4)

# ---------- sky: sun 4 degrees under the horizon, behind the camera's left ----------
nt = sc.world.node_tree
nt.nodes.clear()
sky = nt.nodes.new('ShaderNodeTexSky')
sky.sky_type = 'MULTIPLE_SCATTERING'
sky.sun_elevation = math.radians(float(E('SUNEL', '-4')))
sky.sun_rotation = math.radians(float(E('SUNROT', '200')))
sky.altitude = 100
sky.air_density = 1.0
sky.aerosol_density = float(E('AEROSOL', '2.5'))
sky.sun_disc = False
bg = nt.nodes.new('ShaderNodeBackground')
bg.inputs['Strength'].default_value = float(E('SKY', '0.35'))
out = nt.nodes.new('ShaderNodeOutputWorld')
nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
nt.links.new(bg.outputs['Background'], out.inputs['Surface'])


def box(name, x0, x1, y0, y1, z0, z1, mat, bevel=0.0, seg=3, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.object
    o.name = name
    o.scale = (x1 - x0, y1 - y0, z1 - z0)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = seg; b.limit_method = 'ANGLE'
        C.smooth(o)
        o.data.shade_smooth()
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


def cyl(name, r, depth, loc, rot, mat, verts=48, parent=None, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.object
    o.name = name
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = 3; b.limit_method = 'ANGLE'
    C.smooth(o)
    o.data.materials.append(mat)
    if parent:
        o.parent = parent
    return o


# ---------- materials ----------
paint = C.principled('cab_paint', color=(0.045, 0.047, 0.05), rough=0.32, metal=0.55, **{'Coat Weight': 1.0, 'Coat Roughness': 0.04})
trailer_m = C.principled('trailer_skin', color=(0.62, 0.63, 0.64), rough=0.38, metal=0.15, **{'Coat Weight': 0.3, 'Coat Roughness': 0.15})
black = C.principled('black_plastic', color=(0.015, 0.015, 0.016), rough=0.55)
chrome = C.principled('chrome', color=(0.9, 0.9, 0.92), rough=0.08, metal=1.0)
alu = C.principled('alu', color=(0.75, 0.76, 0.78), rough=0.22, metal=1.0)
rubber = C.principled('rubber', color=(0.02, 0.02, 0.02), rough=0.75)
glassd = C.principled('windscreen', color=(0.02, 0.022, 0.025), rough=0.02, **{'Specular IOR Level': 0.8, 'Coat Weight': 0.0})
frame_m = C.principled('chassis', color=(0.02, 0.02, 0.02), rough=0.5, metal=0.4)
head = C.emission('headlamp', C.kelvin(5200), float(E('HEAD', '120')))
amber = C.emission('marker_amber', (1.0, 0.42, 0.05), float(E('AMBER', '40')))
red = C.emission('marker_red', (1.0, 0.04, 0.02), 25)

# ---------- truck (local: front face at y=0 facing -Y, ground z=0) ----------
truck = bpy.data.objects.new('truck', None)
sc.collection.objects.link(truck)
P = truck
# cab
box('cab', -1.25, 1.25, 0.0, 2.25, 1.15, 3.95, paint, bevel=0.09, seg=5, parent=P)
box('roof_fairing', -1.2, 1.2, 0.35, 2.25, 3.9, 4.12, paint, bevel=0.08, seg=4, parent=P)
box('windscreen', -1.12, 1.12, -0.012, 0.02, 2.38, 3.45, glassd, bevel=0.03, parent=P)
box('visor', -1.2, 1.2, -0.16, 0.05, 3.5, 3.58, black, bevel=0.01, parent=P)
box('side_window_l', -1.262, -1.24, 0.25, 1.15, 2.4, 3.35, glassd, parent=P)
box('side_window_r', 1.24, 1.262, 0.25, 1.15, 2.4, 3.35, glassd, parent=P)
box('door_seam_l', -1.264, -1.25, 1.2, 1.215, 1.3, 3.4, black, parent=P)
box('door_seam_r', 1.25, 1.264, 1.2, 1.215, 1.3, 3.4, black, parent=P)
# grille with horizontal bars
box('grille_back', -0.95, 0.95, -0.01, 0.05, 1.4, 2.28, black, parent=P)
for i in range(7):
    z = 1.46 + i * 0.12
    box('grille_bar', -0.93, 0.93, -0.03, 0.0, z, z + 0.045, alu if i % 3 == 0 else frame_m, bevel=0.008, parent=P)
box('badge', -0.18, 0.18, -0.04, -0.01, 2.06, 2.12, chrome, bevel=0.01, parent=P)
# bumper with lamps
box('bumper', -1.27, 1.27, -0.14, 0.2, 0.48, 1.12, black, bevel=0.04, parent=P)
for s in (-1, 1):
    x0, x1 = sorted((s * 0.72, s * 1.17))
    box('lamp_housing', x0 - 0.02, x1 + 0.02, -0.16, -0.1, 0.84, 1.08, chrome, bevel=0.01, parent=P)
    box('lamp', x0, x1, -0.175, -0.15, 0.87, 1.05, head, bevel=0.012, parent=P)
    box('fog', s * 0.95 - 0.1, s * 0.95 + 0.1, -0.16, -0.13, 0.6, 0.7, C.emission('foglamp', C.kelvin(4200), 30), bevel=0.01, parent=P)
    box('indicator', x0 + (0.0 if s > 0 else 0.3), x1 - (0.3 if s > 0 else 0.0), -0.165, -0.12, 0.76, 0.82, amber, parent=P)
# clearance lights on the roof edge (US style), the scene's one coloured practical
for i in range(5):
    x = -0.5 + i * 0.25
    box('clearance', x - 0.05, x + 0.05, -0.02, 0.04, 4.03, 4.08, amber, bevel=0.01, parent=P)
# mirrors
for s in (-1, 1):
    cyl('mirror_arm', 0.018, 0.4, (s * 1.42, 0.12, 2.9), (0, math.radians(90), 0), black, parent=P)
    box('mirror', s * 1.58 - 0.09, s * 1.58 + 0.09, 0.05, 0.16, 2.35, 3.05, black, bevel=0.03, parent=P)
# steps and fuel tank
for s in (-1, 1):
    box('step', s * 1.24 - 0.08, s * 1.24 + 0.08, 1.75, 2.15, 0.62, 0.66, alu, parent=P)
    cyl('tank', 0.33, 1.5, (s * 1.0, 3.3, 0.85), (math.radians(90), 0, 0), alu, parent=P, bevel=0.02)
# chassis
box('chassis', -0.5, 0.5, 0.2, 7.2, 0.62, 1.0, frame_m, parent=P)
# wheels: front steer, two drive axles, three trailer axles
def wheel(x, y, dual=False):
    for k in ([0] if not dual else [-0.16, 0.16]):
        xx = x + (k if x > 0 else -k)
        cyl('tyre', 0.52, 0.3, (xx, y, 0.52), (0, math.radians(90), 0), rubber, parent=P, bevel=0.06)
    cyl('rim', 0.3, 0.32, (x + (0.02 if x > 0 else -0.02) * (2 if dual else 1), y, 0.52), (0, math.radians(90), 0), alu, parent=P, bevel=0.02)
for s in (-1, 1):
    wheel(s * 1.05, 1.15)
    wheel(s * 0.95, 5.0, True)
    wheel(s * 0.95, 6.4, True)
    for y in (13.4, 14.7, 16.0):
        wheel(s * 0.95, y, True)
# trailer
TY0, TY1 = 2.75, 17.4
box('trailer', -1.29, 1.29, TY0, TY1, 1.3, 4.1, trailer_m, bevel=0.03, parent=P)
for i in range(int((TY1 - TY0) / 0.6)):
    y = TY0 + 0.3 + i * 0.6
    for s in (-1, 1):
        box('rib', s * 1.29 - 0.012, s * 1.29 + 0.012, y, y + 0.05, 1.32, 4.08, trailer_m, parent=P)
box('trailer_rail', -1.31, 1.31, TY0, TY1, 1.22, 1.36, alu, parent=P)
box('skirt', -1.28, 1.28, 7.6, 12.6, 0.55, 1.25, black, parent=P)
for i in range(6):
    y = TY0 + 0.6 + i * (TY1 - TY0 - 1.2) / 5
    for s in (-1, 1):
        box('side_marker', s * 1.31 - 0.012, s * 1.31 + 0.012, y, y + 0.1, 1.27, 1.33, amber, parent=P)
box('landing_gear', -0.9, 0.9, 6.9, 7.05, 0.3, 1.3, frame_m, parent=P)

TRUCK_X, TRUCK_Y = -1.85, float(E('TY', '58'))
truck.location = (TRUCK_X, TRUCK_Y, 0)
truck.rotation_euler = (0, 0, math.radians(float(E('YAW', '0.6'))))
# headlight beams
for s in (-1, 1):
    l = C.light(sc, 'SPOT', (TRUCK_X + s * 0.95, TRUCK_Y - 0.25, 0.96), target=(TRUCK_X + s * 0.6, TRUCK_Y - 40, 0.0),
                energy=float(E('BEAM', '9000')), color=C.kelvin(5200), size=0.06, spot=math.radians(38), blend=0.5, name='beam')

# ---------- road ----------
asph = C.texture('asphalt_pit_lane', '2k')
road_m = C.pbr('asphalt', asph, scale=0.25, rough_mult=float(E('WETR', '0.75')), bump=0.8)
# damp: patches where the roughness drops
b = road_m.node_tree.nodes['Principled BSDF']
N, L = road_m.node_tree.nodes, road_m.node_tree.links
rough_src = b.inputs['Roughness'].links[0].from_socket
wn = N.new('ShaderNodeTexNoise'); wn.inputs['Scale'].default_value = 0.08; wn.inputs['Detail'].default_value = 6
cr = N.new('ShaderNodeMapRange'); cr.inputs['From Min'].default_value = 0.45; cr.inputs['From Max'].default_value = 0.62
cr.inputs['To Min'].default_value = 1.0; cr.inputs['To Max'].default_value = 0.35
L.new(wn.outputs['Fac'], cr.inputs['Value'])
mu = N.new('ShaderNodeMath'); mu.operation = 'MULTIPLY'
L.new(rough_src, mu.inputs[0]); L.new(cr.outputs['Result'], mu.inputs[1]); L.new(mu.outputs[0], b.inputs['Roughness'])

bpy.ops.mesh.primitive_plane_add(size=1, location=(-3.6, 600, 0))
road = bpy.context.object; road.scale = (11.0, 1400, 1)
bpy.ops.object.transform_apply(scale=True)
road.data.materials.append(road_m)
# uv in metres
for lp in road.data.loops:
    v = road.data.vertices[lp.vertex_index].co
    road.data.uv_layers.active.data[lp.index].uv = ((v.x + 3.6) / 1.0, (v.y) / 1.0)
paint_w = C.principled('road_paint', color=(0.7, 0.7, 0.68), rough=0.6)
paint_y = C.principled('road_paint_y', color=(0.7, 0.5, 0.12), rough=0.6)
box('edge_line', -7.45, -7.3, -100, 1300, 0.0, 0.004, paint_w)
box('median_line', 0.0, 0.12, -100, 1300, 0.0, 0.004, paint_y)
y = -100.0
while y < 1300:
    box('dash', -3.68, -3.55, y, y + 3.0, 0.0, 0.004, paint_w)
    y += 12.0
# grass median and verges, rolling far land
ground = C.principled('verge', color=(0.03, 0.035, 0.022), rough=0.95)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 600, -0.05))
g = bpy.context.object; g.scale = (4000, 3000, 1); g.data.materials.append(ground)
# northbound carriageway beyond the median
bpy.ops.mesh.primitive_plane_add(size=1, location=(8.6, 600, 0.0))
r2 = bpy.context.object; r2.scale = (7.6, 1400, 1); bpy.ops.object.transform_apply(scale=True); r2.data.materials.append(road_m)
for lp in r2.data.loops:
    v = r2.data.vertices[lp.vertex_index].co
    r2.data.uv_layers.active.data[lp.index].uv = (v.x, v.y)
# median barrier
box('barrier', 2.2, 2.6, -100, 1300, 0.0, 0.81, C.principled('concrete_barrier', color=(0.32, 0.32, 0.31), rough=0.8), bevel=0.05)
# distant hills
bpy.ops.mesh.primitive_grid_add(x_subdivisions=400, y_subdivisions=8, size=1, location=(0, 2600, 0))
hills = bpy.context.object; hills.scale = (6000, 400, 1); bpy.ops.object.transform_apply(scale=True)
for v in hills.data.vertices:
    t = v.co.x / 600.0
    v.co.z = (40 + 35 * math.sin(t * 1.3) + 18 * math.sin(t * 3.7 + 1) + 8 * math.sin(t * 9.1)) * max(0, (v.co.y - 2200) / 400)
hills.data.materials.append(C.principled('hill', color=(0.02, 0.022, 0.02), rough=1.0))
# a few far lights along the road (distant traffic and a farm) for scale
for i in range(int(E('FAR', '9'))):
    yy = rng.uniform(250, 1200)
    xx = rng.choice([-5.5, -2.0, 6.5, 10.5, rng.uniform(-200, 200)])
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, location=(xx, yy, 1.0))
    o = bpy.context.object
    o.data.materials.append(head if xx > 3 else red)

# ---------- air: thin haze near the ground so the headlamps bloom and the land falls off ----------
C.fog_box((-2, 60, 6), (60, 160, 12), density=float(E('FOG', '0.006')), anisotropy=0.75)
sc.cycles.volume_step_rate = 4.0

# ---------- camera: on the hard shoulder, low, long lens ----------
cam = C.camera(sc, (float(E('CX', '-13')), 0.0, float(E('CZ', '1.3'))), (TRUCK_X + 0.6, TRUCK_Y + 4.0, 2.35),
               lens=float(E('LENS', '135')), fstop=float(E('FSTOP', '4')))
cam.data.dof.focus_distance = (mathutils.Vector((TRUCK_X, TRUCK_Y, 2.0)) - cam.location).length
cam.data.shift_x = float(E('SHX', '-0.1'))
cam.data.shift_y = float(E('SHY', '0.05'))

C.render(sc, 'freight', 'hero')

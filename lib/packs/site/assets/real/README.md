# Rendered photos (assets/real)

Photoreal stills for the niche designs, rendered in Blender (Cycles) from the scene scripts in `src/`. `art.js`
`photo(design, name)` loads `assets/real/<design>/<name>.jpg`, keyed by the slot name (beacon uses `hero` and `about`
for the car). Every file is a progressive 4:2:0 JPG at 1x the slot size. Encoding starts at q80 and steps down until
the file fits its per-slot budget in `src/common.py` (`BUDGET`). The site preview inlines every photo of a design, so
each design's photos together stay around 150 to 190 KB. That keeps Lighthouse mobile performance at 90 or above.

Rules the scenes follow (D57): light comes only from emitters in the scene, with no glow, flare or bloom added in post.
Every object has a contact shadow. There are no people, hands, faces, logos, text or fake UI. Each scene has one quiet
coloured practical (cyan or amber), kept off the subject.

## Files

| file | size | what it shows | script |
|---|---|---|---|
| optic/hero.jpg | 1800x1200 | Gold round spectacles on black marble at a dinner table, wine glasses and a votive behind, the city out of focus through the window, a cyan neon tube off to the side | optic_hero.py |
| optic/heroPhone.jpg | 1080x1600 | The same set, vertical: the frames sit in the upper middle (the phone headline covers the lower half), bokeh above, their reflection below; the cyan is a soft strip at the right edge | optic_hero.py (SLOT=heroPhone) |
| optic/tray.jpg | 1500x900 | Five frames standing open in a black velvet tray: gold, tortoiseshell acetate, thin titanium, rose gold, matte black | optic_tray.py |
| freight/hero.jpg | 1800x1200 | A cab-over tractor-trailer on an empty divided highway at blue hour, headlamps on, from the shoulder on a long lens: chrome bumper and grille, a glass windscreen holding the dusk sky, road grime low down | freight_hero.py |
| freight/heroPhone.jpg | 1080x1600 | The same, vertical | freight_hero.py (SLOT=heroPhone) |
| freight/yard.jpg | 1500x900 | A distribution centre's dock at dusk: dropped box trailers backed in perpendicular to the dock seals, noses toward the yard on their landing gear, warm wall-packs, grime and tyre marks | freight_yard.py |
| roastery/bag.jpg | 1200x1500 | A matte kraft side-gusset coffee bag with a tin tie and a dark degassing valve on a dark wooden bar, spilled beans, a stoneware cup, a bare filament bulb, jars and an amber uplight behind | roastery_hero.py |
| roastery/roaster.jpg | 1600x1000 | A fresh batch in the cooling tray with its stirring arms, the drum roaster behind with the burner glowing in the sight glass | roastery_roaster.py |
| beacon/hero.jpg | 1600x1000 | A black car on black lacquer, a long low crop along its side with the softbox laid along the shoulder, the front wheel right of centre | beacon_car.py |
| beacon/about.jpg | 1200x1400 | Close crop of that wheel under its arch: split-spoke alloy, drilled disc, caliper, tyre | beacon_car.py (SLOT=about) |

## Assets and licences

All downloaded assets are CC0 (public domain) from Poly Haven (https://polyhaven.com/license). The scripts fetch them
at render time into `$REAL_DL`; none are kept in the repo.

| asset | type | used in |
|---|---|---|
| [round_spectacles](https://polyhaven.com/a/round_spectacles) | model | optic hero, tray (frame finish replaced) |
| [lightbulb_01](https://polyhaven.com/a/lightbulb_01) | model | roastery bag |
| [velour_velvet](https://polyhaven.com/a/velour_velvet) | texture | optic tray |
| [asphalt_pit_lane](https://polyhaven.com/a/asphalt_pit_lane) | texture | freight hero, yard |
| [dark_wood](https://polyhaven.com/a/dark_wood) | texture | roastery bag |
| [concrete_wall_008](https://polyhaven.com/a/concrete_wall_008) | texture | freight yard apron |

Everything else is modelled procedurally in the scripts. That covers the marble, glassware, window and city bokeh, the
truck, trailers, dock and sky (Blender's physical sky), the coffee bag, beans (rigid-body drop), cup, roaster and
cooling tray, and the car and wheel. The colour-temperature helper follows
Brand's `brand/v2/hyperreal/src/scene.py`.

## Settings

- Blender 5.1 (`bpy` module), Cycles on the CPU.
- AgX view transform with the "AgX - Medium High Contrast" look.
- Adaptive sampling (threshold 0.008) and OpenImageDenoise.
- Bounces 12, glossy 6, transmission 12, caustics off.
- Samples:
  - 128: optic/hero, freight hero and heroPhone.
  - 112: roastery/bag.
  - 96: optic/heroPhone and tray, freight/yard, roastery/roaster, beacon.
- Render times are about 2 to 18 minutes per frame on 4 cores.

## Re-rendering

```sh
# a Python with the bpy 5.1 wheel (pip install bpy==5.1.*), ImageMagick for the JPG step
export REAL_DL=/some/cache/dir      # downloads (models, textures) go here, never into the repo
export REAL_OUT=/some/out/dir       # 16-bit PNGs, the bean/cloth sim caches and <tag>.assets.json land here
python -I -B src/optic_hero.py                       # writes optic/hero.jpg
SLOT=heroPhone python -I -B src/optic_hero.py        # writes optic/heroPhone.jpg
python -I -B src/beacon_car.py --preview             # 50% size, 24 samples, PNG only (no JPG written)
```

- `SLOT` picks the slot in multi-slot scripts.
- `SAMPLES` sets the sample count.
- `--preview` renders at half size with 24 samples.
- Most lights, cameras and strengths read an environment variable, named next to each value in the script (for
  example `NEON`, `SPOT`, `LENS`, `CAMX`).
- The roastery beans are simulated once and cached as JSON in `$REAL_OUT`. Delete the cache to re-run the simulation.

## Not shipped: drop

`src/drop_hero.py` (a cloth-simulated tee on a hanger) and `src/drop_folded.py` with `src/garment.py` (folded pieces)
are kept as work in progress. Neither has passed review yet. The hung tee reads as a stiff sack with bunched sleeves,
and the folded pieces read as blocks or towels. So `drop/` ships no photos and the design keeps its drawings. They use
Poly Haven's cotton_jersey, jogging_melange, denim_fabric, knitted_fleece, rough_linen, concrete_wall_008 and
concrete_floor_02 (all CC0). The likely route is CC0 garment scans.

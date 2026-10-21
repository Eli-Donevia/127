# Rendered photos (assets/real)

Photoreal stills for the niche designs, rendered in Blender (Cycles) from the scene scripts in `src/`. `art.js`
`photo(design, name)` loads `assets/real/<design>/<name>.jpg`, keyed by the slot name (beacon uses `hero` and `about`
for the car). Every file is a progressive 4:2:0 JPG at 1x the slot size, encoded at q86 and stepped down until it is
under 150 KB.

Rules the scenes follow (D57): light comes only from emitters in the scene, with no glow, flare or bloom added in post.
Every object has a contact shadow. There are no people, hands, faces, logos, text or fake UI. Each scene has one quiet
coloured practical (cyan or amber), kept off the subject.

## Files

| file | size | what it shows | script |
|---|---|---|---|
| optic/hero.jpg | 1800x1200 | Gold round spectacles on black marble at a dinner table, wine glasses and a votive behind, the city out of focus through the window, a cyan neon tube off to the side | optic_hero.py |
| optic/heroPhone.jpg | 1080x1600 | The same set from lower and closer; the cyan is a soft strip at the right edge | optic_hero.py (SLOT=heroPhone) |
| optic/tray.jpg | 1500x900 | Five frames standing open in a black velvet tray: gold, tortoiseshell acetate, thin titanium, rose gold, matte black | optic_tray.py |
| freight/hero.jpg | 1800x1200 | A cab-over tractor-trailer on an empty divided highway at blue hour, headlamps on, from the shoulder on a long lens | freight_hero.py |
| freight/heroPhone.jpg | 1080x1600 | The same, vertical | freight_hero.py (SLOT=heroPhone) |
| freight/yard.jpg | 1500x900 | A distribution centre's dock at dusk: dropped box trailers backed into the seals, warm wall-packs, one door open | freight_yard.py |
| roastery/bag.jpg | 1200x1500 | A kraft side-gusset coffee bag with a tin tie on a dark wooden bar, spilled beans, a stoneware cup with steam, jars and an amber uplight behind | roastery_hero.py |
| roastery/roaster.jpg | 1600x1000 | A fresh batch in the cooling tray with its stirring arms, the drum roaster behind with the burner glowing in the sight glass | roastery_roaster.py |
| drop/hero.jpg | 1200x1500 | A heavyweight tee (cloth-simulated) on a wooden hanger, one hard spot on concrete, a cyan cove line at the floor | drop_hero.py |
| drop/p1..p6.jpg | 1000x1250 | Folded pieces on a dark concrete plinth under one spot: p1 bone tee, p2 black tee, p3 grey melange, p4 denim, p5 cream knit, p6 sand linen | drop_folded.py (SLOT=p1..p6) |
| drop/folded.jpg | 1600x1000 | The pieces in four stacks along a long plinth, wide | drop_folded.py (SLOT=folded) |
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
| [cotton_jersey](https://polyhaven.com/a/cotton_jersey) | texture | drop hero, p1, p2 |
| [jogging_melange](https://polyhaven.com/a/jogging_melange) | texture | drop p3 |
| [denim_fabric](https://polyhaven.com/a/denim_fabric) | texture | drop p4 |
| [knitted_fleece](https://polyhaven.com/a/knitted_fleece) | texture | drop p5 |
| [rough_linen](https://polyhaven.com/a/rough_linen) | texture | drop p6 |
| [concrete_wall_008](https://polyhaven.com/a/concrete_wall_008) | texture | drop, freight yard apron |
| [concrete_floor_02](https://polyhaven.com/a/concrete_floor_02) | texture | drop |

Everything else is modelled procedurally in the scripts. That covers the marble, glassware, window and city bokeh, the
truck, trailers, dock and sky (Blender's physical sky), the coffee bag, beans (rigid-body drop), cup, steam, roaster
and cooling tray, the tee (cloth sim) and folds, and the car and wheel. The colour-temperature helper follows
Brand's `brand/v2/hyperreal/src/scene.py`.

## Settings

- Blender 5.1 (`bpy` module), Cycles on the CPU.
- AgX view transform with the "AgX - Medium High Contrast" look.
- Adaptive sampling (threshold 0.008) and OpenImageDenoise.
- Bounces 12, glossy 6, transmission 12, caustics off.
- Samples:
  - 128: optic/hero, freight hero and heroPhone, roastery/bag, drop/hero.
  - 96: optic/heroPhone and tray, freight/yard, roastery/roaster, beacon.
  - 64: drop pieces and folded.
- Render times are about 2 to 18 minutes per frame on 4 cores.

## Re-rendering

```sh
# a Python with the bpy 5.1 wheel (pip install bpy==5.1.*), ImageMagick for the JPG step
export REAL_DL=/some/cache/dir      # downloads (models, textures) go here, never into the repo
export REAL_OUT=/some/out/dir       # 16-bit PNGs, the bean/cloth sim caches and <tag>.assets.json land here
python -I -B src/optic_hero.py                       # writes optic/hero.jpg
SLOT=heroPhone python -I -B src/optic_hero.py        # writes optic/heroPhone.jpg
SLOT=p3 SAMPLES=64 python -I -B src/drop_folded.py   # one folded piece
python -I -B src/beacon_car.py --preview             # 50% size, 24 samples, PNG only (no JPG written)
```

- `SLOT` picks the slot in multi-slot scripts.
- `SAMPLES` sets the sample count.
- `--preview` renders at half size with 24 samples.
- Most lights, cameras and strengths read an environment variable, named next to each value in the script (for
  example `NEON`, `SPOT`, `LENS`, `CAMX`).
- The drop tee and the roastery beans are simulated once and cached as JSON in `$REAL_OUT`. Delete the cache to re-run
  the simulation.

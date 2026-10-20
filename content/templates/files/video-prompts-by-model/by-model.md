# Video prompts by model: a free sampler

Every AI video and image model reads a prompt a little differently. Here is how each one wants it, in its maker's own words, with the same shots written for each so you can see the difference.

Made for your business. Checked 2026-10-20.

## The short version

- Higgsfield: short sentences. Positive words only.
- Kling: one or two sentences, subject first. Takes a negative prompt.
- Google Veo: full sentences, camera first. Takes a negative prompt.
- Runway: [camera] shot of [subject] [action] in [setting]; with a photo: The camera [move] as the subject [action].. Positive words only.
- Luma Ray: about 100 words or fewer, present tense, action first. Positive words only.
- Sora-style: a short scene paragraph, then Cinematography, Actions in beats, and Dialogue blocks. Positive words only.
- FLUX: subject first, 30 to 80 words. Positive words only.
- Imagen and Gemini image: subject, context, style; full sentences for Gemini image. Takes a negative prompt.

## Rules that work everywhere

- Describe motion, not the picture, when you animate a photo.
- One camera move and one main action per shot.
- Never put a real person's name or another company's logo in a prompt.
- UGC-style shots are your own demo or a creator you hire who says they were paid. Never script a customer review.

## Higgsfield

How Higgsfield reads a prompt:

- Pick the camera move as a preset in Higgsfield (Dolly In, 360 Orbit, Crane Up, FPV Drone and more). The preset does the move; the words say what the subject does while it happens.
- Say the speed and where the shot starts and ends, or results drift between tries.
- Pick a starting photo that suits the move: subject centered for orbits, dolly and zooms, a wide scene for FPV and handheld, a close-up for POV.
- Change one thing at a time between tries: the move, then the lens, then the depth of field.
- With a photo: The photo is the first frame. Write what the subject does and how fast; the preset handles the camera.

### 1. Tabletop push in

The opening shot of a product ad. Camera: Push in. Higgsfield preset: Dolly In.

```
Your product sits on a wooden tabletop as a soft beam of light slides across it in a softly lit studio. Slow move, starting on a medium shot and ending on a close-up. Warm side light, soft shadows, premium product commercial.
```

### 2. Your own demo

The owner shows how it works. Camera: Locked-off. Higgsfield preset: Static.

```
A friendly person, the maker of your product, demonstrates your product on a kitchen counter, step by step in a home kitchen. The camera holds still. Bright daylight, honest phone demo.
```

### 3. Pull back on the finished job

Start on one clean detail, end on the whole space. Camera: Pull back. Higgsfield preset: Dolly Out.

```
The same space, spotless and finished, is revealed from a gleaming detail to the full space in a client's home. Slow move, starting on a close-up and ending on a wide shot. Fresh daylight, proud reveal.
```

### 4. Orbit every side

Show the product from all sides. Camera: Orbit. Higgsfield preset: 360 Orbit.

```
Your product stands still on a round plinth against a seamless backdrop in your brand color #2F6FDF. Slow move, starting on the front and ending on the back, then the front again. Rim light outlining its edges, studio product film.
```

## Kling

How Kling reads a prompt:

- Kling reads subject, subject movement, scene, then camera language, lighting and atmosphere.
- Use one main camera move per shot and say its speed: slow, stable pan left, no sudden motion.
- Plain camera words beat vague ones: slow dolly in, pull back, orbit slowly, static camera.
- Describe a start and end frame for reveals: start on a close-up of the label, then pull back.
- Kling takes a separate negative prompt for things to keep out.
- With a photo: Keep the subject description short and steady; spend the words on what moves and how the camera moves.

### 1. Tabletop push in

The opening shot of a product ad. Camera: Push in.

```
Your product sits on a wooden tabletop as a soft beam of light slides across it in a softly lit studio. Slow, steady dolly in toward the subject. Warm side light, soft shadows, premium product commercial. Start on a medium shot, end on a close-up.
```

Negative prompt: blurry, warped hands, extra fingers, distorted face, flicker, garbled text, watermark, low quality

### 2. Your own demo

The owner shows how it works. Camera: Locked-off.

```
A friendly person, the maker of your product, demonstrates your product on a kitchen counter, step by step in a home kitchen. Static camera, no camera movement. Bright daylight, honest phone demo.
```

Negative prompt: blurry, warped hands, extra fingers, distorted face, flicker, garbled text, watermark, low quality

### 3. Pull back on the finished job

Start on one clean detail, end on the whole space. Camera: Pull back.

```
The same space, spotless and finished, is revealed from a gleaming detail to the full space in a client's home. Start on a close-up, then slowly pull back to reveal the full scene. Fresh daylight, proud reveal. Start on a close-up, end on a wide shot.
```

Negative prompt: blurry, warped hands, extra fingers, distorted face, flicker, garbled text, watermark, low quality

### 4. Orbit every side

Show the product from all sides. Camera: Orbit.

```
Your product stands still on a round plinth against a seamless backdrop in your brand color #2F6FDF. Camera orbits slowly around the subject, smooth and stable. Rim light outlining its edges, studio product film. Start on the front, end on the back, then the front again.
```

Negative prompt: blurry, warped hands, extra fingers, distorted face, flicker, garbled text, watermark, low quality

## Google Veo

How Google Veo reads a prompt:

- Google's formula: cinematography, then subject, action, context, then style and ambiance.
- Veo makes sound. Write dialogue in quotes after who says it, sound effects after SFX:, and background sound after Ambient noise:.
- Describe what you want rather than what to leave out: a quiet street with no cars reads better than no cars.
- Length, resolution and shape are settings, not prompt words: 4, 6 or 8 seconds, 16:9 or 9:16.
- Keep one speaker per clip: one voice lip-syncs far more reliably than two.
- With a photo: Veo animates a start image, or a start and end frame: describe the change between them and the sound.

### 1. Tabletop push in

The opening shot of a product ad. Camera: Push in.

```
A slow dolly-in shot. Your product sits on a wooden tabletop as a soft beam of light slides across it in a softly lit studio. Warm side light, soft shadows. Premium product commercial. SFX: a soft click as light lands. Ambient noise: a quiet room tone.
```

Negative prompt: blurry footage, warped hands, distorted faces, on-screen text, watermark

### 2. Your own demo

The owner shows how it works. Camera: Locked-off.

```
A static locked-off shot. A friendly person, the maker of your product, demonstrates your product on a kitchen counter, step by step in a home kitchen. Bright daylight. Honest phone demo. A friendly person says, "I made this because I needed it. Here's how it works."
```

Negative prompt: blurry footage, warped hands, distorted faces, on-screen text, watermark

### 3. Pull back on the finished job

Start on one clean detail, end on the whole space. Camera: Pull back.

```
A slow dolly-out shot that reveals the full scene. The same space, spotless and finished, is revealed from a gleaming detail to the full space in a client's home. Fresh daylight. Proud reveal.
```

Negative prompt: blurry footage, warped hands, distorted faces, on-screen text, watermark

### 4. Orbit every side

Show the product from all sides. Camera: Orbit.

```
A slow 180-degree arc shot around the subject. Your product stands still on a round plinth against a seamless backdrop in your brand color #2F6FDF. Rim light outlining its edges. Studio product film.
```

Negative prompt: blurry footage, warped hands, distorted faces, on-screen text, watermark

## Runway

How Runway reads a prompt:

- Runway's template: [camera] shot of [subject] [action] in [environment], then any supporting detail.
- Positive words only. Describe what you want to see; negative phrasing can backfire.
- Start simple and add one detail at a time between tries.
- If you see unwanted cuts, try the longer length or add: continuous, seamless shot.
- For no camera movement: the locked-off camera remains perfectly still.
- With a photo: With a photo, write almost only about motion: The camera [move] as the subject [action]. Describing what the photo already shows can reduce motion.

### 1. Tabletop push in

The opening shot of a product ad. Camera: Push in.

```
The camera slowly pushes in, while your product sits on a wooden tabletop as a soft beam of light slides across it in a softly lit studio. Warm side light, soft shadows, premium product commercial.
```

### 2. Your own demo

The owner shows how it works. Camera: Locked-off.

```
The locked-off camera remains perfectly still as a friendly person, the maker of your product, demonstrates your product on a kitchen counter, step by step in a home kitchen. Bright daylight, honest phone demo.
```

### 3. Pull back on the finished job

Start on one clean detail, end on the whole space. Camera: Pull back.

```
The camera slowly pulls back to reveal the scene as the same space, spotless and finished, is revealed from a gleaming detail to the full space in a client's home. Fresh daylight, proud reveal.
```

### 4. Orbit every side

Show the product from all sides. Camera: Orbit.

```
The camera moves in a slow, smooth arc around the subject as your product stands still on a round plinth against a seamless backdrop in your brand color #2F6FDF. Rim light outlining its edges, studio product film.
```

## Luma Ray

How Luma Ray reads a prompt:

- Order: main subject, action, details, scene, style, camera move.
- Positive only: Luma treats negative prompting as counterproductive.
- Name one specific move (dolly forward, slow pan right, camera circles slowly) and add a secondary motion like dust, fabric or reflections.
- Present tense, about 100 words. Skip filler like hyper-realistic.
- A 5 second clip holds one clear action; 10 seconds can hold a beginning, middle and end.
- With a photo: Use your photo as the start keyframe (or end keyframe) and write the motion that happens from it.

### 1. Tabletop push in

The opening shot of a product ad. Camera: Push in.

```
Your product sits on a wooden tabletop as a soft beam of light slides across it in a softly lit studio. The camera dollies forward slowly. Premium product commercial, warm side light, soft shadows. Light shifts gently through the scene.
```

### 2. Your own demo

The owner shows how it works. Camera: Locked-off.

```
A friendly person, the maker of your product, demonstrates your product on a kitchen counter, step by step in a home kitchen. The camera holds still. Honest phone demo, bright daylight. Soft reflections move across the surfaces.
```

### 3. Pull back on the finished job

Start on one clean detail, end on the whole space. Camera: Pull back.

```
The same space, spotless and finished, is revealed from a gleaming detail to the full space in a client's home. The camera pulls back slowly, revealing the scene. Proud reveal, fresh daylight. Soft reflections move across the surfaces.
```

### 4. Orbit every side

Show the product from all sides. Camera: Orbit.

```
Your product stands still on a round plinth against a seamless backdrop in your brand color #2F6FDF. The camera circles slowly around the subject. Studio product film, rim light outlining its edges. Soft reflections move across the surfaces.
```

## Sora-style

How Sora-style reads a prompt:

- Write the scene in plain prose, then a Cinematography line (shot and mood), then the actions as timed beats.
- One camera move, one subject action and one lighting recipe per shot.
- Shorter clips follow the prompt more closely: two 4 second clips often beat one 8 second clip.
- Dialogue goes in its own block and stays brief: one or two short lines in 4 seconds.
- Leave out what doesn't matter; the model fills it in. Length and size are settings, not prompt words.
- With a photo: The image anchors the first frame; write what happens next.

### 1. Tabletop push in

The opening shot of a product ad. Camera: Push in.

```
Your product in a softly lit studio. Warm side light, soft shadows.
Cinematography: slow push-in, premium product commercial.
Actions: Your product sits on a wooden tabletop as a soft beam of light slides across it, then holds for the final second.
Sound: a soft click as light lands.
```

### 2. Your own demo

The owner shows how it works. Camera: Locked-off.

```
A friendly person, the maker of your product, in a home kitchen. Bright daylight.
Cinematography: static locked-off camera, honest phone demo.
Actions: A friendly person, the maker of your product, demonstrates your product on a kitchen counter, step by step, then holds for the final second.
Dialogue: A friendly person: "I made this because I needed it. Here's how it works."
```

### 3. Pull back on the finished job

Start on one clean detail, end on the whole space. Camera: Pull back.

```
The same space, spotless and finished, in a client's home. Fresh daylight.
Cinematography: slow pull-back reveal, proud reveal.
Actions: The same space, spotless and finished, is revealed from a gleaming detail to the full space, then holds for the final second.
```

### 4. Orbit every side

Show the product from all sides. Camera: Orbit.

```
Your product against a seamless backdrop in your brand color #2F6FDF. Rim light outlining its edges.
Cinematography: slow orbit around the subject, studio product film.
Actions: Your product stands still on a round plinth, then holds for the final second.
```

## FLUX

How FLUX reads a prompt:

- FLUX weighs early words most: lead with the subject, then the action, style and context.
- No negative prompts. Describe the opposite: empty instead of no people, brightly lit instead of not dark.
- Put any words for the image in quotes and say where they go, how big and what color.
- Attach each hex color to one object: a backdrop in color #1F6FEB.
- Name a camera, lens, aperture or film look for a photo feel instead of professional photo.


### 1. Hero on your color

A clean product ad. Camera: Locked-off.

```
Your product centered against a seamless backdrop in your brand color #2F6FDF, straight-on, eye-level view, clean commercial product photography, soft studio light with a gentle shadow, 85mm product photo. The words "New this week" in bold sans serif at the top, in white, easy to read.
```

### 2. Before and after split

Local services. Camera: Locked-off.

```
A split image, a messy, grimy space on the left and the same space, spotless and finished on the right, with a clean vertical divide in a clean, bright studio, straight-on, eye-level view, clear comparison photo, bright even light.
```

### 3. Flat lay

Styled spreads. Camera: Overhead.

```
Your product surrounded by a few simple props on a linen surface, top-down flat lay, editorial flat lay, soft daylight.
```

## Imagen and Gemini image

How Imagen and Gemini image reads a prompt:

- Build from subject, context and background, then style. Add detail one round at a time.
- Keep words in the image to 25 characters or fewer, and no more than three short phrases.
- A negative prompt lists things plainly (wall, frame), without no or don't.
- Photo words that work: close-up, aerial, from below, natural or dramatic light, bokeh, 35mm, 50mm, macro, wide angle.
- On the Gemini API, Imagen has given way to Gemini image (Nano Banana): the same prompts work, written as full sentences.


### 1. Hero on your color

A clean product ad. Camera: Locked-off.

```
Your product centered against a seamless backdrop in your brand color #2F6FDF. Clean commercial product photography. Straight-on, eye-level view. Soft studio light with a gentle shadow. 85mm product photo. The text "New this week" in large bold letters at the top.
```

Negative prompt: blurry, distorted hands, extra fingers, watermark, cluttered background

### 2. Before and after split

Local services. Camera: Locked-off.

```
A split image, a messy, grimy space on the left and the same space, spotless and finished on the right, with a clean vertical divide in a clean, bright studio. A clear comparison photo. Straight-on, eye-level view. Bright even light.
```

Negative prompt: blurry, distorted hands, extra fingers, watermark, cluttered background

### 3. Flat lay

Styled spreads. Camera: Overhead.

```
Your product surrounded by a few simple props on a linen surface. An editorial flat lay. Top-down flat lay. Soft daylight.
```

Negative prompt: blurry, distorted hands, extra fingers, watermark, cluttered background

## Sources

- https://higgsfield.ai/camera-controls
- https://higgsfield.ai/blog/WAN-AI-Camera-Control-Your-Guide-to-Cinematic-Motion
- https://kling.ai/blog/kling-ai-prompt-guide
- https://kling.ai/blog/kling-ai-camera-control-video-guide
- https://docs.comfy.org/zh/built-in-nodes/KlingTextToVideoNode
- https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/video/turn-the-prompt-rewriter-off
- https://academy.runwayml.com/prompt-guide
- https://help.runwayml.com/hc/en-us/articles/39789879462419-Gen-4-Video-Prompting-Guide
- https://www.tomsguide.com/ai/ai-image-video/runway-now-lets-you-write-1000-character-prompts-to-generate-ai-videos-i-put-it-to-the-test
- https://lumalabs.ai/learning-hub/dream-machine-how-to-generate-with-ray2
- https://lumalabs.ai/learning-center/articles/luma-video-models-field-guide
- https://docs.lumalabs.ai/docs/video-generation
- https://developers.openai.com/cookbook/examples/sora/sora2_prompting_guide
- https://docs.bfl.ai/guides/prompting_guide_flux2
- https://docs.bfl.ai/guides/prompting_guide_t2i_negative
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/image/img-gen-prompt-guide
- https://ai.google.dev/gemini-api/docs/imagen
- https://ai.google.dev/gemini-api/docs/image-generation

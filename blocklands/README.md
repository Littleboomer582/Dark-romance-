# Blocklands

An original voxel sandbox game for **Android**: dig, build and explore an endless block world. It also runs in any desktop or mobile browser.

All of the code and art is new. The textures are painted in code, the sounds are synthesized, and there are no downloaded assets. It doesn't use a game engine, just WebGL.

## Install on Android

1. Copy **`blocklands.apk`** to your phone, or download it there.
2. Tap it. Android asks you to allow installs from that source (Files or Chrome). Allow it, then tap **Install**.
3. Open **Blocklands** from your home screen. It works fully offline.

It needs Android 7.0 or newer with WebGL (any phone from the last ~8 years).

## Features

- **Endless worlds** generated from a seed:
  - Plains, forests, deserts with cacti, snowy peaks and oceans with beaches.
  - Oak and birch trees, tall grass and flowers.
  - Winding caves with coal and iron ore, and bedrock at the bottom.
- **26 block types**, including glass, bricks, stone bricks, sandstone, clay and lamps.
- **Survival mode**:
  - Mining takes time, and dug blocks go into your inventory.
  - Placing a block uses one. You take fall damage and your hearts regenerate.
  - **Crafting**: planks, stone, glass, stone bricks, sandstone, bricks and lamps.
- **Creative mode**: every block in unlimited amounts, instant digging, and flying (double-tap jump or the FLY button). You can switch modes from the pause menu.
- **Day and night**: a 10-minute day with a sun, moon, sunset colours and dark nights.
- **Lighting**: soft ambient occlusion and sky shadows under trees and in caves. Lamps light up the area around them.
- Swimming, see-through water, sneaking (stops you walking off edges), sprinting and auto-jump.
- **Multiple saved worlds**. Each world saves automatically and when you leave the app.
- Settings: render distance, look sensitivity, field of view, Fast/Fancy graphics, auto-jump, sound, FPS counter, and break/place buttons.

## Controls

**Touch**

| Action | How |
|---|---|
| Walk | Drag anywhere on the left side (a joystick appears under your thumb). Push it all the way forward to sprint. |
| Look | Drag on the right side |
| Place block | Tap |
| Dig | Press and hold |
| Jump / swim / fly up | ▲ |
| Sneak / fly down | ▼ (tap to toggle sneak) |
| Pick block | Tap a hotbar slot |
| Inventory and crafting | ▦ |
| Pause | II or the Android Back button |

If you prefer buttons, turn on *Touch buttons for break/place* in Settings.

**Keyboard and mouse:** click to capture the mouse. WASD moves, Space jumps (double-tap to fly in Creative), Shift sneaks and Ctrl sprints. Left mouse digs, right mouse places, and the middle mouse button or Q picks the block you're looking at. Use the wheel or 1–9 to choose a hotbar slot. E opens the inventory, F toggles flying, F3 shows debug info and Esc pauses.

## Play in a browser

Open `web/index.html` directly, or serve the `web/` folder with any static server (for example `npx serve blocklands/web`).

## Rebuild the APK

You need a JDK (17+) and the Android SDK with `build-tools;34.0.0` and `platforms;android-34`:

```bash
ANDROID_HOME=/path/to/android-sdk ./blocklands/android/build-apk.sh
```

The first build creates a signing key at `blocklands/android/blocklands.keystore` (it is git-ignored). Keep that file: Android only installs updates that are signed with the same key. To use your own key, set `KEYSTORE`, `KEYSTORE_PASS` and `KEY_ALIAS`.

To regenerate the launcher icons: `node blocklands/scripts/make-icons.js` (needs Playwright).

## Code layout

| File | What it does |
|---|---|
| `web/js/noise.js` | Seeded value noise and fractal noise |
| `web/js/blocks.js` | Block definitions, recipes, the procedurally painted texture atlas and block icons |
| `web/js/world.js` | 16×16×96 chunks, terrain, biomes, caves, ores and trees, plus the player's edits |
| `web/js/mesher.js` | Builds chunk meshes: hidden-face culling, ambient occlusion, sky light and lamp light |
| `web/js/render.js` | WebGL shaders, frustum culling, water pass, sun and moon, block outline |
| `web/js/player.js` | Movement physics, collision, swimming and flying, fall damage, voxel raycast |
| `web/js/input.js` | Touch joystick and look, tap/hold actions, keyboard and mouse |
| `web/js/ui.js` | Menus, world list, settings, hotbar, hearts, inventory and crafting |
| `web/js/main.js` | Game state, chunk streaming, digging and placing, saving, main loop |
| `android/` | WebView app wrapper (`MainActivity.java`), manifest, icons and build script |

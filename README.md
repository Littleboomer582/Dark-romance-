# Frontline 1945

An online **team-vs-team** (Allies vs Axis) **first-person** 3D WWII shooter built with Three.js. It runs in any **computer browser** and installs on **Android as an app** (Progressive Web App: home-screen icon, fullscreen, landscape).

## Features

- **8 maps**:
  - **Ruins:** bombed-out town.
  - **Village:** French farm houses, a barn and a fountain square.
  - **Winter Forest:** snowy pines, log piles, foxholes and falling snow.
  - **Pacific Island:** beach bunkers, palms and sandbag lines.
  - **Rail Yard:** a freight depot with boxcars, sheds, coal heaps and a water tower.
  - **Harbor:** warehouses and cargo split by a canal with two bridges. The water stops you walking, but bullets fly over it.
  - **Boot Camp:** a small, fast close-quarters arena inside a log palisade.
  - **Main Street:** a compact home-front town block. A clapboard house faces a general store across a street with parked cars. Both buildings have windows you can shoot or jump through, and backyards have fences you can hop.
- **4 game modes**:
  - **Team Deathmatch:** score kills.
  - **Domination:** capture flags A, B and C. Each flag held scores points.
  - **Capture the Flag:** bring the enemy flag to your base while your own flag is home.
  - **Headquarters:** hold the active zone to score. It moves every minute.
- Bots play the objectives. The host picks the map, mode, score limit and time limit, and Quick Play rotates through every map and mode.
- Up to 16 players per room.
- **Main menu with lobbies**:
  - **Quick Play** drops you into a public match.
  - **Create Lobby** makes you the host. You set bots per team, score limit and time limit, and choose public or private. You get a 5-letter code to share with friends.
  - **Find Lobby** lists open lobbies (or join by code).
  - In the lobby, players pick a team and press **Ready**, and the host presses **Start Match**. After the match everyone returns to the lobby for a rematch.
  - The host can remove players. If the host leaves, another player becomes host.
- **Bots** fill empty slots, so you can play alone or with a few friends. You pick 0–6 bots per team when you create a room, and a bot leaves when a real player joins.
- **77 weapons from three eras.** Pick the era in the loadout: WWII, Cold War, Modern, or all.
  - **WWII:** Thompson, MP40, PPSh-41, Type 100, StG 44, BAR, M1 Garand, Gewehr 43, SVT-40, M1A1 Carbine, Kar98k, Springfield, Mosin-Nagant, Arisaka, Trench Gun, Double-Barreled, MG42, DP-28, Type 99, and pistols.
  - **Cold War:** AK-47, M16A1, FAMAS F1, Galil ARM, AUG A1, FN FAL, M14, MP5K, Uzi, Skorpion vz. 61, AK-74u, MAC-11, M60, RPK, Stoner 63, RPD, L96A1, Dragunov SVD, WA2000, PSG1, Ithaca 37, SPAS-12, Makarov PM, CZ75.
  - **Modern:** M4A1, M16A4 (burst), SCAR-H, ACR, TAR-21, F2000, AN-94 (burst), XM8, MP7, Vector, P90, UMP45, PP-2000, MG4, LSAT, L86 LSW, CheyTac M200, Barrett M82, DSR 50, AA-12, KSG, M1014, Winchester 1887, Desert Eagle, Glock 18, USP .45, M9, Five-seven, Beretta 93R.
  - Snipers come with a scope.
- **Modern attachments:** Red Dot and Holographic sights (with a reticle when aiming), ACOG (2.2x), Laser Sight, and an underbarrel Grenade Launcher.
- **14 attachments**, up to **3 per primary** (one per slot) plus **1 for your sidearm**. They are all modelled on the 3D gun:
  - Optic: **Telescopic Scope** (4x zoom with a scope overlay) or **Aperture Sight**
  - Muzzle: **Suppressor** (stays off the enemy radar), **Flash Hider** (less recoil, no flash) or **Rifle Grenade** (3 explosive launched grenades)
  - Underbarrel: **Foregrip** or **Bipod** (deadly accurate while still or crouched)
  - Magazine: **Extended Mag**, **Drum Mag** or **Dual Mags** (faster reloads)
  - Ammo: **FMJ Rounds** (shoot through crates and sandbags) or **Rapid Fire**
  - Also: **Bayonet** (one-hit lunge) and **Sling** (faster movement and faster aiming)
- **Detailed weapons**:
  - Each gun is modeled from shaped parts with real details: carved wood stocks, tapered barrels, sight hoods, barrel bands, trigger guards, bolt handles, and perforated barrel jackets.
  - Materials: blued and parkerized steel, varnished wood, bakelite and brass, lit by a reflection map.
- **Working mechanisms**:
  - Bolt-actions are cycled by your hand after each shot, and pistol slides recoil.
  - The Trench Gun pumps, the revolver cylinder swings out, and the double-barrel breaks open.
  - Magazines drop out and are replaced, while casings and shells eject.
- **Gun feel**: spring recoil, weapon sway, muzzle smoke, a muzzle flash that lights the area, and layered gunshot audio plus mechanical sounds (bolt, magazine, Garand clip "ping").
- **Movement**:
  - **Jump** over sandbags, logs and fences, onto crates and car roofs, and through windows.
  - **Slide:** sprint, then press crouch.
  - **Prone:** slow, but steadier and harder to hit; the bipod works prone.
  - Jumping makes shots inaccurate.
- **Scorestreaks**:
  - **Earning points:** kills (+100), headshots (+25), assists (+50), and objectives: capturing or neutralizing Domination flags, taking, capturing or returning CTF flags, and holding the HQ. Points reset when you die.
  - **Choosing:** pick 3 in your loadout. Keys 5, 6 and 7 use them in cost order.
  - **400 Recon Plane:** shows every enemy on your team's minimap.
  - **500 Counter-Recon:** jams the enemy minimap and blocks their recon.
  - **550 Supply Drop:** a crate with full ammo, grenades and health for your team.
  - **750 Airstrike:** a line of bombs through your aim point.
  - **850 Strafing Run:** a fighter rakes your aim line.
  - **950 Mortar Barrage:** shells on enemy positions.
  - **1100 Paratroopers:** three friendly soldiers who fight for 45 seconds.
  - **1300 Artillery:** a heavy bombardment of the enemy half of the map.
  - Bots pick and use scorestreaks too.
- **Settings screen**:
  - Rebind every key.
  - Mouse: look sensitivity, aiming sensitivity, hold or toggle aim, and invert-Y.
  - Display and sound: field of view, master volume, and graphics quality.
- **Real 3D ballistics**: headshots (x1.5 damage), crouching behind sandbags and crates, shooting over low cover, recoil, and grenades that arc and bounce.
- Frag grenades, knife and bayonet melee, aiming down sights, sprinting, crouching, health that regenerates, a rotating minimap with radar, damage-direction indicators, a death cam, a killfeed and a scoreboard.
- The server decides all hits (authoritative server). Your own movement is predicted on your device so it feels responsive.

## Android app (APK)

**`frontline-1945.apk`** is a ready-to-install Android app for Android 7.0 and newer. The game is bundled inside, so **offline vs bots works with no internet**. Online play connects to your game server.

1. Copy `frontline-1945.apk` to your phone, or download it there.
2. Tap it. Android asks you to allow installing from this source (Chrome or Files). Allow it, then tap **Install**.
3. Open **Frontline 1945**. It runs fullscreen in landscape.

To rebuild it (needs a JDK and the Android SDK with `build-tools;34.0.0` and `platforms;android-34`):

```bash
ANDROID_HOME=/path/to/android-sdk ./android/build-apk.sh
```

The first build creates a signing key at `android/frontline.keystore`. Keep that file: Android only installs updates that are signed with the same key.

## Play in a web browser (one HTML file)

Open **`frontline-1945.html`** in Chrome, Edge, Firefox or Safari. You can double-click it, and no install or server is needed.

- **PLAY OFFLINE VS BOTS** runs a full match inside the page.
- **DEPLOY ONLINE** plays against other people. Enter your game server's address (see "Put it online" below) in the *Game server* box.

You can email this file or share it on a USB stick. To rebuild it after changing the code, run `npm run build`.

## Run it

```bash
npm install
npm start          # http://localhost:3000
```

Other devices on the same Wi-Fi can open `http://<your-computer-ip>:3000`.

## Put it online

The game is a single Node.js server that hosts both the web page and the WebSocket game connection. Any Node host works, for example Render, Railway, Fly.io or a VPS:

- Build command: `npm install`
- Start command: `npm start`
- The server reads the `PORT` environment variable.
- The health check is at `/healthz`.

Use **HTTPS** in production. Android needs HTTPS before it lets you install the app.

## Install on Android

1. Open the game's HTTPS address in **Chrome** on the phone.
2. Tap **Install as app** on the menu, or use Chrome's ⋮ menu → **Add to Home screen / Install app**.
3. Launch it from the home screen. It opens fullscreen in landscape.

**Want a real APK or a Play Store listing?** Put your HTTPS address into [PWABuilder](https://www.pwabuilder.com/) and pick **Android**, or use Google's `bubblewrap` CLI. Either one wraps this PWA in a Trusted Web Activity APK. No code changes are needed.

If the app is hosted somewhere other than the game server, point it at the server with `?server=https://your-server.example.com`.

## Controls

| | Computer | Android |
|---|---|---|
| Move | WASD | Left thumb stick (push it all the way up to sprint) |
| Look | Mouse (click to lock the pointer) | Drag on the right side of the screen (light aim assist) |
| Fire | Left click | **FIRE** buttons (drag on them to aim while firing) |
| Aim down sights | Right click | **AIM** |
| Sprint | Shift | push the stick all the way up |
| Jump | Space | **JUMP** |
| Crouch / Slide | C (while sprinting: slide), or hold Ctrl | **↧** (tap while sprinting: slide) |
| Prone | Z, or hold C | hold **↧** |
| Reload / Swap | R / Q or mouse wheel | **R** / **⇆** |
| Grenade / Melee | G / V | **G** / **⚔** |
| Rifle grenade | B | **RG** |
| Scorestreaks | 5 / 6 / 7 | tap the button that appears |
| Scores / Loadout | Tab / L | ☰ / ⚙ |

Every key can be changed in **Settings**, which is on the main menu, the pause screen and the loadout screen.

## Project layout

- `server.js`: HTTP and WebSocket server (thin wrapper around `sim.js`)
- `public/sim.js`: game simulation: rooms, hit detection, grenades, bot AI (A* pathfinding). Runs on the server and in the browser for offline play
- `scripts/build-standalone.js`: builds the single-file `frontline-1945.html`
- `public/shared.js`: weapon and attachment stats, map, and collision code shared by the server and the client
- `public/guns.js`: procedural weapon models, materials and part animations
- `public/game.js`: first-person Three.js client: world, soldiers, procedural gun and attachment models, viewmodel, input, prediction, audio, loadout builder
- `public/vendor/three.module.min.js`: Three.js r170, bundled locally so the Android app needs no CDN
- `public/index.html`, `style.css`: menus and HUD
- `public/manifest.webmanifest`, `sw.js`, `icons/`: installable PWA

Weapons are real historical firearms. The game, map and art are original.

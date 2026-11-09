# Frontline 1945

An online **team-vs-team** (Allies vs Axis) **first-person** 3D WWII shooter built with Three.js. It runs in any **computer browser** and installs on **Android as an app** (Progressive Web App: home-screen icon, fullscreen, landscape).

## Features

- **11 maps**:
  - **Ruins:** bombed-out town.
  - **Village:** French farm houses, a barn and a fountain square.
  - **Winter Forest:** snowy pines, log piles, foxholes and falling snow.
  - **Pacific Island:** beach bunkers, palms and sandbag lines.
  - **Rail Yard:** a freight depot with boxcars, sheds, coal heaps and a water tower.
  - **Harbor:** warehouses and cargo split by a canal with two bridges. The water stops you walking, but bullets fly over it.
  - **Boot Camp:** a small, fast close-quarters arena inside a log palisade.
  - **Main Street:** a compact home-front town block. A clapboard house faces a general store across a street with parked cars. Both buildings have windows you can shoot or jump through, and backyards have fences you can hop.
  - **Airfield:** hangars, parked fighters behind sandbag revetments, runways, and a control tower in the middle.
  - **Desert Outpost:** flat-roofed adobe houses with doors and windows, compound walls and palm trees.
  - **Factory:** a big pillared factory hall between two loading yards with rail cars, coal heaps and tall chimneys.
- **8 game modes**:
  - **Team Deathmatch:** score kills.
  - **Domination:** capture flags A, B and C. Each flag held scores points.
  - **Capture the Flag:** bring the enemy flag to your base while your own flag is home.
  - **Headquarters:** hold the active zone to score. It moves every minute.
  - **Kill Confirmed:** kills drop dog tags. Grab enemy tags to score, and your team's tags to deny them.
  - **Hardcore:** team deathmatch where a few bullets kill and friendly fire is on. There is no minimap, crosshair, health bar or ammo counter.
  - **Search & Destroy:** rounds with one life each. Attackers plant a bomb at site A or B by staying on the site. Defenders win by killing them all, by running out the clock, or by defusing the bomb (stay on it for 6 seconds). Sides swap every round.
  - **Demolition:** with respawns, the Allies try to blow up both sites before time runs out, and the Axis defend and defuse.
- **Realism**:
  - Soldiers have real proportions: bending knees, rounded torsos, jointed arms, faces, M1 and Stahlhelm helmets, webbing, ammo pouches, canteens and packs.
  - Leg hits do less damage than body hits, and headshots do more. Damage drops off gradually with range.
  - Scopes sway with your breathing. Hold sprint (or L3) to hold your breath for up to 4 seconds, and you're out of breath for a moment afterwards.
  - Sprinting tires you out after about 6 seconds ("WINDED") until you get your breath back.
  - **Weather and time of day:** every match is clear, overcast, dusk, rain or fog. It's random, or the host picks it, and so can you in offline matches. Rain falls and you can hear it; dusk brings a low orange sun and long shadows; fog and rain cut visibility. Bots can't spot you as far away in fog, rain or at dusk.
  - **Suppression:** enemy bullets that pass close to you crack and whizz past, darken the edges of your vision and shake your aim.
  - **Concussion:** nearby explosions muffle your hearing, with a ringing in your ears.
  - **Bullet holes** stay on walls, crates and the ground.
  - **Reloads:** closed-bolt guns keep a round in the chamber, so reloading before you're empty gives one extra round (30+1). Reloading an empty gun takes 25% longer.
  - **Deaths:** bodies fall away from the shot and stay on the ground for 10 seconds.
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
- **14 attachments**, up to **5 per primary** (one per slot) plus **2 for your sidearm**. They are all modelled on the 3D gun:
  - Optic: **Telescopic Scope** (4x zoom with a scope overlay) or **Aperture Sight**
  - Muzzle: **Suppressor** (stays off the enemy radar), **Flash Hider** (less recoil, no flash) or **Rifle Grenade** (3 explosive launched grenades)
  - Underbarrel: **Foregrip** or **Bipod** (deadly accurate while still or crouched)
  - Magazine: **Extended Mag**, **Drum Mag** or **Dual Mags** (faster reloads)
  - Ammo: **FMJ Rounds** (shoot through crates and sandbags) or **Rapid Fire**
  - Also: **Bayonet** (one-hit lunge) and **Sling** (faster movement and faster aiming)
- **Detailed weapons**:
  - Each gun is modeled from shaped parts with real details: carved wood stocks, tapered barrels, sight hoods, barrel bands, trigger guards, bolt handles, and perforated barrel jackets.
  - Materials: blued and parkerized steel, varnished wood, bakelite and brass, lit by a reflection map.
  - **AR-15 family** (M4A1, M16A1, M16A4, SCAR-H, ACR): separate upper and lower receivers, a flared magazine well, pivot and takedown pins, bolt catch, selector, ejection port with dust cover, forward assist, brass deflector, a rear T-handle that you pull on reloads, quad rails or a ribbed handguard, a triangular front sight base, a slotted birdcage, a buffer tube with castle nut, and collapsible or fixed A2 stocks.
  - **AK family** (AK-47, AK-74u, RPK, Galil, Dragunov SVD, AN-94): a stamped receiver with a curved dust cover, rivets, a long selector lever, a charging handle on the bolt carrier, upper and lower wood handguards, a gas block, a hooded front sight and a rear sight leaf.
  - Modern guns use anodized aluminium and textured (stippled) polymer, and magazines show the top round.
  - **Every modern gun has its own real side profile and signature parts.** A few examples:
    - **HK guns** (MP5K, PSG1): the stamped receiver, cocking tube and drum rear sight.
    - **Uzi:** the ribbed top cover and grip safety.
    - **Bullpups:** the hand guards of the AUG, TAR-21 and F2000; the AUG's built-in scope housing; and the FAMAS carry-handle sights and folded bipod.
    - **P90:** the thumbhole body and a see-through top magazine with the rounds inside.
    - **Rifles:** the FAL's vented handguard and left-side charging handle; the one-piece wood stock and op-rod of the M14.
    - **Snipers:** the L96 thumbhole stock, the WA2000 open frame, and the Barrett's lightening cuts and carry handle.
    - **Shotguns:** the AA-12 carry handle, the KSG twin magazine tubes, the SPAS-12 perforated heat shield, and the M1887's lever and exposed hammer.
  - **Pistols** have a separate slide and frame:
    - Bevelled or rounded slide noses and cocking serrations, with an ejection port and extractor.
    - Accessory rails, round, square or hooked trigger guards, beavertails, and grip panels with screws.
    - Slide-stop, safety and magazine-release controls, spur or ring hammers, and three-dot sights.
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
- **Custom operator** (OPERATOR on the main menu): choose your soldier's skin tone, face (stubble, mustache, beard or scarf mask), hair, headgear (helmet, helmet with net, helmet and goggles, field cap, beret, boonie hat, or bare head), uniform (standard, woodland camo, desert, winter whites, night ops) and gear (webbing, chest rig or light). A turning 3D preview shows the result, and everyone in the match sees your operator. The team armband and name color still show your side.
- **Starter classes:** eight ready-made classes, each a full setup: Assault, Run & Gun, Sniper, Support, Breacher, Stealth, WWII Rifleman and WWII Commando. Pick one, then change anything you like.
- **Equipment**:
  - **Lethal** (G):
    - **Frag Grenade:** bounces, then explodes.
    - **Semtex:** sticks to walls, the ground and enemies.
    - **Molotov:** leaves a pool of fire for 6 seconds.
    - **Throwing Knife:** a silent one-hit kill.
  - **Tactical** (F):
    - **Flashbang:** whites out the screen of anyone looking at it.
    - **Stun Grenade:** slow, shaky aim and poor accuracy.
    - **Smoke Grenade:** a 12-second smoke screen that also blocks bots' vision.
- **Perks:** one from each of three slots.
  - **Perk 1:**
    - **Scavenger:** fallen enemies drop ammo packs that refill your ammo and a lethal.
    - **Lightweight:** move faster.
    - **Ghost:** hidden from enemy recon planes.
    - **Flak Jacket:** less explosive and fire damage.
  - **Perk 2:**
    - **Sleight of Hand:** faster reloads.
    - **Hardline:** cheaper scorestreaks.
    - **Quickdraw:** faster aiming down sights.
    - **Danger Close:** stronger explosives.
  - **Perk 3:**
    - **Steady Aim:** better hip-fire.
    - **Tactical Mask:** resists flash and stun.
    - **Dead Silence:** your footsteps are silent; everyone else's footsteps can be heard.
    - **Cold-Blooded:** no name tag for enemies, and bots are slower to spot you.
- **Scorestreaks**:
  - **Earning points:** kills (+100), headshots (+25), assists (+50), and objectives: capturing or neutralizing Domination flags, taking, capturing or returning CTF flags, and holding the HQ. Points reset when you die.
  - **Choosing:** pick 3 in your loadout. Keys 5, 6 and 7 use them in cost order.
  - **Cycling:** once you earn all three, the cycle restarts (extra points carry over), so you can earn them all again without dying.
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
| Lethal / Tactical / Melee | G / F / V | **G** / **TAC** / **⚔** |
| Rifle grenade | B | **RG** |
| Scorestreaks | 5 / 6 / 7 | tap the button that appears |
| Scores / Loadout | Tab / L | ☰ / ⚙ |

### Controller

Xbox, PlayStation and other standard controllers work in the browser and in the Android app, over USB or Bluetooth. Press any button to switch to the controller.

| Action | Button (default layout) |
|---|---|
| Move / look | Left stick / right stick |
| Fire / aim down sights | RT / LT |
| Jump / crouch (slide while sprinting, hold for prone) | A / B |
| Sprint | L3 (or turn on auto-sprint) |
| Reload / switch weapon / melee | X / Y / R3 |
| Lethal / tactical | RB / LB |
| Scorestreaks / rifle grenade | D-pad up, left, right / D-pad down |
| Scoreboard / pause | View (Back) / Menu (Start) |

All menus work with the controller: the D-pad or left stick moves, A selects, B goes back, LB / RB change settings tabs, and the right stick scrolls.

**Accessibility options** (Settings → Controller):
- Look sensitivity and stick deadzone.
- Three button layouts:
  - Default.
  - Tactical: crouch on R3, melee on B.
  - Flipped: fire and aim on the bumpers.
- Hold or toggle aiming.
- Aim assist (on or off).
- Invert look, swapped sticks for left-handed players, and auto-sprint.
- Vibration on or off.

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

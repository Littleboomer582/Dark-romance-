# Frontline 1945

An online **team-vs-team** (Allies vs Axis) **first-person** 3D WWII shooter built with Three.js. It runs in any **computer browser** and installs on **Android as an app** (Progressive Web App: home-screen icon, fullscreen, landscape).

## Features

- **Online team deathmatch**: first team to 50 kills, or the leading team after 10 minutes. Up to 16 players per room.
- **Rooms**: type the same room code to play with friends. The default room is `PUBLIC`.
- **Bots** fill empty slots, so you can play alone or with a few friends. You pick 0–6 bots per team when you create a room, and a bot leaves when a real player joins.
- **WWII-era weapons**:
  - SMG: Thompson, MP40, PPSh-41, Type 100
  - Assault rifle: StG 44, BAR
  - Rifle: M1 Garand, Gewehr 43, SVT-40, M1A1 Carbine
  - Bolt-action: Kar98k, Springfield, Mosin-Nagant, Arisaka
  - Shotgun: Trench Gun, Double-Barreled
  - Machine gun: MG42, DP-28, Type 99
  - Pistol: M1911, P38, TT-33, Nambu, .357
- **14 attachments**, up to **3 per primary** (one per slot) plus **1 for your sidearm**. They are all modelled on the 3D gun:
  - Optic: **Telescopic Scope** (4x zoom with a scope overlay) or **Aperture Sight**
  - Muzzle: **Suppressor** (stays off the enemy radar), **Flash Hider** (less recoil, no flash) or **Rifle Grenade** (3 explosive launched grenades)
  - Underbarrel: **Foregrip** or **Bipod** (deadly accurate while still or crouched)
  - Magazine: **Extended Mag**, **Drum Mag** or **Dual Mags** (faster reloads)
  - Ammo: **FMJ Rounds** (shoot through crates and sandbags) or **Rapid Fire**
  - Also: **Bayonet** (one-hit lunge) and **Sling** (faster movement and faster aiming)
- **Real 3D ballistics**: headshots (x1.5 damage), crouching behind sandbags and crates, shooting over low cover, recoil, and grenades that arc and bounce.
- Frag grenades, knife and bayonet melee, aiming down sights, sprinting, crouching, health that regenerates, a rotating minimap with radar, damage-direction indicators, a death cam, a killfeed and a scoreboard.
- The server decides all hits (authoritative server). Your own movement is predicted on your device so it feels responsive.

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
| Sprint / Crouch | Shift / C or Ctrl | stick / **↧** |
| Reload / Swap | R / Q or mouse wheel | **R** / **⇆** |
| Grenade / Melee | G / V | **G** / **⚔** |
| Rifle grenade | B | **RG** |
| Scores / Loadout | Tab / L | ☰ / ⚙ |

Look sensitivity is set on the main menu.

## Project layout

- `server.js`: HTTP and WebSocket server (thin wrapper around `sim.js`)
- `public/sim.js`: game simulation: rooms, hit detection, grenades, bot AI (A* pathfinding). Runs on the server and in the browser for offline play
- `scripts/build-standalone.js`: builds the single-file `frontline-1945.html`
- `public/shared.js`: weapon and attachment stats, map, and collision code shared by the server and the client
- `public/game.js`: first-person Three.js client: world, soldiers, procedural gun and attachment models, viewmodel, input, prediction, audio, loadout builder
- `public/vendor/three.module.min.js`: Three.js r170, bundled locally so the Android app needs no CDN
- `public/index.html`, `style.css`: menus and HUD
- `public/manifest.webmanifest`, `sw.js`, `icons/`: installable PWA

Weapons are real historical firearms. The game, map and art are original.

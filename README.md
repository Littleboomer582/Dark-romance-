# Frontline 1945

An online **team-vs-team** (Allies vs Axis) top-down WWII shooter. It runs in any **computer browser** and installs on **Android as an app** (Progressive Web App: home-screen icon, fullscreen, landscape).

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
- **Attachments** (up to 2 per gun, depending on the weapon):
  - Telescopic Scope: zooms out and is very accurate
  - Aperture Sight
  - Foregrip
  - Extended Mag
  - Dual Mags: faster reloads
  - Suppressor: your shots don't show you on the enemy radar
  - Bayonet: melee lunge that kills in one hit
  - Bipod: very accurate when you aim while standing still
- Frag grenades, knife and bayonet melee, aiming down sights, sprinting, health that regenerates, a minimap with radar, a killfeed and a scoreboard.
- The server decides all hits (authoritative server). Your own movement is predicted on your device so it feels responsive.

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
| Move | WASD / arrows | Left thumb (virtual stick) |
| Aim | Mouse | Right thumb stick (light aim assist) |
| Fire | Left click | Push the aim stick to its edge, or hold **FIRE** |
| Aim down sights | Right click | **AIM** (toggle) |
| Sprint | Shift | **RUN** |
| Reload / Swap | R / Q or mouse wheel | **R** / **⇆** |
| Grenade / Melee | G / V | **G** / **⚔** |
| Scores / Loadout | Tab / Esc | ☰ / ⚙ |

## Project layout

- `server.js`: HTTP and WebSocket server, rooms, game simulation, hit detection, bot AI (A* pathfinding)
- `public/shared.js`: weapon and attachment stats, map, and collision code shared by the server and the client
- `public/game.js`: client rendering, input, prediction, audio, loadout builder
- `public/index.html`, `style.css`: menus and HUD
- `public/manifest.webmanifest`, `sw.js`, `icons/`: installable PWA

Weapons are real historical firearms. The game, map and art are original.

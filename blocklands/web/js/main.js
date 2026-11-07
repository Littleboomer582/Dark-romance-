'use strict';
// Game state, chunk streaming, block interaction, saving, main loop.
const DAY_LENGTH = 600; // seconds per full day

const Game = {
  state: 'menu', // menu | loading | play | paused | inventory | dead
  meta: null, creative: false,
  hotbar: [], selected: 0, inv: {},
  time: 0.05, spawn: [0, 60, 0],
  target: null, breakT: 0, breakTarget: null, breaking: false, nextAction: 0,
  lastSave: 0, fps: 0, frames: 0, fpsT: 0, lastStats: null,

  init() {
    Settings.load();
    UI.init();
    Renderer.init($('gl'));
    Input.init($('gl'));
    Input.setTouchMode('ontouchstart' in window || navigator.maxTouchPoints > 0);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.meta) { this.save(); if (this.state === 'play') this.pause(); }
    });
    window.addEventListener('pagehide', () => this.meta && this.save());
    UI.show('menu');
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  get creativeHotbar() { return [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.GLASS, B.LAMP, B.BRICK]; },

  newWorld(name, seed, mode) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.meta = { id, name, seed, mode };
    Noise.setSeed(seed);
    World.reset();
    this.spawn = World.findSpawn();
    this.inv = {};
    this.hotbar = mode === 'creative' ? this.creativeHotbar : [0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.selected = 0;
    this.time = 0.05;
    Player.pos = this.spawn.slice(); Player.vel = [0, 0, 0]; Player.yaw = 0; Player.pitch = -0.1;
    Player.health = 20; Player.flying = false;
    this.setMode(mode, true);
    this.startLoading();
    this.save();
  },

  loadWorld(id) {
    const meta = Worlds.list().find((w) => w.id === id);
    const data = Worlds.load(id);
    if (!meta || !data) { UI.toast('World data missing'); return; }
    this.meta = { id, name: meta.name, seed: data.seed, mode: data.mode };
    Noise.setSeed(data.seed);
    World.reset();
    World.loadEdits(data.edits);
    this.spawn = data.spawn || World.findSpawn();
    this.inv = data.inv || {};
    this.hotbar = data.hotbar || this.creativeHotbar;
    this.selected = data.selected || 0;
    this.time = data.time != null ? data.time : 0.05;
    const p = data.player || {};
    Player.pos = p.pos || this.spawn.slice(); Player.vel = [0, 0, 0];
    Player.yaw = p.yaw || 0; Player.pitch = p.pitch || 0; Player.health = p.health || 20; Player.flying = !!p.flying;
    this.setMode(data.mode, true);
    this.startLoading();
  },

  save() {
    if (!this.meta) return;
    const data = {
      v: 1, seed: this.meta.seed, mode: this.meta.mode, time: this.time, spawn: this.spawn,
      inv: this.inv, hotbar: this.hotbar, selected: this.selected,
      player: { pos: Player.pos, yaw: Player.yaw, pitch: Player.pitch, health: Player.health, flying: Player.flying },
      edits: World.serializeEdits(),
    };
    if (!Worlds.save(this.meta, data)) UI.toast('Could not save: storage is full');
    this.lastSave = performance.now();
  },

  setMode(mode, silent) {
    this.meta.mode = mode;
    this.creative = mode === 'creative';
    document.body.classList.toggle('creative', this.creative);
    $('pMode').textContent = this.creative ? 'Switch to Survival' : 'Switch to Creative';
    if (!this.creative) Player.flying = false;
    if (this.creative && !this.hotbar.some((h) => h)) this.hotbar = this.creativeHotbar;
    if (!silent) UI.toast(this.creative ? 'Creative mode' : 'Survival mode');
    UI.renderHotbar();
  },

  startLoading() {
    this.state = 'loading';
    UI.show('loading');
    $('loadBar').style.width = '0%';
  },

  // ---- chunk streaming ----
  stream(budgetMs) {
    const t0 = performance.now();
    const R = Settings.data.renderDist;
    const pcx = Math.floor(Player.pos[0] / CS), pcz = Math.floor(Player.pos[2] / CS);
    // generate data out to R+1, nearest first
    const want = [];
    for (let dz = -R - 1; dz <= R + 1; dz++) for (let dx = -R - 1; dx <= R + 1; dx++) {
      if (dx * dx + dz * dz > (R + 1.5) * (R + 1.5)) continue;
      want.push([dx * dx + dz * dz, pcx + dx, pcz + dz]);
    }
    want.sort((a, b) => a[0] - b[0]);
    let genCount = 0, meshCount = 0;
    for (const [d2, cx, cz] of want) {
      if (performance.now() - t0 > budgetMs) break;
      if (!World.getChunk(cx, cz)) { World.generate(cx, cz); genCount++; }
    }
    for (const [d2, cx, cz] of want) {
      if (performance.now() - t0 > budgetMs) break;
      if (d2 > (R + 0.5) * (R + 0.5)) continue;
      const c = World.getChunk(cx, cz);
      if (!c || !c.dirty) continue;
      let ok = true;
      for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = -1; dx <= 1; dx++) if (!World.getChunk(cx + dx, cz + dz)) { ok = false; break; }
      if (!ok) continue;
      Renderer.upload(c, Mesher.build(c));
      c.dirty = false; meshCount++;
    }
    // unload far chunks
    for (const [k, c] of World.chunks) {
      const dx = c.cx - pcx, dz = c.cz - pcz;
      if (dx * dx + dz * dz > (R + 3) * (R + 3)) World.unload(k);
    }
    // loading progress: chunks around the player that are meshed
    let ready = 0, total = 0;
    for (const [d2, cx, cz] of want) {
      if (d2 > 4.5) continue;
      total++; const c = World.getChunk(cx, cz); if (c && !c.dirty) ready++;
    }
    return { ready, total, genCount, meshCount };
  },

  // ---- actions ----
  selectSlot(i) {
    this.selected = (i + 9) % 9;
    UI.renderHotbar();
    const id = this.hotbar[this.selected];
    if (id) UI.flashName(BLOCKS[id].name);
  },
  scrollHotbar(d) { this.selectSlot(this.selected + d); },
  assignSlot(id) {
    const existing = this.hotbar.indexOf(id);
    if (existing >= 0 && existing !== this.selected) this.hotbar[existing] = this.hotbar[this.selected];
    this.hotbar[this.selected] = id;
    UI.renderHotbar();
  },
  pickBlock() {
    if (!this.target) return;
    const id = this.target.id;
    if (!this.creative && !(this.inv[id] > 0)) return;
    const at = this.hotbar.indexOf(id);
    if (at >= 0) this.selectSlot(at); else { this.assignSlot(id); UI.flashName(BLOCKS[id].name); }
  },

  addItem(id, n) {
    if (!id || this.creative) return;
    this.inv[id] = (this.inv[id] || 0) + n;
    if (!this.hotbar.includes(id)) {
      const empty = this.hotbar.findIndex((h) => !h || !(this.inv[h] > 0));
      if (empty >= 0) this.hotbar[empty] = id;
    }
    UI.renderHotbar();
  },

  craft(r) {
    if (!r.inp.every(([id, n]) => (this.inv[id] || 0) >= n)) return;
    for (const [id, n] of r.inp) this.inv[id] -= n;
    for (const [id] of r.inp) if (this.inv[id] <= 0) delete this.inv[id];
    this.addItem(r.out, r.n);
    Sound.play('place', r.out);
    UI.toast(`Crafted ${r.n} ${BLOCKS[r.out].name}`);
  },

  startBreak() {
    this.breaking = true; this.breakT = 0; this.breakTarget = null;
    if (this.creative) { this.breakNow(); this.nextAction = performance.now() + 300; }
  },
  stopBreak() { this.breaking = false; this.breakT = 0; this.breakTarget = null; $('breakbar').style.display = 'none'; },

  breakNow() {
    const t = this.target;
    if (!t) return;
    const b = BLOCKS[t.id];
    if (b.hardness < 0 && !this.creative) return;
    const [x, y, z] = t.pos;
    World.setBlock(x, y, z, B.AIR);
    Sound.play('break', t.id);
    if (!this.creative && b.drop) this.addItem(b.drop, 1);
    // water flows into the gap from the sides or above
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
      if (World.getBlock(x + dx, y + dy, z + dz) === B.WATER) { World.setBlock(x, y, z, B.WATER); break; }
    }
    this.target = Player.raycast(this.reach());
  },

  place() {
    const t = this.target;
    if (!t) return;
    const id = this.hotbar[this.selected];
    if (!id) return;
    if (!this.creative && !(this.inv[id] > 0)) { UI.flashName('None left'); return; }
    let [x, y, z] = t.pos;
    // replace plants in place, otherwise put the block against the face we're looking at
    if (BLOCKS[t.id].kind !== 'plant') { x += t.normal[0]; y += t.normal[1]; z += t.normal[2]; }
    if (y < 0 || y >= WH) return;
    const cur = World.getBlock(x, y, z);
    if (cur !== B.AIR && cur !== B.WATER && BLOCKS[cur].kind !== 'plant') return;
    if (SOLID[id] && Player.intersectsBlock(x, y, z)) return;
    if (BLOCKS[id].kind === 'plant') {
      const below = World.getBlock(x, y - 1, z);
      if (below !== B.GRASS && below !== B.DIRT) return;
      if (cur === B.WATER) return;
    }
    if (id === B.CACTUS) { const below = World.getBlock(x, y - 1, z); if (below !== B.SAND && below !== B.CACTUS) { UI.flashName('Cactus needs sand'); return; } }
    World.setBlock(x, y, z, id);
    Sound.play('place', id);
    if (!this.creative) {
      this.inv[id]--;
      if (this.inv[id] <= 0) delete this.inv[id];
      UI.renderHotbar();
    }
    this.nextAction = performance.now() + 250;
  },

  reach() { return this.creative ? 8 : 5.5; },

  toggleFly() {
    if (!this.creative) return;
    Player.flying = !Player.flying;
    if (Player.flying) Player.vel[1] = 2;
    Input.resetSneak();
    $('btnFly').classList.toggle('on', Player.flying);
    UI.toast(Player.flying ? 'Flying' : 'Walking');
  },

  openInventory() {
    if (this.state !== 'play') return;
    this.state = 'inventory';
    Input.release();
    this.stopBreak();
    UI.renderInventory();
    UI.show('inventory');
  },
  closeInventory() {
    this.state = 'play'; UI.show(null);
    if (!Input.isTouch) Input.requestLock();
  },

  pause() {
    if (this.state !== 'play') return;
    this.state = 'paused';
    Input.release(); this.stopBreak();
    UI.show('pause');
    this.save();
  },
  resume() {
    this.state = 'play'; UI.show(null);
    if (!Input.isTouch) Input.requestLock();
  },
  quit() {
    this.save();
    Input.release();
    World.reset();
    this.meta = null;
    this.state = 'menu';
    UI.show('menu');
  },
  die() {
    this.state = 'dead';
    Input.release(); this.stopBreak();
    UI.show('dead');
  },
  respawn() {
    Player.pos = this.spawn.slice(); Player.vel = [0, 0, 0]; Player.health = 20; Player.fallStart = null;
    this.state = 'loading'; UI.show('loading');
  },

  // ---- per frame ----
  update(dt) {
    const [dx, dy] = Input.update();
    Player.yaw -= dx; Player.pitch = Math.max(-1.55, Math.min(1.55, Player.pitch - dy));
    Player.update(dt, Input.state, this.creative);
    this.time = (this.time + dt / DAY_LENGTH) % 1;
    this.target = Player.raycast(this.reach());

    const now = performance.now();
    // digging
    const bar = $('breakbar');
    if (this.breaking && this.target) {
      if (this.creative) {
        if (now >= this.nextAction) { this.breakNow(); this.nextAction = now + 250; }
      } else {
        const key = this.target.pos.join(',');
        if (key !== this.breakTarget) { this.breakTarget = key; this.breakT = 0; }
        const h = BLOCKS[this.target.id].hardness;
        if (h >= 0) {
          this.breakT += dt;
          const prev = Math.floor((this.breakT - dt) / 0.25), cur = Math.floor(this.breakT / 0.25);
          if (cur > prev) Sound.play('hit', this.target.id);
          bar.style.display = h > 0.05 ? 'block' : 'none';
          bar.firstChild.style.width = Math.min(100, (this.breakT / Math.max(h, 0.001)) * 100) + '%';
          if (this.breakT >= h) { this.breakNow(); this.breakT = 0; this.breakTarget = null; bar.style.display = 'none'; }
        }
      }
    } else bar.style.display = 'none';
    // held right mouse repeats placing
    if (Input.state.placeHeld && now >= this.nextAction) this.place();

    if (now - this.lastSave > 30000) this.save();
  },

  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    try {
      if (this.state === 'loading') {
        const s = this.stream(30);
        $('loadBar').style.width = (s.total ? (s.ready / s.total) * 100 : 0) + '%';
        if (s.total && s.ready === s.total) {
          // make sure the player isn't stuck inside terrain
          let guard = 0;
          while (Player.collides(Player.pos[0], Player.pos[1], Player.pos[2]) && guard++ < WH) Player.pos[1] += 1;
          this.state = 'play'; UI.show(null); UI.renderHotbar();
          if (!Input.isTouch) Input.requestLock();
        }
      } else if (this.meta) {
        if (this.state === 'play') this.update(dt);
        this.stream(this.state === 'play' ? 6 : 12);
      }
      if (this.meta && this.state !== 'loading') {
        this.lastStats = Renderer.frame({
          eye: Player.eye(), yaw: Player.yaw, pitch: Player.pitch, timeOfDay: this.time,
          underwater: Player.headInWater, target: this.target && this.target.pos, renderDist: Settings.data.renderDist,
        });
        this.hud(dt);
      } else if (!this.meta) this.menuBackdrop(t);
    } catch (e) {
      console.error(e);
      $('errMsg').textContent = e.message;
      UI.show('error');
      this.state = 'error';
    }
  },

  hud(dt) {
    UI.renderHearts(Player.health);
    $('hurt').style.opacity = Player.hurtFlash > 0 ? Player.hurtFlash / 0.35 : 0;
    $('waterTint').style.display = Player.headInWater ? 'block' : 'none';
    const mins = Math.floor(((this.time + 0.25) % 1) * 24 * 60);
    $('clock').textContent = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }
    if (Settings.data.showFps) {
      const p = Player.pos, s = this.lastStats || {};
      $('debug').textContent = `Blocklands  ${this.fps} fps\nXYZ ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${p[2].toFixed(1)}\n` +
        `chunks ${s.chunks}/${World.chunks.size}  tris ${Math.round((s.tris || 0) / 1000)}k\nseed ${this.meta.seed}`;
    }
  },

  // slowly orbiting world behind the title screen
  menuBackdrop(t) {
    if (!this._bgReady) {
      Noise.setSeed(20261107);
      World.reset();
      this._bgReady = true;
      const s = World.findSpawn();
      this._bg = { x: s[0], z: s[2], y: Math.max(s[1] + 14, SEA + 18) };
    }
    const bg = this._bg;
    Player.pos = [bg.x, bg.y, bg.z];
    const saveRD = Settings.data.renderDist;
    Settings.data.renderDist = Math.min(saveRD, 4);
    this.stream(8);
    Renderer.frame({ eye: [bg.x, bg.y, bg.z], yaw: t / 20000, pitch: -0.25, timeOfDay: 0.12, underwater: false, target: null, renderDist: Settings.data.renderDist });
    Settings.data.renderDist = saveRD;
  },
};

// leaving the menu backdrop: drop its chunks when a real world starts
const _reset = World.reset.bind(World);
World.reset = function () { Game._bgReady = false; _reset(); };

// Android app hooks (called from MainActivity)
window.onAndroidPause = () => { if (Game.meta) Game.save(); if (Game.state === 'play') Game.pause(); };
window.onAndroidBack = () => {
  const open = (id) => !$(id).hidden;
  if (Game.state === 'play') { Game.pause(); return true; }
  if (Game.state === 'inventory') { Game.closeInventory(); return true; }
  if (open('settings')) { $('sBack').click(); return true; }
  if (open('help')) { $('hBack').click(); return true; }
  if (Game.state === 'paused') { Game.resume(); return true; }
  if (open('newworld')) { UI.openWorlds(); return true; }
  if (open('worlds')) { UI.show('menu'); return true; }
  if (window.AndroidApp) window.AndroidApp.exit(); // title screen: leave the app
  return false;
};

window.addEventListener('error', (e) => {
  const el = document.getElementById('errMsg');
  if (el && Game.state !== 'play') { el.textContent = e.message; }
});

try { Game.init(); } catch (e) {
  document.getElementById('errMsg').textContent = e.message;
  document.getElementById('error').hidden = false;
}

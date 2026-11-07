'use strict';
// Settings, saved worlds, menus, hotbar and inventory screens.
const $ = (id) => document.getElementById(id);

const Store = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

const Settings = {
  data: null,
  defaults() {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    return { renderDist: touch ? 4 : 6, sens: 1, fov: 75, quality: 'high', autoJump: touch, sound: true, showFps: false, touchButtons: false };
  },
  load() { this.data = Object.assign(this.defaults(), Store.get('blocklands.settings', {})); this.apply(); },
  save() { Store.set('blocklands.settings', this.data); this.apply(); },
  toggle(k) { this.data[k] = !this.data[k]; this.save(); },
  apply() {
    document.body.classList.toggle('touchbuttons', !!this.data.touchButtons);
    $('debug').style.display = this.data.showFps ? 'block' : 'none';
  },
};

const Worlds = {
  list() { return Store.get('blocklands.worlds', []); },
  saveList(l) { Store.set('blocklands.worlds', l); },
  load(id) { return Store.get('blocklands.world.' + id, null); },
  save(meta, data) {
    const ok = Store.set('blocklands.world.' + meta.id, data);
    const l = this.list().filter((w) => w.id !== meta.id);
    l.unshift(Object.assign({}, meta, { lastPlayed: Date.now() }));
    this.saveList(l);
    return ok;
  },
  remove(id) { Store.del('blocklands.world.' + id); this.saveList(this.list().filter((w) => w.id !== id)); },
};

const UI = {
  screens: ['menu', 'worlds', 'newworld', 'pause', 'settings', 'help', 'inventory', 'dead', 'loading', 'error'],
  settingsReturn: 'menu',
  newMode: 'survival',

  show(name) {
    for (const s of this.screens) $(s).hidden = s !== name;
    $('hud').hidden = !(name === null || name === 'inventory' || name === 'pause' || name === 'dead');
  },

  init() {
    const click = (id, fn) => $(id).addEventListener('click', () => { Sound.unlock(); Sound.play('click'); fn(); });
    click('mPlay', () => this.openWorlds());
    click('mSettings', () => this.openSettings('menu'));
    click('mHelp', () => this.show('help'));
    click('hBack', () => this.show(Game.state === 'paused' ? 'pause' : 'menu'));
    click('wBack', () => this.show('menu'));
    click('wNew', () => this.openNewWorld());
    click('nwBack', () => this.openWorlds());
    click('nwCreate', () => {
      const name = $('nwName').value.trim() || 'New World';
      const seedTxt = $('nwSeed').value.trim();
      let seed;
      if (!seedTxt) seed = (Math.random() * 2147483647) | 0;
      else if (/^-?\d+$/.test(seedTxt)) seed = parseInt(seedTxt, 10) | 0;
      else { seed = 0; for (const ch of seedTxt) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0; }
      Game.newWorld(name, seed, this.newMode);
    });
    for (const b of $('nwMode').children) b.addEventListener('click', () => {
      this.newMode = b.dataset.mode;
      for (const o of $('nwMode').children) o.classList.toggle('on', o === b);
      $('nwModeHint').textContent = this.newMode === 'creative'
        ? 'Every block, unlimited. Fly, build fast, no damage.'
        : 'Mine blocks to collect them, craft, and watch your hearts.';
    });
    click('pResume', () => Game.resume());
    click('pSettings', () => this.openSettings('pause'));
    click('pMode', () => { Game.setMode(Game.creative ? 'survival' : 'creative'); Game.resume(); });
    click('pQuit', () => Game.quit());
    click('dRespawn', () => Game.respawn());
    click('dQuit', () => { Game.respawn(); Game.quit(); });
    click('invClose', () => Game.closeInventory());
    click('sBack', () => { Settings.save(); this.show(this.settingsReturn); });

    const rng = (id, key, fmt) => {
      const el = $(id), out = $(id + 'V') || $(id + 'v');
      el.addEventListener('input', () => { Settings.data[key] = +el.value; out.textContent = fmt(+el.value); Settings.save(); });
    };
    rng('sRD', 'renderDist', (v) => v);
    rng('sSens', 'sens', (v) => v.toFixed(1));
    rng('sFov', 'fov', (v) => v);
    for (const b of $('sQuality').children) b.addEventListener('click', () => {
      Settings.data.quality = b.dataset.q; this.syncSettings(); Settings.save();
      for (const c of World.chunks.values()) c.dirty = true;
    });
    const chk = (id, key) => $(id).addEventListener('change', () => { Settings.data[key] = $(id).checked; Settings.save(); });
    chk('sAuto', 'autoJump'); chk('sSound', 'sound'); chk('sFps', 'showFps'); chk('sTouch', 'touchButtons');

    // hotbar
    const hb = $('hotbar');
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('button');
      s.className = 'slot';
      s.innerHTML = '<img alt=""><span class="count"></span>';
      const pick = (e) => { e.preventDefault(); e.stopPropagation(); Game.selectSlot(i); };
      s.addEventListener('touchstart', pick, { passive: false });
      s.addEventListener('mousedown', pick);
      hb.appendChild(s);
    }
    // hearts
    for (let i = 0; i < 10; i++) { const h = document.createElement('canvas'); h.width = h.height = 9; h.className = 'heart'; $('hearts').appendChild(h); }
  },

  openWorlds() {
    const list = Worlds.list();
    const el = $('worldList');
    el.innerHTML = '';
    if (!list.length) el.innerHTML = '<div class="empty">No worlds yet. Create one!</div>';
    for (const w of list) {
      const row = document.createElement('div');
      row.className = 'world';
      const d = new Date(w.lastPlayed || Date.now());
      row.innerHTML = `<div class="info"><div class="name"></div><div class="meta">${w.mode === 'creative' ? 'Creative' : 'Survival'} &middot; ${d.toLocaleDateString()}</div></div>
        <button class="play">Play</button><button class="del secondary">&#10005;</button>`;
      row.querySelector('.name').textContent = w.name;
      row.querySelector('.play').addEventListener('click', () => { Sound.unlock(); Game.loadWorld(w.id); });
      const del = row.querySelector('.del');
      del.addEventListener('click', () => {
        if (del.dataset.confirm) { Worlds.remove(w.id); this.openWorlds(); }
        else { del.dataset.confirm = 1; del.textContent = 'Delete?'; setTimeout(() => { del.textContent = '✕'; delete del.dataset.confirm; }, 2500); }
      });
      el.appendChild(row);
    }
    this.show('worlds');
  },

  openNewWorld() {
    $('nwName').value = 'New World ' + (Worlds.list().length + 1);
    $('nwSeed').value = '';
    this.show('newworld');
  },

  openSettings(ret) { this.settingsReturn = ret; this.syncSettings(); this.show('settings'); },
  syncSettings() {
    const d = Settings.data;
    $('sRD').value = d.renderDist; $('sRDv').textContent = d.renderDist;
    $('sSens').value = d.sens; $('sSensV').textContent = (+d.sens).toFixed(1);
    $('sFov').value = d.fov; $('sFovV').textContent = d.fov;
    for (const b of $('sQuality').children) b.classList.toggle('on', b.dataset.q === d.quality);
    $('sAuto').checked = d.autoJump; $('sSound').checked = d.sound; $('sFps').checked = d.showFps; $('sTouch').checked = d.touchButtons;
  },

  renderHotbar() {
    const slots = $('hotbar').children;
    for (let i = 0; i < 9; i++) {
      const id = Game.hotbar[i];
      const s = slots[i];
      s.classList.toggle('sel', i === Game.selected);
      const img = s.firstChild, cnt = s.lastChild;
      const have = id && (Game.creative || (Game.inv[id] || 0) > 0);
      if (id && have) { if (img.dataset.id != id) { img.src = Atlas.icon(id); img.dataset.id = id; } img.style.visibility = 'visible'; img.style.opacity = 1; }
      else if (id) { if (img.dataset.id != id) { img.src = Atlas.icon(id); img.dataset.id = id; } img.style.visibility = 'visible'; img.style.opacity = 0.25; }
      else img.style.visibility = 'hidden';
      cnt.textContent = !Game.creative && id && Game.inv[id] ? Game.inv[id] : '';
    }
  },

  flashName(text) {
    const el = $('blockname');
    el.textContent = text; el.style.opacity = 1;
    clearTimeout(this._nameT); this._nameT = setTimeout(() => { el.style.opacity = 0; }, 1500);
  },
  toast(text) {
    const el = $('toast');
    el.textContent = text; el.style.opacity = 1;
    clearTimeout(this._toastT); this._toastT = setTimeout(() => { el.style.opacity = 0; }, 2000);
  },

  renderHearts(hp) {
    const hearts = $('hearts').children;
    $('hearts').style.display = Game.creative ? 'none' : 'flex';
    const shape = ['011000110', '111101111', '111111111', '111111111', '011111110', '001111100', '000111000', '000010000'];
    for (let i = 0; i < 10; i++) {
      const v = Math.max(0, Math.min(2, hp - i * 2));
      const c = hearts[i]; if (c.dataset.v == v) continue;
      c.dataset.v = v;
      const g = c.getContext('2d'); g.clearRect(0, 0, 9, 9);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 9; x++) {
        if (shape[y][x] !== '1') continue;
        const edge = !(shape[y - 1] && shape[y - 1][x] === '1') || !(shape[y + 1] && shape[y + 1][x] === '1') || shape[y][x - 1] !== '1' || shape[y][x + 1] !== '1';
        const full = v === 2 || (v === 1 && x < 5);
        g.fillStyle = edge ? '#1a0505' : full ? (y < 3 && x < 4 ? '#ff8a8a' : '#d81c1c') : '#3a1010';
        g.fillRect(x, y + 1, 1, 1);
      }
    }
  },

  renderInventory() {
    const grid = $('invGrid'); grid.innerHTML = '';
    $('invTitle').textContent = Game.creative ? 'All Blocks' : 'Inventory';
    const ids = Game.creative ? PLACEABLE : PLACEABLE.filter((id) => Game.inv[id] > 0);
    if (!ids.length) grid.innerHTML = '<div class="empty" style="grid-column:1/-1">Empty. Dig some blocks!</div>';
    for (const id of ids) {
      const s = document.createElement('button');
      s.className = 'slot';
      s.title = BLOCKS[id].name;
      s.innerHTML = `<img alt="" src="${Atlas.icon(id)}"><span class="count">${Game.creative ? '' : Game.inv[id]}</span>`;
      s.addEventListener('click', () => { Game.assignSlot(id); Sound.play('click'); this.renderInventory(); });
      grid.appendChild(s);
    }
    $('craftWrap').hidden = Game.creative;
    if (Game.creative) return;
    const list = $('craftList'); list.innerHTML = '';
    for (const r of RECIPES) {
      const row = document.createElement('div'); row.className = 'recipe';
      const can = r.inp.every(([id, n]) => (Game.inv[id] || 0) >= n);
      row.innerHTML = r.inp.map(([id, n]) => `<span class="item ${(Game.inv[id] || 0) >= n ? '' : 'missing'}"><img src="${Atlas.icon(id)}" alt="">${n}&times; ${BLOCKS[id].name}</span>`).join(' + ') +
        `<span class="arrow">&rarr;</span><span class="item"><img src="${Atlas.icon(r.out)}" alt="">${r.n}&times; ${BLOCKS[r.out].name}</span><button ${can ? '' : 'disabled'}>Craft</button>`;
      row.querySelector('button').addEventListener('click', () => { Game.craft(r); this.renderInventory(); });
      list.appendChild(row);
    }
  },
};

'use strict';
// Tiny synthesized sound effects (no audio files).
const Sound = (() => {
  let ac = null, noiseBuf = null, master = null;
  function unlock() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const MAT = {
    stone: { f: 900, q: 1.2, len: 0.12 }, wood: { f: 420, q: 3, len: 0.14 }, grass: { f: 2200, q: 0.6, len: 0.1 },
    sand: { f: 3200, q: 0.5, len: 0.12 }, glass: { f: 3800, q: 6, len: 0.18 },
  };
  function burst(m, vol, pitch) {
    const t = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = pitch;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = m.f * pitch; f.Q.value = m.q;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + m.len);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 0.3); src.stop(t + m.len + 0.02);
  }
  function play(kind, blockId) {
    if (!ac || !Settings.data.sound) return;
    const mat = MAT[(BLOCKS[blockId] && BLOCKS[blockId].sound) || 'stone'] || MAT.stone;
    if (kind === 'break') { burst(mat, 0.9, 0.8 + Math.random() * 0.2); burst(mat, 0.5, 0.6); }
    else if (kind === 'place') burst(mat, 0.7, 1.0 + Math.random() * 0.15);
    else if (kind === 'hit') burst(mat, 0.25, 1.2 + Math.random() * 0.2);
    else if (kind === 'step') burst(mat, 0.12, 0.9 + Math.random() * 0.3);
    else if (kind === 'hurt') {
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.2);
      g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25);
    } else if (kind === 'click') {
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 660; g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.08);
    }
  }
  return { unlock, play };
})();

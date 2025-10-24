// app.js v2 — pantalla negra + tono personalizado + persistencia
let wakeLock = null;
let audioCtx = null;
let alarmTimer = null;
let preTimer = null;
let countdownTimer = null;
let stream = null;
let videoTrack = null;

const el = (id)=>document.getElementById(id);
const enableBtn = el('enableBtn');
const fullscreenBtn = el('fullscreenBtn');
const statusEl = el('status');
const alarmTimeEl = el('alarmTime');
const durationEl = el('duration');
const prewakeEl = el('prewake');
const blackoutEl = el('blackout');
const toneFileEl = el('toneFile');
const previewToneBtn = el('previewTone');
const saveBtn = el('saveBtn');
const scheduleBtn = el('scheduleBtn');
const cancelBtn = el('cancelBtn');
const countdownEl = el('countdown');
const testLightBtn = el('testLightBtn');
const testScreenBtn = el('testScreenBtn');
const blackScreen = el('blackScreen');
const sunScreen = el('sunScreen');

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});

// Restaurar ajustes
(function restore() {
  const s = JSON.parse(localStorage.getItem('sunrise_v2')||'{}');
  if (s.alarmTime) alarmTimeEl.value = s.alarmTime;
  if (s.duration) durationEl.value = s.duration;
  if (s.prewake!==undefined) prewakeEl.value = s.prewake;
  if (s.blackout!==undefined) blackoutEl.checked = s.blackout;
})();

saveBtn.addEventListener('click', ()=>{
  localStorage.setItem('sunrise_v2', JSON.stringify({
    alarmTime: alarmTimeEl.value,
    duration: parseInt(durationEl.value||'10',10),
    prewake: parseInt(prewakeEl.value||'2',10),
    blackout: blackoutEl.checked
  }));
  alert('Guardado ✅');
});

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => console.log('WakeLock liberado'));
    }
  } catch (e) {
    console.log('No WakeLock:', e);
  }
}

async function prepareAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Desbloqueo mínimo por interacción
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.connect(g).connect(audioCtx.destination); o.frequency.value=0; g.gain.value=0; o.start(); setTimeout(()=>o.stop(), 10);
  } catch(e){ console.log('Audio init error', e); }
}

async function prepareTorch() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
    videoTrack = stream.getVideoTracks()[0];
    const caps = videoTrack.getCapabilities?.() || {};
    return !!caps.torch;
  } catch (e) { console.log('getUserMedia error', e); return false; }
}

async function setTorch(on) {
  if (!videoTrack) return false;
  try {
    const caps = videoTrack.getCapabilities?.() || {};
    if (!caps.torch) return false;
    await videoTrack.applyConstraints({ advanced: [{ torch: on }] });
    return true;
  } catch (e) { console.log('torch error', e); return false; }
}

// Audio de usuario
let userAudioUrl = null;
let userAudio = null;
toneFileEl.addEventListener('change', ()=>{
  if (toneFileEl.files && toneFileEl.files[0]) {
    if (userAudio) { try { userAudio.pause(); } catch(_){} }
    userAudioUrl = URL.createObjectURL(toneFileEl.files[0]);
    userAudio = new Audio(userAudioUrl);
    userAudio.loop = false; userAudio.volume = 0.0;
  }
});

previewToneBtn.addEventListener('click', ()=>{
  if (!userAudio) return alert('Selecciona un archivo de audio primero.');
  userAudio.currentTime = 0; userAudio.volume = 1.0; userAudio.play().catch(()=>{});
});

enableBtn.addEventListener('click', async ()=>{
  await requestWakeLock();
  await prepareAudio();
  const torch = await prepareTorch();
  statusEl.textContent = torch ? 'Linterna compatible ✅' : 'Modo pantalla/sonido ✅ (torch no disponible)';
});

fullscreenBtn.addEventListener('click', async ()=>{
  try { await document.documentElement.requestFullscreen(); } catch {}
});

function msUntil(timeStr) {
  const [hh, mm] = timeStr.split(':').map(x=>parseInt(x,10));
  const now = new Date();
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  return target - now;
}

function startCountdown(ms) {
  clearInterval(countdownTimer);
  function render() {
    ms -= 1000; if (ms<0) ms=0;
    const s = Math.floor(ms/1000);
    const h = String(Math.floor(s/3600)).padStart(2,'0');
    const m = String(Math.floor((s%3600)/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    countdownEl.textContent = `Faltan ${h}:${m}:${ss}`;
    if (s<=0) clearInterval(countdownTimer);
  }
  render();
  countdownTimer = setInterval(render, 1000);
}

function sunriseScreen(totalMinutes) {
  sunScreen.classList.remove('hidden');
  sunScreen.style.opacity = 0;
  const totalMs = totalMinutes*60*1000;
  const start = performance.now();
  function step(now){
    const p = Math.min(1, (now-start)/totalMs);
    sunScreen.style.opacity = String(p);
    if (p<1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function startUserToneRamp() {
  if (!userAudio) return;
  userAudio.currentTime = 0;
  userAudio.volume = 0.0;
  userAudio.play().catch(()=>{});
  let v = 0.0;
  const step = setInterval(()=>{
    v += 0.05;
    if (v >= 1.0) { v = 1.0; clearInterval(step); }
    try { userAudio.volume = v; } catch {}
  }, 2000);
}

scheduleBtn.addEventListener('click', ()=>{
  const timeStr = alarmTimeEl.value;
  if (!timeStr) return alert('Selecciona una hora.');
  const durationMin = Math.max(1, parseInt(durationEl.value||'10',10));
  const preMin = Math.max(0, parseInt(prewakeEl.value||'2',10));
  const ms = msUntil(timeStr);
  if (ms <= 0) return alert('Hora inválida');

  clearTimeout(alarmTimer); clearTimeout(preTimer);
  startCountdown(ms);

  if (blackoutEl.checked) blackScreen.classList.remove('hidden');
  else blackScreen.classList.add('hidden');

  preTimer = setTimeout(()=>{
    blackScreen.classList.add('hidden');
  }, Math.max(0, ms - preMin*60*1000));

  alarmTimer = setTimeout(async ()=>{
    const lit = await setTorch(true);
    sunriseScreen(durationMin);
    startUserToneRamp();
    setTimeout(async ()=>{ await setTorch(false); }, durationMin*60*1000);
  }, ms);

  alert('Alarma programada. Mantén la app visible. Puedes activar pantalla completa y modo negro hasta el pre-amanecer.');
});

cancelBtn.addEventListener('click', ()=>{
  clearTimeout(alarmTimer); clearTimeout(preTimer); clearInterval(countdownTimer);
  countdownEl.textContent = '';
  blackScreen.classList.add('hidden'); sunScreen.classList.add('hidden'); sunScreen.style.opacity=0;
});

testLightBtn.addEventListener('click', async ()=>{
  const ok = await setTorch(true);
  setTimeout(async ()=>{ await setTorch(false); }, 5000);
});

testScreenBtn.addEventListener('click', ()=>{
  blackScreen.classList.add('hidden');
  sunScreen.classList.remove('hidden');
  sunScreen.style.opacity = 0;
  setTimeout(()=> sunScreen.style.opacity = 1, 50);
});

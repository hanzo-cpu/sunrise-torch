// app.js
// Nota: iOS Safari no permite controlar la linterna desde web.
// En Android Chrome algunos dispositivos permiten torch via constraints.

let wakeLock = null;
let audioCtx = null;
let alarmTimer = null;
let countdownTimer = null;

const enableBtn = document.getElementById('enableBtn');
const scheduleBtn = document.getElementById('scheduleBtn');
const cancelBtn = document.getElementById('cancelBtn');
const testLightBtn = document.getElementById('testLightBtn');
const testSoundBtn = document.getElementById('testSoundBtn');
const statusEl = document.getElementById('status');
const alarmTimeEl = document.getElementById('alarmTime');
const durationEl = document.getElementById('duration');
const countdownEl = document.getElementById('countdown');
const sunScreen = document.getElementById('sunScreen');

let stream = null;
let videoTrack = null;

// PWA SW
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(()=>{});
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => {
        console.log('WakeLock liberado');
      });
    }
  } catch (e) {
    console.log('No WakeLock:', e);
  }
}

async function prepareAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Desbloquear audio en iOS requiere interacción del usuario
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g).connect(audioCtx.destination);
    o.frequency.value = 0;
    g.gain.value = 0;
    o.start();
    setTimeout(()=>o.stop(), 10);
  } catch (e) {
    console.log('Audio init error', e);
  }
}

async function prepareTorch() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }
    });
    videoTrack = stream.getVideoTracks()[0];
    const caps = videoTrack.getCapabilities?.() || {};
    return !!caps.torch;
  } catch (e) {
    console.log('getUserMedia error', e);
    return false;
  }
}

async function setTorch(on) {
  if (!videoTrack) return false;
  try {
    const caps = videoTrack.getCapabilities?.() || {};
    if (!caps.torch) return false;
    await videoTrack.applyConstraints({ advanced: [{ torch: on }] });
    return true;
  } catch (e) {
    console.log('torch error', e);
    return false;
  }
}

function sunriseScreen(startSeconds, totalMinutes) {
  sunScreen.classList.remove('hidden');
  sunScreen.style.opacity = 0;
  const totalMs = totalMinutes * 60 * 1000;
  const start = performance.now() + startSeconds * 1000;
  function step(now) {
    const t = Math.max(0, now - start);
    const p = Math.min(1, t / totalMs);
    sunScreen.style.opacity = String(p);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function playAlarmTone() {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.value = 440;
  g.gain.value = 0;
  o.connect(g).connect(audioCtx.destination);
  o.start();
  let t = audioCtx.currentTime;
  // Subir volumen progresivo
  g.gain.linearRampToValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.05, t+5);
  g.gain.linearRampToValueAtTime(0.1, t+10);
  g.gain.linearRampToValueAtTime(0.2, t+20);
  // Apagar en 60s
  g.gain.linearRampToValueAtTime(0.0, t+60);
  o.stop(t+60);
}

function msUntil(timeStr) {
  const [hh, mm] = timeStr.split(':').map(x=>parseInt(x,10));
  const now = new Date();
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1); // mañana
  return target - now;
}

function startCountdown(ms) {
  clearInterval(countdownTimer);
  function render() {
    ms -= 1000;
    if (ms < 0) ms = 0;
    const s = Math.floor(ms/1000);
    const h = String(Math.floor(s/3600)).padStart(2,'0');
    const m = String(Math.floor((s%3600)/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    countdownEl.textContent = `Faltan ${h}:${m}:${ss}`;
    if (s <= 0) clearInterval(countdownTimer);
  }
  render();
  countdownTimer = setInterval(render, 1000);
}

enableBtn.addEventListener('click', async () => {
  await requestWakeLock();
  await prepareAudio();
  const torchSupported = await prepareTorch();
  statusEl.textContent = torchSupported 
    ? 'Linterna compatible ✅ (Android)'
    : 'Modo iPhone/pantalla ✅ (o linterna no compatible en este navegador)';
});

scheduleBtn.addEventListener('click', async () => {
  if (!audioCtx) await prepareAudio();
  const timeStr = alarmTimeEl.value;
  const ms = msUntil(timeStr);
  if (ms <= 0) return alert('Hora inválida');
  clearTimeout(alarmTimer);
  startCountdown(ms);
  alarmTimer = setTimeout(async () => {
    const minutes = Math.max(1, parseInt(durationEl.value||'5',10));
    // Intentar linterna
    const lit = await setTorch(true);
    // Pantalla amanecer (sirve también como refuerzo visual)
    sunriseScreen(0, minutes);
    // Tono creciente (necesita interacción previa para desbloquear audio)
    playAlarmTone();
    // Apagar linterna al finalizar
    setTimeout(async ()=>{ await setTorch(false); }, minutes*60*1000);
  }, ms);
  alert('Alarma programada. Mantén la app abierta y el teléfono con batería suficiente.');
});

cancelBtn.addEventListener('click', () => {
  clearTimeout(alarmTimer);
  clearInterval(countdownTimer);
  countdownEl.textContent = '';
});

testLightBtn.addEventListener('click', async () => {
  const ok = await setTorch(true);
  if (!ok) sunriseScreen(0, 0.1); // 6s de pantalla si no hay torch
  setTimeout(async ()=>{
    await setTorch(false);
  }, 5000);
});

testSoundBtn.addEventListener('click', () => {
  playAlarmTone();
});

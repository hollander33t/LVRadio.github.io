const audio = document.getElementById('radio-player');
const bgContainer = document.getElementById('background-container');
const body = document.body;
const titleEl = document.getElementById('track-title');
const artistEl = document.getElementById('track-artist');

const fallbackCover = 'https://i.imgur.com/6uls1s0.png';

let playing = false;
let busy = false;
let animationFrameId;

let audioCtx, analyser, source, dataArray;

function setupAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    try {
      source = audioCtx.createMediaElementSource(audio);
    } catch(e) {
      console.error('createMediaElementSource error:', e);
      alert('Audio-analyse werkt mogelijk niet.');
      return;
    }
    analyser = audioCtx.createAnalyser();
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 256;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  }
}

function getRMS() {
  analyser.getByteTimeDomainData(dataArray);
  let sumSquares = 0;
  for (const val of dataArray) {
    let normalized = (val - 128) / 128;
    sumSquares += normalized * normalized;
  }
  return Math.sqrt(sumSquares / dataArray.length);
}

function getBassIntensity() {
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freqData);

  const bassBins = 8;
  let sum = 0;
  for (let i = 0; i < bassBins; i++) {
    sum += freqData[i];
  }
  return sum / bassBins / 255;
}

function lerp(start, end, t) {
  return start + (end - start) * t;
}

let currentScale = 1;

function shakeBackground() {
  if (!playing) return;

  const rms = getRMS();
  const bass = getBassIntensity();

  const intensity = rms * 60;

  const bassThreshold = 0.6; // vanaf hier begint inzoomen
  const maxScaleIncrease = 0.1; // max 1.3 schaal

  let targetScale = 1;

  if (bass > bassThreshold) {
    const bassNormalized = Math.min((bass - bassThreshold) / (1 - bassThreshold), 1);
    targetScale = 1 + bassNormalized * maxScaleIncrease;
  }

  const x = (Math.random() - 0.5) * intensity * 2;
  const y = (Math.random() - 0.5) * intensity * 2;

  currentScale = lerp(currentScale, targetScale, 2.0);

  bgContainer.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${currentScale.toFixed(3)})`;

  animationFrameId = requestAnimationFrame(shakeBackground);
}

body.addEventListener('click', () => {
  if (busy) return;
  busy = true;

  if (!playing) {
    audio.play().catch(e => {
      console.warn('Playback failed:', e);
      alert('');
      busy = false;
    });
  } else {
    audio.pause();
    busy = false;
  }
});

audio.addEventListener('play', () => {
  playing = true;
  body.classList.remove('not-playing');
  body.classList.add('playing');
  busy = false;
  setupAudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  shakeBackground();
});

audio.addEventListener('pause', () => {
  playing = false;
  body.classList.remove('playing');
  body.classList.add('not-playing');
  busy = false;
  currentScale = 1;
  bgContainer.style.transform = 'translate(0,0) scale(1)';
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
});

async function updateTrack() {
  try {
    const res = await fetch('https://public.radio.co/stations/s0451af336/status');
    const data = await res.json();
    const track = data.current_track || {};

    let rawTitle = track.title || '';
    let title = 'CLUB 87.7FM - Las Vegas!';

    if (rawTitle) {
      const parts = rawTitle.split('-');
      if (parts.length > 1) {
        parts.pop();
        title = parts.join('-').trim();
      } else {
        title = rawTitle.trim();
      }
    }

    const artist = track.artist || track.album_artist || '';

    titleEl.textContent = title;
    artistEl.textContent = artist;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: artist,
        artwork: [
          { src: track.artwork_url || fallbackCover, sizes: '512x512', type: 'image/png' }
        ]
      });
    }
  } catch (e) {
    console.error('Kan track info niet laden:', e);
  }
}

updateTrack();
setInterval(updateTrack, 5000);

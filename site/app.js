(function () {
  const BUFFER_SECONDS = 5;

  let ctx = null;
  let gainNode = null;
  let source = null;
  let currentType = null;
  let playing = false;

  const btns = document.querySelectorAll('.noise-btn');
  const volumeSlider = document.getElementById('volume');
  const statusLabel = document.getElementById('status-label');
  const pulseRing = document.getElementById('pulse-ring');

  function ensureContext() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
    gainNode.gain.value = volumeSlider.value / 100;
  }

  function buildBuffer(type) {
    const len = Math.floor(BUFFER_SECONDS * ctx.sampleRate);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);

    if (type === 'white') {
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (type === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.11;
      }
    } else if (type === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    } else if (type === 'blue') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        data[i] = (w - last) * 0.5;
        last = w;
      }
    } else if (type === 'rain') {
      // Slow rain intensity envelope
      let envAmp = 0.5, envVel = 0;
      const env = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        envVel += (Math.random() - 0.5) * 0.001;
        envVel *= 0.995;
        envAmp = Math.max(0.25, Math.min(0.85, envAmp + envVel));
        env[i] = envAmp;
      }
      // Brown noise background hiss
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5 * env[i];
      }
      // Pitched water drop transients — freq sweeps down with exponential decay
      const numDrops = Math.floor(35 * BUFFER_SECONDS);
      for (let d = 0; d < numDrops; d++) {
        const pos = Math.floor(Math.random() * len);
        const f1 = 120 + Math.random() * 220;   // start pitch 120–340 Hz
        const f2 = 30  + Math.random() * 55;   // end pitch   30–85  Hz
        const dlen = Math.floor((0.04 + Math.random() * 0.1) * ctx.sampleRate);
        const dropAmp = (0.15 + Math.random() * 0.3) * env[pos];
        let phase = 0;
        for (let j = 0; j < dlen && pos + j < len; j++) {
          const t = j / dlen;
          phase += 2 * Math.PI * (f1 * Math.pow(f2 / f1, t)) / ctx.sampleRate;
          data[pos + j] += Math.sin(phase) * dropAmp * Math.exp(-t * 7);
        }
      }
    } else if (type === 'fan') {
      let last = 0;
      const f0 = 80; // blade fundamental Hz
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02; // brown noise base
        const t = i / ctx.sampleRate;
        const hum = Math.sin(2 * Math.PI * f0 * t) * 0.40
                  + Math.sin(2 * Math.PI * f0 * 2 * t) * 0.20
                  + Math.sin(2 * Math.PI * f0 * 3 * t) * 0.10
                  + Math.sin(2 * Math.PI * f0 * 4 * t) * 0.05;
        data[i] = last * 2.0 + hum * 0.22;
      }
    }

    return buf;
  }

  function stopSource() {
    if (source) {
      source.stop();
      source.disconnect();
      source = null;
    }
  }

  function startNoise(type) {
    ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    stopSource();

    const buf = buildBuffer(type);
    source = ctx.createBufferSource();
    source.buffer = buf;
    source.loop = true;
    source.connect(gainNode);
    source.start();

    currentType = type;
    playing = true;
  }

  function pause() {
    stopSource();
    playing = false;
  }

  function updateUI() {
    btns.forEach(b => {
      b.classList.toggle('active', playing && b.dataset.type === currentType);
    });
    if (playing) {
      statusLabel.textContent = currentType + ' noise';
      statusLabel.classList.add('playing');
      pulseRing.classList.add('active');
    } else {
      statusLabel.textContent = 'choose a noise';
      statusLabel.classList.remove('playing');
      pulseRing.classList.remove('active');
    }
  }

  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (playing && currentType === type) {
        pause();
      } else {
        startNoise(type);
      }
      updateUI();
    });
  });

  volumeSlider.addEventListener('input', () => {
    if (gainNode) gainNode.gain.value = volumeSlider.value / 100;
  });
}());

// PWA install
(function () {
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  const btn = document.getElementById('install-btn');
  let prompt;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    btn.textContent = '⊕ Install';
    btn.hidden = false;
    btn.addEventListener('click', () => alert('Tap the Share icon ⎋, then "Add to Home Screen".'));
    return;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    prompt = e;
    btn.hidden = false;
  });

  window.addEventListener('appinstalled', () => { btn.hidden = true; prompt = null; });

  btn.addEventListener('click', async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') btn.hidden = true;
    prompt = null;
  });
}());

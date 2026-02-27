// ═══════════ UNSTUCK — Ambient Sound Engine ═══════════
// Procedural café ambiance using Web Audio API

const AmbientSound = (function () {
    'use strict';

    let audioCtx = null;
    let masterGain = null;
    let isPlaying = false;
    let nodes = [];

    function getContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.gain.value = 0;
            masterGain.connect(audioCtx.destination);
        }
        // Always resume — critical for iOS Safari which suspends by default
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        return audioCtx;
    }

    // iOS Safari requires AudioContext to be created/resumed inside a user gesture.
    // Also requires an actual audio buffer to play to fully unlock the pipeline.
    function unlockAudio() {
        if (!audioCtx) getContext();

        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => {
                playSilentBuffer();
            });
        } else {
            playSilentBuffer();
        }

        document.removeEventListener('touchstart', unlockAudio, true);
        document.removeEventListener('click', unlockAudio, true);
    }

    function playSilentBuffer() {
        const buffer = audioCtx.createBuffer(1, 1, 22050);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start(0);
    }
    document.addEventListener('touchstart', unlockAudio, true);
    document.addEventListener('click', unlockAudio, true);

    // Brown noise generator (warm café ambiance base)
    function createBrownNoise(ctx) {
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + 0.02 * white) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        // Filter to make it warm
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        filter.Q.value = 0.7;

        const gain = ctx.createGain();
        gain.gain.value = 0.25;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        source.start();

        return { source, filter, gain };
    }

    // Murmur layer — filtered pink noise that sounds like distant chatter
    function createMurmur(ctx) {
        const bufferSize = 2 * ctx.sampleRate;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Pink noise via Voss-McCartney
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        // Bandpass to simulate voice-range chatter
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 800;
        bp.Q.value = 0.5;

        // Slow volume modulation via LFO for natural ebb and flow
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.12;

        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.08; // very slow modulation
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = 0.04;

        lfo.connect(lfoDepth);
        lfoDepth.connect(lfoGain.gain);
        lfo.start();

        source.connect(bp);
        bp.connect(lfoGain);
        lfoGain.connect(masterGain);
        source.start();

        return { source, bp, lfoGain, lfo, lfoDepth };
    }

    // Occasional clink sounds (cup/spoon)
    function createClinks(ctx) {
        const schedule = () => {
            if (!isPlaying) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            // Random high pitched clink
            osc.type = 'sine';
            osc.frequency.value = 2000 + Math.random() * 3000;

            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.02, ctx.currentTime + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);

            // Schedule next clink randomly (3-12 seconds)
            const nextDelay = 3000 + Math.random() * 9000;
            setTimeout(schedule, nextDelay);
        };

        // Start first clink after a delay
        setTimeout(schedule, 2000 + Math.random() * 5000);
    }

    // Keyboard typing sounds (gentle)
    function createTypingSounds(ctx) {
        const schedule = () => {
            if (!isPlaying) return;

            // Burst of typing (3-8 keystrokes)
            const count = 3 + Math.floor(Math.random() * 6);
            for (let i = 0; i < count; i++) {
                const delay = i * (0.08 + Math.random() * 0.06);
                setTimeout(() => {
                    if (!isPlaying) return;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    const filter = ctx.createBiquadFilter();

                    osc.type = 'square';
                    osc.frequency.value = 100 + Math.random() * 60;

                    filter.type = 'highpass';
                    filter.frequency.value = 500;

                    gain.gain.setValueAtTime(0, ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0.008, ctx.currentTime + 0.002);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

                    osc.connect(filter);
                    filter.connect(gain);
                    gain.connect(masterGain);
                    osc.start(ctx.currentTime);
                    osc.stop(ctx.currentTime + 0.05);
                }, delay * 1000);
            }

            // Next burst in 5-20 seconds
            const nextDelay = 5000 + Math.random() * 15000;
            setTimeout(schedule, nextDelay);
        };

        setTimeout(schedule, 4000 + Math.random() * 6000);
    }

    return {
        start() {
            if (isPlaying) return;
            const ctx = getContext();
            isPlaying = true;

            // Create layers
            const brown = createBrownNoise(ctx);
            const murmur = createMurmur(ctx);
            nodes.push(brown, murmur);

            createClinks(ctx);
            createTypingSounds(ctx);

            // Fade in
            masterGain.gain.cancelScheduledValues(ctx.currentTime);
            masterGain.gain.setValueAtTime(0, ctx.currentTime);
            masterGain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 2);
        },

        stop() {
            if (!isPlaying || !audioCtx) return;
            isPlaying = false;

            // Fade out
            masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
            masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
            masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);

            // Capture current nodes so a new start() doesn't get wiped
            const oldNodes = nodes;
            nodes = [];

            // Clean up after fade
            setTimeout(() => {
                oldNodes.forEach(n => {
                    if (n.source) try { n.source.stop(); } catch (e) { }
                    if (n.lfo) try { n.lfo.stop(); } catch (e) { }
                });
            }, 2000);
        },

        get isPlaying() {
            return isPlaying;
        },

        // Play a gentle nudge chime
        playNudge() {
            const ctx = getContext();
            const now = ctx.currentTime;

            // Two gentle tones
            [440, 554].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.value = freq;

                const start = now + i * 0.25;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);

                osc.connect(gain);
                gain.connect(ctx.destination); // Direct to output, not master
                osc.start(start);
                osc.stop(start + 1);
            });
        },

        // Play a satisfying completion sound
        playReward() {
            const ctx = getContext();
            const now = ctx.currentTime;

            // Ascending arpeggio: C5, E5, G5, C6
            [523, 659, 784, 1047].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();

                osc.type = 'sine';
                osc.frequency.value = freq;

                const start = now + i * 0.1;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(start);
                osc.stop(start + 0.6);
            });
        }
    };
})();

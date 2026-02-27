// ═══════════ UNSTUCK — Core Application Logic ═══════════
(function () {
    'use strict';

    // ────────────────────────────────────
    //  UTILITY
    // ────────────────────────────────────
    const $ = id => document.getElementById(id);
    function uuid() {
        return 'xxxx-xxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
    }

    // ────────────────────────────────────
    //  VAULT MANAGER — Task Storage
    // ────────────────────────────────────
    const Vault = {
        _key: 'unstuck_vault',
        _countKey: 'unstuck_completed',

        _load() {
            try { return JSON.parse(localStorage.getItem(this._key) || '[]'); }
            catch { return []; }
        },
        _save(tasks) {
            localStorage.setItem(this._key, JSON.stringify(tasks));
        },

        addTask(text) {
            const tasks = this._load();
            const task = {
                id: uuid(),
                text: text.trim(),
                created: Date.now()
            };
            tasks.push(task);
            this._save(tasks);
            return task;
        },

        getNextTask() {
            const tasks = this._load();
            return tasks.length > 0 ? tasks[0] : null;
        },

        completeTask(id) {
            const tasks = this._load();
            const task = tasks.find(t => t.id === id);
            const remaining = tasks.filter(t => t.id !== id);
            this._save(remaining);
            // Increment completed count
            const count = this.getCompletedCount() + 1;
            localStorage.setItem(this._countKey, count.toString());
            // Track completed task text + timestamp for daily summary
            if (task) {
                const history = this._loadHistory();
                history.push({ text: task.text, completedAt: Date.now() });
                localStorage.setItem('unstuck_history', JSON.stringify(history));
            }
            return count;
        },

        deferTask(id) {
            const tasks = this._load();
            const idx = tasks.findIndex(t => t.id === id);
            if (idx > -1) {
                const [task] = tasks.splice(idx, 1);
                // Move backward: insert at a random index between 1 and length
                const newIdx = tasks.length === 0 ? 0 : 1 + Math.floor(Math.random() * tasks.length);
                tasks.splice(newIdx, 0, task);
                this._save(tasks);
            }
        },

        deleteTask(id) {
            const tasks = this._load().filter(t => t.id !== id);
            this._save(tasks);
        },

        getAllTasks() {
            return this._load();
        },

        getAvailableCount() {
            return this._load().length;
        },

        getTotalCount() {
            return this._load().length;
        },

        getCompletedCount() {
            return parseInt(localStorage.getItem(this._countKey) || '0', 10);
        },

        _loadHistory() {
            try { return JSON.parse(localStorage.getItem('unstuck_history') || '[]'); }
            catch { return []; }
        },

        getTodayCompleted() {
            const history = this._loadHistory();
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            return history.filter(h => h.completedAt >= startOfDay.getTime());
        }
    };

    // ────────────────────────────────────
    //  SCREEN ROUTER
    // ────────────────────────────────────
    const screens = ['slate', 'vault', 'reveal', 'admin'];
    let currentScreen = 'slate';

    function goTo(screenName) {
        if (!screens.includes(screenName)) return;

        const current = $(`screen-${currentScreen}`);
        const next = $(`screen-${screenName}`);

        if (current) current.classList.remove('active');
        if (next) {
            next.classList.add('active');
            // Re-trigger entrance animations
            next.style.animation = 'none';
            next.offsetHeight; // force reflow
            next.style.animation = '';
        }

        currentScreen = screenName;

        // Screen-specific hooks
        if (screenName === 'slate') {
            updateSlate();
        } else {
            LivingOrb.stop();
        }

        if (screenName === 'admin') renderAdmin();
        if (screenName === 'vault') focusVaultInput();
        if (screenName === 'reveal') Nudge.start();
    }

    // ────────────────────────────────────
    //  CLEAN SLATE SCREEN
    // ────────────────────────────────────
    function updateSlate() {
        const completed = Vault.getCompletedCount();
        const stats = $('slate-stats');
        if (completed > 0) {
            const messages = [
                `${completed} task${completed !== 1 ? 's' : ''} conquered 🎉`,
                `You've done ${completed} thing${completed !== 1 ? 's' : ''}. Respect. 💜`,
                `${completed} down. You're on a roll. ✨`,
                `Look at you — ${completed} tasks done! 🔥`,
            ];
            stats.textContent = messages[completed % messages.length];
        } else {
            stats.textContent = '';
        }

        // Update greeting based on time
        const hour = new Date().getHours();
        const title = $('slate-title');
        const subtitle = $('slate-subtitle');

        if (hour < 6) {
            title.innerHTML = "Can't sleep?<br>That's okay.";
            subtitle.textContent = "Let's make some progress together.";
        } else if (hour < 12) {
            title.innerHTML = "Good morning.<br>You showed up.";
            subtitle.textContent = "That's already a win.";
        } else if (hour < 17) {
            title.innerHTML = "One thing<br>at a time.";
            subtitle.textContent = "Whenever you're ready.";
        } else if (hour < 21) {
            title.innerHTML = "Evening check-in.<br>No pressure.";
            subtitle.textContent = "Even one small thing counts.";
        } else {
            title.innerHTML = "Still going?<br>Impressive.";
            subtitle.textContent = "But also, rest is okay too.";
        }

        LivingOrb.start();
    }

    // ────────────────────────────────────
    //  LIVING ORB — Interactive Ripple System
    // ────────────────────────────────────
    const LivingOrb = {
        _heartbeatInterval: null,
        _orb: $('breathing-orb'),
        _orbCore: document.querySelector('.orb-core'),
        _rippleLayer: $('orb-ripple-layer'),
        _isRunning: false,

        // Ripple state
        _pressActive: false,
        _pressOrigin: null,
        _ringInterval: null,
        _intensityRaf: null,
        _intensity: 0,

        init() {
            this._orb.addEventListener('pointerdown', (e) => {
                this._onPressStart(e, true);
            });

            const endPress = () => this._onPressEnd();
            this._orb.addEventListener('pointerup', endPress);
            this._orb.addEventListener('pointerleave', endPress);
            this._orb.addEventListener('pointercancel', endPress);

            // Also allow pressing anywhere on the screen
            document.addEventListener('pointerdown', (e) => {
                // Only trigger if the press is NOT on the orb itself (orb handles its own)
                if (!this._orb.contains(e.target)) {
                    this._onPressStart(e, false);
                }
            });
            const docEndPress = () => {
                if (this._pressActive && !this._pressOrigin?.isOrb) {
                    this._onPressEnd();
                }
            };
            document.addEventListener('pointerup', docEndPress);
            document.addEventListener('pointercancel', docEndPress);

            // Visibility
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this._stopHeartbeat();
                } else if (this._isRunning) {
                    this._startHeartbeat();
                }
            });
        },

        _onPressStart(e, isOrb) {
            if (this._pressActive) return;
            this._pressActive = true;

            const x = e.clientX;
            const y = e.clientY;
            this._pressOrigin = { x, y, isOrb, time: Date.now() };

            this._orb.classList.add('active');
            if (navigator.vibrate) navigator.vibrate(15);

            // Set gradient press position on orb
            if (isOrb) {
                const rect = this._orbCore.getBoundingClientRect();
                const px = ((x - rect.left) / rect.width * 100).toFixed(1);
                const py = ((y - rect.top) / rect.height * 100).toFixed(1);
                this._orbCore.style.setProperty('--press-x', px + '%');
                this._orbCore.style.setProperty('--press-y', py + '%');
                // Disable the slow fade-out during ramp-up
                this._orbCore.style.transition = 'none';
            }

            // Start intensity ramp
            this._intensity = 0;
            this._rampIntensity();

            // Spawn first ring immediately, then every 400ms
            this._spawnRing(x, y);
            this._ringInterval = setInterval(() => {
                if (this._pressActive) this._spawnRing(x, y);
            }, 400);
        },

        _onPressEnd() {
            if (!this._pressActive) return;
            this._pressActive = false;

            this._orb.classList.remove('active');

            // Stop spawning
            if (this._ringInterval) {
                clearInterval(this._ringInterval);
                this._ringInterval = null;
            }

            // Stop intensity ramp
            if (this._intensityRaf) {
                cancelAnimationFrame(this._intensityRaf);
                this._intensityRaf = null;
            }

            // Fade out gradient with transition
            this._orbCore.style.transition = 'opacity 1.5s ease-out';
            this._orbCore.style.setProperty('--press-intensity', '0');
            this._intensity = 0;

            this._pressOrigin = null;
        },

        _rampIntensity() {
            if (!this._pressActive) return;

            // Ramp from 0 to 1 over ~2 seconds
            this._intensity = Math.min(1, this._intensity + 0.012);
            this._orbCore.style.setProperty('--press-intensity', this._intensity.toFixed(3));

            this._intensityRaf = requestAnimationFrame(() => this._rampIntensity());
        },

        _spawnRing(x, y) {
            const layer = this._rippleLayer;
            const size = Math.max(window.innerWidth, window.innerHeight) * 2.8;

            const ring = document.createElement('div');
            ring.className = 'ripple-ring';
            ring.style.width = size + 'px';
            ring.style.height = size + 'px';
            ring.style.left = (x - size / 2) + 'px';
            ring.style.top = (y - size / 2) + 'px';
            layer.appendChild(ring);

            // Check for orb collision (if press is NOT on the orb)
            if (this._pressOrigin && !this._pressOrigin.isOrb) {
                this._scheduleCollisionCheck(x, y, size);
            }

            // Self-remove after animation (3s + 500ms buffer)
            setTimeout(() => {
                if (ring.parentNode) ring.parentNode.removeChild(ring);
            }, 3500);
        },

        _scheduleCollisionCheck(pressX, pressY, ringSize) {
            // The ring expands from scale(0) to scale(1) over 3s
            // We need to find when the ring's radius reaches the orb center
            const orbRect = this._orb.getBoundingClientRect();
            const orbCX = orbRect.left + orbRect.width / 2;
            const orbCY = orbRect.top + orbRect.height / 2;

            const dist = Math.hypot(pressX - orbCX, pressY - orbCY);
            const maxRadius = ringSize / 2;

            if (dist > maxRadius) return; // Ring won't reach the orb

            // Time = (distance / maxRadius) * animationDuration
            // The easing curve makes this approximate, but close enough
            const hitTime = (dist / maxRadius) * 3000;

            setTimeout(() => {
                this._pulseOrbGradient(orbCX, orbCY);
            }, hitTime);
        },

        _pulseOrbGradient(x, y) {
            const rect = this._orbCore.getBoundingClientRect();
            const px = ((x - rect.left) / rect.width * 100).toFixed(1);
            const py = ((y - rect.top) / rect.height * 100).toFixed(1);

            this._orbCore.style.transition = 'none';
            this._orbCore.style.setProperty('--press-x', px + '%');
            this._orbCore.style.setProperty('--press-y', py + '%');
            this._orbCore.style.setProperty('--press-intensity', '0.5');

            // Fade back out
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    this._orbCore.style.transition = 'opacity 1.2s ease-out';
                    this._orbCore.style.setProperty('--press-intensity', '0');
                });
            });
        },

        start() {
            this._isRunning = true;
            if (!document.hidden) this._startHeartbeat();
        },

        stop() {
            this._isRunning = false;
            this._stopHeartbeat();
            this._onPressEnd();
        },

        _startHeartbeat() {
            if (this._heartbeatInterval) return;
            const cycleDuration = 8000;
            const inhalePeakOffset = 2800;

            const pulse = () => {
                if (navigator.vibrate) {
                    navigator.vibrate([15, 100, 25]);
                }
            };

            this._heartbeatInterval = setInterval(() => {
                setTimeout(pulse, inhalePeakOffset);
            }, cycleDuration);

            setTimeout(pulse, inhalePeakOffset);
        },

        _stopHeartbeat() {
            if (this._heartbeatInterval) {
                clearInterval(this._heartbeatInterval);
                this._heartbeatInterval = null;
            }
        }
    };

    // ────────────────────────────────────
    //  THE VAULT — Brain Dump
    // ────────────────────────────────────
    const vaultInput = $('vault-input');
    const vaultSubmit = $('vault-submit');
    const vaporizeZone = $('vault-vaporize-zone');

    function submitTask(overrideText) {
        const text = (overrideText || vaultInput.value).trim();
        if (!text) return;

        // Add to vault
        Vault.addTask(text);

        // Show vaporize animation
        const item = document.createElement('div');
        item.className = 'vaporize-item';
        item.textContent = text;
        vaporizeZone.prepend(item);

        // Clear input and suggestion
        vaultInput.value = '';
        TextInterpreter.clearSuggestion();
        vaultInput.focus();

        // Remove the element after animation
        setTimeout(() => {
            if (item.parentNode) item.parentNode.removeChild(item);
        }, 900);

        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(30);
    }

    function focusVaultInput() {
        setTimeout(() => vaultInput.focus(), 300);
    }

    vaultInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitTask();
        }
    });
    vaultInput.addEventListener('input', () => TextInterpreter.update(vaultInput.value));
    vaultSubmit.addEventListener('click', () => submitTask());

    // ────────────────────────────────────
    //  TEXT INTERPRETER — Smart Suggestions
    // ────────────────────────────────────
    const TextInterpreter = {
        _bar: $('suggestion-bar'),
        _chip: $('suggestion-chip'),

        // Common misspellings dictionary
        _typos: {
            'teh': 'the', 'hte': 'the', 'thier': 'their', 'recieve': 'receive',
            'acheive': 'achieve', 'occured': 'occurred', 'seperate': 'separate',
            'definately': 'definitely', 'definitly': 'definitely', 'occurance': 'occurrence',
            'accomodate': 'accommodate', 'apparantly': 'apparently', 'calender': 'calendar',
            'catagory': 'category', 'cemetary': 'cemetery', 'collegue': 'colleague',
            'comming': 'coming', 'commitee': 'committee', 'completly': 'completely',
            'concious': 'conscious', 'curiousity': 'curiosity', 'decieve': 'deceive',
            'dissapear': 'disappear', 'dissapoint': 'disappoint', 'embarass': 'embarrass',
            'enviroment': 'environment', 'exagerate': 'exaggerate', 'excercise': 'exercise',
            'existance': 'existence', 'experiance': 'experience', 'foriegn': 'foreign',
            'freind': 'friend', 'gaurd': 'guard', 'goverment': 'government',
            'grammer': 'grammar', 'harrass': 'harass', 'immediatly': 'immediately',
            'independant': 'independent', 'intresting': 'interesting', 'knowlege': 'knowledge',
            'libary': 'library', 'lisence': 'license', 'maintenence': 'maintenance',
            'manuever': 'maneuver', 'millenium': 'millennium', 'minature': 'miniature',
            'mispell': 'misspell', 'neccessary': 'necessary', 'noticable': 'noticeable',
            'occasionaly': 'occasionally', 'occurence': 'occurrence', 'paralel': 'parallel',
            'parliment': 'parliament', 'persistant': 'persistent', 'posession': 'possession',
            'potatos': 'potatoes', 'preceed': 'precede', 'privelege': 'privilege',
            'professer': 'professor', 'publically': 'publicly', 'realy': 'really',
            'refered': 'referred', 'relevent': 'relevant', 'religous': 'religious',
            'repitition': 'repetition', 'resistence': 'resistance', 'rythm': 'rhythm',
            'shedule': 'schedule', 'sieze': 'seize', 'similiar': 'similar',
            'succesful': 'successful', 'suprise': 'surprise', 'tommorow': 'tomorrow',
            'tommorrow': 'tomorrow', 'tounge': 'tongue', 'truely': 'truly',
            'untill': 'until', 'unusuall': 'unusual', 'vaccuum': 'vacuum',
            'wierd': 'weird', 'wellcome': 'welcome', 'wheather': 'weather',
            'wich': 'which', 'writting': 'writing', 'yuor': 'your',
            'adn': 'and', 'ahve': 'have', 'cna': 'can', 'dnt': "don't",
            'intrested': 'interested', 'intrest': 'interest', 'alot': 'a lot',
            'definetly': 'definitely', 'probly': 'probably', 'prolly': 'probably',
            'gotta': 'got to', 'gonna': 'going to', 'wanna': 'want to',
            'kinda': 'kind of', 'sorta': 'sort of', 'shoulda': 'should have',
            'coulda': 'could have', 'woulda': 'would have',
            'dont': "don't", 'doesnt': "doesn't", 'cant': "can't", 'wont': "won't",
            'shouldnt': "shouldn't", 'wouldnt': "wouldn't", 'isnt': "isn't",
            'wasnt': "wasn't", 'havent': "haven't", 'hadnt': "hadn't",
            'didnt': "didn't", 'im': "I'm", 'ive': "I've", 'id': "I'd",
            'ill': "I'll", 'ur': 'your', 'u': 'you', 'r': 'are',
            'pls': 'please', 'thx': 'thanks', 'msg': 'message',
            'tmrw': 'tomorrow', 'tmr': 'tomorrow', 'w/': 'with',
            'b/c': 'because', 'bc': 'because', 'govt': 'government',
            'appt': 'appointment', 'apt': 'apartment', 'hw': 'homework',
            'asap': 'ASAP', 'rn': 'right now', 'nvm': 'never mind'
        },

        cleanup(text) {
            if (!text || !text.trim()) return '';
            let cleaned = text.trim();

            // Collapse extra whitespace
            cleaned = cleaned.replace(/\s{2,}/g, ' ');

            // Fix words using dictionary
            cleaned = cleaned.split(' ').map(word => {
                const lower = word.toLowerCase().replace(/[.,!?;:]+$/, '');
                const punctuation = word.match(/[.,!?;:]+$/);
                const suffix = punctuation ? punctuation[0] : '';
                if (this._typos[lower]) {
                    return this._typos[lower] + suffix;
                }
                return word + (suffix && !word.endsWith(suffix) ? suffix : '');
            }).join(' ');

            // Capitalize first letter
            if (cleaned.length > 0) {
                cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            }

            // Fix "i " to "I "
            cleaned = cleaned.replace(/\bi\b/g, 'I');

            // Fix double punctuation
            cleaned = cleaned.replace(/([.!?])\1+/g, '$1');

            return cleaned;
        },

        update(rawText) {
            const cleaned = this.cleanup(rawText);
            const raw = rawText.trim();

            if (cleaned && cleaned !== raw && raw.length > 2) {
                this._chip.textContent = cleaned;
                this._bar.classList.add('visible');
            } else {
                this._bar.classList.remove('visible');
            }
        },

        clearSuggestion() {
            this._bar.classList.remove('visible');
            this._chip.textContent = '';
        }
    };

    // Suggestion chip click — submit the cleaned version
    $('suggestion-chip').addEventListener('click', () => {
        const cleanedText = TextInterpreter._chip.textContent;
        if (cleanedText) {
            submitTask(cleanedText);
        }
    });

    // ────────────────────────────────────
    //  THE REVEAL — One Task at a Time
    // ────────────────────────────────────
    let currentTask = null;

    function revealTask() {
        const task = Vault.getNextTask();
        const card = $('reveal-card');
        const actions = document.querySelector('.reveal-actions');

        if (!task) {
            // Vault is truly empty (snooze is gone)
            card.innerHTML = `
                <div class="reveal-empty">
                    <div class="reveal-empty-icon">📦</div>
                    <p class="reveal-empty-text">Vault is empty!</p>
                    <p class="reveal-empty-subtext">Brain dump some tasks first, then come back.</p>
                    <button class="btn-go-vault" id="btn-go-vault-inner">Open the Vault</button>
                </div>`;
            actions.style.display = 'none';
            const innerBtn = $('btn-go-vault-inner');
            if (innerBtn) innerBtn.addEventListener('click', () => goTo('vault'));

            currentTask = null;
            return;
        }

        currentTask = task;
        // Rebuild the card content (fixes the DOM destruction bug)
        card.innerHTML = `<p class="reveal-task-text" id="reveal-task-text"></p>`;
        $('reveal-task-text').textContent = task.text;
        actions.style.display = '';

        // Re-trigger card and actions animation
        card.style.animation = 'none';
        card.offsetHeight;
        card.style.animation = '';

        actions.style.animation = 'none';
        actions.offsetHeight;
        actions.style.animation = '';

        // Start nudge timer
        Nudge.start();
    }

    // Start — enters body double mode
    $('btn-start').addEventListener('click', () => {
        if (!currentTask) return;
        Nudge.stop();
        BodyDouble.activate(currentTask);
    });

    // Done — complete and reward
    $('btn-done').addEventListener('click', () => {
        if (!currentTask) return;
        Nudge.stop();
        const count = Vault.completeTask(currentTask.id);
        currentTask = null;
        Reward.fire(count);
        setTimeout(() => goTo('slate'), 2200);
    });

    // Defer — move task further back in the queue
    $('btn-snooze').addEventListener('click', () => {
        if (!currentTask) return;
        Nudge.stop();
        Vault.deferTask(currentTask.id);
        currentTask = null;

        // Try to reveal another task (the new first in queue)
        const nextTask = Vault.getNextTask();
        if (nextTask) {
            revealTask();
        } else {
            goTo('slate');
        }
    });

    // ────────────────────────────────────
    //  NUDGE SYSTEM — 2 min inactivity
    // ────────────────────────────────────
    const Nudge = {
        _timer: null,
        _DELAY: 2 * 60 * 1000, // 2 minutes

        start() {
            this.stop();
            if (currentScreen !== 'reveal') return;
            this._timer = setTimeout(() => this._trigger(), this._DELAY);
        },

        stop() {
            if (this._timer) {
                clearTimeout(this._timer);
                this._timer = null;
            }
            $('nudge-overlay').classList.remove('active');
        },

        _trigger() {
            if (currentScreen !== 'reveal') return;
            $('nudge-overlay').classList.add('active');

            // Play nudge sound
            if (typeof AmbientSound !== 'undefined') {
                AmbientSound.playNudge();
            }

            // Haptic
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
        }
    };

    // Nudge dismiss
    $('nudge-dismiss').addEventListener('click', () => {
        Nudge.stop();
        Nudge.start(); // restart timer
    });

    // Reset nudge on any interaction in reveal screen
    document.addEventListener('click', () => {
        if (currentScreen === 'reveal' && !$('nudge-overlay').classList.contains('active')) {
            Nudge.start();
        }
    });

    // ────────────────────────────────────
    //  BODY DOUBLE — Focus Overlay
    // ────────────────────────────────────
    const BodyDouble = {
        _soundActive: false,
        _activeTask: null,

        activate(task) {
            this._activeTask = task;
            $('body-double-task-text').textContent = task.text;
            $('body-double-overlay').classList.add('active');

            // Start ambient sound by default
            this.toggleSound(true);
        },

        deactivate() {
            $('body-double-overlay').classList.remove('active');
            this.toggleSound(false);
            this._activeTask = null;
        },

        toggleSound(forceState) {
            const shouldPlay = forceState !== undefined ? forceState : !this._soundActive;
            const btn = $('bd-toggle-sound');
            const label = $('bd-sound-label');
            const viz = $('audio-visualizer');

            if (shouldPlay) {
                AmbientSound.start();
                this._soundActive = true;
                btn.classList.add('active');
                label.textContent = 'Sound on';
                viz.classList.add('playing');
            } else {
                AmbientSound.stop();
                this._soundActive = false;
                btn.classList.remove('active');
                label.textContent = 'Café sounds';
                viz.classList.remove('playing');
            }
        }
    };

    // Body double controls
    $('body-double-close').addEventListener('click', () => {
        BodyDouble.deactivate();
        // Go back to reveal screen (task still active)
        Nudge.start();
    });

    $('bd-toggle-sound').addEventListener('click', () => {
        BodyDouble.toggleSound();
    });

    $('bd-done').addEventListener('click', () => {
        if (!BodyDouble._activeTask) return;
        const taskId = BodyDouble._activeTask.id;
        BodyDouble.deactivate();
        const count = Vault.completeTask(taskId);
        currentTask = null;
        Reward.fire(count);
        setTimeout(() => goTo('slate'), 2200);
    });

    // ────────────────────────────────────
    //  REWARD SYSTEM — Confetti + Sound
    // ────────────────────────────────────
    const Reward = {
        fire(completedCount) {
            this._confetti();
            this._blur();
            this._flash();
            this._message(completedCount);

            // Sound
            if (typeof AmbientSound !== 'undefined') {
                AmbientSound.playReward();
            }

            // Haptic
            if (navigator.vibrate) {
                navigator.vibrate([50, 30, 80, 30, 120]);
            }
        },

        _confetti() {
            const canvas = $('confetti-canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = Math.min(window.innerWidth, 430);
            canvas.height = window.innerHeight;

            const particles = [];
            const colors = ['#a78bfa', '#5eead4', '#f0abfc', '#fbbf24', '#fb7185', '#818cf8', '#34d399'];

            for (let i = 0; i < 120; i++) {
                particles.push({
                    x: canvas.width / 2 + (Math.random() - 0.5) * 60,
                    y: canvas.height * 0.4,
                    vx: (Math.random() - 0.5) * 14,
                    vy: -8 - Math.random() * 12,
                    size: 4 + Math.random() * 6,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    rotation: Math.random() * 360,
                    rotSpeed: (Math.random() - 0.5) * 10,
                    gravity: 0.15 + Math.random() * 0.1,
                    opacity: 1,
                    shape: Math.random() > 0.5 ? 'rect' : 'circle'
                });
            }

            let frame = 0;
            const maxFrames = 120;

            function animate() {
                if (frame >= maxFrames) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    return;
                }
                frame++;

                ctx.clearRect(0, 0, canvas.width, canvas.height);

                particles.forEach(p => {
                    p.x += p.vx;
                    p.vy += p.gravity;
                    p.y += p.vy;
                    p.vx *= 0.99;
                    p.rotation += p.rotSpeed;
                    p.opacity = Math.max(0, 1 - frame / maxFrames);

                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.globalAlpha = p.opacity;
                    ctx.fillStyle = p.color;

                    if (p.shape === 'rect') {
                        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
                    } else {
                        ctx.beginPath();
                        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.restore();
                });

                requestAnimationFrame(animate);
            }

            animate();
        },

        _blur() {
            const blur = document.createElement('div');
            blur.className = 'reward-blur';
            document.body.appendChild(blur);
            setTimeout(() => blur.remove(), 2200);
        },

        _flash() {
            const flash = document.createElement('div');
            flash.className = 'reward-flash';
            document.body.appendChild(flash);
            setTimeout(() => flash.remove(), 900);
        },

        _message(count) {
            const messages = [
                '🎉 Crushed it!',
                '✨ You did the thing!',
                '🔥 One down!',
                '💜 That counts!',
                '⚡ Momentum!',
                '🌟 Look at you go!',
                '🎯 Task demolished!',
                '💪 Unstoppable!',
            ];

            const msg = document.createElement('div');
            msg.className = 'reward-message';

            const emoji = messages[count % messages.length].split(' ')[0];
            const text = messages[count % messages.length].split(' ').slice(1).join(' ');

            msg.innerHTML = `
                <span class="reward-emoji">${emoji}</span>
                <span class="reward-text">${text}</span>
            `;
            document.body.appendChild(msg);
            setTimeout(() => msg.remove(), 1800);
        }
    };

    // ────────────────────────────────────
    //  ADMIN MODE — Hidden Task Manager
    // ────────────────────────────────────
    let adminLongPressTimer = null;
    const logo = $('slate-logo');

    // Long press to enter admin (800ms)
    logo.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        adminLongPressTimer = setTimeout(() => {
            if (navigator.vibrate) navigator.vibrate(50);
            goTo('admin');
        }, 800);
    });

    logo.addEventListener('pointerup', () => clearTimeout(adminLongPressTimer));
    logo.addEventListener('pointerleave', () => clearTimeout(adminLongPressTimer));
    logo.addEventListener('pointercancel', () => clearTimeout(adminLongPressTimer));

    function renderAdmin() {
        const tasks = Vault.getAllTasks();
        const list = $('admin-list');
        const empty = $('admin-empty');
        const info = $('admin-info');
        const now = Date.now();

        list.innerHTML = '';
        info.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''} in vault · ${Vault.getCompletedCount()} completed all time`;

        if (tasks.length === 0) {
            empty.classList.add('visible');
            return;
        }

        empty.classList.remove('visible');

        tasks.forEach((task) => {
            const item = document.createElement('div');
            item.className = 'admin-item';

            item.innerHTML = `
                <span class="admin-item-text">${escapeHtml(task.text)}</span>
                <button class="admin-item-delete" data-id="${task.id}" aria-label="Delete task">✕</button>
            `;

            item.querySelector('.admin-item-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                Vault.deleteTask(task.id);
                renderAdmin();
                if (navigator.vibrate) navigator.vibrate(20);
            });

            list.appendChild(item);
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ────────────────────────────────────
    //  NAVIGATION BINDINGS
    // ────────────────────────────────────
    // "I'm stuck" button — reveal a task
    $('btn-reveal').addEventListener('click', () => {
        goTo('reveal');
        revealTask();
    });

    // Brain dump shortcut
    $('btn-vault-shortcut').addEventListener('click', () => {
        goTo('vault');
    });

    // Back buttons
    $('vault-back').addEventListener('click', () => goTo('slate'));
    $('admin-back').addEventListener('click', () => goTo('slate'));

    // ────────────────────────────────────
    //  DISTRACTION RESCUE — Visibility + Notifications
    // ────────────────────────────────────
    const DistractionRescue = {
        _settingsKey: 'unstuck_rescue',
        _awayKey: 'unstuck_away_since',
        _awayTimer: null,
        _swRegistration: null,

        get _awaySince() {
            const val = localStorage.getItem(this._awayKey);
            return val ? parseInt(val, 10) : null;
        },
        set _awaySince(val) {
            if (val === null) localStorage.removeItem(this._awayKey);
            else localStorage.setItem(this._awayKey, val.toString());
        },
        _saveSettings(s) {
            localStorage.setItem(this._settingsKey, JSON.stringify(s));
        },

        _loadSettings() {
            try {
                const data = localStorage.getItem(this._settingsKey);
                return data ? JSON.parse(data) : {};
            } catch (e) {
                return {};
            }
        },

        get enabled() { return this._loadSettings().enabled || false; },
        get delayMinutes() { return this._loadSettings().delay || 15; },

        async init() {
            // Register service worker
            if ('serviceWorker' in navigator) {
                try {
                    this._swRegistration = await navigator.serviceWorker.register('./sw.js');
                } catch (e) {
                    console.warn('SW registration failed:', e);
                }
            }

            // Check if we exceeded time while iOS suspended us/killed the app in the background
            if (this.enabled && this._awaySince) {
                this._checkAwayTime();
            }

            // Listen for visibility changes
            document.addEventListener('visibilitychange', () => {
                if (!this.enabled) return;

                if (document.hidden) {
                    this._awaySince = Date.now();
                    this._startAwayTimer();
                } else {
                    this._checkAwayTime();
                    this._clearAwayTimer();
                }
            });

            // Listen for SW messages (notification click)
            navigator.serviceWorker?.addEventListener('message', (e) => {
                if (e.data?.type === 'RESCUE_REVEAL') {
                    goTo('reveal');
                    revealTask();
                }
            });

            // Check URL for rescue param (opened from notification)
            if (new URLSearchParams(window.location.search).has('rescue')) {
                // Clean URL
                history.replaceState({}, '', window.location.pathname);
                // Wait for vault to load then reveal
                setTimeout(() => {
                    if (Vault.getAvailableCount() > 0) {
                        goTo('reveal');
                        revealTask();
                    }
                }, 500);
            }
        },

        _checkAwayTime() {
            if (!this._awaySince) return;
            const elapsed = Date.now() - this._awaySince;
            const delayMs = this.delayMinutes * 60 * 1000;
            if (elapsed >= delayMs) {
                if (Vault.getAvailableCount() > 0) {
                    goTo('reveal');
                    revealTask();
                }
                this._sendRescue();
            }
            this._awaySince = null;
        },

        _startAwayTimer() {
            this._clearAwayTimer();
            const delayMs = this.delayMinutes * 60 * 1000;
            this._awayTimer = setTimeout(() => this._sendRescue(), delayMs);
        },

        _clearAwayTimer() {
            if (this._awayTimer) {
                clearTimeout(this._awayTimer);
                this._awayTimer = null;
            }
        },

        async _sendRescue() {
            if (Vault.getAvailableCount() === 0) return; // No tasks to show

            // Try SW notification first
            if (this._swRegistration?.active) {
                this._swRegistration.active.postMessage({ type: 'SEND_RESCUE_NOTIFICATION' });
                return;
            }

            // Fallback: direct notification
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Hey, you still there? 👋', {
                    body: "You've been away for a bit. Want to knock something out?",
                    tag: 'unstuck-rescue',
                    renotify: true
                });
            }
        },

        toggle(enabled) {
            const settings = this._loadSettings();
            settings.enabled = enabled;
            this._saveSettings(settings);
            if (!enabled) {
                this._clearAwayTimer();
                this._awaySince = null;
            }
        },

        setDelay(minutes) {
            const settings = this._loadSettings();
            settings.delay = minutes;
            this._saveSettings(settings);
        }
    };

    // ────────────────────────────────────
    //  APP-SPECIFIC TIME LIMITS
    // ────────────────────────────────────
    const AppTimeLimits = {
        _key: 'unstuck_app_limits',

        _load() {
            try { return JSON.parse(localStorage.getItem(this._key) || '{}'); }
            catch { return {}; }
        },
        _save(limits) {
            localStorage.setItem(this._key, JSON.stringify(limits));
        },

        getLimit(appId) {
            const limits = this._load();
            return limits[appId] || 0; // 0 = no limit
        },

        setLimit(appId, minutes) {
            const limits = this._load();
            if (minutes === 0) {
                delete limits[appId];
            } else {
                limits[appId] = minutes;
            }
            this._save(limits);
        },

        initUI() {
            const chips = document.querySelectorAll('.app-chip');
            const configPanel = $('app-limit-configurator');
            const title = $('configurator-title');
            const pills = document.querySelectorAll('#app-limit-pills .delay-pill');
            let activeAppId = null;

            // Handle clicking an app chip to open the configurator
            chips.forEach(chip => {
                chip.addEventListener('click', (e) => {
                    // Remove active from all chips
                    chips.forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');

                    // Read app data
                    activeAppId = chip.dataset.app;
                    const appName = chip.querySelector('.app-name').textContent;

                    // Show configurator
                    title.textContent = `Limit for ${appName}`;
                    configPanel.classList.add('visible');

                    // Set active pill
                    const currentLimit = this.getLimit(activeAppId);
                    pills.forEach(pill => {
                        pill.classList.toggle('active', parseFloat(pill.dataset.limit) === currentLimit);
                    });

                    // Scroll it into view nicely
                    setTimeout(() => {
                        configPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 50);
                });
            });

            // Handle clicking a time limit pill in the configurator
            pills.forEach(pill => {
                pill.addEventListener('click', () => {
                    if (!activeAppId) return;

                    const limit = parseFloat(pill.dataset.limit);
                    this.setLimit(activeAppId, limit);

                    // Update UI visually
                    pills.forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');

                    // Update the chip to show the new state
                    this.syncChipsUI();
                });
            });

            // Close the configurator
            const closeBtn = $('configurator-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    chips.forEach(c => c.classList.remove('active'));
                    configPanel.classList.remove('visible');
                    activeAppId = null;
                });
            }

            // Initial Sync
            this.syncChipsUI();
        },

        syncChipsUI() {
            const limits = this._load();
            document.querySelectorAll('.app-chip').forEach(chip => {
                const appId = chip.dataset.app;
                const limit = limits[appId];
                const nameSpan = chip.querySelector('.app-name');
                const baseName = nameSpan.textContent.split(' (')[0]; // strip old limit if it exists

                if (limit) {
                    nameSpan.textContent = `${baseName} (${limit}m)`;
                    chip.classList.add('has-limit');
                } else {
                    nameSpan.textContent = baseName;
                    chip.classList.remove('has-limit');
                }
            });
        }
    };

    // ────────────────────────────────────
    //  SETTINGS PANEL
    // ────────────────────────────────────
    const Settings = {
        _overlay: $('settings-overlay'),

        open() {
            this._overlay.classList.add('active');
            this._syncUI();
            AppTimeLimits.initUI(); // Initialize pill click tracking and limits
        },

        close() {
            this._overlay.classList.remove('active');
            // Hide configurator if it was left open
            $('app-limit-configurator').classList.remove('visible');
            document.querySelectorAll('.app-chip').forEach(c => c.classList.remove('active'));
        },

        _syncUI() {
            try {
                // Toggle states
                const toggle = $('toggle-rescue');
                toggle.checked = DistractionRescue.enabled;

                const toggleGrayscale = $('toggle-grayscale');
                toggleGrayscale.checked = localStorage.getItem('unstuck_grayscale') === 'true';

                // Show/hide rescue options
                const opts = document.querySelectorAll('.rescue-options');
                opts.forEach(el => el.classList.toggle('visible', toggle.checked));

                // Delay pills (Global)
                const current = DistractionRescue.delayMinutes;
                document.querySelectorAll('#delay-pills .delay-pill').forEach(p => {
                    p.classList.toggle('active', parseFloat(p.dataset.delay) === current);
                });

                // Notification permission status
                this._updateNotifStatus();

                // Sync chip UI texts and limits
                AppTimeLimits.syncChipsUI();

            } catch (err) {
                const debugLog = document.createElement('div');
                debugLog.style = "position:fixed; top:10px; left:10px; background:red; color:white; padding:10px; z-index:9999;";
                debugLog.innerHTML = `syncUI ERROR:<br>${err.message}<br>${err.stack}`;
                document.body.appendChild(debugLog);
            }
        },

        _updateNotifStatus() {
            const btn = $('btn-notif-perm');
            const status = $('notif-status');

            if (!('Notification' in window)) {
                // Check if iOS
                const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                if (isIOS) {
                    status.textContent = 'Add to Home Screen first';
                    btn.textContent = 'iOS PWA only';
                    btn.classList.add('denied');

                    // Add hint if not already there
                    const section = $('rescue-notif-section');
                    if (!section.querySelector('.ios-hint')) {
                        const hint = document.createElement('p');
                        hint.className = 'ios-hint';
                        hint.textContent = '📱 On iPhone, tap Share → Add to Home Screen first. Notifications work in the installed app.';
                        section.appendChild(hint);
                    }
                } else {
                    status.textContent = 'Not supported in this browser';
                    btn.textContent = 'Unavailable';
                    btn.classList.add('denied');
                }
                return;
            }

            const perm = Notification.permission;
            if (perm === 'granted') {
                status.textContent = 'Enabled ✓';
                btn.textContent = 'Granted';
                btn.classList.add('granted');
                btn.classList.remove('denied');
            } else if (perm === 'denied') {
                status.textContent = 'Blocked — enable in browser settings';
                btn.textContent = 'Blocked';
                btn.classList.add('denied');
                btn.classList.remove('granted');
            } else {
                status.textContent = 'Permission needed';
                btn.textContent = 'Enable';
                btn.classList.remove('granted', 'denied');
            }
        }
    };

    // Settings event bindings
    $('btn-settings').addEventListener('click', () => Settings.open());
    $('settings-close').addEventListener('click', () => Settings.close());
    $('settings-overlay').addEventListener('click', (e) => {
        if (e.target === $('settings-overlay')) Settings.close();
    });

    $('toggle-rescue').addEventListener('change', async (e) => {
        // Intercept native iOS toggle to ask for Screen Time permissions
        if (e.target.checked && window.Capacitor && window.Capacitor.platform === 'ios') {
            try {
                // We use plugins over the window.Capacitor bridging boundary dynamically
                const { ScreenTimePlugin } = window.Capacitor.Plugins;
                if (ScreenTimePlugin) {
                    const result = await ScreenTimePlugin.requestAuthorization();
                    console.log("[Native Bridge] Screen Time Auth:", result);
                }
            } catch (err) {
                console.error("[Native Bridge] Screen Time Auth Failed:", err);
                // Depending on the UX, you could force the toggle back off here
            }
        }

        DistractionRescue.toggle(e.target.checked);
        Settings._syncUI();
    });

    $('toggle-grayscale').addEventListener('change', (e) => {
        const enabled = e.target.checked;
        localStorage.setItem('unstuck_grayscale', enabled);
        if (enabled) {
            document.documentElement.setAttribute('data-grayscale', 'true');
        } else {
            document.documentElement.removeAttribute('data-grayscale');
        }
    });

    document.querySelectorAll('.delay-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            DistractionRescue.setDelay(parseFloat(pill.dataset.delay));
            Settings._syncUI();
        });
    });

    $('btn-notif-perm').addEventListener('click', async () => {
        if (!('Notification' in window)) return;
        if (Notification.permission !== 'default') return;
        await Notification.requestPermission();
        Settings._updateNotifStatus();
    });

    // ────────────────────────────────────
    //  DAILY SUMMARY
    // ────────────────────────────────────
    const DailySummary = {
        _overlay: $('summary-overlay'),
        _body: $('summary-body'),
        _remaining: $('summary-remaining'),
        _checkBtn: $('btn-summary-check'),

        open() {
            const today = Vault.getTodayCompleted();
            this._body.innerHTML = '';
            this._remaining.innerHTML = '';

            // Reset animation wrapper states
            const wrapper = $('summary-remaining-wrapper');
            wrapper.classList.remove('expanded');
            this._remaining.classList.remove('has-content');

            this._checkBtn.style.display = '';

            if (today.length === 0) {
                this._body.innerHTML = '<div class="summary-empty">Nothing completed yet today.<br>You\'ve got this! 💪</div>';
            } else {
                today.forEach(item => {
                    const el = document.createElement('div');
                    el.className = 'summary-item';
                    el.innerHTML = `<span class="summary-check">✓</span><span class="summary-item-text">${item.text}</span>`;
                    this._body.appendChild(el);
                });
            }

            this._overlay.classList.add('active');
        },

        showRemaining() {
            this._remaining.innerHTML = '';
            const tasks = Vault.getAllTasks();

            if (tasks.length === 0) {
                this._remaining.innerHTML = '<div class="summary-empty">No tasks in the vault. You\'re all caught up! 🎉</div>';
            } else {
                const label = document.createElement('p');
                label.className = 'summary-section-label';
                label.textContent = `${tasks.length} task${tasks.length !== 1 ? 's' : ''} remaining`;
                this._remaining.appendChild(label);

                tasks.forEach(task => {
                    const el = document.createElement('div');
                    el.className = 'remaining-task-item';
                    el.innerHTML = `<span class="remaining-task-dot"></span><span class="remaining-task-text">${task.text}</span>`;
                    el.addEventListener('click', () => {
                        this.close();
                        // Open the reveal screen with this specific task
                        currentTask = task;
                        goTo('reveal');
                        const card = $('reveal-card');
                        const actions = document.querySelector('.reveal-actions');
                        card.innerHTML = `<p class="reveal-task-text" id="reveal-task-text"></p>`;
                        $('reveal-task-text').textContent = task.text;
                        actions.style.display = '';
                        card.style.animation = 'none';
                        card.offsetHeight;
                        card.style.animation = '';
                        actions.style.animation = 'none';
                        actions.offsetHeight;
                        actions.style.animation = '';
                        Nudge.start();
                    });
                    this._remaining.appendChild(el);
                });
            }

            // Trigger animation
            this._remaining.classList.add('has-content');
            const wrapper = $('summary-remaining-wrapper');
            wrapper.classList.add('expanded');

            this._checkBtn.style.display = 'none';
        },

        close() {
            this._overlay.classList.remove('active');
        }
    };

    $('btn-summary').addEventListener('click', () => DailySummary.open());
    $('summary-close').addEventListener('click', () => DailySummary.close());
    $('summary-overlay').addEventListener('click', (e) => {
        if (e.target === $('summary-overlay')) DailySummary.close();
    });
    $('btn-summary-check').addEventListener('click', () => {
        DailySummary.showRemaining();
    });

    // ────────────────────────────────────
    //  COLOR THEME
    // ────────────────────────────────────
    const ColorTheme = {
        _key: 'unstuck_theme',

        init() {
            const saved = localStorage.getItem(this._key);
            if (saved && saved !== 'default') {
                document.documentElement.setAttribute('data-theme', saved);
            }
            this._syncSwatches();
        },

        set(theme) {
            if (theme === 'default') {
                document.documentElement.removeAttribute('data-theme');
            } else {
                document.documentElement.setAttribute('data-theme', theme);
            }
            localStorage.setItem(this._key, theme);
            this._syncSwatches();
        },

        _syncSwatches() {
            const current = localStorage.getItem(this._key) || 'default';
            document.querySelectorAll('.color-swatch').forEach(sw => {
                sw.classList.toggle('active', sw.dataset.theme === current);
            });
        }
    };

    document.querySelectorAll('.color-swatch').forEach(sw => {
        sw.addEventListener('click', () => ColorTheme.set(sw.dataset.theme));
    });

    // ────────────────────────────────────
    //  INIT
    // ────────────────────────────────────
    if (localStorage.getItem('unstuck_grayscale') === 'true') {
        document.documentElement.setAttribute('data-grayscale', 'true');
    }

    updateSlate();
    DistractionRescue.init();
    LivingOrb.init();
    ColorTheme.init();

    // Delete old words.js data from localStorage if present
    try {
        localStorage.removeItem('lexicon_favorites');
        localStorage.removeItem('lexicon_history');
    } catch (e) { }

})();

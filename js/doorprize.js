/**
 * Doorprize Live Draw Logic
 * For physical coupon drawing system
 * Supports: API sync (production) + localStorage/BroadcastChannel (localhost)
 */

// Configuration
let doorprizeConfig = {
  enabled: true,
  coupons: [],
  winners: [],
  drawnNumbers: []
};

let currentDrawState = null;
let syncInterval = null;
let broadcastChannel = null;

// Storage keys
const STORAGE_KEY = 'hastma_doorprize_config';
const DRAW_STATE_KEY = 'hastma_doorprize_draw_state';
const WINNERS_KEY = 'hastma_doorprize_winners';

document.addEventListener('DOMContentLoaded', () => {
  initBroadcastChannel();
  initLiveDraw();
  startSync();
});

/**
 * Initialize BroadcastChannel for cross-tab sync (localhost)
 */
function initBroadcastChannel() {
  if ('BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel('hastma_doorprize');
    broadcastChannel.onmessage = (event) => {
      const { type, data } = event.data;
      console.log('Broadcast received:', type, data);
      if (type === 'draw_state') {
        currentDrawState = data;
        handleDrawState(data);
      } else if (type === 'config_update') {
        doorprizeConfig = data;
        updateStats();
        renderWinners();
      }
    };
  }
}

/**
 * Broadcast update to other tabs
 */
function broadcastUpdate(type, data) {
  if (broadcastChannel) {
    broadcastChannel.postMessage({ type, data });
  }
  // Also update localStorage for persistence
  if (type === 'draw_state') {
    localStorage.setItem(DRAW_STATE_KEY, JSON.stringify(data));
  }
}

/**
 * Initialize live draw page
 */
async function initLiveDraw() {
  await loadConfig();
  updateStats();
  renderWinners();
  
  // Check for existing draw state in localStorage
  const savedState = localStorage.getItem(DRAW_STATE_KEY);
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      // Only use if it's recent (within last 5 minutes)
      if (Date.now() - new Date(state.timestamp).getTime() < 300000) {
        handleDrawState(state);
      }
    } catch (e) {
      console.log('Invalid saved state');
    }
  }
}

/**
 * Load config from API or localStorage
 */
async function loadConfig() {
  // Try API first
  try {
    const response = await fetch('/api/tournament');
    const data = await response.json();
    
    if (data && data.doorprize) {
      doorprizeConfig = { ...doorprizeConfig, ...data.doorprize };
      // Save to localStorage for offline use
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doorprizeConfig));
      updateConnectionStatus(true);
      return;
    }
  } catch (e) {
    console.log('API not available, using localStorage');
  }
  
  // Fallback to localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      doorprizeConfig = JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing config:', e);
    }
  }
  
  // Show as connected even in localhost mode (using localStorage sync)
  updateConnectionStatus(true, 'local');
}

/**
 * Start syncing with server or localStorage
 */
function startSync() {
  // Sync immediately
  syncWithServer();
  
  // Then every 500ms (very fast for real-time sync)
  syncInterval = setInterval(syncWithServer, 500);
  
  // Handle visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(syncInterval);
    } else {
      syncWithServer();
      syncInterval = setInterval(syncWithServer, 500);
    }
  });
  
  // Listen for storage changes (from other tabs) - immediate
  window.addEventListener('storage', (e) => {
    if (e.key === DRAW_STATE_KEY) {
      try {
        const state = JSON.parse(e.newValue);
        if (JSON.stringify(state) !== JSON.stringify(currentDrawState)) {
          handleDrawState(state);
        }
      } catch (err) {
        console.log('Storage update error');
      }
    }
    if (e.key === STORAGE_KEY) {
      try {
        doorprizeConfig = JSON.parse(e.newValue);
        updateStats();
        renderWinners();
      } catch (err) {
        console.log('Config update error');
      }
    }
  });
}

/**
 * Sync with server or localStorage
 */
async function syncWithServer() {
  // Try API first
  try {
    const response = await fetch('/api/tournament');
    const data = await response.json();
    
    // Update config
    if (data && data.doorprize) {
      if (JSON.stringify(data.doorprize) !== JSON.stringify(doorprizeConfig)) {
        doorprizeConfig = { ...doorprizeConfig, ...data.doorprize };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(doorprizeConfig));
        updateStats();
        renderWinners();
      }
    }
    
    // Handle draw state from API
    if (data && data.doorprizeDraw) {
      if (JSON.stringify(data.doorprizeDraw) !== JSON.stringify(currentDrawState)) {
        currentDrawState = data.doorprizeDraw;
        localStorage.setItem(DRAW_STATE_KEY, JSON.stringify(currentDrawState));
        handleDrawState(currentDrawState);
      }
    }
    
    updateConnectionStatus(true);
    return;
  } catch (e) {
    // API not available, use localStorage
  }
  
  // Fallback: Check localStorage for updates (localhost mode)
  const savedState = localStorage.getItem(DRAW_STATE_KEY);
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      if (JSON.stringify(state) !== JSON.stringify(currentDrawState)) {
        currentDrawState = state;
        handleDrawState(state);
      }
    } catch (e) {
      console.log('Error reading local state');
    }
  }
  
  // Also check config
  const savedConfig = localStorage.getItem(STORAGE_KEY);
  if (savedConfig) {
    try {
      const config = JSON.parse(savedConfig);
      if (JSON.stringify(config.coupons) !== JSON.stringify(doorprizeConfig.coupons)) {
        doorprizeConfig = config;
        updateStats();
        renderWinners();
      }
    } catch (e) {
      console.log('Error reading local config');
    }
  }
  
  // Show as connected in local mode
  updateConnectionStatus(true, 'local');
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected, mode = 'api') {
  const statusEl = document.getElementById('connectionStatus');
  if (statusEl) {
    if (connected) {
      if (mode === 'local') {
        statusEl.innerHTML = '<span class="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span> Local';
        statusEl.className = 'flex items-center gap-2 text-xs text-blue-400';
      } else {
        statusEl.innerHTML = '<span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Live';
        statusEl.className = 'flex items-center gap-2 text-xs text-green-400';
      }
    } else {
      statusEl.innerHTML = '<span class="w-2 h-2 bg-red-500 rounded-full"></span> Offline';
      statusEl.className = 'flex items-center gap-2 text-xs text-red-400';
    }
  }
}

/**
 * Handle draw state from server or localStorage
 */
function handleDrawState(state) {
  if (!state) return;
  
  console.log('Handling draw state:', state.status, state);
  
  const { status, startAt, revealAt, winners, winner, prizeName } = state;
  const now = Date.now();
  
  // Support both single winner and multiple winners
  const winnerList = winners || (winner ? [winner] : []);
  
  switch (status) {
    case 'waiting':
      showWaitingState();
      break;
      
    case 'countdown':
      // Check if we should show countdown or reveal
      // Add 2 second tolerance for clock differences between devices
      const tolerance = 2000; 
      
      if (now < startAt - tolerance) {
        // Before countdown starts - waiting state
        showWaitingState('Bersiap untuk undian...');
      } else if (now < revealAt + tolerance) {
        // During countdown - show countdown (even if slightly late)
        showCountdownState(state);
      } else {
        // After reveal time - show winners
        showMultipleWinners(winnerList, prizeName);
      }
      break;
      
    case 'spinning':
      showSpinningState();
      break;
      
    case 'revealed':
      showMultipleWinners(winnerList, prizeName);
      break;
  }
  
  // Update winners list if provided
  if (state.allWinners || state.winners) {
    doorprizeConfig.winners = state.allWinners || state.winners;
    renderWinners();
  }
  
  // Update stats
  updateStats();
}

/**
 * Show waiting state
 */
function showWaitingState(message) {
  hideAllStates();
  const waitingEl = document.getElementById('waitingState');
  waitingEl.classList.remove('hidden');
  
  if (message) {
    const msgEl = waitingEl.querySelector('h3');
    if (msgEl) msgEl.textContent = message;
  }
}

/**
 * Show countdown state
 */
function showCountdownState(state) {
  hideAllStates();
  const countdownState = document.getElementById('countdownState');
  countdownState.classList.remove('hidden');
  
  const winnerCount = state.winnerCount || 1;
  const winnerText = winnerCount > 1 ? `${winnerCount} PEMENANG` : '1 PEMENANG';
  
  document.getElementById('countdownPrizeName').innerHTML = 
    `<span style="font-size: 1.25rem; letter-spacing: 0.1em;">${winnerText}</span>`;
  
  // Calculate remaining duration
  const now = Date.now();
  const revealAt = state.revealAt;
  const originalDuration = state.duration || 5;
  const remainingTime = Math.max(1, Math.ceil((revealAt - now) / 1000));
  
  // Start countdown animation with correct remaining time
  startCountdownAnimation(revealAt, originalDuration, remainingTime);
}

/**
 * Start countdown animation
 */
let countdownInterval = null;
function startCountdownAnimation(revealAt, originalDuration, remainingSeconds) {
  // Clear any existing interval
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  const countdownEl = document.getElementById('countdownNumber');
  const progressEl = document.getElementById('countdownProgress');
  
  // Calculate start time for progress bar
  const totalDurationMs = originalDuration * 1000;
  const remainingMs = remainingSeconds * 1000;
  const elapsedMs = totalDurationMs - remainingMs;
  
  const updateCountdown = () => {
    const now = Date.now();
    const remaining = Math.ceil((revealAt - now) / 1000);
    const currentElapsed = totalDurationMs - (revealAt - now);
    const progress = Math.max(0, Math.min(100, (currentElapsed / totalDurationMs) * 100));
    
    if (remaining > 0) {
      countdownEl.textContent = remaining;
      if (progressEl) progressEl.style.width = `${progress}%`;
    } else {
      countdownEl.textContent = '0';
      if (progressEl) progressEl.style.width = '100%';
      clearInterval(countdownInterval);
      countdownInterval = null;
      
      // Small delay then show winners
      setTimeout(() => {
        const state = currentDrawState;
        if (state && state.status === 'countdown') {
          const winnerList = state.winners || (state.winner ? [state.winner] : []);
          showMultipleWinners(winnerList, state.prizeName);
        }
      }, 500);
    }
  };
  
  // Initial update
  updateCountdown();
  
  // Start interval
  countdownInterval = setInterval(updateCountdown, 100);
}

/**
 * Show spinning state (random numbers)
 */
let spinInterval = null;
function showSpinningState() {
  hideAllStates();
  document.getElementById('spinningState').classList.remove('hidden');
  
  const spinningEl = document.getElementById('spinningNumber');
  
  // Clear existing
  if (spinInterval) clearInterval(spinInterval);
  
  // Animate random numbers
  spinInterval = setInterval(() => {
    const randomNum = generateRandomDisplayNumber();
    spinningEl.textContent = randomNum;
  }, 100);
  
  // Stop after 2 seconds
  setTimeout(() => {
    clearInterval(spinInterval);
  }, 2000);
}

/**
 * Generate random number for display
 */
function generateRandomDisplayNumber() {
  const config = doorprizeConfig;
  if (config.coupons && config.coupons.length > 0) {
    const idx = Math.floor(Math.random() * config.coupons.length);
    return config.coupons[idx];
  }
  // Fallback - angka saja tanpa prefix
  return String(Math.floor(Math.random() * 999)).padStart(3, '0');
}

/**
 * Show multiple winners
 */
function showMultipleWinners(winners, prizeName) {
  hideAllStates();
  
  // Clear countdown interval if running
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  
  const winnerList = Array.isArray(winners) ? winners : [winners];
  const isMultiple = winnerList.length > 1;
  
  // Get or create winners container
  let container = document.getElementById('winnersDisplay');
  if (!container) {
    // Create new display for multiple winners
    const winnerState = document.getElementById('winnerState');
    winnerState.innerHTML = `
      <div class="text-green-400 text-2xl mb-4 font-bold animate-bounce">🎉 PEMENANG 🎉</div>
      <div id="winnersDisplay" class="flex flex-wrap justify-center gap-4 mb-4"></div>
      <div class="text-yellow-400 text-xl mt-4 font-bold" id="winnerPrizeDisplay"></div>
      <div class="mt-6 text-gray-300 text-sm">
        Jika nomor Anda ada di atas, segera hubungi panitia!
      </div>
      <button onclick="closeDrawOverlay()" class="mt-8 px-6 py-3 bg-white/10 rounded-full text-white hover:bg-white/20 transition">
        Tutup
      </button>
    `;
    container = document.getElementById('winnersDisplay');
  }
  
  // Display winners
  container.innerHTML = winnerList.map((winner, i) => `
    <div class="bg-green-500/20 border-2 border-green-500 rounded-xl p-4 text-center animate-pulse" style="animation-delay: ${i * 0.1}s;">
      ${isMultiple ? `<div class="text-xs text-green-400 mb-1">#${i + 1}</div>` : ''}
      <div class="text-4xl md:text-6xl font-black text-white font-mono" style="text-shadow: 0 0 30px rgba(16,185,129,0.8);">${winner}</div>
    </div>
  `).join('');
  
  // Hide prize name display (not used)
  const prizeDisplay = document.getElementById('winnerPrizeDisplay');
  if (prizeDisplay) {
    prizeDisplay.style.display = 'none';
  }
  
  // Show the state
  document.getElementById('winnerState').classList.remove('hidden');
  
  // Trigger confetti
  fireConfetti();
  
  // Play sound
  playWinSound();
  
  // Manual close - user must click close button
}

/**
 * Show winner state (backward compatibility)
 */
function showWinnerState(winner, prizeName) {
  showMultipleWinners([winner], prizeName);
}

/**
 * Hide all states
 */
function hideAllStates() {
  document.getElementById('waitingState').classList.add('hidden');
  document.getElementById('countdownState').classList.add('hidden');
  document.getElementById('winnerState').classList.add('hidden');
  document.getElementById('spinningState').classList.add('hidden');
}

/**
 * Update statistics display
 */
function updateStats() {
  const config = doorprizeConfig;
  const total = config.coupons ? config.coupons.length : 0;
  const winners = config.winners || [];
  const drawn = winners.length;
  const remaining = total - drawn;
  
  document.getElementById('totalCoupons').textContent = total;
  document.getElementById('drawnCount').textContent = drawn;
  document.getElementById('remainingCount').textContent = Math.max(0, remaining);
}

/**
 * Render winners list
 */
function renderWinners() {
  const container = document.getElementById('winnersList');
  const winners = doorprizeConfig.winners || [];
  
  if (winners.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-4">Belum ada pemenang</p>';
    return;
  }
  
  // Group winners by draw session (within 5 minutes)
  const grouped = [];
  let currentGroup = [];
  
  winners.forEach((w, i) => {
    if (i === 0) {
      currentGroup.push(w);
    } else {
      const prevTime = new Date(winners[i - 1].timestamp).getTime();
      const currTime = new Date(w.timestamp).getTime();
      if (currTime - prevTime < 300000) { // 5 minutes
        currentGroup.push(w);
      } else {
        grouped.push([...currentGroup]);
        currentGroup = [w];
      }
    }
  });
  if (currentGroup.length > 0) {
    grouped.push(currentGroup);
  }
  
  // Render grouped winners
  container.innerHTML = grouped.slice().reverse().map((group, groupIdx) => {
    const isMulti = group.length > 1;
    const groupTime = formatTime(group[0].timestamp);
    const prizeName = group[0].prize;
    
    return `
      <div class="mb-4 bg-white/5 rounded-xl p-4 border border-white/10">
        <div class="mb-3 pb-2 border-b border-white/10">
          <div class="text-xs text-gray-400">${groupTime}</div>
        </div>
        <div class="flex flex-wrap gap-2">
          ${group.filter(w => w && (w.number || typeof w === 'string')).map(w => `
            <div class="bg-green-500/20 border border-green-500/40 rounded-lg px-3 py-2">
              <span class="font-mono font-bold text-white">${w.number || w}</span>
            </div>
          `).join('')}
        </div>
        ${isMulti ? `<div class="text-xs text-green-400 mt-2">${group.length} pemenang sekaligus</div>` : ''}
      </div>
    `;
  }).join('');
}

/**
 * Format timestamp
 */
function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Check my ticket
 */
/**
 * Fire confetti
 */
function fireConfetti() {
  const count = 200;
  const defaults = { origin: { y: 0.7 } };
  
  function fire(particleRatio, opts) {
    confetti(Object.assign({}, defaults, opts, {
      particleCount: Math.floor(count * particleRatio)
    }));
  }
  
  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}

/**
 * Play win sound
 */
function playWinSound() {
  try {
    const audio = new Audio('goal sound effect.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore autoplay errors
    });
  } catch (e) {
    // Audio not available
  }
}

// Expose check function globally


/**
 * HASTMA CUP #3 2026 - Admin Panel Logic
 * Modern UI version matching reference design
 * Handles login, score editing, schedule editing, event logging,
 * player management, team colors, and export/import functionality
 */

// Global state
let tournamentData = null;
let isLoggedIn = false;
let currentSession = null;
let currentMatchId = null;
let activeAdminSection = 'dashboard'; // Track current active tab for selective rendering

// ================================================
// Authentication
// ================================================

/**
 * Check if user is logged in
 */
function checkAuth() {
  const session = localStorage.getItem('hastmaAdminSession');
  if (session) {
    try {
      const sessionData = JSON.parse(session);
      const now = new Date().getTime();

      if (sessionData.expiry > now) {
        isLoggedIn = true;
        currentSession = sessionData;
        showAdminPanel();
        return;
      }
    } catch (e) {
      // Invalid session
    }
  }

  // Show login modal
  showLoginModal();
}

/**
 * Handle login form submission
 */
function handleLogin(event) {
  event.preventDefault();

  const password = document.getElementById('loginPassword').value;

  if (password === ADMIN_CONFIG.password) {
    // Create session
    const sessionData = {
      loginTime: new Date().getTime(),
      expiry: new Date().getTime() + ADMIN_CONFIG.sessionTimeout
    };

    localStorage.setItem('hastmaAdminSession', JSON.stringify(sessionData));
    isLoggedIn = true;
    currentSession = sessionData;

    hideLoginModal();
    showAdminPanel();
    showToast('Login successful!', 'success');

    // Clear password field
    document.getElementById('loginPassword').value = '';
  } else {
    showToast('Incorrect password!', 'error');
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginPassword').focus();
  }
}

/**
 * Show login modal
 */
function showLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
  document.getElementById('loginModal').style.display = 'flex';
}

/**
 * Hide login modal
 */
function hideLoginModal() {
  document.getElementById('loginModal').style.display = 'none';
}

/**
 * Show admin panel
 */
async function showAdminPanel() {
  hideLoginModal();
  // loadData already handles fetching from Cloud + LocalStorage fallback
  await loadData();
  loadAllAdminData();
}

/**
 * Switch between admin sections
 */
function switchSection(eventOrSection, element) {
  let sectionId;
  let clickedElement;

  if (typeof eventOrSection === 'string') {
    sectionId = eventOrSection;
    clickedElement = element;
  } else {
    eventOrSection.preventDefault();
    sectionId = eventOrSection.currentTarget.getAttribute('data-section') || eventOrSection.currentTarget.textContent.trim().toLowerCase();
    clickedElement = eventOrSection.currentTarget;
  }

  activeAdminSection = sectionId; // Update global tracking

  // Update nav links
  document.querySelectorAll('.admin-nav a, .admin-nav-item, .nav-link, .fab-action-btn').forEach(link => {
    link.classList.remove('active');
  });
  if (clickedElement) clickedElement.classList.add('active');

  // Update sections
  document.querySelectorAll('.admin-section').forEach(section => {
    section.classList.remove('active');
  });

  const targetSection = document.getElementById(`section-${sectionId}`);
  if (targetSection) {
    targetSection.classList.add('active');
    // Lazy render when switching
    refreshActiveSection();
  } else {
    console.error(`Section section-${sectionId} not found`);
  }
}

// ================================================
// Data Management (Vercel KV Integration)
// ================================================

// API Endpoint
const API_URL = '/api/tournament';

/**
 * Load data from Vercel KV (Database)
 */
async function loadData() {
  try {
    console.log('Fetching data from Vercel KV...');
    const res = await fetch(API_URL);
    console.log('KV Response Status:', res.status);

    if (!res.ok) throw new Error(`API Error ${res.status}`);

    const cloudData = await res.json();
    console.log('KV Data Received:', cloudData ? 'Yes' : 'Null');

    if (cloudData && cloudData.teams && cloudData.teams.length > 0) {
      tournamentData = cloudData;
      console.log('✅ Loaded VALID data from Vercel KV');
    } else {
      console.warn('⚠️ KV returned empty/null data! Falling back to defaults.');
      // Only overwrite if we really have nothing
      if (!tournamentData) {
        tournamentData = { ...DEFAULT_TOURNAMENT_DATA };
        saveData();
      }
    }
  } catch (err) {
    console.error('❌ API Error, using LocalStorage/Default', err);
    // Fallback logic
    const local = localStorage.getItem('hastmaCupData');
    if (local) {
      console.log('Reverting to LocalStorage backup');
      tournamentData = JSON.parse(local);
    } else {
      console.log('Reverting to Hardcoded Defaults');
      tournamentData = { ...DEFAULT_TOURNAMENT_DATA };
    }
  }
}

/**
 * Save data to Vercel KV & LocalStorage
 */
async function saveData() {
  if (!tournamentData.metadata) tournamentData.metadata = {};
  tournamentData.metadata.lastUpdated = new Date().toISOString();

  // 1. Local Backup
  localStorage.setItem('hastmaCupData', JSON.stringify(tournamentData));

  // 2. Cloud Sync
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tournamentData)
    });
    console.log('✅ Saved to Vercel KV');
  } catch (err) {
    console.error('❌ Save Failed', err);
  }
}

/**
 * Get team by ID
 */
function getTeam(teamId) {
  if (!teamId) return null;
  return tournamentData.teams.find(t => t.id === teamId) || null;
}

/**
 * Get match by ID
 */
function getMatch(matchId) {
  return tournamentData.matches.find(m => m.id === matchId) || null;
}

/**
 * Auto-calculate end time (+25 mins)
 */
function autoCalculateEndTime(startTime) {
  if (!startTime) return '';
  const [hours, minutes] = startTime.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes + 25);
  return date.toTimeString().slice(0, 5);
}

// ================================================
// Load All Admin Data
// ================================================

/**
 * Load all admin sections data - Optimized for performance
 */
function loadAllAdminData() {
  // Check if data is stale
  if (tournamentData.matches && tournamentData.matches[0].time === '08:00') {
    console.log('Detected old default data, resetting to new schedule...');
    resetData();
  }

  updateLastUpdated();

  // Always update global selectors/dropdowns (relatively cheap)
  loadMatchSelector();
  loadPlayerTeamSelector();
  loadScheduleTeamSelectors();

  // ONLY render the section the user is actually looking at
  refreshActiveSection();
}

/**
 * Helper to only render what's visible
 */
function refreshActiveSection() {
  console.log(`Refreshing active section: ${activeAdminSection}`);

  switch (activeAdminSection) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'schedule':
      renderAdminSchedule();
      break;
    case 'results':
      renderAdminResults();
      break;
    case 'players':
      // loadPlayerTeamSelector already called
      break;
    case 'teams':
      loadTeamColors();
      break;
    case 'logs':
      renderAuditLogs();
      break;
  }

  // Always refresh active match editor if it's currently showing in match config
  if (activeAdminSection === 'match-config' && currentMatchId) {
    const match = getMatch(currentMatchId);
    if (match) {
      const hDisp = document.getElementById('homeScoreDisplay');
      const aDisp = document.getElementById('awayScoreDisplay');
      if (hDisp) hDisp.textContent = match.homeScore;
      if (aDisp) aDisp.textContent = match.awayScore;
      loadMatchEvents(match);
    }
  }
}

// ================================================
// Match Selection & Editing
// ================================================

/**
 * Load match selector dropdown
 */
function loadMatchSelector() {
  const selector = document.getElementById('matchSelector');
  if (!selector) return;

  selector.innerHTML = '<option value="">-- Select a Match --</option>' +
    tournamentData.matches.map(match => {
      const homeTeam = getTeam(match.homeTeam);
      const awayTeam = getTeam(match.awayTeam);
      const homeName = homeTeam ? homeTeam.name : 'TBD';
      const awayName = awayTeam ? awayTeam.name : 'TBD';

      const stageLabel = getStageLabel(match);
      let prefix = '';
      if (match.status === 'live') prefix = '🔴 [LIVE] ';
      if (match.status === 'halftime') prefix = '⏸️ [HT] ';
      if (match.status === 'finished') prefix = '✅ [FIN] ';

      return `<option value="${match.id}">${prefix}${stageLabel}: ${homeName} vs ${awayName} (${match.time})</option>`;
    }).join('');

  // Preserve selection if it exists
  if (currentMatchId) {
    selector.value = currentMatchId;
  }
}

/**
 * Load team selectors for schedule form
 */
function loadScheduleTeamSelectors() {
  const homeSelect = document.getElementById('scheduleHomeTeam');
  const awaySelect = document.getElementById('scheduleAwayTeam');

  if (!homeSelect || !awaySelect) return;

  const options = '<option value="">-- TBD --</option>' +
    tournamentData.teams.map(team =>
      `<option value="${team.id}">${team.name}</option>`
    ).join('');

  homeSelect.innerHTML = options;
  awaySelect.innerHTML = options;
}

/**
 * Helper to get stage label
 */
function getStageLabel(match) {
  return match.stage === 'group' ? `Group ${match.group}` :
    match.stage === 'semi' ? 'Semi Final' :
      match.stage === 'final' ? 'Final' :
        match.stage === '3rd_place' ? '3rd Place' : match.stage;
}

/**
 * Render match list for schedule management
 */
function renderAdminSchedule() {
  const container = document.getElementById('adminScheduleList');
  if (!container) return;

  const sortedMatches = [...tournamentData.matches].sort((a, b) => a.time.localeCompare(b.time));

  container.innerHTML = sortedMatches.map(match => {
    const homeTeam = getTeam(match.homeTeam);
    const awayTeam = getTeam(match.awayTeam);
    const homeName = homeTeam ? homeTeam.name : 'TBD';
    const awayName = awayTeam ? awayTeam.name : 'TBD';
    const isSelected = match.id === currentMatchId;

    return `
      <div class="admin-event-card ${isSelected ? 'selected' : ''} ${match.status === 'finished' ? 'finished' : ''}" onclick="selectMatchForEdit('${match.id}')">
        <div class="admin-event-card-info">
          <p class="admin-event-teams">${homeName} vs ${awayName}</p>
          <div class="admin-event-meta">
            <span class="match-status-badge ${match.status}">${match.status}</span>
            <span class="text-secondary" style="font-size: 0.75rem;">
              <span class="material-symbols-outlined" style="font-size: 1rem; vertical-align: middle;">event</span>
              ${getStageLabel(match)} 
              <span class="material-symbols-outlined" style="font-size: 1rem; vertical-align: middle; margin-left: 0.5rem;">schedule</span>
              ${match.time}${match.endTime ? ' - ' + match.endTime : ''}
              <span class="material-symbols-outlined" style="font-size: 1rem; vertical-align: middle; margin-left: 0.5rem;">location_on</span>
              ${match.venue || 'TBD'}
            </span>
          </div>
        </div>
        <div class="material-symbols-outlined admin-event-arrow" style="color: var(--admin-primary); opacity: ${isSelected ? 1 : 0.3}; transition: 0.2s;">
          ${isSelected ? 'radio_button_checked' : 'chevron_right'}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Select a match for editing from the list
 */
function selectMatchForEdit(matchId) {
  const selector = document.getElementById('matchSelector');
  if (selector) {
    selector.value = matchId;
    loadMatchForEdit();
  }
}

/**
 * Load match for editing
 */
function loadMatchForEdit() {
  const matchId = document.getElementById('matchSelector').value;
  if (!matchId) {
    resetMatchForm();
    return;
  }

  currentMatchId = matchId;
  const match = getMatch(matchId);
  if (!match) return;

  const homeTeam = getTeam(match.homeTeam);
  const awayTeam = getTeam(match.awayTeam);

  // Update title
  document.getElementById('matchTitle').textContent =
    `${homeTeam?.name || 'TBD'} vs ${awayTeam?.name || 'TBD'}`;

  // Update labels
  document.getElementById('homeTeamLabel').textContent = homeTeam?.name || 'Home';
  document.getElementById('awayTeamLabel').textContent = awayTeam?.name || 'Away';

  // Update scores
  document.getElementById('homeScoreDisplay').textContent = match.homeScore;
  document.getElementById('awayScoreDisplay').textContent = match.awayScore;

  // Update details
  const statusSelect = document.getElementById('matchStatus');
  // If status is 'finished' or 'halftime' and option is missing, we might need to handle it.
  // User wants them gone from dropdown.
  // Logic: 
  // If match is finished, maybe show it as text or disable dropdown?
  // If match is halftime, maybe show as "Live" in dropdown but keep internal status?
  // Let's keep it simple: if 'finished', we add the option temporarily so it displays correctly.

  if (match.status === 'finished') {
    if (!statusSelect.querySelector('option[value="finished"]')) {
      const opt = document.createElement('option');
      opt.value = 'finished';
      opt.text = 'Finished';
      statusSelect.add(opt);
    }
  } else if (match.status === 'halftime') {
    // User wanted halftime gone too. 
    if (!statusSelect.querySelector('option[value="halftime"]')) {
      // If currently halftime, we must show it or it defaults to scheduled.
      const opt = document.createElement('option');
      opt.value = 'halftime';
      opt.text = 'Half Time';
      statusSelect.add(opt);
    }
  }

  statusSelect.value = match.status;

  // Cleanup: if we switch AWAY from finished, remove the temp option? 
  // Probably not needed unless user manually changes it back to live.

  document.getElementById('scheduleMatchId').value = match.id;
  document.getElementById('scheduleMatchId').disabled = true;
  document.getElementById('scheduleStage').value = match.stage || 'group';
  document.getElementById('scheduleHomeTeam').value = match.homeTeam || '';
  document.getElementById('scheduleAwayTeam').value = match.awayTeam || '';
  document.getElementById('scheduleDate').value = match.date;
  document.getElementById('scheduleTime').value = match.time;
  document.getElementById('scheduleEndTime').value = match.endTime || '';
  document.getElementById('scheduleVenue').value = match.venue;

  // Show edit actions
  document.getElementById('scheduleEditActions').style.display = 'flex';
  document.getElementById('scheduleAddActions').style.display = 'none';

  // Update Event Registration UI state based on match status
  updateEventFormStatus(match.status);

  // Load events
  loadMatchEvents(match);

  // Toggle Finish Match button
  const finishControl = document.getElementById('finishMatchControl');
  if (finishControl) {
    finishControl.style.display = (match.status === 'live' || match.status === 'halftime') ? 'block' : 'none';
  }

  // Refresh list to show selection
  renderAdminSchedule();

  // Initialize/Reset the persistent event form
  initEventForm();
}

/**
 * Reset match form
 */
function resetMatchForm() {
  currentMatchId = null;

  const selector = document.getElementById('matchSelector');
  if (selector) selector.value = '';

  document.getElementById('matchTitle').textContent = 'Select a Match';
  document.getElementById('homeTeamLabel').textContent = 'Home';
  document.getElementById('awayTeamLabel').textContent = 'Away';
  document.getElementById('homeScoreDisplay').textContent = '0';
  document.getElementById('awayScoreDisplay').textContent = '0';
  document.getElementById('matchStatus').value = 'scheduled';

  // Reset schedule section too
  document.getElementById('scheduleMatchId').value = '';
  document.getElementById('scheduleMatchId').disabled = false;
  document.getElementById('scheduleStage').value = 'group';
  document.getElementById('scheduleHomeTeam').value = '';
  document.getElementById('scheduleAwayTeam').value = '';
  document.getElementById('scheduleDate').value = '';
  document.getElementById('scheduleTime').value = '';
  document.getElementById('scheduleEndTime').value = '';
  document.getElementById('scheduleVenue').value = '';

  // Show edit actions by default
  document.getElementById('scheduleEditActions').style.display = 'flex';
  document.getElementById('scheduleAddActions').style.display = 'none';
  document.getElementById('scheduleFormTitle').textContent = 'Match Configuration';

  renderAdminSchedule();
}

/**
 * Adjust score with +/- buttons
 */
function adjustScore(team, delta) {
  if (!currentMatchId) return;

  const match = getMatch(currentMatchId);
  if (!match) return;

  if (team === 'home') {
    match.homeScore = Math.max(0, match.homeScore + delta);
    document.getElementById('homeScoreDisplay').textContent = match.homeScore;
  } else {
    match.awayScore = Math.max(0, match.awayScore + delta);
    document.getElementById('awayScoreDisplay').textContent = match.awayScore;
  }

  saveData();
  renderAdminSchedule();
}

/**
 * Sync match status in real-time
 */
function syncMatchStatus() {
  if (!currentMatchId) return;

  const match = getMatch(currentMatchId);
  if (!match) return;

  const newStatus = document.getElementById('matchStatus').value;

  // Restriction: Only one live match at a time
  if ((newStatus === 'live' || newStatus === 'halftime') && checkLiveConflicts(currentMatchId)) {
    alert('Hanya satu pertandingan yang bisa LIVE dalam satu waktu. Selesaikan pertandingan sebelumnya terlebih dahulu.');
    document.getElementById('matchStatus').value = match.status; // Revert
    return;
  }

  match.status = newStatus;

  // Toggle Finish Match button
  const finishControl = document.getElementById('finishMatchControl');
  if (finishControl) {
    finishControl.style.display = (match.status === 'live' || match.status === 'halftime') ? 'block' : 'none';
  }

  saveData();
  addAuditLog(`Updated status of match ${currentMatchId} to ${newStatus}`);
  updateLastUpdated();
  renderAdminSchedule();
  renderAdminResults();
  updateEventFormStatus(newStatus);
  showToast('Match status synchronized!', 'success');
}

/**
 * Update Event Form visibility/state based on status
 */
function updateEventFormStatus(status) {
  const eventForm = document.getElementById('eventForm');
  const overlay = document.getElementById('eventFormLockOverlay');

  if (!eventForm) return;

  if (status === 'live' || status === 'halftime') {
    eventForm.style.opacity = '1';
    eventForm.style.pointerEvents = 'all';
    if (overlay) overlay.style.display = 'none';
  } else {
    eventForm.style.opacity = '0.5';
    eventForm.style.pointerEvents = 'none';
    if (overlay) overlay.style.display = 'flex';
  }
}

/**
 * Check if any other match is currently live
 */
function checkLiveConflicts(matchId) {
  return tournamentData.matches.some(m => (m.status === 'live' || m.status === 'halftime') && m.id !== matchId);
}

/**
 * Finish match with confirmation
 */
function finishMatch() {
  if (!currentMatchId) return;

  if (confirm('Anda yakin ingin menyelesaikan pertandingan ini? Hasil akhir akan disimpan secara permanen.')) {
    const match = getMatch(currentMatchId);
    if (!match) return;

    // Direct update without relying on dropdown
    match.status = 'finished';

    // Update dropdown if option exists, otherwise ignore
    const statusSelect = document.getElementById('matchStatus');
    if (statusSelect) {
      // Check if 'finished' option exists, if not add it temporarily so it shows up?
      // Or just let loadMatchForEdit handle it. 
      // Better to re-load to reflect new state
    }

    saveData();
    updateLastUpdated();

    // Auto-advance bracket logic
    checkAndAdvanceBracket();

    renderAdminSchedule();
    renderAdminResults();
    loadMatchForEdit(); // Reload to update UI state
    showToast('Match finished successfully!', 'success');
  }
}

// ================================================
// Bracket Automation
// ================================================

/**
 * Orchestrate automatic team advancement to knockout stages
 */
function checkAndAdvanceBracket() {
  const standingsA = calculateAdminStandings('A');
  const standingsB = calculateAdminStandings('B');

  const groupAFinished = isGroupFinished('A');
  const groupBFinished = isGroupFinished('B');

  let updated = false;

  // SF1: Winner A vs Runner-up B
  const sf1 = getMatch('SF1');
  if (sf1 && sf1.status === 'scheduled') {
    const winnerA = groupAFinished ? standingsA[0]?.team.id : null;
    const runnerupB = groupBFinished ? standingsB[1]?.team.id : null;

    if (winnerA && sf1.homeTeam !== winnerA) { sf1.homeTeam = winnerA; updated = true; }
    if (runnerupB && sf1.awayTeam !== runnerupB) { sf1.awayTeam = runnerupB; updated = true; }
  }

  // SF2: Winner B vs Runner-up A (matching index.html bracket)
  const sf2 = getMatch('SF2');
  if (sf2 && sf2.status === 'scheduled') {
    const winnerB = groupBFinished ? standingsB[0]?.team.id : null;
    const runnerupA = groupAFinished ? standingsA[1]?.team.id : null;

    if (runnerupA && sf2.homeTeam !== runnerupA) { sf2.homeTeam = runnerupA; updated = true; }
    if (winnerB && sf2.awayTeam !== winnerB) { sf2.awayTeam = winnerB; updated = true; }
  }

  // Final & 3rd Place: Winners/Losers of SF1 and SF2
  const sf1Finished = sf1 && sf1.status === 'finished';
  const sf2Finished = sf2 && sf2.status === 'finished';

  if (sf1Finished && sf2Finished) {
    const f1 = getMatch('F1');
    const m3rd = getMatch('M3RD');

    if (f1 && f1.status === 'scheduled') {
      const sf1Winner = sf1.homeScore > sf1.awayScore ? sf1.homeTeam : sf1.awayTeam;
      const sf2Winner = sf2.homeScore > sf2.awayScore ? sf2.homeTeam : sf2.awayTeam;

      if (sf1Winner && f1.homeTeam !== sf1Winner) { f1.homeTeam = sf1Winner; updated = true; }
      if (sf2Winner && f1.awayTeam !== sf2Winner) { f1.awayTeam = sf2Winner; updated = true; }
    }

    if (m3rd && m3rd.status === 'scheduled') {
      const sf1Loser = sf1.homeScore > sf1.awayScore ? sf1.awayTeam : sf1.homeTeam;
      const sf2Loser = sf2.homeScore > sf2.awayScore ? sf2.awayTeam : sf2.homeTeam;

      if (sf1Loser && m3rd.homeTeam !== sf1Loser) { m3rd.homeTeam = sf1Loser; updated = true; }
      if (sf2Loser && m3rd.awayTeam !== sf2Loser) { m3rd.awayTeam = sf2Loser; updated = true; }
    }
  }

  if (updated) {
    console.log('🏆 Bracket auto-updated with newly qualified teams!');
    saveData();
  }
}

/**
 * Helper to check if group is finished
 */
function isGroupFinished(group) {
  const groupMatches = tournamentData.matches.filter(m => m.stage === 'group' && m.group === group);
  return groupMatches.length > 0 && groupMatches.every(m => m.status === 'finished');
}

/**
 * Internal Admin Standings Logic (Copied from app.js)
 */
function calculateAdminStandings(group) {
  const groupTeams = tournamentData.teams.filter(t => t.group === group);
  const groupMatches = tournamentData.matches.filter(
    m => m.stage === 'group' && m.group === group && m.status === 'finished'
  );

  const standings = groupTeams.map(team => ({
    team: team,
    played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, points: 0, fairPlayPoints: 0
  }));

  groupMatches.forEach(match => {
    const homeTeam = standings.find(s => s.team.id === match.homeTeam);
    const awayTeam = standings.find(s => s.team.id === match.awayTeam);
    if (!homeTeam || !awayTeam) return;

    homeTeam.played++; awayTeam.played++;
    homeTeam.goalsFor += match.homeScore; homeTeam.goalsAgainst += match.awayScore;
    awayTeam.goalsFor += match.awayScore; awayTeam.goalsAgainst += match.homeScore;

    const events = match.events || [];
    for (const e of events) {
      if (!e || !e.teamId) continue;
      const teamRow = standings.find(s => s.team.id === e.teamId);
      if (teamRow) {
        if (e.type === 'yellow') teamRow.fairPlayPoints += 1;
        if (e.type === 'red') teamRow.fairPlayPoints += 2;
      }
    }

    if (match.homeScore > match.awayScore) {
      homeTeam.won++; homeTeam.points += 3; awayTeam.lost++;
    } else if (match.homeScore < match.awayScore) {
      awayTeam.won++; awayTeam.points += 3; homeTeam.lost++;
    } else {
      homeTeam.drawn++; awayTeam.drawn++; homeTeam.points += 1; awayTeam.points += 1;
    }
  });

  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aGD = a.goalsFor - a.goalsAgainst;
    const bGD = b.goalsFor - b.goalsAgainst;
    if (bGD !== aGD) return bGD - aGD;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;
    if ((a.fairPlayPoints ?? 0) !== (b.fairPlayPoints ?? 0)) return (a.fairPlayPoints ?? 0) - (b.fairPlayPoints ?? 0);
    return a.team.name.localeCompare(b.team.name);
  });

  return standings;
}

/**
 * Share Result Card
 */
function shareResult(matchId) {
  showShareCard(matchId);
}

function showShareCard(matchId) {
  const match = getMatch(matchId);
  if (!match) return;

  const homeTeam = getTeam(match.homeTeam);
  const awayTeam = getTeam(match.awayTeam);
  const homeName = homeTeam?.name || 'TBD';
  const awayName = awayTeam?.name || 'TBD';

  const overlay = document.getElementById('shareOverlay');
  const card = document.getElementById('shareCard');
  if (!overlay || !card) return;

  overlay.querySelector('.share-card-container').dataset.matchId = matchId;

  // Format goal scorers
  const homeGoals = (match.events || []).filter(e => e.type === 'goal' && e.teamId === match.homeTeam);
  const awayGoals = (match.events || []).filter(e => e.type === 'goal' && e.teamId === match.awayTeam);

  card.innerHTML = `
    <div class="share-card-header">
      <img src="logo.png" class="share-card-logo">
      <span class="share-card-stage">${getStageLabel(match)} MATCH RESULT</span>
    </div>
    <div class="share-card-body">
      <div class="share-teams-grid">
        <div class="share-team-box" style="--team-color: ${homeTeam?.color || '#fff'}">
          <div class="share-team-shield">
            <span class="material-symbols-outlined">shield</span>
          </div>
          <span class="share-team-name">${homeName}</span>
        </div>
        <div class="share-score-box">
          <div class="share-score-text">${match.homeScore} - ${match.awayScore}</div>
          <div class="share-vs">FULL TIME</div>
        </div>
        <div class="share-team-box" style="--team-color: ${awayTeam?.color || '#fff'}">
          <div class="share-team-shield">
            <span class="material-symbols-outlined">shield</span>
          </div>
          <span class="share-team-name">${awayName}</span>
        </div>
      </div>
    </div>
    <div class="share-card-footer">
      <div class="share-goal-scorers">
        <div class="share-scorer-column">
          ${homeGoals.map(g => `<div class="share-scorer-item">⚽ ${g.playerName} (${g.minute}')</div>`).join('')}
        </div>
        <div class="share-scorer-column text-right">
          ${awayGoals.map(g => `<div class="share-scorer-item">⚽ ${g.playerName} (${g.minute}')</div>`).join('')}
        </div>
      </div>

      <div class="share-sponsors">
        <img src="sponsor/IMG-20240107-WA0109 - Diedit.png" class="share-sponsor-logo">
        <img src="sponsor/IMG-20260119-WA0006 - Diedit.jpg" class="share-sponsor-logo">
        <img src="sponsor/Salinan Dari Amazing Grotesk - 1.png" class="share-sponsor-logo">
        <img src="sponsor/WhatsApp Image 2026-01-10 at 18.06.42 - Diedit.png" class="share-sponsor-logo">
        <img src="sponsor/WhatsApp Image 2026-01-21 at 16.51.59 - Diedit.png" class="share-sponsor-logo">
        <img src="sponsor/WhatsApp Image 2026-01-21 at 16.51.59d - Diedit.png" class="share-sponsor-logo">
        <img src="sponsor/fdn nusantara - Diedit.png" class="share-sponsor-logo">
      </div>

      <p style="margin-top: 1rem; font-size: 0.6rem; opacity: 0.4; letter-spacing: 0.1em; font-weight: 800;">
        HASTMA CUP #3 • MANAGEMENT PORTAL 2026
      </p>
    </div>
  `;

  overlay.style.display = 'flex';

  // Check Web Share API support
  const shareBtn = document.getElementById('nativeShareBtn');
  if (shareBtn) {
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([], 'test.png', { type: 'image/png' })] })) {
      shareBtn.style.display = 'flex';
    } else {
      shareBtn.style.display = 'none';
    }
  }
}

/**
 * Generate Image Blob from Share Card
 */
async function generateImageBlob() {
  const card = document.getElementById('shareCard');
  if (!card) return null;

  try {
    const canvas = await html2canvas(card, {
      scale: 2,
      backgroundColor: '#0f172a',
      useCORS: true,
      logging: false
    });

    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png', 1.0);
    });
  } catch (err) {
    console.error('Failed to generate image:', err);
    return null;
  }
}

async function downloadResultCard() {
  showToast('Preparing image...', 'info');
  const blob = await generateImageBlob();
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `match-report.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Image saved!', 'success');
}

async function shareResultCard() {
  const blob = await generateImageBlob();
  if (!blob) return;

  const file = new File([blob], `match-report.png`, { type: 'image/png' });

  try {
    await navigator.share({
      files: [file],
      title: 'HASTMA CUP #3',
      text: 'Official Match Result'
    });
  } catch (err) {
    if (err.name !== 'AbortError') showToast('Share failed', 'danger');
  }
}

window.showShareCard = showShareCard;
window.downloadResultCard = downloadResultCard;
window.shareResultCard = shareResultCard;
window.closeShareCard = () => {
  const overlay = document.getElementById('shareOverlay');
  if (overlay) overlay.style.display = 'none';
};
/**
 * Save schedule changes
 */
function saveScheduleChanges() {
  if (!currentMatchId) {
    showToast('Please select a match first!', 'warning');
    return;
  }

  const match = getMatch(currentMatchId);
  if (!match) return;

  match.homeTeam = document.getElementById('scheduleHomeTeam').value || null;
  match.awayTeam = document.getElementById('scheduleAwayTeam').value || null;
  match.stage = document.getElementById('scheduleStage').value;
  match.date = document.getElementById('scheduleDate').value;
  match.time = document.getElementById('scheduleTime').value;
  match.endTime = document.getElementById('scheduleEndTime').value || autoCalculateEndTime(match.time, match.stage);
  match.venue = document.getElementById('scheduleVenue').value || 'MS Arena';

  saveData();
  updateLastUpdated();
  renderAdminSchedule();
  loadMatchSelector();
  showToast('Schedule updated successfully!', 'success');
}

/**
 * Prepare form for a new match
 */
function prepareNewMatch() {
  resetMatchForm();
  document.getElementById('scheduleMatchId').focus();
  document.getElementById('scheduleEditActions').style.display = 'none';
  document.getElementById('scheduleAddActions').style.display = 'flex';
  document.getElementById('scheduleFormTitle').textContent = 'Add New Match';
  document.getElementById('scheduleVenue').value = 'MS Arena';
  document.getElementById('scheduleDate').value = tournamentData.metadata.startDate || '';
}

/**
 * Create a new match entry
 */
function createNewMatch() {
  const id = document.getElementById('scheduleMatchId').value.trim();
  const stage = document.getElementById('scheduleStage').value;
  const homeTeam = document.getElementById('scheduleHomeTeam').value || null;
  const awayTeam = document.getElementById('scheduleAwayTeam').value || null;
  const date = document.getElementById('scheduleDate').value;
  const time = document.getElementById('scheduleTime').value;
  const endTime = document.getElementById('scheduleEndTime').value || autoCalculateEndTime(time, stage);
  const venue = document.getElementById('scheduleVenue').value || 'MS Arena';

  if (!id || !date || !time) {
    showToast('Please fill Match ID, Date, and Time!', 'warning');
    return;
  }

  // Check if ID already exists
  if (getMatch(id)) {
    showToast('Match ID already exists!', 'error');
    return;
  }

  const newMatch = {
    id,
    stage,
    group: 'A', // Default to A, mostly relevant if stage is group
    homeTeam: homeTeam,
    awayTeam: awayTeam,
    date,
    time,
    endTime,
    venue,
    status: 'scheduled',
    homeScore: 0,
    awayScore: 0,
    events: []
  };

  tournamentData.matches.push(newMatch);
  saveData();
  renderAdminSchedule();
  loadMatchSelector();
  resetMatchForm();
  showToast('New match created!', 'success');
}

// ================================================
// Results Center
// ================================================

let currentResultMatchId = null;

function renderAdminResults() {
  const listEl = document.getElementById('adminResultsList');
  const editorEl = document.getElementById('adminResultEditor');
  if (!listEl || !editorEl || !tournamentData) return;

  const filterEl = document.getElementById('resultStageFilter');
  const stageFilter = filterEl ? filterEl.value : 'all';

  const matches = tournamentData.matches
    .filter(m => m.status === 'finished')
    .filter(m => stageFilter === 'all' ? true : m.stage === stageFilter)
    .sort((a, b) => b.time.localeCompare(a.time));

  if (matches.length === 0) {
    listEl.innerHTML = '<p class="text-secondary" style="text-align:center; padding: 1rem; color: var(--admin-text-muted);">No finished matches yet.</p>';
    // Keep editor content but show hint if nothing selected
    if (!currentResultMatchId) {
      editorEl.innerHTML = '<p class="text-secondary" style="color: var(--admin-text-muted); font-size: 0.75rem;">Finish a match first (Match Selesai) to manage results here.</p>';
    }
    return;
  }

  listEl.innerHTML = matches.map(m => {
    const home = getTeam(m.homeTeam);
    const away = getTeam(m.awayTeam);
    const homeName = home?.name || 'TBD';
    const awayName = away?.name || 'TBD';
    const selected = m.id === currentResultMatchId;

    return `
      <div class="admin-event-card ${selected ? 'selected' : ''}" onclick="selectResultMatch('${m.id}')">
        <div class="admin-event-card-info">
          <p class="admin-event-teams">${homeName} vs ${awayName}</p>
          <div class="admin-event-meta">
            <span class="match-status-badge finished">finished</span>
            <span class="text-secondary" style="font-size: 0.75rem;">
              ${getStageLabel(m)} • ${m.time}
            </span>
          </div>
        </div>
        <div style="font-weight: 900; color: var(--admin-primary);">${m.homeScore} - ${m.awayScore}</div>
      </div>
    `;
  }).join('');

  // Auto-select first item if none selected
  if (!currentResultMatchId || !getMatch(currentResultMatchId) || getMatch(currentResultMatchId)?.status !== 'finished') {
    currentResultMatchId = matches[0].id;
  }

  renderResultEditor(currentResultMatchId);
}

function selectResultMatch(matchId) {
  currentResultMatchId = matchId;
  renderAdminResults();
}

function renderResultEditor(matchId) {
  const editorEl = document.getElementById('adminResultEditor');
  if (!editorEl) return;

  const match = getMatch(matchId);
  if (!match) {
    editorEl.innerHTML = '<p class="text-secondary">Match not found.</p>';
    return;
  }

  const home = getTeam(match.homeTeam);
  const away = getTeam(match.awayTeam);
  const homeName = home?.name || 'TBD';
  const awayName = away?.name || 'TBD';

  const statusOptions = ['scheduled', 'live', 'halftime', 'finished'];

  editorEl.innerHTML = `
    <div style="display:flex; flex-direction: column; gap: 1rem;">
      <div style="padding: 1rem; border: 1px solid var(--admin-card-border); border-radius: 1rem; background: rgba(255,255,255,0.02);">
        <div style="display:flex; justify-content: space-between; align-items: start; gap: 1rem;">
          <div>
            <div style="font-weight: 900; font-size: 1rem;">${homeName} vs ${awayName}</div>
            <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${getStageLabel(match)} • ${match.date || ''} • ${match.time || ''}</div>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="share-btn" onclick="showShareCard('${match.id}')">
              <span class="material-symbols-outlined" style="font-size: 1rem;">share</span>
              Bagikan
            </button>
            <button class="btn-premium btn-premium-secondary" style="color: var(--admin-danger);" onclick="unfinishResult('${match.id}')">
              <span class="material-symbols-outlined" style="font-size: 1rem;">undo</span>
              Unfinish
            </button>
          </div>
        </div>
      </div>

      <div class="admin-form-grid" style="grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="admin-input-group">
          <label class="admin-label">Home Score</label>
          <input class="admin-input" type="number" min="0" id="resultHomeScore" value="${match.homeScore}">
        </div>
        <div class="admin-input-group">
          <label class="admin-label">Away Score</label>
          <input class="admin-input" type="number" min="0" id="resultAwayScore" value="${match.awayScore}">
        </div>
        <div class="admin-input-group" style="grid-column: 1 / -1;">
          <label class="admin-label">Status</label>
          <select class="admin-select" id="resultStatus">
            ${statusOptions.map(s => `<option value="${s}" ${match.status === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display: flex; gap: 0.75rem;">
        <button class="btn-premium btn-premium-primary" onclick="saveResultChanges('${match.id}')" style="flex: 1;">
          <span class="material-symbols-outlined">save</span>
          Save Result
        </button>
        <button class="btn-premium btn-premium-secondary" onclick="generateMatchReport('${match.id}')" title="Export PDF Report">
          <span class="material-symbols-outlined">description</span>
          Export PDF
        </button>
      </div>

      <div style="margin-top: 0.5rem; border-top: 1px solid var(--admin-card-border); padding-top: 1rem;">
        <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 0.75rem;">
          <div style="font-weight: 900;">Events</div>
          <button class="btn-premium btn-premium-secondary" id="btnAddResultEvent" onclick="showResultEventForm('${match.id}')">
            <span class="material-symbols-outlined" style="font-size: 1rem;">add</span>
            Add Event
          </button>
        </div>
        <div id="resultEventList"></div>
      </div>
    </div>
  `;

  renderResultEventList(match.id);
}

function showResultEventForm(matchId) {
  const form = document.getElementById('resultEventForm');
  const btn = document.getElementById('btnAddResultEvent');
  if (!form || !btn) return;

  form.style.display = 'block';
  btn.style.display = 'none';

  // Initialize form
  setResultEventType('goal', document.querySelector('.result-type-btn.goal'));

  const match = getMatch(matchId);
  const teamButtons = document.getElementById('resultEventTeamButtons');
  if (match && teamButtons) {
    const home = getTeam(match.homeTeam);
    const away = getTeam(match.awayTeam);
    teamButtons.innerHTML = '';
    if (home) {
      teamButtons.innerHTML += `
        <div class="admin-selection-btn result-team-btn" onclick="selectResultEventTeam('${home.id}', this)">
          <span class="btn-sub">HOME</span>
          <span class="btn-main">${home.name}</span>
        </div>
      `;
    }
    if (away) {
      teamButtons.innerHTML += `
        <div class="admin-selection-btn result-team-btn" onclick="selectResultEventTeam('${away.id}', this)">
          <span class="btn-sub">AWAY</span>
          <span class="btn-main">${away.name}</span>
        </div>
      `;
    }
  }

  document.getElementById('resultEventTeam').value = '';
  document.getElementById('resultEventPlayerNumber').value = '';
  document.getElementById('resultEventPlayerName').value = '';
  document.getElementById('resultEventMinute').value = '0';
  document.getElementById('resultEventPlayerButtons').innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 1rem; color: var(--admin-text-muted); font-size: 0.75rem;">Select team first</p>';
  // Reset button to "Register" mode just in case it was in "Update" mode
  const regBtn = document.querySelector('#resultEventForm .btn-premium-primary');
  if (regBtn) {
    regBtn.textContent = 'Register Event';
    regBtn.onclick = addResultEvent;
  }
}

function hideResultEventForm() {
  const form = document.getElementById('resultEventForm');
  const btn = document.getElementById('btnAddResultEvent');
  if (form) form.style.display = 'none';
  if (btn) btn.style.display = 'flex';
}

function setResultEventType(type, element) {
  document.getElementById('resultEventType').value = type;
  document.querySelectorAll('.result-type-btn').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');
}

function selectResultEventTeam(teamId, element) {
  document.getElementById('resultEventTeam').value = teamId;
  document.querySelectorAll('.result-team-btn').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');
  loadPlayersForResultEvent();
}

function loadPlayersForResultEvent() {
  const teamId = document.getElementById('resultEventTeam').value;
  const container = document.getElementById('resultEventPlayerButtons');
  if (!teamId || !container) return;

  const team = getTeam(teamId);
  if (!team || !team.players) {
    container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 1rem; color: var(--admin-text-muted); font-size: 0.75rem;">No players</p>';
    return;
  }

  container.innerHTML = team.players.map(p => `
    <div class="admin-selection-btn player-btn result-player-btn" onclick="selectResultEventPlayer('${p.number}', '${p.name}', this)">
      <span class="btn-main">#${p.number}</span>
      <span class="btn-sub">${p.name.split(' ')[0]}</span>
    </div>
  `).join('');
}

function selectResultEventPlayer(number, name, element) {
  document.getElementById('resultEventPlayerNumber').value = number;
  document.getElementById('resultEventPlayerName').value = name;
  document.querySelectorAll('.result-player-btn').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');
}

function addResultEvent() {
  if (!currentResultMatchId) return;
  const match = getMatch(currentResultMatchId);
  if (!match) return;

  const type = document.getElementById('resultEventType').value;
  const teamId = document.getElementById('resultEventTeam').value;
  const playerNumber = parseInt(document.getElementById('resultEventPlayerNumber').value);
  const playerName = document.getElementById('resultEventPlayerName').value;
  const minute = parseInt(document.getElementById('resultEventMinute').value);

  if (!teamId || !playerNumber) {
    showToast('Please select team and player!', 'warning');
    return;
  }

  if (!match.events) match.events = [];
  match.events.push({
    type,
    teamId,
    playerNumber,
    playerName,
    minute: Number.isFinite(minute) ? minute : 0
  });

  // Auto-update score if it's a goal
  if (type === 'goal') {
    if (match.homeTeam === teamId) {
      match.homeScore++;
    } else if (match.awayTeam === teamId) {
      match.awayScore++;
    }
  }

  saveData();
  updateLastUpdated();
  renderResultEditor(currentResultMatchId);
  hideResultEventForm();
  showToast('Result event registered!', 'success');
}

function saveResultChanges(matchId) {
  const match = getMatch(matchId);
  if (!match) return;

  const homeScore = parseInt(document.getElementById('resultHomeScore')?.value ?? '0', 10);
  const awayScore = parseInt(document.getElementById('resultAwayScore')?.value ?? '0', 10);
  const status = document.getElementById('resultStatus')?.value || match.status;

  match.homeScore = Number.isFinite(homeScore) ? Math.max(0, homeScore) : match.homeScore;
  match.awayScore = Number.isFinite(awayScore) ? Math.max(0, awayScore) : match.awayScore;
  match.status = status;

  // If result is no longer finished, it should disappear from Results list
  saveData();
  updateLastUpdated();
  renderAdminSchedule();
  renderAdminResults();

  // Automate Bracket if matches finished
  automateKnockoutSlots();

  showToast('Result saved!', 'success');
}

/**
 * Automate Knockout Slot Filling (Option A)
 */
function automateKnockoutSlots() {
  const groupA = tournamentData.teams.filter(t => t.group === 'A');
  const groupB = tournamentData.teams.filter(t => t.group === 'B');

  // Only automate if group stages are potentially done
  const groupMatches = tournamentData.matches.filter(m => m.stage === 'group');
  const allFinished = groupMatches.every(m => m.status === 'finished');

  if (!allFinished) return;

  // We need logic from app.js but to avoid duplication we'll manually calculate Top 2
  // (In a real app, calculateStandings would be shared)
  const standingsA = calculateInternalStandings('A');
  const standingsB = calculateInternalStandings('B');

  if (standingsA.length < 2 || standingsB.length < 2) return;

  const winnerA = standingsA[0].team;
  const runnerA = standingsA[1].team;
  const winnerB = standingsB[0].team;
  const runnerB = standingsB[1].team;

  // Find knockout matches
  // SF 1: Winner A vs Runner B
  const sf1 = tournamentData.matches.find(m => m.id === 'SF1');
  if (sf1) {
    sf1.homeTeam = winnerA.id;
    sf1.awayTeam = runnerB.id;
  }

  // SF 2: Winner B vs Runner A
  const sf2 = tournamentData.matches.find(m => m.id === 'SF2');
  if (sf2) {
    sf2.homeTeam = winnerB.id;
    sf2.awayTeam = runnerA.id;
  }

  // Bracket for Final is harder because SF needs to be finished
  const sf1Finished = sf1 && sf1.status === 'finished';
  const sf2Finished = sf2 && sf2.status === 'finished';

  if (sf1Finished && sf2Finished) {
    const final = tournamentData.matches.find(m => m.id === 'FINAL');
    if (final) {
      final.homeTeam = (sf1.homeScore > sf1.awayScore) ? sf1.homeTeam : sf1.awayTeam;
      final.awayTeam = (sf2.homeScore > sf2.awayScore) ? sf2.homeTeam : sf2.awayTeam;
    }
  }

  saveData();
}

/**
 * Helper to calculate standings within admin (Option A dependency)
 */
function calculateInternalStandings(group) {
  const teams = tournamentData.teams.filter(t => t.group === group);
  const matches = tournamentData.matches.filter(m => m.stage === 'group' && m.group === group && m.status === 'finished');

  const standings = teams.map(t => ({ team: t, pts: 0, gd: 0 }));

  matches.forEach(m => {
    const home = standings.find(s => s.team.id === m.homeTeam);
    const away = standings.find(s => s.team.id === m.awayTeam);
    if (home && away) {
      if (m.homeScore > m.awayScore) home.pts += 3;
      else if (m.homeScore < m.awayScore) away.pts += 3;
      else { home.pts += 1; away.pts += 1; }
      home.gd += (m.homeScore - m.awayScore);
      away.gd += (m.awayScore - m.homeScore);
    }
  });

  return standings.sort((a, b) => b.pts - a.pts || b.gd - a.gd);
}

function unfinishResult(matchId) {
  const match = getMatch(matchId);
  if (!match) return;

  if (!confirm('Unfinish this match? This will reset score to 0-0 and clear events.')) return;

  match.status = 'scheduled';
  match.homeScore = 0;
  match.awayScore = 0;
  match.events = [];

  if (currentMatchId === matchId) {
    // If currently focused in Matches section, refresh its UI too
    // (loadMatchForEdit will pull from currentMatchId)
  }

  saveData();
  updateLastUpdated();
  renderAdminSchedule();
  renderAdminResults();
  if (currentMatchId === matchId) loadMatchForEdit();
  showToast('Result cleared (unfinished).', 'success');
}

function renderResultEventList(matchId) {
  const match = getMatch(matchId);
  const container = document.getElementById('resultEventList');
  if (!match || !container) return;

  const events = match.events || [];
  if (events.length === 0) {
    container.innerHTML = '<p class="text-secondary" style="color: var(--admin-text-muted); font-size: 0.75rem; text-align:center; padding: 0.5rem;">No events.</p>';
    return;
  }

  const sorted = [...events].map((e, i) => ({ ...e, idx: i })).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  container.innerHTML = sorted.map(e => {
    return `
      <div style="display:flex; align-items:center; justify-content: space-between; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--admin-card-border); border-radius: 0.875rem; background: rgba(255,255,255,0.02); margin-bottom: 0.5rem;">
        <div style="display:flex; flex-direction: column; gap: 0.15rem;">
          <div style="font-weight: 800;">${e.minute}' • ${e.type?.toUpperCase()}</div>
          <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${e.playerName || '-'} (${e.teamId || '-'})</div>
        </div>
        <div style="display:flex; gap: 0.5rem;">
          <button class="btn-premium btn-premium-secondary" style="padding: 0.5rem;" onclick="editResultEvent('${matchId}', ${e.idx})">
            <span class="material-symbols-outlined" style="font-size: 1rem;">edit</span>
          </button>
          <button class="btn-premium btn-premium-secondary" style="padding: 0.5rem; color: var(--admin-danger);" onclick="deleteResultEvent('${matchId}', ${e.idx})">
            <span class="material-symbols-outlined" style="font-size: 1rem;">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function editResultEvent(matchId, eventIndex) {
  const match = getMatch(matchId);
  if (!match || !match.events || !match.events[eventIndex]) return;

  const e = match.events[eventIndex];

  // Reuse the registration form but for editing
  showResultEventForm(matchId);

  // Set values from current event
  setResultEventType(e.type, document.querySelector(`.result-type-btn.${e.type}`));
  document.getElementById('resultEventMinute').value = e.minute;
  document.getElementById('resultEventTeam').value = e.teamId;

  // Find and activate team button
  const teamBtns = document.querySelectorAll('.result-team-btn');
  teamBtns.forEach(btn => {
    const btnMain = btn.querySelector('.btn-main')?.textContent;
    const team = getTeam(e.teamId);
    if (team && btnMain === team.name) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Load players and select the right one
  loadPlayersForResultEvent();

  // Wait a tiny bit for player buttons to render
  setTimeout(() => {
    const playerBtns = document.querySelectorAll('.result-player-btn');
    playerBtns.forEach(btn => {
      const btnMain = btn.querySelector('.btn-main')?.textContent;
      if (btnMain === `#${e.playerNumber}`) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    document.getElementById('resultEventPlayerNumber').value = e.playerNumber;
    document.getElementById('resultEventPlayerName').value = e.playerName;
  }, 10);

  // Update button text and action
  const regBtn = document.querySelector('#resultEventForm .btn-premium-primary');
  if (regBtn) {
    regBtn.textContent = 'Update Event';
    regBtn.onclick = () => saveEditedResultEvent(matchId, eventIndex);
  }
}

function saveEditedResultEvent(matchId, eventIndex) {
  const match = getMatch(matchId);
  if (!match || !match.events || !match.events[eventIndex]) return;

  const type = document.getElementById('resultEventType').value;
  const teamId = document.getElementById('resultEventTeam').value;
  const playerNumber = parseInt(document.getElementById('resultEventPlayerNumber').value);
  const playerName = document.getElementById('resultEventPlayerName').value;
  const minute = parseInt(document.getElementById('resultEventMinute').value);

  if (!teamId || !playerNumber) {
    showToast('Please select team and player!', 'warning');
    return;
  }

  const e = match.events[eventIndex];
  e.type = type;
  e.teamId = teamId;
  e.playerNumber = playerNumber;
  e.playerName = playerName;
  e.minute = Number.isFinite(minute) ? minute : 0;

  saveData();
  updateLastUpdated();
  renderResultEditor(matchId);
  hideResultEventForm();
  showToast('Event updated!', 'success');

  // Reset register button
  const regBtn = document.querySelector('#resultEventForm .btn-premium-primary');
  if (regBtn) {
    regBtn.textContent = 'Register Event';
    regBtn.onclick = addResultEvent;
  }
}

function deleteResultEvent(matchId, eventIndex) {
  const match = getMatch(matchId);
  if (!match || !match.events || !match.events[eventIndex]) return;

  if (!confirm('Delete this event?')) return;

  const event = match.events[eventIndex];
  // Auto-decrement score if it was a goal
  if (event.type === 'goal') {
    if (match.homeTeam === event.teamId) {
      match.homeScore = Math.max(0, match.homeScore - 1);
    } else if (match.awayTeam === event.teamId) {
      match.awayScore = Math.max(0, match.awayScore - 1);
    }
  }

  match.events.splice(eventIndex, 1);
  saveData();
  updateLastUpdated();
  renderResultEditor(matchId);
  showToast('Event deleted.', 'success');
}

/**
 * Generate PDF Match Report
 */
function generateMatchReport(matchId) {
  const match = getMatch(matchId);
  if (!match) return;

  const homeTeam = getTeam(match.homeTeam);
  const awayTeam = getTeam(match.awayTeam);
  const events = match.events || [];

  // Sort players by number
  const homePlayers = (homeTeam?.players || []).sort((a, b) => a.number - b.number);
  const awayPlayers = (awayTeam?.players || []).sort((a, b) => a.number - b.number);

  // Create a hidden print window
  const printWindow = window.open('', '_blank');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Match Report - ${homeTeam?.name || 'Home'} vs ${awayTeam?.name || 'Away'}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        
        @page {
          size: A4;
          margin: 10mm;
        }

        body { 
          font-family: 'Inter', sans-serif; 
          color: #1a1a1a; 
          padding: 0; 
          margin: 0;
          line-height: 1.3;
          font-size: 12px;
        }

        .report-container {
          max-width: 190mm;
          margin: 0 auto;
        }

        .header { 
          text-align: center; 
          border-bottom: 2px solid #eee; 
          padding-bottom: 10px; 
          margin-bottom: 15px; 
        }

        .match-title { font-size: 20px; font-weight: 900; margin: 0; }
        .match-info { color: #666; font-size: 12px; margin-top: 2px; }
        
        .score-row { 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          gap: 30px; 
          margin: 15px 0;
          background: #fcfcfc;
          padding: 10px;
          border-radius: 8px;
        }

        .team-box { text-align: center; flex: 1; }
        .team-name { font-size: 16px; font-weight: 700; margin-bottom: 5px; }
        .score { font-size: 44px; font-weight: 900; line-height: 1; }
        .divider { font-size: 24px; color: #ccc; font-weight: 900; }
        
        .section-title { 
          font-size: 13px; 
          font-weight: 900; 
          border-bottom: 1px solid #eee; 
          padding-bottom: 5px; 
          margin-bottom: 10px; 
          margin-top: 15px; 
          text-transform: uppercase; 
          letter-spacing: 1px;
          color: #444;
        }
        
        .lineup-grid { 
          display: grid; 
          grid-template-columns: 1fr 1fr; 
          gap: 20px; 
        }

        .lineup-list { 
          list-style: none; 
          padding: 0; 
          margin: 0;
          display: grid;
          grid-template-columns: 1fr 1fr; /* Two columns for players to save space */
          gap: 0 10px;
        }

        .lineup-item { 
          font-size: 11px; 
          display: flex; 
          gap: 6px; 
          padding: 2px 0; 
          border-bottom: 1px solid #f9f9f9; 
        }

        .lineup-number { font-weight: 700; width: 18px; color: #666; }
        .captain-tag { font-weight: 900; color: #d97706; margin-left: 3px; font-size: 9px; }
        .manager-info { font-size: 11px; margin-top: 8px; font-weight: 700; color: #666; font-style: italic; }

        .events-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .event-list { list-style: none; padding: 0; margin: 0; }
        .event-item { 
          display: flex; 
          gap: 10px; 
          padding: 4px 0; 
          border-bottom: 1px solid #fcfcfc; 
          font-size: 11px; 
        }
        .event-min { font-weight: 700; width: 25px; color: #666; }
        .event-type { width: 70px; font-weight: 700; text-transform: uppercase; font-size: 10px; }
        .event-player { flex: 1; }

        .footer { 
          margin-top: 20px; 
          text-align: center; 
          font-size: 10px; 
          color: #999; 
          border-top: 1px solid #eee; 
          padding-top: 10px; 
        }

        @media print { 
          .no-print { display: none; }
          body { -webkit-print-color-adjust: exact; }
        }
      </style>
    </head>
    <body onload="setTimeout(() => window.print(), 800)">
      <div class="report-container">
        <div class="header">
          <img src="logo.png" style="height: 40px; margin-bottom: 5px;" alt="Logo">
          <h1 class="match-title">HASTMA CUP #3</h1>
          <div class="match-info">Official Match Report • ${match.stage.toUpperCase()} • ${match.date} ${match.time}</div>
        </div>

        <div class="score-row">
          <div class="team-box">
            <div class="team-name">${homeTeam?.name || 'HOME'}</div>
            <div class="score">${match.homeScore}</div>
          </div>
          <div class="divider">VS</div>
          <div class="team-box">
            <div class="team-name">${awayTeam?.name || 'AWAY'}</div>
            <div class="score">${match.awayScore}</div>
          </div>
        </div>

        <div class="section-title">Team Lineups</div>
        <div class="lineup-grid">
          <div>
            <ul class="lineup-list">
              ${homePlayers.map(p => `
                <li class="lineup-item">
                  <span class="lineup-number">${p.number}</span>
                  <span>${p.name}${p.isCaptain ? '<span class="captain-tag">(C)</span>' : ''}</span>
                </li>
              `).join('')}
            </ul>
            <div class="manager-info">Manager: ${homeTeam?.manager || '-'}</div>
          </div>
          <div>
            <ul class="lineup-list">
              ${awayPlayers.map(p => `
                <li class="lineup-item">
                  <span class="lineup-number">${p.number}</span>
                  <span>${p.name}${p.isCaptain ? '<span class="captain-tag">(C)</span>' : ''}</span>
                </li>
              `).join('')}
            </ul>
            <div class="manager-info">Manager: ${awayTeam?.manager || '-'}</div>
          </div>
        </div>

        <div class="section-title">Match Events</div>
        <div class="events-grid">
          <div class="event-list">
            ${events.length === 0 ? '<p style="color:#999;font-size:11px;">No events recorded.</p>' :
      events.sort((a, b) => a.minute - b.minute).slice(0, Math.ceil(events.length / 2)).map(e => `
              <div class="event-item">
                <div class="event-min">${e.minute}'</div>
                <div class="event-type">${e.type}</div>
                <div class="event-player">${e.playerName} (#${e.playerNumber})</div>
              </div>
            `).join('')}
          </div>
          <div class="event-list">
            ${events.length > 1 ? events.sort((a, b) => a.minute - b.minute).slice(Math.ceil(events.length / 2)).map(e => `
              <div class="event-item">
                <div class="event-min">${e.minute}'</div>
                <div class="event-type">${e.type}</div>
                <div class="event-player">${e.playerName} (#${e.playerNumber})</div>
              </div>
            `).join('') : ''}
          </div>
        </div>

        <div class="footer">
          Generated on ${new Date().toLocaleString()} • Hastma Cup #3 Management Portal
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

// ================================================
// Match Events
// ================================================

/**
 * Load match events for display
 */
/**
 * Load match events for display (Admin Version)
 */
function loadMatchEvents(match) {
  const container = document.getElementById('eventList');
  if (!container) return;

  if (!match.events || match.events.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 1rem;">No events recorded yet.</p>';
    return;
  }

  // Sort events by minute (latest first)
  const sortedEvents = [...match.events].map((e, i) => ({ ...e, originalIndex: i })).sort((a, b) => b.minute - a.minute);

  container.innerHTML = `
    <div class="timeline-container" style="padding: 1rem 0;">
      <div class="ht-line"></div>
      ${sortedEvents.map(event => {
    const isHome = event.teamId === match.homeTeam;
    const side = isHome ? 'home' : 'away';
    const teamColor = isHome ? 'var(--admin-primary)' : 'var(--admin-accent)';
    // Note: Admin might not have access to verified team colors easily without more lookups, 
    // keeping it simple or using standard admin colors.

    // Icon Logic
    let icon = 'sports_soccer';
    if (event.type === 'yellow') icon = 'style'; // Card icon
    if (event.type === 'red') icon = 'style';

    // Home Card HTML
    const homeCard = isHome ? `
          <div class="ht-card" style="border-right-color: ${teamColor}; border-right-width: 4px; border-right-style: solid;">
            <div class="ht-info">
              <div class="ht-player">${event.playerName || 'Unknown'}</div>
              <div class="ht-meta">${getTeam(event.teamId)?.name || 'Team'}</div>
            </div>
            <div class="ht-icon">
              ${event.type === 'goal' ? '⚽' : `<span class="material-symbols-outlined">${icon}</span>`}
            </div>
            <button onclick="deleteEvent(${event.originalIndex})" class="ht-delete-btn" title="Delete Event">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>` : '';

    // Away Card HTML
    const awayCard = !isHome ? `
          <div class="ht-card" style="border-left-color: ${teamColor}; border-left-width: 4px; border-left-style: solid;">
             <div class="ht-icon">
              ${event.type === 'goal' ? '⚽' : `<span class="material-symbols-outlined">${icon}</span>`}
            </div>
            <div class="ht-info" style="align-items: flex-start; text-align: left;">
              <div class="ht-player">${event.playerName || 'Unknown'}</div>
              <div class="ht-meta">${getTeam(event.teamId)?.name || 'Team'}</div>
            </div>
            <button onclick="deleteEvent(${event.originalIndex})" class="ht-delete-btn" title="Delete Event">
              <span class="material-symbols-outlined">delete</span>
            </button>
          </div>` : '';

    return `<div class="ht-row ${side}">${homeCard}<div class="ht-time">${event.minute}'</div>${awayCard}</div>`;
  }).join('')}
    </div>
  `;
}

/**
 * Initialize/Reset event entry form
 */
function initEventForm() {
  const match = getMatch(currentMatchId);
  if (!match) return;

  // Reset event type to goal
  setEventType('goal', document.querySelector('.admin-event-type-btn.goal') || document.querySelector('.admin-event-type-btn'));

  // Load teams for event buttons
  const teamButtonsContainer = document.getElementById('eventTeamButtons');
  const homeTeam = getTeam(match.homeTeam);
  const awayTeam = getTeam(match.awayTeam);

  teamButtonsContainer.innerHTML = '';
  if (homeTeam) {
    teamButtonsContainer.innerHTML += `
      <div class="admin-selection-btn" onclick="selectEventTeam('${homeTeam.id}', this)">
        <span class="btn-sub">HOME</span>
        <span class="btn-main">${homeTeam.name}</span>
      </div>
    `;
  }
  if (awayTeam) {
    teamButtonsContainer.innerHTML += `
      <div class="admin-selection-btn" onclick="selectEventTeam('${awayTeam.id}', this)">
        <span class="btn-sub">AWAY</span>
        <span class="btn-main">${awayTeam.name}</span>
      </div>
    `;
  }

  document.getElementById('eventPlayerName').value = '';
  document.getElementById('eventPlayerButtons').innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 1rem; color: var(--admin-text-muted); font-size: 0.75rem;">Select team first</p>';
}

/**
 * Render player buttons for selected team
 */
function loadPlayersForEvent() {
  const teamId = document.getElementById('eventTeam').value;
  const playerButtonsContainer = document.getElementById('eventPlayerButtons');

  if (!teamId) {
    playerButtonsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 1rem; color: var(--admin-text-muted); font-size: 0.75rem;">Select team first</p>';
    return;
  }

  const team = getTeam(teamId);
  if (!team || !team.players) {
    playerButtonsContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 1rem; color: var(--admin-text-muted); font-size: 0.75rem;">No players registered</p>';
    return;
  }

  playerButtonsContainer.innerHTML = team.players.map(player => `
    <div class="admin-selection-btn player-btn" onclick="selectEventPlayer('${player.number}', '${player.name}', this)">
      <span class="btn-main">#${player.number}</span>
      <span class="btn-sub">${player.name.split(' ')[0]}</span>
    </div>
  `).join('');
}

/**
 * Add event to match
 */
function addEvent() {
  if (!currentMatchId) return;

  const match = getMatch(currentMatchId);
  if (!match) return;

  // Restriction: Only Register if Live/Halftime
  if (match.status !== 'live' && match.status !== 'halftime') {
    showToast('Pertandingan harus LIVE untuk mencatat event!', 'warning');
    return;
  }

  const type = document.getElementById('eventType').value;
  const teamId = document.getElementById('eventTeam').value;
  const playerNumber = parseInt(document.getElementById('eventPlayerNumber').value);
  const playerName = document.getElementById('eventPlayerName').value;
  const minute = parseInt(document.getElementById('eventMinute').value);

  if (!teamId || !playerNumber) {
    showToast('Please select team and player!', 'warning');
    return;
  }

  if (!match.events) {
    match.events = [];
  }

  match.events.push({
    type,
    teamId,
    playerNumber,
    playerName,
    minute
  });

  // Auto-update score if it's a goal
  if (type === 'goal') {
    if (match.homeTeam === teamId) {
      match.homeScore++;
    } else if (match.awayTeam === teamId) {
      match.awayScore++;
    }
    document.getElementById('homeScoreDisplay').textContent = match.homeScore;
    document.getElementById('awayScoreDisplay').textContent = match.awayScore;
  }

  saveData();
  loadMatchEvents(match);
  hideEventForm();

  // Reset form
  document.getElementById('eventMinute').value = '0';

  showToast('Event added successfully!', 'success');
}

/**
 * Delete event from match
 */
function deleteEvent(eventIndex) {
  if (!currentMatchId) return;

  const match = getMatch(currentMatchId);
  if (!match || !match.events) return;

  const event = match.events[eventIndex];

  // Adjust score if it was a goal
  if (event.type === 'goal') {
    if (match.homeTeam === event.teamId) {
      match.homeScore = Math.max(0, match.homeScore - 1);
    } else if (match.awayTeam === event.teamId) {
      match.awayScore = Math.max(0, match.awayScore - 1);
    }
    document.getElementById('homeScoreDisplay').textContent = match.homeScore;
    document.getElementById('awayScoreDisplay').textContent = match.awayScore;
  }

  match.events.splice(eventIndex, 1);
  saveData();
  loadMatchEvents(match);

  showToast('Event deleted!', 'success');
}

// ================================================
// Player Management
// ================================================

/**
 * Load team selector for players
 */
function loadPlayerTeamSelector() {
  const selector = document.getElementById('playerTeamSelector');
  if (!selector) return;

  selector.innerHTML = '<option value="">-- Select Team --</option>' +
    tournamentData.teams.map(team =>
      `<option value="${team.id}">${team.name} (Grup ${team.group})</option>`
    ).join('');
}

/**
 * Load players for selected team
 */
function loadPlayersForTeam() {
  const teamId = document.getElementById('playerTeamSelector').value;
  const editor = document.getElementById('playerEditor');

  if (!teamId) {
    editor.style.display = 'none';
    return;
  }

  editor.style.display = 'block';
  loadPlayerList(teamId);
}

/**
 * Load player list for team
 */
function loadPlayerList(teamId) {
  const container = document.getElementById('playerList');
  const team = getTeam(teamId);

  if (!container || !team) return;

  if (!team.players || team.players.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 1rem;">No players yet.</p>';
    return;
  }

  container.innerHTML = team.players.map((player, index) => {
    const isCaptain = player.isCaptain === true;
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: rgba(255,255,255,0.02); border: 1px solid var(--admin-card-border); border-radius: 0.875rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 2.25rem; height: 2.25rem; border-radius: 0.75rem; background: ${isCaptain ? 'var(--admin-warning)' : 'var(--admin-primary)'}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.875rem; color: white; position: relative;" title="${isCaptain ? 'Captain' : 'Player'}">
            ${player.number}
            ${isCaptain ? '<div style="position: absolute; bottom: -4px; right: -4px; background: #fff; color: #000; font-size: 8px; font-weight: 900; width: 14px; height: 14px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid #000;">C</div>' : ''}
          </div>
          <div>
            <div style="font-weight: 700; color: var(--admin-text-main);">${player.name}${isCaptain ? ' (C)' : ''}</div>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn-premium ${isCaptain ? 'btn-premium-primary' : 'btn-premium-secondary'}" style="padding: 0.5rem;" onclick="toggleCaptain('${teamId}', ${index})" title="Set as Captain">
            <span class="material-symbols-outlined" style="font-size: 1rem;">star</span>
          </button>
          <button class="btn-premium btn-premium-secondary" style="padding: 0.5rem;" onclick="editPlayer('${teamId}', ${index})">
            <span class="material-symbols-outlined" style="font-size: 1rem;">edit</span>
          </button>
          <button class="btn-premium btn-premium-secondary" style="padding: 0.5rem; color: var(--admin-danger);" onclick="deletePlayer('${teamId}', ${index})">
            <span class="material-symbols-outlined" style="font-size: 1rem;">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleCaptain(teamId, playerIndex) {
  const team = getTeam(teamId);
  if (!team || !team.players) return;

  // Toggle selected player
  const player = team.players[playerIndex];
  const newState = !player.isCaptain;

  // Rule: Only one captain per team (optional, but professional)
  if (newState) {
    team.players.forEach(p => p.isCaptain = false);
  }

  player.isCaptain = newState;

  saveData();
  loadPlayerList(teamId);
  showToast(newState ? `${player.name} is now Captain!` : 'Captain tag removed', 'info');
}

/**
 * Add player to team
 */
function addPlayer() {
  const teamId = document.getElementById('playerTeamSelector').value;
  const number = parseInt(document.getElementById('newPlayerNumber').value);
  const name = document.getElementById('newPlayerName').value.trim();

  if (!teamId || isNaN(number) || !name) {
    showToast('Please fill all fields!', 'warning');
    return;
  }

  const team = getTeam(teamId);
  if (!team) return;

  if (!team.players) {
    team.players = [];
  }

  // Duplicate number check REMOVED by user request
  // Allow duplicate numbers (especially 0)

  team.players.push({ number, name });

  // Sort players by number
  team.players.sort((a, b) => a.number - b.number);

  saveData();
  loadPlayersForTeam();

  // Reset form
  document.getElementById('newPlayerNumber').value = '';
  document.getElementById('newPlayerName').value = '';

  showToast('Player added successfully!', 'success');
}

/**
 * Edit player
 */
function editPlayer(teamId, playerIndex) {
  const team = getTeam(teamId);
  if (!team || !team.players) return;

  const player = team.players[playerIndex];
  const newName = prompt('Enter new player name:', player.name);

  if (newName !== null && newName.trim() !== '') {
    player.name = newName.trim();
    saveData();
    loadPlayersForTeam();
    showToast('Player updated!', 'success');
  }
}

/**
 * Delete player from team
 */
function deletePlayer(teamId, playerIndex) {
  if (!confirm('Delete this player?')) return;

  const team = getTeam(teamId);
  if (!team || !team.players) return;

  team.players.splice(playerIndex, 1);
  saveData();
  loadPlayersForTeam();

  showToast('Player deleted!', 'success');
}

// ================================================
// Team Colors
// ================================================

/**
 * Load team color grid
 */
function loadTeamColors() {
  const container = document.getElementById('teamColorGrid');
  if (!container) return;

  container.innerHTML = tournamentData.teams.map(team => `
    <div class="admin-glass-card" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 1.5rem; height: 1.5rem; border-radius: 4px; background: ${team.color || '#ccc'}; border: 1px solid rgba(255,255,255,0.1);"></div>
          <span style="font-weight: 800; font-size: 0.875rem; color: var(--admin-text-main);">${team.name}</span>
        </div>
        <button class="btn-premium btn-premium-secondary" style="padding: 0.4rem; color: var(--admin-danger);" onclick="deleteTeam('${team.id}')">
           <span class="material-symbols-outlined" style="font-size: 1rem;">delete</span>
        </button>
      </div>

      <div class="admin-form-grid" style="grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div class="admin-input-group" style="grid-column: span 2;">
          <label class="admin-label">Team Name</label>
          <input type="text" class="admin-input" value="${team.name}" onchange="updateTeamName('${team.id}', this.value)">
        </div>
        <div class="admin-input-group" style="grid-column: span 2;">
          <label class="admin-label">Manager / Official</label>
          <input type="text" class="admin-input" placeholder="Nama Manager" value="${team.manager || ''}" onchange="updateTeamManager('${team.id}', this.value)">
        </div>
        <div class="admin-input-group">
          <label class="admin-label">Group</label>
          <select class="admin-select" onchange="updateTeamGroup('${team.id}', this.value)">
            <option value="A" ${team.group === 'A' ? 'selected' : ''}>Group A</option>
            <option value="B" ${team.group === 'B' ? 'selected' : ''}>Group B</option>
            <option value="C" ${team.group === 'C' ? 'selected' : ''}>Group C</option>
            <option value="D" ${team.group === 'D' ? 'selected' : ''}>Group D</option>
          </select>
        </div>
        <div class="admin-input-group">
          <label class="admin-label">Color (Hex)</label>
          <div style="display: flex; gap: 0.5rem;">
            <input type="color" class="admin-input" style="width: 2.5rem; height: 2.5rem; padding: 0.25rem; cursor: pointer;" value="${team.color || '#cccccc'}" onchange="updateTeamColor('${team.id}', this.value)">
            <input type="text" class="admin-input" style="flex: 1; font-family: monospace;" value="${team.color || '#cccccc'}" onchange="updateTeamColor('${team.id}', this.value)">
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function updateTeamManager(teamId, manager) {
  const team = getTeam(teamId);
  if (team) {
    team.manager = manager.trim();
    saveData();
    showToast('Manager updated!', 'success');
  }
}

function updateTeamName(teamId, name) {
  const team = getTeam(teamId);
  if (team && name.trim()) {
    team.name = name.trim();
    saveData();
    showToast(`${teamId} renamed to ${team.name}`, 'success');
  }
}

function updateTeamGroup(teamId, group) {
  const team = getTeam(teamId);
  if (team) {
    team.group = group;
    saveData();
    showToast(`${team.name} moved to Group ${group}`, 'success');
  }
}

function showAddTeamModal() {
  document.getElementById('addTeamModal').style.display = 'flex';
}

function closeAddTeamModal() {
  document.getElementById('addTeamModal').style.display = 'none';
}

function addNewTeam() {
  const idValue = document.getElementById('newTeamId').value.trim();
  const nameValue = document.getElementById('newTeamName').value.trim();
  const groupValue = document.getElementById('newTeamGroup').value;
  const colorValue = document.getElementById('newTeamColor').value;

  if (!idValue || !nameValue) {
    showToast('Please fill ID and Name!', 'warning');
    return;
  }

  // Check unique ID
  if (getTeam(idValue)) {
    showToast('Team ID already exists!', 'error');
    return;
  }

  const newTeam = {
    id: idValue,
    name: nameValue,
    group: groupValue,
    color: colorValue,
    players: []
  };

  tournamentData.teams.push(newTeam);
  saveData();
  loadTeamColors(); // Refresh list
  loadPlayerTeamSelector(); // Update player tab selector
  loadScheduleTeamSelectors(); // Update schedule tab selectors
  closeAddTeamModal();
  showToast(`Team ${nameValue} added!`, 'success');

  // Reset inputs
  document.getElementById('newTeamId').value = '';
  document.getElementById('newTeamName').value = '';
}

function deleteTeam(teamId) {
  if (!confirm(`Are you sure you want to delete team ${teamId}? This may break match references if not handled carefully.`)) return;

  const idx = tournamentData.teams.findIndex(t => t.id === teamId);
  if (idx !== -1) {
    tournamentData.teams.splice(idx, 1);
    saveData();
    loadTeamColors();
    showToast('Team deleted.', 'info');
  }
}

/**
 * Update team color
 */
function updateTeamColor(teamId, color) {
  // Ensure valid hex color
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    if (/^[0-9A-Fa-f]{6}$/.test(color)) {
      color = '#' + color;
    } else {
      showToast('Invalid hex color format!', 'error');
      return;
    }
  }

  const team = getTeam(teamId);
  if (team) {
    team.color = color;
    saveData();
    loadTeamColors();
    showToast(`${team.name} color updated!`, 'success');
  }
}

// ================================================
// Data Management
// ================================================

/**
 * Export data as JSON file
 */
function exportData() {
  const dataStr = JSON.stringify(tournamentData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `hastma-cup-2026-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Data exported successfully!', 'success');
}

/**
 * Import data from JSON file
 */
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);

      // Validate data structure
      if (!data.teams || !data.matches || !data.metadata) {
        throw new Error('Invalid data structure');
      }

      tournamentData = data;
      saveData();
      loadAllAdminData();

      showToast('Data imported successfully!', 'success');
    } catch (err) {
      showToast('Invalid file format!', 'error');
      console.error('Import error:', err);
    }
  };

  reader.readAsText(file);
  event.target.value = '';
}

/**
 * Reset data to default
 */
function resetData() {
  if (!confirm('Reset all data to default? All changes will be lost!')) {
    return;
  }

  tournamentData = JSON.parse(JSON.stringify(DEFAULT_TOURNAMENT_DATA));
  saveData();
  loadAllAdminData();

  showToast('Data reset to default!', 'success');
}

// ================================================
// UI Updates
// ================================================

/**
 * Update last updated timestamp
 */
function updateLastUpdated() {
  const el = document.getElementById('lastUpdated');
  if (!el) return;

  if (tournamentData.metadata.lastUpdated) {
    const date = new Date(tournamentData.metadata.lastUpdated);
    el.textContent = date.toLocaleString('id-ID');
  }
}

/**
 * Show data modal (placeholder)
 */
function showDataModal() {
  showToast('Data management available in Teams section', 'info');
}

// ================================================
// Toast Notifications
// ================================================

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    'success': 'check_circle',
    'error': 'error',
    'warning': 'warning',
    'info': 'info'
  };

  toast.innerHTML = `
    <span class="material-symbols-outlined toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">
      <span class="material-symbols-outlined">close</span>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// ================================================
// Initialization
// ================================================

// ================================================
// Dashboard & Analytics (Option C)
// ================================================

function renderDashboard() {
  const statProgress = document.getElementById('stat-progress');
  const statGoals = document.getElementById('stat-goals');
  const statCards = document.getElementById('stat-cards');

  if (!statProgress) return;

  const totalMatches = tournamentData.matches.length;
  const finishedMatches = tournamentData.matches.filter(m => m.status === 'finished').length;
  const progress = totalMatches > 0 ? Math.round((finishedMatches / totalMatches) * 100) : 0;

  statProgress.textContent = `${progress}%`;

  let totalGoals = 0;
  let totalYellow = 0;
  let totalRed = 0;
  const playerStats = {}; // { playerId: { name, goals, yellow, red, teamId } }

  tournamentData.matches.forEach(m => {
    (m.events || []).forEach(e => {
      const pId = `${e.teamId}-${e.playerNumber}`;
      if (!playerStats[pId]) {
        playerStats[pId] = { name: e.playerName, goals: 0, yellow: 0, red: 0, teamId: e.teamId };
      }

      if (e.type === 'goal') {
        totalGoals++;
        playerStats[pId].goals++;
      } else if (e.type === 'yellow') {
        totalYellow++;
        playerStats[pId].yellow++;
      } else if (e.type === 'red') {
        totalRed++;
        playerStats[pId].red++;
      }
    });
  });

  statGoals.textContent = totalGoals;
  statCards.textContent = totalYellow + totalRed;

  // Render Top Scorer List
  const topScorerList = document.getElementById('topScorerList');
  const sortedScorers = Object.values(playerStats)
    .filter(p => p.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 10);

  if (sortedScorers.length === 0) {
    topScorerList.innerHTML = '<p class="text-muted" style="text-align: center; padding: 1rem;">No goals recorded yet.</p>';
  } else {
    topScorerList.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${sortedScorers.map((p, i) => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: rgba(255,255,255,0.02); border-radius: 0.5rem; border: 1px solid var(--admin-card-border);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-weight: 900; color: var(--admin-primary); width: 1.5rem;">${i + 1}.</span>
              <div>
                <div style="font-weight: 700; color: var(--admin-text-main);">${p.name}</div>
                <div style="font-size: 0.65rem; color: var(--admin-text-muted);">${p.teamId}</div>
              </div>
            </div>
            <div style="font-weight: 900; font-size: 1.125rem; color: var(--admin-text-main);">${p.goals} <span style="font-size: 0.65rem; color: var(--admin-text-muted);">GOLS</span></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // Render Fair Play List
  const fairPlayList = document.getElementById('fairPlayList');
  const teamsWithCards = tournamentData.teams.map(team => {
    let yellow = 0;
    let red = 0;
    tournamentData.matches.forEach(m => {
      (m.events || []).forEach(e => {
        if (e.teamId === team.id) {
          if (e.type === 'yellow') yellow++;
          if (e.type === 'red') red++;
        }
      });
    });
    return { name: team.name, yellow, red, score: (yellow * 1) + (red * 2) };
  }).sort((a, b) => b.score - a.score).slice(0, 5); // Most cards first for "Anti-Fair Play" or just ranking

  fairPlayList.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
      ${teamsWithCards.map(t => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; background: rgba(255,255,255,0.02); border-radius: 0.5rem; border: 1px solid var(--admin-card-border);">
          <div style="font-weight: 700; color: var(--admin-text-main);">${t.name}</div>
          <div style="display: flex; gap: 0.5rem;">
            <span style="padding: 0.15rem 0.4rem; background: #fbbf24; color: black; border-radius: 3px; font-weight: 800; font-size: 0.7rem;">Y: ${t.yellow}</span>
            <span style="padding: 0.15rem 0.4rem; background: #ef4444; color: white; border-radius: 3px; font-weight: 800; font-size: 0.7rem;">R: ${t.red}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ================================================
// Audit Logs (Option B)
// ================================================

function addAuditLog(action) {
  if (!tournamentData.logs) tournamentData.logs = [];

  tournamentData.logs.unshift({
    timestamp: new Date().toISOString(),
    action: action
  });

  // Limit logs to last 100 entries
  if (tournamentData.logs.length > 100) {
    tournamentData.logs.pop();
  }
}

function renderAuditLogs() {
  const container = document.getElementById('auditLogList');
  if (!container) return;

  if (!tournamentData.logs || tournamentData.logs.length === 0) {
    container.innerHTML = '<p class="text-muted" style="text-align: center; padding: 1rem;">No history yet.</p>';
    return;
  }

  container.innerHTML = tournamentData.logs.map(log => {
    const date = new Date(log.timestamp);
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString();

    return `
      <div style="padding: 0.75rem; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.05); border-radius: 0.5rem; display: flex; align-items: flex-start; gap: 0.75rem;">
        <div style="font-size: 0.65rem; color: var(--admin-primary); font-family: monospace; padding-top: 0.15rem;">
          [${timeStr}]
        </div>
        <div style="font-size: 0.8125rem; color: var(--admin-text-main); flex: 1;">
          ${log.action}
          <div style="font-size: 0.6rem; color: var(--admin-text-muted); margin-top: 0.25rem;">${dateStr}</div>
        </div>
      </div>
    `;
  }).join('');
}

function clearLogs() {
  if (!confirm('Clear all audit logs? This cannot be undone.')) return;
  tournamentData.logs = [];
  saveData();
  renderAuditLogs();
  showToast('Audit logs cleared.', 'info');
}

/**
 * Initialize admin panel
 */
function init() {
  // Check authentication
  checkAuth();

  // Optional: multi-device refresh while admin is open
  setInterval(async () => {
    if (!isLoggedIn) return;
    try {
      if (window.HastmaApi?.getTournamentData) {
        tournamentData = await window.HastmaApi.getTournamentData();
        loadAllAdminData();
      }
    } catch {
      // ignore
    }
  }, 15000);

  console.log('HASTMA CUP #3 2026 - Admin Panel initialized');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/**
 * Set event type for new match event
 */
function setEventType(type, element) {
  // Update hidden input
  const input = document.getElementById('eventType');
  if (input) input.value = type;

  // Update UI active state
  document.querySelectorAll('.admin-event-type-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  element.classList.add('active');
}

/**
 * Handle team selection in event form
 */
function selectEventTeam(teamId, element) {
  const input = document.getElementById('eventTeam');
  if (input) input.value = teamId;

  // Update UI state
  document.querySelectorAll('#eventTeamButtons .admin-selection-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  if (element) element.classList.add('active');

  // Load players
  loadPlayersForEvent();

  // Update Dynamic Theme
  updateEventFormTheme(teamId);
}

/**
 * Adjust event minute via + / - buttons
 */
function adjustEventMinute(delta, elementId = 'eventMinute') {
  const input = document.getElementById(elementId);
  if (!input) return;

  let val = parseInt(input.value) || 0;
  val = Math.max(0, val + delta); // Prevent negative
  input.value = val;
}

/**
 * Apply dynamic theme to event form based on selected team
 */
function updateEventFormTheme(teamId) {
  const form = document.getElementById('eventForm');
  if (!form || !teamId) {
    // Reset to default
    if (form) {
      form.style.borderColor = 'var(--admin-card-border)';
      form.style.boxShadow = 'none';
    }
    return;
  }

  const team = getTeam(teamId);
  if (team && team.color) {
    form.style.borderColor = team.color;
    form.style.boxShadow = `0 0 20px ${team.color}40`; // 25% opacity glow
    form.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  }
}

/**
 * Handle player selection in event form
 */
function selectEventPlayer(number, name, element) {
  // Update hidden inputs
  const numInput = document.getElementById('eventPlayerNumber');
  const nameInput = document.getElementById('eventPlayerName');
  if (numInput) numInput.value = number;
  if (nameInput) nameInput.value = name;

  // Update UI state
  document.querySelectorAll('#eventPlayerButtons .admin-selection-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  if (element) element.classList.add('active');
}

// ================================================
// Mobile FAB Navigation
// ================================================

/**
 * Toggle FAB Menu
 */
function toggleFab() {
  const container = document.getElementById('fabContainer');
  if (container) {
    container.classList.toggle('active');
  }
}

// Close FAB when clicking outside
document.addEventListener('click', (e) => {
  const container = document.getElementById('fabContainer');
  if (container && container.classList.contains('active')) {
    if (!container.contains(e.target) && !e.target.closest('.fab-main-btn')) {
      container.classList.remove('active');
    }
  }
});


// ================================================
// Initialization
// ================================================

window.addEventListener('DOMContentLoaded', () => {
  // Expose functions globally for HTML access variables
  window.logout = logout;

  // Check authentication on load
  checkAuth();
});

/**
 * Logout Function
 */
function logout() {
  if (confirm('Are you sure you want to logout?')) {
    localStorage.removeItem('hastmaAdminSession');
    isLoggedIn = false;
    currentSession = null;

    // Hide dashboard (optional, but good visual feedback)
    // document.querySelector('.page-wrapper').style.display = 'none'; 

    // Show login modal
    showLoginModal();
  }
}
/**
 * Auto-calculate End Time based on start time and stage
 * Group/Semi: 16 mins
 * Final/3rd: 18 mins
 */
function autoCalculateEndTime(startTime, stage) {
  if (!startTime) return '';
  const [hours, minutes] = startTime.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  // Duration in minutes
  let duration = 16;
  if (stage === 'final' || stage === '3rd_place') {
    duration = 18;
  }

  date.setMinutes(date.getMinutes() + duration);

  const endH = String(date.getHours()).padStart(2, '0');
  const endM = String(date.getMinutes()).padStart(2, '0');
  return `${endH}:${endM}`;
}

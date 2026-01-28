/**
 * HASTMA CUP #3 2026 - Main App Logic
 * Modern UI version matching reference design
 * Handles data loading, standings calculation, schedule display, and bracket updates
 */

// Global state
// Global state
let tournamentData = null;
let lastHeroScore = { home: 0, away: 0, matchId: null, eventsCount: 0 };
let expandedMatchIds = new Set();

// ================================================
// Data Management
// ================================================

// API Endpoint
const API_URL = '/api/tournament';

/**
 * Initialize tournament data
 */
async function initData() {
  try {
    // 1. Try API (Vercel KV)
    const res = await fetch(API_URL);
    if (res.ok) {
      const cloudData = await res.json();
      // Ensure cloud data is valid (has teams)
      if (cloudData && cloudData.teams && cloudData.teams.length > 0) {
        tournamentData = cloudData;
        updateTeamColorVariables();
        return;
      }
    }
  } catch (e) {
    console.warn('API fetch failed or empty, falling back to local/default', e);
  }

  // 2. Fallback to LocalStorage or Default
  const stored = localStorage.getItem('hastmaCupData'); // Use same key as admin
  if (stored) {
    try {
      tournamentData = JSON.parse(stored);
    } catch (e) {
      tournamentData = { ...DEFAULT_TOURNAMENT_DATA };
    }
  } else {
    tournamentData = { ...DEFAULT_TOURNAMENT_DATA };
  }

  updateTeamColorVariables();
}

/**
 * Save tournament data (API + localStorage cache)
 */
function saveData() {
  tournamentData.metadata.lastUpdated = new Date().toISOString();

  // Always keep local cache updated
  localStorage.setItem('hastmaCupData', JSON.stringify(tournamentData));

  // Fire-and-forget server save (multi-device)
  const saver = window.HastmaApi?.saveTournamentData;
  if (typeof saver === 'function') {
    saver(tournamentData).catch(() => { });
  }
}

/**
 * Update CSS variables for team colors
 */
function updateTeamColorVariables() {
  const root = document.documentElement;

  tournamentData.teams.forEach(team => {
    const cssVar = `--team-${team.id}`;
    root.style.setProperty(cssVar, team.color);
  });
}

/**
 * Get team by ID
 */
function getTeam(teamId) {
  return tournamentData.teams.find(t => t.id === teamId) || null;
}

/**
 * Get match by ID
 */
function getMatch(matchId) {
  return tournamentData.matches.find(m => m.id === matchId) || null;
}

/**
 * Get display label for match stage
 */
function getStageLabel(match) {
  if (match.stage === 'group') return `Group ${match.group}`;
  if (match.stage === 'semi') return 'Semi Final';
  if (match.stage === 'final') return 'Final';
  if (match.stage === '3rd_place') return '3rd Place Match';
  return match.stage.toUpperCase();
}

/**
 * Find the most relevant match for the Hero section
 */
function findHeroMatch() {
  // 1. Check for LIVE or Half-time match
  let heroMatch = tournamentData.matches.find(m => m.status === 'live' || m.status === 'halftime');
  if (heroMatch) return { match: heroMatch, isLive: true };

  // 2. If none, check for NEXT scheduled match
  const upcomingMatches = tournamentData.matches
    .filter(m => m.status === 'scheduled')
    .sort((a, b) => a.time.localeCompare(b.time));

  if (upcomingMatches.length > 0) {
    return { match: upcomingMatches[0], isLive: false };
  }

  // 3. Fallback to latest finished match
  const finishedMatches = tournamentData.matches
    .filter(m => m.status === 'finished')
    .sort((a, b) => b.time.localeCompare(a.time));

  if (finishedMatches.length > 0) {
    return { match: finishedMatches[0], isLive: false, isFinal: true };
  }

  return null;
}

/**
 * Render the Hero Match section
 */
function renderHeroMatch() {
  const container = document.getElementById('heroMatch');
  if (!container) return;

  const heroData = findHeroMatch();

  // If no match to display
  if (!heroData) {
    if (container.innerHTML !== '') container.innerHTML = '';
    return;
  }

  const { match, isLive, isFinal } = heroData;
  const homeTeam = getTeam(match.homeTeam);
  const awayTeam = getTeam(match.awayTeam);

  const homeName = homeTeam ? homeTeam.name : 'TBD';
  const awayName = awayTeam ? awayTeam.name : 'TBD';

  // Helper to generate badge HTML
  const getBadgeHtml = () => {
    if (isLive) {
      return `
        <div class="hero-live-badge">
          <span class="live-dot"></span>
          LIVE MATCH
        </div>
      `;
    } else if (isFinal) {
      return '<div class="hero-next-badge">Tournament Finished</div>';
    } else {
      return '<div class="hero-next-badge">Coming Up Next</div>';
    }
  };

  // Helper to generate timeline HTML
  /* Legacy timeline generation removed. New implementation below. */
  const getTimelineHtml = () => {
    if (!match.events || match.events.length === 0) return '';

    // Sort events
    const sortedEvents = [...match.events].sort((a, b) => a.minute - b.minute);

    return `
      <div class="ht-container">
        <!-- Central Axis -->
        <div class="ht-line"></div>

        <!-- Events List -->
        ${sortedEvents.map(event => {
      const isHome = event.teamId === match.homeTeam;
      const side = isHome ? 'home' : 'away';
      const teamColor = getTeam(event.teamId)?.color || 'var(--admin-primary)';

      // Icon Determination
      let icon = 'sports_soccer';
      let label = 'GOAL';
      let metaClass = 'goal'; // styling hook if needed

      if (event.type === 'yellow') { icon = 'style'; label = 'YELLOW'; metaClass = 'yellow'; }
      if (event.type === 'red') { icon = 'style'; label = 'RED'; metaClass = 'red'; }

      // Helper for Icon HTML
      const iconHtml = `<div class="ht-icon"><span class="material-symbols-outlined">${icon}</span></div>`;

      // Floating Axis Layout: [Home Card] [Time Pill] [Away Card]
      const homeCard = isHome ? `<div class="ht-card" style="border-right-color: ${teamColor}"><div class="ht-info"><div class="ht-player">${event.playerName || event.player}</div><div class="ht-meta">${getTeam(event.teamId)?.name || 'Team'}</div></div><div class="ht-icon">${event.type === 'goal' ? '⚽' : `<span class="material-symbols-outlined">${icon}</span>`}</div></div>` : '';

      const awayCard = !isHome ? `<div class="ht-card" style="border-left-color: ${teamColor}"><div class="ht-icon">${event.type === 'goal' ? '⚽' : `<span class="material-symbols-outlined">${icon}</span>`}</div><div class="ht-info" style="align-items: flex-start; text-align: left;"><div class="ht-player">${event.playerName || event.player}</div><div class="ht-meta">${getTeam(event.teamId)?.name || 'Team'}</div></div></div>` : '';

      return `<div class="ht-row ${side}">${homeCard}<div class="ht-time">${event.minute}'</div>${awayCard}</div>`;
    }).join('')}
      </div>
    `;
  };

  // Check if we need a full re-render (different match ID, container empty, or status changed)
  const currentMatchId = container.querySelector('.hero-live-card')?.dataset.matchId;
  const currentStatus = container.querySelector('.hero-live-card')?.dataset.matchStatus;
  const needsFullRender = currentMatchId !== match.id || currentStatus !== match.status;

  if (needsFullRender) {
    // FULL RENDER
    container.innerHTML = `
      <div class="hero-live-card" data-match-id="${match.id}" data-match-status="${match.status}">
        <div id="goalEffectOverlay"></div>
        <div class="hero-match-status" id="heroMatchStatus">
          ${getBadgeHtml()}
          <div class="hero-match-info" style="margin-top: 0.5rem; color: var(--admin-text-muted); font-size: 0.875rem;">
            <span id="heroStageLabel">${getStageLabel(match)}</span> • <span id="heroTimeLabel">${match.time}</span>
          </div>
        </div>

        <div class="hero-match-teams">
          <div class="hero-team">
            <div class="hero-team-logo">
              <span class="material-symbols-outlined" style="font-size: 3.5rem; color: var(--admin-primary);">shield</span>
            </div>
            <span class="hero-team-name" id="heroHomeName">${homeName}</span>
          </div>

          <div class="hero-score-area">
            <div class="hero-score">
              <span id="heroHomeScore">${match.homeScore}</span>
              <span class="hero-vs">-</span>
              <span id="heroAwayScore">${match.awayScore}</span>
            </div>
          </div>

          <div class="hero-team">
            <div class="hero-team-logo">
              <span class="material-symbols-outlined" style="font-size: 3.5rem; color: var(--admin-text-muted);">shield</span>
            </div>
            <span class="hero-team-name" id="heroAwayName">${awayName}</span>
          </div>
        </div>

        <div id="heroTimelineArea">
          ${getTimelineHtml()}
        </div>

        <div class="hero-match-info">
          <div class="hero-venue">
            <span class="material-symbols-outlined" style="font-size: 1rem;">location_on</span>
            ${match.venue}
          </div>
          ${isLive ? '<div style="width: 1px; height: 1rem; background: var(--admin-card-border);"></div>' : ''}
          <div id="heroLiveStatusText">
          ${isLive ? `<div style="color: var(--admin-primary); font-weight: 800;">${match.status === 'halftime' ? 'HALF TIME' : "IN PROGRESS"}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  } else {
    // PARTIAL UPDATE (Preserve Animations)
    const homeScoreEl = document.getElementById('heroHomeScore');
    const awayScoreEl = document.getElementById('heroAwayScore');
    const timelineArea = document.getElementById('heroTimelineArea');
    const liveStatusText = document.getElementById('heroLiveStatusText');
    const matchStatusArea = document.getElementById('heroMatchStatus');

    if (homeScoreEl) homeScoreEl.textContent = match.homeScore;
    if (awayScoreEl) awayScoreEl.textContent = match.awayScore;

    // Update status badge if status area exists
    if (matchStatusArea) {
      matchStatusArea.innerHTML = `
        ${getBadgeHtml()}
        <div class="hero-match-info" style="margin-top: 0.5rem; color: var(--admin-text-muted); font-size: 0.875rem;">
          <span id="heroStageLabel">${getStageLabel(match)}</span> • <span id="heroTimeLabel">${match.time}</span>
        </div>
      `;
    }

    // Only update timeline if events changed
    const currentEventsCount = match.events ? match.events.length : 0;
    const previousEventsCount = lastHeroScore.eventsCount || 0;

    // FORCE UPDATE for layout fixes (Optimization temporarily disabled)
    // if (currentEventsCount !== previousEventsCount) {
    if (timelineArea) timelineArea.innerHTML = getTimelineHtml();
    // }

    // Update status text
    if (liveStatusText) {
      liveStatusText.innerHTML = isLive ? `<div style="color: var(--admin-primary); font-weight: 800;">${match.status === 'halftime' ? 'HALF TIME' : "IN PROGRESS"}</div>` : '';
    }
  }

  // Detect New Events for Effects (Goals, Cards)
  const currentEventsCount = match.events ? match.events.length : 0;
  const previousEventsCount = lastHeroScore.eventsCount || 0;

  if (isLive && match.id === lastHeroScore.matchId && currentEventsCount > previousEventsCount) {
    // Get new events
    const newEvents = match.events.slice(previousEventsCount);

    // Trigger effect for the most recent event (to avoid spamming if multiple loaded at once)
    const latestEvent = newEvents[newEvents.length - 1];
    const team = getTeam(latestEvent.teamId);
    const teamName = team ? team.name : 'Unknown Team';

    if (latestEvent.type === 'goal') {
      triggerGoalEffect(teamName, latestEvent.playerName);
    } else if (latestEvent.type === 'yellow' || latestEvent.type === 'red') {
      triggerCardEffect(latestEvent.type, teamName, latestEvent.playerName);
    }
  }
  // Fallback: Score changed but no event recorded (Legacy/Quick update)
  else if (isLive && match.id === lastHeroScore.matchId) {
    if (match.homeScore > lastHeroScore.home) {
      triggerGoalEffect(homeName, null);
    } else if (match.awayScore > lastHeroScore.away) {
      triggerGoalEffect(awayName, null);
    }
  }

  // Update score tracking for next time
  lastHeroScore = {
    home: match.homeScore,
    away: match.awayScore,
    matchId: match.id,
    eventsCount: currentEventsCount
  };
}

/**
 * Trigger the eccentric Goal Celebration effect
 */
function triggerGoalEffect(teamName, playerName) {
  const overlayContainer = document.getElementById('goalEffectOverlay');
  if (!overlayContainer) return;

  // Play goal sound effect
  const audio = new Audio('goal sound effect.mp3');
  audio.play().catch(e => console.warn('Goal sound playback failed:', e));

  const playerHtml = playerName ? `<div class="goal-player-name">${playerName}</div>` : '';

  // Create overlay element
  overlayContainer.innerHTML = `
    <div class="goal-overlay active">
      <div class="goal-text-container">
        <span class="goal-text">GOAAAAAL!</span>
        <div class="goal-team-name">${teamName}</div>
        ${playerHtml}
      </div>
      <div class="confetti-container" id="confettiField"></div>
    </div>
  `;

  // Create confetti
  const field = document.getElementById('confettiField');
  if (field) {
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.backgroundColor = ['#3b82f6', '#10b981', '#f29040', '#ef4444', '#ffffff'][Math.floor(Math.random() * 5)];
      confetti.style.width = (Math.random() * 8 + 4) + 'px';
      confetti.style.height = confetti.style.width;
      confetti.style.animationDuration = (Math.random() * 2 + 1) + 's';
      confetti.style.animationDelay = (Math.random() * 0.5) + 's';
      field.appendChild(confetti);
    }
  }

  // Remove overlay after 4 seconds
  setTimeout(() => {
    overlayContainer.innerHTML = '';
  }, 4000);
}

/**
 * Trigger Card Effect (Yellow/Red)
 */
function triggerCardEffect(type, teamName, playerName) {
  const overlayContainer = document.getElementById('goalEffectOverlay');
  if (!overlayContainer) return;

  const title = type === 'yellow' ? 'YELLOW CARD' : 'RED CARD';
  const icon = type === 'yellow' ? 'style' : 'style'; // Using same icon, color handled by class
  const colorClass = type; // 'yellow' or 'red'

  overlayContainer.innerHTML = `
    <div class="card-overlay ${colorClass} active">
      <div class="card-content">
        <span class="material-symbols-outlined card-icon-large">${icon}</span>
        <div class="card-title">${title}</div>
        <div class="card-player-name">${playerName}</div>
        <div class="card-team-name">${teamName}</div>
      </div>
    </div>
  `;

  // Remove overlay after 3 seconds (shorter than goal)
  setTimeout(() => {
    overlayContainer.innerHTML = '';
  }, 3000);
}


// ================================================
// Standings Calculation
// ================================================

/**
 * Calculate standings for a group
 */
function calculateStandings(group) {
  const groupTeams = tournamentData.teams.filter(t => t.group === group);
  const groupMatches = tournamentData.matches.filter(
    m => m.stage === 'group' && m.group === group && m.status === 'finished'
  );

  const standings = groupTeams.map(team => ({
    team: team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
    fairPlayPoints: 0 // yellow=1, red=2 (lower is better)
  }));

  // Calculate from matches
  groupMatches.forEach(match => {
    const homeTeam = standings.find(s => s.team.id === match.homeTeam);
    const awayTeam = standings.find(s => s.team.id === match.awayTeam);

    if (homeTeam && awayTeam) {
      homeTeam.played++;
      awayTeam.played++;

      homeTeam.goalsFor += match.homeScore;
      homeTeam.goalsAgainst += match.awayScore;

      awayTeam.goalsFor += match.awayScore;
      awayTeam.goalsAgainst += match.homeScore;

      // Fair play points from events
      const events = match.events || [];
      for (const e of events) {
        if (!e || !e.teamId) continue;
        const teamRow = standings.find(s => s.team.id === e.teamId);
        if (!teamRow) continue;

        if (e.type === 'yellow') teamRow.fairPlayPoints += 1;
        if (e.type === 'red') teamRow.fairPlayPoints += 2;
      }

      if (match.homeScore > match.awayScore) {
        homeTeam.won++;
        homeTeam.points += 3;
        awayTeam.lost++;
      } else if (match.homeScore < match.awayScore) {
        awayTeam.won++;
        awayTeam.points += 3;
        homeTeam.lost++;
      } else {
        homeTeam.drawn++;
        awayTeam.drawn++;
        homeTeam.points += 1;
        awayTeam.points += 1;
      }
    }
  });

  // Sort (tie-breaker):
  // 1) points (desc)
  // 2) goal difference (desc)
  // 3) goals for (desc)
  // 4) goals against (asc)  [kebobolan lebih sedikit lebih baik]
  // 5) fair play points (asc) [kartu lebih sedikit lebih baik; yellow=1 red=2]
  // 6) deterministic fallback ("koin tos")
  standings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;

    const aGD = a.goalsFor - a.goalsAgainst;
    const bGD = b.goalsFor - b.goalsAgainst;
    if (bGD !== aGD) return bGD - aGD;

    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;

    if (a.goalsAgainst !== b.goalsAgainst) return a.goalsAgainst - b.goalsAgainst;

    if ((a.fairPlayPoints ?? 0) !== (b.fairPlayPoints ?? 0)) return (a.fairPlayPoints ?? 0) - (b.fairPlayPoints ?? 0);

    // "koin tos" -> keep deterministic ordering to avoid flicker
    const aKey = (a.team.name || a.team.id || '').toString();
    const bKey = (b.team.name || b.team.id || '').toString();
    return aKey.localeCompare(bKey);
  });

  return standings;
}

/**
 * Render standings table
 */
function renderStandings() {
  const standingsA = calculateStandings('A');
  const standingsB = calculateStandings('B');

  renderStandingsTable('standingsBodyA', standingsA);
  renderStandingsTable('standingsBodyB', standingsB);

  // Update bracket with qualified teams
  updateBracketTeams(standingsA, standingsB);
}

/**
 * Render a single standings table
 */
function renderStandingsTable(containerId, standings) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = standings.map((s, index) => {
    const goalDiff = s.goalsFor - s.goalsAgainst;
    const goalDiffStr = goalDiff > 0 ? `+${goalDiff}` : goalDiff.toString();

    let rowClass = '';
    let pointsClass = 'default';

    if (s.played > 0 || index < 2) {
      if (index === 0) {
        rowClass = 'qualifier-winner';
        pointsClass = 'highlight';
      } else if (index === 1) {
        rowClass = 'qualifier-runnerup';
        if (s.points > 0) pointsClass = 'highlight';
      }
    }

    return `
      <tr class="${rowClass}">
        <td class="team-name-cell">${s.team.name}</td>
        <td class="stats-cell">${s.played}</td>
        <td class="stats-cell">${s.won}</td>
        <td class="stats-cell">${s.drawn}</td>
        <td class="stats-cell">${s.lost}</td>
        <td class="stats-cell">${s.goalsFor}</td>
        <td class="stats-cell">${s.goalsAgainst}</td>
        <td class="points-cell">
          <span class="points-badge ${pointsClass}">${s.points}</span>
        </td>
      </tr>
    `;
  }).join('');
}

// ================================================
// Schedule Display
// ================================================

/**
 * Render all matches
 */
function renderSchedule() {
  const matches = tournamentData.matches;
  const regularMatches = [...matches].sort((a, b) => a.time.localeCompare(b.time));

  // Render matches
  const scheduleContainer = document.getElementById('regularMatches');
  if (scheduleContainer) {
    scheduleContainer.innerHTML = '';
    let knockoutHeaderAdded = false;

    regularMatches.forEach(match => {
      // Add separator for knockout stage
      if (match.stage !== 'group' && !knockoutHeaderAdded) {
        const separator = document.createElement('div');
        separator.className = 'schedule-stage-separator';
        separator.innerHTML = '<span>BABAK GUGUR (KNOCKOUT STAGE)</span>';
        scheduleContainer.appendChild(separator);
        knockoutHeaderAdded = true;
      }

      const card = document.createElement('div');
      card.innerHTML = renderRegularMatchCard(match);
      scheduleContainer.appendChild(card.firstElementChild);
    });
  }
}

/**
 * Render a live match card with timeline
 */
function renderLiveMatchCard(match) {
  const homeTeam = getTeam(match.homeTeam);
  const awayTeam = getTeam(match.awayTeam);

  const homeName = homeTeam ? homeTeam.name : 'TBD';
  const awayName = awayTeam ? awayTeam.name : 'TBD';

  // Timeline HTML
  const eventsHtml = renderTimelineEvents(match);

  return `
    <div class="match-card-live">
      <div class="match-card-live-header">
        <div class="match-live-indicator">
          <div class="live-dot"></div>
          <span class="live-text">Live Now</span>
        </div>
        <span class="match-meta">${match.venue} • ${getStageLabel(match)}</span>
      </div>
      <div class="match-card-live-body">
        <div class="match-team-live">
          <div class="team-shield">
            <span class="material-symbols-outlined">shield</span>
          </div>
          <span class="team-name-live ${match.homeScore >= match.awayScore ? 'winner' : 'loser'}">${homeName}</span>
        </div>
        <div class="match-score-live">
          <div class="score-display">
            <span class="score-number ${match.homeScore > match.awayScore ? 'primary' : 'white'}">${match.homeScore}</span>
            <span class="score-divider">-</span>
            <span class="score-number ${match.awayScore > match.homeScore ? 'primary' : 'white'}">${match.awayScore}</span>
          </div>
          <div class="match-period">
            <span>Second Half</span>
          </div>
        </div>
        <div class="match-team-live">
          <div class="team-shield away">
            <span class="material-symbols-outlined">shield</span>
          </div>
          <span class="team-name-live ${match.awayScore >= match.homeScore ? 'winner' : 'loser'}">${awayName}</span>
        </div>
      </div>
      ${eventsHtml}
    </div>
  `;
}

/**
 * Render timeline events for live match
 */
function renderTimelineEvents(match) {
  if (!match.events || match.events.length === 0) {
    return '';
  }

  const eventsHtml = match.events.map(event => {
    const isPrimary = event.type === 'goal';
    const icon = event.type === 'goal' ? 'sports_soccer' : 'event';

    return `
      <div class="timeline-item">
        <div class="timeline-icon ${isPrimary ? 'primary' : 'neutral'}">
          <span class="material-symbols-outlined">${icon}</span>
        </div>
        <div class="timeline-content">
          <span class="timeline-player">${event.playerName}<span class="timeline-minute">${event.minute}'</span></span>
          <span class="timeline-desc">${event.type === 'goal' ? 'Goal scored' : 'Card shown'} • ${getTeam(event.teamId)?.name || 'Team'}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="match-details-live">
      <div class="timeline-header">
        <span class="material-symbols-outlined">sports_soccer</span>
        <span class="timeline-title">Goal Timeline</span>
      </div>
      <div class="timeline">${eventsHtml}</div>
    </div>
  `;
}

/**
 * Render a regular match card
 */
function renderRegularMatchCard(match) {
  const homeTeam = getTeam(match.homeTeam);
  const awayTeam = getTeam(match.awayTeam);

  const homeName = homeTeam ? homeTeam.name : 'TBD';
  const awayName = awayTeam ? awayTeam.name : 'TBD';

  const statusClass = match.status;
  const statusText = {
    'scheduled': 'Scheduled',
    'live': 'Live',
    'finished': 'Finished',
    'halftime': 'Half Time'
  }[match.status] || 'Scheduled';

  // Display time range
  const timeDisplay = match.endTime ? `${match.time} - ${match.endTime}` : match.time;

  const isLive = match.status === 'live' || match.status === 'halftime';
  const isFinished = match.status === 'finished';

  let homeWinnerClass = '';
  let awayWinnerClass = '';

  if (isFinished) {
    if (match.homeScore > match.awayScore) homeWinnerClass = 'winner';
    else if (match.awayScore > match.homeScore) awayWinnerClass = 'winner';
  }

  // Determine group/stage label
  let groupLabel = '';
  if (match.stage === 'group') groupLabel = `Group ${match.group}`;
  else if (match.stage === 'semi') groupLabel = 'Semi Final';
  else if (match.stage === 'final') groupLabel = 'Final';
  else if (match.stage === '3rd_place') groupLabel = '3rd Place';

  // Events HTML
  const eventsHtml = renderMatchEvents(match);

  const isKnockout = match.stage !== 'group';

  const isExpanded = expandedMatchIds.has(match.id);

  return `
    <div class="match-card-regular ${statusClass} ${isLive ? 'is-live' : ''} ${isFinished ? 'is-finished' : ''} ${isKnockout ? 'is-knockout' : ''} ${isExpanded ? 'expanded' : ''} ${match.events && match.events.length > 0 ? 'clickable' : ''}"
         onclick="toggleMatchDetails('${match.id}')" data-match-id="${match.id}">
      <div class="match-card-left">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem; flex-wrap: wrap;">
          <span class="match-status-badge ${statusClass}">${statusText}</span>
          ${isLive ? '<span class="live-badge-mini">LIVE!</span>' : ''}
          <span class="match-group-badge">${groupLabel}</span>
        </div>
        <div class="match-teams">
          <span class="match-team-name ${homeWinnerClass}">${homeName}</span>
          ${isFinished || isLive ? `
            <div class="match-score-badge">
              <span class="score-num">${match.homeScore}</span>
              <span class="score-sep">:</span>
              <span class="score-num">${match.awayScore}</span>
            </div>
          ` : '<span class="match-vs">VS</span>'}
          <span class="match-team-name away ${awayWinnerClass}">${awayName}</span>
        </div>
      </div>
      <div class="match-card-right">
        ${isFinished ? `
          <button class="btn-quick-share" onclick="event.stopPropagation(); showShareCard('${match.id}')" title="Bagikan Hasil">
            <span class="material-symbols-outlined">share</span>
          </button>
        ` : ''}
        <span class="match-time-badge">${timeDisplay}</span>
        <span class="match-venue">${match.venue}</span>
      </div>
      <div class="match-details-expanded" id="details-${match.id}">
        ${eventsHtml}
        <div class="match-card-actions">
          ${isFinished ? `
            <button class="share-btn" onclick="event.stopPropagation(); showShareCard('${match.id}')">
              <span class="material-symbols-outlined" style="font-size: 1.1rem;">share</span>
              Bagikan Hasil
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Show Shareable Match Card
 */
function showShareCard(matchId) {
  const match = tournamentData.matches.find(m => m.id === matchId);
  if (!match) return;

  const homeTeam = tournamentData.teams.find(t => t.id === match.homeTeam);
  const awayTeam = tournamentData.teams.find(t => t.id === match.awayTeam);
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
        HASTMA CUP #3 • TOURNAMENT 2026
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
    // scale 2 for better quality
    const canvas = await html2canvas(card, {
      scale: 2,
      backgroundColor: '#0f172a', // Match theme background
      useCORS: true,
      logging: false,
      allowTaint: true
    });

    return new Promise(resolve => {
      canvas.toBlob(blob => resolve(blob), 'image/png', 1.0);
    });
  } catch (err) {
    console.error('Failed to generate image:', err);
    return null;
  }
}

/**
 * Download Result Card as Image
 */
async function downloadResultCard() {
  const matchId = document.querySelector('#shareOverlay [data-match-id]')?.dataset.matchId || 'match-result';
  showToast('Generating image...', 'info');

  const blob = await generateImageBlob();
  if (!blob) {
    showToast('Failed to generate image', 'danger');
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hastmacup-${matchId}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Image downloaded!', 'success');
}

/**
 * Share Result Card via Native Share API
 */
async function shareResultCard() {
  const matchId = document.querySelector('#shareOverlay [data-match-id]')?.dataset.matchId || 'match-result';
  const blob = await generateImageBlob();
  if (!blob) {
    showToast('Failed to generate image', 'danger');
    return;
  }

  const file = new File([blob], `hastmacup-${matchId}.png`, { type: 'image/png' });

  try {
    await navigator.share({
      files: [file],
      title: 'HASTMA CUP #3 - Match Result',
      text: 'Cek hasil pertandingan HASTMA CUP #3 2026!'
    });
    showToast('Shared successfully!', 'success');
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err);
      showToast('Share failed', 'danger');
    }
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
 * Render match events
 */
function renderMatchEvents(match) {
  if (!match.events || match.events.length === 0) {
    return '<p class="no-events">No events recorded yet.</p>';
  }

  const eventsHtml = match.events.map(event => {
    const isHome = event.teamId === match.homeTeam;
    const team = getTeam(event.teamId);
    const teamColor = team ? team.color : '#666';

    const eventIcon = {
      'goal': '⚽',
      'yellow': '🟨',
      'red': '🟥'
    }[event.type] || '📋';

    // Alignment styles based on side
    const sideStyle = isHome
      ? 'flex-direction: row; text-align: left;'
      : 'flex-direction: row-reverse; text-align: right; background: rgba(255,255,255,0.01);';
    const markerStyle = isHome
      ? `border-left: 3px solid ${teamColor};`
      : `border-right: 3px solid ${teamColor};`;

    return `
      <div class="event-item" style="padding: 0.625rem 0.875rem; border-radius: 0.75rem; border: 1px solid var(--admin-card-border); display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; ${sideStyle} ${markerStyle}">
        <div style="display: flex; align-items: center; gap: 0.875rem; ${isHome ? '' : 'flex-direction: row-reverse;'}">
          <div style="width: 1.75rem; height: 1.75rem; background: rgba(255,255,255,0.05); border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; font-size: 1rem;">
            ${eventIcon}
          </div>
          <div>
            <p style="font-weight: 800; color: var(--admin-text-main); line-height: 1.2; font-size: 0.9375rem;">${event.playerName}</p>
            <p style="font-size: 0.7rem; color: var(--admin-text-muted); text-transform: uppercase; letter-spacing: 0.025em; font-weight: 700;">
              ${event.type} • ${team ? team.name : 'Unknown'}
            </p>
          </div>
        </div>
        <div style="font-weight: 900; color: var(--admin-primary); font-size: 0.875rem; margin: 0 0.5rem;">
          ${event.minute}'
        </div>
      </div>
    `;
  }).join('');

  return `<div class="event-list" style="display: flex; flex-direction: column; gap: 0.25rem; margin-top: 1rem;">${eventsHtml}</div>`;
}

/**
 * Toggle match details visibility
 */
function toggleMatchDetails(matchId) {
  const card = document.querySelector(`[data-match-id="${matchId}"]`);
  if (card && card.classList.contains('clickable')) {
    const isExpanding = !card.classList.contains('expanded');
    card.classList.toggle('expanded');

    if (isExpanding) {
      expandedMatchIds.add(matchId);
    } else {
      expandedMatchIds.delete(matchId);
    }
  }
}

// ================================================
// Bracket Management
// ================================================

/**
 * Check if all group matches are finished for a given group
 */
function isGroupFinished(group) {
  const groupMatches = tournamentData.matches.filter(
    m => m.stage === 'group' && m.group === group
  );
  return groupMatches.length > 0 && groupMatches.every(m => m.status === 'finished');
}

/**
 * Update bracket with qualified teams
 */
function updateBracketTeams(standingsA, standingsB) {
  const groupAFinished = isGroupFinished('A');
  const groupBFinished = isGroupFinished('B');

  // SF1: Winner A vs Runner-up B
  // SF1: Winner A vs Runner-up B
  const sf1Home = groupAFinished ? standingsA[0]?.team : null;
  const sf1Away = groupBFinished ? standingsB[1]?.team : null;
  updateBracketMatch('SF1', sf1Home, sf1Away, 'Winner Group A', 'Runner-up Group B');

  // SF2: Winner B vs Runner-up A
  const sf2Home = groupBFinished ? standingsB[0]?.team : null;
  const sf2Away = groupAFinished ? standingsA[1]?.team : null;
  updateBracketMatch('SF2', sf2Home, sf2Away, 'Winner Group B', 'Runner-up Group A');

  // Final & 3rd Place: Winners/Losers of SF1 and SF2
  updateFinalBracket();
}

/**
 * Update a bracket match with teams
 */
function updateBracketMatch(matchId, homeTeam, awayTeam, homePlaceholder = 'TBD', awayPlaceholder = 'TBD') {
  const match = getMatch(matchId);
  const bracketEl = document.getElementById(`bracket${matchId}`);

  if (!bracketEl) return;

  // Update match data if teams are determined
  if (match) {
    match.homeTeam = homeTeam ? homeTeam.id : null;
    match.awayTeam = awayTeam ? awayTeam.id : null;
  }

  // Update UI
  const homeSlot = bracketEl.querySelector('[data-slot="home"]');
  const awaySlot = bracketEl.querySelector('[data-slot="away"]');

  if (homeSlot) {
    const nameEl = homeSlot.querySelector('.team-name');
    const scoreEl = homeSlot.querySelector('.bracket-team-score');
    const colorEl = homeSlot.querySelector('.bracket-team-color');

    if (homeTeam) {
      if (nameEl) nameEl.textContent = homeTeam.name;
      if (scoreEl) scoreEl.textContent = match ? match.homeScore : '-';
      if (colorEl) colorEl.style.background = homeTeam.color;
      homeSlot.classList.remove('tbd');
    } else {
      if (nameEl) nameEl.textContent = homePlaceholder;
      if (scoreEl) scoreEl.textContent = '-';
      homeSlot.classList.add('tbd');
    }
  }

  if (awaySlot) {
    const nameEl = awaySlot.querySelector('.team-name');
    const scoreEl = awaySlot.querySelector('.bracket-team-score');
    const colorEl = awaySlot.querySelector('.bracket-team-color');

    if (awayTeam) {
      if (nameEl) nameEl.textContent = awayTeam.name;
      if (scoreEl) scoreEl.textContent = match ? match.awayScore : '-';
      if (colorEl) colorEl.style.background = awayTeam.color;
      awaySlot.classList.remove('tbd');
    } else {
      if (nameEl) nameEl.textContent = awayPlaceholder;
      if (scoreEl) scoreEl.textContent = '-';
      awaySlot.classList.add('tbd');
    }
  }

  // saveData(); // REMOVED: Public view should not trigger server saves
}

/**
 * Update final and 3rd place bracket based on semi-final results
 */
function updateFinalBracket() {
  const sf1 = getMatch('SF1');
  const sf2 = getMatch('SF2');
  const finalMatch = getMatch('F1');
  const m3rdMatch = getMatch('M3RD');
  const finalEl = document.getElementById('bracketF1');
  const m3rdEl = document.getElementById('bracketM3RD');

  if (!finalEl || !finalMatch) return;

  let sf1Winner = null, sf1Loser = null;
  let sf2Winner = null, sf2Loser = null;

  // Determine SF1 results
  if (sf1 && sf1.status === 'finished') {
    if (sf1.homeScore > sf1.awayScore) {
      sf1Winner = getTeam(sf1.homeTeam);
      sf1Loser = getTeam(sf1.awayTeam);
    } else if (sf1.awayScore > sf1.homeScore) {
      sf1Winner = getTeam(sf1.awayTeam);
      sf1Loser = getTeam(sf1.homeTeam);
    }
  }

  // Determine SF2 results
  if (sf2 && sf2.status === 'finished') {
    if (sf2.homeScore > sf2.awayScore) {
      sf2Winner = getTeam(sf2.homeTeam);
      sf2Loser = getTeam(sf2.awayTeam);
    } else if (sf2.awayScore > sf2.homeScore) {
      sf2Winner = getTeam(sf2.awayTeam);
      sf2Loser = getTeam(sf2.homeTeam);
    }
  }

  // Update match data
  if (sf1Winner && sf2Winner && finalMatch) {
    finalMatch.homeTeam = sf1Winner.id;
    finalMatch.awayTeam = sf2Winner.id;
  }

  if (sf1Loser && sf2Loser && m3rdMatch) {
    m3rdMatch.homeTeam = sf1Loser.id;
    m3rdMatch.awayTeam = sf2Loser.id;
  }

  // saveData(); // REMOVED: Public view should not trigger server saves

  // Update Final UI
  updateBracketUI(finalEl, sf1Winner, sf2Winner, finalMatch, 'Winner SF1', 'Winner SF2');

  // Update 3rd Place UI
  if (m3rdEl && m3rdMatch) {
    updateBracketUI(m3rdEl, sf1Loser, sf2Loser, m3rdMatch, 'Loser SF1', 'Loser SF2');
  }
}

/**
 * Helper to update bracket UI elements
 */
function updateBracketUI(bracketEl, homeTeam, awayTeam, match, homePlaceholder, awayPlaceholder) {
  const homeSlot = bracketEl.querySelector('[data-slot="home"]');
  const awaySlot = bracketEl.querySelector('[data-slot="away"]');

  if (homeSlot) {
    const nameEl = homeSlot.querySelector('.team-name');
    const scoreEl = homeSlot.querySelector('.bracket-team-score');
    const colorEl = homeSlot.querySelector('.bracket-team-color');

    if (homeTeam) {
      if (nameEl) nameEl.textContent = homeTeam.name;
      if (scoreEl) scoreEl.textContent = match.homeScore;
      if (colorEl) colorEl.style.background = homeTeam.color;
      homeSlot.classList.remove('tbd');
    } else {
      if (nameEl) nameEl.textContent = homePlaceholder;
      if (scoreEl) scoreEl.textContent = '-';
      if (colorEl) colorEl.style.background = 'var(--status-scheduled)';
      homeSlot.classList.add('tbd');
    }
  }

  if (awaySlot) {
    const nameEl = awaySlot.querySelector('.team-name');
    const scoreEl = awaySlot.querySelector('.bracket-team-score');
    const colorEl = awaySlot.querySelector('.bracket-team-color');

    if (awayTeam) {
      if (nameEl) nameEl.textContent = awayTeam.name;
      if (scoreEl) scoreEl.textContent = match.awayScore;
      if (colorEl) colorEl.style.background = awayTeam.color;
      awaySlot.classList.remove('tbd');
    } else {
      if (nameEl) nameEl.textContent = awayPlaceholder;
      if (scoreEl) scoreEl.textContent = '-';
      if (colorEl) colorEl.style.background = 'var(--status-scheduled)';
      awaySlot.classList.add('tbd');
    }
  }
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
 * Refresh all data and UI
 */
function refreshAll() {
  // Re-read from localStorage in case it was updated by admin
  const stored = localStorage.getItem('hastmaCupData');
  if (stored) {
    try {
      tournamentData = JSON.parse(stored);
      updateTeamColorVariables();
    } catch (e) {
      console.error('Error parsing stored data:', e);
    }
  }

  renderStandings();
  renderSchedule();
  renderHeroMatch();
  updateLastUpdated();
}

// ================================================
// Instant Synchronization
// ================================================

/**
 * Sync when localStorage changes (from Admin tab)
 */
function setupInstantSync() {
  window.addEventListener('storage', (event) => {
    if (event.key === 'hastmaCupData') {
      console.log('Detected storage change, refreshing UI...');
      refreshAll();
    }
  });
}

// ================================================
// Toast Notifications
// ================================================

/**
 * Show a toast notification
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

  // Auto-remove after 5 seconds
  setTimeout(() => {
    toast.remove();
  }, 5000);
}

// ================================================
// Initialization
// ================================================

/**
 * Initialize the app
 */
async function init() {
  await initData();
  refreshAll();
  setupInstantSync();

  // Multi-device sync: poll server periodically (lightweight)
  // If API unavailable, keep showing cached/local data.
  setInterval(async () => {
    try {
      if (window.HastmaApi?.getTournamentData) {
        tournamentData = await window.HastmaApi.getTournamentData();
        updateTeamColorVariables();
        refreshAll();
      }
    } catch {
      // ignore
    }
  }, 15000);

  console.log('HASTMA CUP #3 2026 - App initialized (Instant Sync + Polling enabled)');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
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

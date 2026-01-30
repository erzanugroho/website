/**
 * HASTMA CUP 2026 - Pick'em Logic
 * Handles interactive bracket, prediction state, and anti-cheat hash generation.
 */

// Use Global variable from data.js
let tournamentData = {};

function loadData() {
    tournamentData = window.DEFAULT_TOURNAMENT_DATA || {};
}

let bracketState = {
    // Group Selections: { A: {first: ID, second: ID}, B: {first: ID, second: ID} }
    groups: {
        A: { first: null, second: null },
        B: { first: null, second: null }
    },
    // SF Matches are derived from groups
    sf: [],
    final: [],
    winner: null,
    predictorName: ''
};

// Tournament start time: 31 Januari 2026, 16:00 WIB (UTC+7)
const TOURNAMENT_START_TIME = new Date('2026-01-31T16:00:00+07:00').getTime();

let isLocked = false;
let isTimeLocked = false;

// Check if tournament has started
function checkTimeLock() {
    const now = new Date().getTime();
    return now >= TOURNAMENT_START_TIME;
}

// Format time remaining
function formatTimeRemaining(ms) {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (days > 0) return `${days}h ${hours}j ${minutes}m`;
    if (hours > 0) return `${hours}j ${minutes}m ${seconds}d`;
    return `${minutes}m ${seconds}d`;
}

// Show time lock overlay
function showTimeLockOverlay() {
    const existingOverlay = document.getElementById('timeLockOverlay');
    if (existingOverlay) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'timeLockOverlay';
    overlay.className = 'fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center';
    overlay.innerHTML = `
        <div class="text-center p-8 max-w-md">
            <div class="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <span class="material-symbols-outlined text-4xl text-red-500">lock</span>
            </div>
            <h2 class="text-2xl font-bold text-white mb-2">Prediksi Ditutup</h2>
            <p class="text-gray-400 mb-6">Waktu prediksi telah berakhir. Turnamen HASTMA CUP 2026 sudah dimulai pada <strong class="text-yellow-400">31 Januari 2026 pukul 16:00 WIB</strong>.</p>
            <div class="bg-slate-800/50 rounded-xl p-4 border border-white/10">
                <p class="text-sm text-gray-500 mb-1">Status</p>
                <p class="text-red-400 font-bold">⛔ Prediksi Ditutup</p>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Hide form elements
    const mainContent = document.querySelector('main');
    if (mainContent) {
        mainContent.style.filter = 'blur(4px)';
        mainContent.style.pointerEvents = 'none';
    }
}

// Show countdown overlay
function showCountdownOverlay() {
    const existingOverlay = document.getElementById('countdownOverlay');
    if (existingOverlay) existingOverlay.remove();
    
    const now = new Date().getTime();
    const timeRemaining = TOURNAMENT_START_TIME - now;
    
    if (timeRemaining <= 0) return;
    
    const banner = document.createElement('div');
    banner.id = 'countdownOverlay';
    banner.className = 'fixed bottom-0 left-0 right-0 z-[100] bg-gradient-to-r from-yellow-600/90 to-orange-600/90 backdrop-blur-sm py-3 px-4 text-center';
    banner.innerHTML = `
        <div class="flex items-center justify-center gap-3">
            <span class="material-symbols-outlined text-yellow-200">timer</span>
            <span class="font-bold text-white">Prediksi ditutup dalam: <span id="countdownTimer" class="font-mono text-yellow-200">${formatTimeRemaining(timeRemaining)}</span></span>
        </div>
    `;
    document.body.appendChild(banner);
    
    // Update countdown every second
    const countdownInterval = setInterval(() => {
        const now = new Date().getTime();
        const timeRemaining = TOURNAMENT_START_TIME - now;
        
        if (timeRemaining <= 0) {
            clearInterval(countdownInterval);
            location.reload(); // Reload to apply lock
            return;
        }
        
        const timerEl = document.getElementById('countdownTimer');
        if (timerEl) {
            timerEl.textContent = formatTimeRemaining(timeRemaining);
        }
    }, 1000);
}

// Initial Setup
document.addEventListener('DOMContentLoaded', async () => {
    // DEV TOOL: Check for reset param
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'true') {
        localStorage.removeItem('hastmaPickemLock');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Check time lock first
    isTimeLocked = checkTimeLock();
    const hasExistingPick = localStorage.getItem('hastmaPickemLock');

    loadData();
    
    // Check for previous lock
    const encryptedLock = localStorage.getItem('hastmaPickemLock');
    if (encryptedLock) {
        restoreFromLock(encryptedLock);
    } else {
        initBracket();
    }
    
    // Apply time lock if tournament has started and user hasn't picked
    if (isTimeLocked && !hasExistingPick) {
        showTimeLockOverlay();
        isLocked = true;
    } else if (!isTimeLocked && !hasExistingPick) {
        // Show countdown banner
        showCountdownOverlay();
    }

    document.getElementById('predictorName').addEventListener('input', (e) => {
        if (isLocked) return;
        document.getElementById('displayPredictorName').textContent = e.target.value.toUpperCase() || '...';
        updateHash();
    });

    document.getElementById('downloadBtn').addEventListener('click', handleDownload);
});

function initBracket() {
    // Initialize SF and Final structure (Empty slots initially)
    bracketState.sf = [
        { id: 'sf1', t1: 'Juara A (Wait)', t2: 'Runner-up B (Wait)', next: 'f1', slot: 't1' },
        { id: 'sf2', t1: 'Juara B (Wait)', t2: 'Runner-up A (Wait)', next: 'f1', slot: 't2' }
    ];

    bracketState.final = [
        { id: 'f1', t1: '?', t2: '?', next: 'winner', slot: 'winner' }
    ];

    bracketState.groups = {
        A: { first: null, second: null },
        B: { first: null, second: null }
    };

    bracketState.winner = null;
    renderAll();
}

function renderAll() {
    renderGroups();
    renderBracketOnly();
    updateHash();
    updateStoryPreview();
}

function renderGroups() {
    if (!tournamentData.teams) {
        console.warn("Teams data not loaded yet.");
        return;
    }
    const teamsA = tournamentData.teams.filter(t => t.group === 'A');
    const teamsB = tournamentData.teams.filter(t => t.group === 'B');

    renderGroupList('group-a-list', 'A', teamsA);
    renderGroupList('group-b-list', 'B', teamsB);
}

function renderGroupList(containerId, group, teams) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    teams.forEach(team => {
        const div = document.createElement('div');
        div.className = 'team-slot cursor-pointer text-sm font-medium';

        // Status checks
        const isFirst = bracketState.groups[group].first === team.name;
        const isSecond = bracketState.groups[group].second === team.name;

        if (isFirst) {
            div.classList.add('selected', 'bg-yellow-500/20', 'border-l-4', 'border-yellow-500');
            div.innerHTML = `<span class="flex-grow">${team.name}</span> <span class="text-xs font-bold text-yellow-500">1st</span>`;
        } else if (isSecond) {
            div.classList.add('selected', 'bg-blue-500/20', 'border-l-4', 'border-blue-500');
            div.innerHTML = `<span class="flex-grow">${team.name}</span> <span class="text-xs font-bold text-blue-400">2nd</span>`;
        } else {
            div.innerText = team.name;
        }

        // Click Logic
        div.addEventListener('click', () => handleGroupPick(group, team.name));
        container.appendChild(div);
    });
}

function handleGroupPick(group, teamName) {
    if (isLocked || checkTimeLock()) return;

    const state = bracketState.groups[group];

    // Toggle Logic
    if (state.first === teamName) {
        state.first = null; // Deselect 1st
    } else if (state.second === teamName) {
        state.second = null; // Deselect 2nd
    } else {
        // New Selection
        if (!state.first) {
            state.first = teamName;
        } else if (!state.second) {
            state.second = teamName;
        } else {
            // Both full, maybe simple replace logic? 
            // Better: reset first, set new first? NO, annoying.
            // Just alert or do nothing.
            // Let's effectively "rotate": New click becomes 2nd, old 2nd removed?
            // Simple: Remove 2nd, set New as 2nd.
            state.second = teamName;
        }
    }

    // Update SF Slots automatically
    propagateGroupsToSF();
    renderAll();
}

function propagateGroupsToSF() {
    const ga = bracketState.groups.A;
    const gb = bracketState.groups.B;

    // SF1: A1 vs B2
    const sf1 = bracketState.sf[0];
    sf1.t1 = ga.first || 'Juara A (Wait)';
    sf1.t2 = gb.second || 'Runner-up B (Wait)';

    // SF2: B1 vs A2
    const sf2 = bracketState.sf[1];
    sf2.t1 = gb.first || 'Juara B (Wait)';
    sf2.t2 = ga.second || 'Runner-up A (Wait)';

    // Reset SF/Final selections if upstream changed?
    // Checking if selection is still valid is good UX.
    // If sf1.selected was old A1, and A1 changed to NewTeam, we should probably reset or update selection?
    // Let's reset for purity.
    checkResetSelection(sf1);
    checkResetSelection(sf2);

    // Also propagate SF changes to Final
    if (sf1.next === 'f1') {
        // This is implicit in next render cycle for display, but logic state needs update
        const f = bracketState.final[0];
        // If SF selection was cleared, F slot clears
        if (!sf1.selected) f[sf1.slot] = '?';
        else f[sf1.slot] = sf1.selected;
    }
    if (sf2.next === 'f1') {
        const f = bracketState.final[0];
        if (!sf2.selected) f[sf2.slot] = '?';
        else f[sf2.slot] = sf2.selected;
    }

    // Reset Final Winner if slots changed
    const f = bracketState.final[0];
    checkResetSelection(f);
    if (!f.selected) {
        bracketState.winner = null;
        const winEl = document.getElementById('finalWinnerName');
        if (winEl) winEl.textContent = '?';
    }
}

function checkResetSelection(match) {
    // If selected Value is no longer one of the teams, reset it.
    if (match.selected && match.selected !== match.t1 && match.selected !== match.t2) {
        match.selected = null;
    }
}

function renderBracketOnly() {
    const sfContainer = document.getElementById('round-sf');
    const fContainer = document.getElementById('round-f');

    // Render SF
    sfContainer.innerHTML = '<div class="text-center text-xs text-gray-500 font-bold uppercase mb-2">Semi Finals</div>';
    bracketState.sf.forEach(match => {
        sfContainer.appendChild(createMatchCard(match, 'sf'));
    });

    // Render Final
    fContainer.innerHTML = '<div class="text-center text-xs text-gray-500 font-bold uppercase mb-2">Grand Final</div>';
    bracketState.final.forEach(match => {
        fContainer.appendChild(createMatchCard(match, 'final'));
    });
}

function createMatchCard(match, round) {
    const card = document.createElement('div');
    const isFinalRound = round === 'final';

    let classes = 'bracket-match';
    if (isFinalRound) classes += ' is-final';
    card.className = classes;

    // Title Logic
    let titleText = 'Semi Final';
    if (match.id.includes('sf')) titleText = 'SEMI FINAL';
    if (isFinalRound) titleText = 'GRAND FINAL';

    // Header
    const header = document.createElement('div');
    header.className = 'match-header';
    header.innerHTML = `
        <span class="match-round-badge">${titleText}</span>
    `;
    card.appendChild(header);

    // Helper for side
    const createSide = (name, isSelected) => {
        const side = document.createElement('div');
        const isWait = name.includes('(Wait)') || name === '?';

        let sideClass = 'team-side';
        if (isSelected) sideClass += ' selected';
        if (isWait) sideClass += ' disabled';
        side.className = sideClass;

        side.innerHTML = `
            <span class="team-name-display">${name.replace(' (Wait)', '')}</span>
            ${isWait ? '<span class="text-[0.6rem] text-gray-500 uppercase tracking-widest">WAITING</span>' : ''}
        `;

        return side;
    };

    const side1 = createSide(match.t1, match.selected === match.t1);
    const side2 = createSide(match.t2, match.selected === match.t2);

    // Click Handlers
    side1.addEventListener('click', () => !isLocked && selectWinner(round, match.id, match.t1));
    side2.addEventListener('click', () => !isLocked && selectWinner(round, match.id, match.t2));

    // Content Row
    const content = document.createElement('div');
    content.className = 'match-versus-row';

    content.appendChild(side1);

    const vs = document.createElement('div');
    vs.className = 'vs-badge';
    vs.innerText = 'VS';
    content.appendChild(vs);

    content.appendChild(side2);

    card.appendChild(content);

    return card;
}

function selectWinner(round, matchId, winner) {
    if (isLocked || checkTimeLock()) return;
    if (winner === '?' || winner.includes('(Wait)')) return;

    // 1. Update Current Match Selection
    let list = bracketState[round];
    const matchIndex = list.findIndex(m => m.id === matchId);
    if (matchIndex === -1) return;

    list[matchIndex].selected = winner;

    // 2. Propagate to Next Round
    const match = list[matchIndex];
    if (match.next === 'winner') {
        bracketState.winner = winner;
        document.getElementById('finalWinnerName').textContent = winner;
    } else {
        // Find next match (Final is only destination for SF)
        let nextRoundList = bracketState.final;
        const nextMatch = nextRoundList.find(m => m.id === match.next);
        if (nextMatch) {
            nextMatch[match.slot] = winner;
            nextMatch.selected = null; // Reset Final choice
            bracketState.winner = null;
            document.getElementById('finalWinnerName').textContent = '?';
        }
    }

    renderBracketOnly();
    updateHash();
}

function resetBracket() {
    if (isLocked || checkTimeLock()) return;
    initBracket();
    document.getElementById('finalWinnerName').textContent = '?';
}

function updateHash() {
    const name = document.getElementById('predictorName').value.trim() || 'ANON';

    // Format: NAME|A1|A2|B1|B2|SF1|SF2|WINNER
    // Include full group picks to be precise
    const ga = bracketState.groups.A;
    const gb = bracketState.groups.B;

    const picks = [
        ga.first || '?', ga.second || '?',
        gb.first || '?', gb.second || '?',
        ...bracketState.sf.map(m => m.selected || '?'),
        bracketState.winner || '?'
    ].join('|');

    const rawString = `${name}|${picks}`;
    const encoded = btoa(rawString);
    const code = encoded.replace(/=/g, '');

    document.getElementById('securityHash').textContent = code;
    document.getElementById('securityHash').dataset.fullCode = code;
    
    // Update story hash too
    const storyHashEl = document.getElementById('storyHash');
    if (storyHashEl) storyHashEl.textContent = code;

    checkValidation();
}

function updateStoryPreview() {
    // Update predictor name
    const name = document.getElementById('predictorName').value.trim() || '...';
    document.getElementById('storyPredictorName').textContent = name.toUpperCase();
    
    // Get data
    const ga = bracketState.groups.A;
    const gb = bracketState.groups.B;
    const sf1 = bracketState.sf[0];
    const sf2 = bracketState.sf[1];
    const final = bracketState.final[0];
    
    // Render Group A List
    const groupAList = document.getElementById('storyGroupAList');
    groupAList.innerHTML = '';
    if (tournamentData.teams) {
        const teamsA = tournamentData.teams.filter(t => t.group === 'A');
        teamsA.forEach(team => {
            const isFirst = ga.first === team.name;
            const isSecond = ga.second === team.name;
            let bg = 'rgba(255,255,255,0.02)';
            let border = '1px solid rgba(255,255,255,0.06)';
            let textColor = '#64748b';
            let rank = '';
            
            if (isFirst) {
                bg = 'rgba(234,179,8,0.12)';
                border = '2px solid #eab308';
                textColor = '#fff';
                rank = '<span style="color: #eab308; font-size: 11px; font-weight: 800;">1st</span>';
            } else if (isSecond) {
                bg = 'rgba(148,163,184,0.12)';
                border = '2px solid #94a3b8';
                textColor = '#e2e8f0';
                rank = '<span style="color: #94a3b8; font-size: 11px; font-weight: 800;">2nd</span>';
            }
            
            groupAList.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; background: ${bg}; border: ${border}; border-radius: 12px;">
                    <span style="font-size: 15px; font-weight: ${isFirst || isSecond ? '700' : '500'}; color: ${textColor};">${team.name}</span>
                    ${rank}
                </div>
            `;
        });
    }
    
    // Render Group B List
    const groupBList = document.getElementById('storyGroupBList');
    groupBList.innerHTML = '';
    if (tournamentData.teams) {
        const teamsB = tournamentData.teams.filter(t => t.group === 'B');
        teamsB.forEach(team => {
            const isFirst = gb.first === team.name;
            const isSecond = gb.second === team.name;
            let bg = 'rgba(255,255,255,0.02)';
            let border = '1px solid rgba(255,255,255,0.06)';
            let textColor = '#64748b';
            let rank = '';
            
            if (isFirst) {
                bg = 'rgba(234,179,8,0.12)';
                border = '2px solid #eab308';
                textColor = '#fff';
                rank = '<span style="color: #eab308; font-size: 11px; font-weight: 800;">1st</span>';
            } else if (isSecond) {
                bg = 'rgba(148,163,184,0.12)';
                border = '2px solid #94a3b8';
                textColor = '#e2e8f0';
                rank = '<span style="color: #94a3b8; font-size: 11px; font-weight: 800;">2nd</span>';
            }
            
            groupBList.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px; background: ${bg}; border: ${border}; border-radius: 12px;">
                    <span style="font-size: 15px; font-weight: ${isFirst || isSecond ? '700' : '500'}; color: ${textColor};">${team.name}</span>
                    ${rank}
                </div>
            `;
        });
    }
    
    // Semi Final 1 - list style seperti group
    const sf1List = document.getElementById('storySF1List');
    sf1List.innerHTML = '';
    const sf1t1Name = sf1.t1.includes('Wait') ? '?' : sf1.t1;
    const sf1t2Name = sf1.t2.includes('Wait') ? '?' : sf1.t2;
    
    // SF1 Team 1
    const sf1t1Selected = sf1.selected === sf1.t1 && !sf1.t1.includes('Wait');
    sf1List.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: ${sf1t1Selected ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.02)'}; border: ${sf1t1Selected ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.06)'}; border-radius: 10px;">
            <span style="font-size: 14px; font-weight: ${sf1t1Selected ? '700' : '500'}; color: ${sf1t1Selected ? '#fff' : '#64748b'};">${sf1t1Name}</span>
            ${sf1t1Selected ? '<span style="color: #8b5cf6; font-size: 10px; font-weight: 800;">WIN</span>' : ''}
        </div>
    `;
    // SF1 Team 2
    const sf1t2Selected = sf1.selected === sf1.t2 && !sf1.t2.includes('Wait');
    sf1List.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: ${sf1t2Selected ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.02)'}; border: ${sf1t2Selected ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.06)'}; border-radius: 10px;">
            <span style="font-size: 14px; font-weight: ${sf1t2Selected ? '700' : '500'}; color: ${sf1t2Selected ? '#fff' : '#64748b'};">${sf1t2Name}</span>
            ${sf1t2Selected ? '<span style="color: #8b5cf6; font-size: 10px; font-weight: 800;">WIN</span>' : ''}
        </div>
    `;
    
    // Semi Final 2 - list style
    const sf2List = document.getElementById('storySF2List');
    sf2List.innerHTML = '';
    const sf2t1Name = sf2.t1.includes('Wait') ? '?' : sf2.t1;
    const sf2t2Name = sf2.t2.includes('Wait') ? '?' : sf2.t2;
    
    // SF2 Team 1
    const sf2t1Selected = sf2.selected === sf2.t1 && !sf2.t1.includes('Wait');
    sf2List.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: ${sf2t1Selected ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.02)'}; border: ${sf2t1Selected ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.06)'}; border-radius: 10px;">
            <span style="font-size: 14px; font-weight: ${sf2t1Selected ? '700' : '500'}; color: ${sf2t1Selected ? '#fff' : '#64748b'};">${sf2t1Name}</span>
            ${sf2t1Selected ? '<span style="color: #8b5cf6; font-size: 10px; font-weight: 800;">WIN</span>' : ''}
        </div>
    `;
    // SF2 Team 2
    const sf2t2Selected = sf2.selected === sf2.t2 && !sf2.t2.includes('Wait');
    sf2List.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: ${sf2t2Selected ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.02)'}; border: ${sf2t2Selected ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.06)'}; border-radius: 10px;">
            <span style="font-size: 14px; font-weight: ${sf2t2Selected ? '700' : '500'}; color: ${sf2t2Selected ? '#fff' : '#64748b'};">${sf2t2Name}</span>
            ${sf2t2Selected ? '<span style="color: #8b5cf6; font-size: 10px; font-weight: 800;">WIN</span>' : ''}
        </div>
    `;
    
    // Grand Final - list style dengan gold
    const finalList = document.getElementById('storyFinalList');
    finalList.innerHTML = '';
    const ft1Name = final.t1 === '?' ? '?' : final.t1;
    const ft2Name = final.t2 === '?' ? '?' : final.t2;
    
    // Final Team 1
    const ft1Selected = bracketState.winner === final.t1 && bracketState.winner !== '?';
    finalList.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: ${ft1Selected ? 'rgba(234,179,8,0.18)' : 'rgba(255,255,255,0.02)'}; border: ${ft1Selected ? '2px solid #eab308' : '1px solid rgba(255,255,255,0.06)'}; border-radius: 12px;">
            <span style="font-size: 15px; font-weight: ${ft1Selected ? '700' : '500'}; color: ${ft1Selected ? '#fff' : '#64748b'};">${ft1Name}</span>
            ${ft1Selected ? '<span style="color: #eab308; font-size: 11px; font-weight: 800;">🏆</span>' : ''}
        </div>
    `;
    // Final Team 2
    const ft2Selected = bracketState.winner === final.t2 && bracketState.winner !== '?';
    finalList.innerHTML += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: ${ft2Selected ? 'rgba(234,179,8,0.18)' : 'rgba(255,255,255,0.02)'}; border: ${ft2Selected ? '2px solid #eab308' : '1px solid rgba(255,255,255,0.06)'}; border-radius: 12px;">
            <span style="font-size: 15px; font-weight: ${ft2Selected ? '700' : '500'}; color: ${ft2Selected ? '#fff' : '#64748b'};">${ft2Name}</span>
            ${ft2Selected ? '<span style="color: #eab308; font-size: 11px; font-weight: 800;">🏆</span>' : ''}
        </div>
    `;
    
    // Champion
    document.getElementById('storyChampion').textContent = bracketState.winner || '?';
    
    // Hash
    const hash = document.getElementById('securityHash').dataset.fullCode || 'PENDING';
    document.getElementById('storyHash').textContent = hash;
}

function checkValidation() {
    if (isLocked || checkTimeLock()) return;

    const name = document.getElementById('predictorName').value.trim();
    const btn = document.getElementById('downloadBtn');

    // Check if everything selected
    const ga = bracketState.groups.A;
    const gb = bracketState.groups.B;
    const groupComplete = ga.first && ga.second && gb.first && gb.second;
    const winnerSelected = !!bracketState.winner;

    if (name && groupComplete && winnerSelected) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
        btn.classList.add('hover:scale-105');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
        btn.classList.remove('hover:scale-105');
    }
}

// Custom Modal Logic
function handleDownload() {
    // Check time lock
    if (checkTimeLock()) {
        alert('⛔ Prediksi sudah ditutup! Turnamen telah dimulai.');
        return;
    }
    
    if (!isLocked) {
        const code = document.getElementById('securityHash').dataset.fullCode;
        if (!bracketState.winner) {
            alert('Lengkapi prediksi dulu sampai juara!');
            return;
        }

        // Show Modal
        const modal = document.getElementById('confirmModal');
        const content = document.getElementById('confirmContent');
        modal.classList.remove('opacity-0', 'pointer-events-none');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');

        // Setup Confirm Action
        document.getElementById('confirmLockBtn').onclick = () => {
            finalizeSubmission(code);
        };

    } else {
        downloadCard();
    }
}

function closeModal() {
    const modal = document.getElementById('confirmModal');
    const content = document.getElementById('confirmContent');
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
}

function finalizeSubmission(code) {
    localStorage.setItem('hastmaPickemLock', code);
    isLocked = true;
    closeModal();

    // UI Feedback
    const btn = document.getElementById('downloadBtn');
    btn.innerHTML = '<span class="material-symbols-outlined">download</span> Downloading...';

    downloadCard();

    setTimeout(() => {
        location.reload();
    }, 2000);
}

// Expose closeModal globally for HTML onclick
window.closeModal = closeModal;

// Sponsor logos list
const SPONSOR_LOGOS = [
    'fdn nusantara - Diedit.png',
    'IMG-20240107-WA0109 - Diedit.png',
    'IMG-20260119-WA0006 - Diedit.jpg',
    'jiimy1.png',
    'jimmy2.png',
    'Salinan Dari Amazing Grotesk - 1.png',
    'WhatsApp Image 2026-01-10 at 18.06.42 - Diedit.png',
    'WhatsApp Image 2026-01-21 at 16.51.59 - Diedit.png',
    'WhatsApp Image 2026-01-21 at 16.51.59d - Diedit.png'
];

function loadSponsorLogos() {
    const container = document.getElementById('storySponsorList');
    if (!container) return;
    
    container.innerHTML = '';
    SPONSOR_LOGOS.forEach(logo => {
        const img = document.createElement('img');
        img.src = `sponsor/${logo}`;
        img.style.cssText = 'height: 40px; width: auto; object-fit: contain; filter: brightness(0.9);';
        img.alt = 'Sponsor';
        img.onerror = () => { img.style.display = 'none'; };
        container.appendChild(img);
    });
}

function downloadCard() {
    const element = document.getElementById('storyCaptureArea');
    const name = document.getElementById('predictorName').value.trim() || 'my';
    const code = localStorage.getItem('hastmaPickemLock') || 'DRAFT';
    
    // 0. Force update story preview to ensure all DOM is ready
    updateStoryPreview();
    
    // 0.5. Load sponsor logos
    loadSponsorLogos();
    
    // 0.6. Set timestamp
    const now = new Date();
    const timestampStr = now.toLocaleString('id-ID', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('storyTimestamp').textContent = `Generated on: ${timestampStr}`;

    // 1. Generate QR Code for Story (larger)
    const qrContainer = document.getElementById('storyQRCode');
    qrContainer.innerHTML = ''; // Clear previous
    new QRCode(qrContainer, {
        text: `https://hastmacup.my.id/verify?code=${code}`,
        width: 140,
        height: 140,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L
    });

    // 2. Make element visible for capture (temporarily)
    const originalPosition = element.style.position;
    const originalLeft = element.style.left;
    const originalTop = element.style.top;
    
    // Move to viewport but behind everything
    element.style.position = 'fixed';
    element.style.left = '0';
    element.style.top = '0';
    element.style.zIndex = '-9999';

    // Force reflow
    void element.offsetHeight;

    // Delay to allow QR code to render and DOM to settle
    setTimeout(() => {
        html2canvas(element, {
            scale: 1, // Native 1080x1920
            backgroundColor: '#0f172a',
            useCORS: true,
            width: 1080,
            height: 1920,
            windowWidth: 1080,
            windowHeight: 1920,
            logging: false,
            onclone: (clonedDoc) => {
                // Ensure the cloned element is visible
                const cloned = clonedDoc.getElementById('storyCaptureArea');
                if (cloned) {
                    cloned.style.position = 'relative';
                    cloned.style.left = '0';
                    cloned.style.top = '0';
                    cloned.style.visibility = 'visible';
                    cloned.style.zIndex = '1';
                }
            }
        }).then(canvas => {
            // Restore original position
            element.style.position = originalPosition;
            element.style.left = originalLeft;
            element.style.top = originalTop;
            element.style.zIndex = '';

            // Download
            const link = document.createElement('a');
            link.download = `HastmaPickem_${name}_${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            // Reset button
            const btn = document.getElementById('downloadBtn');
            btn.innerHTML = '<span class="material-symbols-outlined">check_circle</span> Saved!';
            setTimeout(() => {
                btn.innerHTML = '<span class="material-symbols-outlined">lock</span> Kunci Jawaban';
                if (isLocked) {
                    btn.innerHTML = '<span class="material-symbols-outlined">download</span> Download Lagi';
                    btn.disabled = false;
                    btn.classList.remove('opacity-50', 'cursor-not-allowed');
                }
            }, 3000);
        }).catch(err => {
            console.error('Capture error:', err);
            // Restore on error
            element.style.position = originalPosition;
            element.style.left = originalLeft;
            element.style.top = originalTop;
            element.style.zIndex = '';
            alert('Terjadi kesalahan saat mengambil gambar. Coba lagi.');
        });
    }, 1000); // 1000ms delay for QR code and DOM to settle
}

function restoreFromLock(encodedStr) {
    try {
        // Unlock temporarily to allow state updates
        isLocked = false;

        const decoded = atob(encodedStr);
        const parts = decoded.split('|');
        const name = parts[0];
        const picks = parts.slice(1);

        document.getElementById('predictorName').value = name;
        document.getElementById('displayPredictorName').textContent = name.toUpperCase();


        // Reset button hidden in production

        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.innerHTML = '<span class="material-symbols-outlined">download</span> Download Again';

        initBracket();

        // Restore State logic
        // indices: 0=A1, 1=A2, 2=B1, 3=B2, 4=SF1, 5=SF2, 6=Win

        bracketState.groups.A.first = picks[0];
        bracketState.groups.A.second = picks[1];
        bracketState.groups.B.first = picks[2];
        bracketState.groups.B.second = picks[3];

        // Propagate essential for display
        propagateGroupsToSF();
        renderAll();

        // Restore Knockout Picks
        if (picks[4]) selectWinner('sf', 'sf1', picks[4]);
        if (picks[5]) selectWinner('sf', 'sf2', picks[5]);
        if (picks[6]) selectWinner('final', 'f1', picks[6]);

        // NOW we lock it
        isLocked = true;
        document.getElementById('predictorName').disabled = true;

        // Force update story preview (with delay to ensure DOM updated)
        setTimeout(() => {
            updateStoryPreview();
            checkValidation();
        }, 100);

        // Disable Interactions visually
        setTimeout(() => {
            document.querySelectorAll('.team-slot').forEach(el => el.style.pointerEvents = 'none');
            // Also need to disable matches
        }, 150);

        // Msg
        const container = document.querySelector('main .max-w-6xl');
        if (!document.getElementById('lockMsg')) {
            const msg = document.createElement('div');
            msg.id = 'lockMsg';
            msg.className = 'text-center mt-4 mb-4 p-4 bg-red-500/20 border border-red-500 rounded-xl text-red-200 font-bold';
            msg.innerHTML = '<span class="material-symbols-outlined align-bottom">lock</span> Prediksi Terkunci. Anda sudah melakukan pick.';
            container.insertBefore(msg, document.getElementById('captureArea'));
        }

    } catch (e) {
        console.error("Lock corrupted", e);
        localStorage.removeItem('hastmaPickemLock');
        isLocked = false;
        initBracket();
    }
}

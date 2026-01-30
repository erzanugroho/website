
// ================================================
// Pick'em Validator Logic with Results Comparison
// ================================================

// Get current tournament data (from localStorage or fallback to default)
function getTournamentData() {
    const local = localStorage.getItem('hastmaCupData');
    if (local) {
        try {
            return JSON.parse(local);
        } catch (e) {
            console.error('Error parsing local data:', e);
        }
    }
    return window.DEFAULT_TOURNAMENT_DATA || {};
}

// Calculate group standings from actual match results
function calculateGroupStandings() {
    const data = getTournamentData();
    const teams = data.teams || [];
    const matches = data.matches || [];
    
    const standings = {
        A: { first: null, second: null },
        B: { first: null, second: null }
    };
    
    // Calculate points for each team
    const teamStats = {};
    teams.forEach(team => {
        teamStats[team.id] = { 
            id: team.id, 
            name: team.name, 
            group: team.group, 
            points: 0, 
            wins: 0, 
            draws: 0, 
            losses: 0,
            gf: 0, 
            ga: 0 
        };
    });
    
    // Process group stage matches
    matches.filter(m => m.stage === 'group' && m.status === 'finished').forEach(match => {
        const home = teamStats[match.homeTeam];
        const away = teamStats[match.awayTeam];
        
        if (!home || !away) return;
        
        home.gf += match.homeScore;
        home.ga += match.awayScore;
        away.gf += match.awayScore;
        away.ga += match.homeScore;
        
        if (match.homeScore > match.awayScore) {
            home.points += 3; home.wins++;
            away.losses++;
        } else if (match.homeScore < match.awayScore) {
            away.points += 3; away.wins++;
            home.losses++;
        } else {
            home.points += 1; home.draws++;
            away.points += 1; away.draws++;
        }
    });
    
    // Sort and determine standings
    ['A', 'B'].forEach(group => {
        const groupTeams = Object.values(teamStats).filter(t => t.group === group);
        groupTeams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
            if (gdB !== gdA) return gdB - gdA;
            return b.gf - a.gf;
        });
        
        if (groupTeams.length >= 2) {
            standings[group].first = groupTeams[0].name;
            standings[group].second = groupTeams[1].name;
        }
    });
    
    return standings;
}

// Get actual match winners
function getActualWinners() {
    const data = getTournamentData();
    const matches = data.matches || [];
    const teams = data.teams || [];
    const winners = { sf1: null, sf2: null, final: null };
    
    matches.forEach(match => {
        if (match.status !== 'finished') return;
        
        let winner = null;
        if (match.homeScore > match.awayScore) winner = match.homeTeam;
        else if (match.homeScore < match.awayScore) winner = match.awayTeam;
        
        if (!winner) return;
        
        // Get team name
        const teamName = teams.find(t => t.id === winner)?.name || winner;
        
        if (match.id === 'SF1') winners.sf1 = teamName;
        else if (match.id === 'SF2') winners.sf2 = teamName;
        else if (match.id === 'F1') winners.final = teamName;
    });
    
    return winners;
}

function verifyPickemCode() {
    const input = document.getElementById('validatorInput').value.trim();
    if (!input) {
        showToast('Please enter a code!', 'error');
        return;
    }

    try {
        let encoded = input;
        while (encoded.length % 4 !== 0) encoded += '=';

        const decoded = atob(encoded);
        const parts = decoded.split('|');

        // Expected Format: NAME | A1 | A2 | B1 | B2 | SF1 | SF2 | WINNER
        if (parts.length < 8) {
            throw new Error('Invalid format');
        }

        const name = parts[0];
        const picks = parts.slice(1);
        
        // Prediction data
        const predA1 = picks[0], predA2 = picks[1];
        const predB1 = picks[2], predB2 = picks[3];
        const predSF1 = picks[4], predSF2 = picks[5];
        const predWinner = picks[6];

        // Get actual results
        const standings = calculateGroupStandings();
        const actualWinners = getActualWinners();
        
        // Calculate score
        let correctCount = 0;
        let totalPredictable = 0;
        
        // Check Group A
        const actualA1 = standings.A.first;
        const actualA2 = standings.A.second;
        const a1Correct = actualA1 && predA1 === actualA1;
        const a2Correct = actualA2 && predA2 === actualA2;
        
        // Check Group B
        const actualB1 = standings.B.first;
        const actualB2 = standings.B.second;
        const b1Correct = actualB1 && predB1 === actualB1;
        const b2Correct = actualB2 && predB2 === actualB2;
        
        // Check SF
        const sf1Correct = actualWinners.sf1 && predSF1 === actualWinners.sf1;
        const sf2Correct = actualWinners.sf2 && predSF2 === actualWinners.sf2;
        
        // Check Final
        const finalCorrect = actualWinners.final && predWinner === actualWinners.final;
        
        // Count available predictions
        if (actualA1) totalPredictable++;
        if (actualA2) totalPredictable++;
        if (actualB1) totalPredictable++;
        if (actualB2) totalPredictable++;
        if (actualWinners.sf1) totalPredictable++;
        if (actualWinners.sf2) totalPredictable++;
        if (actualWinners.final) totalPredictable++;
        
        correctCount = [a1Correct, a2Correct, b1Correct, b2Correct, sf1Correct, sf2Correct, finalCorrect]
            .filter(Boolean).length;

        const resultDiv = document.getElementById('validatorResult');
        resultDiv.style.display = 'block';
        document.getElementById('validName').textContent = name;

        // Display prediction with comparison
        const qfList = document.getElementById('validQF');
        if (qfList) {
            qfList.innerHTML = `
                <li class="flex justify-between items-center">
                    <span><strong>Grup A 1st:</strong> ${predA1}</span>
                    ${actualA1 ? `<span class="${a1Correct ? 'text-green-400' : 'text-red-400'}">${a1Correct ? '✓' : '✗'} ${actualA1}</span>` : '<span class="text-gray-500">⏳ Pending</span>'}
                </li>
                <li class="flex justify-between items-center">
                    <span><strong>Grup A 2nd:</strong> ${predA2}</span>
                    ${actualA2 ? `<span class="${a2Correct ? 'text-green-400' : 'text-red-400'}">${a2Correct ? '✓' : '✗'} ${actualA2}</span>` : '<span class="text-gray-500">⏳ Pending</span>'}
                </li>
                <li class="flex justify-between items-center">
                    <span><strong>Grup B 1st:</strong> ${predB1}</span>
                    ${actualB1 ? `<span class="${b1Correct ? 'text-green-400' : 'text-red-400'}">${b1Correct ? '✓' : '✗'} ${actualB1}</span>` : '<span class="text-gray-500">⏳ Pending</span>'}
                </li>
                <li class="flex justify-between items-center">
                    <span><strong>Grup B 2nd:</strong> ${predB2}</span>
                    ${actualB2 ? `<span class="${b2Correct ? 'text-green-400' : 'text-red-400'}">${b2Correct ? '✓' : '✗'} ${actualB2}</span>` : '<span class="text-gray-500">⏳ Pending</span>'}
                </li>
            `;
            qfList.previousElementSibling.textContent = "GROUP STAGE PREDICTION";
        }

        document.getElementById('validSF').innerHTML = `
            <li class="flex justify-between items-center">
                <span>• SF1: ${predSF1}</span>
                ${actualWinners.sf1 ? `<span class="${sf1Correct ? 'text-green-400' : 'text-red-400'}">${sf1Correct ? '✓' : '✗'} ${actualWinners.sf1}</span>` : '<span class="text-gray-500">⏳</span>'}
            </li>
            <li class="flex justify-between items-center">
                <span>• SF2: ${predSF2}</span>
                ${actualWinners.sf2 ? `<span class="${sf2Correct ? 'text-green-400' : 'text-red-400'}">${sf2Correct ? '✓' : '✗'} ${actualWinners.sf2}</span>` : '<span class="text-gray-500">⏳</span>'}
            </li>
        `;
        
        document.getElementById('validWinner').innerHTML = `
            <div class="flex justify-between items-center">
                <span>${predWinner}</span>
                ${actualWinners.final ? `<span class="${finalCorrect ? 'text-green-400' : 'text-red-400'}">${finalCorrect ? '✓' : '✗'} ${actualWinners.final}</span>` : '<span class="text-gray-500">⏳ Pending</span>'}
            </div>
        `;
        
        // Show score summary
        const scoreDiv = document.getElementById('validScore');
        if (scoreDiv) {
            const percentage = totalPredictable > 0 ? Math.round((correctCount / totalPredictable) * 100) : 0;
            const allCorrect = correctCount === 7 && totalPredictable === 7;
            scoreDiv.innerHTML = `
                <div class="mt-4 p-4 rounded-lg ${allCorrect ? 'bg-green-500/20 border border-green-500' : 'bg-blue-500/20 border border-blue-500'}">
                    <div class="text-center">
                        <div class="text-2xl font-bold ${allCorrect ? 'text-green-400' : 'text-blue-400'}">${correctCount}/${totalPredictable}</div>
                        <div class="text-sm text-gray-300">Prediksi Benar (${percentage}%)</div>
                        ${allCorrect ? '<div class="text-yellow-400 font-bold mt-1">🏆 PERFECT SCORE!</div>' : ''}
                    </div>
                </div>
            `;
            scoreDiv.style.display = 'block';
        }

        showToast(`Validation complete! Score: ${correctCount}/${totalPredictable}`, correctCount === totalPredictable && totalPredictable > 0 ? 'success' : 'info');

    } catch (e) {
        console.error(e);
        showToast('Invalid Code! Could not decode.', 'error');
        document.getElementById('validatorResult').style.display = 'none';
    }
}

// Expose to window
window.verifyPickemCode = verifyPickemCode;

// ================================================
// QR Scanner Logic
// ================================================

let html5QrCode = null;

async function startQrScanner() {
    const readerDiv = document.getElementById('qr-reader');
    const validatorInput = document.getElementById('validatorInput');
    const btnScan = document.getElementById('btnScanQr');

    if (!window.Html5Qrcode) {
        if (window.showToast) showToast('QR Library not loaded!', 'error');
        else alert('QR Library not loaded!');
        return;
    }

    // Toggle off if already running
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (e) {
            console.error(e);
        }
        html5QrCode = null;
        readerDiv.style.display = 'none';
        if (btnScan) btnScan.classList.remove('btn-premium-primary');
        if (btnScan) btnScan.classList.add('btn-premium-secondary');
        return;
    }

    readerDiv.style.display = 'block';

    // Update Button State
    if (btnScan) {
        btnScan.classList.remove('btn-premium-secondary');
        btnScan.classList.add('btn-premium-primary'); // Highlight when active
    }

    try {
        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        await html5QrCode.start({ facingMode: "environment" }, config,
            (decodedText, decodedResult) => {
                // Success Callback
                validatorInput.value = decodedText;
                verifyPickemCode();

                // Stop scanning automatically
                html5QrCode.stop().then(() => {
                    html5QrCode.clear();
                    html5QrCode = null;
                    readerDiv.style.display = 'none';
                    if (btnScan) {
                        btnScan.classList.remove('btn-premium-primary');
                        btnScan.classList.add('btn-premium-secondary');
                    }
                });

                if (window.showToast) showToast('QR Code Scanned!', 'success');
            },
            (errorMessage) => {
                // Parse error, ignore to avoid spamming console/UI
            }
        );
    } catch (err) {
        console.error("Error starting QR scanner", err);
        if (window.showToast) showToast('Camera access failed! Check permission.', 'error');
        else alert('Camera access failed!');

        readerDiv.style.display = 'none';
        html5QrCode = null;
        if (btnScan) {
            btnScan.classList.remove('btn-premium-primary');
            btnScan.classList.add('btn-premium-secondary');
        }
    }
}

window.startQrScanner = startQrScanner;

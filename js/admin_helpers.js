/**
 * Set event type for new match event
 */
function setEventType(type, element) {
    // Update hidden input
    document.getElementById('eventType').value = type;

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
    // Update hidden input
    document.getElementById('eventTeam').value = teamId;

    // Update UI state
    document.querySelectorAll('#eventTeamButtons .admin-selection-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    element.classList.add('active');

    // Load players
    loadPlayersForEvent();
}

/**
 * Handle player selection in event form
 */
function selectEventPlayer(number, name, element) {
    // Update hidden inputs
    document.getElementById('eventPlayerNumber').value = number;
    document.getElementById('eventPlayerName').value = name;

    // Update UI state
    document.querySelectorAll('#eventPlayerButtons .admin-selection-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    element.classList.add('active');
}

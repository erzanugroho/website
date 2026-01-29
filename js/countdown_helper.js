
/**
 * Update the countdown timer for the hero match
 */
function updateHeroCountdown(matchTimeStr, element) {
    // Parse match time (Assumes "HH:mm" format and today's date)
    const now = new Date();
    const [hours, minutes] = matchTimeStr.split(':').map(Number);
    const matchDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);

    // If match time is earlier today but we're rendering it as "next", it might be tomorrow? 
    // But for this tournament context, let's assume single day or strict scheduling.
    // Actually, if matchTime < now, it likely means we are late or it's just not live yet.

    const diff = matchDate - now;

    if (diff <= 0) {
        element.innerHTML = '<span class="countdown-unit">00</span>m : <span class="countdown-unit">00</span>s';
        element.classList.add('waiting');
        return;
    }

    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    const h = Math.floor(diff / (1000 * 60 * 60));

    if (h > 0) {
        element.innerHTML = `<span class="countdown-unit">${h}</span>h : <span class="countdown-unit">${m}</span>m`;
    } else {
        element.innerHTML = `<span class="countdown-unit">${m}</span>m : <span class="countdown-unit">${s < 10 ? '0' + s : s}</span>s`;
    }

    element.classList.remove('waiting');
}

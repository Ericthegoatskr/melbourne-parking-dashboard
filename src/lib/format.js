const MELBOURNE_TZ = 'Australia/Melbourne';
/** Always render source times in the city the data describes. */
export function formatMelbourneTime(date) {
    return new Intl.DateTimeFormat('en-AU', {
        timeZone: MELBOURNE_TZ,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
}
export function formatMelbourneDateTime(date) {
    return new Intl.DateTimeFormat('en-AU', {
        timeZone: MELBOURNE_TZ,
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
}
/** Describe an age in words. Never rounds up into sounding fresher than it is. */
export function formatAge(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0)
        return 'unknown age';
    if (minutes < 1)
        return 'less than a minute old';
    const whole = Math.floor(minutes);
    if (whole < 60)
        return `${whole} min old`;
    const hours = Math.floor(whole / 60);
    if (hours < 24)
        return `${hours} hr old`;
    return `${Math.floor(hours / 24)} days old`;
}
export function formatPercent(value, digits = 0) {
    if (value === null || !Number.isFinite(value))
        return '—';
    return `${(value * 100).toFixed(digits)}%`;
}
export function formatCount(value) {
    return new Intl.NumberFormat('en-AU').format(value);
}

/**
 * When the morning run happens.
 *
 * Netlify's cron is UTC only, so a fixed UTC hour would drift by an hour twice
 * a year and "7am" would quietly become 6am for half of it. The function is
 * scheduled hourly instead and this decides whether the current hour is the
 * one — which keeps 7am meaning 7am in the configured zone, year round.
 */

export const DEFAULT_TIMEZONE = 'America/New_York';
export const DEFAULT_RUN_HOUR = 7;

/** The hour of day at `date` in `timeZone`, 0-23. */
export function localHour(date, timeZone = DEFAULT_TIMEZONE) {
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).format(date);
    return Number(hour) % 24;
  } catch {
    // An unknown zone should not stop the feed updating; fall back to UTC.
    return date.getUTCHours();
  }
}

/**
 * Should the ingest run at this moment?
 * @param {object} opts
 * @param {Date}   opts.now
 * @param {string} opts.timeZone
 * @param {number} opts.runHour
 * @param {number|null} opts.lastRunAt  epoch seconds of the last agent post
 * @param {number} opts.minGapHours     guard against a double fire
 */
export function shouldRunNow({
  now = new Date(),
  timeZone = process.env.NEWS_TZ || DEFAULT_TIMEZONE,
  runHour = Number(process.env.NEWS_RUN_HOUR ?? DEFAULT_RUN_HOUR),
  lastRunAt = null,
  minGapHours = 12,
} = {}) {
  if (localHour(now, timeZone) !== runHour) {
    return { run: false, reason: 'not the scheduled hour' };
  }
  if (lastRunAt) {
    const sinceHours = (Math.floor(now.getTime() / 1000) - lastRunAt) / 3600;
    if (sinceHours < minGapHours) {
      return { run: false, reason: `last run was ${sinceHours.toFixed(1)}h ago` };
    }
  }
  return { run: true, reason: 'scheduled hour' };
}

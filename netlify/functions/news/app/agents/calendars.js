import { fetchText, tidy, secondsFrom } from './util.js';
import { parseFeed } from '../feed-parser.js';

/**
 * City calendars — what is physically happening, and where.
 *
 * A feed of links is a poor way to find out that there is a synbio meetup in
 * Boston on Thursday, and that is often the item a founder most wants. Sources
 * publish either iCalendar or RSS, so both are handled.
 */
export const CALENDARS = [
  { city: 'Boston', url: 'https://www.meetup.com/boston-synthetic-biology/events/rss/', format: 'rss' },
  { city: 'San Francisco', url: 'https://www.meetup.com/sf-bay-area-biotech/events/rss/', format: 'rss' },
  { city: 'New York', url: 'https://www.meetup.com/nyc-biotech/events/rss/', format: 'rss' },
  { city: 'Global', url: 'https://www.biohackspace.org/events.ics', format: 'ics' },
];

/** How far ahead an event is worth surfacing. */
export const HORIZON_DAYS = 21;

/**
 * A small iCalendar reader: enough of RFC 5545 for VEVENT summaries, start
 * times and URLs, including the line folding the format mandates.
 */
export function parseIcs(text) {
  const unfolded = String(text).replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const events = [];
  let current = null;

  for (const raw of unfolded.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.summary) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const name = line.slice(0, sep).split(';')[0].toUpperCase();
    const value = line.slice(sep + 1);

    if (name === 'SUMMARY') current.summary = unescapeIcs(value);
    else if (name === 'DESCRIPTION') current.description = unescapeIcs(value);
    else if (name === 'URL') current.url = value.trim();
    else if (name === 'LOCATION') current.location = unescapeIcs(value);
    else if (name === 'UID') current.uid = value.trim();
    else if (name === 'DTSTART') current.startsAt = icsDate(value);
  }
  return events;
}

function unescapeIcs(value) {
  return value.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').trim();
}

/** DTSTART is either 20260904T180000Z or a bare 20260904. */
export function icsDate(value) {
  const compact = value.trim();
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(compact);
  if (!match) return secondsFrom(compact);
  const [, y, m, d, hh = '00', mm = '00', ss = '00'] = match;
  return Math.floor(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss) / 1000);
}

export default {
  key: 'calendars',
  label: 'City calendars',
  about: 'Meetups, talks and open lab nights in the cities where this happens in person.',
  selfEvident: true,
  weight: 1,

  async fetch({ fetchImpl, now, calendars = CALENDARS, horizonDays = HORIZON_DAYS } = {}) {
    const horizon = now + horizonDays * 86400;
    const batches = await Promise.all(
      calendars.map((calendar) =>
        fetchText(calendar.url, { fetchImpl })
          .then((body) =>
            calendar.format === 'ics'
              ? parseIcs(body).map((event) => ({
                  title: tidy(event.summary),
                  link: event.url || calendar.url,
                  summary: tidy(event.description ?? '', 300),
                  startsAt: event.startsAt,
                  location: event.location,
                  city: calendar.city,
                }))
              : parseFeed(body).map((entry) => ({
                  title: tidy(entry.title),
                  link: entry.link,
                  summary: tidy(entry.summary ?? '', 300),
                  startsAt: secondsFrom(entry.publishedAt),
                  city: calendar.city,
                })),
          )
          .catch(() => []),
      ),
    );

    return batches
      .flat()
      .filter((event) => event.title && event.link)
      // Only what is still ahead: a listing for last Tuesday helps nobody.
      .filter((event) => !event.startsAt || (event.startsAt >= now && event.startsAt <= horizon))
      .map((event) => ({
        title: `${event.city}: ${event.title}`,
        link: event.link,
        summary: event.summary,
        publishedAt: now,
        topicHint: 'diybio',
        note: event.startsAt ? `${event.city} — ${whenWords(event.startsAt, now)}` : event.city,
      }));
  },
};

function whenWords(startsAt, now) {
  const days = Math.round((startsAt - now) / 86400);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}

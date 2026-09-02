import { fetchJson, isoDate, secondsFrom, tidy, money } from './util.js';

/**
 * NIH awards, via the RePORTER API.
 *
 * The filter that matters is the activity code: SBIR and STTR (R41-R44, U43/U44)
 * are the grants that go to companies rather than to university labs, and a
 * first SBIR is often a company's first money.
 */
const API = 'https://api.reporter.nih.gov/v2/projects/search';

const COMPANY_ACTIVITY_CODES = ['R41', 'R42', 'R43', 'R44', 'U43', 'U44'];

export default {
  key: 'nih',
  label: 'NIH awards',
  about: 'New NIH SBIR and STTR awards — the grants that go to companies, not to campus labs.',
  selfEvident: true,
  weight: 1.3,

  async fetch({ fetchImpl, now, lookbackHours = 72, limit = 50 } = {}) {
    const payload = await fetchJson(API, {
      fetchImpl,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        criteria: {
          activity_codes: COMPANY_ACTIVITY_CODES,
          award_notice_date: {
            from_date: isoDate(now - lookbackHours * 3600),
            to_date: isoDate(now),
          },
        },
        include_fields: [
          'ProjectNum', 'ProjectTitle', 'Organization', 'AwardAmount',
          'AwardNoticeDate', 'AgencyIcAdmin', 'ProjectDetailUrl',
        ],
        limit,
        offset: 0,
      }),
    });

    const results = Array.isArray(payload?.results) ? payload.results : [];
    return results
      .filter((award) => award.project_title && award.project_num)
      .map((award) => {
        const org = tidy(award.organization?.org_name ?? '', 70);
        const amount = money(award.award_amount);
        return {
          title: org
            ? `${titleCase(org)} wins an NIH award: ${tidy(award.project_title, 90)}`
            : tidy(award.project_title, 130),
          link:
            award.project_detail_url ??
            `https://reporter.nih.gov/project-details/${encodeURIComponent(award.project_num)}`,
          summary: [amount, tidy(award.project_title, 200)].filter(Boolean).join(' — '),
          publishedAt: secondsFrom(award.award_notice_date) ?? now,
          topicHint: 'funding',
          note: amount ? `NIH award, ${amount}` : 'NIH award',
        };
      });
  },
};

/** RePORTER shouts organisation names; the feed does not. */
function titleCase(name) {
  if (!/[a-z]/.test(name)) {
    return name
      .toLowerCase()
      .replace(/\b([a-z])/g, (m) => m.toUpperCase())
      .replace(/\b(Llc|Inc|Ltd|Llp)\b/g, (m) => m.toUpperCase());
  }
  return name;
}

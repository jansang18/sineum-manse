/* Public birthday facts, checked against official profiles on 2026-09-19.
 * NamuWiki links are references, not a runtime scraping source. No biography
 * text, photos, private information, or inferred birth times are copied. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MansePeopleSupplement = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const officialHosts = new Set(['www.ygfamily.com', 'illit-official.jp', 'tws-official.jp']);
  const verifiedAt = '2026-09-19';
  const groups = {
    babymonster: { name: 'BABYMONSTER', label: 'YG 공식 프로필', url: 'https://www.ygfamily.com/en/artists/babymonster/profile' },
    illit: { name: '아일릿', label: '아일릿 공식 프로필', url: 'https://illit-official.jp/profile' },
    tws: { name: 'TWS', label: 'TWS 공식 프로필', url: 'https://tws-official.jp/profile' },
  };
  // id, display name, YYYYMMDD, published profile gender, search aliases, Namu title
  const rows = [
    ['babymonster-ruka', '루카 (BABYMONSTER)', '20020320', 'F', ['루카', 'RUKA'], '루카(BABYMONSTER)', 'e8a38ff5-f727-4534-99d4-6ea57e9d167d'],
    ['babymonster-pharita', '파리타', '20050826', 'F', ['PHARITA'], '파리타'],
    ['babymonster-asa', '아사 (BABYMONSTER)', '20060417', 'F', ['아사', 'ASA'], '아사(BABYMONSTER)'],
    ['babymonster-rami', '라미 (BABYMONSTER)', '20071017', 'F', ['라미', 'RAMI', '신하람'], '라미(BABYMONSTER)'],
    ['babymonster-chiquita', '치키타', '20090217', 'F', ['CHIQUITA'], '치키타'],
    ['illit-yunah', '윤아 (아일릿)', '20040115', 'F', ['윤아', 'YUNAH'], '윤아(ILLIT)'],
    ['illit-minju', '민주 (아일릿)', '20040511', 'F', ['민주', 'MINJU'], '민주(ILLIT)'],
    ['illit-moka', '모카 (아일릿)', '20041008', 'F', ['모카', 'MOKA'], '모카(ILLIT)'],
    ['illit-wonhee', '원희 (아일릿)', '20070626', 'F', ['원희', 'WONHEE'], '원희(ILLIT)', '9b180e6c-32ca-4f2f-af54-f961080796ad'],
    ['illit-iroha', '이로하 (아일릿)', '20080204', 'F', ['이로하', 'IROHA'], '이로하(ILLIT)', '9c570c1b-53bb-4d11-8551-0b235864aa0f'],
    ['tws-shinyu', '신유 (TWS)', '20031107', 'M', ['신유', 'SHINYU'], '신유(TWS)'],
    ['tws-dohoon', '도훈 (TWS)', '20050130', 'M', ['도훈', 'DOHOON'], '도훈'],
    ['tws-youngjae', '영재 (TWS)', '20050531', 'M', ['영재', 'YOUNGJAE'], '영재(TWS)', 'a55b6e6b-c4a5-49cd-82fa-c6eccce60216'],
    ['tws-hanjin', '한진 (TWS)', '20060105', 'M', ['한진', 'HANJIN'], '한진(TWS)'],
    ['tws-jihoon', '지훈 (TWS)', '20060328', 'M', ['지훈', 'JIHOON'], '지훈(TWS)'],
    ['tws-kyungmin', '경민 (TWS)', '20071002', 'M', ['경민', 'KYUNGMIN'], '경민(TWS)'],
  ];

  function validDay(ymd) {
    if (!/^\d{8}$/.test(ymd)) return false;
    const y = Number(ymd.slice(0, 4)), m = Number(ymd.slice(4, 6)), d = Number(ymd.slice(6, 8));
    if (y < 1900 || y > 2100) return false;
    const probe = new Date(Date.UTC(y, m - 1, d));
    return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
  }

  function safeUrl(value, hosts) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port && hosts.has(url.hostname);
    } catch (_) { return false; }
  }

  function validRecord(person) {
    const e = person && person.evidence;
    return !!(person && typeof person.n === 'string' && person.n.trim() && validDay(person.y) &&
      ['M', 'F', ''].includes(person.g) && Array.isArray(person.aliases) &&
      person.aliases.every(alias => typeof alias === 'string' && alias.trim()) &&
      e && /^[a-z0-9-]+$/.test(e.id) && e.calendar === 'solar' && e.birthTime === null &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.verifiedAt) &&
      safeUrl(e.namuUrl, new Set(['namu.wiki'])) && safeUrl(e.officialUrl, officialHosts));
  }

  const records = rows.map(([id, n, y, g, aliases, namuTitle, revision]) => {
    const group = groups[id.split('-')[0]];
    const namuUrl = `https://namu.wiki/w/${encodeURIComponent(namuTitle)}`;
    return { n, y, g, d: `${group.name} · 가수`, k: normalize(n),
      aliases: [n, ...aliases, `${group.name} ${aliases[0] || n}`],
      evidence: { id, calendar: 'solar', birthTime: null, verifiedAt,
        genderBasis: '공개 그룹 프로필 분류',
        officialLabel: group.label, officialUrl: group.url,
        namuUrl, namuEvidenceUrl: revision ? `${namuUrl}?uuid=${revision}` : namuUrl } };
  }).filter(validRecord);

  const byId = id => records.find(person => person.evidence.id === id) || null;
  const sameName = (record, name) => record.aliases.some(alias => normalize(alias) === normalize(name));

  function mergeLocal(base) {
    const result = (Array.isArray(base) ? base : []).map(person => ({ ...person }));
    const additions = [];
    for (const person of records) {
      const existing = result.find(candidate => candidate.y === person.y && sameName(person, candidate.n));
      if (existing) {
        existing.aliases = [...person.aliases];
        existing.evidence = person.evidence;
      } else additions.push({ ...person });
    }
    return additions.concat(result);
  }

  function forDate(date) {
    if (!date || ![date.year, date.month, date.day].every(value => Number.isInteger(Number(value)))) return [];
    const ymd = `${String(date.year).padStart(4, '0')}${String(date.month).padStart(2, '0')}${String(date.day).padStart(2, '0')}`;
    if (!validDay(ymd)) return [];
    return records.filter(person => person.y === ymd).map(person => ({
      id: person.evidence.id, qid: `curated:${person.evidence.id}`, name: person.n, title: person.n,
      date: { year: Number(date.year), month: Number(date.month), day: Number(date.day) },
      birthYear: Number(date.year), description: person.d, article: person.evidence.officialUrl,
      views: null, sitelinks: 0, curated: true, evidence: person.evidence,
    }));
  }

  function mergeCandidates(online, date) {
    const result = (Array.isArray(online) ? online : []).map(person => ({ ...person }));
    for (const person of forDate(date)) {
      const record = byId(person.id);
      const existing = result.find(candidate => {
        const d = candidate.date;
        return d && Number(d.year) === person.date.year && Number(d.month) === person.date.month &&
          Number(d.day) === person.date.day && sameName(record, candidate.name);
      });
      if (existing) existing.evidence = person.evidence;
      else result.push(person);
    }
    return result;
  }

  return { records, validRecord, byId, mergeLocal, forDate, mergeCandidates };
});

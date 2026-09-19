const test = require('node:test');
const assert = require('node:assert/strict');
const people = require('../people-supplement.js');

test('verified additions have real Gregorian days and two traceable sources, never a birth time', () => {
  assert.deepEqual(people.records.map(p => [p.evidence.id, p.y]), [
    ['babymonster-ruka', '20020320'], ['babymonster-pharita', '20050826'],
    ['babymonster-asa', '20060417'], ['babymonster-rami', '20071017'],
    ['babymonster-chiquita', '20090217'],
    ['illit-yunah', '20040115'], ['illit-minju', '20040511'], ['illit-moka', '20041008'],
    ['illit-wonhee', '20070626'], ['illit-iroha', '20080204'],
    ['tws-shinyu', '20031107'], ['tws-dohoon', '20050130'], ['tws-youngjae', '20050531'],
    ['tws-hanjin', '20060105'], ['tws-jihoon', '20060328'], ['tws-kyungmin', '20071002'],
  ], 'a missing or changed verified profile must be reviewed explicitly');
  assert.equal(new Set(people.records.map(p => p.evidence.id)).size, people.records.length);
  for (const person of people.records) {
    assert.equal(people.validRecord(person), true, person.n);
    assert.equal(person.evidence.birthTime, null);
    assert.equal(person.evidence.calendar, 'solar');
    assert.equal(new URL(person.evidence.namuUrl).hostname, 'namu.wiki');
    assert.ok(person.evidence.officialUrl.startsWith('https://'));
  }
  assert.equal(people.records.find(p => p.aliases.includes('RAMI')).y, '20071017');
});

test('aliases enrich an identical local identity but never overwrite a conflicting date or a namesake', () => {
  const base = [{ n: '라미', y: '20071017', g: 'F', d: '기존 가수', k: '라미' },
    { n: '라미', y: '19900301', g: 'F', d: '동명이인', k: '라미' }];
  const merged = people.mergeLocal(base);
  assert.equal(merged.filter(p => p.y === '20071017' && p.aliases?.includes('RAMI')).length, 1);
  assert.equal(merged.find(p => p.y === '19900301').d, '동명이인');
  assert.equal(base[0].evidence, undefined, 'do not mutate the original Wikidata list');
});

test('exact birth date matching includes year; unknown and impossible dates are rejected', () => {
  assert.equal(people.forDate({ year: 2007, month: 10, day: 17 }).some(p => p.name.includes('라미')), true);
  assert.equal(people.forDate({ year: 2008, month: 10, day: 17 }).some(p => p.name.includes('라미')), false);
  assert.deepEqual(people.forDate({ year: 2007, month: 2, day: 30 }), []);
  const record = people.records[0];
  for (const invalid of [
    { ...record, y: '20070230' },
    { ...record, y: '20071000' },
    { ...record, evidence: { ...record.evidence, calendar: 'lunar' } },
    { ...record, evidence: { ...record.evidence, officialUrl: 'javascript:alert(1)' } },
    { ...record, evidence: { ...record.evidence, officialUrl: 'https://attacker.example/fake' } },
  ]) assert.equal(people.validRecord(invalid), false);
});

test('online duplicate keeps genuine popularity and source evidence without fabricated metrics', () => {
  const date = { year: 2007, month: 10, day: 17 };
  const online = [{ name: '라미', title: '라미', date, birthYear: 2007,
    qid: 'Q1234', views: 123, sitelinks: 10, article: 'https://ko.wikipedia.org/wiki/라미' }];
  const merged = people.mergeCandidates(online, date);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].views, 123);
  assert.ok(merged[0].evidence.namuUrl);
  const offline = people.mergeCandidates([], date);
  assert.equal(offline[0].views, null);
  assert.equal(offline[0].curated, true);
  assert.equal(people.byId(offline[0].evidence.id).y, '20071017');
});

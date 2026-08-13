import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const enginePath = path.join(root, 'annual-reading.js');

function loadApi() {
  assert.ok(fs.existsSync(enginePath), 'annual-reading.js must exist');
  const source = fs.readFileSync(enginePath, 'utf8');
  const context = { console };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: 'annual-reading.js' });
  return context.SajuAnnualReading;
}

function fixture(overrides = {}) {
  const year = overrides.year || 2026;
  return {
    name: '홍길동',
    gender: 'M',
    birthYear: 1989,
    year,
    age: year - 1989,
    dayStem: '경',
    dayElement: '금',
    strong: true,
    yongsin: '수',
    seunGanji: year === 2026 ? '병오' : '정미',
    seunStemGod: year === 2026 ? '편관' : '정관',
    seunBranchGod: year === 2026 ? '정관' : '정인',
    annualStemElement: '화',
    annualBranchElement: year === 2026 ? '화' : '토',
    daeunGanji: '갑신',
    daeunStemGod: '편재',
    daeunBranchGod: '비견',
    harmony: year === 2026 ? 1.5 : 3,
    conflict: year === 2026 ? 3.5 : 1,
    scores: { overall: 50, love: 57, job: 61, money: 48, health: 44, move: 63 },
    interactions: [
      { type: '지지충', detail: '자오충' },
      { type: '천간합', detail: '을경합' }
    ],
    months: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      ganji: `월간지${index + 1}`,
      stemGod: index % 2 ? '정재' : '식신',
      branchGod: index % 3 ? '편인' : '정관',
      harmony: index % 4 === 0 ? 2 : 0,
      conflict: index % 5 === 0 ? 2 : 0
    })),
    ...overrides
  };
}

function visibleText(report) {
  const walk = value => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(walk).join(' ');
    if (value && typeof value === 'object') return Object.values(value).map(walk).join(' ');
    return '';
  };
  return walk(report).replace(/\s+/g, ' ').trim();
}

test('선택한 연도의 개인화 상세운을 충분한 밀도로 생성한다', () => {
  const report = loadApi().build(fixture());
  const text = visibleText(report);

  assert.equal(report.year, 2026);
  assert.equal(report.ganji, '병오');
  assert.equal(report.sections.length, 8);
  assert.equal(report.months.length, 12);
  assert.ok(report.sections.every(section => section.paragraphs.length >= 2));
  assert.ok(text.length >= 3000, `annual reading was only ${text.length} chars`);
  assert.match(text, /홍길동/);
  assert.match(text, /2026년/);
  assert.match(text, /병오/);
  assert.match(text, /갑신/);
  assert.match(text, /직업|일과 책임/);
  assert.match(text, /재물|재정/);
  assert.match(text, /관계|인연/);
  assert.match(text, /건강|생활 리듬/);
});

test('연도를 바꾸면 간지와 판독 내용도 함께 바뀐다', () => {
  const api = loadApi();
  const current = api.build(fixture());
  const next = api.build(fixture({
    year: 2027,
    age: 38,
    seunGanji: '정미',
    seunStemGod: '정관',
    seunBranchGod: '정인',
    annualBranchElement: '토',
    harmony: 3,
    conflict: 1,
    scores: { overall: 67, love: 62, job: 72, money: 59, health: 61, move: 55 }
  }));

  assert.equal(next.year, 2027);
  assert.equal(next.ganji, '정미');
  assert.match(visibleText(next), /2027년/);
  assert.notEqual(visibleText(current), visibleText(next));
});

test('엔진 결과는 HTML이 아닌 일반 문자열만 반환한다', () => {
  const report = loadApi().build(fixture({ name: '<img src=x onerror=alert(1)>' }));
  assert.match(visibleText(report), /<img/);
  assert.doesNotMatch(JSON.stringify(report), /<script\b/i);
});

test('입력 객체를 바꾸지 않고 유효한 선택 연도만 받는다', () => {
  const api = loadApi();
  const input = fixture();
  const before = JSON.stringify(input);

  api.build(input);
  assert.equal(JSON.stringify(input), before);
  assert.throws(() => api.build(fixture({ year: 1025 })), /1026.*2099/);
  assert.throws(() => api.build(fixture({ year: 2100 })), /1026.*2099/);
  assert.throws(() => api.build(fixture({ year: 2026.5 })), /정수/);
});

test('월별 지도는 임의의 연간 영역 점수를 월에 순환 배정하지 않는다', () => {
  const api = loadApi();
  const a = api.build(fixture({ scores: { overall: 50, love: 10, job: 20, money: 30, health: 40, move: 50 } }));
  const b = api.build(fixture({ scores: { overall: 50, love: 90, job: 80, money: 70, health: 60, move: 55 } }));

  assert.deepEqual(a.months, b.months);
  assert.ok(a.months.every(month => !/점은|\d+점/.test(month.guidance)));
});

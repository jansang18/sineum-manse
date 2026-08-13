import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function loadApi(filename, globalName) {
  const source = fs.readFileSync(path.join(root, filename), 'utf8');
  const context = { console };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename });
  return context[globalName];
}

function visibleStrings(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(visibleStrings).join(' ');
  if (value && typeof value === 'object') return Object.values(value).map(visibleStrings).join(' ');
  return '';
}

function visibleHtml(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readingFixture(overrides = {}) {
  return {
    name: '홍길동',
    gender: 'M',
    dayStem: 6,
    monthGod: 5,
    elements: [2, 1, 3, 4, 1],
    tenGods: [0, 5, 3, 1, 7, 4, 8],
    strong: true,
    support: 7,
    drain: 4,
    yongsin: '수',
    yongsinIndex: 4,
    interactions: [
      { type: '천간합', detail: '을경합' },
      { type: '지지충', detail: '자오충' }
    ],
    harmony: 2,
    conflict: 1,
    scores: { overall: 71, money: 68, love: 64, job: 73, health: 58, move: 62 },
    year: 2026,
    seunGanji: '병오',
    seunStemGod: '편관',
    seunBranchGod: '정관',
    daeunGod: '식신',
    ...overrides
  };
}

function lifeFixture() {
  const starts = [0, 6, 16, 26, 36, 46, 56, 66, 76];
  const points = Array.from({ length: 81 }, (_, age) => {
    let daeunIndex = 0;
    starts.forEach((start, index) => { if (age >= start) daeunIndex = index; });
    const wave = ((age * 7 + daeunIndex * 11) % 31) - 15;
    return {
      age,
      year: 1990 + age,
      daeunIndex,
      daeunChange: starts.includes(age) && age > 0,
      harmony: (age + daeunIndex) % 5,
      conflict: (age * 2 + daeunIndex) % 6,
      scores: {
        overall: 58 + wave,
        money: 56 + wave + daeunIndex,
        love: 62 - wave,
        job: 54 + Math.round(wave / 2),
        health: 60 - Math.round(wave / 3),
        move: 50 + Math.abs(wave)
      },
      seunGanji: '甲子',
      seunGanjiKor: '갑자',
      seunStemGod: '비견',
      seunBranchGod: '정인'
    };
  });
  const gods = ['정인', '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관'];
  const phases = starts.map((startAge, index) => ({
    index,
    startAge,
    endAge: index < starts.length - 1 ? starts[index + 1] - 1 : 80,
    stem: index % 10,
    branch: index % 12,
    isInitial: index === 0,
    ganji: `運${index}`,
    ganjiKor: `운${index}`,
    stemGod: gods[index],
    branchGod: gods[(index + 1) % gods.length]
  }));
  return { methodVersion: 'test-v1', currentAge: 27, unknownTime: false, points, phases };
}

test('장문 판독은 10개 장과 충분한 개인화 본문을 생성한다', () => {
  const api = loadApi('reading.js', 'SajuGangpaeReading');
  const report = api.build(readingFixture());

  assert.equal(report.sections.length, 10);
  assert.ok(report.sections.every(section => section.paragraphs.length === 3));
  assert.equal(report.closing.paragraphs.length, 2);
  assert.equal(report.closing.rules.length, 5);
  assert.ok(visibleStrings(report).length >= 5500);
  assert.match(visibleStrings(report), /홍길동/);
  assert.match(visibleStrings(report), /2026/);
});

test('장문 판독은 입력에 민감하고 원석과 칼의 올바른 주격 조사를 쓴다', () => {
  const api = loadApi('reading.js', 'SajuGangpaeReading');
  const metal = api.build(readingFixture());
  const wood = api.build(readingFixture({ name: '김하늘', dayStem: 0, year: 2027 }));

  assert.notEqual(visibleStrings(metal), visibleStrings(wood));
  assert.equal(metal.sections[0].title, '원석과 칼이 방 안으로 들어오는 방식');
  assert.doesNotMatch(metal.sections[0].title, /원석과 칼가/);
  assert.match(visibleStrings(wood), /김하늘/);
  assert.match(visibleStrings(wood), /2027/);
  assert.doesNotMatch(visibleStrings(wood), /올해/);
});

test('인생 총운은 9개 대운의 27개 단락과 실제 경계 사건 7개를 보존한다', () => {
  const modelApi = loadApi('life-model.js', 'SajuGangpaeLifeModel');
  const model = modelApi.build(lifeFixture());

  assert.equal(model.points.length, 81);
  assert.equal(model.phases.length, 9);
  assert.equal(model.phases.reduce((count, phase) => count + phase.paragraphs.length, 0), 27);
  assert.equal(model.events.length, 7);
  assert.ok(model.events.every(event => event.confidence === 'structural'));
  assert.equal(model.phases.filter(phase => phase.current).length, 1);
});

test('인생 총운 렌더는 접힌 구간까지 9천 자 이상을 공개 DOM에 보존한다', () => {
  const modelApi = loadApi('life-model.js', 'SajuGangpaeLifeModel');
  const forecastApi = loadApi('life-forecast.js', 'SajuGangpaeLife');
  const model = modelApi.build(lifeFixture());
  const html = forecastApi.render(model);

  assert.equal(Array.from(html.matchAll(/\bdata-life-phase="\d+"/g)).length, 9);
  assert.equal(Array.from(html.matchAll(/\bdata-life-event(?=[\s>])/g)).length, 7);
  assert.equal(Array.from(html.matchAll(/<div class="life-phase__prose">[\s\S]*?<\/div>/g)).length, 9);
  assert.equal(Array.from(html.matchAll(/<div class="life-phase__prose">[\s\S]*?<p>/g)).length, 9);
  assert.ok(visibleHtml(html).length >= 9000, `visible life-course length was ${visibleHtml(html).length}`);
  assert.doesNotMatch(html, /data-pro-unlock|\bLOCKED\b|paywall|잠금|결제\s*후/iu);
});

test('두 장문 엔진의 결합 결과는 어느 한쪽도 축약하지 않는다', () => {
  const reading = loadApi('reading.js', 'SajuGangpaeReading').build(readingFixture());
  const model = loadApi('life-model.js', 'SajuGangpaeLifeModel').build(lifeFixture());
  const lifeHtml = loadApi('life-forecast.js', 'SajuGangpaeLife').render(model);
  const combinedLength = visibleStrings(reading).length + visibleHtml(lifeHtml).length;

  assert.ok(visibleStrings(reading).length >= 5500);
  assert.ok(visibleHtml(lifeHtml).length >= 9000);
  assert.ok(combinedLength >= 14500, `combined long-content length was ${combinedLength}`);
});

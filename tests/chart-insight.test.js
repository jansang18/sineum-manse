// 판독 도구 회귀: 합충·12운성·12신살·귀인, 두 명식 비교.
const test = require('node:test');
const assert = require('node:assert/strict');
const insight = require('../chart-insight.js');

// 1994-11-27 여자: 일주 丁巳, 월주 乙亥, 년주 甲戌, 시 모름, 공망 申酉.
const chart = { hStem: -1, hBranch: -1, dStem: 3, dBranch: 5, mStem: 1, mBranch: 11, yStem: 0, yBranch: 10, gongmang: [8, 9] };

test('壬申 대운과 원국의 관계', () => {
  const texts = insight.relations(8, 8, insight.pillarsOf(chart), chart.gongmang).map(item => item.text);
  assert.ok(texts.includes('일간 丁壬 합'));
  assert.ok(texts.includes('일지 巳申 육합'));
  assert.ok(texts.includes('월지 亥申 해'));
  assert.ok(texts.includes('申 공망'));
});

test('왕지가 없는 두 글자는 반합으로 보지 않고, 세 글자는 삼합이다', () => {
  const only = name => insight.relations(0, name[1], [{ name: '일', stem: 2, branch: name[0] }], null).map(item => item.text);
  assert.equal(only([8, 4]).some(text => text.includes('반합')), false);
  assert.equal(only([8, 0]).some(text => text.includes('반합')), true);
  const full = insight.relations(0, 4, [{ name: '일', stem: 2, branch: 8 }, { name: '월', stem: 2, branch: 0 }], null).map(item => item.text);
  assert.ok(full.some(text => text.includes('삼합(수국)')));
});

test('12운성은 양간 순행, 음간 역행', () => {
  assert.equal(insight.twelveStage(0, 2), '건록');   // 甲-寅
  assert.equal(insight.twelveStage(0, 3), '제왕');   // 甲-卯
  assert.equal(insight.twelveStage(1, 3), '건록');   // 乙-卯
  assert.equal(insight.twelveStage(3, 5), '제왕');   // 丁-巳
  assert.equal(insight.twelveStage(8, 11), '건록');  // 壬-亥
  assert.equal(insight.twelveStage(9, 3), '장생');   // 癸-卯
});

test('12신살과 귀인', () => {
  assert.equal(insight.twelveSinsal(10, 11), '겁살'); // 戌년 亥
  assert.equal(insight.twelveSinsal(10, 8), '역마');  // 寅午戌 → 申
  assert.equal(insight.twelveSinsal(0, 9), '연살');   // 申子辰 → 酉
  assert.deepEqual(insight.guiin(3, 11), ['천을귀인']);
  assert.deepEqual(insight.guiin(0, 5), ['문창귀인']);
});

test('모르는 시주는 비교에서 빠진다', () => {
  const other = { hStem: 8, hBranch: 8, dStem: 8, dBranch: 8, mStem: 2, mBranch: 2, yStem: 0, yBranch: 0 };
  const list = insight.compare(chart, other).map(item => item.text);
  assert.ok(list.includes('일주 ↔ 일간 丁壬 합'));
  assert.equal(list.some(text => text.includes('시간') || text.includes('시지')), false);
});

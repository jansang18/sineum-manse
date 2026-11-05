// 대운수 규칙 회귀: 절입까지 일수 ÷ 3 반올림, 역행 순서, 실제 시작 나이.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lines = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').split('\n');
const find = prefix => lines.findIndex(line => line.startsWith(prefix));
const tables = lines.slice(find('const STEM = '), find('function hourToBranch')).join('\n');
const daeun = lines.slice(find('function calcDaeun'), find('function getWoonMonth')).join('\n');
const sandbox = {};
vm.runInNewContext(`${tables}\n${daeun}\nObject.assign(globalThis, { toJD, getMonthBranch, getYearStemBranch, getMonthStem, calcDaeun, STEM, BRANCH });`, sandbox);

function chart(year, month, day, fraction, gender) {
  const { toJD, getMonthBranch, getYearStemBranch, getMonthStem, calcDaeun } = sandbox;
  const jd = toJD(year, month, day) + fraction;
  const y = getYearStemBranch(jd, year);
  const m = getMonthBranch(jd, year);
  const stem = getMonthStem(((y.useYear - 4) % 10 + 10) % 10, m.branch);
  return calcDaeun(y.stem, gender, stem, m.branch, jd, year);
}
const ganji = item => sandbox.STEM[item.stem] + sandbox.BRANCH[item.branch];

test('1994-11-27 여자, 시각 미입력(정오): 대운수 6, 6세 5개월 시작, 역행', () => {
  const result = chart(1994, 11, 27, 0.5, 'F');
  assert.equal(result.forward, false);
  assert.equal(result.num, 6);
  assert.equal(result.startYears, 6);
  assert.equal(result.startMonths, 5);
  assert.equal(result.list.slice(1).map(ganji).join(' '), '甲戌 癸酉 壬申 辛未 庚午 己巳 戊辰 丁卯 丙寅 乙丑');
  assert.equal(result.list[3].age, 26);
});

test('같은 날이라도 절입까지 6.5를 넘기면 대운수를 올린다', () => {
  assert.equal(chart(1994, 11, 27, 0, 'F').num, 6);
  assert.equal(chart(1994, 11, 27, 18 / 24, 'F').num, 7);
});

test('절입 직후 출생도 대운수는 1 이상이다', () => {
  assert.equal(chart(1994, 11, 8, 1 / 24, 'F').num, 1);
});

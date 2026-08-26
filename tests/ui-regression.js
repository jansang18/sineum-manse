const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const puppeteer = require('puppeteer-core');

const inferredAppRoot = fs.existsSync(path.join(__dirname, 'www', 'index.html'))
  ? __dirname
  : path.resolve(__dirname, '..', '..');
const APP_ROOT = process.env.APP_ROOT
  ? path.resolve(process.cwd(), process.env.APP_ROOT)
  : inferredAppRoot;
const WEB_ROOT = process.env.WEB_ROOT
  ? path.resolve(APP_ROOT, process.env.WEB_ROOT)
  : path.join(APP_ROOT, 'web');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const UI_ROOT = process.env.UI_ROOT
  ? path.resolve(APP_ROOT, process.env.UI_ROOT)
  : path.join(APP_ROOT, 'www');
const URL = process.env.TEST_URL || pathToFileURL(path.join(UI_ROOT, 'index.html')).href;
const TEST_GROUP = process.env.TEST_GROUP || '';
const widths = TEST_GROUP === 'annual-year-reading' || TEST_GROUP === 'unified-reading'
  ? [390, 768, 1280]
  : TEST_GROUP === 'unified-surface'
  ? [320, 360, 390, 412, 520, 600, 720, 768, 884, 1024, 1280, 1440]
  : TEST_GROUP === 'reading-readability'
  ? [390, 768, 1280]
  : TEST_GROUP === 'luck-flow-responsive'
    ? [390, 560, 561, 600, 601, 710, 768, 1220]
  : TEST_GROUP === 'desktop-action-rail'
    ? [320, 360, 390, 412, 720, 884, 1024, 1025, 1280]
    : TEST_GROUP === 'result-width-brand'
      ? [390, 1220, 1280]
      : TEST_GROUP === 'shell-width'
        ? [390, 1220]
    : TEST_GROUP === 'same-pillars-60'
      ? [390, 768]
      : TEST_GROUP === 'fold-layout'
        ? [720, 884]
        : TEST_GROUP === 'calendar-shell-width'
          ? [390, 520, 600, 700, 768, 900, 1220]
          : TEST_GROUP === 'all-tab-shell-width'
            ? [390, 520, 600, 700, 768, 1220]
            : TEST_GROUP === 'frontend-quality'
              ? [320, 768, 1440]
              : TEST_GROUP ? [390] : [360, 390, 412, 768];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const runsGroup = name => !TEST_GROUP || TEST_GROUP === name;
const runsSecondaryApple = () => !TEST_GROUP || TEST_GROUP === 'task-5' || TEST_GROUP === 'secondary-apple';
const runsAppleMotion = () => !TEST_GROUP || TEST_GROUP === 'motion-contract';
const runsCalendarCurrentYear = () => !TEST_GROUP || TEST_GROUP === 'calendar-current-year';
const runsImportedFieldXss = () => !TEST_GROUP || TEST_GROUP === 'imported-fields-xss';
const runsResultWidthBrand = () => TEST_GROUP === 'result-width-brand';
const runsShellWidth = () => TEST_GROUP === 'shell-width';
const runsFoldLayout = () => TEST_GROUP === 'fold-layout';
const runsResultHeaderCompact = () => !TEST_GROUP || TEST_GROUP === 'result-header-compact';
const runsAndroidSafeArea = () => !TEST_GROUP || TEST_GROUP === 'android-safe-area';
const runsSamePillars60 = () => !TEST_GROUP || TEST_GROUP === 'same-pillars-60';
const runsLuckFlowOrder = () => !TEST_GROUP || TEST_GROUP === 'luck-flow-order';
const runsLuckFlowAccessibility = () =>
  !TEST_GROUP || TEST_GROUP === 'luck-flow-accessibility';
const runsLuckFlowResponsive = () =>
  !TEST_GROUP || TEST_GROUP === 'luck-flow-responsive';
const runsLongReading = () =>
  !TEST_GROUP || TEST_GROUP === 'long-reading' || TEST_GROUP === 'reading-readability';
const runsAnnualYearReading = () => TEST_GROUP === 'annual-year-reading';
const runsUnifiedSurface = () => TEST_GROUP === 'unified-surface';
const runsUnifiedReading = () => TEST_GROUP === 'unified-reading';
const runsDesktopActionRail = () => TEST_GROUP === 'desktop-action-rail';
const runsLunarInput = () => !TEST_GROUP || TEST_GROUP === 'lunar-input';

async function resetLuckFlow(page) {
  await page.evaluate(() => {
    selectedDaeun = null;
    selectedSeun = null;
    selectedWoon = null;
    renderResult();
  });
  await sleep(50);
}

async function inspectSamePillars60(page, width) {
  if (!runsSamePillars60() || (!TEST_GROUP && width !== 390)) return;

  const state = await page.evaluate(() => {
    const report = window.findSamePillars60(currentSaju);
    const feb1986 = calcSaju({
      year: 1986, month: 2, day: 19,
      hour: 0, minute: 0,
      calendar: 'solar', gender: 'M', unknown: true
    });
    const feb1986Report = window.findSamePillars60(feb1986);
    const nov1994 = calcSaju({
      year: 1994, month: 11, day: 27,
      hour: 0, minute: 0,
      calendar: 'solar', gender: 'M', unknown: true
    });
    const nov1994Report = window.findSamePillars60(nov1994);
    const peopleFixture = {
      results: {
        bindings: [
          {
            person: { value: 'http://www.wikidata.org/entity/Q512' },
            personLabel: { value: '앨런 그린스펀' },
            article: { value: 'https://ko.wikipedia.org/wiki/%EC%95%A8%EB%9F%B0_%EA%B7%B8%EB%A6%B0%EC%8A%A4%ED%8E%80' },
            sitelinks: { value: '67' }
          },
          {
            person: { value: 'http://www.wikidata.org/entity/Q51541' },
            personLabel: { value: '안제이 바이다' },
            article: { value: 'https://ko.wikipedia.org/wiki/%EC%95%88%EC%A0%9C%EC%9D%B4_%EB%B0%94%EC%9D%B4%EB%8B%A4' },
            sitelinks: { value: '79' }
          },
          {
            person: { value: 'http://www.wikidata.org/entity/Q623475' },
            personLabel: { value: '김재규' },
            article: { value: 'https://ko.wikipedia.org/wiki/%EA%B9%80%EC%9E%AC%EA%B7%9C' },
            sitelinks: { value: '90' }
          }
        ]
      }
    };
    const peopleUrl = window.buildWikidataBirthdayQueryUrl({ year: 1926, month: 3, day: 6 });
    const parsedPeople = window.parseWikidataBirthdayResults(peopleFixture, { year: 1926, month: 3, day: 6 });
    const biographyFixture = {
      query: {
        pages: [
          { title: '김재규', extract: '김재규(金載圭, 1924년 4월 9일 ~ 1980년 5월 24일)는 대한민국의 군인, 정치인이다.' },
          { title: '앨런 그린스펀', extract: '앨런 그린스펀(1926년 3월 6일 ~ )은 미국의 경제학자이다.' },
          { title: '안제이 바이다', extract: '안제이 바이다(1926년 3월 6일 ~ 2016년 10월 9일)는 폴란드의 영화 감독이다.' }
        ]
      }
    };
    const biographyUrl = window.buildWikipediaBiographyUrl(parsedPeople);
    const verifiedPeople = window.filterSamePillarPeopleByWikipedia(biographyFixture, parsedPeople);
    const kimJaeGyu = window.searchLocalPeople('김재규', 1)[0];
    const sameBirthdayFixture = {
      parse: {
        text: {
          '*': `
            <div class="mw-heading mw-heading2"><h2 id="탄생">탄생</h2></div>
            <ul>
              <li><a href="/wiki/1473년" title="1473년">1473년</a> - 폴란드의 천문학자 <a href="/wiki/니콜라우스_코페르니쿠스" title="니콜라우스 코페르니쿠스">니콜라우스 코페르니쿠스</a>. (~<a href="/wiki/1543년" title="1543년">1543년</a>)</li>
              <li><a href="/wiki/2004년" title="2004년">2004년</a> - 영국의 배우 <a href="/wiki/밀리_바비_브라운" title="밀리 바비 브라운">밀리 바비 브라운</a>.</li>
            </ul>
            <div class="mw-heading mw-heading2"><h2 id="사망">사망</h2></div>
            <ul><li><a href="/wiki/제외될_인물" title="제외될 인물">제외될 인물</a></li></ul>
          `
        }
      }
    };
    const birthdayCandidates = window.parseWikipediaSameBirthdayBirths(
      sameBirthdayFixture,
      { year: 2004, month: 2, day: 19 }
    );
    const wrongYearCandidates = window.parseWikipediaSameBirthdayBirths(
      sameBirthdayFixture,
      { year: 1986, month: 2, day: 19 }
    );
    const birthdayPopularityFixture = {
      query: {
        pages: {
          1: {
            title: '니콜라우스 코페르니쿠스',
            description: '폴란드의 천문학자',
            pageviews: { '2026-07-01': 100, '2026-07-02': 50 }
          },
          2: {
            title: '밀리 바비 브라운',
            description: '영국의 배우',
            pageviews: { '2026-07-01': 700, '2026-07-02': 200 }
          }
        }
      }
    };
    const birthdayDateUrl = window.buildWikipediaSameBirthdayUrl({ year: 2004, month: 2, day: 19 });
    const birthdayPopularityUrl = window.buildWikipediaBirthdayPopularityUrl(
      birthdayCandidates.map(person => person.title)
    );
    const rankedBirthdayPeople = window.rankWikipediaBirthdayPeople(
      birthdayPopularityFixture,
      birthdayCandidates
    );
    const limitCandidates = Array.from({ length: 9 }, (_, index) => ({
      title: `인물 ${index + 1}`,
      name: `인물 ${index + 1}`,
      birthYear: 1900 + index,
      article: `https://ko.wikipedia.org/wiki/${encodeURIComponent(`인물_${index + 1}`)}`
    }));
    const limitFixture = {
      query: {
        pages: limitCandidates.map((person, index) => ({
          title: person.title,
          pageviews: { '2026-07-01': index + 1 }
        }))
      }
    };
    const limitedBirthdayPeople = window.rankWikipediaBirthdayPeople(limitFixture, limitCandidates);
    const lunarBirthdaySaju = calcSaju({
      year: 1986, month: 2, day: 19,
      hour: 0, minute: 0,
      calendar: 'lunar', gender: 'M', unknown: true
    });
    const lunarBirthdayComparison = window.getSameBirthdayComparisonDate(lunarBirthdaySaju);
    const referenceMoment = (year, month, day, hour, minute) =>
      toJD(year, month, day) + (hour + minute / 60) / 24;
    const gyeongchip1926 = findJeolgiJD(1926, 345);
    const ipchun2024 = findJeolgiJD(2024, 315);
    const snapshot = date => {
      const timeFraction = currentSaju.unknown ? 0.5 : (currentSaju.hour + currentSaju.minute / 60) / 24;
      const jd = toJD(date.year, date.month, date.day) + timeFraction;
      const year = getYearStemBranch(jd, date.year);
      const month = getMonthBranch(jd, date.year);
      return {
        yStem: year.stem,
        yBranch: year.branch,
        mStem: getMonthStem(year.stem, month.branch),
        mBranch: month.branch,
        ...dayGanji(toJD(date.year, date.month, date.day))
      };
    };
    const region = document.getElementById('samePillars60');
    const rect = region.getBoundingClientRect();
    const exactRect = region.querySelector('.cycle-row-exact').getBoundingClientRect();
    return {
      functionType: typeof window.findSamePillars60,
      report,
      feb1986Exact: feb1986Report.exactMatches,
      nov1994Report: {
        exactMatches: nov1994Report.exactMatches,
        searchStartYear: nov1994Report.searchStartYear,
        cycleCount: nov1994Report.cycleCount,
        cycles: nov1994Report.cycles
      },
      nov1994Html: window.renderSamePillars60(nov1994, nov1994Report),
      peopleApi: {
        buildType: typeof window.buildWikidataBirthdayQueryUrl,
        parseType: typeof window.parseWikidataBirthdayResults,
        biographyBuildType: typeof window.buildWikipediaBiographyUrl,
        verifyType: typeof window.filterSamePillarPeopleByWikipedia,
        loadType: typeof window.loadSamePillarPeople,
        url: peopleUrl,
        biographyUrl,
        parsedPeople,
        verifiedPeople,
        kimJaeGyu,
        regionExists: !!document.getElementById('samePillarPeople')
      },
      sameBirthdayApi: {
        dateUrlType: typeof window.buildWikipediaSameBirthdayUrl,
        parseType: typeof window.parseWikipediaSameBirthdayBirths,
        popularityUrlType: typeof window.buildWikipediaBirthdayPopularityUrl,
        rankType: typeof window.rankWikipediaBirthdayPeople,
        loadType: typeof window.loadSameBirthdayPeople,
        dateUrl: birthdayDateUrl,
        popularityUrl: birthdayPopularityUrl,
        candidates: birthdayCandidates,
        wrongYearCandidates,
        rankedPeople: rankedBirthdayPeople,
        limitedPeople: limitedBirthdayPeople,
        regionExists: !!document.getElementById('sameBirthdayPeople'),
        requestKey: document.getElementById('sameBirthdayPeople')?.dataset.requestKey,
        calendarText: document.querySelector('#sameBirthdayPeople .birthday-calendar-note')?.textContent.trim(),
        lunarComparison: lunarBirthdayComparison
      },
      solarTermReference: {
        gyeongchip1926MinuteDelta: Math.abs(gyeongchip1926 - referenceMoment(1926, 3, 6, 17, 0)) * 1440,
        ipchun2024MinuteDelta: Math.abs(ipchun2024 - referenceMoment(2024, 2, 4, 17, 27)) * 1440,
        gyeongchipBeforeBranch: getMonthBranch(gyeongchip1926 - 1 / 1440, 1926).branch,
        gyeongchipAfterBranch: getMonthBranch(gyeongchip1926 + 1 / 1440, 1926).branch,
        ipchunBeforeYear: getYearStemBranch(ipchun2024 - 1 / 1440, 2024).useYear,
        ipchunAfterYear: getYearStemBranch(ipchun2024 + 1 / 1440, 2024).useYear
      },
      exactSnapshots: report.exactMatches.map(snapshot),
      text: region.textContent,
      regionRole: region.getAttribute('aria-labelledby'),
      overflow: Math.max(0, rect.right - document.documentElement.clientWidth),
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      exactWidth: exactRect.width,
      hasTargetGrid: !!region.querySelector('.cycle-target'),
      hasNearestBreakdown: !!region.querySelector('.cycle-nearest-label, .cycle-row:not(.cycle-row-exact)')
    };
  });

  assert.equal(state.functionType, 'function', 'millennium pillar search API missing');
  assert.ok(state.report.exactMatches.length > 0, 'an exact year/month/day pillar match should exist in the supported history');
  assert.ok(
    state.feb1986Exact.some(date => date.year === 1926 && date.month === 3 && date.day === 6),
    '1986-02-19 must retain the exact date 1926-03-06'
  );
  assert.ok(
    state.nov1994Report.exactMatches.some(date => date.year === 1814 && date.month === 11 && date.day === 11),
    '1994-11-27 must find the exact three-pillar date 1814-11-11'
  );
  assert.ok(
    state.nov1994Report.exactMatches.some(date => date.year === 1034 && date.month === 11 && date.day === 20),
    'the search must reach the lower end of the 1,000-year calendar range'
  );
  assert.equal(state.nov1994Report.searchStartYear, 1026, 'history search must begin at the supported year 1026');
  assert.ok(state.nov1994Report.cycleCount >= 16, '1994 input must compare every prior 60-year cycle back to 1026');
  assert.ok(
    state.nov1994Report.cycles.every(cycle => cycle.exactMatches.every(date => date.year >= 1026)),
    'history search must not return dates outside the supported calendar range'
  );
  assert.deepEqual(
    {
      buildType: state.peopleApi.buildType,
      parseType: state.peopleApi.parseType,
      biographyBuildType: state.peopleApi.biographyBuildType,
      verifyType: state.peopleApi.verifyType,
      loadType: state.peopleApi.loadType,
      regionExists: state.peopleApi.regionExists
    },
    {
      buildType: 'function',
      parseType: 'function',
      biographyBuildType: 'function',
      verifyType: 'function',
      loadType: 'function',
      regionExists: true
    },
    'same-pillar Wikipedia people integration is incomplete'
  );
  const peopleUrl = new globalThis.URL(state.peopleApi.url);
  assert.equal(peopleUrl.hostname, 'query.wikidata.org');
  assert.equal(peopleUrl.pathname, '/sparql');
  assert.match(peopleUrl.searchParams.get('query'), /1926-03-06T00:00:00Z/);
  assert.deepEqual(
    state.peopleApi.parsedPeople.map(person => person.name),
    ['김재규', '안제이 바이다', '앨런 그린스펀'],
    'Wikipedia people must be ranked by Wikidata sitelink count'
  );
  const biographyUrl = new globalThis.URL(state.peopleApi.biographyUrl);
  assert.equal(biographyUrl.hostname, 'ko.wikipedia.org');
  assert.equal(biographyUrl.searchParams.get('prop'), 'extracts');
  assert.match(biographyUrl.searchParams.get('titles'), /김재규/);
  assert.deepEqual(
    state.peopleApi.verifiedPeople.map(person => person.name),
    ['안제이 바이다', '앨런 그린스펀'],
    'a person whose Korean Wikipedia birth date conflicts with Wikidata must not be shown as an exact same-pillar match'
  );
  assert.equal(state.peopleApi.kimJaeGyu.y, '19240409', 'the built-in Kim Jae-gyu date must use the corrected solar date');
  assert.match(state.peopleApi.kimJaeGyu.d, /음력 1924-03-06/, 'the corrected record must preserve the source lunar date');
  assert.deepEqual(
    {
      dateUrlType: state.sameBirthdayApi.dateUrlType,
      parseType: state.sameBirthdayApi.parseType,
      popularityUrlType: state.sameBirthdayApi.popularityUrlType,
      rankType: state.sameBirthdayApi.rankType,
      loadType: state.sameBirthdayApi.loadType,
      regionExists: state.sameBirthdayApi.regionExists
    },
    {
      dateUrlType: 'function',
      parseType: 'function',
      popularityUrlType: 'function',
      rankType: 'function',
      loadType: 'function',
      regionExists: true
    },
    'same-birthday Korean Wikipedia integration is incomplete'
  );
  const birthdayDateUrl = new globalThis.URL(state.sameBirthdayApi.dateUrl);
  assert.equal(birthdayDateUrl.hostname, 'ko.wikipedia.org');
  assert.equal(birthdayDateUrl.pathname, '/w/api.php');
  assert.equal(birthdayDateUrl.searchParams.get('action'), 'parse');
  assert.equal(birthdayDateUrl.searchParams.get('page'), '2월 19일');
  assert.equal(birthdayDateUrl.searchParams.get('prop'), 'text');
  const birthdayPopularityUrl = new globalThis.URL(state.sameBirthdayApi.popularityUrl);
  assert.equal(birthdayPopularityUrl.hostname, 'ko.wikipedia.org');
  assert.match(birthdayPopularityUrl.searchParams.get('prop'), /pageviews/);
  assert.equal(birthdayPopularityUrl.searchParams.get('pvipdays'), '30');
  assert.match(birthdayPopularityUrl.searchParams.get('titles'), /밀리 바비 브라운/);
  assert.deepEqual(
    state.sameBirthdayApi.candidates.map(person => [person.name, person.birthYear]),
    [['밀리 바비 브라운', 2004]],
    'the birth section parser must keep only people born on the exact year, month, and day'
  );
  assert.deepEqual(state.sameBirthdayApi.wrongYearCandidates, [], 'a different birth year must not appear as the same birthday');
  assert.deepEqual(
    state.sameBirthdayApi.rankedPeople.map(person => [person.name, person.views]),
    [['밀리 바비 브라운', 900]],
    'same-birthday people must be ranked by recent Korean Wikipedia views'
  );
  assert.equal(state.sameBirthdayApi.requestKey, '1989-03-19', 'same-birthday requests must include the full birth date');
  assert.equal(state.sameBirthdayApi.calendarText, '양력 1989.03.19 출생 기준');
  assert.deepEqual(
    state.sameBirthdayApi.lunarComparison,
    {
      date: { year: 1986, month: 3, day: 28 },
      inputCalendar: 'lunar',
      inputDate: { year: 1986, month: 2, day: 19 },
      label: '음력 1986.02.19 입력 → 양력 1986.03.28 출생 기준'
    },
    'lunar input must be preserved and compared using its converted solar birth date'
  );
  assert.equal(state.sameBirthdayApi.limitedPeople.length, 8, 'same-birthday popularity list must show at most eight people');
  assert.equal(state.sameBirthdayApi.limitedPeople[0].name, '인물 9', 'the highest-viewed person must rank first');
  assert.ok(state.solarTermReference.gyeongchip1926MinuteDelta <= 30, '1926 gyeongchip must stay within 30 minutes of the verified 17:00 KST reference');
  assert.ok(state.solarTermReference.ipchun2024MinuteDelta <= 30, '2024 ipchun must stay within 30 minutes of the verified 17:27 KST reference');
  assert.deepEqual(
    {
      beforeBranch: state.solarTermReference.gyeongchipBeforeBranch,
      afterBranch: state.solarTermReference.gyeongchipAfterBranch,
      beforeYear: state.solarTermReference.ipchunBeforeYear,
      afterYear: state.solarTermReference.ipchunAfterYear
    },
    { beforeBranch: 2, afterBranch: 3, beforeYear: 2023, afterYear: 2024 },
    'year and month pillars must change at the exact solar-term instant'
  );
  assert.ok(state.report.dayMatches.length >= 5, 'the prior same-year-pillar period should contain recurring same day pillars');
  assert.ok(state.report.yearPeriod.start && state.report.yearPeriod.end, 'same year-pillar period missing');
  assert.ok(state.report.monthPeriod.start && state.report.monthPeriod.end, 'same month-pillar period missing');
  for (const match of state.report.exactMatches) {
    assert.ok(match.year >= 1026 && match.year < 1989, `unexpected history year: ${match.year}`);
  }
  for (const pillar of state.exactSnapshots) {
    assert.deepEqual(
      pillar,
      {
        yStem: state.report.target.yStem,
        yBranch: state.report.target.yBranch,
        mStem: state.report.target.mStem,
        mBranch: state.report.target.mBranch,
        stem: state.report.target.dStem,
        branch: state.report.target.dBranch
      },
      'reported exact date must independently reproduce all three natal pillars'
    );
  }
  assert.match(state.text, /1,000년 같은 기둥/);
  assert.match(state.nov1994Html, /180년 전/);
  assert.match(state.text, /년·월·일주가 모두 같은 날/);
  assert.match(state.text, /같은 생년월일 유명인/);
  assert.match(state.text, /입춘·절입 기준/);
  assert.equal(state.regionRole, 'samePillars60Title');
  assert.ok(state.overflow <= 1, `${width}px 60-year card overflows viewport`);
  assert.ok(state.documentOverflow <= 1, `${width}px document overflows after 60-year card`);
  assert.ok(state.exactWidth > 0, 'exact same-pillar dates must remain visible');
  assert.equal(state.hasTargetGrid, false, 'the redundant target-pillar rectangle must be removed');
  assert.equal(state.hasNearestBreakdown, false, 'the year/month/day breakdown rectangles must be removed');
}

async function inspectCalendarShellWidth(page, width) {
  const inputShell = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { left: rect.left, width: rect.width };
    };
    return { header: box('.top-bar'), tabs: box('.tabs') };
  });
  await page.click('.tab[data-tab="calendar"]');
  await sleep(100);
  const geometry = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        centerY: rect.top + rect.height / 2
      };
    };
    return {
      viewport: document.documentElement.clientWidth,
      header: box('.top-bar'),
      tabs: box('.tabs'),
      calendar: box('.cal-grid'),
      calendarHead: box('.cal-head'),
      previous: box('#calPrev'),
      title: box('#calTitle'),
      next: box('#calNext')
    };
  });
  for (const name of ['header', 'tabs']) {
    assert.ok(
      Math.abs(geometry[name].width - inputShell[name].width) <= 1,
      `${width}px calendar ${name} width must stay at input width`
    );
    assert.ok(
      Math.abs(geometry[name].left - inputShell[name].left) <= 1,
      `${width}px calendar ${name} left edge must stay at input position`
    );
  }
  assert.ok(Math.abs(geometry.previous.centerY - geometry.title.centerY) <= .5, `${width}px previous button and calendar title must share a vertical center`);
  assert.ok(Math.abs(geometry.next.centerY - geometry.title.centerY) <= .5, `${width}px next button and calendar title must share a vertical center`);
  assert.ok(geometry.previous.height >= 43.5, `${width}px previous calendar target below 44px`);
  assert.ok(geometry.next.height >= 43.5, `${width}px next calendar target below 44px`);
  assert.ok(geometry.calendar.left >= 0 && geometry.calendar.right <= geometry.viewport + 1, `${width}px calendar shell overflows viewport`);
}

async function inspectAllTabShellWidths(page, width) {
  await page.click('.tab[data-tab="input"]');
  await sleep(60);
  const inputShell = await page.evaluate(() => {
    const rect = element => {
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    };
    return {
      header: rect(document.querySelector('.top-bar')),
      tabs: rect(document.querySelector('.tabs')),
      scrollbarGutter: getComputedStyle(document.documentElement).scrollbarGutter
    };
  });
  assert.ok(Math.abs(inputShell.header.width - inputShell.tabs.width) <= 1, `${width}px input shell bars must match`);
  assert.match(inputShell.scrollbarGutter, /\bstable\b/, `${width}px root must reserve a stable scrollbar gutter`);

  for (const tab of ['result', 'fortune', 'calendar', 'saved']) {
    await page.click(`.tab[data-tab="${tab}"]`);
    await sleep(60);
    const geometry = await page.evaluate(() => {
      const rect = element => {
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right, width: box.width };
      };
      return {
        header: rect(document.querySelector('.top-bar')),
        tabs: rect(document.querySelector('.tabs'))
      };
    });
    for (const name of ['header', 'tabs']) {
      assert.ok(Math.abs(geometry[name].width - inputShell[name].width) <= 1, `${width}px ${tab} ${name} width must stay at input width`);
      assert.ok(Math.abs(geometry[name].left - inputShell[name].left) <= 1, `${width}px ${tab} ${name} left edge must stay at input position`);
    }
  }
}

async function inspectFrontendQuality(page, width) {
  const state = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('.tab')].map(tab => ({
      role: tab.getAttribute('role'),
      selected: tab.getAttribute('aria-selected'),
      controls: tab.getAttribute('aria-controls'),
      id: tab.id
    }));
    const panels = [...document.querySelectorAll('.view')].map(panel => ({
      role: panel.getAttribute('role'),
      labelledBy: panel.getAttribute('aria-labelledby'),
      hidden: panel.hasAttribute('hidden')
    }));
    const labels = [...document.querySelectorAll('label.field-label[for]')].map(label => label.htmlFor);
    const segmentButtons = [...document.querySelectorAll('#segGender button, #segCal button')].map(button => ({
      role: button.getAttribute('role'),
      checked: button.getAttribute('aria-checked')
    }));
    return {
      headingCount: document.querySelectorAll('h1').length,
      tablist: document.querySelector('.tabs').getAttribute('role'),
      tabs,
      panels,
      labels,
      aboutLabel: document.getElementById('aboutBtn').getAttribute('aria-label'),
      prevLabel: document.getElementById('calPrev').getAttribute('aria-label'),
      nextLabel: document.getElementById('calNext').getAttribute('aria-label'),
      genderGroup: document.getElementById('segGender').getAttribute('role'),
      calendarGroup: document.getElementById('segCal').getAttribute('role'),
      segmentButtons
    };
  });

  assert.equal(state.headingCount, 1, `${width}px page must expose one h1`);
  assert.equal(state.tablist, 'tablist', `${width}px primary nav role`);
  assert.ok(state.tabs.every(tab => tab.role === 'tab' && tab.controls && tab.id), `${width}px tabs need complete semantics`);
  assert.equal(state.tabs.filter(tab => tab.selected === 'true').length, 1, `${width}px one selected tab`);
  assert.ok(state.panels.every(panel => panel.role === 'tabpanel' && panel.labelledBy), `${width}px panels need tab semantics`);
  assert.ok(['inputName', 'inBirth', 'inTime'].every(id => state.labels.includes(id)), `${width}px primary fields need associated labels`);
  assert.equal(state.aboutLabel, '앱 정보', `${width}px about button accessible name`);
  assert.equal(state.prevLabel, '이전 달', `${width}px previous month accessible name`);
  assert.equal(state.nextLabel, '다음 달', `${width}px next month accessible name`);
  assert.equal(state.genderGroup, 'radiogroup', `${width}px gender group semantics`);
  assert.equal(state.calendarGroup, 'radiogroup', `${width}px calendar type group semantics`);
  assert.ok(state.segmentButtons.every(button => button.role === 'radio' && ['true', 'false'].includes(button.checked)), `${width}px segmented choices need radio state`);

  await page.evaluate(() => document.querySelector('.tab[data-tab="fortune"]').click());
  const switched = await page.evaluate(() => ({
    selected: document.querySelector('.tab[data-tab="fortune"]').getAttribute('aria-selected'),
    previous: document.querySelector('.tab[data-tab="input"]').getAttribute('aria-selected'),
    panelHidden: document.getElementById('view-fortune').hasAttribute('hidden')
  }));
  assert.deepEqual(switched, { selected: 'true', previous: 'false', panelHidden: false }, `${width}px tab state must update`);

  await page.evaluate(() => document.querySelector('.tab[data-tab="input"]').click());
  await page.evaluate(() => document.querySelector('#segGender button[data-val="F"]').click());
  const selectedGender = await page.evaluate(() => [...document.querySelectorAll('#segGender button')].map(button => button.getAttribute('aria-checked')));
  assert.deepEqual(selectedGender, ['false', 'true'], `${width}px segmented radio state must update`);
}

async function inspectShellWidth(page, width) {
  await page.click('.tab[data-tab="input"]');
  await sleep(50);
  const geometry = await page.evaluate(() => {
    const box = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };
    return {
      viewport: document.documentElement.clientWidth,
      header: box('.top-bar'),
      tabs: box('.tabs'),
      inputView: box('#view-input'),
      search: box('.person-search-btn'),
      card: box('.input-card'),
      action: box('.primary-btn'),
      note: box('#view-input .note-text')
    };
  });

  const reference = geometry.tabs;
  for (const [name, rect] of Object.entries(geometry)) {
    if (name === 'viewport' || name === 'tabs') continue;
    assert.ok(
      Math.abs(rect.width - reference.width) <= 1,
      `${width}px ${name} width ${rect.width}px must match tabs ${reference.width}px`
    );
    assert.ok(
      Math.abs(rect.left - reference.left) <= 1,
      `${width}px ${name} left ${rect.left}px must match tabs ${reference.left}px`
    );
  }
  assert.ok(reference.left >= 0 && reference.right <= geometry.viewport + 1, `${width}px shared shell overflows viewport`);
}

async function inspectFoldLayout(page, width) {
  await page.click('.tab[data-tab="input"]');
  await sleep(50);
  const geometry = await page.evaluate(() => {
    const rect = selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    };
    return {
      viewport: document.documentElement.clientWidth,
      header: rect('.top-bar'),
      tabs: rect('.tabs'),
      view: rect('#view-input'),
      card: rect('.input-card'),
      action: rect('.primary-btn')
    };
  });
  const expected = geometry.header.width;
  for (const name of ['tabs', 'view']) {
    const rect = geometry[name];
    assert.ok(Math.abs(rect.width - expected) <= 1, `${width}px unfolded ${name} must use the wider fold measure`);
    assert.ok(Math.abs(rect.left - geometry.header.left) <= 1, `${width}px unfolded ${name} must align with the shared header`);
  }
  assert.ok(expected > 650, `${width}px unfolded shell must consume the added fold width`);
  assert.ok(Math.abs(geometry.card.width - geometry.action.width) <= 1, `${width}px input card and action widths differ`);
  for (const name of ['card', 'action']) {
    assert.ok(geometry[name].left >= geometry.view.left, `${width}px ${name} escapes the shared view`);
    assert.ok(geometry[name].right <= geometry.view.right + 1, `${width}px ${name} escapes the shared view`);
  }
}

async function inspectResultWidthAndBrand(page, width) {
  await page.click('.tab[data-tab="input"]');
  await sleep(60);
  const inputTabs = await page.$eval('.tabs', element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, width: rect.width };
  });
  await page.click('.tab[data-tab="result"]');
  await sleep(60);
  const state = await page.evaluate(() => {
    const bottomBar = document.getElementById('bottomBar').getBoundingClientRect();
    const card = document.querySelector('.oguk-card').getBoundingClientRect();
    const tabs = document.querySelector('.tabs').getBoundingClientRect();
    const bottomBarStyle = getComputedStyle(document.getElementById('bottomBar'));
    const resultRects = [...document.querySelectorAll(
      '#view-result > .oguk-card, #view-result > .result-right, #view-result > .same-pillars-card'
    )].map(element => element.getBoundingClientRect());
    const brand = getComputedStyle(document.querySelector('.top-bar .brand-main'));
    const suffix = getComputedStyle(document.querySelector('.top-bar .title-sub'));
    const typography = style => ({
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing
    });
    const pillars = [...document.querySelectorAll('.pillar-block')].map(block => {
      const rect = block.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(block.querySelector('.han'));
      const glyph = range.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(block.querySelector('.han')).transform);
      return {
        width: rect.width,
        height: rect.height,
        fontSize: parseFloat(getComputedStyle(block.querySelector('.han')).fontSize),
        transformY: matrix.m42,
        glyphCenterY: Math.abs((glyph.top + glyph.bottom) / 2 - (rect.top + rect.bottom) / 2)
      };
    });
    return {
      bottomBar: {
        left: bottomBar.left,
        top: bottomBar.top,
        right: bottomBar.right,
        bottom: bottomBar.bottom,
        width: bottomBar.width,
        height: bottomBar.height,
        position: bottomBarStyle.position,
        flexDirection: bottomBarStyle.flexDirection
      },
      card: { left: card.left, right: card.right, width: card.width },
      resultContent: {
        left: Math.min(...resultRects.map(rect => rect.left)),
        right: Math.max(...resultRects.map(rect => rect.right))
      },
      tabs: { left: tabs.left, right: tabs.right, width: tabs.width },
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      buttonRects: [...document.querySelectorAll('#bottomBar .bb')].map(button => {
        const rect = button.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      }),
      brand: typography(brand),
      suffix: typography(suffix),
      pillars
    };
  });

  if (width >= 1025) {
    assert.ok(
      state.bottomBar.left >= state.resultContent.right + 16,
      `${width}px desktop action rail must sit at least 16px to the right of app content: ${JSON.stringify(state)}`
    );
    assert.ok(state.bottomBar.width <= 128, `${width}px desktop action rail must stay compact`);
    assert.ok(state.bottomBar.height > state.bottomBar.width, `${width}px desktop action rail must stack vertically`);
    assert.equal(state.bottomBar.flexDirection, 'column', `${width}px desktop action rail direction`);
  } else {
    assert.ok(
      Math.abs(state.bottomBar.width - state.card.width) <= 1,
      `${width}px bottom bar width ${state.bottomBar.width}px must match natal card ${state.card.width}px`
    );
    assert.ok(
      Math.abs(state.bottomBar.left - state.card.left) <= 1,
      `${width}px bottom bar and natal card must share the same left edge`
    );
    assert.ok(
      state.bottomBar.left >= 0 && state.bottomBar.right <= state.viewportWidth + 1,
      `${width}px bottom bar overflows viewport`
    );
    assert.ok(
      state.bottomBar.top >= 0 && state.bottomBar.bottom <= state.viewportHeight + 1,
      `${width}px bottom bar exceeds viewport bounds`
    );
  }
  if (width >= 1025) {
    assert.ok(
      state.bottomBar.left >= 16 && state.bottomBar.right <= state.viewportWidth - 16,
      `${width}px desktop action rail exceeds horizontal safe bounds`
    );
    assert.ok(
      state.bottomBar.top >= 16 && state.bottomBar.bottom <= state.viewportHeight - 16,
      `${width}px desktop action rail exceeds vertical safe bounds`
    );
  }
  assert.equal(state.bottomBar.position, 'fixed', `${width}px bottom actions must remain fixed`);
  assert.ok(
    state.buttonRects.every(rect => rect.width >= 44 && rect.height >= 44),
    `${width}px bottom action target below 44px: ${JSON.stringify(state.buttonRects)}`
  );
  assert.ok(
    Math.abs(state.tabs.width - inputTabs.width) <= 1,
    `${width}px result tabs width must stay at input width`
  );
  assert.ok(
    Math.abs(state.tabs.left - inputTabs.left) <= 1,
    `${width}px result tabs left edge must stay at input position`
  );
  assert.deepEqual(state.brand, state.suffix, `${width}px 잔상 and 만세력 typography must match`);
  assert.equal(state.pillars.length, 8, `${width}px natal Hanja block count`);
  for (const pillar of state.pillars) {
    assert.ok(pillar.width >= 83 && pillar.width <= 85, `${width}px natal block must be about 84px, got ${pillar.width}px`);
    assert.ok(Math.abs(pillar.width - pillar.height) <= 1, `${width}px natal block must stay square`);
    assert.ok(pillar.fontSize >= 51 && pillar.fontSize <= 55, `${width}px natal Hanja must be about 52px, got ${pillar.fontSize}px`);
    assert.ok(pillar.transformY <= -2.8 && pillar.transformY >= -3.2, `${width}px natal Hanja optical offset must be about -3px, got ${pillar.transformY}px`);
    assert.ok(pillar.glyphCenterY <= 4, `${width}px natal glyph line-box center delta ${pillar.glyphCenterY}px`);
  }
}

function parseCssColor(value) {
  const match = String(value).match(/rgba?\(([^)]+)\)/i);
  if (match) {
    const parts = match[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }
  const srgb = String(value).match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/i);
  assert.ok(srgb, `unsupported computed color: ${value}`);
  return {
    r: Number(srgb[1]) * 255,
    g: Number(srgb[2]) * 255,
    b: Number(srgb[3]) * 255,
    a: srgb[4] === undefined ? 1 : Number(srgb[4])
  };
}

async function inspectDesktopActionRail(page, width) {
  if (!runsDesktopActionRail()) return;

  const geometry = await page.evaluate(() => {
    const rect = selector => {
      const bounds = document.querySelector(selector).getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height
      };
    };
    const bar = document.getElementById('bottomBar');
    const resultRects = [...document.querySelectorAll(
      '#view-result > .oguk-card, #view-result > .result-right, #view-result > .same-pillars-card'
    )].map(element => element.getBoundingClientRect());
    return {
      viewport: {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight
      },
      resultContent: {
        left: Math.min(...resultRects.map(bounds => bounds.left)),
        right: Math.max(...resultRects.map(bounds => bounds.right))
      },
      card: rect('.oguk-card'),
      bar: rect('#bottomBar'),
      style: {
        position: getComputedStyle(bar).position,
        flexDirection: getComputedStyle(bar).flexDirection
      },
      buttons: [...bar.querySelectorAll('.bb')].map(button => {
        const bounds = button.getBoundingClientRect();
        const textRange = document.createRange();
        textRange.selectNodeContents(button);
        const lineTops = [...textRange.getClientRects()]
          .filter(rect => rect.width > 0 && rect.height > 0)
          .map(rect => Math.round(rect.top * 10) / 10);
        return {
          text: button.textContent.trim(),
          width: bounds.width,
          height: bounds.height,
          clientWidth: button.clientWidth,
          clientHeight: button.clientHeight,
          scrollWidth: button.scrollWidth,
          scrollHeight: button.scrollHeight,
          lineCount: new Set(lineTops).size
        };
      })
    };
  });

  assert.equal(geometry.style.position, 'fixed');
  assert.equal(geometry.style.flexDirection, 'row');
  assert.ok(
    geometry.bar.height <= 88,
    `${width}px bottom action bar blocks too much of the viewport: ${JSON.stringify(geometry.bar)}`
  );
  assert.ok(
    geometry.bar.width <= Math.min(520, geometry.viewport.width - 16) + 1,
    `${width}px bottom action bar is too wide: ${JSON.stringify(geometry.bar)}`
  );
  if (width === 390) {
    assert.ok(Math.abs(geometry.bar.width - geometry.card.width) <= 1);
    assert.ok(Math.abs(geometry.bar.left - geometry.card.left) <= 1);
  }
  assert.ok(
    Math.abs(
      (geometry.bar.left + geometry.bar.right) / 2 -
      (geometry.resultContent.left + geometry.resultContent.right) / 2
    ) <= 1,
    `${width}px bottom action bar is not centered on the result: ${JSON.stringify(geometry)}`
  );
  assert.ok(geometry.bar.left >= 0 && geometry.bar.right <= geometry.viewport.width + 1);
  assert.ok(
    geometry.buttons.every(button => button.lineCount === 1),
    `${width}px bottom action labels must stay on one line: ${JSON.stringify(geometry.buttons)}`
  );
  assert.ok(
    geometry.buttons.every(button => button.width >= 44 && button.height >= 44),
    `${width}px action rail target below 44px: ${JSON.stringify(geometry.buttons)}`
  );
  assert.ok(
    geometry.buttons.every(button =>
      button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1
    ),
    `${width}px bottom action label clips or overflows: ${JSON.stringify(geometry.buttons)}`
  );
}

function assertCssColorClose(actual, expected, message) {
  const actualColor = parseCssColor(actual);
  const expectedColor = parseCssColor(expected);
  for (const channel of ['r', 'g', 'b']) {
    assert.ok(
      Math.abs(actualColor[channel] - expectedColor[channel]) <= .75,
      `${message} ${channel} channel: ${actual} vs ${expected}`
    );
  }
  assert.ok(
    Math.abs(actualColor.a - expectedColor.a) <= .005,
    `${message} alpha channel: ${actual} vs ${expected}`
  );
}

function compositeColor(foreground, background) {
  const alpha = foreground.a + background.a * (1 - foreground.a);
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
    g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
    b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
    a: alpha
  };
}

function contrastRatio(foregroundValue, backgroundValue, canvasValue) {
  const canvas = parseCssColor(canvasValue);
  const background = compositeColor(parseCssColor(backgroundValue), canvas);
  const foreground = compositeColor(parseCssColor(foregroundValue), background);
  const luminance = color => {
    const channels = [color.r, color.g, color.b].map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function createServiceWorkerHarness(source) {
  const handlers = new Map();
  const events = [];
  const deletedCaches = [];
  const caches = {
    keys() {
      return Promise.resolve([
        'jansang-manse-v38-20260812-long-reading',
        'jansang-manse-previous',
        'another-site-cache'
      ]);
    },
    delete(name) {
      deletedCaches.push(name);
      events.push({ type: 'delete', name });
      return Promise.resolve(true);
    }
  };
  const self = {
    location: { origin: 'https://example.test' },
    registration: {
      unregister() {
        events.push({ type: 'unregister' });
        return Promise.resolve(true);
      }
    },
    clients: {
      claim() {
        events.push({ type: 'claim' });
        return Promise.resolve();
      }
    },
    addEventListener(type, handler) { handlers.set(type, handler); },
    skipWaiting() {
      events.push({ type: 'skipWaiting' });
      return Promise.resolve();
    }
  };
  vm.runInNewContext(source, {
    self,
    caches,
    URL,
    fetch: () => Promise.reject(new Error('fetch is outside this lifecycle test')),
    Promise
  }, { filename: 'sw.js' });
  return {
    events,
    deletedCaches,
    hasHandler(type) { return handlers.has(type); },
    dispatch(type) {
      const handler = handlers.get(type);
      assert.equal(typeof handler, 'function', `service worker ${type} handler missing`);
      let lifetime = null;
      handler({
        waitUntil(promise) { lifetime = Promise.resolve(promise); },
        request: { method: 'GET' },
        respondWith() {}
      });
      assert.ok(lifetime, `${type} handler must call waitUntil`);
      return lifetime;
    }
  };
}

async function inspectServiceWorkerDisable(source) {
  const harness = createServiceWorkerHarness(source);
  await harness.dispatch('install');
  assert.deepEqual(
    harness.events.map(event => event.type),
    ['skipWaiting'],
    'the cache-removal worker must activate immediately without precaching'
  );
  await harness.dispatch('activate');
  assert.deepEqual(
    harness.deletedCaches,
    ['jansang-manse-v38-20260812-long-reading', 'jansang-manse-previous'],
    'only this app cache namespace may be deleted'
  );
  assert.deepEqual(
    harness.events.slice(-2).map(event => event.type),
    ['claim', 'unregister'],
    'the tombstone worker must take control before unregistering itself'
  );
  assert.equal(harness.hasHandler('fetch'), false, 'the tombstone worker must never intercept network requests');
}

function inspectAndroidBackupPolicy() {
  const manifestPath = path.join(APP_ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  const manifest = fs.readFileSync(manifestPath, 'utf8');
  assert.match(manifest, /android:allowBackup="false"/, 'saved chart data must be excluded from Android backup');
  assert.doesNotMatch(manifest, /android:allowBackup="true"/);
}

function inspectAndroidCachePolicy() {
  const activityPath = path.join(
    APP_ROOT,
    'android', 'app', 'src', 'main', 'java', 'com', 'jansang', 'manse', 'MainActivity.java'
  );
  const activity = fs.readFileSync(activityPath, 'utf8');

  assert.match(activity, /@Override\s+protected void load\(\)/, 'Android cache policy must run before Capacitor loads its first page');
  assert.match(activity, /findViewById\(com\.getcapacitor\.android\.R\.id\.webview\)/, 'cache cleanup must target the Capacitor WebView');
  assert.match(activity, /webView\.clearCache\(true\)/, 'Android must clear memory and disk WebView cache at startup');
  assert.match(
    activity,
    /webView\.getSettings\(\)\.setCacheMode\(WebSettings\.LOAD_NO_CACHE\)/,
    'Android WebView must bypass its resource cache'
  );
  assert.match(
    activity,
    /setCacheMode\(WebSettings\.LOAD_NO_CACHE\)[\s\S]*?clearCache\(true\)[\s\S]*?super\.load\(\)/,
    'cache bypass and cleanup must finish before Capacitor performs its first load'
  );
  assert.doesNotMatch(activity, /getBridge\(\)\.reload\(\)|stopLoading\(\)/, 'cache cleanup must not cause a second navigation');
  assert.doesNotMatch(
    activity,
    /WebStorage|deleteAllData\(|localStorage\.clear\(|clearHistory\(|clearFormData\(/,
    'cache cleanup must preserve saved charts, theme, history, and form state'
  );
}

function inspectAndroidSafeAreaContract() {
  const appleCss = fs.readFileSync(path.join(UI_ROOT, 'apple.css'), 'utf8');
  const capacitorConfig = JSON.parse(fs.readFileSync(path.join(APP_ROOT, 'capacitor.config.json'), 'utf8'));

  assert.match(
    appleCss,
    /--app-safe-top\s*:\s*var\(--safe-area-inset-top,\s*env\(safe-area-inset-top,\s*0px\)\)/,
    'the header must consume Capacitor Android safe-area CSS variables'
  );
  assert.match(
    appleCss,
    /\.top-bar\s*\{[\s\S]*?padding-top:\s*calc\(8px\s*\+\s*var\(--app-safe-top\)\)/,
    'the title bar must reserve space for the Android status bar'
  );
  assert.match(
    appleCss,
    /\.tabs\s*\{[\s\S]*?top:\s*calc\(76px\s*\+\s*var\(--app-safe-top\)\)/,
    'the tab rail must begin below the status-bar-safe title bar'
  );
  assert.equal(capacitorConfig.plugins?.SystemBars?.style, 'DARK', 'dark app must request light status-bar icons');
  assert.equal(capacitorConfig.plugins?.SystemBars?.insetsHandling, 'css', 'Capacitor must expose Android safe-area insets to CSS');
}

function inspectResultHeaderCompactContract() {
  const indexHtml = fs.readFileSync(path.join(UI_ROOT, 'index.html'), 'utf8');
  const appleCss = fs.readFileSync(path.join(UI_ROOT, 'apple.css'), 'utf8');
  assert.doesNotMatch(indexHtml, /<div class="card-title">&#10022; 사주 원국<\/div>/, 'result card must not repeat the "사주 원국" heading');
  assert.match(appleCss, /\.oguk-card \.result-head\s*\{[\s\S]*?padding:\s*0 0 8px !important/, 'result identity header must use compact vertical spacing');
  assert.match(appleCss, /#seunScroll \.luck-item\s*\{[\s\S]*?grid-template-rows:\s*34px 22px auto auto 22px/, 'yearly-flow labels must reserve separate rows for year, age, and ten-god text');
}

function inspectFinalSecuritySourceContracts() {
  const indexHtml = fs.readFileSync(path.join(UI_ROOT, 'index.html'), 'utf8');
  const appleCss = fs.readFileSync(path.join(UI_ROOT, 'apple.css'), 'utf8');
  const stringsXml = fs.readFileSync(
    path.join(APP_ROOT, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
    'utf8'
  );
  const renderSavedSource = indexHtml.match(
    /async function renderSaved\(\)\s*\{[\s\S]*?\r?\n\}\r?\n\r?\nasync function updateSavedRecord/
  );

  assert.ok(renderSavedSource, 'renderSaved source contract missing');
  assert.doesNotMatch(
    renderSavedSource[0],
    /\.innerHTML\s*=|insertAdjacentHTML\(/,
    'saved records must be rendered with DOM APIs rather than HTML parsing sinks'
  );
  assert.doesNotMatch(
    indexHtml,
    /function genCompatText\(/,
    'the legacy name-interpolating compatibility HTML generator must not return'
  );
  assert.doesNotMatch(
    indexHtml,
    /data-id="\$\{(?:rec|r)\.id(?:\s*\|\|\s*['"]{2})?\}"/,
    'saved-record IDs must not be interpolated raw into downstream HTML attributes'
  );
  assert.match(indexHtml, /crypto\.randomUUID\(\)/, 'imported records must receive cryptographic UUIDs');
  assert.match(indexHtml, /function normalizeImportedRecord\(/, 'strict imported-record normalization is required');
  assert.doesNotMatch(indexHtml, /function jsonpFetch\(|psJsonpCounter|callback=['"]?\s*\+\s*cb/);
  assert.doesNotMatch(
    indexHtml,
    /createElement\(\s*['"]script['"]\s*\)[\s\S]{0,1200}(?:script\.src|appendChild\(script\))/,
    'person enrichment must not create executable third-party script elements'
  );
  assert.match(indexHtml, /const ALLOWED_ENRICHMENT_HOSTS\s*=\s*new Set/);
  assert.match(indexHtml, /function fetchAllowedJson\(/);
  assert.match(indexHtml, /잔상만세력_백업_/);
  assert.doesNotMatch(indexHtml, /신의음성만세력_백업_/);
  assert.match(stringsXml, /<string name="app_name">잔상 만세력<\/string>/);
  assert.match(stringsXml, /<string name="title_activity_main">잔상 만세력<\/string>/);
  assert.match(
    appleCss,
    /\.result-right \.luck-title::before[\s\S]*\.sub-luck-label::before[\s\S]*content:\s*none\s*!important/,
    'flow-title sparkle pseudo-elements must be disabled by the final Apple layer'
  );
}

async function inspectFinalSecurityRuntime(page, width) {
  const state = await page.evaluate(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const listSavedKeys = async () => {
      const result = await window.storage.list('saju:');
      return result && Array.isArray(result.keys) ? result.keys : [];
    };

    for (const key of await listSavedKeys()) await window.storage.delete(key);
    localStorage.removeItem('saju_list');

    const sample = {
      ...currentSaju,
      id: `unsafe"><img src=x onerror="window.__backupXssExecuted=1">`,
      name: `<img src=x onerror="window.__backupXssExecuted=2">`,
      memo: `<svg onload="window.__backupXssExecuted=3"></svg>`,
      fav: true,
      unexpected: 'must be removed'
    };
    const invalid = { ...sample, id: 'also-unsafe', gender: 'X' };
    window.__backupXssExecuted = 0;
    window.__lastImportAlert = '';
    window.alert = message => { window.__lastImportAlert = String(message); };

    document.querySelector('.tab[data-tab="saved"]').click();
    await renderSaved();
    const input = document.getElementById('savedImportFile');
    const file = new File(
      [JSON.stringify({ app: '잔상 만세력', version: 1, records: [sample, invalid] })],
      'malicious-backup.json',
      { type: 'application/json' }
    );
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const deadline = Date.now() + 2500;
    let keys = [];
    while (Date.now() < deadline) {
      keys = await listSavedKeys();
      if (keys.length) break;
      await wait(25);
    }
    await wait(100);
    await renderSaved();
    await wait(50);

    keys = await listSavedKeys();
    const stored = keys[0] ? JSON.parse((await window.storage.get(keys[0])).value) : null;
    const cards = [...document.querySelectorAll('#savedContent .saved-card')];
    const importState = {
      xssExecuted: window.__backupXssExecuted,
      keys,
      stored,
      cardIds: cards.map(card => card.dataset.id),
      cardText: cards.map(card => card.textContent),
      executableNodes: document.querySelectorAll('#savedContent [onerror], #savedContent [onload], #savedContent script').length,
      alertText: window.__lastImportAlert
    };

    let blockedFetchCalls = 0;
    const originalFetch = window.fetch;
    window.fetch = async () => {
      blockedFetchCalls++;
      throw new Error('network should not be reached');
    };
    let disallowedHostRejected = false;
    let fetchApiType = typeof window.fetchAllowedJson;
    try {
      await window.fetchAllowedJson('https://evil.example.invalid/data.json', 50);
    } catch (error) {
      disallowedHostRejected = /허용되지 않은|allowlisted|allowed/i.test(String(error && error.message));
    }

    let scriptCreates = 0;
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = function (tagName, ...args) {
      if (String(tagName).toLowerCase() === 'script') scriptCreates++;
      return originalCreateElement(tagName, ...args);
    };
    try {
      await wikiQuery('generator=search&gsrsearch=test&gsrlimit=1');
    } catch (error) {
      // CORS/network failure must gracefully disable online enrichment.
    } finally {
      document.createElement = originalCreateElement;
      window.fetch = originalFetch;
    }

    for (const key of keys) await window.storage.delete(key);
    localStorage.removeItem('saju_list');
    document.body.classList.remove('dark');
    await wait(300);
    document.querySelector('.tab[data-tab="saved"]').click();
    await renderSaved();
    const savedEmpty = document.querySelector('.saved-empty');
    const savedHeading = savedEmpty.querySelector('h3');
    const savedContrast = {
      foreground: getComputedStyle(savedHeading).color,
      background: getComputedStyle(savedEmpty).backgroundColor,
      canvas: getComputedStyle(document.body).backgroundColor
    };

    document.querySelector('.tab[data-tab="fortune"]').click();
    renderFortune();
    await wait(40);
    const fortuneColors = [
      ...document.querySelectorAll('.f-score-num, .overall-card .ov-label, .overall-card .ov-grade')
    ].map(element => getComputedStyle(element).color);
    const iconBorders = [...document.querySelectorAll('.icon-btn')]
      .filter(element => element.getClientRects().length)
      .map(element => getComputedStyle(element).borderTopColor);

    document.querySelector('.tab[data-tab="result"]').click();
    renderResult();
    await wait(40);
    document.querySelector('#daeunScroll .luck-item')?.click();
    await wait(20);
    document.querySelector('#seunScroll .luck-item')?.click();
    await wait(20);
    const flowDecorations = [
      ...document.querySelectorAll('.result-right .luck-title, .sub-luck-label')
    ].map(element => getComputedStyle(element, '::before').content);

    return {
      importState,
      fetchSecurity: {
        fetchApiType,
        blockedFetchCalls,
        disallowedHostRejected,
        scriptCreates
      },
      savedContrast,
      fortuneColors,
      iconBorders,
      flowDecorations
    };
  });

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.equal(state.importState.xssExecuted, 0, `${width}px malicious backup executed script`);
  assert.equal(state.importState.executableNodes, 0, `${width}px imported markup became executable DOM`);
  assert.equal(state.importState.keys.length, 1, `${width}px invalid imported schemas must be rejected`);
  assert.ok(uuid.test(state.importState.stored.id), `${width}px imported id is not a UUID: ${state.importState.stored.id}`);
  assert.equal(state.importState.keys[0], `saju:${state.importState.stored.id}`);
  assert.deepEqual(state.importState.cardIds, [state.importState.stored.id]);
  assert.match(state.importState.cardText[0], /<img src=x onerror=/, 'malicious display text must remain inert text');
  assert.equal(Object.hasOwn(state.importState.stored, 'unexpected'), false, 'unknown import fields must be dropped');
  assert.ok(state.importState.stored.name.length <= 40, 'imported name length limit');
  assert.ok(state.importState.stored.memo.length <= 240, 'imported memo length limit');
  assert.match(state.importState.alertText, /1개 가져왔습니다/);

  assert.equal(state.fetchSecurity.fetchApiType, 'function', 'allowlisted CORS fetch API missing');
  assert.equal(state.fetchSecurity.disallowedHostRejected, true, 'non-allowlisted enrichment host was not rejected');
  assert.equal(state.fetchSecurity.blockedFetchCalls, 1, 'only the allowlisted Wikipedia request may reach fetch');
  assert.equal(state.fetchSecurity.scriptCreates, 0, 'online enrichment created a dynamic script element');

  assert.ok(
    contrastRatio(
      state.savedContrast.foreground,
      state.savedContrast.background,
      state.savedContrast.canvas
    ) >= 4.5,
    `${width}px light saved-empty heading contrast is below 4.5:1`
  );
  const legacyGold = /rgb(?:a)?\(\s*(?:216\s*,\s*181\s*,\s*106|240\s*,\s*214\s*,\s*154|169\s*,\s*119\s*,\s*50)(?:\s*,[^)]*)?\)/i;
  for (const color of [...state.fortuneColors, ...state.iconBorders]) {
    assert.ok(!legacyGold.test(color), `${width}px visible legacy gold remains: ${color}`);
  }
  for (const content of state.flowDecorations) {
    assert.ok(content === 'none' || content === 'normal' || content === '""', `${width}px flow title sparkle remains: ${content}`);
  }
}

async function inspectCalendarCurrentYear(page, width) {
  if (!runsCalendarCurrentYear() || width !== 390) return;
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const state = await page.evaluate(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const readTitle = () => {
      const title = document.getElementById('calTitle');
      const match = title.textContent.match(/(\d+)년\s+(\d+)월/);
      return {
        year: Number(match && match[1]),
        month: Number(match && match[2]),
        ariaCurrent: title.getAttribute('aria-current'),
        selectedClass: title.classList.contains('is-current-year'),
        badge: title.querySelector('.cal-current-year')?.textContent || null,
        color: getComputedStyle(title).color,
        background: getComputedStyle(title).backgroundColor
      };
    };

    window.__calendarNow = () => new Date(2034, 6, 15, 12, 0, 0);
    document.body.classList.remove('dark');
    await wait(300);
    document.querySelector('.tab[data-tab="calendar"]').click();
    const initial = readTitle();
    document.body.classList.add('dark');
    await wait(300);
    const forcedDark = readTitle();
    document.body.classList.remove('dark');
    await wait(300);
    for (let index = 0; index < 6; index++) document.getElementById('calNext').click();
    document.querySelector('.tab[data-tab="input"]').click();
    document.querySelector('.tab[data-tab="calendar"]').click();
    const reopened = readTitle();
    return {
      initializerType: typeof window.initializeCalendarSession,
      initial,
      forcedDark,
      reopened
    };
  });
  await page.emulateMediaFeatures([]);

  assert.equal(state.initializerType, 'function', `${width}px calendar session initializer missing`);
  assert.deepEqual(
    { year: state.initial.year, month: state.initial.month },
    { year: 2034, month: 7 },
    `${width}px first calendar opening must derive its local year and month from the injected clock`
  );
  assert.equal(state.initial.ariaCurrent, 'date', `${width}px current calendar year must expose aria-current`);
  assert.equal(state.initial.selectedClass, true, `${width}px current calendar year must be visibly selected`);
  assert.equal(state.initial.badge, '올해', `${width}px current calendar year badge`);
  assertCssColorClose(state.initial.color, 'rgb(113, 82, 52)', `${width}px light current calendar year Priestess accent`);
  assert.ok(parseCssColor(state.initial.background).a > 0, `${width}px light current calendar year selection needs a visible fill`);
  assertCssColorClose(state.forcedDark.color, 'rgb(197, 167, 111)', `${width}px dark current calendar year Priestess accent`);
  assert.ok(parseCssColor(state.forcedDark.background).a > 0, `${width}px dark current calendar year selection needs a visible fill`);
  assert.deepEqual(
    { year: state.reopened.year, month: state.reopened.month },
    { year: 2035, month: 1 },
    `${width}px reopening the calendar in the same session must preserve user navigation`
  );
  assert.equal(state.reopened.ariaCurrent, null);
  assert.equal(state.reopened.selectedClass, false);
  assert.equal(state.reopened.badge, null);
}

async function inspectImportedFieldDownstreamSafety(page, width) {
  if (!runsImportedFieldXss() || width !== 390) return;
  const state = await page.evaluate(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const listKeys = async () => {
      const result = await window.storage.list('saju:');
      return result && Array.isArray(result.keys) ? result.keys : [];
    };
    const attackerNodes = root => [
      ...root.querySelectorAll('img[src="x"], [onerror], [onload], script[data-attacker]')
    ].map(element => element.outerHTML);
    const snapshot = (name, root) => ({
      name,
      executed: window.__x,
      attackerNodes: attackerNodes(root),
      text: root.textContent
    });

    for (const key of await listKeys()) await window.storage.delete(key);
    localStorage.removeItem('saju_list');
    window.__x = 0;
    window.alert = () => {};
    const maliciousName = '홍길동<img src=x onerror=__x=1>';
    const maliciousMemo = '메모<svg onload=__x=2>';
    const record = {
      ...currentSaju,
      id: 'attacker-controlled-id',
      name: maliciousName,
      memo: maliciousMemo,
      fav: true
    };

    document.querySelector('.tab[data-tab="saved"]').click();
    await renderSaved();
    const input = document.getElementById('savedImportFile');
    const file = new File(
      [JSON.stringify({ app: '잔상 만세력', version: 1, records: [record] })],
      'downstream-xss.json',
      { type: 'application/json' }
    );
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const deadline = Date.now() + 2500;
    let keys = [];
    while (Date.now() < deadline) {
      keys = await listKeys();
      if (keys.length === 1) break;
      await wait(25);
    }
    await renderSaved();
    await wait(30);

    const snapshots = [snapshot('saved', document.getElementById('savedContent'))];
    document.querySelector('#savedContent .saved-card').click();
    await wait(40);
    snapshots.push(snapshot('result', document.getElementById('view-result')));

    document.querySelector('.tab[data-tab="fortune"]').click();
    renderFortune();
    await wait(40);
    snapshots.push(snapshot('fortune', document.getElementById('fortuneContent')));

    window.shareCard(currentSaju);
    await wait(60);
    snapshots.push(snapshot('share', document.getElementById('shareCardModal')));
    window.closeShareCardModal();
    await wait(230);

    await findSimilarSaju();
    await wait(60);
    snapshots.push(snapshot('similar', document.getElementById('similarModal')));
    window.closeAppModal(document.getElementById('similarModal'));
    await wait(230);

    for (const key of await listKeys()) await window.storage.delete(key);
    localStorage.removeItem('saju_list');
    return {
      maliciousName,
      snapshots,
      finalExecuted: window.__x
    };
  });

  for (const snapshot of state.snapshots) {
    assert.equal(snapshot.executed, 0, `${width}px imported name executed in ${snapshot.name}`);
    assert.deepEqual(snapshot.attackerNodes, [], `${width}px attacker node reached ${snapshot.name}`);
  }
  assert.equal(state.finalExecuted, 0, `${width}px imported name executed in downstream surfaces`);
  const visibleText = state.snapshots.map(snapshot => snapshot.text).join('\n');
  assert.match(visibleText, /홍길동/, 'legitimate Korean name characters must be preserved');
  assert.match(visibleText, /<img src=x onerror=/, 'malicious markup must remain inert visible text');
}

function inspectReleaseContract() {
  const versionedRunner = path.join(WEB_ROOT, 'tests', 'ui-regression.js');
  const externalRunner = path.join(APP_ROOT, 'ui-regression.js');
  const buildScript = path.join(WEB_ROOT, 'scripts', 'build-protected.ps1');
  const obfuscatorScript = path.join(APP_ROOT, 'obfuscate_assets.js');
  assert.ok(fs.existsSync(versionedRunner), 'web/tests/ui-regression.js must be versioned in the web repository');
  assert.deepEqual(
    fs.readFileSync(versionedRunner),
    fs.readFileSync(externalRunner),
    'external and web-repo regression runners must be byte-identical'
  );
  assert.ok(fs.existsSync(buildScript), 'web/scripts/build-protected.ps1 must provide the single protected-release command');
  assert.ok(fs.existsSync(obfuscatorScript), 'Android asset obfuscator must exist');

  const obfuscator = fs.readFileSync(obfuscatorScript, 'utf8');
  assert.match(obfuscator, /seed:\s*20260813/, 'Android asset obfuscation must be deterministic');
  for (const moduleName of ['annual-reading.js', 'reading.js', 'unified-reading.js', 'life-model.js', 'life-forecast.js']) {
    assert.match(obfuscator, new RegExp(`['"]${moduleName.replace('.', '\\.')}['"]`), `${moduleName} must be included in Android asset protection`);
  }

  const lunarVendor = fs.readFileSync(path.join(WEB_ROOT, 'korean-lunar-calendar.min.js'), 'utf8');
  assert.match(lunarVendor, /korean-lunar-calendar 0\.4\.0/, 'the pinned Korean lunar conversion version must be recorded');
  assert.match(lunarVendor, /MIT License[\s\S]*Copyright \(c\) 2022 Jinil Lee/, 'the vendored lunar converter must retain its license notice');

  const script = fs.readFileSync(buildScript, 'utf8');
  const releaseFilesBlock = script.match(/\$ReleaseWebFiles\s*=\s*@\(([\s\S]*?)\)/);
  assert.ok(releaseFilesBlock, 'release source inventory must be declared');
  const releaseFiles = [...releaseFilesBlock[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.ok(releaseFiles.length > 0, 'release source inventory must not be empty');
  for (const relativePath of releaseFiles) {
    assert.ok(fs.existsSync(path.join(APP_ROOT, 'www', relativePath)), `release source inventory points outside app/www ownership: ${relativePath}`);
    assert.ok(fs.existsSync(path.join(WEB_ROOT, relativePath)), `release mirror is missing: ${relativePath}`);
  }
  const webOnlyFilesBlock = script.match(/\$WebOnlyFiles\s*=\s*@\(([\s\S]*?)\)/);
  assert.ok(webOnlyFilesBlock, 'web-only release inventory must be declared separately from Android-owned files');
  const webOnlyFiles = [...webOnlyFilesBlock[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(
    webOnlyFiles.sort(),
    ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest', 'sw.js'].sort(),
    'web-only PWA assets must be complete and explicit'
  );
  for (const relativePath of webOnlyFiles) {
    assert.ok(fs.existsSync(path.join(WEB_ROOT, relativePath)), `web-only release asset is missing: ${relativePath}`);
  }
  for (const requiredRuntime of [
    'korean-lunar-calendar.min.js', 'annual-reading.js', 'reading.js', 'unified-reading.js', 'reading.css', 'life-model.js', 'life-forecast.js',
    'priestess.css', 'jansang-calligraphy-brush.webp', 'manse-hero-v2.webp'
  ]) {
    assert.ok(releaseFiles.includes(requiredRuntime), `release source inventory is missing runtime asset: ${requiredRuntime}`);
  }
  const protectedFilesBlock = script.match(/\$ProtectedFiles\s*=\s*@\(([^\r\n]+)\)/);
  assert.ok(protectedFilesBlock, 'protected source inventory must be declared');
  const protectedFiles = [...protectedFilesBlock[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  for (const requiredProtected of ['index.html', 'annual-reading.js', 'reading.js', 'unified-reading.js', 'life-model.js', 'life-forecast.js']) {
    assert.ok(protectedFiles.includes(requiredProtected), `protected source inventory is missing: ${requiredProtected}`);
  }
  for (const [pattern, message] of [
    [/\$ErrorActionPreference\s*=\s*['"]Stop['"]/, 'PowerShell errors must fail the release'],
    [/Assert-SigningConfiguration/, 'signing configuration must be preflighted'],
    [/Assert-WebOnlyAssets/, 'web-only PWA assets must be preflighted'],
    [/tombstone worker must not intercept requests/, 'service-worker validation must enforce the no-cache tombstone'],
    [/navigator\\\.serviceWorker\\\.register/, 'release preflight must reject new service-worker registration'],
    [/Sync-CleanAssets/, 'clean Capacitor sync must be explicit'],
    [/obfuscate_assets\.js/, 'Android assets must be obfuscated'],
    [/tests[\\/]ui-regression\.js/, 'the versioned protected regression must run'],
    [/\$env:SKIP_SOURCE_CONTRACTS\s*=\s*['"]1['"]/, 'protected regression must explicitly skip only source-shape contracts'],
    [/assembleRelease/, 'the release APK must be built'],
    [/bundleRelease/, 'the release AAB must be built'],
    [/apksigner/, 'APK signature verification must run'],
    [/jarsigner/, 'AAB signature verification must run'],
    [/Verified using v2 scheme/, 'APK v2 verification must be asserted'],
    [/da1950eab27b62b7c0ac92a21b34a2fab32ff582f0e68be0d6e72d56488508aa/i, 'the expected signing identity must be pinned'],
    [/apkanalyzer/, 'the delivered APK manifest must be inspected'],
    [/android:allowBackup="false"/, 'the delivered APK must disable backup'],
    [/Get-FileHash/, 'artifact SHA-256 hashes must be calculated'],
    [/finally\s*\{[\s\S]*Restore-CleanAssets/, 'clean Android assets must be restored even after failure']
  ]) assert.match(script, pattern, message);
  assert.match(
    fs.readFileSync(versionedRunner, 'utf8'),
    /process\.env\.SKIP_SOURCE_CONTRACTS\s*!==\s*['"]1['"]\s*&&\s*runsGroup\(['"]final-security['"]\)/,
    'source-shape security contracts must remain enabled except for explicitly protected assets'
  );
  assert.doesNotMatch(script, /storePassword\s*=\s*['"][^'"]+['"]/, 'credentials must not be committed in release tooling');
  assert.doesNotMatch(script, /keyPassword\s*=\s*['"][^'"]+['"]/, 'credentials must not be committed in release tooling');

  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'manse-release-contract-'));
  try {
    const missingProperties = path.join(tempRoot, 'missing-keystore.properties');
    const missingCredentials = childProcess.spawnSync(powershell, [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', buildScript,
      '-PreflightOnly', '-SigningPropertiesPath', missingProperties
    ], { cwd: WEB_ROOT, encoding: 'utf8', timeout: 30000 });
    assert.notEqual(missingCredentials.status, 0, 'release preflight must fail without signing configuration');
    assert.match(
      `${missingCredentials.stdout}\n${missingCredentials.stderr}`,
      /Signing properties file not found/,
      'missing signing configuration must produce a closed failure'
    );

    const unsignedApk = path.join(tempRoot, 'unsigned.apk');
    const unsignedAab = path.join(tempRoot, 'unsigned.aab');
    fs.writeFileSync(unsignedApk, 'not a signed APK');
    fs.writeFileSync(unsignedAab, 'not a signed AAB');
    const missingSignature = childProcess.spawnSync(powershell, [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', buildScript,
      '-VerifyOnly', '-ApkPath', unsignedApk, '-AabPath', unsignedAab
    ], { cwd: WEB_ROOT, encoding: 'utf8', timeout: 30000 });
    assert.notEqual(missingSignature.status, 0, 'artifact verification must fail for unsigned payloads');
    assert.match(
      `${missingSignature.stdout}\n${missingSignature.stderr}`,
      /APK signature verification failed/,
      'an unavailable APK signature must produce a closed failure'
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

async function fillAndCalculate(page) {
  await page.evaluate(() => {
    document.getElementById('inputName').value = '홍길동';
    document.querySelector('#segGender [data-val="M"]').click();
    document.querySelector('#segCal [data-val="solar"]').click();

    const birth = document.getElementById('inBirth');
    birth.value = '19890319';
    birth.dispatchEvent(new Event('input', { bubbles: true }));

    const time = document.getElementById('inTime');
    time.value = '1430';
    time.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('calcBtn').click();
  });
  await sleep(600);
}

async function inspectUnifiedSurface(page, width) {
  if (!runsUnifiedSurface()) return;
  const source = fs.readFileSync(path.join(UI_ROOT, 'index.html'), 'utf8');
  assert.doesNotMatch(source, /<script src="life-model\.js"><\/script>/);
  assert.doesNotMatch(source, /<script src="life-forecast\.js"><\/script>/);
  assert.doesNotMatch(source, /function buildLifeTimeline\(/);
  assert.doesNotMatch(source, /function renderMatch\(/);
  assert.match(source, /<script src="unified-reading\.js"><\/script>/);
  await fillAndCalculate(page);
  const state = await page.evaluate(async () => {
    const bounds = element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, top: rect.top, height: rect.height };
    };
    const tabs = ['input', 'result', 'fortune', 'calendar', 'saved'];
    const rows = [];
    for (const name of tabs) {
      document.querySelector(`.tab[data-tab="${name}"]`).click();
      if (name === 'saved') await renderSaved();
      const view = document.getElementById(`view-${name}`);
      const head = view.querySelector('.view-head');
      rows.push({
        name,
        view: bounds(view),
        head: head ? bounds(head) : null,
        scrollWidth: view.scrollWidth,
        clientWidth: view.clientWidth
      });
    }
    return {
      tabs: [...document.querySelectorAll('.tab')].map(tab => tab.dataset.tab),
      labels: [...document.querySelectorAll('.tab')].map(tab => tab.textContent.trim()),
      matchNodes: document.querySelectorAll(
        '[data-tab="match"], #view-match, #matchPickerModal, #matchNewModal, [class^="match-"]'
      ).length,
      matchRuntime: typeof window.renderMatch,
      inputMentionsMatch: document.getElementById('view-input').textContent.includes('궁합'),
      aboutMentionsMatch: document.getElementById('aboutModal').textContent.includes('궁합'),
      topBar: bounds(document.querySelector('.top-bar')),
      tabBar: bounds(document.querySelector('.tabs')),
      rows,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  assert.deepEqual(state.tabs, ['input', 'result', 'fortune', 'calendar', 'saved']);
  assert.deepEqual(state.labels, ['입력', '원국', '풀이', '만세력', '저장']);
  assert.equal(state.matchNodes, 0);
  assert.equal(state.matchRuntime, 'undefined');
  assert.equal(state.inputMentionsMatch, false);
  assert.equal(state.aboutMentionsMatch, false);
  assert.ok(state.overflow <= 1, `${width}px removed compatibility surface overflows by ${state.overflow}px`);
  const reference = state.rows[0].view;
  for (const row of state.rows) {
    assert.ok(row.head, `${width}px ${row.name} is missing the common view header`);
    assert.ok(row.head.height >= 72 && row.head.height <= 132, `${width}px ${row.name} header is ${row.head.height}px tall`);
    assert.ok(Math.abs(row.view.left - reference.left) <= 1, `${width}px ${row.name} view left differs`);
    assert.ok(Math.abs(row.view.right - reference.right) <= 1, `${width}px ${row.name} view right differs`);
    assert.ok(Math.abs(row.view.width - reference.width) <= 1, `${width}px ${row.name} view width differs`);
    assert.ok(row.scrollWidth <= row.clientWidth + 1, `${width}px ${row.name} overflows its view`);
  }
  for (const shell of [state.topBar, state.tabBar]) {
    assert.ok(Math.abs(shell.left - reference.left) <= 1, `${width}px chrome left differs from views`);
    assert.ok(Math.abs(shell.width - reference.width) <= 1, `${width}px chrome ${shell.width}px differs from view ${reference.width}px`);
  }

  if (width === 390) {
    await page.evaluate(() => {
      document.querySelector('.tab[data-tab="fortune"]').click();
      selectedFortuneYear = 2027;
      renderFortune();
    });
    const resized = [];
    for (const nextWidth of [390, 884, 720]) {
      await page.setViewport({ width: nextWidth, height: 900, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await sleep(80);
      resized.push(await page.evaluate(() => ({
        width: document.querySelector('.view.active').getBoundingClientRect().width,
        tab: document.querySelector('.tab.active')?.dataset.tab,
        year: selectedFortuneYear,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      })));
    }
    assert.equal(resized[0].tab, 'fortune');
    assert.equal(resized[2].year, 2027);
    assert.ok(resized[1].width > resized[0].width, 'shell must expand from phone to unfolded width without reload');
    assert.ok(resized[2].width > resized[0].width, 'shell must retain fluid width after shrinking from unfolded size');
    assert.ok(resized.every(item => item.overflow <= 1), 'resizing in place must not create horizontal overflow');
  }
}

async function inspectUnifiedReading(page, width) {
  if (!runsUnifiedReading()) return;
  await page.evaluate(() => document.querySelector('.tab[data-tab="fortune"]').click());
  await sleep(100);

  const snapshot = () => page.evaluate(() => {
    const root = document.getElementById('fortuneContent');
    return {
      order: [...root.querySelectorAll('[data-reading-section]')]
        .map(section => section.dataset.readingSection),
      title: root.querySelector('[data-reading-section="year"] h2')?.textContent.trim() || '',
      yearGroups: [...root.querySelectorAll('.reading-year-group h3')]
        .map(heading => heading.textContent.trim()),
      deepIntroTitle: root.querySelector('.reading-deep-intro h3')?.textContent.trim() || '',
      deepChapters: root.querySelectorAll('.reading-chapter[data-reading-source="deep"]').length,
      deepLeads: root.querySelectorAll('.reading-chapter[data-reading-source="deep"] .reading-chapter__lead').length,
      closingTitles: root.querySelectorAll('.reading-chapter[data-reading-source="closing"] h4').length,
      months: root.querySelectorAll('.reading-month').length,
      monthLabels: [...root.querySelectorAll('.reading-month__label')]
        .map(label => label.textContent.trim()),
      monthText: [...root.querySelectorAll('.reading-month')].map(month => month.textContent.trim()),
      yearText: root.querySelector('[data-reading-section="year"]')?.textContent || '',
      daeunText: root.querySelector('[data-reading-section="daeun"]')?.textContent || '',
      detailsCount: root.querySelectorAll('details').length,
      scoreCards: root.querySelectorAll('.overall-card, .f-card, .match-total-card').length,
      lifeGraphs: root.querySelectorAll('.life-course, [data-lifetime-graph]').length,
      deepCards: root.querySelectorAll('.deep-reading, .deep-chapter').length,
      disclaimerLast: root.lastElementChild?.classList.contains('reading-disclaimer') || false,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  await page.evaluate(() => {
    selectedFortuneYear = 2026;
    renderFortune();
  });
  await sleep(100);
  const initial = await snapshot();
  await page.click('[data-fortune-year-next]');
  await sleep(100);
  const next = await snapshot();

  const selected = await page.evaluate(() => {
    document.querySelector('.tab[data-tab="result"]').click();
    const items = [...document.querySelectorAll('#daeunScroll .luck-item')];
    const target = items.find(item => Number(item.dataset.idx) !== selectedDaeun) || items[0];
    target.click();
    const value = currentSaju.daeun.list[selectedDaeun];
    const ganji = `${STEM_KOR[value.stem]}${BRANCH_KOR[value.branch]}`;
    document.querySelector('.tab[data-tab="fortune"]').click();
    return ganji;
  });
  await sleep(100);
  const selectedState = await snapshot();

  assert.deepEqual(initial.order, ['year', 'months', 'daeun']);
  assert.deepEqual(initial.yearGroups, ['올해의 핵심', '일과 재물', '관계와 생활', '건강과 주의', '실행 기준']);
  assert.ok(initial.deepIntroTitle.length > 0);
  assert.equal(initial.deepChapters, 10);
  assert.equal(initial.deepLeads, 10);
  assert.equal(initial.closingTitles, 1);
  assert.equal(initial.months, 12);
  assert.equal(initial.monthLabels[0], '1월');
  assert.equal(initial.monthLabels[11], '12월');
  assert.match(initial.daeunText, /대운/);
  assert.equal(initial.detailsCount, 0);
  assert.equal(initial.scoreCards, 0);
  assert.equal(initial.lifeGraphs, 0);
  assert.equal(initial.deepCards, 0);
  assert.equal(initial.disclaimerLast, true);
  assert.ok(initial.overflow <= 1, `${width}px unified reading overflowed by ${initial.overflow}px`);
  assert.notEqual(next.title, initial.title, `${width}px next year title did not change`);
  assert.notDeepEqual(next.monthText, initial.monthText, `${width}px next year monthly readings did not change`);
  assert.deepEqual(next.order, ['year', 'months', 'daeun']);
  assert.match(selectedState.daeunText, new RegExp(selected));
  assert.doesNotMatch(selectedState.yearText, new RegExp(selected));
}

async function inspectAnnualYearReading(page, width) {
  if (!runsAnnualYearReading()) return;
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluate(() => document.querySelector('.tab[data-tab="fortune"]').click());
  await sleep(100);

  const snapshot = () => page.evaluate(() => {
    const fortune = document.getElementById('fortuneContent');
    const report = fortune.querySelector('.unified-reading');
    const navButtons = [...fortune.querySelectorAll('.fortune-year-nav button')];
    const prose = fortune.querySelector('.reading-prose p');
    const style = prose ? getComputedStyle(prose) : null;
    return {
      title: report?.querySelector('#unifiedReadingTitle')?.textContent.trim() || '',
      ganji: fortune.querySelector('.fortune-head .year-tag')?.textContent.trim() || '',
      monthCount: report?.querySelectorAll('.reading-month').length || 0,
      groupCount: report?.querySelectorAll('.reading-year-group').length || 0,
      textLength: report?.textContent.replace(/\s+/g, ' ').trim().length || 0,
      navCount: navButtons.length,
      minNavHeight: Math.min(...navButtons.map(button => button.getBoundingClientRect().height)),
      activeControl: document.activeElement?.dataset.fortuneYearControl || null,
      currentControlDisabled: fortune.querySelector('[data-fortune-year-current]')?.getAttribute('aria-disabled') === 'true',
      bodyFontSize: Number.parseFloat(style?.fontSize || '0'),
      bodyLineHeight: Number.parseFloat(style?.lineHeight || '0'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      status: fortune.querySelector('.fortune-year-status')?.textContent.trim() || ''
    };
  });

  const currentYear = new Date().getFullYear();
  const initial = await snapshot();
  await page.evaluate(() => {
    selectedFortuneYear = 2026;
    renderFortune();
  });
  await sleep(100);
  const fixed2026 = await snapshot();
  await page.click('[data-fortune-year-next]');
  await sleep(100);
  const next = await snapshot();
  await page.click('[data-fortune-year-current]');
  await sleep(100);
  const restored = await snapshot();

  const escaped = await page.evaluate(() => {
    window.__unifiedReadingXss = 0;
    const payload = '<img src=x onerror="window.__unifiedReadingXss=1">';
    const host = document.createElement('div');
    host.innerHTML = renderUnifiedReading({
      title: payload,
      deck: payload,
      evidence: [payload],
      yearGroups: [{ title: payload, paragraphs: [payload], evidence: [payload] }],
      months: [{ month: 1, ganji: payload, label: payload, guidance: payload }],
      daeun: { title: payload, summary: payload, paragraphs: [payload], evidence: [payload] },
      rules: [payload]
    });
    document.body.append(host);
    const safe = window.__unifiedReadingXss === 0 && !host.querySelector('img');
    host.remove();
    return safe;
  });
  await page.emulateMediaFeatures([]);

  assert.match(initial.title, new RegExp(`^${currentYear}년`));
  assert.equal(initial.currentControlDisabled, true);
  assert.match(fixed2026.title, /^2026년 병오년/);
  assert.match(next.title, /^2027년 정미년/);
  assert.equal(next.activeControl, 'next');
  assert.equal(next.currentControlDisabled, false);
  assert.match(restored.title, new RegExp(`^${currentYear}년`));
  assert.equal(restored.activeControl, 'current');
  for (const state of [initial, fixed2026, next, restored]) {
    assert.equal(state.monthCount, 12, `${width}px monthly reading count`);
    assert.equal(state.groupCount, 5, `${width}px annual reading group count`);
    assert.ok(state.textLength >= 8500, `${width}px long reading was only ${state.textLength} chars`);
    assert.equal(state.navCount, 3, `${width}px year navigation count`);
    assert.ok(state.minNavHeight >= 43.5, `${width}px year navigation target below 44px`);
    assert.ok(state.bodyFontSize >= 14, `${width}px reading body below 14px`);
    assert.ok(state.bodyLineHeight / state.bodyFontSize >= 1.5, `${width}px reading body is cramped`);
    assert.ok(state.overflow <= 1, `${width}px annual reading overflowed by ${state.overflow}px`);
  }
  assert.match(next.status, /2027년 정미년 상세운으로 변경됨/);
  assert.equal(escaped, true, `${width}px unified reading renderer must escape model text`);
}

async function inspectLunarInput(page, width) {
  if (!runsLunarInput() || width !== 390) return;

  const state = await page.evaluate(() => {
    document.querySelector('.tab[data-tab="input"]').click();
    document.getElementById('inputName').value = '음력 검증';
    document.getElementById('inBirth').value = '18721105';
    document.getElementById('inTime').value = '';
    document.querySelector('#segGender [data-val="M"]').click();

    const lunarButton = document.querySelector('#segCal [data-val="lunar"]');
    lunarButton.click();
    const direct = calcSaju({
      year: 1872, month: 11, day: 5,
      hour: 0, minute: 0,
      calendar: 'lunar', gender: 'M', unknown: true
    });

    document.getElementById('calcBtn').click();
    return {
      selected: {
        active: lunarButton.classList.contains('active'),
        checked: lunarButton.getAttribute('aria-checked')
      },
      direct: {
        year: direct.year,
        month: direct.month,
        day: direct.day,
        inputCalendar: direct.inputCalendar,
        inputDate: direct.inputDate,
        lunar: direct.lunar
      },
      current: currentSaju && {
        year: currentSaju.year,
        month: currentSaju.month,
        day: currentSaju.day,
        inputCalendar: currentSaju.inputCalendar,
        inputDate: currentSaju.inputDate,
        lunar: currentSaju.lunar
      },
      invalidModernDate: lunarToSolar(1872, 11, 30, false),
      rejectedLegacyDay30Months: Array.from({ length: 12 }, (_, index) => index + 1)
        .filter(month => lunarToSolar(2099, month, 30, false) === null),
      resultText: document.querySelector('#view-result .result-head .info')?.textContent.replace(/\s+/g, ' ').trim() || ''
    };
  });

  const expected = {
    year: 1872,
    month: 12,
    day: 5,
    inputCalendar: 'lunar',
    inputDate: { year: 1872, month: 11, day: 5 },
    lunar: { y: 1872, m: 11, d: 5 }
  };
  assert.deepEqual(state.selected, { active: true, checked: 'true' }, '음력 버튼은 선택 상태를 즉시 표시해야 한다');
  assert.deepEqual(state.direct, expected, '1872년 음력 입력은 같은 숫자의 양력 날짜로 조용히 대체되면 안 된다');
  assert.deepEqual(state.current, expected, '음력 변환 결과가 실제 계산 상태에도 반영되어야 한다');
  assert.equal(state.invalidModernDate, null, '존재하지 않는 과거 음력 날짜는 거부해야 한다');
  assert.ok(state.rejectedLegacyDay30Months.length > 0, '2051년 이후에도 작은달의 30일을 거부해야 한다');
  assert.match(state.resultText, /양력 1872\.12\.05 \/ 음력 1872\.11\.05/, '결과 화면에 변환 전후 날짜를 함께 표시해야 한다');
}

async function inspectLongReading(page, width) {
  if (!runsLongReading()) return;
  await page.evaluate(() => document.querySelector('.tab[data-tab="fortune"]').click());
  await sleep(100);

  const state = await page.evaluate(() => {
    const root = document.querySelector('#fortuneContent .unified-reading');
    const prose = root?.querySelector('.reading-prose');
    const paragraph = prose?.querySelector('p');
    const proseRect = prose?.getBoundingClientRect();
    const style = paragraph ? getComputedStyle(paragraph) : null;
    const sections = [...(root?.querySelectorAll('[data-reading-section]') || [])];
    const overflowNodes = [...(root?.querySelectorAll('*') || [])]
      .filter(element => element.scrollWidth > element.clientWidth + 1)
      .map(element => element.className || element.tagName);
    return {
      exists: Boolean(root),
      order: sections.map(section => section.dataset.readingSection),
      groupCount: root?.querySelectorAll('.reading-year-group').length || 0,
      monthCount: root?.querySelectorAll('.reading-month').length || 0,
      paragraphCount: root?.querySelectorAll('.reading-prose p, .reading-month p').length || 0,
      textLength: root?.textContent.replace(/\s+/g, ' ').trim().length || 0,
      fontSize: Number.parseFloat(style?.fontSize || '0'),
      lineHeight: Number.parseFloat(style?.lineHeight || '0'),
      proseWidth: proseRect?.width || 0,
      viewportWidth: document.documentElement.clientWidth,
      details: root?.querySelectorAll('details').length || 0,
      cards: root?.querySelectorAll('.overall-card, .life-course, .deep-reading, .deep-chapter').length || 0,
      overflowNodes,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
    };
  });

  assert.equal(state.exists, true, `${width}px unified reading missing`);
  assert.deepEqual(state.order, ['year', 'months', 'daeun']);
  assert.equal(state.groupCount, 5);
  assert.equal(state.monthCount, 12);
  assert.ok(state.paragraphCount >= 50, `${width}px long reading lost paragraphs: ${state.paragraphCount}`);
  assert.ok(state.textLength >= 8500, `${width}px long reading was only ${state.textLength} characters`);
  assert.ok(state.fontSize >= 14, `${width}px reading font below 14px`);
  assert.ok(state.lineHeight / state.fontSize >= 1.65, `${width}px reading line-height is cramped`);
  assert.ok(state.proseWidth <= Math.min(state.viewportWidth, 760), `${width}px readable line measure is too wide: ${state.proseWidth}px`);
  assert.equal(state.details, 0, `${width}px continuous reading must not use disclosures`);
  assert.equal(state.cards, 0, `${width}px removed score/graph/chapter cards returned`);
  assert.deepEqual(state.overflowNodes, [], `${width}px reading descendants overflow: ${state.overflowNodes.join(', ')}`);
  assert.ok(state.pageOverflow <= 1, `${width}px reading page overflowed by ${state.pageOverflow}px`);

  await page.evaluate(() => document.querySelector('.tab[data-tab="result"]').click());
}

async function inspectLuckFlowOrder(page, width) {
  if (!runsLuckFlowOrder()) return;
  await resetLuckFlow(page);

  const initial = await page.evaluate(() => {
    const result = document.getElementById('view-result');
    const children = [...result.children];
    const oguk = result.querySelector(':scope > .oguk-card');
    const flow = result.querySelector(':scope > .result-right');
    const same = result.querySelector(':scope > .same-pillars-card');
    return {
      indexes: [children.indexOf(oguk), children.indexOf(flow), children.indexOf(same)],
      seunCount: document.querySelectorAll('#seunScroll .luck-item').length,
      hasWoon: Boolean(document.getElementById('woonScroll')),
      hasDay: Boolean(document.getElementById('dayArea')),
      uniqueCounts: [
        document.querySelectorAll('#daeunScroll').length,
        document.querySelectorAll('#seunArea').length,
        document.querySelectorAll('.luck-section').length
      ],
      pillars: [
        STEM[currentSaju.yStem] + BRANCH[currentSaju.yBranch],
        STEM[currentSaju.mStem] + BRANCH[currentSaju.mBranch],
        STEM[currentSaju.dStem] + BRANCH[currentSaju.dBranch],
        STEM[currentSaju.hStem] + BRANCH[currentSaju.hBranch]
      ],
      daeun: currentSaju.daeun.list.map(item =>
        item.age + ':' + STEM[item.stem] + BRANCH[item.branch]
      ),
      seun: [...document.querySelectorAll('#seunScroll .luck-item')].map(item =>
        item.dataset.year + ':' +
        [...item.querySelectorAll('.luck-block .han')].map(node => node.textContent).join('')
      ),
      flowBeforeSame: Boolean(
        flow.compareDocumentPosition(same) & Node.DOCUMENT_POSITION_FOLLOWING
      )
    };
  });

  assert.deepEqual(initial.indexes, [0, 1, 2], width + 'px natal/luck/millennium order');
  assert.ok(initial.seunCount >= 10, width + 'px current Daeyun must render Seun');
  assert.equal(initial.hasWoon, false, width + 'px Woon must stay collapsed before Seun selection');
  assert.equal(initial.hasDay, false, width + 'px day flow must stay collapsed before month selection');
  assert.deepEqual(initial.uniqueCounts, [1, 1, 1], width + 'px luck IDs and section must stay unique');
  assert.deepEqual(initial.pillars, ['己巳', '丁卯', '戊寅', '己未']);
  assert.deepEqual(initial.daeun, [
    '0:丁卯', '4:丙寅', '14:乙丑', '24:甲子', '34:癸亥', '44:壬戌',
    '54:辛酉', '64:庚申', '74:己未', '84:戊午', '94:丁巳'
  ]);
  assert.deepEqual(initial.seun, [
    '2032:壬子', '2031:辛亥', '2030:庚戌', '2029:己酉', '2028:戊申',
    '2027:丁未', '2026:丙午', '2025:乙巳', '2024:甲辰', '2023:癸卯'
  ]);
  assert.equal(initial.flowBeforeSame, true, width + 'px luck flow must precede millennium card');

  await page.click('#seunScroll .luck-item[data-year="2023"]');
  await page.waitForSelector('#woonScroll .luck-item');
  assert.equal(
    await page.$$eval('#woonScroll .luck-item', items => items.length),
    12,
    width + 'px selected Seun must render twelve months'
  );
  assert.deepEqual(
    await page.$$eval('#woonScroll .luck-item', items => items.map(item =>
      item.dataset.month + ':' +
      [...item.querySelectorAll('.luck-block .han')].map(node => node.textContent).join('')
    )),
    [
      '12:甲子', '11:癸亥', '10:壬戌', '9:辛酉', '8:庚申', '7:己未',
      '6:戊午', '5:丁巳', '4:丙辰', '3:乙卯', '2:甲寅', '1:癸丑'
    ]
  );

  await page.click('#woonScroll .luck-item');
  await page.waitForSelector('#dayArea .day-item:not(.empty)');
  const expanded = await page.evaluate(() => ({
    dayCount: document.querySelectorAll('#dayArea .day-item:not(.empty)').length,
    documentOverflow: document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    luckContainsWoon: document.querySelector('.luck-section').contains(document.getElementById('woonScroll')),
    luckContainsDay: document.querySelector('.luck-section').contains(document.getElementById('dayArea')),
    flowBeforeSame: Boolean(
      document.querySelector('.result-right').compareDocumentPosition(
        document.querySelector('.same-pillars-card')
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    )
  }));
  assert.ok(expanded.dayCount >= 28 && expanded.dayCount <= 31);
  assert.ok(expanded.documentOverflow <= 1, width + 'px expanded day flow must not overflow the document');
  assert.equal(expanded.luckContainsWoon, true);
  assert.equal(expanded.luckContainsDay, true);
  assert.equal(expanded.flowBeforeSame, true);

  await page.evaluate(() => {
    const selected = document.querySelector('#daeunScroll .luck-item.selected');
    const next = [...document.querySelectorAll('#daeunScroll .luck-item')]
      .find(item => item !== selected);
    next.click();
  });
  await sleep(30);
  assert.equal(await page.$('#woonScroll'), null, 'changing Daeyun must clear Woon');
  assert.equal(await page.$('#dayArea'), null, 'changing Daeyun must clear day flow');
  await resetLuckFlow(page);
}

async function inspectLuckFlowAccessibility(page, width) {
  if (!runsLuckFlowAccessibility()) return;
  await resetLuckFlow(page);

  const initial = await page.evaluate(() => {
    const daeun = [...document.querySelectorAll('#daeunScroll .luck-item')];
    const seun = [...document.querySelectorAll('#seunScroll .luck-item')];
    return {
      tags: [...daeun, ...seun].map(item => item.tagName),
      tabIndexes: [...daeun, ...seun].map(item => item.tabIndex),
      daeunPressed: daeun.map(item => item.getAttribute('aria-pressed')),
      daeunLabels: daeun.map(item => item.getAttribute('aria-label') || ''),
      seunLabels: seun.map(item => item.getAttribute('aria-label') || ''),
      currentDaeun: daeun
        .filter(item => item.dataset.current === 'true')
        .map(item => item.getAttribute('aria-label') || '')
    };
  });
  assert.ok(initial.tags.every(tag => tag === 'BUTTON'), width + 'px luck items must be buttons');
  assert.ok(initial.tabIndexes.every(tabIndex => tabIndex === 0), width + 'px luck buttons must stay in Tab order');
  assert.equal(initial.daeunPressed.filter(value => value === 'true').length, 1);
  assert.ok(initial.daeunLabels.every(label => /대운 .*천간 십성 .*지지 십성/.test(label)));
  assert.ok(initial.seunLabels.every(label => /세운 .*천간 십성 .*지지 십성/.test(label)));
  assert.equal(initial.currentDaeun.length, 1);
  assert.match(initial.currentDaeun[0], /현재/);

  for (const dark of [false, true]) {
    await page.evaluate(isDark => document.body.classList.toggle('dark', isDark), dark);
    await page.keyboard.press('Tab');
    await page.$eval('#daeunScroll .luck-item.selected', item => item.focus());
    const focus = await page.$eval('#daeunScroll .luck-item.selected', item => {
      const style = getComputedStyle(item);
      return {
        active: document.activeElement === item,
        visible: item.matches(':focus-visible'),
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth),
        outlineOffset: style.outlineOffset,
        outlineColor: style.outlineColor
      };
    });
    assert.equal(focus.active, true, width + 'px selected luck button must receive focus');
    assert.equal(focus.visible, true, width + 'px selected luck focus must be visible');
    assert.notEqual(focus.outlineStyle, 'none');
    assert.ok(focus.outlineWidth >= 2);
    assert.equal(focus.outlineOffset, '2px');
    assert.notEqual(focus.outlineColor, 'rgba(0, 0, 0, 0)');
  }
  await page.evaluate(() => document.body.classList.add('dark'));

  await page.evaluate(() => {
    const selected = document.querySelector('#daeunScroll .luck-item.selected');
    [...document.querySelectorAll('#daeunScroll .luck-item')]
      .find(item => item !== selected)
      .focus();
  });
  await page.keyboard.press('Enter');
  await sleep(30);
  assert.equal(
    await page.$$eval('#daeunScroll .luck-item[aria-pressed="true"]', items => items.length),
    1
  );

  await page.$eval('#seunScroll .luck-item', item => item.focus());
  await page.keyboard.press('Enter');
  await page.waitForSelector('#woonScroll .luck-item');
  assert.equal(
    await page.$$eval('#seunScroll .luck-item[aria-pressed="true"]', items => items.length),
    1
  );

  await page.$eval('#woonScroll .luck-item', item => item.focus());
  await page.keyboard.press('Space');
  await page.waitForSelector('#dayArea .day-item:not(.empty)');
  assert.equal(
    await page.$$eval('#woonScroll .luck-item[aria-pressed="true"]', items => items.length),
    1
  );
  await resetLuckFlow(page);
}

async function inspectLuckFlowResponsive(page, width) {
  if (!runsLuckFlowResponsive()) return;
  await resetLuckFlow(page);

  await page.click('#seunScroll .luck-item');
  await page.waitForSelector('#woonScroll .luck-item');
  await sleep(40);

  const state = await page.evaluate(() => {
    const measure = selector => {
      const container = document.querySelector(selector);
      const items = [...container.querySelectorAll('.luck-item')];
      const containerRect = container.getBoundingClientRect();
      const firstRect = items[0].getBoundingClientRect();
      const lastRect = items.at(-1).getBoundingClientRect();
      return {
        clientWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
        itemWidths: items.map(item => item.getBoundingClientRect().width),
        blockWidths: items.map(item => item.querySelector('.luck-block').getBoundingClientRect().width),
        contentCenterDelta: Math.abs(
          ((firstRect.left + lastRect.right) / 2) -
          ((containerRect.left + containerRect.right) / 2)
        )
      };
    };
    const container = document.getElementById('daeunScroll');
    const selected = container.querySelector('.luck-item.selected');
    const containerRect = container.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      daeun: measure('#daeunScroll'),
      seun: measure('#seunScroll'),
      woon: measure('#woonScroll'),
      selectedVisible:
        selectedRect.left >= containerRect.left - 1 &&
        selectedRect.right <= containerRect.right + 1
    };
  });

  assert.ok(state.documentOverflow <= 1, width + 'px document overflow');
  assert.equal(state.selectedVisible, true, width + 'px selected Daeyun must be initially visible');
  const flowBlockWidths = [...state.daeun.blockWidths, ...state.seun.blockWidths];
  assert.ok(
    Math.max(...flowBlockWidths) - Math.min(...flowBlockWidths) <= 0.5,
    width + 'px Daeyun and Seun squares must share one fixed width: ' +
      JSON.stringify({ daeun: state.daeun.blockWidths, seun: state.seun.blockWidths })
  );
  assert.ok(
    flowBlockWidths.every(blockWidth => blockWidth >= 43.5),
    width + 'px Daeyun and Seun squares must preserve the 44px touch target'
  );

  if (width <= 600) {
    for (const [layer, metrics] of Object.entries({
      daeun: state.daeun,
      seun: state.seun,
      woon: state.woon
    })) {
      assert.ok(
        metrics.itemWidths.every(itemWidth => itemWidth >= 43.5),
        width + 'px ' + layer + ' target below 44px'
      );
    }
    if (width === 390) {
      assert.ok(state.daeun.scrollWidth > state.daeun.clientWidth);
      assert.ok(state.seun.scrollWidth > state.seun.clientWidth);
      assert.ok(state.woon.scrollWidth > state.woon.clientWidth);
    }

  }
  if (state.daeun.scrollWidth - state.daeun.clientWidth > 1) {
    await page.evaluate(() => {
      document.querySelector('#daeunScroll .luck-item:last-child').click();
    });
    await sleep(50);
    const newlySelectedVisible = await page.evaluate(() => {
      const container = document.getElementById('daeunScroll');
      const item = container.querySelector('.luck-item.selected');
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      return itemRect.left >= containerRect.left - 1 &&
        itemRect.right <= containerRect.right + 1;
    });
    assert.equal(newlySelectedVisible, true, width + 'px newly selected Daeyun must be revealed');
  }
  if (width >= 768) {
    assert.ok(state.daeun.scrollWidth - state.daeun.clientWidth <= 1);
    assert.ok(state.seun.scrollWidth - state.seun.clientWidth <= 1);
    assert.ok(state.woon.scrollWidth - state.woon.clientWidth <= 1);
  }
  for (const [layer, metrics] of Object.entries({ daeun: state.daeun, seun: state.seun })) {
    if (metrics.scrollWidth - metrics.clientWidth <= 1) {
      assert.ok(
        metrics.contentCenterDelta <= 0.5,
        width + 'px ' + layer + ' squares must be centered, delta ' + metrics.contentCenterDelta + 'px'
      );
    }
  }
  await resetLuckFlow(page);
}

async function collectAppleInspection(page, selectors) {
  return page.evaluate(({ styleSelectors, geometrySelectors }) => {
    const visualProperties = [
      'background', 'backgroundColor', 'backgroundImage',
      'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
      'color', 'outlineColor', 'boxShadow', 'textShadow'
    ];
    const styleSnapshot = (element, pseudo = null) => {
      const computed = getComputedStyle(element, pseudo);
      return {
        values: Object.fromEntries(visualProperties.map(property => [property, computed[property]])),
        rendered: !pseudo || (
          computed.content !== 'none' &&
          computed.display !== 'none' &&
          computed.visibility !== 'hidden' &&
          Number(computed.opacity) > 0
        )
      };
    };
    const styles = selector => [...document.querySelectorAll(selector)]
      .filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0)
      .map(element => ({
        base: styleSnapshot(element),
        before: styleSnapshot(element, '::before'),
        after: styleSnapshot(element, '::after')
      }));
    const geometry = selector => [...document.querySelectorAll(selector)]
      .filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0)
      .map(element => {
        const rect = element.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        const textRect = range.getBoundingClientRect();
        return {
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          textRect: { left: textRect.left, top: textRect.top, right: textRect.right, bottom: textRect.bottom },
          textLines: range.getClientRects().length,
          center: {
            x: Math.abs((textRect.left + textRect.right) / 2 - (rect.left + rect.right) / 2),
            y: Math.abs((textRect.top + textRect.bottom) / 2 - (rect.top + rect.bottom) / 2)
          }
        };
      });
    return {
      accent: getComputedStyle(document.body).getPropertyValue('--apple-accent').trim(),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      styles: Object.fromEntries(Object.entries(styleSelectors).map(([name, selector]) => [name, styles(selector)])),
      geometry: Object.fromEntries(Object.entries(geometrySelectors).map(([name, selector]) => [name, geometry(selector)]))
    };
  }, selectors);
}

async function collectAppleComponentInspection(page) {
  return page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      const bounds = element?.getBoundingClientRect();
      return bounds ? { width: bounds.width, height: bounds.height } : null;
    };
    const style = (selector, pseudo = null) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const computed = getComputedStyle(element, pseudo);
      return {
        backgroundColor: computed.backgroundColor,
        borderRadius: computed.borderRadius,
        boxShadow: computed.boxShadow,
        outlineColor: computed.outlineColor,
        outlineStyle: computed.outlineStyle,
        outlineWidth: computed.outlineWidth,
        content: computed.content,
        display: computed.display,
        opacity: computed.opacity,
        color: computed.color,
        cursor: computed.cursor,
        pointerEvents: computed.pointerEvents
      };
    };

    const probeHost = document.createElement('div');
    probeHost.id = 'apple-element-probes';
    probeHost.style.cssText = 'position:fixed;left:-1000px;top:0;display:flex;gap:8px;';
    for (const element of ['wood', 'fire', 'earth', 'metal', 'water']) {
      const block = document.createElement('div');
      block.className = `pillar-block el-${element}`;
      block.innerHTML = '<span class="han">漢</span>';
      probeHost.appendChild(block);
    }
    document.body.appendChild(probeHost);

    const input = document.querySelector('.input');
    input?.focus();
    const focusedInput = style('.input');
    const primary = document.querySelector('.primary-btn');
    const enabledPrimary = style('.primary-btn');
    primary.disabled = true;
    const disabledPrimary = style('.primary-btn');
    primary.disabled = false;
    const elementColors = Object.fromEntries(
      ['wood', 'fire', 'earth', 'metal', 'water'].map(element => [
        element,
        {
          surface: style(`#apple-element-probes .el-${element}`).backgroundColor,
          foreground: style(`#apple-element-probes .el-${element} .han`).color
        }
      ])
    );
    const canvasColor = getComputedStyle(document.body).backgroundColor;
    probeHost.remove();

    return {
      geometry: {
        input: rect('.input'),
        primary: rect('.primary-btn'),
        segmented: rect('.segmented'),
        tabs: [...document.querySelectorAll('.tab')]
          .filter(element => element.getBoundingClientRect().width > 0)
          .map(element => ({
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height
          })),
        iconButtons: [...document.querySelectorAll('.icon-btn')]
          .filter(element => element.getBoundingClientRect().width > 0)
          .map(element => ({
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height
          })),
        segmentedButtons: [...document.querySelectorAll('.segmented button')]
          .filter(element => element.getBoundingClientRect().width > 0)
          .map(element => ({
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height
          }))
      },
      radii: {
        input: style('.input').borderRadius,
        segmented: style('.segmented').borderRadius,
        card: style('.input-card').borderRadius
      },
      primaryAfter: style('.primary-btn', '::after'),
      enabledPrimary,
      disabledPrimary,
      focusedInput,
      elementColors,
      canvasColor
    };
  });
}

async function collectHanjaGeometry(page) {
  return page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== 'none' && style.visibility !== 'hidden';
    };
    const measure = (selector, glyphSelector = '.han') =>
      [...document.querySelectorAll(selector)].filter(visible).map(element => {
        const rect = element.getBoundingClientRect();
        const glyph = element.querySelector(glyphSelector);
        const range = document.createRange();
        if (glyph) range.selectNodeContents(glyph);
        const glyphRect = glyph ? range.getBoundingClientRect() : null;
        const inline = element.style;
        const glyphInline = glyph?.style;
        return {
          rect: {
            left: rect.left, top: rect.top,
            width: rect.width, height: rect.height
          },
          center: glyphRect ? {
            x: Math.abs((glyphRect.left + glyphRect.right) / 2 - (rect.left + rect.right) / 2),
            y: Math.abs((glyphRect.top + glyphRect.bottom) / 2 - (rect.top + rect.bottom) / 2),
            signedY: (glyphRect.top + glyphRect.bottom) / 2 - (rect.top + rect.bottom) / 2
          } : null,
          transform: glyph ? getComputedStyle(glyph).transform : 'none',
          inlineHack: Boolean(
            inline.top || inline.marginTop || inline.transform ||
            glyphInline?.top || glyphInline?.marginTop || glyphInline?.transform
          )
        };
      });

    return {
      pillars: measure('.pillar-block'),
      daeun: measure('#daeunScroll .luck-block'),
      seun: measure('#seunScroll .luck-block'),
      wolun: measure('#woonScroll .luck-block'),
      ilun: measure('#dayArea .day-item:not(.empty)', '.d-han')
    };
  });
}

async function collectLuckFlowReachability(page) {
  return page.evaluate(() => {
    const specs = {
      daeun: ['#daeunScroll', '.luck-item'],
      seun: ['#seunScroll', '.luck-item'],
      wolun: ['#woonScroll', '.luck-item'],
      ilun: ['#dayArea .day-grid', '.day-item']
    };
    const tolerance = 1;
    const bounds = element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    };

    return Object.fromEntries(Object.entries(specs).map(([name, [containerSelector, itemSelector]]) => {
      const container = document.querySelector(containerSelector);
      const items = container ? [...container.querySelectorAll(itemSelector)] : [];
      if (!container || items.length === 0) return [name, null];
      const containerRect = bounds(container);
      const first = items[0];
      const last = items.at(-1);
      const initialFirst = bounds(first);
      const initialLast = bounds(last);
      const initialScrollLeft = container.scrollLeft;
      const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
      container.scrollLeft = maxScrollLeft;
      const endFirst = bounds(first);
      const endLast = bounds(last);
      const reachedEnd = Math.abs(container.scrollLeft - maxScrollLeft) <= tolerance;
      container.scrollLeft = initialScrollLeft;
      const itemWidths = items.map(item => item.getBoundingClientRect().width);
      return [name, {
        clientWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
        itemCount: items.length,
        minItemWidth: Math.min(...itemWidths),
        initialFirst,
        initialLast,
        endFirst,
        endLast,
        containerRect,
        maxScrollLeft,
        reachedEnd
      }];
    }));
  });
}

async function inspectAppleDesign(page, width) {
  const expectedAccents = { light: '#715234', dark: '#c5a76f' };
  const expectedAccentColors = {
    light: 'rgb(113, 82, 52)',
    dark: 'rgb(197, 167, 111)'
  };
  const expectedPastels = {
    light: {
      wood: ['rgb(216, 223, 212)', 'rgb(63, 98, 78)'],
      fire: ['rgb(228, 201, 191)', 'rgb(140, 69, 54)'],
      earth: ['rgb(223, 210, 174)', 'rgb(119, 96, 48)'],
      metal: ['rgb(216, 215, 210)', 'rgb(80, 86, 90)'],
      water: ['rgb(207, 215, 221)', 'rgb(64, 85, 105)']
    },
    dark: {
      wood: ['rgb(22, 49, 38)', 'rgb(121, 160, 135)'],
      fire: ['rgb(68, 37, 31)', 'rgb(201, 120, 100)'],
      earth: ['rgb(62, 52, 32)', 'rgb(197, 164, 93)'],
      metal: ['rgb(41, 47, 52)', 'rgb(184, 186, 183)'],
      water: ['rgb(32, 43, 54)', 'rgb(141, 160, 176)']
    }
  };
  const expectedRadii = {
    light: { input: '7px', segmented: '8px', card: '8px 8px 22px 22px' },
    dark: { input: '7px', segmented: '8px', card: '18px' }
  };
  const legacyGold = /#(?:d8b56a|f0d69a|a97732)\b|rgba?\(\s*(?:216\s*,\s*181\s*,\s*106|240\s*,\s*214\s*,\s*154|169\s*,\s*119\s*,\s*50)\b/i;
  const inputSelectors = {
    styleSelectors: {
      topBar: '.top-bar',
      activeTab: '.tab.active',
      primaryButton: '.primary-btn',
      formFields: '.input'
    },
    geometrySelectors: {
      segmentedButtons: '.segmented button',
      tabs: '.tab',
      primaryButtons: '.primary-btn'
    }
  };
  const resultSelectors = {
    styleSelectors: {
      pillarBlocks: '.pillar-block',
      luckBlocks: '.luck-block'
    },
    geometrySelectors: {
      pillarBlocks: '.pillar-block',
      luckBlocks: '.luck-block'
    }
  };

  for (const [theme, accent] of Object.entries(expectedAccents)) {
    await page.evaluate(isDark => document.body.classList.toggle('dark', isDark), theme === 'dark');
    await page.click('.tab[data-tab="input"]');
    await page.waitForFunction(() => document.querySelector('#view-input')?.classList.contains('active'));
    await sleep(250);
    const inputInspection = await collectAppleInspection(page, inputSelectors);
    const componentInspection = await collectAppleComponentInspection(page);

    await fillAndCalculate(page);
    await page.evaluate(() => {
      document.querySelector('#daeunScroll .luck-item')?.click();
      document.querySelector('#seunScroll .luck-item')?.click();
      document.querySelector('#woonScroll .luck-item')?.click();
    });
    await sleep(250);
    const resultInspection = await collectAppleInspection(page, resultSelectors);
    const hanjaGeometry = await collectHanjaGeometry(page);
    const flowReachability = await collectLuckFlowReachability(page);
    const inspection = {
      accent: inputInspection.accent,
      overflow: Math.max(inputInspection.overflow, resultInspection.overflow),
      styles: { ...inputInspection.styles, ...resultInspection.styles },
      geometry: { ...inputInspection.geometry, ...resultInspection.geometry }
    };

    assert.equal(inspection.accent, accent, `${width}px ${theme} --apple-accent`);
    assert.ok(inspection.overflow <= 1, `${width}px ${theme} horizontal overflow: ${inspection.overflow}px`);
    assert.ok(Math.abs(componentInspection.geometry.input.height - 52) <= 1, `${width}px ${theme} input height must be 52px`);
    assert.ok(Math.abs(componentInspection.geometry.primary.height - 54) <= 1, `${width}px ${theme} primary button height must be 54px`);
    assert.ok(componentInspection.geometry.primary.height >= 44, `${width}px ${theme} primary target is below 44px`);
    assert.ok(componentInspection.geometry.tabs.length > 0, `${width}px ${theme} tab target collection is empty`);
    for (const { width: targetWidth, height } of componentInspection.geometry.tabs) {
      assert.ok(targetWidth >= 44 && height >= 44, `${width}px ${theme} tab target is below 44px: ${targetWidth}x${height}px`);
    }
    assert.ok(componentInspection.geometry.iconButtons.length > 0, `${width}px ${theme} icon target collection is empty`);
    for (const { width: targetWidth, height } of componentInspection.geometry.iconButtons) {
      assert.ok(targetWidth >= 44 && height >= 44, `${width}px ${theme} icon target is below 44px: ${targetWidth}x${height}px`);
    }
    assert.ok(componentInspection.geometry.segmentedButtons.length > 0, `${width}px ${theme} segmented target collection is empty`);
    for (const { width: targetWidth, height } of componentInspection.geometry.segmentedButtons) {
      assert.ok(targetWidth >= 44 && height >= 44, `${width}px ${theme} segmented target is below 44px: ${targetWidth}x${height}px`);
    }
    assert.deepEqual(
      componentInspection.radii,
      expectedRadii[theme],
      `${width}px ${theme} Priestess component radii`
    );
    assert.equal(componentInspection.primaryAfter.content, 'none', `${width}px ${theme} primary button must not render decorative pseudo-content`);
    const focusOutline = parseCssColor(componentInspection.focusedInput.outlineColor);
    assert.notEqual(componentInspection.focusedInput.outlineStyle, 'none', `${width}px ${theme} focused input outline style`);
    assert.ok(parseFloat(componentInspection.focusedInput.outlineWidth) > 0, `${width}px ${theme} focused input outline width`);
    assert.ok(focusOutline.a > 0, `${width}px ${theme} focused input outline must be visible`);
    assertCssColorClose(
      componentInspection.focusedInput.outlineColor,
      expectedAccentColors[theme],
      `${width}px ${theme} focused input outline must use the Priestess accent`
    );
    assert.ok(
      componentInspection.disabledPrimary.pointerEvents === 'none' &&
      componentInspection.disabledPrimary.cursor === 'not-allowed',
      `${width}px ${theme} disabled primary must block pointer interaction`
    );
    assert.ok(
      Number(componentInspection.disabledPrimary.opacity) < Number(componentInspection.enabledPrimary.opacity) ||
      componentInspection.disabledPrimary.backgroundColor !== componentInspection.enabledPrimary.backgroundColor ||
      componentInspection.disabledPrimary.color !== componentInspection.enabledPrimary.color,
      `${width}px ${theme} disabled primary is not visually distinguishable`
    );
    for (const [element, [surface, foreground]] of Object.entries(expectedPastels[theme])) {
      const actual = componentInspection.elementColors[element];
      assert.deepEqual([actual.surface, actual.foreground], [surface, foreground], `${width}px ${theme} ${element} pastel pair`);
      assert.ok(
        contrastRatio(actual.foreground, actual.surface, componentInspection.canvasColor) >= 3,
        `${width}px ${theme} ${element} Hanja contrast is below 3:1`
      );
    }
    for (const [surface, elements] of Object.entries(inspection.styles)) {
      assert.ok(elements.length > 0, `${width}px ${theme} ${surface} missing`);
      for (const element of elements) {
        for (const [part, snapshot] of Object.entries(element)) {
          if (part !== 'base' && !snapshot.rendered) continue;
          for (const [property, value] of Object.entries(snapshot.values)) {
            assert.ok(!legacyGold.test(value), `${width}px ${theme} ${surface} ${part} ${property} retains legacy gold: ${value}`);
          }
        }
      }
    }

    const activeTab = inspection.styles.activeTab[0];
    const expectedColor = expectedAccentColors[theme];
    assert.equal(activeTab.base.values.color, expectedColor, `${width}px ${theme} active tab text color`);
    assert.equal(parseCssColor(activeTab.base.values.backgroundColor).a, 0, `${width}px ${theme} active tab must use the Priestess transparent surface`);
    assert.match(
      activeTab.base.values.boxShadow,
      /inset/,
      `${width}px ${theme} active tab must keep its inset underline`
    );
    assert.ok(
      activeTab.base.values.boxShadow.includes(expectedColor),
      `${width}px ${theme} active tab underline must use the theme accent`
    );

    for (const [group, blocks] of Object.entries({
      pillarBlocks: inspection.geometry.pillarBlocks,
      luckBlocks: inspection.geometry.luckBlocks
    })) {
      assert.ok(blocks.length > 0, `${width}px ${theme} ${group} missing`);
      for (const { rect } of blocks) {
        assert.ok(Math.abs(rect.width - rect.height) <= 1, `${width}px ${theme} ${group} not square: ${rect.width}x${rect.height}`);
      }
    }

    for (const [group, elements] of Object.entries(inspection.geometry)) {
      assert.ok(elements.length > 0, `${width}px ${theme} ${group} missing`);
      const rows = [];
      for (const element of elements) {
        const row = rows.find(candidate => Math.abs(candidate.top - element.rect.top) <= 1);
        (row || rows[rows.push({ top: element.rect.top, heights: [] }) - 1]).heights.push(element.rect.height);
        if (element.textLines === 1) {
          assert.ok(element.center.x <= 2 && element.center.y <= 2, `${width}px ${theme} ${group} label is off-center: ${element.center.x}x${element.center.y}`);
        }
      }
      for (const row of rows) {
        const [first, ...rest] = row.heights;
        for (const height of rest) {
          assert.ok(Math.abs(height - first) <= 1, `${width}px ${theme} ${group} same-row heights differ: ${first}px vs ${height}px`);
        }
      }
    }

    for (const [group, blocks] of Object.entries(hanjaGeometry)) {
      assert.ok(blocks.length > 0, `${width}px ${theme} ${group} geometry missing`);
      const transforms = new Set();
      const rows = [];
      for (const block of blocks) {
        assert.ok(
          Math.abs(block.rect.width - block.rect.height) <= 1,
          `${width}px ${theme} ${group} block not square: ${block.rect.width}x${block.rect.height}`
        );
        assert.ok(!block.inlineHack, `${width}px ${theme} ${group} uses an inline alignment correction`);
        if (block.center) {
          const verticallyAligned = group === 'pillars'
            ? block.center.signedY >= -4 && block.center.signedY <= -2.5
            : block.center.y <= 2;
          assert.ok(
            block.center.x <= 2 && verticallyAligned,
            `${width}px ${theme} ${group} Hanja is off-center: ${block.center.x}x${block.center.y} (signedY ${block.center.signedY})`
          );
        }
        if (group !== 'ilun') transforms.add(block.transform);
        const row = rows.find(candidate => Math.abs(candidate.top - block.rect.top) <= 1);
        (row || rows[rows.push({ top: block.rect.top, heights: [] }) - 1]).heights.push(block.rect.height);
      }
      for (const row of rows) {
        assert.ok(
          Math.max(...row.heights) - Math.min(...row.heights) <= 1,
          `${width}px ${theme} ${group} row heights differ: ${row.heights.join(', ')}`
        );
      }
      if (group !== 'ilun') {
        assert.equal(transforms.size, 1, `${width}px ${theme} ${group} uses differing CJK transforms: ${[...transforms]}`);
      }
    }

    for (const [group, flow] of Object.entries(flowReachability)) {
      assert.ok(flow, `${width}px ${theme} ${group} flow container missing`);
      const hasOverflow = flow.scrollWidth - flow.clientWidth > 1;
      assert.ok(
        flow.initialFirst.left >= flow.containerRect.left - 1 &&
        flow.initialFirst.right <= flow.containerRect.right + 1,
        `${width}px ${theme} ${group} first item is clipped initially`
      );
      if (!hasOverflow) {
        assert.ok(
          flow.initialLast.left >= flow.containerRect.left - 1 &&
          flow.initialLast.right <= flow.containerRect.right + 1,
          `${width}px ${theme} ${group} last item is clipped without overflow`
        );
      } else {
        assert.ok(
          flow.minItemWidth >= 43.5,
          `${width}px ${theme} ${group} scroll item is below the 44px touch width: ${flow.minItemWidth}px`
        );
        assert.ok(flow.reachedEnd, `${width}px ${theme} ${group} cannot reach its maximum scroll position`);
        assert.ok(
          flow.endLast.left >= flow.containerRect.left - 1 &&
          flow.endLast.right <= flow.containerRect.right + 1,
          `${width}px ${theme} ${group} last item is inaccessible at scroll end`
        );
      }
    }
  }
}

async function inspectAppleSecondaryScreens(page, width) {
  if (!runsSecondaryApple()) return;

  const legacyGold = /rgb(?:a)?\(\s*(?:216\s*,\s*181\s*,\s*106|240\s*,\s*214\s*,\s*154|169\s*,\s*119\s*,\s*50)(?:\s*,[^)]*)?\)/i;
  const themes = ['light', 'dark'];
  for (const theme of themes) {
    const state = await page.evaluate(async ({ theme, width }) => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      const waitForAnimations = async element => {
        const animations = element.getAnimations({ subtree: true });
        await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
        await wait(0);
      };
      document.body.classList.toggle('dark', theme === 'dark');
      await wait(300);

      const css = element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          background: style.backgroundColor,
          color: style.color,
          borderTop: style.borderTopColor,
          outlineColor: style.outlineColor,
          boxShadow: style.boxShadow,
          animationName: style.animationName,
          iterationCount: style.animationIterationCount,
          transitionProperty: style.transitionProperty,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          bottom: rect.bottom
        };
      };

      document.querySelector('.tab[data-tab="calendar"]').click();
      await wait(180);
      const calendarCell = document.querySelector('.cal-day.clickable');
      calendarCell.click();
      const calendarSelected = css(document.querySelector('.cal-day.selected'));
      const calendarToday = document.querySelector('.cal-day.today') ? css(document.querySelector('.cal-day.today')) : null;
      const calendarDecorations = [...document.querySelectorAll('.cal-day')].map(css);
      const calendarControl = css(document.getElementById('calNext'));

      document.querySelector('.tab[data-tab="saved"]').click();
      const savedId = `task5-${theme}`;
      await window.storage.set(`saju:${savedId}`, JSON.stringify({
        ...currentSaju,
        id: savedId,
        name: `실제저장-${theme}`,
        memo: 'Task 5 QA',
        fav: true,
        savedAt: Date.now()
      }));
      await renderSaved();
      await wait(180);
      const savedCardElement = document.querySelector(`.saved-card[data-id="${savedId}"]`);
      const savedCard = css(savedCardElement);
      const savedControl = css(savedCardElement.querySelector('button'));
      const savedContent = savedCardElement.textContent;

      document.querySelector('.tab[data-tab="fortune"]').click();
      await wait(180);
      renderFortune();
      await wait(60);
      const fortuneReportElement = document.querySelector('#fortuneContent .unified-reading');
      if (!fortuneReportElement) {
        throw new Error(`Annual report missing after renderFortune: ${document.querySelector('#fortuneContent')?.textContent?.trim().slice(0, 320) || 'empty fortune content'}`);
      }
      const fortuneReport = css(fortuneReportElement);
      const fortuneReportCount = document.querySelectorAll('#fortuneContent .unified-reading').length;

      const modalStates = [];
      for (const modal of document.querySelectorAll('.modal-bg')) {
        window.openAppModal(modal);
        await waitForAnimations(modal);
        const panel = modal.querySelector('.modal');
        const grabber = getComputedStyle(panel, '::before');
        const controls = [...panel.querySelectorAll('button')].filter(button => button.getClientRects().length).map(css);
        modalStates.push({
          id: modal.id,
          backdrop: css(modal),
          panel: css(panel),
          grabber: {
            content: grabber.content,
            width: parseFloat(grabber.width),
            height: parseFloat(grabber.height)
          },
          controls,
          focusedInside: modal.contains(document.activeElement)
        });
        window.closeAppModal(modal);
        await waitForAnimations(modal);
      }

      window.shareCard(window.currentSaju || currentSaju);
      await wait(40);
      const share = document.getElementById('shareCardModal');
      const shareImage = share.querySelector('.share-card-preview');
      await shareImage.decode();
      const pixelCanvas = document.createElement('canvas');
      pixelCanvas.width = shareImage.naturalWidth;
      pixelCanvas.height = shareImage.naturalHeight;
      const pixelContext = pixelCanvas.getContext('2d', { willReadFrequently: true });
      pixelContext.drawImage(shareImage, 0, 0);
      const corner = [...pixelContext.getImageData(4, 4, 1, 1).data];
      let darkSamples = 0;
      let legacyGoldSamples = 0;
      let samples = 0;
      const legacy = [[216, 181, 106], [240, 214, 154], [169, 119, 50]];
      for (let y = 4; y < pixelCanvas.height; y += 24) {
        for (let x = 4; x < pixelCanvas.width; x += 24) {
          const data = pixelContext.getImageData(x, y, 1, 1).data;
          samples++;
          if ((data[0] + data[1] + data[2]) / 3 < 45) darkSamples++;
          if (legacy.some(rgb => Math.hypot(data[0] - rgb[0], data[1] - rgb[1], data[2] - rgb[2]) < 12)) {
            legacyGoldSamples++;
          }
        }
      }
      window.__task5Share = null;
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: async payload => {
          window.__task5Share = {
            text: payload.text,
            filename: payload.files && payload.files[0] && payload.files[0].name
          };
        }
      });
      const shareButtons = [...share.querySelectorAll('button')].map(css);
      const sharePanel = share.querySelector('.share-card-sheet');
      const shareState = {
        shell: css(share),
        hasPanel: !!sharePanel,
        panel: sharePanel ? css(sharePanel) : null,
        buttons: shareButtons,
        focusedInside: share.contains(document.activeElement)
      };
      document.getElementById('shareCardDo').click();
      await wait(80);
      shareState.image = {
        width: pixelCanvas.width,
        height: pixelCanvas.height,
        corner,
        darkSamples,
        legacyGoldSamples,
        samples
      };
      shareState.payload = window.__task5Share;
      window.closeShareCardModal();

      const activeView = document.querySelector('.view.active');
      const surfaceProbe = document.createElement('div');
      surfaceProbe.style.backgroundColor = 'var(--apple-surface)';
      document.body.appendChild(surfaceProbe);
      const result = {
        surface: getComputedStyle(surfaceProbe).backgroundColor,
        accent: getComputedStyle(document.documentElement).getPropertyValue('--apple-accent').trim(),
        calendarSelected,
        calendarToday,
        calendarDecorations,
        calendarControl,
        savedCard,
        savedControl,
        savedContent,
        fortuneReport,
        fortuneReportCount,
        modalStates,
        shareState,
        activeView: css(activeView),
        viewportHeight: window.innerHeight,
        width
      };
      await window.storage.delete(`saju:${savedId}`);
      surfaceProbe.remove();
      return result;
    }, { theme, width });

    const priestessSurface = theme === 'dark'
      ? 'rgba(17, 24, 30, .95)'
      : 'rgba(244, 236, 220, .94)';
    for (const [name, surface] of Object.entries({
      savedCard: state.savedCard
    })) {
      assertCssColorClose(surface.background, priestessSurface, `${width}px ${theme} ${name} Priestess surface`);
    }
    assert.equal(state.fortuneReport.boxShadow, 'none', `${width}px ${theme} continuous reading must not become a card`);
    assert.match(state.savedContent, new RegExp(`실제저장-${theme}`), `${width}px ${theme} actual saved record was not rendered`);
    assert.equal(state.fortuneReportCount, 1, `${width}px ${theme} unified fortune report was not rendered exactly once`);
    assertCssColorClose(
      state.calendarSelected.borderTop.toLowerCase(),
      theme === 'dark' ? 'rgb(197, 167, 111)' : 'rgb(113, 82, 52)',
      `${width}px ${theme} selected calendar day Priestess accent`
    );
    for (const value of [state.calendarSelected.outlineColor, state.calendarSelected.boxShadow]) {
      assert.ok(!legacyGold.test(value), `${width}px ${theme} selected calendar retains legacy gold: ${value}`);
    }
    if (state.calendarToday) {
      for (const value of [state.calendarToday.borderTop, state.calendarToday.outlineColor, state.calendarToday.boxShadow]) {
        assert.ok(!legacyGold.test(value), `${width}px ${theme} today calendar retains legacy gold: ${value}`);
      }
    }
    for (const cell of state.calendarDecorations) {
      for (const value of [cell.borderTop, cell.outlineColor, cell.boxShadow]) {
        assert.ok(!legacyGold.test(value), `${width}px ${theme} calendar cell retains legacy gold: ${value}`);
      }
      assert.equal(cell.boxShadow, 'none', `${width}px ${theme} calendar cells must not glow`);
    }
    for (const [name, control] of Object.entries({
      calendarNext: state.calendarControl,
      savedDelete: state.savedControl
    })) {
      assert.ok(control.width >= 43.5 && control.height >= 43.5, `${width}px ${theme} ${name} is below 44x44px: ${control.width}x${control.height}`);
    }
    for (const modal of state.modalStates) {
      assertCssColorClose(modal.panel.background, priestessSurface, `${width}px ${theme} ${modal.id} Priestess panel surface`);
      assert.ok(modal.focusedInside, `${width}px ${theme} ${modal.id} must receive focus`);
      assert.deepEqual(
        { width: modal.grabber.width, height: modal.grabber.height },
        { width: 36, height: 5 },
        `${width}px ${theme} ${modal.id} grabber`
      );
      for (const control of modal.controls) {
        assert.ok(control.width >= 43.5 && control.height >= 43.5, `${width}px ${theme} ${modal.id} control is below 44x44px`);
      }
      if (width < 768) {
        assert.ok(Math.abs(modal.panel.bottom - state.viewportHeight) <= 1, `${width}px ${theme} ${modal.id} must be a bottom sheet`);
      } else {
        const center = modal.panel.top + modal.panel.height / 2;
        assert.ok(Math.abs(center - state.viewportHeight / 2) <= 2, `${width}px ${theme} ${modal.id} must be centered`);
      }
    }
    assert.ok(state.shareState.hasPanel, `${width}px ${theme} share dialog must expose an Apple sheet`);
    assert.equal(state.shareState.panel.background, state.surface, `${width}px ${theme} share sheet surface`);
    assert.ok(state.shareState.focusedInside, `${width}px ${theme} share dialog must receive focus`);
    assert.deepEqual(state.shareState.image.corner, [242, 242, 247, 255], `${width}px ${theme} share PNG must use the Apple light canvas`);
    assert.ok(
      state.shareState.image.darkSamples / state.shareState.image.samples < 0.01,
      `${width}px ${theme} share PNG still contains a dark/cosmic field`
    );
    assert.equal(state.shareState.image.legacyGoldSamples, 0, `${width}px ${theme} share PNG retains legacy gold pixels`);
    assert.match(state.shareState.payload.filename, /잔상_만세력\.png$/, `${width}px ${theme} share filename branding`);
    assert.match(state.shareState.payload.text, /잔상 만세력/, `${width}px ${theme} share text branding`);
    for (const control of state.shareState.buttons) {
      assert.ok(control.width >= 43.5 && control.height >= 43.5, `${width}px ${theme} share control is below 44x44px`);
    }
    assert.equal(state.activeView.animationName, 'none', `${width}px ${theme} views must not auto-cascade`);
    assert.notEqual(state.activeView.iterationCount, 'infinite', `${width}px ${theme} views must not loop`);
    for (const [name, element] of Object.entries({
      calendarDay: state.calendarSelected,
      savedCard: state.savedCard
    })) {
      assert.notEqual(element.transitionProperty, 'all', `${width}px ${theme} ${name} must not animate all properties`);
    }
  }

  const transparencySession = await page.createCDPSession();
  try {
    await transparencySession.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }]
    });
    const reducedTransparency = await page.evaluate(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      document.body.classList.add('dark');
      const inspect = element => {
        const style = getComputedStyle(element);
        return {
          background: style.backgroundColor,
          backdropFilter: style.backdropFilter || style.webkitBackdropFilter
        };
      };
      const modal = document.getElementById('aboutModal');
      window.openAppModal(modal);
      await wait(40);
      const modalState = {
        backdrop: inspect(modal),
        sheet: inspect(modal.querySelector('.modal'))
      };
      window.closeAppModal(modal);
      await wait(230);
      window.shareCard(currentSaju);
      await wait(40);
      const share = document.getElementById('shareCardModal');
      const shareState = {
        backdrop: inspect(share),
        sheet: inspect(share.querySelector('.share-card-sheet'))
      };
      window.closeShareCardModal();
      return { modalState, shareState };
    });
    for (const [name, overlay] of Object.entries(reducedTransparency)) {
      const expectedSurface = name === 'shareState'
        ? 'rgb(17, 24, 30)'
        : 'rgba(17, 24, 30, .95)';
      assertCssColorClose(overlay.sheet.background, expectedSurface, `${name} reduced-transparency Priestess sheet surface`);
      assert.equal(overlay.sheet.backdropFilter, 'none', `${name} reduced-transparency sheet must remove blur`);
      assert.equal(overlay.backdrop.backdropFilter, 'none', `${name} reduced-transparency backdrop must remove blur`);
    }
  } finally {
    await transparencySession.send('Emulation.setEmulatedMedia', { features: [] }).catch(() => {});
    await transparencySession.detach().catch(() => {});
  }
}

async function inspectAppleMotion(page, width) {
  if (!runsAppleMotion()) return;
  const exitEase = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const motion = await page.evaluate(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const presentation = element => {
      const style = getComputedStyle(element);
      const matrix = style.transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(style.transform);
      return { opacity: Number(style.opacity), x: matrix.m41, y: matrix.m42 };
    };
    const firstFrame = animation => {
      const frame = animation?.effect?.getKeyframes()?.[0] || {};
      let x = 0;
      let y = 0;
      try {
        const matrix = !frame.transform || frame.transform === 'none'
          ? new DOMMatrixReadOnly()
          : new DOMMatrixReadOnly(frame.transform);
        x = matrix.m41;
        y = matrix.m42;
      } catch {
        const values = String(frame.transform || '').match(/translate\([^,]+,\s*(-?[\d.]+)px\)/);
        y = values ? Number(values[1]) : 0;
      }
      return { opacity: Number(frame.opacity), x, y };
    };

    window.showAppToast('first');
    await wait(60);
    const toast = document.getElementById('appToast');
    const toastBefore = presentation(toast);
    window.showAppToast('second');
    const toastEntry = toast.getAnimations().find(animation =>
      !(animation instanceof CSSTransition) &&
      animation.effect?.getTiming().easing === 'cubic-bezier(0.2, 0.7, 0.2, 1)'
    );
    const toastRestart = {
      before: toastBefore,
      first: firstFrame(toastEntry)
    };
    await wait(1820);
    const toastExitAnimation = toast.getAnimations().find(animation =>
      !(animation instanceof CSSTransition) &&
      animation.playState !== 'finished'
    );
    const toastExit = toastExitAnimation ? {
      easing: toastExitAnimation.effect.getTiming().easing,
      frames: toastExitAnimation.effect.getKeyframes()
    } : null;
    await wait(180);

    const modal = document.getElementById('aboutModal');
    window.openAppModal(modal);
    await wait(260);
    window.closeAppModal(modal);
    const modalPanel = modal.querySelector('.modal');
    const modalExit = {
      backdrop: modal.getAnimations()[0]?.effect?.getTiming().easing,
      sheet: modalPanel.getAnimations()[0]?.effect?.getTiming().easing
    };
    await wait(40);
    window.openAppModal(modal);
    await wait(260);
    window.closeAppModal(modal);
    await wait(260);

    window.shareCard(currentSaju);
    await wait(60);
    const share = document.getElementById('shareCardModal');
    const shareSheet = share.querySelector('.share-card-sheet');
    const shareOpenAnimations = {
      backdrop: share.getAnimations()[0]?.effect?.getTiming(),
      sheet: shareSheet.getAnimations()[0]?.effect?.getTiming()
    };
    window.closeShareCardModal();
    const existsDuringClose = !!document.getElementById('shareCardModal');
    const closingShare = document.getElementById('shareCardModal');
    const shareExit = closingShare ? {
      backdrop: closingShare.getAnimations()[0]?.effect?.getTiming().easing,
      sheet: closingShare.querySelector('.share-card-sheet').getAnimations()[0]?.effect?.getTiming().easing
    } : null;
    await wait(60);
    const closePresentation = closingShare ? {
      backdrop: presentation(closingShare),
      sheet: presentation(closingShare.querySelector('.share-card-sheet'))
    } : null;
    window.shareCard(currentSaju);
    const reopened = document.getElementById('shareCardModal');
    const reopenFirst = {
      backdrop: firstFrame(reopened?.getAnimations()[0]),
      sheet: firstFrame(reopened?.querySelector('.share-card-sheet')?.getAnimations()[0])
    };
    await wait(280);
    window.closeShareCardModal();
    await wait(280);
    const removedAfterClose = !document.getElementById('shareCardModal');

    const visibleTransitionAll = [...document.querySelectorAll('body *')]
      .filter(element => element.getClientRects().length)
      .filter(element => getComputedStyle(element).transitionProperty.split(',').map(value => value.trim()).includes('all'))
      .map(element => element.id || element.className || element.tagName);

    const hoverViolations = [];
    const inspectRules = (rules, finePointer) => {
      for (const rule of [...(rules || [])]) {
        if (rule instanceof CSSMediaRule) {
          const condition = rule.conditionText.replace(/\s+/g, '').toLowerCase();
          inspectRules(rule.cssRules, finePointer || (
            condition.includes('(hover:hover)') &&
            condition.includes('(pointer:fine)')
          ));
        } else if (rule instanceof CSSStyleRule && rule.selectorText?.includes(':hover') && !finePointer) {
          hoverViolations.push(rule.selectorText);
        } else if (rule.cssRules) {
          inspectRules(rule.cssRules, finePointer);
        }
      }
    };
    for (const sheet of [...document.styleSheets]) {
      try { inspectRules(sheet.cssRules, false); }
      catch (error) {
        if (error.name !== 'SecurityError') throw error;
      }
    }

    document.querySelector('.tab[data-tab="input"]').click();
    const pressTarget = document.getElementById('calcBtn');
    const beforePress = getComputedStyle(pressTarget);
    pressTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    const duringPress = getComputedStyle(pressTarget);
    const press = {
      beforeFilter: beforePress.filter,
      duringFilter: duringPress.filter,
      transitionProperty: duringPress.transitionProperty
    };
    pressTarget.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));

    return {
      toastRestart,
      toastExit,
      modalExit,
      shareOpenAnimations,
      existsDuringClose,
      shareExit,
      closePresentation,
      reopenFirst,
      removedAfterClose,
      visibleTransitionAll,
      hoverViolations,
      press
    };
  });

  assert.ok(Math.abs(motion.toastRestart.first.opacity - motion.toastRestart.before.opacity) <= 0.08, `${width}px toast re-entry opacity restarted: ${JSON.stringify(motion.toastRestart)}`);
  assert.ok(Math.abs(motion.toastRestart.first.y - motion.toastRestart.before.y) <= 2, `${width}px toast re-entry position restarted`);
  assert.equal(motion.toastExit.easing, exitEase, `${width}px toast exit easing`);
  assert.equal(motion.modalExit.backdrop, exitEase, `${width}px modal backdrop exit easing`);
  assert.equal(motion.modalExit.sheet, exitEase, `${width}px modal sheet exit easing`);
  assert.ok(motion.shareOpenAnimations.backdrop && motion.shareOpenAnimations.sheet, `${width}px share enter animations missing`);
  assert.equal(motion.existsDuringClose, true, `${width}px share overlay was removed before its exit animation`);
  assert.deepEqual(motion.shareExit, { backdrop: exitEase, sheet: exitEase }, `${width}px share exit easing`);
  assert.ok(Math.abs(motion.reopenFirst.backdrop.opacity - motion.closePresentation.backdrop.opacity) <= 0.08, `${width}px share backdrop reopen jumped`);
  assert.ok(Math.abs(motion.reopenFirst.sheet.y - motion.closePresentation.sheet.y) <= 12, `${width}px share sheet reopen jumped`);
  assert.equal(motion.removedAfterClose, true, `${width}px share overlay remained after exit animation`);
  assert.deepEqual(motion.visibleTransitionAll, [], `${width}px visible elements retain transition: all`);
  assert.deepEqual(motion.hoverViolations, [], `${width}px hover rules must be fine-pointer gated`);
  assert.equal(motion.press.duringFilter, 'none', `${width}px active feedback must not animate filter`);
  assert.ok(!motion.press.transitionProperty.split(',').map(value => value.trim()).includes('filter'), `${width}px press transition includes filter`);

  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const reduced = await page.evaluate(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    window.showAppToast('reduced');
    const toastFrames = document.getElementById('appToast').getAnimations()
      .find(animation => !(animation instanceof CSSTransition))?.effect?.getKeyframes() || [];
    const modal = document.getElementById('aboutModal');
    window.openAppModal(modal);
    const modalFrames = modal.querySelector('.modal').getAnimations()
      .find(animation => !(animation instanceof CSSTransition))?.effect?.getKeyframes() || [];
    await wait(130);
    window.closeAppModal(modal);
    await wait(140);
    window.shareCard(currentSaju);
    const shareFrames = document.querySelector('.share-card-sheet').getAnimations()
      .find(animation => !(animation instanceof CSSTransition))?.effect?.getKeyframes() || [];
    window.closeShareCardModal();
    await wait(140);
    const transforms = frames => frames.map(frame => frame.transform || 'none');
    return {
      toast: transforms(toastFrames),
      modal: transforms(modalFrames),
      share: transforms(shareFrames)
    };
  });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  for (const [name, transforms] of Object.entries(reduced)) {
    assert.ok(transforms.length >= 2, `${width}px reduced-motion ${name} frames missing`);
    assert.equal(new Set(transforms).size, 1, `${width}px reduced-motion ${name} must fade without displacement: ${JSON.stringify(transforms)}`);
  }
}

async function inspectWidth(browser, width) {
  console.log(`[ui] ${width}px: opening page`);
  const page = await browser.newPage();
  await page.setViewport({
    width,
    height: 900,
    deviceScaleFactor: 1,
    isMobile: width < 768,
    hasTouch: true
  });
  console.log(`[ui] ${width}px: navigating`);
  await page.goto(URL, { waitUntil: 'networkidle0' });
  console.log(`[ui] ${width}px: loaded`);
  await page.evaluate(() => document.body.classList.add('dark'));

  if (TEST_GROUP === 'frontend-quality') {
    await inspectFrontendQuality(page, width);
    await page.close();
    return;
  }

  if (TEST_GROUP === 'calendar-shell-width') {
    await inspectCalendarShellWidth(page, width);
    await page.close();
    return;
  }

  await inspectCalendarCurrentYear(page, width);
  if (TEST_GROUP === 'calendar-current-year') {
    await page.close();
    return;
  }

  await inspectUnifiedSurface(page, width);
  if (TEST_GROUP === 'unified-surface') {
    await page.close();
    return;
  }
  if (!TEST_GROUP && width === 390) {
    await page.reload({ waitUntil: 'networkidle0' });
    await page.evaluate(() => document.body.classList.add('dark'));
  }

  if (width === 390) {
    const modalContract = await page.evaluate(() => ({
      open: typeof window.openAppModal,
      close: typeof window.closeAppModal,
      closeTop: typeof window.closeTopAppModal
    }));
    assert.deepEqual(modalContract, {
      open: 'function',
      close: 'function',
      closeTop: 'function'
    });

    if (runsGroup('modal-continuity')) {
      const continuity = await page.evaluate(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const modal = document.getElementById('aboutModal');
        const panel = modal.querySelector('.modal');
        const presentation = element => {
          const style = getComputedStyle(element);
          const matrix = style.transform === 'none' ? new DOMMatrixReadOnly() : new DOMMatrixReadOnly(style.transform);
          return { opacity: Number(style.opacity), translateY: matrix.m42 };
        };

        window.openAppModal(modal);
        await wait(260);
        window.closeAppModal(modal);
        await wait(60);
        const beforeReopen = { backdrop: presentation(modal), panel: presentation(panel) };
        window.openAppModal(modal);
        const afterReopen = { backdrop: presentation(modal), panel: presentation(panel) };
        await wait(260);
        window.closeAppModal(modal);
        await wait(240);

        window.openAppModal(modal);
        const exactZeroBeforeClose = presentation(modal).opacity;
        window.closeAppModal(modal);
        const closeAnimation = modal.getAnimations().find(animation => animation.effect?.target === modal);
        const exactZeroCloseStart = Number(closeAnimation?.effect?.getKeyframes()?.[0]?.opacity);
        await wait(240);

        return {
          backdropOpacityJump: Math.abs(afterReopen.backdrop.opacity - beforeReopen.backdrop.opacity),
          panelOpacityJump: Math.abs(afterReopen.panel.opacity - beforeReopen.panel.opacity),
          panelTransformJump: Math.abs(afterReopen.panel.translateY - beforeReopen.panel.translateY),
          exactZeroBeforeClose,
          exactZeroCloseStart
        };
      });
      assert.ok(continuity.backdropOpacityJump <= 0.08, `modal backdrop opacity jumped by ${continuity.backdropOpacityJump}`);
      assert.ok(continuity.panelOpacityJump <= 0.08, `modal panel opacity jumped by ${continuity.panelOpacityJump}`);
      assert.ok(continuity.panelTransformJump <= 12, `modal panel transform jumped by ${continuity.panelTransformJump}px`);
      assert.ok(continuity.exactZeroBeforeClose <= 0.05, `immediate close did not start near zero: ${continuity.exactZeroBeforeClose}`);
      assert.ok(continuity.exactZeroCloseStart <= 0.05, `exact-zero opacity was rewritten to ${continuity.exactZeroCloseStart}`);
    }

    if (runsGroup('modal-ownership')) {
      const ownership = await page.evaluate(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const modal = document.getElementById('aboutModal');
        const exercise = async close => {
          window.openAppModal(modal);
          await wait(260);
          close();
          await wait(40);
          close();
          await Promise.resolve();
          await Promise.resolve();
          const afterReplacement = {
            active: modal.classList.contains('active'),
            closing: modal.classList.contains('is-closing')
          };
          await wait(80);
          const midReplacement = modal.classList.contains('active');
          await wait(180);
          return {
            afterReplacement,
            midReplacement,
            finalActive: modal.classList.contains('active'),
            finalClosing: modal.classList.contains('is-closing')
          };
        };

        return {
          direct: await exercise(() => window.closeAppModal(modal)),
          backEquivalent: await exercise(() => window.closeTopAppModal())
        };
      });
      const expectedOwnership = {
        afterReplacement: { active: true, closing: true },
        midReplacement: true,
        finalActive: false,
        finalClosing: false
      };
      assert.deepEqual(ownership.direct, expectedOwnership, 'a stale direct-close completion must not own modal teardown');
      assert.deepEqual(ownership.backEquivalent, expectedOwnership, 'repeated back-equivalent closes must not allow stale teardown');
    }

    if (runsGroup('modal-a11y')) {
      const semantics = await page.evaluate(() => {
        const inspect = id => {
          const modal = document.getElementById(id);
          const dialog = modal.querySelector('[role="dialog"]');
          const labelId = dialog?.getAttribute('aria-labelledby');
          return {
            role: dialog?.getAttribute('role') || null,
            ariaModal: dialog?.getAttribute('aria-modal') || null,
            name: dialog?.getAttribute('aria-label') || (labelId ? document.getElementById(labelId)?.textContent.trim() : null)
          };
        };
        return { about: inspect('aboutModal'), save: inspect('saveModal') };
      });

      await page.click('#aboutBtn');
      await sleep(30);
      const aboutEntry = await page.evaluate(() => ({
        activeId: document.activeElement?.id || '',
        inside: document.getElementById('aboutModal').contains(document.activeElement),
        appInert: document.querySelector('.app').inert,
        bottomBarInert: document.getElementById('bottomBar').inert
      }));
      await page.keyboard.press('Tab');
      const aboutTrappedId = await page.evaluate(() => document.activeElement?.id || '');
      await page.keyboard.press('Escape');
      await sleep(260);
      const aboutExit = await page.evaluate(() => ({
        active: document.getElementById('aboutModal').classList.contains('active'),
        restoredId: document.activeElement?.id || '',
        appInert: document.querySelector('.app').inert
      }));
      if (aboutExit.active) {
        await page.evaluate(() => window.closeAppModal(document.getElementById('aboutModal')));
        await sleep(240);
      }

      await page.evaluate(() => {
        document.getElementById('aboutBtn').focus();
        window.openAppModal(document.getElementById('saveModal'));
      });
      await sleep(30);
      const saveEntryId = await page.evaluate(() => document.activeElement?.id || '');
      await page.evaluate(() => document.getElementById('saveConfirm').focus());
      await page.keyboard.press('Tab');
      const saveForwardTrapId = await page.evaluate(() => document.activeElement?.id || '');
      await page.evaluate(() => document.getElementById('saveName').focus());
      await page.keyboard.down('Shift');
      await page.keyboard.press('Tab');
      await page.keyboard.up('Shift');
      const saveBackwardTrapId = await page.evaluate(() => document.activeElement?.id || '');
      await page.keyboard.press('Escape');
      await sleep(260);
      const saveExit = await page.evaluate(() => ({
        active: document.getElementById('saveModal').classList.contains('active'),
        restoredId: document.activeElement?.id || '',
        appInert: document.querySelector('.app').inert
      }));
      if (saveExit.active) {
        await page.evaluate(() => window.closeAppModal(document.getElementById('saveModal')));
        await sleep(240);
      }

      assert.deepEqual({ semantics, aboutEntry, aboutTrappedId, aboutExit, saveEntryId, saveForwardTrapId, saveBackwardTrapId, saveExit }, {
        semantics: {
          about: { role: 'dialog', ariaModal: 'true', name: '잔상 만세력' },
          save: { role: 'dialog', ariaModal: 'true', name: '명반 저장' }
        },
        aboutEntry: { activeId: 'aboutClose', inside: true, appInert: true, bottomBarInert: true },
        aboutTrappedId: 'aboutClose',
        aboutExit: { active: false, restoredId: 'aboutBtn', appInert: false },
        saveEntryId: 'saveName',
        saveForwardTrapId: 'saveName',
        saveBackwardTrapId: 'saveConfirm',
        saveExit: { active: false, restoredId: 'aboutBtn', appInert: false }
      });
    }

    if (runsGroup('theme-contrast')) {
      const themeColors = await page.evaluate(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const measure = () => {
          const label = document.querySelector('#view-input .field-label');
          const labelSurface = label.closest('.input-card');
          const day = document.querySelector('#calGrid .cal-day.clickable .d');
          const daySurface = day.closest('.cal-day');
          return {
            canvas: getComputedStyle(document.body).backgroundColor,
            label: {
              foreground: getComputedStyle(label).color,
              background: getComputedStyle(labelSurface).backgroundColor
            },
            day: {
              foreground: getComputedStyle(day).color,
              background: getComputedStyle(daySurface).backgroundColor
            }
          };
        };

        document.querySelector('.tab[data-tab="calendar"]').click();
        document.body.classList.remove('dark');
        await wait(350);
        const light = measure();
        document.body.classList.add('dark');
        await wait(350);
        const dark = measure();
        document.querySelector('.tab[data-tab="input"]').click();
        return { light, dark };
      });

      for (const [theme, colors] of Object.entries(themeColors)) {
        const labelContrast = contrastRatio(colors.label.foreground, colors.label.background, colors.canvas);
        const dayContrast = contrastRatio(colors.day.foreground, colors.day.background, colors.canvas);
        assert.ok(labelContrast >= 4.5, `${theme} form-label contrast is ${labelContrast.toFixed(2)}:1 (${colors.label.foreground} on ${colors.label.background})`);
        assert.ok(dayContrast >= 4.5, `${theme} calendar-day contrast is ${dayContrast.toFixed(2)}:1 (${colors.day.foreground} on ${colors.day.background})`);
      }
    }

    if (runsGroup('transparency-contrast')) {
      const session = await page.createCDPSession();
      let transparencyStyles = null;
      try {
        await session.send('Emulation.setEmulatedMedia', {
          features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }]
        });
        transparencyStyles = await page.evaluate(async () => {
          const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
          document.body.classList.add('dark');
          const toast = document.getElementById('appToast');
          const measure = () => {
            const style = getComputedStyle(toast);
            return {
              foreground: style.color,
              background: style.backgroundColor,
              canvas: getComputedStyle(document.body).backgroundColor,
              backdropFilter: style.backdropFilter || style.webkitBackdropFilter
            };
          };

          document.body.classList.remove('dark');
          await wait(300);
          const light = measure();
          document.body.classList.add('dark');
          await wait(300);
          const dark = measure();
          return {
            mediaMatches: window.matchMedia('(prefers-reduced-transparency: reduce)').matches,
            light,
            dark
          };
        });
      } finally {
        await session.send('Emulation.setEmulatedMedia', { features: [] }).catch(() => {});
        await session.detach().catch(() => {});
      }
      assert.equal(transparencyStyles.mediaMatches, true, 'reduced-transparency media emulation must match');
      for (const [theme, expectedBackground] of [
        ['light', 'rgb(244, 236, 220)'],
        ['dark', 'rgb(17, 24, 30)']
      ]) {
        const transparencyStyle = transparencyStyles[theme];
        const transparencyContrast = contrastRatio(
          transparencyStyle.foreground,
          transparencyStyle.background,
          transparencyStyle.canvas
        );
        assertCssColorClose(
          transparencyStyle.background,
          expectedBackground,
          `reduced-transparency ${theme} toast must use the solid Priestess surface`
        );
        assert.equal(parseCssColor(transparencyStyle.background).a, 1, `reduced-transparency ${theme} toast background must be solid`);
        assert.equal(transparencyStyle.backdropFilter, 'none', `reduced-transparency ${theme} toast must disable backdrop blur`);
        assert.ok(transparencyContrast >= 4.5, `reduced-transparency ${theme} toast contrast is ${transparencyContrast.toFixed(2)}:1`);
      }
    }

    if (TEST_GROUP === 'theme-contrast' || TEST_GROUP === 'transparency-contrast') {
      await page.close();
      return;
    }

    if (runsGroup('viewport-zoom')) {
      const viewport = await page.$eval('meta[name="viewport"]', element => element.content);
      assert.match(viewport, /(?:^|,)\s*width=device-width(?:,|$)/);
      assert.match(viewport, /(?:^|,)\s*initial-scale=1(?:\.0)?(?:,|$)/);
      assert.match(viewport, /(?:^|,)\s*viewport-fit=cover(?:,|$)/);
      assert.doesNotMatch(viewport, /user-scalable\s*=\s*no/i);
      assert.doesNotMatch(viewport, /maximum-scale\s*=/i);
      const session = await page.createCDPSession();
      await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
      await sleep(50);
      const zoom = await page.evaluate(() => ({
        scale: window.visualViewport?.scale || 1,
        layoutOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      }));
      await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
      await session.detach();
      assert.ok(zoom.scale >= 1.9, `viewport did not accept 200% zoom: ${zoom.scale}`);
      assert.ok(zoom.layoutOverflow <= 1, `layout viewport overflowed by ${zoom.layoutOverflow}px before pan/zoom`);
    }
    const modalAnimationNames = await page.evaluate(() => ({
      backdrop: getComputedStyle(document.getElementById('aboutModal')).animationName,
      panel: getComputedStyle(document.querySelector('#aboutModal .modal')).animationName
    }));
    assert.deepEqual(modalAnimationNames, {
      backdrop: 'none',
      panel: 'none'
    });

    const toastContract = await page.evaluate(() => ({
      fn: typeof window.showAppToast,
      role: document.getElementById('appToast')?.getAttribute('role'),
      live: document.getElementById('appToast')?.getAttribute('aria-live')
    }));
    assert.deepEqual(toastContract, {
      fn: 'function',
      role: 'status',
      live: 'polite'
    });

    const toastAnimation = await page.evaluate(() => {
      window.showAppToast('saved');
      const toast = document.getElementById('appToast');
      const animation = toast.getAnimations()[0];
      return {
        className: toast.className,
        text: toast.textContent,
        transforms: animation?.effect?.getKeyframes().map(frame => frame.transform) || []
      };
    });
    assert.match(toastAnimation.className, /\bshow\b/);
    assert.equal(toastAnimation.text, 'saved');
    assert.ok(
      toastAnimation.transforms.length > 0 &&
      toastAnimation.transforms.every(transform => transform.includes('-50%')),
      'toast animation must preserve horizontal centering'
    );

    const saveFeedback = await page.evaluate(async () => {
      const nativeAlert = window.alert;
      let alerts = 0;
      window.alert = () => { alerts++; };
      try {
        const before = new Set((await window.storage.list('saju:')).keys || []);
        document.getElementById('saveBtn').click();
        document.getElementById('saveConfirm').click();
        await new Promise(resolve => setTimeout(resolve, 100));
        const toast = document.getElementById('appToast');
        const after = await window.storage.list('saju:');
        await Promise.all((after.keys || [])
          .filter(key => !before.has(key))
          .map(key => window.storage.delete(key)));
        return { alerts, className: toast.className, text: toast.textContent };
      } finally {
        window.alert = nativeAlert;
      }
    });
    assert.equal(saveFeedback.alerts, 0, 'save feedback must not use a native alert');
    assert.match(saveFeedback.className, /\bshow\b/, 'save feedback must display the app toast');
    assert.equal(saveFeedback.text, '명반이 저장되었습니다');

    const calendarDirection = await page.evaluate(async () => {
      document.querySelector('.tab[data-tab="calendar"]').click();
      document.getElementById('calNext').click();
      await new Promise(resolve => setTimeout(resolve, 320));
      return document.getElementById('calGrid').dataset.motionDirection;
    });
    assert.equal(calendarDirection, 'next', 'calendar next transition must expose its direction');

    const calendarDirectRender = await page.evaluate(() => {
      const grid = document.getElementById('calGrid');
      const calendarAnimations = () => grid.getAnimations().filter(animation => animation.constructor.name !== 'CSSAnimation');
      const title = document.getElementById('calTitle').textContent;
      grid.querySelector('.cal-day.clickable').click();
      return {
        titleUnchanged: document.getElementById('calTitle').textContent === title,
        activeAnimations: calendarAnimations().length
      };
    });
    assert.equal(calendarDirectRender.titleUnchanged, true, 'date selection must not change the calendar month');
    assert.equal(calendarDirectRender.activeAnimations, 0, 'date selection must render without calendar month motion');

    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    const reducedCalendarMotion = await page.evaluate(() => {
      const grid = document.getElementById('calGrid');
      const calendarAnimations = () => grid.getAnimations().filter(animation => animation.constructor.name !== 'CSSAnimation');
      const before = document.getElementById('calTitle').textContent;
      document.getElementById('calNext').click();
      return {
        titleChanged: document.getElementById('calTitle').textContent !== before,
        direction: grid.dataset.motionDirection,
        activeAnimations: calendarAnimations().length
      };
    });
    await page.emulateMediaFeatures([]);
    assert.equal(reducedCalendarMotion.titleChanged, true, 'reduced-motion month changes must render immediately');
    assert.equal(reducedCalendarMotion.direction, 'next');
    assert.equal(reducedCalendarMotion.activeAnimations, 0, 'reduced-motion month changes must not animate');

    const calendarDurations = await page.evaluate(async () => {
      const grid = document.getElementById('calGrid');
      const calendarAnimations = () => grid.getAnimations().filter(animation => animation.constructor.name !== 'CSSAnimation');
      document.getElementById('calNext').click();
      const outgoing = calendarAnimations()[0]?.effect?.getTiming().duration;
      await new Promise(resolve => setTimeout(resolve, 120));
      const incoming = calendarAnimations()[0]?.effect?.getTiming().duration;
      return { outgoing, incoming };
    });
    assert.deepEqual(calendarDurations, { outgoing: 100, incoming: 140 }, 'calendar transition must use the 100ms/140ms timing budget');

    const calendarMotion = await page.evaluate(async () => {
      const grid = document.getElementById('calGrid');
      const calendarAnimations = () => grid.getAnimations().filter(animation => animation.constructor.name !== 'CSSAnimation');
      const titleMonth = () => {
        const match = document.getElementById('calTitle').textContent.match(/(\d+)년\s+(\d+)월/);
        return { year: Number(match[1]), month: Number(match[2]) };
      };
      const addMonths = ({ year, month }, delta) => {
        const date = new Date(year, month - 1 + delta, 1);
        return { year: date.getFullYear(), month: date.getMonth() + 1 };
      };

      const initial = titleMonth();
      document.getElementById('calNext').click();
      document.getElementById('calNext').click();
      const activeDuringRapidNext = calendarAnimations().length;
      await new Promise(resolve => setTimeout(resolve, 320));
      const afterRapidNext = titleMonth();
      const afterRapidNextDirection = grid.dataset.motionDirection;
      const activeAfterRapidNext = calendarAnimations().length;

      document.getElementById('calNext').click();
      document.getElementById('calPrev').click();
      const activeDuringOppositeDirections = calendarAnimations().length;
      await new Promise(resolve => setTimeout(resolve, 320));
      return {
        expectedAfterRapidNext: addMonths(initial, 2),
        afterRapidNext,
        afterRapidNextDirection,
        activeDuringRapidNext,
        activeAfterRapidNext,
        afterOppositeDirections: titleMonth(),
        afterOppositeDirectionsDirection: grid.dataset.motionDirection,
        activeDuringOppositeDirections,
        activeAfterOppositeDirections: calendarAnimations().length
      };
    });
    assert.ok(calendarMotion.activeDuringRapidNext > 0, 'calendar month changes must begin a WAAPI transition');
    assert.deepEqual(calendarMotion.afterRapidNext, calendarMotion.expectedAfterRapidNext, 'two rapid next clicks must advance two months');
    assert.equal(calendarMotion.afterRapidNextDirection, 'next');
    assert.equal(calendarMotion.activeAfterRapidNext, 0, 'rapid next clicks must leave no running calendar animation');
    assert.ok(calendarMotion.activeDuringOppositeDirections > 0, 'opposite-direction clicks must replace the active calendar transition');
    assert.deepEqual(calendarMotion.afterOppositeDirections, calendarMotion.expectedAfterRapidNext, 'next then previous must retain the correct final month');
    assert.equal(calendarMotion.afterOppositeDirectionsDirection, 'prev');
    assert.equal(calendarMotion.activeAfterOppositeDirections, 0, 'opposite-direction clicks must leave no running calendar animation');

    if (runsGroup('calendar-snapshot')) {
      const calendarSnapshot = await page.evaluate(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const titleMonth = () => {
          const match = document.getElementById('calTitle').textContent.match(/(\d+)년\s+(\d+)월/);
          return { year: Number(match[1]), month: Number(match[2]) };
        };
        const grid = document.getElementById('calGrid');
        const calendarAnimations = () => grid.getAnimations().filter(animation => animation.constructor.name !== 'CSSAnimation');
        const rendered = titleMonth();
        document.getElementById('calNext').click();
        await wait(30);
        const outgoingDay = grid.querySelector('.cal-day.clickable[data-day="15"]');
        const outgoingSnapshot = {
          year: Number(outgoingDay?.dataset.year),
          month: Number(outgoingDay?.dataset.month),
          day: Number(outgoingDay?.dataset.day)
        };
        outgoingDay?.click();
        const immediate = {
          title: titleMonth(),
          selected: {
            year: Number(grid.querySelector('.cal-day.selected')?.dataset.year),
            month: Number(grid.querySelector('.cal-day.selected')?.dataset.month),
            day: Number(grid.querySelector('.cal-day.selected')?.dataset.day)
          },
          detail: document.querySelector('#calDayDetail .ttl')?.textContent.trim() || '',
          activeAnimations: calendarAnimations().length
        };
        await wait(280);
        return {
          rendered,
          outgoingSnapshot,
          immediate,
          finalTitle: titleMonth(),
          finalActiveAnimations: calendarAnimations().length
        };
      });
      const expectedDate = { ...calendarSnapshot.rendered, day: 15 };
      assert.deepEqual(calendarSnapshot.outgoingSnapshot, expectedDate, 'outgoing cells must carry their rendered year/month snapshot');
      assert.deepEqual(calendarSnapshot.immediate.title, calendarSnapshot.rendered, 'outgoing-date selection must restore the visible month');
      assert.deepEqual(calendarSnapshot.immediate.selected, expectedDate, 'the visible outgoing date must remain selected in its rendered month');
      assert.match(calendarSnapshot.immediate.detail, new RegExp(`^${expectedDate.year}년 ${expectedDate.month}월 ${expectedDate.day}일`));
      assert.equal(calendarSnapshot.immediate.activeAnimations, 0, 'outgoing-date selection must cancel stale month motion immediately');
      assert.deepEqual(calendarSnapshot.finalTitle, calendarSnapshot.rendered, 'stale completion must not reinterpret the selected date in the next month');
      assert.equal(calendarSnapshot.finalActiveAnimations, 0);
    }

    if (runsGroup('exit-curves')) {
      const exitCurves = await page.evaluate(async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        window.showAppToast('exit curve probe');
        await wait(1820);
        const toastExit = document.getElementById('appToast').getAnimations()
          .find(animation => animation.effect?.getTiming().duration === 140);
        const toast = toastExit ? {
          duration: toastExit.effect.getTiming().duration,
          easing: toastExit.effect.getTiming().easing
        } : null;

        const grid = document.getElementById('calGrid');
        document.getElementById('calNext').click();
        const calendarExit = grid.getAnimations()
          .find(animation => animation.effect?.getTiming().duration === 100);
        const calendar = calendarExit ? {
          duration: calendarExit.effect.getTiming().duration,
          easing: calendarExit.effect.getTiming().easing
        } : null;
        await wait(260);
        return { toast, calendar };
      });
      for (const [name, timing] of Object.entries(exitCurves)) {
        assert.ok(timing, `${name} exit animation was not created`);
        assert.ok(timing.duration >= 100 && timing.duration <= 240, `${name} exit duration ${timing.duration}ms is outside the motion budget`);
        assert.match(timing.easing, /^cubic-bezier\(/, `${name} exit must use a deliberate custom curve, got ${timing.easing}`);
      }
    }

  }

  assert.equal(await page.$eval('link[href="luxury.css"]', () => true), true);
  const bg = await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--obsidian-bg').trim());
  assert.equal(bg, '#07080d');
  assert.equal(await page.$('.input-intro'), null, `${width}px oversized input intro must be removed`);
  assert.equal(await page.$('.manse-art'), null, `${width}px manseryeok hero art must be removed`);
  assert.equal(await page.$('.manse-calligraphy'), null, `${width}px hero calligraphy must be removed`);
  assert.equal(await page.$('.intro-logo-img'), null, `${width}px decorative Hanja logo must be removed`);
  const inputPolish = await page.evaluate(() => ({
    cardBorder: getComputedStyle(document.querySelector('.input-card')).borderTopColor,
    collapsedErrorBorder: getComputedStyle(document.getElementById('inErr')).borderTopColor
  }));
  assertCssColorClose(inputPolish.cardBorder, 'rgba(255, 255, 255, 0.08)', `${width}px input card border`);
  assert.equal(parseCssColor(inputPolish.collapsedErrorBorder).a, 0, `${width}px collapsed error line must be transparent`);

  if (runsShellWidth()) {
    await inspectShellWidth(page, width);
    await page.close();
    return;
  }

  if (runsFoldLayout()) {
    await inspectFoldLayout(page, width);
    await page.close();
    return;
  }

  await inspectLunarInput(page, width);
  if (TEST_GROUP === 'lunar-input') {
    await page.close();
    return;
  }

  await fillAndCalculate(page);

  await inspectDesktopActionRail(page, width);
  if (TEST_GROUP === 'desktop-action-rail') {
    await page.close();
    return;
  }

  await inspectLuckFlowOrder(page, width);
  if (TEST_GROUP === 'luck-flow-order') {
    await page.close();
    return;
  }

  await inspectLuckFlowAccessibility(page, width);
  if (TEST_GROUP === 'luck-flow-accessibility') {
    await page.close();
    return;
  }

  await inspectLuckFlowResponsive(page, width);
  if (TEST_GROUP === 'luck-flow-responsive') {
    await page.close();
    return;
  }

  await inspectUnifiedReading(page, width);
  if (TEST_GROUP === 'unified-reading') {
    await page.close();
    return;
  }

  await inspectAnnualYearReading(page, width);
  if (TEST_GROUP === 'annual-year-reading') {
    await page.close();
    return;
  }

  await inspectLongReading(page, width);
  if (TEST_GROUP === 'long-reading' || TEST_GROUP === 'reading-readability') {
    await page.close();
    return;
  }

  await inspectSamePillars60(page, width);
  if (TEST_GROUP === 'same-pillars-60') {
    await page.close();
    return;
  }

  if (TEST_GROUP === 'all-tab-shell-width') {
    await inspectAllTabShellWidths(page, width);
    await page.close();
    return;
  }

  if (runsResultWidthBrand()) {
    await inspectResultWidthAndBrand(page, width);
    await page.close();
    return;
  }

  if (runsImportedFieldXss()) {
    await inspectImportedFieldDownstreamSafety(page, width);
    if (TEST_GROUP === 'imported-fields-xss') {
      await page.close();
      return;
    }
  }

  if (runsGroup('final-security')) {
    await inspectFinalSecurityRuntime(page, width);
    if (TEST_GROUP === 'final-security') {
      await page.close();
      return;
    }
  }

  const metrics = await page.evaluate(() => {
    const rects = selector => [...document.querySelectorAll(selector)].map(element => {
      const rect = element.getBoundingClientRect();
      return {
        w: rect.width,
        h: rect.height,
        font: parseFloat(getComputedStyle(element.querySelector('.han') || element).fontSize)
      };
    });

    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pillars: rects('.pillar-block'),
      daeun: rects('#daeunScroll .luck-block'),
      seun: rects('#seunScroll .luck-block')
    };
  });

  assert.ok(metrics.overflow <= 1, `${width}px horizontal overflow: ${metrics.overflow}px`);
  assert.equal(metrics.pillars.length, 8, `${width}px pillar count`);

  if (runsGroup('apple-design') || runsSecondaryApple() || runsAppleMotion()) {
    await inspectAppleDesign(page, width);
    await inspectAppleSecondaryScreens(page, width);
    await inspectAppleMotion(page, width);
    await page.close();
    return;
  }

  for (const [group, rects] of Object.entries({
    pillars: metrics.pillars,
    daeun: metrics.daeun,
    seun: metrics.seun
  })) {
    assert.ok(rects.length > 0, `${width}px ${group} missing`);
    rects.forEach(({ w, h }) => {
      assert.ok(Math.abs(w - h) <= 1, `${width}px ${group} not square: ${w}x${h}`);
    });
    const fonts = new Set(rects.map(({ font }) => font.toFixed(2)));
    assert.equal(fonts.size, 1, `${width}px ${group} font sizes differ: ${[...fonts]}`);
  }

  const resultPalette = await page.evaluate(() => ({
    selectedOutline: getComputedStyle(document.querySelector('#daeunScroll .luck-item.selected')).outlineColor,
    bottomBarBackground: getComputedStyle(document.getElementById('bottomBar')).backgroundColor
  }));
  assertCssColorClose(resultPalette.selectedOutline, 'rgb(197, 167, 111)', `${width}px selected luck outline Priestess dark accent`);
  assertCssColorClose(resultPalette.bottomBarBackground, 'rgba(8, 13, 17, 0.97)', `${width}px bottom bar Priestess dark surface`);

  await page.evaluate(() => document.querySelector('.tab[data-tab="fortune"]').click());
  await sleep(200);
  const fortunePalette = await page.evaluate(() => ({
    tag: getComputedStyle(document.querySelector('.fortune-head .year-tag')).backgroundColor,
    inset: getComputedStyle(document.querySelector('.f-text')).backgroundColor
  }));
  assert.equal(fortunePalette.tag, fortunePalette.inset, `${width}px fortune tag must use the grouped inset surface`);

  await page.evaluate(() => document.querySelector('.tab[data-tab="result"]').click());
  await sleep(150);

  await page.evaluate(() => window.shareCard(currentSaju));
  await sleep(150);
  const sharePreview = await page.evaluate(() => ({
    src: document.querySelector('#shareCardModal img')?.getAttribute('src') || '',
    buttonBackground: getComputedStyle(document.getElementById('shareCardDo')).backgroundImage,
    buttonColor: getComputedStyle(document.getElementById('shareCardDo')).backgroundColor
  }));
  assert.ok(sharePreview.src.startsWith('data:image/png'), `${width}px share preview missing`);
  assert.equal(sharePreview.buttonBackground, 'none', `${width}px share button must not use a metallic gradient`);
  assertCssColorClose(sharePreview.buttonColor, 'rgb(197, 167, 111)', `${width}px share button Priestess dark accent`);
  if (width === 390 && runsGroup('share-back')) {
    const overlayContract = await page.evaluate(() => ({
      closeShare: typeof window.closeShareCardModal,
      closeTopOverlay: typeof window.closeTopAppOverlay,
      handleBack: typeof window.handleAppBack
    }));
    assert.deepEqual(overlayContract, {
      closeShare: 'function',
      closeTopOverlay: 'function',
      handleBack: 'function'
    });
    const backResult = await page.evaluate(async () => {
      const tabBefore = document.querySelector('.tab.active')?.dataset.tab;
      const handled = window.handleAppBack();
      await new Promise(resolve => setTimeout(resolve, 280));
      return {
        handled,
        shareOpen: !!document.getElementById('shareCardModal'),
        tabBefore,
        tabAfter: document.querySelector('.tab.active')?.dataset.tab
      };
    });
    assert.deepEqual(backResult, {
      handled: true,
      shareOpen: false,
      tabBefore: 'result',
      tabAfter: 'result'
    }, 'Android/web back must dismiss the share overlay before changing tabs');

    const centralizedClose = await page.evaluate(async () => {
      window.shareCard(currentSaju);
      const handled = window.closeTopAppOverlay();
      await new Promise(resolve => setTimeout(resolve, 280));
      return { handled, shareOpen: !!document.getElementById('shareCardModal') };
    });
    assert.deepEqual(centralizedClose, { handled: true, shareOpen: false });
  } else {
    await page.evaluate(() => document.getElementById('shareCardModal')?.remove());
  }

  await page.evaluate(() => document.querySelector('.tab[data-tab="saved"]').click());
  await sleep(250);
  assert.equal(
    await page.$eval('[data-go-input]', element => element.textContent.trim()),
    '명반 만들러 가기'
  );

  await page.close();
}

(async () => {
  if (runsGroup('android-backup')) inspectAndroidBackupPolicy();
  if (runsGroup('android-cache-policy')) inspectAndroidCachePolicy();
  if (runsAndroidSafeArea()) inspectAndroidSafeAreaContract();
  if (runsResultHeaderCompact()) inspectResultHeaderCompactContract();
  if (TEST_GROUP === 'release-contract') inspectReleaseContract();
  if (process.env.SKIP_SOURCE_CONTRACTS !== '1' && runsGroup('final-security')) inspectFinalSecuritySourceContracts();
  if (TEST_GROUP === 'android-backup' || TEST_GROUP === 'android-cache-policy' || TEST_GROUP === 'android-safe-area' || TEST_GROUP === 'result-header-compact' || TEST_GROUP === 'release-contract') {
    console.log(`${TEST_GROUP} regression PASS`);
    return;
  }

  if (runsGroup('apple-design')) {
    const appleCss = fs.readFileSync(path.join(UI_ROOT, 'apple.css'), 'utf8');
    const priestessCss = fs.readFileSync(path.join(UI_ROOT, 'priestess.css'), 'utf8');
    const indexHtml = fs.readFileSync(path.join(UI_ROOT, 'index.html'), 'utf8');
    const webManifest = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, 'manifest.webmanifest'), 'utf8'));
    assert.match(appleCss, /--apple-accent:\s*#007aff/i);
    assert.match(appleCss, /body\.dark[\s\S]*--apple-accent:\s*#0a84ff/i);
    assert.doesNotMatch(appleCss, /#d8b56a|#f0d69a|#a97732/i);
    assert.match(priestessCss, /--apple-accent:\s*#715234/i);
    assert.match(priestessCss, /--priestess-gold-bright:\s*#c5a76f/i);
    assert.match(priestessCss, /body\.dark[\s\S]*--apple-accent:\s*var\(--priestess-gold-bright\)/i);
    assert.match(indexHtml, /<title>잔상 만세력<\/title>/, 'document title must use the current product name');
    assert.match(indexHtml, /<meta name="apple-mobile-web-app-title" content="잔상 만세력">/, 'Apple web app title must use the current product name');
    assert.deepEqual(
      { name: webManifest.name, shortName: webManifest.short_name },
      { name: '잔상 만세력', shortName: '잔상 만세력' },
      'PWA manifest names must use the current product name'
    );
  }

  const luxuryCss = fs.readFileSync(path.join(UI_ROOT, 'luxury.css'), 'utf8');
  assert.match(luxuryCss, /prefers-reduced-transparency:\s*reduce/);
  assert.match(luxuryCss, /prefers-contrast:\s*more/);

  const serviceWorker = fs.readFileSync(path.join(WEB_ROOT, 'sw.js'), 'utf8');
  if (runsGroup('service-worker')) {
    const runtimeIndex = fs.readFileSync(path.join(UI_ROOT, 'index.html'), 'utf8');
    assert.match(serviceWorker, /const APP_CACHE_PREFIX = 'jansang-manse-'/, 'the tombstone worker must target the historical app cache namespace');
    assert.doesNotMatch(serviceWorker, /\bPRECACHE\b|caches\.open|caches\.match|\.put\(/, 'the tombstone worker must not create or read runtime caches');
    assert.doesNotMatch(serviceWorker, /addEventListener\(['"]fetch['"]/, 'the tombstone worker must not intercept requests');
    if (process.env.SKIP_SOURCE_CONTRACTS !== '1') {
      assert.match(runtimeIndex, /const APP_CACHE_PREFIX = 'jansang-manse-'/, 'the page must retain the permanent cache cleanup policy');
      assert.match(runtimeIndex, /navigator\.serviceWorker\.getRegistrations\(\)/, 'the page must enumerate legacy worker registrations');
      assert.match(runtimeIndex, /registration\.unregister\(\)/, 'the page must unregister its legacy service worker');
      assert.match(runtimeIndex, /caches\.keys\(\)/, 'the page must enumerate legacy Cache Storage entries');
      assert.doesNotMatch(runtimeIndex, /navigator\.serviceWorker\.register\(/, 'the page must never register a new service worker');
    }
    assert.match(runtimeIndex, /http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate"/, 'the document must request no browser cache');
    assert.match(runtimeIndex, /http-equiv="Pragma" content="no-cache"/, 'the document must retain the legacy no-cache directive');
    assert.match(runtimeIndex, /href="apple\.css\?v=[a-z0-9.-]+"/i, 'the frequently updated Apple stylesheet must use a release cache-buster');
    await inspectServiceWorkerDisable(serviceWorker);
  }
  if (TEST_GROUP === 'service-worker') {
    console.log('Service-worker regression PASS');
    return;
  }
  console.log('[ui] launching Chrome');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: TEST_GROUP === 'all-tab-shell-width' ? [] : ['--hide-scrollbars']
  });
  console.log('[ui] Chrome launched');
  try {
    for (const width of widths) await inspectWidth(browser, width);
    console.log('UI regression PASS:', widths.join(', '));
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});

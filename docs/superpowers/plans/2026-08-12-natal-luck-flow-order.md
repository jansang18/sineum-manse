# Natal Luck Flow Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원국 탭의 표시 순서를 원국 → 대운 → 세운 → 월운 → 일운 → 1,000년 같은 기둥으로 바꾸고, 기존 계산을 보존하면서 모바일·키보드 선택성을 개선한다.

**Architecture:** <code>renderResult()</code>의 기존 운 흐름 블록을 원국 카드 직후로 이동하고, 기존 <code>renderSeun()</code>·<code>renderWoon()</code>·<code>renderDay()</code>의 점진적 표시 구조는 그대로 재사용한다. 선택 항목은 공통 버튼 렌더러와 상태 동기화 도우미를 사용한다. 560px 이하에서는 내부 가로 스크롤과 44px 최소 폭을 적용하고, 그보다 넓은 화면에서는 모든 열을 카드 폭 안에 맞춘다.

**Tech Stack:** 정적 HTML, CSS, vanilla JavaScript, Service Worker, Node.js <code>assert</code>, <code>puppeteer-core</code>, GitHub Pages

## Global Constraints

- 모든 명령은 저장소 루트 <code>C:\Users\whaak\Desktop\바탕화면\manse\app\web</code>에서 실행한다.
- 공개 사이트 소스인 <code>app/web</code>만 변경한다. Android <code>app/www</code>와 APK는 범위 밖이다.
- 표시 순서는 원국 → 대운 → 세운 → 월운 → 일운(월 선택 시) → 1,000년 같은 기둥이다.
- 세운 선택 전에는 월운·일운 DOM이나 빈 카드가 없고, 선택 후 같은 운 흐름 카드 안에서 펼쳐진다.
- 기존 사주·대운·세운·월운·일운 계산식, 저장 형식, 외부 API 호출은 변경하지 않는다.
- 기존 <code>priestess.css</code>/<code>apple.css</code>의 먹색 표면, 오행 색상, 명조계 한자와 라이트/다크 테마를 유지한다.
- 560px 이하에서 각 대운·세운·월운 선택 항목은 최소 44px 폭을 유지하고, 문서 전체가 아니라 흐름표 내부만 수평 스크롤한다.
- 선택 항목은 <code>button type="button"</code>과 <code>aria-pressed</code>를 사용하며 Tab, Enter, Space로 조작 가능해야 한다.
- 새 런타임 의존성을 추가하지 않는다.
- 설치형 PWA가 변경된 HTML/CSS를 갱신하도록 Service Worker 버전을 <code>v37-20260812-natal-luck-flow-order</code>로 올린다.

---

## File Map

- Modify: <code>index.html</code> — 결과 DOM 순서, 공통 운 버튼 렌더링, 선택 상태, 현재 항목 노출
- Modify: <code>apple.css</code> — 버튼 기본 스타일 초기화, 560px 이하 최소 폭과 내부 스크롤
- Modify: <code>tests/ui-regression.js</code> — 순서, 점진적 표시, 접근성, 반응형, 라이브 URL 계약
- Modify: <code>sw.js</code> — PWA 캐시 버전 갱신

### Task 1: Move the Existing Luck Flow Before the Millennium Card

**Files:**
- Modify: <code>tests/ui-regression.js:19-49, 1351-1367, 2988-3018</code>
- Modify: <code>index.html:13002-13050</code>
- Test: <code>tests/ui-regression.js</code>

**Interfaces:**
- Consumes: <code>renderResult()</code>, <code>renderSeun()</code>, <code>renderWoon()</code>, <code>renderDay()</code>, <code>#view-result</code>
- Produces: direct-child order <code>.oguk-card</code> → <code>.result-right</code> → <code>.same-pillars-card</code>; test group <code>luck-flow-order</code>; optional <code>TEST_URL</code> override

- [ ] **Step 1: Add the failing order and progressive-disclosure test**

At the URL declaration, permit the same test to run against the deployed site:

~~~javascript
const URL = process.env.TEST_URL || pathToFileURL(path.join(UI_ROOT, 'index.html')).href;
~~~

Add the focused width and group helper:

~~~javascript
const widths = TEST_GROUP === 'luck-flow-responsive'
  ? [390, 560, 561, 768, 1220]
  : TEST_GROUP === 'result-width-brand' || TEST_GROUP === 'shell-width'
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

const runsLuckFlowOrder = () => !TEST_GROUP || TEST_GROUP === 'luck-flow-order';

async function resetLuckFlow(page) {
  await page.evaluate(() => {
    selectedDaeun = null;
    selectedSeun = null;
    selectedWoon = null;
    renderResult();
  });
  await sleep(50);
}
~~~

Add this complete assertion helper after <code>fillAndCalculate()</code>:

~~~javascript
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
~~~

Immediately after <code>await fillAndCalculate(page)</code>, call it and support a focused return:

~~~javascript
await inspectLuckFlowOrder(page, width);
if (TEST_GROUP === 'luck-flow-order') {
  await page.close();
  return;
}
~~~

- [ ] **Step 2: Run the focused test and verify RED**

Run from <code>app/web</code>:

~~~powershell
$env:UI_ROOT='web'
$env:WEB_ROOT='web'
$env:TEST_GROUP='luck-flow-order'
node tests/ui-regression.js
~~~

Expected: FAIL at <code>natal/luck/millennium order</code> because the current direct-child indexes are <code>[0, 2, 1]</code>.

- [ ] **Step 3: Move the existing block without changing calculations**

In <code>renderResult()</code>, place the existing <code>.result-right</code> block immediately after <code>.oguk-card</code>, then render the millennium card:

~~~javascript
    </div>

    <div class="result-right">
      <div class="luck-section">
        <div class="luck-title">대운 흐름 <span class="meta">(대운수 ${s.daeun.num}, ${s.daeun.forward ? '순행' : '역행'})</span></div>
        <div class="luck-scroll" id="daeunScroll">
          ${s.daeun.list.slice().reverse().map((d, rIdx) => {
            const orig = s.daeun.list.length - 1 - rIdx;
            return renderLuckItem({
              idx: orig,
              label: d.isInitial ? '태생' : d.age + '세',
              stem: d.stem,
              branch: d.branch,
              ilgan
            });
          }).join('')}
        </div>
        <div id="seunArea"></div>
      </div>
    </div>

    ${renderSamePillars60(s, samePillarsReport)}
~~~

Remove the luck block from its former position so IDs remain unique.

- [ ] **Step 4: Run the focused test and verify GREEN**

~~~powershell
$env:UI_ROOT='web'
$env:WEB_ROOT='web'
$env:TEST_GROUP='luck-flow-order'
node tests/ui-regression.js
~~~

Expected: PASS at 390px; Woon and day content stay inside the flow card and before the millennium card.

- [ ] **Step 5: Commit Task 1**

~~~powershell
git add index.html tests/ui-regression.js
git commit -m "feat: place luck flow below natal chart"
~~~

---

### Task 2: Make Luck Selections Native, Keyboard-Operable Buttons

**Files:**
- Modify: <code>tests/ui-regression.js:24-50, after inspectLuckFlowOrder(), inspectWidth()</code>
- Modify: <code>index.html:13039-13070, 13270-13358</code>
- Modify: <code>apple.css:1718-1744, 1799-1809</code>
- Test: <code>tests/ui-regression.js</code>

**Interfaces:**
- Consumes: <code>renderLuckItem()</code>, stem/branch/ten-god lookup tables
- Produces: <code>setSelectedLuckItem(containerSelector, selectedItem)</code>; semantic buttons with <code>aria-pressed</code>; test group <code>luck-flow-accessibility</code>

- [ ] **Step 1: Add the failing semantic and keyboard contract**

~~~javascript
const runsLuckFlowAccessibility = () =>
  !TEST_GROUP || TEST_GROUP === 'luck-flow-accessibility';

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
~~~

Call it after <code>inspectLuckFlowOrder()</code>:

~~~javascript
await inspectLuckFlowAccessibility(page, width);
if (TEST_GROUP === 'luck-flow-accessibility') {
  await page.close();
  return;
}
~~~

- [ ] **Step 2: Run the accessibility test and verify RED**

~~~powershell
$env:UI_ROOT='web'
$env:WEB_ROOT='web'
$env:TEST_GROUP='luck-flow-accessibility'
node tests/ui-regression.js
~~~

Expected: FAIL at <code>luck items must be buttons</code> because current items are DIV elements.

- [ ] **Step 3: Replace the shared luck renderer with a semantic button renderer**

Replace <code>renderLuckItem()</code> with:

~~~javascript
function renderLuckItem({
  idx = null,
  layer,
  labelHtml,
  labelText,
  stem,
  branch,
  ilgan,
  isCurrent = false,
  dataAttrs = ''
}) {
  const sE = STEM_EL[stem], bE = BRANCH_EL[branch];
  const sT = SIPSIN_KOR[getSipsin(ilgan, stem)];
  const sB = SIPSIN_KOR[getSipsin(ilgan, JIJANGAN[branch][0])];
  const idxAttr = Number.isInteger(idx) ? ' data-idx="' + idx + '"' : '';
  const currentAttr = isCurrent ? ' data-current="true"' : '';
  const currentText = isCurrent ? ', 현재' : '';
  const aria = layer + ' ' + labelText + currentText +
    ', 천간 십성 ' + sT +
    ', 천간 ' + STEM_KOR[stem] + ' ' + STEM[stem] +
    ', 지지 ' + BRANCH_KOR[branch] + ' ' + BRANCH[branch] +
    ', 지지 십성 ' + sB;

  return [
    '<button type="button" class="luck-item"',
    idxAttr,
    currentAttr,
    ' ',
    dataAttrs,
    ' aria-pressed="false" aria-label="',
    escapeHtml(aria),
    '">',
    '<span class="label">', labelHtml, '</span>',
    '<span class="sipsin-t">', sT, '</span>',
    '<span class="luck-block ', EL_CLASS[sE], '"><span class="han">', STEM[stem], '</span></span>',
    '<span class="luck-block ', EL_CLASS[bE], '"><span class="han">', BRANCH[branch], '</span></span>',
    '<span class="sipsin-b">', sB, '</span>',
    '</button>'
  ].join('');
}

function setSelectedLuckItem(containerSelector, selectedItem) {
  $$(containerSelector + ' .luck-item').forEach(item => {
    const selected = item === selectedItem;
    item.classList.toggle('selected', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
}
~~~

Update Daeyun, Seun, and Woon calls:

~~~javascript
return renderLuckItem({
  idx: orig,
  layer: '대운',
  labelHtml: d.isInitial ? '태생' : d.age + '세',
  labelText: d.isInitial ? '태생' : d.age + '세',
  stem: d.stem,
  branch: d.branch,
  ilgan,
  isCurrent: orig === curDaeunIdx
});
~~~

~~~javascript
return renderLuckItem({
  layer: '세운',
  labelHtml: y + '년<br><span class="meta">' + ag + '세</span>',
  labelText: y + '년 ' + ag + '세',
  stem: g.stem,
  branch: g.branch,
  ilgan: s.dStem,
  dataAttrs: 'data-year="' + y + '"'
});
~~~

~~~javascript
return renderLuckItem({
  layer: '월운',
  labelHtml: m + '월',
  labelText: y + '년 ' + m + '월',
  stem: g.stem,
  branch: g.branch,
  ilgan: s.dStem,
  dataAttrs: 'data-year="' + y + '" data-month="' + m + '"'
});
~~~

In each click handler use the matching call:

~~~javascript
setSelectedLuckItem('#daeunScroll', el);
setSelectedLuckItem('#seunScroll', el);
setSelectedLuckItem('#woonScroll', el);
~~~

For initial current Daeyun:

~~~javascript
selectedDaeun = curDaeunIdx;
setSelectedLuckItem('#daeunScroll', el);
renderSeun();
~~~

- [ ] **Step 4: Reset native button chrome without changing the theme**

Add before the luck-grid rules in <code>apple.css</code>:

~~~css
.luck-item {
  appearance: none;
  -webkit-appearance: none;
  border: 0;
  font: inherit;
  color: inherit;
  background: transparent;
  touch-action: manipulation;
}

.luck-item:focus-visible {
  outline: 2px solid var(--apple-focus) !important;
  outline-offset: 2px;
}

.luck-item.selected:focus-visible {
  outline-color: var(--apple-accent) !important;
  outline-offset: 2px !important;
}
~~~

- [ ] **Step 5: Run focused order and accessibility tests**

~~~powershell
$env:UI_ROOT='web'
$env:WEB_ROOT='web'
$env:TEST_GROUP='luck-flow-order'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:TEST_GROUP='luck-flow-accessibility'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
~~~

Expected: both groups PASS; exactly one pressed button exists per selected layer.

- [ ] **Step 6: Commit Task 2**

~~~powershell
git add index.html apple.css tests/ui-regression.js
git commit -m "feat: make luck flow selections accessible"
~~~

---

### Task 3: Preserve 44px Targets With Controlled Mobile Scrolling

**Files:**
- Modify: <code>tests/ui-regression.js:25-50, after inspectLuckFlowAccessibility(), inspectWidth()</code>
- Modify: <code>index.html:13054-13070, 13314-13358</code>
- Modify: <code>apple.css:1718-1761, 1868-1879</code>
- Test: <code>tests/ui-regression.js</code>

**Interfaces:**
- Consumes: semantic <code>.luck-item</code> buttons and <code>setSelectedLuckItem()</code>
- Produces: <code>revealLuckItem(container, item)</code>; 560px responsive contract; test group <code>luck-flow-responsive</code>

- [ ] **Step 1: Add the failing geometry and visibility test**

~~~javascript
const runsLuckFlowResponsive = () =>
  !TEST_GROUP || TEST_GROUP === 'luck-flow-responsive';

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
      return {
        clientWidth: container.clientWidth,
        scrollWidth: container.scrollWidth,
        itemWidths: items.map(item => item.getBoundingClientRect().width)
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

  if (width <= 560) {
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
  } else {
    assert.ok(state.daeun.scrollWidth - state.daeun.clientWidth <= 1);
    assert.ok(state.seun.scrollWidth - state.seun.clientWidth <= 1);
    assert.ok(state.woon.scrollWidth - state.woon.clientWidth <= 1);
  }
  await resetLuckFlow(page);
}
~~~

Call it after the accessibility inspection:

~~~javascript
await inspectLuckFlowResponsive(page, width);
if (TEST_GROUP === 'luck-flow-responsive') {
  await page.close();
  return;
}
~~~

- [ ] **Step 2: Run the responsive test and verify RED**

~~~powershell
$env:UI_ROOT='web'
$env:WEB_ROOT='web'
$env:TEST_GROUP='luck-flow-responsive'
node tests/ui-regression.js
~~~

Expected: FAIL at 390px because current items compress below 44px.

- [ ] **Step 3: Add the mobile-only fixed column widths**

Add after the base luck-grid rules in <code>apple.css</code>:

~~~css
@media (max-width: 560px) {
  #daeunScroll,
  #seunScroll {
    grid-auto-columns: minmax(44px, 56px);
    justify-content: start !important;
    scroll-padding-inline: 8px;
  }

  #woonScroll.woon-grid {
    grid-template-columns: repeat(12, minmax(44px, 1fr)) !important;
    justify-content: start;
    scroll-padding-inline: 8px;
  }

  #daeunScroll .luck-item,
  #seunScroll .luck-item,
  #woonScroll .luck-item {
    min-width: 44px !important;
  }
}
~~~

Replace the existing 768px rule so its fixed 58px columns cannot overflow the 616px result card:

~~~css
@media (min-width: 768px) {
  #daeunScroll,
  #seunScroll {
    grid-auto-columns: minmax(44px, 1fr);
    justify-content: stretch !important;
  }

  #woonScroll.woon-grid {
    grid-template-columns: repeat(12, minmax(44px, 1fr)) !important;
    justify-content: stretch;
  }
}
~~~

In <code>inspectAppleDesign()</code>, replace the obsolete “only scroll below 25px per item” assertion with the approved 44px touch-width contract:

~~~javascript
assert.ok(
  flow.minItemWidth >= 43.5,
  `${width}px ${theme} ${group} scroll item is below the 44px touch width: ${flow.minItemWidth}px`
);
~~~

Keep the existing <code>reachedEnd</code> and last-item visibility assertions immediately after it.

- [ ] **Step 4: Center the current or newly selected item**

Add next to <code>setSelectedLuckItem()</code>:

~~~javascript
function revealLuckItem(container, item) {
  if (!container || !item) return;
  requestAnimationFrame(() => {
    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    const itemCenter = itemRect.left - containerRect.left +
      container.scrollLeft + itemRect.width / 2;
    const centered = itemCenter - container.clientWidth / 2;
    container.scrollLeft = Math.max(0, Math.min(maxLeft, centered));
  });
}
~~~

After each selection call, reveal within the matching container:

~~~javascript
setSelectedLuckItem('#daeunScroll', el);
revealLuckItem(document.getElementById('daeunScroll'), el);
~~~

~~~javascript
setSelectedLuckItem('#seunScroll', el);
revealLuckItem(document.getElementById('seunScroll'), el);
~~~

~~~javascript
setSelectedLuckItem('#woonScroll', el);
revealLuckItem(document.getElementById('woonScroll'), el);
~~~

Use the same Daeyun calls during initial automatic selection.

- [ ] **Step 5: Run all feature groups**

~~~powershell
$env:UI_ROOT='web'
$env:WEB_ROOT='web'
$env:TEST_GROUP='luck-flow-order'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:TEST_GROUP='luck-flow-accessibility'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:TEST_GROUP='luck-flow-responsive'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
~~~

Expected: all groups PASS, including 560/561 boundary behavior.

- [ ] **Step 6: Commit Task 3**

~~~powershell
git add index.html apple.css tests/ui-regression.js
git commit -m "feat: keep mobile luck flow touch friendly"
~~~

---

### Task 4: Align the Stale Visual Regression With the Current Priestess Brand

**Files:**
- Modify: <code>tests/ui-regression.js:1612-1760, 3171-3177</code>
- Test: <code>tests/ui-regression.js</code>

**Interfaces:**
- Consumes: the existing final-cascade values from <code>priestess.css</code>
- Produces: a passing <code>apple-design</code> group that protects the current ink-paper/gold brand instead of the superseded blue layer

- [ ] **Step 1: Confirm the pre-existing RED baseline**

~~~powershell
$env:UI_ROOT='web'
$env:WEB_ROOT='web'
$env:TEST_GROUP='apple-design'
node tests/ui-regression.js
~~~

Expected: FAIL at <code>390px light --apple-accent</code> with actual <code>#715234</code> and stale expected <code>#007aff</code>. This failure exists before the luck-flow implementation.

- [ ] **Step 2: Replace the obsolete blue-theme constants with the current final-cascade contract**

At the start of <code>inspectAppleDesign()</code>, replace the accent, pastel, and radius constants with:

~~~javascript
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
~~~

Delete <code>expectedAccentTints</code>. Replace the three fixed-radius assertions with:

~~~javascript
assert.deepEqual(
  componentInspection.radii,
  expectedRadii[theme],
  `${width}px ${theme} Priestess component radii`
);
~~~

- [ ] **Step 3: Assert the current transparent tab and ink underline**

Replace the old blue-tint block after <code>const activeTab</code> with:

~~~javascript
const activeTab = inspection.styles.activeTab[0];
const expectedColor = expectedAccentColors[theme];
assert.equal(activeTab.base.values.color, expectedColor, `${width}px ${theme} active tab text color`);
assert.equal(
  activeTab.base.values.backgroundColor,
  'rgba(0, 0, 0, 0)',
  `${width}px ${theme} active tab must use the Priestess transparent surface`
);
assert.match(
  activeTab.base.values.boxShadow,
  /inset/,
  `${width}px ${theme} active tab must keep its inset underline`
);
assert.ok(
  activeTab.base.values.boxShadow.includes(expectedColor),
  `${width}px ${theme} active tab underline must use the theme accent`
);
~~~

In the static <code>apple-design</code> group, keep the Apple base-layer assertions and add the final override checks:

~~~javascript
const priestessCss = fs.readFileSync(path.join(UI_ROOT, 'priestess.css'), 'utf8');
assert.match(priestessCss, /--apple-accent:\s*#715234/i);
assert.match(priestessCss, /--priestess-gold-bright:\s*#c5a76f/i);
assert.match(priestessCss, /body\.dark[\s\S]*--apple-accent:\s*var\(--priestess-gold-bright\)/i);
~~~

- [ ] **Step 4: Run the corrected visual contract**

~~~powershell
$env:UI_ROOT='web'
$env:WEB_ROOT='web'
$env:TEST_GROUP='apple-design'
node tests/ui-regression.js
~~~

Expected: PASS at 390px for both light and dark themes, including the new 44px internal-scroll reachability contract from Task 3.

- [ ] **Step 5: Commit Task 4**

~~~powershell
git add tests/ui-regression.js
git commit -m "test: align visual regression with priestess theme"
~~~

---

### Task 5: Refresh the PWA Cache and Run the Full Regression Suite

**Files:**
- Modify: <code>tests/ui-regression.js:3191-3198</code>
- Modify: <code>sw.js:1-5</code>
- Test: <code>tests/ui-regression.js</code>

**Interfaces:**
- Consumes: completed DOM, accessibility, and responsive contracts
- Produces: cache <code>jansang-manse-v37-20260812-natal-luck-flow-order</code>; verified release commit

- [ ] **Step 1: Add the failing cache-version contract**

~~~javascript
assert.match(
  serviceWorker,
  /const VERSION = 'v37-20260812-natal-luck-flow-order'/,
  'service worker cache version must ship the natal luck flow update'
);
assert.match(serviceWorker, /'\.\/apple\.css'/, 'web service worker must precache apple.css');
assert.match(serviceWorker, /'\.\/priestess\.css'/, 'web service worker must precache priestess.css');
~~~

- [ ] **Step 2: Run the Service Worker test and verify RED**

~~~powershell
$env:UI_ROOT='web'
$env:WEB_ROOT='web'
$env:TEST_GROUP='service-worker'
node tests/ui-regression.js
~~~

Expected: FAIL with <code>service worker cache version must ship the natal luck flow update</code>.

- [ ] **Step 3: Bump the cache version**

Change <code>sw.js</code> line 4 to:

~~~javascript
const VERSION = 'v37-20260812-natal-luck-flow-order';
~~~

Keep the network-first strategy and precache list unchanged.

- [ ] **Step 4: Run syntax, focused, and full regression checks**

~~~powershell
$env:UI_ROOT='web'
$env:WEB_ROOT='web'
node --check tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:TEST_GROUP='luck-flow-order'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:TEST_GROUP='luck-flow-accessibility'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:TEST_GROUP='luck-flow-responsive'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:TEST_GROUP='service-worker'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Remove-Item Env:TEST_GROUP
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
git diff --check
~~~

Expected: syntax check exits 0; all focused groups pass; full suite passes at 360, 390, 412, and 768px; diff check is clean.

- [ ] **Step 5: Review the exact release diff**

~~~powershell
git diff -- index.html apple.css sw.js tests/ui-regression.js
git status --short
~~~

Expected: the uncommitted Task 5 diff contains only <code>sw.js</code> and its test edits; pre-existing <code>.superpowers/sdd-tools/</code> remains untracked and unstaged.

- [ ] **Step 6: Commit Task 5**

~~~powershell
git add index.html apple.css sw.js tests/ui-regression.js
git commit -m "chore: refresh luck flow pwa release"
~~~

- [ ] **Step 7: Review the complete release diff against public main**

~~~powershell
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- index.html apple.css sw.js tests/ui-regression.js
git status --short
~~~

Expected: the complete runtime diff is limited to <code>index.html</code>, <code>apple.css</code>, <code>sw.js</code>, and <code>tests/ui-regression.js</code>; the approved design/plan docs are committed; only <code>.superpowers/sdd-tools/</code> remains untracked.

---

### Task 6: Deploy to GitHub Pages and Verify the Public Site

**Files:**
- No source changes
- Verify: <code>https://jansang18.github.io/sineum-manse/</code>

**Interfaces:**
- Consumes: verified local HEAD and authenticated <code>origin</code>/<code>gh</code>
- Produces: GitHub Pages build for the same HEAD; public DOM and interaction verification

- [ ] **Step 1: Confirm the push scope**

~~~powershell
$expected = git rev-parse HEAD
git status --short
git log --oneline origin/main..HEAD
gh auth status
~~~

Expected: tracked worktree is clean; only known untracked <code>.superpowers/sdd-tools/</code> is listed; GitHub authentication succeeds.

- [ ] **Step 2: Push the verified HEAD**

~~~powershell
git push origin HEAD:main
~~~

Expected: non-force push succeeds and reports the new HEAD on <code>main</code>.

- [ ] **Step 3: Wait for the matching Pages build**

Poll at 10-second intervals, bounded to 12 checks:

~~~powershell
$expected = git rev-parse HEAD
$build = $null
$lastError = ''
for ($attempt = 1; $attempt -le 12; $attempt++) {
  try {
    $build = gh api repos/jansang18/sineum-manse/pages/builds/latest | ConvertFrom-Json
    $lastError = ''
  } catch {
    $lastError = $_.Exception.Message
  }

  if ($build -and $build.commit -eq $expected -and $build.status -eq 'built') {
    break
  }
  if ($attempt -eq 12) {
    $actualCommit = if ($build) { $build.commit } else { '<none>' }
    $actualStatus = if ($build) { $build.status } else { '<none>' }
    throw "Pages build mismatch after 12 checks: expected=$expected commit=$actualCommit status=$actualStatus error=$lastError"
  }
  Start-Sleep -Seconds 10
}
$build.commit
$build.status
~~~

Expected: commit equals <code>$expected</code> and status equals <code>built</code>. Stop after 12 checks and report the exact status if it never matches.

- [ ] **Step 4: Verify public HTTP and cache version**

~~~powershell
$expected = git rev-parse HEAD
$base = 'https://jansang18.github.io/sineum-manse/'
$page = Invoke-WebRequest ($base + '?verify=' + $expected)
$worker = Invoke-WebRequest ($base + 'sw.js?verify=' + $expected)
if ($page.StatusCode -ne 200) { throw 'public page did not return HTTP 200' }
if ($worker.Content -notmatch 'v37-20260812-natal-luck-flow-order') {
  throw 'public service worker version is stale'
}
~~~

Expected: page is HTTP 200 and public <code>sw.js</code> contains v37.

- [ ] **Step 5: Run focused browser contracts against the public URL**

~~~powershell
$expected = git rev-parse HEAD
$env:UI_ROOT='web'
$env:WEB_ROOT='web'
$env:TEST_URL='https://jansang18.github.io/sineum-manse/?verify=' + $expected
$env:TEST_GROUP='luck-flow-order'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:TEST_GROUP='luck-flow-accessibility'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
$env:TEST_GROUP='luck-flow-responsive'
node tests/ui-regression.js
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Remove-Item Env:TEST_URL
Remove-Item Env:TEST_GROUP
~~~

Expected: public order, progressive Woon/day rendering, keyboard selection, 44px targets, internal scrolling, and 390/560/561/768/1220px contracts pass.

- [ ] **Step 6: Record the handoff facts**

Report the public URL, deployed SHA, Pages build status, focused/full regression results, confirmed content order, and preservation of <code>.superpowers/sdd-tools/</code>.

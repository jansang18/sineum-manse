/* 원국 판독 도구: 운·다른 명식과의 합충, 12운성, 신살. 저장 데이터는 바꾸지 않는다. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ChartInsight = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const pair = (list, a, b) => list.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
  const STEM_HAP = [[0,5],[1,6],[2,7],[3,8],[4,9]];
  const STEM_CHUNG = [[0,6],[1,7],[2,8],[3,9]];
  const YUKHAP = [[0,1],[2,11],[3,10],[4,9],[5,8],[6,7]];
  const CHUNG = [[0,6],[1,7],[2,8],[3,9],[4,10],[5,11]];
  const HYEONG = [[0,3],[2,5],[5,8],[2,8],[1,10],[10,7],[1,7]];
  const SELF_HYEONG = [4,6,9,11];
  const PA = [[0,9],[6,3],[8,5],[2,11],[4,1],[10,7]];
  const HAE = [[0,7],[1,6],[2,5],[3,4],[8,11],[9,10]];
  const SAMHAP = [[[8,0,4],'수국'],[[11,3,7],'목국'],[[2,6,10],'화국'],[[5,9,1],'금국']];
  const BANGHAP = [[[2,3,4],'목방'],[[5,6,7],'화방'],[[8,9,10],'금방'],[[11,0,1],'수방']];
  const WANGJI = [0,3,6,9];

  /** pillars: [{name:'일', stem, branch}] (모르는 시주는 stem·branch가 음수). */
  function relations(stem, branch, pillars, gongmang, prefix) {
    const out = [];
    const known = pillars.filter(p => p.stem >= 0 && p.branch >= 0);
    const tag = prefix || '';
    for (const p of known) {
      const gan = `${tag}${p.name}간`, ji = `${tag}${p.name}지`;
      if (pair(STEM_HAP, stem, p.stem)) out.push({ kind: 'hap', text: `${gan} ${STEMS[p.stem]}${STEMS[stem]} 합` });
      if (pair(STEM_CHUNG, stem, p.stem)) out.push({ kind: 'clash', text: `${gan} ${STEMS[p.stem]}${STEMS[stem]} 충` });
      const name = `${ji} ${BRANCHES[p.branch]}${BRANCHES[branch]}`;
      if (pair(YUKHAP, branch, p.branch)) out.push({ kind: 'hap', text: `${name} 육합` });
      if (pair(CHUNG, branch, p.branch)) out.push({ kind: 'clash', text: `${name} 충` });
      if (pair(HYEONG, branch, p.branch) || (branch === p.branch && SELF_HYEONG.includes(branch))) out.push({ kind: 'clash', text: `${name} 형` });
      if (pair(PA, branch, p.branch)) out.push({ kind: 'mild', text: `${name} 파` });
      if (pair(HAE, branch, p.branch)) out.push({ kind: 'mild', text: `${name} 해` });
    }
    const present = known.map(p => p.branch);
    const groupText = (list, full, half) => {
      for (const [group, label] of list) {
        if (!group.includes(branch)) continue;
        const others = group.filter(b => b !== branch && present.includes(b));
        const han = [...others, branch].map(b => BRANCHES[b]).join('');
        if (others.length === 2) out.push({ kind: 'hap', text: `${han} ${full}(${label})` });
        else if (half && others.length === 1 && (WANGJI.includes(branch) || WANGJI.includes(others[0]))) out.push({ kind: 'hap', text: `${han} ${half}(${label})` });
      }
    };
    groupText(SAMHAP, '삼합', '반합');
    groupText(BANGHAP, '방합', null);
    if (gongmang && gongmang.includes(branch)) out.push({ kind: 'mild', text: `${BRANCHES[branch]} 공망` });
    return out;
  }

  const UNSEONG = ['장생','목욕','관대','건록','제왕','쇠','병','사','묘','절','태','양'];
  const UNSEONG_START = [11,6,2,9,2,9,5,0,8,3];
  /** 일간 기준 12운성. 양간은 순행, 음간은 역행. */
  function twelveStage(dayStem, branch) {
    const step = dayStem % 2 === 0 ? branch - UNSEONG_START[dayStem] : UNSEONG_START[dayStem] - branch;
    return UNSEONG[((step % 12) + 12) % 12];
  }

  const SINSAL = ['겁살','재살','천살','지살','연살','월살','망신','장성','반안','역마','육해','화개'];
  const GEOP_START = { 0:5,4:5,8:5, 3:8,7:8,11:8, 2:11,6:11,10:11, 5:2,9:2,1:2 };
  /** 년지 기준 12신살. */
  function twelveSinsal(yearBranch, branch) {
    return SINSAL[((branch - GEOP_START[yearBranch]) % 12 + 12) % 12];
  }

  const CHEONEUL = {0:[1,7],4:[1,7],6:[1,7],1:[0,8],5:[0,8],2:[11,9],3:[11,9],7:[6,2],8:[3,5],9:[3,5]};
  const MUNCHANG = {0:5,1:6,2:8,4:8,3:9,5:9,6:11,7:0,8:2,9:3};
  function guiin(dayStem, branch) {
    const list = [];
    if (CHEONEUL[dayStem].includes(branch)) list.push('천을귀인');
    if (MUNCHANG[dayStem] === branch) list.push('문창귀인');
    return list;
  }

  function pillarsOf(record) {
    return [
      { name: '시', stem: record.hStem, branch: record.hBranch },
      { name: '일', stem: record.dStem, branch: record.dBranch },
      { name: '월', stem: record.mStem, branch: record.mBranch },
      { name: '년', stem: record.yStem, branch: record.yBranch }
    ];
  }

  function chips(list, emptyText) {
    if (!list.length) return `<span class="rel-empty">${emptyText}</span>`;
    return list.map(item => `<span class="rel-chip rel-${item.kind}">${item.text}</span>`).join('');
  }

  /** 운 한 칸과 원국(필요하면 상위 운까지)의 관계 한 줄. */
  function luckLine(title, record, stem, branch, upper) {
    const list = relations(stem, branch, pillarsOf(record), record.gongmang);
    if (upper) relations(stem, branch, [{ name: upper.name, stem: upper.stem, branch: upper.branch }], null, '').forEach(item => list.push(item));
    return `<div class="relation-line"><span class="relation-title">${title} × 원국${upper ? '·' + upper.name : ''}</span><span class="relation-chips">${chips(list, '직접 맺는 합·충이 없습니다')}</span></div>`;
  }

  function sheet(record, renderInner) {
    const cols = pillarsOf(record).filter(p => p.branch >= 0);
    const row = (label, cell) => `<tr><th scope="row">${label}</th>${cols.map(p => `<td>${cell(p)}</td>`).join('')}</tr>`;
    const gm = record.gongmang || [];
    const gmText = gm.map(b => BRANCHES[b]).join('');
    return `<details class="natal-sheet">
      <summary>판독표 <span class="natal-sheet-hint">공망 ${gmText} · 12운성 · 신살 · 합충</span></summary>
      <div class="natal-sheet-body">
        <table>
          <thead><tr><td></td>${cols.map(p => `<th scope="col">${p.name}지 <span class="han-inline">${BRANCHES[p.branch]}</span></th>`).join('')}</tr></thead>
          <tbody>
            ${row('12운성', p => twelveStage(record.dStem, p.branch))}
            ${row('12신살', p => twelveSinsal(record.yBranch, p.branch))}
            ${row('귀인', p => guiin(record.dStem, p.branch).join(' ') || '–')}
            ${row('공망', p => gm.includes(p.branch) ? '공망' : '–')}
          </tbody>
        </table>
        <p class="natal-sheet-note">12운성은 일간, 12신살은 년지, 귀인은 일간 기준입니다.</p>
        ${renderInner}
        <button type="button" class="natal-print" id="printChartBtn">이 화면 인쇄</button>
      </div>
    </details>`;
  }

  /** 두 명식 사이의 관계. a의 기둥을 기준으로 b의 각 기둥을 맞춰 본다. */
  function compare(a, b) {
    const list = [];
    const seen = new Set();
    for (const p of pillarsOf(b)) {
      if (!(p.stem >= 0 && p.branch >= 0)) continue;
      for (const item of relations(p.stem, p.branch, pillarsOf(a), null)) {
        if (item.text.includes('삼합') || item.text.includes('방합') || item.text.includes('반합')) continue;
        const text = `${p.name}주 ↔ ${item.text}`;
        if (!seen.has(text)) { seen.add(text); list.push({ kind: item.kind, text }); }
      }
    }
    return list;
  }

  return Object.freeze({ relations, twelveStage, twelveSinsal, guiin, pillarsOf, chips, luckLine, sheet, compare });
});

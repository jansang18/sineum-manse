(function () {
  'use strict';

  const ENDPOINT = 'https://chwimyeongseon-pungsu.netlify.app/.netlify/functions/manseBuildingLookup';
  const SOURCE = '국토교통부 건축HUB';
  const fail = code => Object.assign(new Error(code), { code });
  const validText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1000;

  function isApprovalDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const year = Number(value.slice(0, 4));
    if (year < 1026 || year > 2099) return false;
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function normalizePlaces(body) {
    if (!body || !['hybrid', 'fallback'].includes(body.mode) || !Array.isArray(body.results)) throw fail('unavailable');
    return body.results.filter(place => place && validText(place.name) &&
      validText(place.displayName) && (validText(place.parcelAddress) || validText(place.roadAddress)))
      .slice(0, 5).map(place => ({
        name: place.name.trim(),
        displayName: place.displayName.trim(),
        parcelAddress: validText(place.parcelAddress) ? place.parcelAddress.trim() : place.roadAddress.trim(),
      }));
  }

  function normalizeRegistry(body) {
    if (!body || !['found', 'multiple', 'not-found'].includes(body.status) ||
      !Array.isArray(body.records) || body.records.length > 100 ||
      (body.status === 'not-found' ? body.records.length !== 0 : body.records.length === 0)) throw fail('unavailable');
    if (body.records.some(record => !record || !validText(record.buildingId) ||
      !validText(record.buildingName) || !validText(record.parcelAddress) ||
      !isApprovalDate(record.approvalDate) || record.source !== SOURCE ||
      typeof record.fetchedAt !== 'string' || !Number.isFinite(Date.parse(record.fetchedAt)) ||
      (record.dongName !== undefined && !validText(record.dongName)) ||
      (record.roadAddress !== undefined && !validText(record.roadAddress)))) throw fail('unavailable');
    return {
      status: body.status,
      records: body.records.map(record => ({
        buildingId: record.buildingId, buildingName: record.buildingName,
        ...(record.dongName ? { dongName: record.dongName } : {}), parcelAddress: record.parcelAddress,
        ...(record.roadAddress ? { roadAddress: record.roadAddress } : {}), approvalDate: record.approvalDate,
        source: record.source, fetchedAt: record.fetchedAt,
      })),
    };
  }

  function createClient({ fetcher = globalThis.fetch.bind(globalThis), timeoutMs = 25000, endpoint = ENDPOINT } = {}) {
    function input(value) {
      const query = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
      if (!query) throw fail('empty-query');
      if (query.length > 200) throw fail('invalid-query');
      return query;
    }
    async function request(params, signal) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal?.addEventListener('abort', cancel, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
      try {
        const url = new URL(endpoint);
        for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
        const response = await fetcher(url.toString(), {
          headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store', signal: controller.signal,
        });
        if (response.status === 429) throw fail('rate-limited');
        if (!response.ok) throw fail('unavailable');
        return await response.json();
      } catch (error) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (timedOut) throw fail('timeout');
        if (error.code === 'rate-limited') throw error;
        throw fail('unavailable');
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
      }
    }
    return {
      async search(query, signal) { return normalizePlaces(await request({ action: 'search', q: input(query) }, signal)); },
      async registry({ parcelAddress, buildingName }, signal) {
        const params = { action: 'registry', parcelAddress: input(parcelAddress) };
        if (buildingName?.trim()) params.buildingName = input(buildingName);
        return normalizeRegistry(await request(params, signal));
      },
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isApprovalDate, normalizePlaces, normalizeRegistry, createClient };
  }
  if (typeof document === 'undefined') return;
  const root = document.getElementById('buildingLookup');
  if (!root) return;
  const byId = id => document.getElementById(id);
  const query = byId('buildingQuery');
  const submit = byId('buildingSearchBtn');
  const status = byId('buildingStatus');
  const places = byId('buildingPlaces');
  const select = byId('buildingRecords');
  const result = byId('buildingResult');
  const client = createClient();
  let requestId = 0;
  let controller;
  let records = [];
  let selected = null;
  let applying = false;

  function inputSnapshot() {
    return [byId('inputName').value, byId('inBirth').value, byId('inTime').value,
      document.querySelector('#segCal .active')?.dataset.val,
      document.querySelector('#segGender .active')?.dataset.val].join('\u0000');
  }

  function reset() {
    ++requestId;
    controller?.abort();
    controller = null;
    records = [];
    selected = null;
    places.replaceChildren();
    select.replaceChildren();
    byId('buildingRecordField').hidden = true;
    result.hidden = true;
    submit.disabled = false;
    submit.textContent = '조회';
    root.removeAttribute('aria-busy');
  }

  function showRecord(index) {
    selected = records[index] || null;
    result.hidden = !selected;
    if (!selected) return;
    byId('buildingName').textContent = [selected.buildingName, selected.dongName].filter(Boolean).join(' · ');
    byId('buildingAddress').textContent = selected.roadAddress || selected.parcelAddress;
    byId('buildingApprovalDate').textContent = selected.approvalDate.replace(/-/g, '.');
    byId('buildingApprovalDate').dateTime = selected.approvalDate;
    const fetched = new Date(selected.fetchedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
    byId('buildingSource').textContent = `${selected.source} · ${fetched} 조회`;
    status.textContent = '사용승인일로 만세력을 열고 있습니다.';
    openBuildingChart();
  }

  function showRecords(response) {
    records = response.records;
    if (!records.length) {
      status.textContent = '이 주소에서 사용승인일을 찾지 못했습니다. 주소를 다시 확인하거나, 건축물대장에서 확인한 날짜를 아래 입력칸에 직접 넣어주세요.';
      return;
    }
    if (records.length === 1) { showRecord(0); return; }
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = `${records.length}개 건물·동 중 선택하세요`;
    select.append(blank);
    records.forEach((record, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = [record.buildingName, record.dongName, record.approvalDate].filter(Boolean).join(' · ');
      select.append(option);
    });
    byId('buildingRecordField').hidden = false;
    status.textContent = '같은 주소에 여러 건물이 있습니다. 건물·동을 선택하면 만세력이 열립니다.';
  }

  async function run(operation, render, message) {
    reset();
    const token = requestId;
    const beforeInput = inputSnapshot();
    controller = new AbortController();
    submit.disabled = true;
    submit.textContent = '조회 중';
    root.setAttribute('aria-busy', 'true');
    status.textContent = message;
    try {
      const value = await operation(controller.signal);
      if (token === requestId && root.open && byId('view-input').classList.contains('active') && beforeInput === inputSnapshot()) render(value);
    } catch (error) {
      if (token !== requestId || error.name === 'AbortError') return;
      status.textContent = ({
        'empty-query': '조회할 주소나 건물명을 입력해주세요.',
        'invalid-query': '주소나 건물명을 200자 이내로 입력해주세요.',
        'rate-limited': '조회가 잠시 몰렸습니다. 1분 뒤 다시 시도해주세요.',
        timeout: '조회 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.',
      })[error.code] || '건물정보 서비스에 연결하지 못했습니다. 다시 조회하거나 확인한 날짜를 아래 입력칸에 직접 넣어주세요.';
    } finally {
      if (token === requestId) {
        submit.disabled = false;
        submit.textContent = '조회';
        root.removeAttribute('aria-busy');
        controller = null;
      }
    }
  }

  function lookup(place) {
    return run(signal => client.registry({ parcelAddress: place.parcelAddress, buildingName: place.name }, signal), showRecords, '건축물대장의 사용승인일을 확인하고 있습니다.');
  }

  byId('buildingLookupForm').addEventListener('submit', event => {
    event.preventDefault();
    const text = query.value.trim();
    if (/(?:대로|로|길|동|리|읍|면|가)\s*\d+(?:-\d+)?(?:번지)?(?:\s|$)/u.test(text)) {
      run(signal => client.registry({ parcelAddress: text }, signal), showRecords, '이 주소의 건축물대장을 확인하고 있습니다.');
      return;
    }
    run(signal => client.search(text, signal), matches => {
      if (!matches.length) {
        status.textContent = '검색 결과가 없습니다. 도로명이나 지번 주소를 넣어 다시 조회해주세요.';
        return;
      }
      status.textContent = '주소를 선택하면 사용승인일 기준 만세력이 열립니다.';
      for (const place of matches) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'building-place';
        const name = document.createElement('strong');
        name.textContent = place.name;
        const address = document.createElement('small');
        address.textContent = place.displayName;
        button.append(name, address);
        button.addEventListener('click', () => lookup(place));
        places.append(button);
      }
    }, '주소와 건물명을 검색하고 있습니다.');
  });

  query.addEventListener('input', () => {
    reset();
    status.textContent = '새 주소나 건물명을 조회해주세요.';
  });
  select.addEventListener('change', () => showRecord(select.value === '' ? -1 : Number(select.value)));

  function cancelManualChange() {
    if (applying) return;
    reset();
    status.textContent = '입력 내용이 바뀌었습니다. 건물 날짜가 필요하면 다시 조회해주세요.';
  }
  for (const id of ['inputName', 'inBirth', 'inTime']) byId(id).addEventListener('input', cancelManualChange);
  document.querySelectorAll('#segCal button, #segGender button').forEach(button => button.addEventListener('click', cancelManualChange));
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
    if (tab.dataset.tab !== 'input' && controller) cancelManualChange();
  }));
  root.addEventListener('toggle', () => { if (!root.open && controller) cancelManualChange(); });

  window.jansangBuildingLookup = {
    getInputRecord() {
      if (!selected || byId('inBirth').value !== selected.approvalDate.replace(/-/g, '') ||
        byId('inTime').value !== '' || byId('inputName').value !== [selected.buildingName, selected.dongName].filter(Boolean).join(' ') ||
        !document.querySelector('#segCal button[data-val="solar"]').classList.contains('active')) return null;
      return { ...selected };
    },
    restoreRecord(record, chart) {
      if (!record) return null;
      try {
        const normalized = normalizeRegistry({ status: 'found', records: [record] }).records[0];
        const date = [chart.year, String(chart.month).padStart(2, '0'), String(chart.day).padStart(2, '0')].join('-');
        return chart.unknown && date === normalized.approvalDate ? normalized : null;
      } catch (_) { return null; }
    },
  };

  function openBuildingChart() {
    if (!selected || !isApprovalDate(selected.approvalDate)) return;
    applying = true;
    try {
      byId('inBirth').value = selected.approvalDate.replace(/-/g, '');
      byId('inTime').value = '';
      byId('inputName').value = [selected.buildingName, selected.dongName].filter(Boolean).join(' ');
      document.querySelector('#segCal button[data-val="solar"]').click();
      for (const id of ['inBirth', 'inTime', 'inputName']) byId(id).dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof clearInErr === 'function') clearInErr();
      status.textContent = `${selected.approvalDate} 사용승인일로 만세력을 열었습니다. 시각 정보가 없어 시간은 비워두었습니다.`;
      byId('calcBtn').click();
      byId('tab-result').focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    } finally { applying = false; }
  }
  byId('buildingApplyBtn').addEventListener('click', openBuildingChart);
})();

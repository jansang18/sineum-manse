const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  isApprovalDate,
  normalizePlaces,
  normalizeRegistry,
  createClient,
} = require('../building-lookup.js');

const endpoint = 'https://example.test/.netlify/functions/manseBuildingLookup';
const source = '국토교통부 건축HUB';
const place = (n = 1) => ({
  name: `테스트 아파트 ${n}`,
  displayName: `서울특별시 송파구 올림픽로 ${n}`,
  parcelAddress: `서울특별시 송파구 잠실동 ${n}`,
  roadAddress: `서울특별시 송파구 올림픽로 ${n}`,
});
const record = (n = 1) => ({
  buildingId: `building-${n}`,
  buildingName: '테스트 아파트',
  dongName: `${n}동`,
  parcelAddress: '서울특별시 송파구 잠실동 27',
  approvalDate: '2008-07-31',
  source,
  fetchedAt: '2026-09-08T00:00:00.000Z',
});
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const rejectsCode = (promise, code) => assert.rejects(promise, error => error?.code === code);
const throwsCode = (fn, code) => assert.throws(fn, error => error?.code === code);

test('approval dates are real, strict, supported calendar dates', () => {
  for (const date of ['1026-01-01', '2000-02-29', '2024-02-29', '2099-12-31']) {
    assert.equal(isApprovalDate(date), true, date);
  }
  for (const date of [
    null, undefined, 20080731, '', '20080731', ' 2008-07-31', '2008-7-31',
    '2008-07-31T00:00:00Z', '1900-02-29', '2023-02-29', '2024-04-31',
    '2024-00-01', '2024-13-01', '2024-01-00', '1025-12-31', '2100-01-01',
  ]) assert.equal(isApprovalDate(date), false, String(date));
});

test('search rejects invalid input before making network calls', async () => {
  let calls = 0;
  const client = createClient({ endpoint, fetcher: async () => { calls++; return response({}); } });
  await rejectsCode(client.search('   '), 'empty-query');
  await rejectsCode(client.search('가'.repeat(1000)), 'invalid-query');
  assert.equal(calls, 0);
});

test('HTTP, malformed JSON, and network failures become usable client errors', async () => {
  for (const status of [400, 403, 404, 500, 503]) {
    const client = createClient({ endpoint, fetcher: async () => response({}, status) });
    await rejectsCode(client.search('잠실 아파트'), 'unavailable');
  }
  await rejectsCode(createClient({ endpoint, fetcher: async () => response({}, 429) }).search('잠실 아파트'), 'rate-limited');
  await rejectsCode(createClient({ endpoint, fetcher: async () => { throw new TypeError('network unavailable'); } }).search('잠실 아파트'), 'unavailable');
  await rejectsCode(createClient({ endpoint, fetcher: async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('not json'); } }) }).search('잠실 아파트'), 'unavailable');
});

test('slow requests time out, while caller cancellation remains an AbortError', async () => {
  const abortableFetch = (_url, options) => new Promise((_resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'));
    if (options.signal.aborted) abort();
    else options.signal.addEventListener('abort', abort, { once: true });
  });
  await rejectsCode(createClient({ endpoint, timeoutMs: 20, fetcher: abortableFetch }).search('잠실 아파트'), 'timeout');
  const controller = new AbortController();
  const request = createClient({ endpoint, timeoutMs: 1000, fetcher: abortableFetch }).search('잠실 아파트', controller.signal);
  controller.abort();
  await assert.rejects(request, error => error?.name === 'AbortError');
});

test('place search keeps at most five usable plain string records', () => {
  const output = normalizePlaces({ mode: 'hybrid', results: [
    null, { ...place(), name: { html: 'untrusted object' } },
    ...Array.from({ length: 8 }, (_, n) => place(n + 1)),
  ] });
  assert.equal(output.length, 5);
  assert.deepEqual(output[0], {
    name: '테스트 아파트 1', displayName: '서울특별시 송파구 올림픽로 1', parcelAddress: '서울특별시 송파구 잠실동 1',
  });
  assert.deepEqual(normalizePlaces({ mode: 'fallback', results: [] }), []);
  assert.deepEqual(normalizePlaces({ mode: 'fallback', results: [{ ...place(), parcelAddress: '' }] })[0], {
    name: place().name, displayName: place().displayName, parcelAddress: place().roadAddress,
  });
  for (const invalid of [null, [], {}, { mode: 'hybrid', results: {} }, { mode: 'invalid', results: [] }]) {
    throwsCode(() => normalizePlaces(invalid), 'unavailable');
  }
});

test('registry accepts complete official records and explicit no-result responses', () => {
  const single = normalizeRegistry({ status: 'found', records: [record()] });
  assert.equal(single.status, 'found');
  assert.equal(single.records[0].approvalDate, '2008-07-31');
  assert.equal(single.records[0].source, source);
  assert.equal(normalizeRegistry({ status: 'multiple', records: Array.from({ length: 46 }, (_, n) => record(n + 1)) }).records.length, 46);
  assert.deepEqual(normalizeRegistry({ status: 'not-found', records: [] }), { status: 'not-found', records: [] });
});

test('registry does not allow malformed dates, missing provenance, or a contradictory response', () => {
  const invalidRecords = [
    { ...record(), approvalDate: '2025-02-30' },
    { ...record(), approvalDate: '20080731' },
    { ...record(), approvalDate: '2100-01-01' },
    { ...record(), buildingId: 1 },
    { ...record(), buildingName: '' },
    { ...record(), parcelAddress: null },
    { ...record(), source: 'unknown' },
    { ...record(), fetchedAt: 'not a date' },
  ];
  for (const item of invalidRecords) {
    throwsCode(() => normalizeRegistry({ status: 'found', records: [item] }), 'unavailable');
  }
  for (const invalid of [
    null, {}, { status: 'found', records: [] },
    { status: 'not-found', records: [record()] },
    { status: 'multiple', records: [] },
    { status: 'found', records: 'not an array' },
  ]) throwsCode(() => normalizeRegistry(invalid), 'unavailable');
});

test('client encodes query/address parameters and returns normalized responses', async () => {
  const requests = [];
  const client = createClient({ endpoint, fetcher: async (url, options) => {
    requests.push({ url: new URL(url), options });
    return response(new URL(url).searchParams.get('action') === 'search'
      ? { mode: 'hybrid', results: [place()] }
      : { status: 'found', records: [record()] });
  } });
  const places = await client.search('  테스트   아파트 & 상가  ');
  assert.equal(places.length, 1);
  assert.equal(requests[0].url.searchParams.get('q'), '테스트 아파트 & 상가');
  const registry = await client.registry({ parcelAddress: record().parcelAddress, buildingName: record().buildingName });
  assert.equal(registry.records[0].buildingId, record().buildingId);
  assert.equal(requests[1].url.searchParams.get('action'), 'registry');
  assert.equal(requests[1].url.searchParams.get('parcelAddress'), record().parcelAddress);
  assert.equal(requests[1].url.searchParams.get('buildingName'), record().buildingName);
  for (const { options } of requests) {
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
  }
});

test('already cancelled lookup never starts a network request', async () => {
  let called = false;
  const client = createClient({ endpoint, fetcher: async () => { called = true; return response({}); } });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(client.search('테스트 아파트', controller.signal), error => error?.name === 'AbortError');
  assert.equal(called, false);
});

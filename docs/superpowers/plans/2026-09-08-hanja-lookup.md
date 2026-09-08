# Hanja centering and faster approval lookup

> **For agentic workers:** Execute with systematic-debugging and test-driven-development. Independent UI and lookup work may run in parallel; review their integration before release.

**Goal:** Center the actual visible characters in natal/fortune squares and overlap registry latency with explicit address selection.

**Architecture:** Keep the existing equal-sized CSS grid. Measure actual font ink rather than assuming a centered line box means centered text. For lookup, keep one bounded prepared registry request associated with the current explicit search; transfer that request when its address is selected and discard it on cancellation or expiry.

**Tech stack:** Static HTML/CSS/JavaScript; existing Puppeteer, sharp and Node tests; unchanged Netlify registry gateway.

**Spec:** User's 2026-09-08 screenshot and requests: vertical centering inside character boxes, faster building approval-date lookup. Existing lookup contract is in `../../building-lookup.md`.

## Global constraints

- Preserve eight equal natal squares and existing responsive flow square sizes.
- Preserve Hanja as selectable accessible text, color roles, labels, navigation and calculations.
- Verify actual screenshot ink within 1.5 CSS px of the square center at phone and desktop sizes, with tested fallback fonts.
- Do not invent dates, choose a building/dong automatically, or overwrite manual input from a late request.
- Add no persistent lookup cache, service worker, localStorage or sessionStorage results. Keep fetch `cache: no-store`.
- Prepare at most the first address after an explicit search, and only with validated `exact` or `close` confidence. Do not fan out across candidates; skip broad/unknown confidence.
- Prepared state is current-search-only, expires after 30 seconds, and is discarded on input edit, manual birth/name/calendar/gender edit, navigation or panel close.
- Changing original fengshui APIs, credentials, deployment settings or external data is out of scope.

## Task 1: Actual glyph centering

Files: `apple.css`, `index.html`, optional focused `hanja-alignment.js`, `scripts/build-protected.ps1` if a new runtime file is introduced, `tests/hanja-ink-alignment-ui.js`, `tests/natal-alignment-ui.js`, `tests/ui-regression.js`.

- [x] Establish RED with screenshot pixels: `.han` line centers pass but natal ink is 1.75–2.75px below center and flow ink reaches 2.25px.
- [x] Measure current resolved font and glyph ink, using Canvas TextMetrics and the DOM baseline if required. Store only font metrics, never user lookup data. Apply a bounded CSS optical offset; retain centered CSS fallback when measurement is unavailable.
- [x] Recalculate for newly rendered flow cells, font readiness and responsive resizing. No polling loop or animated correction.
- [x] Change old tests that equate line-box center with ink center: retain square/row invariants and require the raster test to verify the visual contract.
- [x] Run `node tests/hanja-ink-alignment-ui.js`, `node tests/natal-alignment-ui.js`, `node tests/design-consistency-ui.js` and the `motion-contract` UI regression group.
- [x] Inspect full natal/flow screenshots, including `?`, at phone and desktop widths, not only cropped individual glyphs.

## Task 2: Prioritized active-search preparation

Files: `building-lookup.js`, `building-lookup.css` only if needed, `tests/building-lookup-prefetch-ui.js`, `docs/building-lookup.md`.

Interface: unchanged `createClient().search(query, signal)` and `.registry({parcelAddress, buildingName}, signal)`. Internal prepared state tracks the selected-search token, parcel/name key, AbortController, promise/result and expiration.

- [x] Write browser tests before production edits. Hold the real fetch boundary and assert registry starts before clicking the first candidate, only one candidate is prepared, selection reuses the pending request, and a prepared response never opens an unselected chart.
- [x] Implement one prepared request immediately after displaying an explicit search's candidates. Show a small truthful date/record-count preview on its own candidate after successful validation. Differing dong dates must not be collapsed into one asserted date.
- [x] On matching selection, transfer the existing pending/ready request into the foreground operation without aborting it or issuing a duplicate. On another selection, cancel the prepared request and query the chosen address.
- [x] Expire prepared state after 30 seconds. Errors must not become stale success. A foreground explicit retry remains usable; do not background-loop retries or ignore 429.
- [x] Exercise search edits, manual inputs, navigation, collapse, different selection, expiration, malformed response, no-result, multiple dong, late response and repeat search. Keep all existing cancellation guards.
- [x] Run `node --test tests/building-lookup.test.js`, new prefetch UI test, existing `node tests/building-lookup-ui.js`, and one bounded real lookup smoke.

## Integration and release

- [x] Independent review of both diffs and edge cases.
- [x] Update CSS/JS version queries; retain existing cache-removal policy.
- [ ] Run relevant regression commands, inspect screenshots, commit only scoped files, and push the previously authorized Manse web deployment.
- [ ] Verify GitHub Pages success, public file hashes and public browser behavior. Report measured latency without promising a fixed upstream response time. APK is not requested in this turn.

## Evidence / progress

- Baseline HEAD: `174aad53b8406c0f67300ac7f5b5e10490f98e97`; clean web checkout.
- Read-only real lookup sample: search 2.416s; gateway registry 4.291s; pinned registry 3.091s. All returned matching official records; sequential samples do not isolate network-hop overhead.
- Upstream geocoder's own caching and public-provider latency remain external limitations; no shared backend mutation is planned.
- Final local verification: independent screenshot ink tests at 390/1280px, DPR 1/2, Noto Serif KR/Batang/sans-serif, resize and monthly selection passed; maximum center error was 1.5 CSS px. Unsupported Canvas/text and spacing reset fallbacks passed without observer loops.
- Regression verification: natal alignment 20 cases, design consistency 12 cases, motion contract, default UI regression at 360/390/412/768px, building prefetch 30 cases, existing building UI at five widths, and 19 annual/long-reading/building unit tests passed.
- Independent final phone raster rerun at DPR 2 passed with maximum vertical error 0.75 CSS px. Full natal and flow screenshots were inspected.
- Public-provider smoke before release returned 46 matching dong records with approval date 2006-01-27 (search 2.389s, registry 3.660s). Preparation overlaps registry latency with address selection; it does not make the upstream API intrinsically faster.
- Web release only: the new helper is included in the future protected-build copy list; no APK, physical-device check or external Android release-contract verification is claimed here.

# 주소로 건물 만세력 열기

입력 화면의 **건물 날짜 조회**를 펼쳐 주소나 건물명을 검색한다. 주소 검색 결과를 선택하면 건축물대장을 조회한다. 한 건이면 원국으로 바로 이동하고, 여러 건물·동이면 선택한 동의 원국을 연다. 날짜를 양력으로 설정하고 시각은 미상으로 유지한다.

도로명·지번처럼 번지가 포함된 주소는 건물대장을 바로 조회한다. 조회 실패·결과 없음·지연은 입력 화면에서 안내한다. 주소를 바꾸면 진행 중 요청과 이전 결과를 취소한다. 이름·날짜·시간·양음력을 수동 변경하면 해당 건물 정보는 다음 계산에 붙이지 않는다.

## 날짜의 의미

실제 조회 필드는 국토교통부 건축HUB의 `useAprDay`(사용승인일)이다. 별도의 공사 완료일을 수집하거나 추정하지 않는다. 원국에 실제 조회한 주소·날짜·출처를 표시한다. 건물 날짜의 년월일 간지는 기존 만세력 계산을 사용하며, 새로운 풍수 계산이나 건물용 대운 규칙을 추가하지 않는다. 대운·풀이는 기존 사주 설정 기준임을 표시한다.

## 재사용한 시스템

- 원본 사이트: https://chwimyeongseon-pungsu.netlify.app/
- 원본 소스: `C:/Users/whaak/Documents/Codex/2026-07-27/new-chat`
- 주소 검색: `netlify/functions/geocode.ts`
- 건물대장: `netlify/functions/buildingRegistryV2.ts`
- 만세력 연결 함수: `netlify/functions/manseBuildingLookup.ts`
- 만세력 클라이언트: `building-lookup.js`

연결 함수는 원본 서비스의 고정된 주소 검색·건물대장 API만 호출한다. 두 조회 모두 기존 인증 설정이 있는 고정 배포(`6a676270dae8e08ba1c2ae05`)로 직접 연결한다. 중간 주소 서버의 2초 제한과 불필요한 건물대장 중계 단계를 피하기 위한 구성이다. 검색 후보는 카카오 주소만 전달하며, OSM에서 도로 건물번호를 지번처럼 조합한 주소를 건물대장 조회에 사용하지 않는다. 주소 제공자의 첫 번째 법정동코드·지번 조회와 건물대장 최대 100건 조회, 표제부에 날짜가 없을 때 총괄표제부를 확인하는 방식은 원본을 따른다. 모든 건물에서 날짜가 제공된다고 보장하지 않는다.

## API와 운영

`https://chwimyeongseon-pungsu.netlify.app/.netlify/functions/manseBuildingLookup`

- `GET ?action=search&q=...`: 주소·건물명 후보
- `GET ?action=registry&parcelAddress=...&buildingName=...`: 건물·동별 사용승인일
- 허용 출처: `https://jansang18.github.io`, Capacitor의 `https://localhost`, `http://localhost`, `capacitor://localhost`, 로컬 확인용 8765 포트
- 비밀 키는 기존 서버에만 있다. GitHub Pages·APK에 키를 복사하지 않는다.
- 서버 제한: 20초, 응답 512 KiB, 입력 200자, 분당 30회. 원본 서버 제한도 적용된다.
- 일시적인 502·503·504 또는 네트워크 오류는 250ms 뒤 한 번만 재시도한다. 대기와 두 요청 모두 같은 20초 제한·취소 신호를 따른다. 429와 형식이 잘못된 정상 응답은 재시도하지 않는다.
- 캐시: 게이트웨이 `no-store`, 클라이언트 `cache: no-store`; 신규 CSS·JS 파일은 릴리스 버전 쿼리 사용. 기존 서비스워커 제거 정책 유지.
- 원본 서버는 키가 설정되지 않은 경우 이전 고정 배포의 API에 의존한다. 그 배포나 계정이 삭제되면 서버의 원래 키 설정을 복원해야 한다.

## 검증

- `node --test tests/building-lookup.test.js`
- `node tests/building-lookup-ui.js` (기존 Puppeteer 의존성 경로를 `NODE_PATH`에 지정)
- `node tests/building-lookup-live.js` (실제 주소/건물대장 데이터, 기본 로컬 8765; `BUILDING_BASE_URL`로 공개 만세력 검사)
- 원본 서버 프로젝트: `npm run test:run -- netlify/tests/manseBuildingLookup.test.ts`
- 기존 UI 회귀·서명 APK 빌드는 `scripts/build-protected.ps1` 절차를 따른다.

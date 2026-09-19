# 공개 생년월일 보강 목록

확인일: 2026-09-19. 데이터: `people-supplement.js`.

나무위키의 인물 이름·생년월일을 공식 프로필과 교차 확인한 수동 검증 목록이다.
본문·사진을 수집하거나 나무위키에 실시간 요청하는 기능이 아니다. 공식 프로필에서
확인한 공개 날짜 사실만 사용하며, 출생시간은 전원 미상이다. 입력은 양력으로 적용한다.
성별 기본값은 공개 그룹 프로필의 남성/여성 그룹 분류에 근거하며 입력 후 수정할 수 있다.

기존 Wikidata 내장 목록 10,016개에 12개를 추가하고, 동일 이름/별칭 및 동일 생년월일로
일치한 기존 인물 4개의 출처를 보강한다. 다른 날짜의 동명이인은 덮어쓰지 않는다.

## 공식 출처

- BABYMONSTER: [YG 공식 프로필](https://www.ygfamily.com/en/artists/babymonster/profile)
- ILLIT: [일본 공식 프로필](https://illit-official.jp/profile), [BELIFT LAB](https://beliftlab.com/artist/profile/ILLIT)
- TWS: [일본 공식 프로필](https://tws-official.jp/profile), [PLEDIS 그룹 프로필](https://www.pledis.co.kr/ko/artist/detail/TWS/profile/)

## 대조한 인물

| 인물 | 양력 생년월일 | 나무위키 참고 문서 |
| --- | --- | --- |
| 루카 / BABYMONSTER | 2002-03-20 | [루카(BABYMONSTER)](https://namu.wiki/w/루카(BABYMONSTER)) |
| 파리타 / BABYMONSTER | 2005-08-26 | [파리타](https://namu.wiki/w/파리타) |
| 아사 / BABYMONSTER | 2006-04-17 | [아사(BABYMONSTER)](https://namu.wiki/w/아사(BABYMONSTER)) |
| 라미 / BABYMONSTER | 2007-10-17 | [라미(BABYMONSTER)](https://namu.wiki/w/라미(BABYMONSTER)) |
| 치키타 / BABYMONSTER | 2009-02-17 | [치키타](https://namu.wiki/w/치키타) |
| 윤아 / ILLIT | 2004-01-15 | [윤아(ILLIT)](https://namu.wiki/w/윤아(ILLIT)) |
| 민주 / ILLIT | 2004-05-11 | [민주(ILLIT)](https://namu.wiki/w/민주(ILLIT)) |
| 모카 / ILLIT | 2004-10-08 | [모카(ILLIT)](https://namu.wiki/w/모카(ILLIT)) |
| 원희 / ILLIT | 2007-06-26 | [원희(ILLIT)](https://namu.wiki/w/원희(ILLIT)) |
| 이로하 / ILLIT | 2008-02-04 | [이로하(ILLIT)](https://namu.wiki/w/이로하(ILLIT)) |
| 신유 / TWS | 2003-11-07 | [신유(TWS)](https://namu.wiki/w/신유(TWS)) |
| 도훈 / TWS | 2005-01-30 | [도훈](https://namu.wiki/w/도훈) |
| 영재 / TWS | 2005-05-31 | [영재(TWS)](https://namu.wiki/w/영재(TWS)) |
| 한진 / TWS | 2006-01-05 | [한진(TWS)](https://namu.wiki/w/한진(TWS)) |
| 지훈 / TWS | 2006-03-28 | [지훈(TWS)](https://namu.wiki/w/지훈(TWS)) |
| 경민 / TWS | 2007-10-02 | [경민(TWS)](https://namu.wiki/w/경민(TWS)) |

나무위키 대조에는 검색 색인에 노출된 공개 프로필을 사용했다. 루카·원희·이로하·영재는
색인에서 확인된 특정 문서 버전 URL을 `evidence.namuEvidenceUrl`에 별도로 보관했다.
문서의 현재 내용이 계속 동일하다는 보장은 하지 않는다. 앱의 확인창에는 공식 프로필,
나무위키 원문 링크, 확인일을 제공한다.

## 연결 및 갱신 규칙

1. `mergeLocal`: 이름/별칭 검색에 연결한다. 원본 목록을 변경하지 않고 병합한다.
2. `forDate`: 월일만 같다는 이유로 매칭하지 않는다. 양력 연·월·일이 모두 같아야 한다.
3. `mergeCandidates`: 기존 온라인 결과와 동일 인물이면 실제 조회수 등을 유지한다.
4. 온라인 장애 시에도 내장 보강 목록을 표시한다. 조회수 없는 인물에는 순위를 만들지 않는다.
5. 추가 시 공식 프로필과 공개 참고 문서의 날짜를 다시 확인하고 출처·확인일을 기록한다.
   날짜가 불명확하거나 충돌하면 추가하지 않는다. 비공개 생년월일과 추정 출생시간은 금지한다.

## 확인 명령

```powershell
node --test tests/people-supplement.test.js
node tests/people-supplement-ui.js
```

브라우저 검사는 `puppeteer-core`와 Chrome이 필요하다. `PEOPLE_WIDTHS`, `PEOPLE_SCHEMES`,
`PEOPLE_URL`로 검증 범위/대상을 지정할 수 있다. 이 기능의 데이터 갱신은 웹 배포 또는
APK 재빌드로 배포하며, 기존 설치 APK의 내장 파일이 자동으로 바뀌는 것은 아니다.

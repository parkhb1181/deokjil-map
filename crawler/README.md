# crawler

이벤트 데이터 수집기. 앱 코드와 분리돼 있지만 **로컬 전용이 아니다** —
`.github/workflows/refresh-data.yml` 이 매일 04:00 KST 에 돌리고
`github-actions[bot]` 이름으로 `events.json` 을 커밋한다.

```
node crawler/run.mjs --source all --limit 700 --days 90   # 수집 → data/raw/crawl/<source>.json
node crawler/to-events.mjs                                # 정규화 → src/data/events.json
node crawler/to-events.mjs --all                          # K-pop 필터 없이 전부
node crawler/to-events.mjs --out data/raw/시험.json        # 원장·배포본을 건드리지 않고 시험
```

**kopis 는 인증키가 필요하다.** 맨 node 는 `.env.local` 을 자동으로 읽지 않는다.

```
node --env-file=.env.local crawler/run.mjs --source kopis
```

## 원칙

수집 자체보다 **어떻게 수집하느냐**가 이 프로젝트의 리스크다.
아래는 지키기로 한 선이며, 편의를 위해 낮추지 않는다.

1. **robots.txt 를 실행 전에 확인한다.** `run.mjs` 는 대상 경로가 허용되지 않으면
   아무것도 하지 않고 종료한다. 우회하지 않는다.
2. **자신을 밝힌다.** User-Agent 에 프로젝트명과 저장소 주소를 넣는다.
   브라우저인 척하지 않는다.
3. **요청 간격을 둔다.** 700ms 고정. 상대 서버에 부하를 주지 않는 것이 목적이지
   차단을 피하려는 것이 아니다.
4. **차단된 경로는 건드리지 않는다.** 팝플리의 `/api/` 처럼 robots.txt 가
   막아둔 경로는 접근하지 않는다. 내부 API 를 직접 호출하지 않는다.
5. **원본을 재게시하지 않는다.** 수집 원본은 `data/raw/` 에만 두고 커밋하지 않는다.
   앱에는 사실 정보(장소·기간·시간)만 싣고 **원문 링크를 반드시 노출**한다.
6. **출처를 속이지 않는다.** 팝가에서 온 데이터의 `sourceUrl` 은 팝가 링크이고
   `trust` 는 `parsed` 다. 확인하지 않은 것을 `official` 로 올리지 않는다 
   그 표기가 틀리면 poc-plan 1번의 정합성 방어가 통째로 무너진다.

## robots.txt 확인 결과 (2026-08-27)

| 사이트 | 규칙 | 판단 |
| --- | --- | --- |
| popga.co.kr | `User-Agent: * / Allow: /`, 차단은 `/login`·`/enterprise*` | `/popup/*` **허용** |
| popply.co.kr | `User-agent: * / Allow: /`, `Disallow: /api/`. ClaudeBot 명시 허용 | 페이지 허용, **API 금지** |
| offmate.kr | `User-agent: * / Allow: /`, 차단 경로 없음 | `/place/birthday-cafe/*` **허용** |
| dukplace.com | 봇별로 분리, 일부 크롤러 차단 | **수집 대상에서 제외** |
| kopis.or.kr | **해당 없음** — 공식 오픈API 다 | 인증키로 접근. 대신 **초당 10회**를 넘기면 중지된다 |

## 소스

### popga (`sources/popga.mjs`)

- 색인: `sitemap/2.xml`, 팝업 상세 2,800건 이상, `lastmod` 포함
- 상세는 서버 렌더링. Next.js RSC 페이로드 안에 팝업 레코드가 JSON 으로 들어 있다
- **좌표(`latitude`/`longitude`)가 포함돼 지오코딩이 필요 없다**
- 뽑는 필드: `title` `periodType` `openDate` `closeDate` `operationTime`
  `categories` `tags` `address` `roadAddress` `addressDetail` `latitude` `longitude`

RSC 페이로드 형식은 Next 버전에 따라 바뀔 수 있다. 필드명 앵커로 잘라내는 방식이라
전체 구조가 바뀌어도 필드명만 유지되면 계속 동작한다. 깨지면 `extract()` 만 고치면 된다.

### offmate (`sources/offmate.mjs`)

- 색인: `sitemap-2.xml` 의 `/place/birthday-cafe/detail/<id>`
- 상세는 Next.js SSR. `__NEXT_DATA__` 에 레코드가 통째로 들어 있다
- **좌표도 아티스트도 구조화돼 있다** (`cafeAddressLat/Lng` · `memberName`/`groupName`).
  팝가에서 겪은 두 문제(지오코딩·K-pop 판정)가 여기선 없다
- 호스트 인증된 건은 `trust` 가 `PARTNER` 다. 나머지는 `PARSED`

### kopis (`sources/kopis.mjs`)

**공식 오픈API 다.** 크롤링이 아니라 인증키로 받으므로 `robots.txt` 판정이
해당하지 않고, `run.mjs` 가 이 소스만 게이트를 건너뛴다.

**일일 호출 한도는 없다 (2026-09-08 확인).** [이용제한](https://kopis.or.kr/por/cs/openapi/openApiList.do?menuId=MNU_00074)
에서 호출량에 걸리는 것은 **초당 10회**뿐이다. `lib/http.mjs` 의 700ms 간격이
세 소스를 통틀어 직렬화하므로 최대 1.43회/초, 제한의 1/7 이다. 건수 총량
제한이 아니라서 **`--limit` 은 한도 때문이 아니라 잡 실행 시간 때문에 잡는다** —
호출 수가 `⌈N/100⌉ + N + 고유 공연장 수`(실측 N=238 에서 약 341회)이고
700ms 가 곱해진다.

**출처 표기는 아직 안 되어 있다.** 이용제한이 「출처가 명시되지 않을 경우
서비스가 중단될 수 있음」 이라 적고 있는데 상세 화면에는 링크뿐이다.
`출처 : (재)예술경영지원센터 공연예술통합전산망, www.kopis.or.kr` 같은
명시가 콘서트 배포 시점에 필요하다.

세 번 부른다. 목록에는 좌표도 시설 식별자도 없다.

| 호출 | 얻는 것 |
| --- | --- |
| 공연목록 `/pblprfr` | `mt20id` · 공연명 · 기간 · 지역 · 장르 |
| 공연상세 `/pblprfr/{mt20id}` | `mt10id` · `dtguidance`(회차) · `prfcast` · 예매처 |
| 공연시설상세 `/prfplc/{mt10id}` | **`la` · `lo` · `adres`** |

- 응답이 XML 이다. 필요한 필드가 스무 개 남짓이라 의존성 없이 태그로 잘라낸다
- **API 는 `http` 만 응답한다.** 사용자에게 보여주는 공개 상세 페이지는 `https` 다
- 서울·대중음악은 요청 파라미터(`signgucode` · `shcate`)로 좁힌다. 응답에도
  `area` · `genrenm` 이 있지만 전국 전 장르를 받아서 버리면 **상세 호출이 그만큼
  늘고 잡이 그만큼 길어진다** — 목록 1건당 상세 1회다
- 같은 공연장에서 여러 공연이 열려 시설 응답은 `mt10id` 로 캐시한다
- **`prfcast` 는 믿을 게 아니다.** 대개 비어 있고, 있어도 본명이다 —
  산들이 `이정환`, 태민이 `이태민` 으로 온다. 그래서 K-pop 판정은 제목으로 한다

### 검토했으나 쓰지 않는 것

- **팝플리**, 상세 페이지에 schema.org `Event` JSON-LD 가 있어 품질이 좋지만,
  사이트맵에 상세 URL 이 없어 색인을 만들 수 없다. 검색 페이지는 JS 렌더링이고
  내부 API 는 robots.txt 가 막았다. ID 순회는 무차별 스캔이라 하지 않는다
- **덕플레이스**, robots.txt 가 일부 크롤러를 막고 있고 403 을 반환한다
- **카카오 검색 API**, REST 키로 동작 확인. 생일카페 관련 문서가 잡히지만
  커뮤니티 잡담이 섞여 정밀도가 낮다. 생카 보강용으로 남겨둔다
- **X / 인스타그램**, 로그인 벽. poc-plan 5.3 대로 X API 는 쓰지 않는다
- **인터파크**, 콘서트가 가장 많지만 `robots.txt` 가 전면 금지다. 그래서 콘서트는
  공공 API(kopis)가 유일한 경로였다

## 수집과 가공의 분리

`run.mjs` 는 원본을 그대로 저장하고, `to-events.mjs` 가 필터·정규화를 한다.
필터 기준을 바꿀 때 상대 서버를 다시 두드리지 않기 위한 분리다.

`to-events.mjs` 가 하는 일:

- 서울 밖 제외, 좌표 없는 것 제외
- **종료된 것 제외**, 지난 정보는 없는 정보보다 나쁘다 (poc-plan 4.3)
- K-pop 판정, 카테고리(`연예인/셀럽` 등) 또는 태그로 1차 필터.
  팝가는 K-pop 여부를 구분하지 않으므로 **재현율을 우선**하고 정밀도는 사람이 올린다
- 주소·태그로 구역(`hongdae`/`hapjeong`/`seongsu`/…) 판정
- **수집원(`source`)을 적는다.** 화면은 안 읽고 적재만 쓴다 (아래)

## 적재는 이 디렉터리 밖이다

`scripts/upsert-events.mjs` 가 `events.json` 을 백엔드로 밀어 넣는다
(`POST /api/v1/ingest/events/bulk`). 여기가 아닌 이유는 **수집이 아니라 전달**이고,
`validate-events.mjs` 와 같은 결이라서다 — 둘 다 크롤러 산출물을 입력으로 받는다.

```
INGEST_API_BASE=... INGEST_KEY=... node scripts/upsert-events.mjs
node scripts/upsert-events.mjs --dry     # 보낼 모양만 찍는다
```

**시크릿이 없으면 스스로 건너뛴다.** KOPIS 키가 없을 때 그 소스만 건너뛰는 것과
같은 판단이다 — 백엔드 배포보다 이 경로가 먼저 들어가 있어서, 없는 것을 실패로
세면 매일 빨간 실행이 쌓이고 진짜 고장이 그 빨강에 섞인다.

파이프라인 전체와 왜 이 단계가 앱과 무관한지는 `src/data/README.md` 가 적었다.

## 남은 한계

**굿즈 품목 마스터가 없다.** 어느 소스도 굿즈 목록을 주지 않아 `goods` 는 빈 배열이다.
P1 홍보 훅이 "팝업 굿즈 품절 현황"이므로, 굿즈 라인업은 **팝업 공식 계정 스크린샷**을
`data/raw/popup/` 에 넣어 따로 채워야 한다.

**콘서트 커버리지가 화이트리스트에 묶인다.** 서울 대중음악은 90일에 200건이 넘는데
대부분이 인디·재즈·발라드·내한이다. 장르만으로 담으면 목록의 절반 이상이 K-pop 이
아닌 공연이 되므로 `kpop-artists.json` 으로 거른다. **빠진 것은 조용히 사라지므로**
누락 후보를 좌석 규모 순으로 뽑아 Actions 실행 요약에 띄운다 — 아이돌 콘서트는 큰
공연장에서 열려서 큰 것부터 훑는 것이 사람의 시간을 아낀다.

**짧은 이름은 제목 선두에서만 인정한다.** 한국어에 단어 경계가 없어 부분일치를
허용하면 `영 카이 첫 내한공연` 이 엑소 카이로 잡힌다. 콘서트 제목은 아티스트명이
맨 앞이라 이 제한으로 잃는 것이 거의 없다.

**서울만 담는다.** 지역 코드가 전부 서울 권역이고 지도·필터도 서울 전제다.

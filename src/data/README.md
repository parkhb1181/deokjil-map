# src/data

## events.json

앱이 읽는 **유일한 이벤트 소스**. 빌드타임에 번들된다.

**손으로 만들지 않는다.** `crawler/` 가 매일 04:00 KST 에 갱신하고 커밋한다
(`.github/workflows/refresh-data.yml`). 수집원과 판정 근거는 위키
`02-설계-아키텍처/행사-수집원.md` 가 정본이다.

| 종류 | 소스 | `trust` |
| --- | --- | --- |
| 팝업 | 팝가 | `PARSED` |
| 생일카페 | 오프메이트 | 호스트 인증 시 `PARTNER`, 아니면 `PARSED` |
| 콘서트 | KOPIS 오픈API | `PARSED` |

**건수는 여기 적지 않는다.** 크롤링마다 바뀌므로 적으면 그날부터 틀린 문서가 된다.

`trust` 가 전부 `official` 이 아닌 이유는, 우리가 정리한 것이지 공식 채널에서 직접
받은 것이 아니기 때문이다. **확인하지 않은 출처를 공식이라고 표기하면 정합성 방어
장치(poc-plan 1번)가 통째로 무너진다.** 검증기가 `OFFICIAL` 을 아예 막는다.

굿즈는 어느 소스도 품목을 주지 않아 `goods` 가 빈 배열이다. 실제 라인업은 공식
채널에만 있어 **팝업 공식 계정 스크린샷이 들어와야 채워진다.**

### events.sample.json

개발용 가상 데이터 12건. 앱은 읽지 않는다.
레이아웃·필터 확인용으로 남겨둔 것이며, 대상·장소명이 전부 가상이고
`source_url`은 `example.com`이다. 실제 일정으로 오인될 여지를 없애기 위함이다.

### 이미지 정책

`image_url`은 **선택 필드**다. 없거나 로드에 실패하면 대상명 기반 색 블록으로 폴백한다
(`src/lib/visual.ts`). 수집한 URL은 원본이 지워지면 깨지므로 폴백은 예외가 아니라 상시 경로다.

이미지를 쓰는 이상 **출처 표기와 원문 링크는 필수**이며, 푸터에 권리자 요청 시
즉시 삭제한다는 문구를 상시 노출한다.

### 샘플이 커버하는 경우의 수

필터·표시 로직을 전부 태우도록 구성했다.

| 축 | 포함된 값 |
| --- | --- |
| `district` | hongdae(3) · hapjeong(6) · seongsu(2) · gangnam(1) |
| `kind` | birthday_cafe(9) · popup(3) |
| `subject_type` | idol(9) · virtual(1) · character(2), 아이돌에 묶지 않는 스키마 확인용 |
| `trust` | parsed(9) · official(3) |
| 기간 | 종료 임박(evt_0004) · 진행 중 · 주말만 · 다음 주 시작 |
| `image_url` | 있음(5) · 없음(7), 폴백 경로를 함께 확인하기 위함 |
| `goods` | 팝업 3건만 보유. 생카는 빈 배열 |

`evt_0004`는 **오늘 종료**되도록 잡아뒀다. 종료 임박 표시와 날짜 필터 경계를 확인하는 용도다.
합정을 6건으로 몰아둔 것은 가로 레일이 실제로 스크롤되는 상태를 보기 위함이다.

### 파이프라인

```
① 수집    crawler/run.mjs         → data/raw/crawl/<source>.json
② 정규화  crawler/to-events.mjs   → src/data/events.json
③ 검증    scripts/validate-events.mjs
④ 커밋    github-actions[bot]
⑤ 적재    scripts/upsert-events.mjs → 백엔드 POST /api/v1/ingest/events/bulk
```

**⑤ 는 이 앱과 무관하다.** 화면은 ④ 가 커밋한 JSON 을 본다. 백엔드 DB 가 `V3`
시드에 멈춰 있어서 매일 만든 것을 그쪽에도 밀어 넣는 것이고, 전환은 나중이다
(EV-08). 그래서 ⑤ 가 실패해도 그날 배포는 정상이다 — 워크플로가
`continue-on-error` 로 부른다.

좌표는 세 소스 모두 응답에 들어 있어 지오코딩이 필요 없다. `scripts/geocode.mjs`
(카카오 로컬 API)는 좌표가 빠진 레코드를 메우는 예비 경로로 남겨 둔다.

원본(트윗 덤프, 안내 이미지)은 `data/raw/`에 두고 **커밋하지 않는다**, `.gitignore` 처리됨.
안내 이미지 자체를 재게시하지 않는다는 원칙(poc-plan 4.4) 때문이다.

### 스키마

`src/types.ts`의 `EventItem`이 정본이다.
전체 구상(bridge-plan-full.md 7번) Postgres 스키마와 필드명을 일치시켜 두었으므로,
PoC 통과 후 승격 시 매핑 없이 그대로 넘어간다.

**`source` 하나는 그 타입에 없다.** 적재(⑤)만 쓰는 필드다 — 백엔드가 수집원을
요청에 명시하라고 요구하고(`id` 접두어에서 유도하지 않는다), 값을 넣는 것은
`crawler/to-events.mjs` 다. `EventItem` 에 넣지 않은 이유는 그 타입이 **화면
계약**이고 `/api/v1/events` 응답에 `source` 가 없어서다. 필수로 두면 API 경로의
매퍼(`src/lib/api/events.ts`)가 만들어낼 수 없는 필드를 요구하게 된다.
화면에서 쓸 일이 생기면 그때 응답에 실어 함께 올린다.

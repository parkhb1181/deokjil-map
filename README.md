# duckmoim-frontend

덕모임. 서울에서 열리는 생일카페와 팝업을 위치 축으로 모아 보여주는 웹.
[duckmoim.com](https://duckmoim.com)

콘서트·생카에 **같이 갈 사람을 찾는 것**이 가려는 방향이고, 지금은 그
앞단인 "어디서 뭐가 열리는지"를 모으는 단계까지 열려 있다.

## 파일 구조

무엇이 어디 있는지보다 **누가 고치는지**로 나눴다. 사람이 고칠 것과
기계가 고칠 것을 섞으면 사고가 난다.

```
.
├─ src/                      앱. 사람이 고친다
│  ├─ app/                   App Router. 라우트당 한 폴더
│  │  ├─ page.tsx            홈. 목록·지도·내 코스를 해시 라우팅으로 전환
│  │  ├─ a/[subject]/        대상별 페이지 + 대상별 OG 이미지 (SSG)
│  │  ├─ e/[id]/             이벤트 상세 (SSG)
│  │  ├─ globals.css         토큰과 전역 스타일. 라이트 전용
│  │  ├─ sitemap.ts robots.ts manifest.ts opengraph-image.tsx
│  │  └─ icon.png apple-icon.png    파비콘. 로고와 별개로 관리한다
│  ├─ components/            화면 단위. 상태는 SaveContext 하나만 전역
│  ├─ lib/                   순수 함수. filters, route, course, subject-slug 등
│  ├─ data/events.json       ★ 봇이 고친다. 손대지 마라
│  └─ types.ts               EventItem 스키마. 여기가 데이터 계약이다
│
├─ crawler/                  수집. 사람이 고친다
│  ├─ run.mjs                수집 진입점. 느리다(8분+)
│  ├─ to-events.mjs          정규화 → src/data/events.json
│  ├─ sources/               팝가(팝업), 오프메이트(생카)
│  └─ kpop-artists.json      화이트리스트. 누락 후보가 뜨면 여기에 추가
│
├─ scripts/                  빌드·운영 보조
│  ├─ og-shots.mjs           prebuild. OG용 사진을 미리 굽는다
│  ├─ validate-events.mjs    빈 데이터가 배포되는 걸 막는다
│  ├─ check-port.mjs         predev. 3000 점유 검사
│  └─ geocode.mjs indexnow.mjs
│
├─ public/
│  ├─ intro/                 ★ 소개 페이지. Next 라우트가 아니라 정적 HTML
│  │                         한 장 + 에셋이다. /intro 로 나가는 건
│  │                         next.config.ts 의 rewrite 다
│  ├─ logo.png logo-og.png duck.png
│  └─ *.txt                  검색엔진 소유확인 파일
│
├─ docs/design/              디자인 자료. 배포에 안 실린다
│  ├─ BRIEF.md photos/       사진 출처와 쓰지 않기로 한 컷의 이유
│  └─ duck3d/                오리 컷아웃 원본
│
├─ .github/workflows/
│  ├─ refresh-data.yml       ★ 우리 것. 매일 04:00 KST 데이터 갱신
│  └─ jira-*.yml             ▲ 팀 공용. 함부로 고치지 마라
├─ .github/scripts/          ▲ 팀 공용 (Jira 연동)
├─ .githooks/                ▲ 팀 공용 (커밋 메시지)
│
├─ CLAUDE.md                 ★ 에이전트가 읽는다. 아래 참고
├─ .claude/launch.json       개발 서버 기동 설정
└─ next.config.ts            이미지 최적화, /intro rewrite
```

★ 표시는 **고치기 전에 한 번 더 생각할 것**, ▲ 는 **다른 사람 소유**다.

### 에이전트가 읽는 파일

`CLAUDE.md` 에 작업 규칙이 있다. 규칙을 고칠 때 두 가지를 기억한다.

- **Claude Code 는 `AGENTS.md` 가 아니라 `CLAUDE.md` 를 읽는다.** 둘 다 두려면
  `CLAUDE.md` 에 `@AGENTS.md` 한 줄을 넣어 내용을 한 벌만 유지한다
- **Next.js 16.3 부터 `next dev` 가 `AGENTS.md` 를 자동으로 만들고 갱신한다.**
  이 저장소가 16.3.3 이라 곧 저절로 생긴다. 지워도 다시 생기니 그대로 커밋한다.
  직접 쓸 내용은 `BEGIN:nextjs-agent-rules` 마커 **바깥에** 쓴다. 안에 쓰면 날아간다

## 실행

```bash
npm install
npm run dev        # localhost:3000, 포트 고정
npm run build      # 타입체크 + 빌드
```

포트가 고정인 이유는 카카오 JS 키의 도메인 등록이 **포트까지 일치**해야
하기 때문이다. `predev` 가 3000 점유를 미리 검사한다.

키가 없으면 지도가 리스트로 폴백한다. 정상 경로다. `.env.example` 참고.

## 데이터

`src/data/events.json` 이 앱이 읽는 유일한 소스다. 빌드타임 번들이라
데이터를 바꾸려면 커밋이 필요하다.

```bash
node crawler/run.mjs --source all --limit 700 --days 90   # 수집, 8분+
node crawler/to-events.mjs                                # 정규화
```

**필터 기준만 바꿀 때는 `to-events.mjs` 만 돌린다.** 수집 원본이
`data/raw/crawl/` 에 남아 있어 상대 서버를 두 번 두드릴 이유가 없다.

이 두 단계는 `.github/workflows/refresh-data.yml` 이 **매일 04:00 KST**
자동으로 돌리고 바뀐 게 있을 때만 커밋한다. 사람이 볼 곳은 하나,
Actions 실행 요약에 뜨는 **화이트리스트 누락 후보**다. K-pop 인데 빠진
이름이 있으면 `crawler/kpop-artists.json` 에 추가하면 된다.

## 배포

Vercel 이 `main` 푸시를 받아 배포한다. 도메인과 환경변수는 Vercel
프로젝트에 붙어 있다.

## 읽을 것

작업 규칙은 [CLAUDE.md](CLAUDE.md) 에 있다. 출처 표기, 원본 재게시 금지,
크롤러 원칙, 날짜 다루는 법 같은 **어기면 사용자가 헛걸음하는 것들**이
적혀 있으니 코드 고치기 전에 한 번 읽는 편이 낫다.

- [docs/FRONTEND.md](docs/FRONTEND.md) **화면 작업 현황.** 다른 컴퓨터에서 이어받을 때 여기부터
- [docs/harness/frontend.md](docs/harness/frontend.md) 프론트 하네스. 규칙을 어디에 두고 무엇이 자동인지
- [poc-plan.md](poc-plan.md) 지금 만드는 것
- [bridge-plan-full.md](bridge-plan-full.md) PoC 이후 구상
- [docs/design/](docs/design/) 소개 사이트 자료와 사진 출처

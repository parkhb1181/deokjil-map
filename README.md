# youstar-frontend

덕모임. 서울에서 열리는 생일카페와 팝업을 위치 축으로 모아 보여주는 웹.
[duckmoim.com](https://duckmoim.com)

콘서트·생카에 **같이 갈 사람을 찾는 것**이 가려는 방향이고, 지금은 그
앞단인 "어디서 뭐가 열리는지"를 모으는 단계까지 열려 있다.

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

- [poc-plan.md](poc-plan.md) 지금 만드는 것
- [bridge-plan-full.md](bridge-plan-full.md) PoC 이후 구상
- [docs/design/](docs/design/) 소개 사이트 자료와 사진 출처

# 목데이터 아바타

`public/avatar/a1~a5.webp` 는 개발용 가짜 계정의 프로필 사진이다.
Unsplash 사진을 160px 정사각으로 잘라 구웠다. 상업적 사용까지
허용되는 라이선스다.

사람 얼굴 대신 동물을 쓴 이유가 있다. 실제 인물 사진을 가짜 계정에
붙이면 그 사람을 사칭하는 모양이 된다. 화면을 팀에 공유하거나
캡처가 밖으로 나갈 때 문제가 된다.

가운데를 그냥 자르지 않고 sharp 의 attention 으로 잘랐다. 사진마다
얼굴 위치가 달라 가운데를 자르면 몸통만 남는 것이 생긴다.

| 파일 | 원본 |
|---|---|
| a1 | amber-kipp-75715CVEJhI |
| a2 | manja-vitolic-gKXKBY-C-Dk |
| a3 | dusan-veverkolog-KspFBnvmQ3o |
| a4 | milli-2l0CWTpcChI |
| a5 | peri-stojnic-5Vr_RVPfbMI |

실제 서비스에서는 사용자가 올린 사진이 들어간다. 이 파일들은
API 가 붙으면 지운다.

# STRATA 실시간 방 (함께 보기)

- 배포: Cloudflare Workers `strata-realtime` (Durable Objects, SQLite 백엔드, WebSocket Hibernation)
- 주소: `wss://strata-realtime.kjk02468.workers.dev/room?r=main`
- 방 정원 10명. 이름·위치·코디는 접속하는 동안만 메모리에 있고 저장하지 않습니다.
- 허용 출처: `https://kjk02468-cloud.github.io`, 로컬(`localhost`, `127.0.0.1`)

로컬 실행: `npm i -D wrangler && npx wrangler dev` → 뷰어를 `RT_URL=ws://127.0.0.1:8787`로 빌드
재배포: `npx wrangler deploy` (Cloudflare 로그인 필요)

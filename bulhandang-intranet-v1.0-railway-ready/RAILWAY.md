# Railway 배포 안내

이 버전은 Railway의 관리형 PostgreSQL에서도 실행되도록 앱 시작 시 `db/init.sql`을 자동 적용합니다.

## Railway 앱 서비스 Variables
아래만 앱 서비스에 설정하세요.

NODE_ENV=production
SESSION_SECRET=<길고 랜덤한 문자열>
ADMIN_EMAIL=<관리자 이메일>
ADMIN_PASSWORD=<강력한 비밀번호>
DATABASE_URL=${{Postgres.DATABASE_URL}}

`PORT`는 Railway가 제공하므로 직접 고정하지 않는 것을 권장합니다.

## 배포
1. 이 폴더를 GitHub 저장소에 push
2. Railway → New Project → Deploy from GitHub repo
3. 같은 프로젝트에서 Create/New → Database → PostgreSQL
4. 앱 서비스 → Variables에서 위 변수 입력
5. Deploy
6. 앱 서비스 → Settings → Networking → Generate Domain
7. 생성된 `*.up.railway.app` 주소로 접속

## 커스텀 도메인
앱 서비스 → Settings → Networking → Custom Domain에서 도메인을 추가한 뒤,
Railway가 안내하는 DNS 레코드를 도메인 업체에 등록합니다.

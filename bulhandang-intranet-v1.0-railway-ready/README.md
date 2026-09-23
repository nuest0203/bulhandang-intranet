# 불한당 인트라넷 v1.0

Node.js + Express + PostgreSQL + PostgreSQL 세션 기반 운영용 기본 프로젝트입니다.

## 포함 기능
- 실제 로그인/로그아웃
- bcrypt 비밀번호 해시
- HttpOnly 세션
- ADMIN / LEADER / MEMBER 권한
- 조직원 관리
- 공지사항
- 출석
- 활동 로그
- 기동타격대
- 불야식
- 파스텔 블루 + 오렌지 UI
- Docker Compose
- PostgreSQL 세션 저장소

## 실행

1. `.env.example`을 복사해 `.env`를 만듭니다.
2. 최소한 다음 값을 변경합니다.
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `SESSION_SECRET`
   - `POSTGRES_PASSWORD`
   - `DATABASE_URL`의 비밀번호 부분
3. 실행:
   ```bash
   docker compose up --build
   ```
4. 접속:
   `http://localhost:3000`

최초 기동 시 `ADMIN_EMAIL` / `ADMIN_PASSWORD`로 ADMIN 계정이 자동 생성됩니다.

## 운영 배포 전 체크
- HTTPS 적용
- 강한 `SESSION_SECRET` 사용
- 강한 PostgreSQL 비밀번호 사용
- Railway/VPS 등에서 환경변수로 비밀값 관리
- 도메인 연결
- DB 백업 정책 설정
- 운영 로그/모니터링 설정

## 권한
- ADMIN: 전체 관리 + 활동 로그
- LEADER: 공지/기동타격대/조직원 조회
- MEMBER: 일반 기능 이용

주의: 이 v1.0은 운영 가능한 기본 골격이며, 공개 인터넷에 바로 노출하기 전에 HTTPS, 백업, 레이트리밋, CSRF 방어, 보안 헤더, 관리자 비밀번호 정책 등을 추가하는 것을 권장합니다.

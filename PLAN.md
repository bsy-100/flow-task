# Task Flow PLAN
## 작업 원칙
한 번에 아래 작업 하나만 구현한다. 실제 확인 전에는 완료로 표시하지 않는다.
상태는 [ ] 미완료, [x] 확인 완료로 관리하고 확인 결과를 각 항목 아래 기록한다.
## 2장: 브라우저 앱
- [x] T01: frontend/index.html, styles.css, app.js 생성. 제목 입력·등록·목록만 구현한다.
  확인: 두 항목 등록, 빈 제목 거절. 이 단계에서 새로고침하면 사라져도 정상이다.
  기록: 변경 파일 frontend/index.html, styles.css, app.js. 포트 5501 서버에서 세 파일 200 응답.
  node로 app.js 로직 확인: 두 항목 등록, 공백·빈 제목 거절, 101자 거절, 100자 허용, <b>x</b>는 글자 그대로.
  브라우저(127.0.0.1:5500) 확인: 두 항목 등록, 빈 제목 거절, 이상 없음. 남은 오류 없음.
- [x] T02: localStorage(task-flow-v1) 저장·복원.
  확인: 새로고침 후 유지. 손상된 저장값을 자동 덮어쓰지 않는다.
  기록: 변경 파일 frontend/app.js. node에서 localStorage를 흉내 내 확인: 두 항목 저장 후 복원, 복원 뒤 id 이어서 증가(1,2,3),
  손상 JSON·잘못된 형식 3종은 덮어쓰지 않고 오류 표시, 이 경우 등록 차단, 빈 제목 거절 유지.
  브라우저(127.0.0.1:5500) 확인: 새로고침 후 유지, 손상값(task-flow-v1을 {not json으로 수정) 시 오류 표시·덮어쓰지 않음, 이상 없음. 남은 오류 없음.
- [x] T03: 상태 변경, 수정, 삭제 확인.
  확인: 삭제 취소 시 유지. 다른 항목이 수정되지 않는다.
  기록: 변경 파일 frontend/app.js, styles.css. 상태(TODO/DOING/DONE) 선택, 제목 수정(prompt), 삭제(confirm). 모두 화면 순번이 아닌 id로 처리.
  node에서 DOM·localStorage를 흉내 내 확인: 2번만 상태 변경·수정되고 1·3번 유지, 빈·101자 제목 수정 거절, 수정 취소 유지,
  삭제 취소 시 유지, 삭제 확인 시 해당 항목만 제거·저장, 삭제 후 복원해도 id 중복 없음, T02 구형 데이터(status 없음)는 TODO로 표시하고 저장값은 덮어쓰지 않음,
  손상값·잘못된 status는 오류 표시 후 변경 차단. 설명은 T04 범위라 추가하지 않음.
  브라우저(127.0.0.1:5500) 확인: 상태 변경·수정·삭제 취소·삭제 확인·새로고침 유지, 이상 없음. 남은 오류 없음.
- [x] T04: 설명·우선순위·마감일·검색·필터·지연 표시.
  확인: 필터 중 수정·삭제, 어제 마감 TODO의 지연 표시.
  기록(1단계: 설명·우선순위·마감일·지연 표시): 변경 파일 frontend/index.html, styles.css, app.js. 등록 시 설명(2000자 이하)·우선순위(기본 NORMAL)·마감일(선택, 기본 null) 입력,
  수정은 제목에 이어 설명을 입력, 마감일이 오늘보다 이전이고 DONE이 아니면 지연 표시(로컬 날짜 기준). 우선순위·마감일 수정은 PRD F04 범위 밖이라 추가하지 않음.
  node에서 DOM·localStorage를 흉내 내 확인: 어제 마감만 지연(오늘·내일·마감 없음은 아님), DONE이면 지연 해제·TODO 복귀 시 다시 지연,
  설명 2001자·없는 날짜·형식 오류·잘못된 우선순위 거절, 설명 수정 중 취소 시 변경 없음, 마감일 유지, T02·T03 구형 데이터는 기본값으로 표시하고 저장값은 덮어쓰지 않음,
  잘못된 저장값 3종은 오류 표시, HTML 설명은 글자 그대로.
  1단계 브라우저(127.0.0.1:5500) 확인: 이상 없음.
  기록(2단계: 검색·필터): 변경 파일 frontend/index.html, styles.css, app.js. 제목 검색(대소문자·앞뒤 공백 무시), 상태 필터, 우선순위 필터를 AND로 적용. 필터 값은 저장하지 않음.
  node에서 DOM·localStorage를 흉내 내 확인: 검색·상태·우선순위 단독 및 AND 조합 결과 정확, 조건 불일치 시 '조건에 맞는 할 일이 없습니다.' 표시,
  우선순위 필터 중 화면 2번째 항목(전체 3번째)의 수정·삭제·상태 변경이 정확한 항목에만 적용, 삭제 취소 시 유지, 필터 중 등록·지연 표시 정상.
  2단계 브라우저(127.0.0.1:5500) 확인: 검색·필터 AND, 필터 중 수정·상태 변경·삭제 취소·삭제 확인, 지연 표시, 이상 없음. 남은 오류 없음.
## 3장: API
- [x] T05: API-SPEC.md 작성, FastAPI /api/health 구현.
  확인: curl로 200과 status=ok.
  기록: 변경 파일 API-SPEC.md, backend/__init__.py, backend/main.py, requirements.txt(fastapi==0.143.0, uvicorn==0.54.0), .gitignore(.venv/, __pycache__/, .env).
  실행 명령: python3 -m venv .venv, .venv/bin/python -m pip install fastapi uvicorn, .venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000.
  확인: curl http://127.0.0.1:8000/api/health → HTTP 200, {"status":"ok"}. 없는 경로는 404, /docs 200. 확인 후 서버 종료.
  사용자 확인: 직접 curl로 확인, 이상 없음. 남은 오류 없음.
- [ ] T06: 메모리 기반 /api/tasks GET과 POST.
  확인: /docs에서 등록 후 조회. 입력 위반은 422.
- [ ] T07: PATCH·DELETE와 필터 구현.
  확인: 미전달 필드 유지, 없는 ID 404, 삭제 204.
- [ ] T08: 프런트엔드 저장 처리를 API 호출로 교체.
  확인: 화면과 curl 목록이 같음. API 중지 시 오류 표시.
## 4장: DB
- [ ] T09: MariaDB 전용 사용자·DB와 .env 준비. 접속 확인.
- [ ] T10: backend/database.py, models.py, init_db.py 생성.
  확인: python -m backend.init_db 실행 후 tasks 테이블 확인.
- [ ] T11: API 메모리 저장을 DB로 교체.
  확인: 등록한 행을 SQL로 조회. API 재시작 후 데이터 유지.
## 5장: 서버 분리
- [ ] T12: DB 서버 구성 후 App 서버에서 SELECT 1 확인.
- [ ] T13: App 서버 코드·가상환경·환경변수·systemd 구성.
  확인: App에서 /api/health 응답.
- [ ] T14: Web 서버 Nginx와 정적 파일·/api 프록시 구성.
  확인: Web 주소로 등록, DB 저장, App 재시작 후 유지.
## 실행 기준
T01~T04: python3 -m http.server 5500 --bind 127.0.0.1 --directory frontend
T05~T11: 가상환경에서 python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
실제 존재하는 파일을 확인한 뒤 명령을 실행한다.
## 기록
각 작업에 변경 파일, 실행 명령, 실제 확인 결과, 남은 오류를 기록한다.
정상 동작을 확인한 작업 단위로 Git 커밋한다.
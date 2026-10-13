# Task Flow API 명세

PRD.md의 요구사항을 기준으로 한다. 요청·응답 본문은 JSON이며 경로는 모두 `/api`로 시작한다.
구현 상태는 각 항목에 표시한다. 구현되지 않은 항목은 해당 PLAN 작업에서 확정·구현한다.

## 공통 규칙
- 수정과 삭제는 목록 순번이 아닌 고유 `id`로 처리한다.
- 입력 검증 위반은 `422`, 없는 `id`는 `404`를 반환한다.
- 입력값은 서버에서도 검증한다. 화면 검증에만 의존하지 않는다.

## Task 데이터
| 필드 | 형식 | 규칙 |
|---|---|---|
| id | 정수 | 서버가 부여, 변경 불가 |
| title | 문자열 | 앞뒤 공백 제거 후 1~100자 |
| description | 문자열 | 최대 2000자, 기본값 빈 문자열 |
| status | 문자열 | `TODO`, `DOING`, `DONE`, 기본값 `TODO` |
| priority | 문자열 | `HIGH`, `NORMAL`, `LOW`, 기본값 `NORMAL` |
| due_date | 문자열 또는 null | `YYYY-MM-DD`, 미지정은 `null` |
| created_at | 문자열 | 서버가 부여, ISO 8601 |

지연 여부는 저장하지 않고 화면에서 로컬 달력 날짜 기준으로 계산한다(F09).

## 엔드포인트

### GET /api/health — 구현됨 (T05)
서버 동작 확인용.
- 응답 `200`: `{"status": "ok"}`

### GET /api/tasks — 구현됨 (T06, 필터 T07)
- 응답 `200`: Task 배열(등록 순서). 저장소는 메모리이며 API를 재시작하면 비워진다.
- 쿼리(모두 선택, 함께 주면 AND): `q`(제목 검색, 대소문자·앞뒤 공백 무시), `status`, `priority`
- 조건에 맞는 항목이 없으면 `200`과 빈 배열. 잘못된 `status`·`priority` 값은 `422`.

### POST /api/tasks — 구현됨 (T06)
- 요청: `title`(필수), `description`, `status`, `priority`, `due_date`(선택). `id`, `created_at` 등 명세에 없는 필드는 허용하지 않는다.
- `title`, `description`은 앞뒤 공백을 제거한 값으로 검증·저장한다.
- 응답 `201`: 생성된 Task
- 입력 위반(빈·공백 제목, 101자 제목, 2001자 설명, 잘못된 status·priority, 없는 날짜·형식 오류, 알 수 없는 필드, 잘못된 JSON): `422`. 저장하지 않는다.

### PATCH /api/tasks/{id} — 구현됨 (T07)
- 요청: 바꿀 필드만 전달한다(`title`, `description`, `status`, `priority`, `due_date`). 전달하지 않은 필드는 유지한다. 빈 본문 `{}`은 변경 없이 `200`.
- `due_date`만 `null`을 허용한다(마감일 해제). 다른 필드를 `null`로 보내면 `422`.
- 검증 규칙은 POST와 같고, `id`·`created_at` 등 알 수 없는 필드는 `422`.
- 응답 `200`: 수정된 Task
- 없는 id: `404`, 입력 위반이나 숫자가 아닌 id: `422`. 실패한 요청은 데이터를 바꾸지 않는다.

### DELETE /api/tasks/{id} — 구현됨 (T07)
- 응답 `204`(본문 없음). 삭제한 id는 다시 부여하지 않는다.
- 없는 id: `404`

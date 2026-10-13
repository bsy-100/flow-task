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

### GET /api/tasks — 예정 (T06, 필터는 T07)
- 응답 `200`: Task 배열
- 쿼리(T07, 모두 선택, 함께 주면 AND): `q`(제목 검색), `status`, `priority`

### POST /api/tasks — 예정 (T06)
- 요청: `title`(필수), `description`, `status`, `priority`, `due_date`(선택)
- 응답 `201`: 생성된 Task
- 입력 위반: `422`

### PATCH /api/tasks/{id} — 예정 (T07)
- 요청: 바꿀 필드만 전달한다. 전달하지 않은 필드는 유지한다.
- 응답 `200`: 수정된 Task
- 없는 id: `404`, 입력 위반: `422`

### DELETE /api/tasks/{id} — 예정 (T07)
- 응답 `204`(본문 없음)
- 없는 id: `404`

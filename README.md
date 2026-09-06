# Figure Draw

사내 피규어 배포 이벤트용 가챠 PWA 작업 프로젝트.

- GitHub: https://github.com/SSuperWasabi/event-game-figure-draw
- Pages: https://ssuperwasabi.github.io/event-game-figure-draw/
- 앱 직접 주소: https://ssuperwasabi.github.io/event-game-figure-draw/app/
- 기반: [기존 쿠지 PWA](https://github.com/SSuperWasabi/event-game-gatcha), v31, 커밋 a1c264c21a304d5e3a0b83fbb79ece4418277a4f

## 현재 상태

기존 앱의 화면·디자인·추첨·관리자 기능을 복제한 초기 베이스다. 피규어 이벤트용 문구·에셋·추첨 규칙은 후속 작업에서 적용한다. 현재 화면과 설치 이름에는 기존 쿠지앱의 내용이 남아 있다.

localStorage 키와 IndexedDB 이름, 서비스 워커 캐시 이름은 기존 앱과 분리했다. 새 서비스 워커는 자기 앱 접두사의 캐시만 정리한다. 기존 앱의 구형 서비스 워커는 같은 origin의 다른 캐시를 삭제할 수 있어, 두 앱을 같은 브라우저에서 함께 운영하기 전 기존 앱 쪽 정리 범위도 확인해야 한다.

## 구성

- `app/`: PWA 본체와 동봉 에셋
- `index.html`: 앱으로 이동하는 루트 진입점
- `KUJI-REFERENCE-ANALYSIS.md`: 기존 코드 분석과 후속 보완 사항
- `.nojekyll`: GitHub Pages 정적 파일 배포

GitHub Pages는 main 브랜치 루트를 배포한다. 빌드 및 패키지 설치 과정은 없다.

로컬 확인: 프로젝트 폴더에서 `python -m http.server 8000` 실행 후 `http://localhost:8000/app/` 접속. 현재 베이스는 localhost에서 서비스 워커를 등록하지 않으므로 오프라인 설치 검증은 배포 주소에서 한다.

## 원본 에셋

작업 폴더 루트의 PNG 원본과 `reference-kuji/`는 로컬 참조용으로 Git에서 제외했다. 특히 100MB를 넘는 원본이 있어 그대로 일반 Git 커밋에 포함하지 않는다. 앱에 사용할 최적화본은 후속 작업에서 `app/assets/`에 추가한다. `.kuji` 운영 백업도 Git에서 제외한다.

## 운영 전 검증

이 초기 배포는 실제 행사 준비 완료본이 아니다. 새 이벤트의 콘텐츠·규칙 적용, 원본 분석에 기록된 오프라인/저장 오류 보완, 실기기 확인이 남아 있다. 기존 앱 폴더의 README는 과거 운영 가이드로, 최신 동작은 분석 문서와 실제 코드를 기준으로 확인한다.

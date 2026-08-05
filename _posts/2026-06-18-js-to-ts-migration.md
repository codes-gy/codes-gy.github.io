---
title: "JavaScript 프로젝트를 TypeScript로 점진적으로 전환하는 5단계 전략"
date: 2026-06-18
last_modified_at: 2026-07-15
categories:
  - "타입스크립트"
tags:
  []
excerpt: "기존 자바스크립트 프로젝트의 서비스를 중단하지 않고, tsconfig 환경 설정부터 자바스크립트 파일을 하나씩 .ts로 바꾸어 나가는 실무 마이그레이션 전략입니다."
toc: true
toc_sticky: true
---


서비스가 성장하고 코드베이스가 커질수록 JavaScript의 동적 타이핑은 양날의 검이 됩니다. 생산성은 높지만, 런타임에 예상치 못한 `Cannot read property of undefined` 에러가 발생해 서비스 안정성을 위협하기 때문입니다. 이러한 이유로 수많은 개발 팀이 TypeScript로의 전환을 결심합니다.


하지만 이미 프로덕션에서 활발히 구동 중인 수만 줄의 JavaScript 코드를 한 번에 TypeScript로 바꾸는 것은 불가능에 가깝습니다. 비즈니스 기능을 새로 개발하면서 기존 시스템을 빅뱅 방식으로 전환하다가는 감당할 수 없는 버그와 배포 지연을 마주하게 됩니다. 가장 현명한 접근법은 "점진적 마이그레이션(Gradual Migration)"입니다. 2026년 현재 모던 아키텍처 환경에서도 권장되는, 기존 서비스를 안전하게 유지하며 시스템 체질을 바꾸는 5단계 전략을 소개합니다.


## 1단계: 환경 설정 및 공존 레이어 구축 (`allowJs` 활성화)


점진적 전환의 첫걸음은 JavaScript와 TypeScript 코드가 프로젝트 내부에서 사이좋게 공존할 수 있는 환경을 만드는 것입니다. 소스 코드를 건드리기 전에 인프라 세팅부터 시작합니다.


먼저 TypeScript 컴파일러와 필수 타입을 설치합니다.


```bash
npm install -D typescript @types/node
```



그리고 프로젝트 루트에 `tsconfig.json`을 생성하고, **`allowJs: true`** 설정을 반드시 활성화해야 합니다.




```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "allowJs": true,           // ⚠️ JS 파일 컴파일 허용 (점진적 전환의 핵심)
    "checkJs": false,          // 초기에는 JS 파일의 타입 검사를 끔
    "outDir": "./dist",
    "strict": false,           // 1단계에서는 엄격한 검사를 비활성화
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```


`allowJs`가 활성화되면 기존 `.js` 파일들을 그대로 유지한 채, 새로운 기능만 `.ts` 파일로 작성해 나가며 빌드 시스템을 일원화할 수 있습니다.


## 2단계: JSDoc과 `checkJs`를 활용한 런타임 리스크 없는 타입 힌트 확보


코드를 `.ts` 파일로 확장명을 바꾸기 전, 기존 JavaScript 파일의 안정성을 먼저 높이는 단계입니다. 파일 확장자를 바꾸면 Git 커밋 히스토리가 깨지거나 예기치 못한 컴파일 에러 수백 개가 한 번에 터질 수 있습니다.


이때 `tsconfig.json`에서 `checkJs: true`를 켜거나, 마이그레이션을 시작할 특정 JS 파일 상단에 **`// @ts-check`** 주석을 한 줄 추가합니다.


```javascript
// @ts-check
/**
 * @param { { id: number; name: string } } user
 * @returns { string }
 */
function welcomeMessage(user) {
  // 컴파일러가 JSDoc을 읽고 타입 검사를 수행합니다.
  return `안녕하세요 ${user.name}님!`;
}
```


이 방식을 쓰면 코드를 자바스크립트로 유지하면서도 코드 에디터(VS Code 등)의 타입 추론과 오타 잡아내기 기능을 100% 누릴 수 있습니다. 리스크를 제로로 유지하며 내부 인터페이스 규격을 정리하는 아주 영리한 샌드박스 단계입니다.


## 3단계: 도메인 독립적 모듈부터 `.ts` 확장자 전환 (Bottom-Up 방식)


체력이 확보되었다면 본격적으로 파일 확장자를 `.js`에서 `.ts`로 변경합니다. 이때 가장 중요한 규칙은 의존성 그래프의 최하단에 있는 파일부터 공략하는 것(Bottom-Up)입니다.


컨트롤러나 라우터처럼 다른 모듈을 많이 불러오는 유저 관문 계층을 먼저 바꾸면 연결된 하위 JS 모듈들의 타입이 꼬여 지옥문이 열립니다. 대신 아래 순서대로 뼈대부터 바꿉니다.

1. **Utils / Helpers**: 다른 모듈에 의존하지 않는 순수 유틸리티 함수 (`dateFormatter.js` ➡️ `.ts`)
2. **Models / DTOs / Schemas**: 데이터의 구조를 정의하는 엔티티 및 스키마 계층
3. **Services**: 비즈니스 로직 처리 계층
4. **Controllers / Routes**: 최상위 진입점 계층

이 단계에서는 완벽한 타입을 짜려고 스트레스받을 필요가 없습니다. 타입을 즉시 정의하기 어려운 복잡한 객체는 과감히 `any`나 `unknown`을 임시로 부여하여 컴파일러 통과 스코어를 확보하는 것이 진도율을 높이는 비결입니다.


## 4단계: `any` 제거 및 엄격한 타이핑 도입 (`noImplicitAny`)


모든 파일이 `.ts`로 바뀌었다면 프로젝트는 안정화 궤도에 오른 것입니다. 하지만 코드 곳곳에 임시로 박아둔 `any`가 남아있다면 TypeScript의 진가를 절반밖에 쓰지 못하는 상태입니다. 이제 시스템의 '나사'를 죄어야 할 시간입니다.


`tsconfig.json`으로 돌아가서 **`noImplicitAny: true`** 옵션을 활성화합니다. 암묵적으로 `any`로 추론되는 코드가 있을 때 컴파일러가 에러를 내도록 강제하는 것입니다.


```json
{
  "compilerOptions": {
    "allowJs": false,          // 이제 JS 파일은 존재하지 않으므로 꺼줌
    "noImplicitAny": true,     // 암묵적 any 금지 (강력한 타입 안전성 1단계)
    "strictNullChecks": true   // null/undefined 접근 차단
  }
}
```


이 단계에서 기존에 헐겁게 작성했던 `any` 코드들을 인터페이스(`interface`)나 타입 별칭(`type`)으로 구체화하고, 제네릭(Generic)을 도입하여 재사용 가능한 무결점 타입 레이어를 완성합니다.


## 5단계: 완전한 엄격 모드 활성화 및 빌드 파이프라인(CI/CD) 강제


마지막 단계는 시스템이 과거의 느슨한 JavaScript 형태로 역행하는 것을 기술적으로 원천 차단하는 인프라 고도화 단계입니다.


`tsconfig.json`의 최종 보스인 `strict: true`를 활성화합니다. 이 옵션은 앞서 언급한 엄격한 null 체크, 컨텍스트 타이핑 등 모든 타입 안전성 옵션을 패키지로 켜주는 모던 개발의 표준 사양입니다.


그리고 GitHub Actions 같은 CI/CD 파이프라인의 배포 스크립트에 컴파일 검증 명령어를 강제합니다.


```yaml
# GitHub Actions 배포 스크립트 예시
- name: Run TypeScript Compile Check
  run: npx tsc --noEmit
```


`--noEmit` 옵션은 실제 빌드 파일을 뽑지는 않고 오직 전체 프로젝트의 **'타입 컴파일 에러' 존재 여부만 체크**하는 명령어입니다. 단 한 줄이라도 타입 안전성을 위반한 코드가 깃허브에 푸시되면 배포 파이프라인이 즉시 차단되므로, 완벽하게 정돈된 시스템 헌법을 영구히 유지할 수 있게 됩니다.




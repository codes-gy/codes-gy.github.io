---
title: "TypeScript와 Jest를 활용한 Node.js 백엔드 단위 테스트(Unit Test) 및 모킹(Mocking) 핵심 정리"
date: 2026-06-18
last_modified_at: 2026-07-15
categories:
  - "테스트"
tags:
  []
excerpt: "Jest와 ts-jest를 연동하여 백엔드 비즈니스 로직을 검증하고, 외부 API나 데이터베이스 의존성을 격리하기 위한 Mocking 기법의 핵심을 정리합니다."
toc: true
toc_sticky: true
---


Node.js 백엔드 애플리케이션이 커질수록, 내가 작성한 코드가 기존 기능에 영향을 주지 않는지 보장하는 단위 테스트(Unit Test)의 중요성은 더욱 커집니다. 특히 정적 타이핑을 지원하는 **TypeScript** 환경에서 테스트 프레임워크인 **Jest**를 결합하면 매우 안전하고 강력한 테스트 환경을 구축할 수 있습니다.


이번 포스팅에서는 TypeScript + Node.js 환경에서 Jest를 활용해 단위 테스트를 작성하는 방법과, 외부 의존성(DB, 외부 API)을 격리하기 위한 모킹(Mocking)의 핵심 개념을 명확하게 정리해 보겠습니다.


## 1. 단위 테스트(Unit Test)란?


단위 테스트는 애플리케이션에서 분리 가능한 가장 작은 단위(주로 함수나 메서드)가 의도한 대로 정확히 작동하는지 검증하는 테스트입니다.

- **목적**: 데이터베이스나 외부 네트워크 등 외부 환경에 의존하지 않고, 오직 **내가 작성한 로직의 순수성**만 검증합니다.
- **장점**: 테스트 실행 속도가 밀리초(ms) 단위로 매우 빠르며, 리팩토링 시 코드의 안정성을 즉각적으로 피드백받을 수 있습니다.

## 2. 개발 환경 세팅 (TypeScript + Jest)


TypeScript 환경에서 Jest를 실행하려면 TypeScript를 JavaScript로 컴파일해 주는 변환기(`ts-jest`)와 타입 정의 파일이 필요합니다.


패키지 설치


```bash
npm install -D jest ts-jest @types/jest typescript
```


### Jest 설정 파일 (`jest.config.js`)


프로젝트 루트 디렉토리에 테스트 가이드라인을 정의하는 설정 파일을 생성합니다.


```typescript
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  verbose: true,
};
```


### 테스트 코드 (`src/services/userService.test.ts`)


Jest가 제공하는 `describe`, `test`, `expect` 문법을 활용해 정상 케이스와 예외 케이스를 모두 검증합니다.


```typescript
import { createUser } from './userService';

describe('UserService - createUser 단위 테스트', () => {
  // 1. 정상 작동 케이스
  test('올바른 인자가 들어오면 유저 객체를 반환해야 한다', () => {
    const result = createUser('테스터', 'test@example.com');
    
    expect(result).toHaveProperty('id');
    expect(result.name).toBe('테스터');
  });

  // 2. 예외 발생 케이스
  test('이메일 형식에 @가 없으면 에러를 던져야 한다', () => {
    expect(() => {
      createUser('테스터', 'bad-email-format');
    }).toThrow('유효하지 않은 이메일 형식입니다.');
  });
});
```


## 4. 모킹(Mocking)의 핵심 개념과 활용


단위 테스트를 작성하다 보면 외부 데이터베이스를 조회하거나, 외부 결제 API를 호출하는 로직을 마주하게 됩니다. 테스트를 실행할 때마다 실제로 DB를 찌르거나 결제를 요청할 수는 없으므로, 이 핵심 의존성을 가짜 객체로 대체하는 것을 모킹(Mocking)이라고 합니다.


Jest에서는 크게 두 가지 모킹 방식을 주로 사용합니다.


### 4-1. `jest.spyOn()`을 활용한 특정 메서드 모킹


기존 모듈의 실제 구현은 유지하면서, 특정 함수가 몇 번 호출되었는지 감시하거나 임시로 반환 값을 가짜로 바꾸고 싶을 때 사용합니다.


```typescript
import { database } from '../infrastructure/db';
import { getUserCount } from './analyticsService';

test('DB 유저 수 카운트 로직 검증', async () => {
  // database.query 메서드를 감시하고, 가짜 결과값([ { count: 5 } ])을 반환하도록 설정
  const dbSpy = jest.spyOn(database, 'query').mockResolvedValue([{ count: 5 }]);

  const count = await getUserCount();
  
  expect(count).toBe(5);
  expect(dbSpy).toHaveBeenCalledTimes(1); // 실제로 1번 호출되었는지 검증
  
  dbSpy.mockRestore(); // 다른 테스트에 영향을 주지 않도록 모킹 원상복구
});
```


### 4-2. `jest.mock()`을 활용한 모듈 전체 모킹


`axios` 같은 외부 라이브러리나 파일 전체를 통째로 가짜로 바꿀 때 유용합니다.


```typescript
import axios from 'axios';
import { fetchExternalProfile } from './paymentService';

// 외부 모듈인 axios를 통째로 모킹하겠다고 선언
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

test('외부 API 호환성 테스트', async () => {
  // axios.get이 항상 아래의 가짜 데이터를 주도록 세팅
  mockedAxios.get.mockResolvedValue({ data: { nickname: 'NodeJS_Master' } });

  const profile = await fetchExternalProfile(123);
  expect(profile.nickname).toBe('NodeJS_Master');
});
```


## 5. 마치며, 좋은 단위 테스트를 위한 규칙

1. **테스트는 독립적이어야 합니다**: 한 테스트의 결과가 다른 테스트의 실행에 영향을 주면 안 됩니다. (`beforeEach`, `afterEach` 활용)
2. **하나의 테스트는 한 가지만 검증합니다**: 테스트 가독성을 높이고 실패 지점을 명확히 찾기 위함입니다.
3. **구현이 아닌 결과를 테스트합니다**: 함수 내부 코드를 바꿨다고 해서 테스트 코드까지 깨진다면 잘못 작성된 테스트일 확률이 높습니다. 인터페이스의 입력과 출력(결과값)을 검증하세요.

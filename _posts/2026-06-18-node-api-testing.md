---
title: "Jest와 Supertest를 활용한 Node.js API 서버 통합 테스트 구축하기"
date: 2026-06-18
last_modified_at: 2026-08-06
categories:
  - "테스트"
tags:
  - "TypeScript"
excerpt: "Jest와 Supertest를 연동하여 실제 HTTP 요청을 시뮬레이션하고, Node.js API 서버의 엔드포인트 비즈니스 로직을 완벽하게 검증하는 통합 테스트 환경을 구축합니다."
toc: true
toc_sticky: true
---


소프트웨어 아키텍처를 설계하고 비즈니스 기능을 확장할 때, 기존 코드가 고장 나지 않았음을 보장하는 유일한 방법은 자동화된 테스트 코드를 구축하는 것입니다. 특히 함수 단위의 격리된 검증을 수행하는 단위 테스트(Unit Test)를 넘어, 라우터, 미들웨어, 데이터베이스 레이어까지 전체 파이프라인의 유기적 흐름을 검증하는 통합 테스트(Integration Test)는 프로덕션 배포 전 무결성을 증명하는 가장 강력한 무기입니다.


이번 포스팅에서는 Node.js 생태계의 표준 테스트 프레임워크인 **Jest**와 HTTP 검증 최적화 라이브러리인 **Supertest**를 결합하여, 실제 가동 중인 서버 환경과 동일하게 API 엔드포인트의 입력과 출력을 완벽히 통제하고 검증하는 통합 테스트 구축 가이드를 공유합니다.


## 1. 통합 테스트 환경의 필수 조건


통합 테스트의 핵심은 "실제 HTTP 요청을 날렸을 때 시스템이 우리가 정의한 RESTful 규격에 맞게 응답하는가"를 확인하는 것입니다. 이를 위해 개발 환경에 필요한 핵심 의존성을 주입합니다.


```plain text
npm install -D jest supertest ts-jest @types/jest @types/supertest
```


### ⚙️ `jest.config.json` 설정


테스트 환경이 안전하게 구동되도록 Jest 환경 설정 파일의 뼈대를 잡습니다.


```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```


## 2. `app`과 `server` 분리하기


Supertest를 활용한 통합 테스트를 작성할 때 많은 개발자가 범하는 치명적인 실수가 있습니다. 테스트 코드가 실행될 때마다 `app.listen(3000)`이 호출되어 "Port 3000 is already in use"라는 포트 충돌 에러와 함께 프로세스가 뻗어버리는 현상입니다.


이를 방지하기 위해 Express/Fastify 인스턴스를 정의하는 계층(`app.ts`)과 실제 네트워크 포트를 열어 바인딩하는 진입점 계층(`server.ts`)을 칼같이 분리해야 합니다.


### 파일 1: `src/app.ts` (서버 설정 및 라우터 정의)


```json
import express from 'express';
const app = express();

app.use(express.json());

// 검증 대상이 될 샘플 RESTful API 엔드포인트
app.get('/api/v1/users/:id', (req, res) => {
  const { id } = req.params;
  if (id === '99') {
    return res.status(404).json({ success: false, message: '존재하지 않는 유저입니다.' });
  }
  return res.status(200).json({ success: true, data: { id, name: '유저' } });
});

export default app;
```



📄 파일 2: `src/server.ts`




```json
import app from './app';
const PORT = process.env.PORT || 3000;

// 테스트 환경에서는 이 파일이 가동되지 않고, 오직 app 인스턴스만 떼어가서 테스트합니다.
app.listen(PORT, () => {
  console.log(`서버가  ${PORT} 포트에서 실행 중입니다.`);
});
```


## 3. 엔드포인트 검증 코드 작성 (`user.test.ts`)


이제 분리된 `app` 구조를 가져와 Supertest로 정상 케이스와 예외 케이스(404 에러 등)를 연쇄적으로 검증하는 통합 테스트 코드를 작성합니다.


```typescript
import request from 'supertest';
import app from '../app';

describe('👥 User API 엔드포인트 통합 테스트', () => {
  
  // 1. 정상 흐름 검증 (200 OK)
  it('GET /api/v1/users/:id - 유효한 ID 요청 시 유저 정보를 올바르게 반환해야 한다.', async () => {
    const response = await request(app)
      .get('/api/v1/users/1')
      .expect('Content-Type', /json/)
      .expect(200); // HTTP 상태 코드 검증

    // 응답 바디 데이터 구조 규격 확인
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toEqual({
      id: '1',
      name: '유저'
    });
  });

  // 2. 예외 흐름 검증 (404 Not Found)
  it('GET /api/v1/users/:id - 존재하지 않는 ID 요청 시 404 에러 스키마를 반환해야 한다.', async () => {
    const response = await request(app)
      .get('/api/v1/users/99')
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toContain('존재하지 않는 유저');
  });
});
```


## 4. 체크리스트


통합 테스트 패키지를 무결점으로 굴리기 위해 현업 DevOps 파이프라인에서 무조건 지켜야 하는 제약사항입니다.

1. **글로벌 DB 커넥션 댕글링(Dangling) 방지**: 테스트가 끝났는데도 데이터베이스 커넥션 풀이 열려 있으면 Jest는 프로세스를 종료하지 못하고 멈춰 서게 됩니다. 각 테스트 스펙 파일 하단이나 글로벌 셋업에 **`afterAll(async () => { await db.close(); });`** 구문을 강제하여 리소스를 반환해야 합니다.
2. **테스트 전용 데이터베이스 격리**: 통합 테스트가 실제 운영(Prod) DB나 개발(Dev) DB의 데이터를 조작하게 두면 기존 데이터가 오염되거나 테스트 결과가 깨집니다. 반드시 `.env.test` 환경 변수를 분리 주입하여 로컬 도커(Docker) 기반의 격리된 인메모리 DB(예: SQLite)나 테스트 전용 스키마에서 `beforeEach` 단계마다 데이터를 초기화(`TRUNCATE`)하고 독립적으로 실행되도록 제어해야 합니다.

## 5. 결론


많은 개발 팀이 일정 압박을 이유로 테스트 코드 작성을 생략하곤 합니다. 하지만 테스트 코드가 없는 프로젝트는 코드를 수정할 때마다 "혹시 다른 곳이 고장 나지 않았을까?" 하는 막연한 두려움 속에 수동으로 API를 하나씩 찔러보는 엄청난 물리적 시간 낭비를 초래하게 됩니다.


Jest와 Supertest로 촘촘하게 짜인 통합 테스트 레이어는 리팩토링이나 기능 추가 시 발생할 수 있는 휴먼 에러를 배포 전에 100% 잡아내는 가장 안전한 브레이크 패드입니다. 시스템의 자동화 수준을 극대하게 올려 배포의 자유와 소프트웨어 아키텍처의 시간 혁신을 안전하게 이룩해 보세요.


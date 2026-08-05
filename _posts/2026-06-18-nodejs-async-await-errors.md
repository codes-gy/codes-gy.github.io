---
title: "Untitled"
date: 2026-06-18
last_modified_at: 2026-06-18
categories:
  - "Node.js"
tags:
  []
excerpt: "비동기 처리 과정에서 개발자가 자주 범하는 실수를 짚어보고, try-catch 문과 Catch-all 미들웨어를 활용한 안정적인 백엔드 에러 핸들링 패턴을 구축합니다."
toc: true
toc_sticky: true
---


`async/await`는 비동기 코드를 동기식 코드 흐름처럼 작성할 수 있게 해주는 마법 같은 문법입니다. 하지만 겉보기에 동기식 코드처럼 생겼다고 해서 내부 동작까지 동기식으로 착각하면 안 됩니다.


실무 코드에서 정말 자주 보이는 안티 패턴들과, 비동기 예외로 인해 서버가 통째로 죽는 현상을 막아주는 정석적인 에러 핸들링 패턴을 알아보겠습니다.


## 1. async/await 사용 시 저지르는 가장 흔한 실수 3가지


### ❌ 실수 1: 의도치 않은 '순차 실행'으로 병목 유발하기 (직렬 처리)


여러 개의 독립적인 비동기 작업을 처리할 때, 아무 생각 없이 모든 줄에 `await`를 붙이면 심각한 성능 저하가 발생합니다.


```typescript
// 이전 작업이 끝날 때까지 무의미하게 기다림
async function getUserDashboard(userId: string) {
  const profile = await db.getProfile(userId); // 1초 소요
  const posts = await db.getPosts(userId);     // 1초 소요
  const alerts = await db.getAlerts(userId);   // 1초 소요
  
  return { profile, posts, alerts }; // 총 3초 소요!
}
```

- **문제점**: 프로필, 포스팅 목록, 알림 내역은 서로 의존성이 없는 독립적인 데이터입니다. 굳이 순서대로 기다릴 필요가 전혀 없습니다.
- **해결책**: `Promise.all`을 이용해 병렬로 동시에 요청해야 합니다.

```typescript
// 병렬 처리로 시간 단축
async function getUserDashboard(userId: string) {
  // 세 작업을 동시에 실행시키고 한 번에 기다림
  const [profile, posts, alerts] = await Promise.all([
    db.getProfile(userId),
    db.getPosts(userId),
    db.getAlerts(userId)
  ]);
  
  return { profile, posts, alerts }; // 총 1초 소요!
}
```


### ❌ 실수 2: `Array.prototype.forEach` 내부에서 `await` 사용하기


배열을 순회하면서 비동기 처리를 하고 싶을 때 `forEach`를 쓰면 십중팔구 버그가 발생합니다.


```typescript
// 루프가 끝나기 전에 함수가 종료됨
async function processUsers(users: User[]) {
  users.forEach(async (user) => {
    await db.updateStatus(user.id); // forEach는 이 await를 기다려주지 않습니다!
  });
  console.log("모든 유저 업데이트 완료?"); // 실제로는 업데이트가 끝나기 전에 출력됨
}
```

- **문제점**: `forEach`는 자바스크립트 내부적으로 콜백 함수가 `async` 함수인지 아닌지 신경 쓰지 않고 그냥 실행해 버립니다. 즉, 비동기 처리가 끝나든 말든 제어권을 넘겨버려 예상치 못한 타이밍 이슈가 생깁니다.
- **해결책**: 순차적으로 실행하고 싶다면 일반 `for...of` 루프를 사용하고, 동시에 실행해도 된다면 `map`과 `Promise.all` 조합을 사용하세요.

```typescript
// 해결책 A (순차 처리 필요 시): 일반 for...of 문 사용
for (const user of users) {
  await db.updateStatus(user.id);
}

// 해결책 B (병렬 처리 가능 시): map + Promise.all 사용
await Promise.all(users.map(user => db.updateStatus(user.id)));
```


### ❌ 실수 3: 비동기 호출 시 `await` 누락 (Floating Promise)


함수를 호출할 때 실수로 `await`를 누락하면 예외 처리가 불가능해져 백엔드가 예기치 않게 종료될 수 있습니다.


```typescript
// await 누락
async function saveLog(message: string) {
  db.insertLog(message);
}
```



만약 `insertLog` 도중 DB 연결 오류 등의 에러가 발생하면, 이 에러를 잡아줄 `try-catch` 스코프가 유실되어 **`UnhandledPromiseRejection`** 에러를 내며 프로세스가 죽을 수 있습니다.




## 2. 백엔드를 견고하게 만드는 비동기 에러 핸들링 패턴


비동기 환경에서의 에러 핸들링은 유저에게 적절한 500 에러를 반환하고 서버의 생존을 보장하는 핵심 인프라입니다.


### 패턴 A: 전통적인 `try-catch`의 정석적인 활용


가장 직관적인 방법이지만, 비동기 에러를 확실하게 잡으려면 **반드시** **`await`****가 동일한** **`try`** **블록 내부에 정착**해 있어야 합니다.


```typescript
async function getProductDetail(productId: string) {
  try {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw new CustomError('상품을 찾을 수 없습니다.', 404);
    }
    return product;
  } catch (error) {
    // 비동기 에러 및 커스텀 에러가 모두 여기로 집결
    logger.error(`상품 조회 실패: ${error.message}`);
    throw error; // 글로벌 에러 핸들러로 위임
  }
}
```


### 패턴 B: Express/NestJS 미들웨어를 활용한 에러 위임 (Best Practice)


컨트롤러 레이어마다 수많은 `try-catch` 떡칠을 하는 것은 가독성에 좋지 않습니다. 라우터 단에서 에러를 안전하게 모아주는 미들웨어 패턴을 사용하세요.


Express 5.0 미만 버전에서는 `async` 함수의 에러를 자동으로 다음 미들웨어로 넘겨주지 않으므로, 아래와 같은 래퍼(Wrapper) 함수를 활용하는 것이 정석입니다.


```typescript
// 비동기 에러를 catch하여 next()로 던져주는 안전한 래퍼 함수
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// 컨트롤러에서는 try-catch 없이 깔끔하게 작성
app.get('/user/:id', asyncHandler(async (req, res) => {
  const user = await userService.find(req.params.id); // 여기서 터진 에러는 자동으로 next로 이동!
  res.json(user);
}));
```


### 패턴 C: Go 스타일의 결과 기반 에러 핸들링 (Tuple Return)


`try-catch`로 인한 코드 들여쓰기(Indent)가 마음에 들지 않는 개발자들이 최근 가장 선호하는 패턴입니다. 에러와 결과를 배열(Tuple) 형태로 반환받아 처리합니다.


```typescript
// 공통 유틸리티 함수 정의
async function catchToTuple<T>(promise: Promise<T>): Promise<[Error | null, T | null]> {
  try {
    const data = await promise;
    return [null, data];
  } catch (error) {
    return [error as Error, null];
  }
}

// 비즈니스 로직에서의 활용
async function checkout(cartId: string) {
  const [error, cart] = await catchToTuple(db.getCart(cartId));
  
  if (error) {
    return { success: false, reason: "장바구니 조회 실패" };
  }
  // 이후 안전하게 cart 객체 활용 가능 (타입 가드 동작)
}
```



비동기 처리는 구조가 눈에 보이지 않기 때문에 실수하기 더 쉽습니다. 직렬 연산 병목을 예방하기 위해 `Promise.all`을 적극 고려하고, 에러 유실이 없도록 안전장치를 설계하는 것이 좋은 설계의 첫걸음입니다.




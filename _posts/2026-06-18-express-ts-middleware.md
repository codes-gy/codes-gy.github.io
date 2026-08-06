---
title: "Express.js에서 TypeScript를 사용할 때 무조건 적용해야 하는 미들웨어 타입 안전성 확보하기"
date: 2026-06-18
last_modified_at: 2026-08-06
categories:
  - "백엔드"
tags:
  - "TypeScript"
  - "Node.js"
excerpt: "Express 미들웨어 안에서 Request 객체에 커스텀 데이터를 주입할 때, TypeScript의 interface 상속을 통해 타입 안정성을 보장받는 기법을 다룹니다."
toc: true
toc_sticky: true
---


Node.js 환경에서 웹 서버를 구축할 때 Express.js는 여전히 가장 압도적인 생태계를 자랑하는 프레임워크입니다. 여기에 타입 안정성을 더하기 위해 TypeScript를 도입하는 팀이 늘고 있습니다.


하지만 Express.js는 태생이 동적 타이핑 언어인 JavaScript 기반으로 설계되었기 때문에, TypeScript와 함께 쓸 때 미들웨어 단에서 심각한 타입 파편화 현상이 발생하곤 합니다. 가장 대표적인 예가 인증 미들웨어를 거친 후 `req.user` 객체에 접근하거나, 검증 미들웨어를 거친 뒤 `req.body`에 접근할 때 컴파일러가 타입을 추론하지 못하는 문제입니다.


이번 포스팅에서는 Express.js에서 묵인되기 쉬운 `any` 타입을 완전히 제거하고, 미들웨어 간 데이터 인수인계를 무결점 타입 안전성(Type Safety)으로 묶어내는 실무 아키텍처 가이드를 공유합니다.


## 1. `any` 타입 캐스팅과 컴파일 에러


JWT 인증 미들웨어를 통과한 요청(`req`) 객체에 로그인한 유저 정보를 심어서 컨트롤러로 넘겨주는 유스케이스를 생각해 보겠습니다. 많은 주니어 개발자들이 다음과 같은 코드를 작성하곤 합니다.


```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: '인증 토큰이 없습니다.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    
    // Property 'user' does not exist on type 'Request'. 컴파일 에러 발생!
    req.user = decoded; 
    next();
  } catch (error) {
    return res.status(403).json({ message: '유효하지 않은 토큰입니다.' });
  }
};
```


Express가 기본 제공하는 `Request` 타입 인터페이스에는 `user`라는 속성이 정의되어 있지 않기 때문에 TypeScript 컴파일러는 즉시 에러를 뱉어냅니다.


이때 당장의 에러를 피하기 위해 `(req as any).user = decoded;` 와 같이 **`any`** **타입으로 강제 캐스팅**을 진행하는 경우가 굉장히 많습니다. 하지만 이는 TypeScript의 목적을 완전히 상실시키는 행위이며, 컨트롤러 단에서 다른 개발자가 `req.user.id`를 호출할 때 오타가 나더라도 컴파일 타임에 버그를 잡아내지 못하는 대형 사고의 빌미가 됩니다.


## 2. 인터페이스 재정의


TypeScript의 강력한 기능 중 하나인 선언 확장을 이용하면 Express 프레임워크 고유의 내장 글로벌 인터페이스를 안전하게 확장할 수 있습니다.


프로젝트 루트 또는 `src/types/` 폴더 내에 `express.d.ts` 파일을 생성하고 다음과 같이 작성합니다.


```typescript
// src/types/express.d.ts
import { UserPayload } from '../interfaces/user.interface';

declare global {
  namespace Express {
    interface Request {
      // 백엔드에 맞는 커스텀 속성을 안전하게 주입
      user?: UserPayload;
      validatedBody?: any; // 필요에 따라 DTO 매핑
    }
  }
}
```



그리고 `tsconfig.json` 파일의 `include` 항목에 해당 타입 정의 파일의 경로를 추가해 줍니다.




```json
{
  "compilerOptions": {
    "typeRoots": ["./node_modules/@types", "./src/types"]
  },
  "include": ["src/**/*", "src/types/express.d.ts"]
}
```


이렇게 세팅하면 컴파일러가 Express의 기존 `Request` 타입과 우리가 새로 정의한 인터페이스를 병합하여 인식합니다. 이제 미들웨어뿐만 아니라 라우터, 컨트롤러 어디에서든 `req.user`에 접근할 때 사전에 정의한 `UserPayload` 타입 추론과 자동 완성이 완벽하게 보장됩니다.


## 3. 타입을 활용한 파이프라인 안전성 확보


글로벌 네임스페이스를 오염시키는 선언 확장 방식이 찝찝하거나, 미들웨어별로 주입되는 결과물의 스키마가 엄격하게 분리되어야 하는 정밀한 시스템(예: Pydantic이나 Zod를 활용한 데이터 규격화 패턴)에서는 **커스텀 익스텐드 타입(Custom Extended Type)** 구조가 더 유리합니다.


```typescript
// src/interfaces/common.interface.ts
import { Request } from 'express';
import { UserPayload } from './user.interface';

// 기본 Request를 상속받아 명확한 규격을 가진 전용 타입 생성
export interface AuthenticatedRequest extends Request {
  user: UserPayload;
}
```


이 방식을 적용하면 컨트롤러를 작성할 때 어떤 미들웨어를 타고 들어왔는지 타입을 통해 명확히 가독할 수 있습니다.


```typescript
// src/controllers/user.controller.ts
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../interfaces/common.interface';

export const getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // req.user가 무조건 존재함이 보장되며, 타입 자동 완성이 지원됩니다.
  const userId = req.user.id; 
  const userEmail = req.user.email;
  
  return res.status(200).json({ id: userId, email: userEmail });
};
```


## 4. Zod / 라이브러리와의 결합


2026년 현재 고도화된 엔터프라이즈급 Express 시스템에서는 데이터 유효성 검증 라이브러리인 **Zod**나 **Joi**를 결합하여 미들웨어 단계에서 스키마 유효성 검증(Schema Validation)을 끝내고 타입을 고정하는 아키텍처를 강제합니다.


## 5. 결론


TypeScript를 도입하고도 곳곳에 `any`나 헐거운 타입 선언을 남겨둔다면, 그것은 TypeScript를 쓰는 것이 아니라 오히려 컴파일 속도만 갉아먹는 걸림돌로 전락시키는 일입니다.


특히 프레임워크의 코어 아키텍처이자 데이터의 관문 역할을 하는 Express.js의 미들웨어 계층만큼은 철저하게 타입을 제어해야 합니다. 오늘 소개해 드린 선언 확장 방식과 커스텀 리퀘스트 아키텍처를 프로젝트 초기에 가이드라인으로 확립해 두세요. 버그가 런타임이 아닌 컴파일러 수준에서 사전에 차단되는 완벽한 시스템 혁신을 경험하실 수 있을 것입니다.


---
title: "\"Cannot find module\" 에러 원인과 tsconfig.json 완벽 가이드"
date: 2026-06-18
last_modified_at: 2026-07-16
categories:
  - "타입스크립트"
tags:
  []
excerpt: "TypeScript에서 모듈을 찾지 못하는 원인을 파악하고 tsconfig.json의 경로 매핑 설정을 통해 에러를 완벽하게 해결하는 방법을 알아봅니다."
toc: true
toc_sticky: true
---


TypeScript 프로젝트를 운영하다 보면 누구나 한 번쯤, 혹은 아주 빈번하게 터미널이나 에디터를 붉게 물들이는 악명 높은 에러를 마주하게 됩니다. 바로 **`TS2307: Cannot find module '...' or its corresponding type declarations.`** 에러입니다.


코드상으로는 분명히 파일이 존재하고 경로도 맞는 것 같은데, 빌드만 돌리면 모듈을 찾을 수 없다고 뿜어내는 이 에러는 개발자의 생산성을 갉아먹는 주범입니다. 특히 레거시 JavaScript 프로젝트를 TypeScript로 점진적 이관(Migration)하거나, 소스 코드가 많아져 절대 경로 설정을 도입할 때 가장 많이 발생합니다.


이번 포스팅에서는 이 에러가 발생하는 근본적인 원인을 살펴보고, `tsconfig.json` 설정을 통해 경로 지옥에서 영원히 탈출하는 방법을 완벽하게 정리합니다.


## 1. "Cannot find module" 에러가 발생하는 진짜 원인


이 에러가 발생하는 원인은 크게 세 가지로 압축됩니다.

1. **상대 경로 참조의 한계와 오타**: 프로젝트 규모가 커지면서 `../../../../components/Button`과 같은 지저분한 상대 경로를 사용하다가 경로 깊이를 잘못 계산하거나 오타가 난 경우입니다.
2. **TypeScript 컴파일러(tsc)와 실행 환경(Node.js 등)의 인식 차이**: `tsconfig.json`에 경로 별칭(Path Alias)을 설정해 두면 에디터(VS Code)상에서는 빨간 줄이 사라집니다. 하지만 컴파일된 최종 결과물(JS)을 Node.js 환경에서 실행할 때, 실제 파일 경로가 꼬여 런타임 에러가 발생합니다.
3. **타입 선언 파일(****`.d.ts`****)의 부재**: npm으로 설치한 외부 라이브러리가 JavaScript로만 작성되어 있고 TypeScript용 타입 선언을 제공하지 않을 때, 컴파일러는 해당 모듈의 정체를 알 수 없어 에러를 뱉습니다.

## 2. tsconfig.json을 통한 근본적인 해결책: 절대 경로 설정


상대 경로 지옥을 탈출하고 에러를 뿌리 뽑기 위한 가장 우아한 해결책은 `tsconfig.json`에 절대 경로 별칭(Path Alias)을 심는 것입니다.


예를 들어, 어느 위치에서든 `src/utils/logger`에 있는 모듈을 `@utils/logger` 형태로 깔끔하게 불러올 수 있도록 설정해 보겠습니다.


### 🛠️ step 1: `tsconfig.json` 핵심 옵션 수정


`tsconfig.json` 파일의 `compilerOptions` 내부에 `baseUrl`과 `paths` 옵션을 다음과 같이 지정합니다.


```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    
    /* 절대 경로 설정을 위한 핵심 옵션 */
    "baseUrl": ".", 
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils/*": ["src/utils/*"]
    },
    
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

- **`baseUrl`**: `paths`에 지정할 상대 경로의 기준점이 되는 기본 디렉토리를 정의합니다. 보통 프로젝트 루트인 `.`으로 설정합니다.
- **`paths`**: 가상의 절대 경로 별칭(`@/*`)과 실제 디렉토리 위치(`src/*`)를 매핑합니다. 와일드카드()를 사용하여 하위 모듈을 한 번에 매핑하는 것이 실무 표준입니다.

이렇게 설정하면 소스 코드 내부에서 아래와 같이 아주 직관적인 임포트가 가능해집니다.


```typescript
// 변경 전: 경로가 조금만 바뀌어도 터지는 구조
import { formatData } from '../../../../utils/formatter';

// 변경 후: 어떤 깊이의 파일에서든 일관되게 참조 가능!
import { formatData } from '@utils/formatter';
```


## 3. 설정 후에도 런타임에서 터질 때: tsconfig-paths 연동


앞서 말씀드렸듯, `tsconfig.json` 변경은 TypeScript 컴파일러와 에디터에게 경로를 알려줄 뿐입니다. `tsc`가 컴파일을 끝내고 만든 `dist/` 폴더 안의 실제 JavaScript 코드는 여전히 `@utils/formatter`라는 가상의 주소를 바라보고 있기 때문에, 이를 그대로 Node.js로 실행하면 **런타임 Cannot find module**이 터집니다.


이를 해결하기 위해 빌드 및 실행 도구와의 연동이 필수적입니다.


### 📦 Node.js 환경 (ts-node 사용 시)


개발 환경에서 `ts-node`를 통해 실시간으로 실행할 때는 `tsconfig-paths` 패키지를 이용해 경로를 동적으로 매핑해 주어야 합니다.


```bash
npm install -D tsconfig-paths
```



실행 스크립트나 터미널에 다음과 같이 `-r` (require) 옵션을 추가하여 실행합니다.




```bash
ts-node -r tsconfig-paths/register src/index.ts
```


## 4. 외부 라이브러리 타입이 없을 때의 우회책


만약 npm 라이브러리를 가져왔는데 `Cannot find module`이 뜬다면, `@types/라이브러리명`이 존재하는지 확인하고 설치해야 합니다.


## 5. 결론: 빌드 타임의 에러는 축복이다


정적 타이핑 언어인 TypeScript를 쓰는 가장 큰 가치는 "에러를 사용자가 마주하는 런타임이 아닌, 개발자가 코드를 치는 빌드 타임에 마주하는 것"에 있습니다.


`Cannot find module` 에러는 경로 추적에 실패한 컴파일러가 우리에게 보내는 SOS 신호입니다. 오늘 살펴본 `baseUrl`과 `paths` 아키텍처를 프로젝트 초기에 견고하게 잡아두면, 스케일업 과정에서 경로가 뒤엉켜 빌드가 터지는 불상사를 원천 차단할 수 있습니다.


---
title: "bcrypt와 crypto를 활용한 안전한 사용자 비밀번호 암호화 및 단방향 해시 전략"
date: 2026-06-18
last_modified_at: 2026-07-15
categories:
  - "Node.js"
tags:
  []
excerpt: "bcrypt의 솔팅(Salting) 개념을 이해하고 내장 crypto 모듈과 비교하여, 레인보우 테이블 공격으로부터 사용자 비밀번호를 안전하게 보호하는 단방향 해시 구현법을 다룹니다."
toc: true
toc_sticky: true
---


웹 서비스를 개발할 때 회원가입과 로그인 기능은 가장 기본적이면서도 가장 강력한 보안성이 요구되는 영역입니다. 만약 데이터베이스가 해킹당하더라도 사용자의 비밀번호만큼은 유출되지 않도록 완벽하게 방어해야 합니다.


여전히 일부 서비스에서 비밀번호를 평문(Plain Text)으로 저장하거나, 이미 취약점이 발견된 MD5, SHA-1 같은 복복호화 가능한 양방향 암호화를 사용하여 대형 보안 사고를 키우곤 합니다. 2026년 현재 모던 백엔드 아키텍처 환경에서 사용자 비밀번호는 무조건 단방향 해시 함수(One-Way Hash Function)를 통해 암호화해야 하며, 복호화가 절대 불가능해야 합니다.


이번 포스팅에서는 Node.js 환경에서 비밀번호를 가장 안전하게 보관할 수 있는 내장 모듈 `crypto(pbkdf2)`와 외부 표준 라이브러리 `bcrypt`의 작동 원리 및 실무 구현 전략을 알아봅니다.


## 1. 단순 해시 함수의 한계와 두 가지 보안 무기: Salt & Key Stretching


단순히 `SHA-256` 같은 해시 함수에 비밀번호를 넣고 돌리기만 하면 안전할까요? 정답은 "절대 아니다"입니다. 해시 함수는 동일한 입력값에 대해 항상 동일한 출력값을 뱉기 때문에, 해커들은 이미 자주 쓰이는 비밀번호의 해시 값을 수억 개 모아놓은 사전인 레인보우 테이블(Rainbow Table)을 가지고 있습니다. 이를 대조하면 단 몇 초 만에 원래 비밀번호를 알아낼 수 있습니다.


이를 차단하기 위해 백엔드 아키텍처는 반드시 다음 두 가지 메커니즘을 도입해야 합니다.

1. **솔팅 (Salting)**: 비밀번호를 해시하기 전에, 사용자별로 무작위로 생성된 고유의 무의미한 문자열(Salt)을 비밀번호 뒤에 붙여서 해시 함수에 돌리는 기법입니다. 이를 통해 동일한 비밀번호를 쓰더라도 사용자마다 해시 결과물이 완전히 달라지므로 레인보우 테이블을 무력화할 수 있습니다.
2. **키 스트레칭 (Key Stretching)**: 단방향 해시 과정을 수천, 수만 번 반복(Iteration)하여 해시 값을 도출하는 기법입니다. 컴퓨터 연산 속도가 너무 빨라 해커가 무차별 대입 공격(Brute Force Attack)을 시도하는 시간을 물리적으로 늘려 서버 지연을 유도하는 방어벽 역할을 합니다.

## 2. 전략 1: Node.js 내장 모듈 `crypto`와 PBKDF2 아키텍처


Node.js에 내장된 `crypto` 모듈을 사용하면 외부 의존성 없이 검증된 표준 단방향 알고리즘인 PBKDF2(Password-Based Key Derivation Function 2)를 구현할 수 있습니다.


```javascript
import crypto from 'crypto';

export const hashPasswordCrypto = (password: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 1. 64바이트의 안전한 무작위 Salt 생성 (Salting)
    const salt = crypto.randomBytes(64).toString('base64');
    
    // 2. PBKDF2 알고리즘으로 100,000번 반복 연산 (Key Stretching)
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      
      // 3. 나중에 검증할 수 있도록 salt와 해시 결과물을 구분자(:)로 결합하여 DB에 저장
      const hashedPassword = `${salt}:${derivedKey.toString('base64')}`;
      resolve(hashedPassword);
    });
  });
};
```


로그인 시 비밀번호를 검증할 때는 DB에 저장된 문자열에서 `salt`를 다시 떼어낸 뒤, 사용자가 입력한 비밀번호와 동일한 조건(10만 번 반복, SHA-512)으로 해시를 돌려 결과물이 일치하는지 교차 검증합니다.


## 3. 전략 2: 표준 `bcrypt` 활용하기 (추천)


`crypto`를 이용한 PBKDF2도 훌륭하지만, 실무에서 가장 압도적으로 많이 쓰이는 오픈소스 솔루션은 바로 `bcrypt`입니다. bcrypt는 처음부터 비밀번호 저장을 목적으로 설계된 adaptive 단방향 해시 함수로, 내부적으로 Blowfish 암호 기반 아키텍처를 따릅니다.


bcrypt의 가장 큰 장점은 **Work Factor(Cost)** 조절을 통해 보안 강도를 유연하게 제어할 수 있고, 해시 결과물 내부에 Salt와 알고리즘 버전, Cost 정보가 알아서 내장된다는 점입니다.


```javascript
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12; // 2^12 = 4,096번 반복 (2026년 기준 하드웨어 성능 최적화 값)

// 회원가입 시: 비밀번호 암호화
export const hashPasswordBcrypt = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

// 로그인 시: 비밀번호 매칭 검증
export const comparePasswordBcrypt = async (password: string, hashedPassword: string): Promise<boolean> => {
  // bcrypt가 해시값 내부에 저장된 salt와 cost를 스스로 추출하여 비교를 수행합니다.
  return await bcrypt.compare(password, hashedPassword);
};
```


`crypto`처럼 개발자가 직접 Salt 문정이나 구분자를 엮어서 가공할 필요가 없기 때문에 실수가 적고 코드 가독성이 극대화됩니다.


## 4. 실무 필수 체크리스트: bcrypt와 crypto 선택의 기로


두 기술 모두 프로덕션 환경에서 사용하기에 충분히 안전하지만, 프로젝트의 특성에 따라 다음과 같은 기준을 가지고 선택해야 합니다.

- **컴퓨팅 리소스와 CPU 제어**: `bcrypt`는 CPU 연산 위주로 작동하므로 Cost 하이퍼파라미터를 너무 높이면(예: 14 이상) 서버 인증 요청이 몰릴 때 CPU 점유율이 100%를 치고 올라가 서브 자원이 고갈되는 장애를 유발할 수 있습니다. 2026년 기준 일반적인 웹 API 서버라면 **`SALT_ROUNDS = 12`** 내외가 가장 적합합니다.
- **외부 의존성 제약(Enterprise)**: 금융권이나 공공기관처럼 외부 라이브러리(`node_modules`) 설치 보안 검수가 엄격한 엔터프라이즈 환경이라면, 패키지 취약점 리스크가 없는 Node.js 내장 모듈인 `crypto`를 활용해 커스텀 PBKDF2 모듈을 만들어 관리하는 것이 거버넌스 측면에서 훨씬 유리합니다.

## 5. 결론: 정보 보안의 시작과 끝은 올바른 해시 전략부터


비밀번호 암호화는 단순히 컴파일 에러를 안 나게 처리하는 것을 넘어, 최악의 침해 사고가 발생했을 때 기업과 사용자의 자산을 지켜주는 최후의 보루입니다.


오늘 소개해 드린 `Salt` 주입과 `Key Stretching` 원리를 명확히 이해하고, 프로젝트 성격에 맞춰 `bcrypt`나 `crypto(pbkdf2)` 레이어를 도입해 보세요. 인프라와 소프트웨어 아키텍처 단에서 보안 신뢰성을 완벽하게 만족할 때, 비즈니스의 지속 가능한 성장과 진정한 비즈니스 시간 혁신을 안전하게 이룩할 수 있을 것입니다.


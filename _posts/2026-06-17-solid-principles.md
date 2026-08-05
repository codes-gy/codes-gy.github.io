---
title: "Untitled"
date: 2026-06-17
last_modified_at: 2026-07-15
categories:
  - "자바"
tags:
  []
excerpt: "단일 책임 원칙(SRP)부터 의존역전 원칙(DIP)까지 자바 코드가 스파게티가 되지 않도록 방해하는 SOLID 5대 설계 원칙을 실무적인 리팩토링 예제를 통해 명쾌하게 풀어냅니다."
toc: true
toc_sticky: true
---

> **SOLID 원칙이란?**  
> 로버트 마틴이 제창한 객체 지향 설계의 5가지 핵심 원칙입니다. 시간이 지나도 유지보수가 쉽고, 확장성이 뛰어나며, 변화에 유연한 소프트웨어를 만들기 위한 개발자의 필수 지침서입니다.

## 1. SRP: 단일 책임 원칙 (Single Responsibility Principle)

> _"하나의 클래스는 단 하나의 변경 이유(책임)를 가져야 한다."_

### ❌ 나쁜 예시 (비대해진 God 클래스)


하나의 클래스가 유저 데이터 관리, 이메일 발송, 로깅까지 모두 책임지고 있습니다. 이메일 규격이 바뀌어도 이 클래스를 수정해야 합니다.


```typescript
class UserService {
  createUser(userData) {
    // 1. 유저 생성 로직
    db.save(userData);
    // 2. 이메일 발송 로직 (SRP 위반!)
    smtp.sendEmail(userData.email, "Welcome!");
    // 3. 로그 기록 로직 (SRP 위반!)
    fs.writeFileSync("log.txt", `User ${userData.id} created`);
  }
}
```


### ⭕ 실무 적용 예시 (책임 분리)


각각의 역할을 독립된 클래스로 분리하여, 서로의 변경 사항이 다른 기능에 영향을 주지 않도록 합니다.


```typescript
class UserRepository {
  save(userData) { db.save(userData); }
}

class EmailService {
  sendWelcomeEmail(email) { smtp.sendEmail(email, "Welcome!"); }
}

class Logger {
  info(message) { fs.writeFileSync("log.txt", message); }
}

// 오케스트레이션을 담당하는 서비스
class UserService {
  constructor(userRepo, emailService, logger) {
    this.userRepo = userRepo;
    this.emailService = emailService;
    this.logger = logger;
  }

  createUser(userData) {
    this.userRepo.save(userData);
    this.emailService.sendWelcomeEmail(userData.email);
    this.logger.info(`User ${userData.id} created`);
  }
}
```


## 2. OCP: 개방-폐쇄 원칙 (Open-Closed Principle)

> _"확장에는 열려 있어야 하고, 수정에는 닫혀 있어야 한다."_

### ❌ 나쁜 예시 (새로운 결제 수단 추가 시 기존 코드 수정 필요)


새로운 결제 수단(예: 네이버페이)이 추가될 때마다 결제 서비스 클래스의 `if-else` 문을 계속 수정해야 합니다.


```typescript
class PaymentService {
  processPayment(method: string, amount: number) {
    if (method === "kakao") {
      // 카카오페이 결제 로직
    } else if (method === "toss") {
      // 토스 결제 로직
    }
    // 새로운 결제가 추가될 때마다 이 코드를 뜯어고쳐야 함 (OCP 위반!)
  }
}
```


### ⭕ 실무 적용 예시 (인터페이스 활용)


결제 수단을 추상화(인터페이스)하여, 기존 코드는 건드리지 않고 새로운 클래스를 추가하는 것만으로 기능을 확장합니다.


```typescript
interface PaymentProcessor {
  pay(amount: number): void;
}

class KakaoPayment implements PaymentProcessor {
  pay(amount: number) { /* 카카오 결제 로직 */ }
}

class TossPayment implements PaymentProcessor {
  pay(amount: number) { /* 토스 결제 로직 */ }
}

// 새로운 결제 수단 추가가 매우 자유로움
class NaverPayment implements PaymentProcessor {
  pay(amount: number) { /* 네이버 결제 로직 */ }
}

class PaymentService {
  // 기존 코드는 수정할 필요가 없음 (수정에 닫힘)
  processPayment(processor: PaymentProcessor, amount: number) {
    processor.pay(amount);
  }
}
```


## 3. LSP: 리스코프 치환 원칙 (Liskov Substitution Principle)

> _"서브 타입은 언제나 자신의 기반 타입(부모 클래스)으로 교체할 수 있어야 한다."_  
> 즉, 부모 클래스의 행동 규약을 자식 클래스가 위반하거나 기대치를 깨뜨리면 안 됩니다.

### ❌ 나쁜 예시 (부모의 기능을 망가뜨리는 자식)


직사각형을 상속받은 정사각형이 부모의 가로/세로 독립 변경 기능을 강제로 왜곡하여 프로그램에 오작동을 일으킵니다.


```typescript
class Rectangle {
  protected width: number = 0;
  protected height: number = 0;

  setWidth(w) { this.width = w; }
  setHeight(h) { this.height = h; }
  getArea() { return this.width * this.height; }
}

class Square extends Rectangle {
  // 정사각형은 가로 세로가 같아야 하므로 부모의 규칙을 깨뜨림
  setWidth(w) { this.width = w; this.height = w; }
  setHeight(h) { this.height = h; this.width = h; }
}

// 사용하는 곳에서 대참사 발생
function resize(rect: Rectangle) {
  rect.setWidth(10);
  rect.setHeight(5);
  // 만약 rect가 Square라면 가로세로 모두 5가 되어 면적이 50이 아니라 25가 됨 (LSP 위반!)
}
```


### ⭕ 실무 적용 예시 (올바른 상속 구조 또는 상속 대신 구현)


두 클래스가 서로 완전히 대체 가능하지 않다면 상속 관계를 끊고 공통 인터페이스로 묶어야 합니다.


```typescript
interface Shape {
  getArea(): number;
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  getArea() { return this.width * this.height; }
}

class Square implements Shape {
  constructor(private side: number) {}
  getArea() { return this.side * this.side; }
}
```


## 4. ISP: 인터페이스 분리 원칙 (Interface Segregation Principle)

> _"클라이언트는 자신이 사용하지 않는 메서드에 의존하도록 강제되어서는 안 된다."_

### ❌ 나쁜 예시 (너무 많은 것을 요구하는 거대한 인터페이스)


단순히 출력 기능만 필요한 일반 프린터 클래스가 스마트 복합기용 인터페이스를 구현하느라 불필요한 팩스/스캔 메서드까지 억지로 구현해야 합니다.


```typescript
interface SmartPrinter {
  print(): void;
  scan(): void;
  fax(): void;
}

class BasicPrinter implements SmartPrinter {
  print() { console.log("인쇄합니다."); }
  scan() { throw new Error("지원하지 않습니다."); } // ISP 위반!
  fax() { throw new Error("지원하지 않습니다."); }  // ISP 위반!
}
```


### ⭕ 실무 적용 예시 (인터페이스 쪼개기)


인터페이스를 역할별로 잘게 쪼개어, 클래스가 자신이 필요한 기능만 쏙쏙 골라서 구현하도록 만듭니다.


```typescript
interface Printer { print(): void; }
interface Scanner { scan(): void; }
interface FaxMachine { fax(): void; }

// 일반 프린터는 인쇄 기능만 구현
class BasicPrinter implements Printer {
  print() { console.log("인쇄합니다."); }
}

// 최고급 복합기는 여러 인터페이스를 조합하여 구현
class MultiFunctionPrinter implements Printer, Scanner, FaxMachine {
  print() { /* ... */ }
  scan() { /* ... */ }
  fax() { /* ... */ }
}
```


## 5. DIP: 의존역전 원칙 (Dependency Inversion Principle)

> _"고수준 모듈은 저수준 모듈에 의존해서는 안 되며, 둘 다 추상화에 의존해야 한다."_  
> 구체적인 기술(MySQL, AWS 등)에 직접 의존하지 말고, 역할(인터페이스)에 의존하라는 뜻입니다.

### ❌ 나쁜 예시 (구체적인 인프라 기술에 꽁꽁 묶인 코드)


서비스 레이어가 구체적인 `MySQLDatabase` 클래스에 직접 의존하고 있어, 나중에 데이터베이스를 MongoDB로 바꾸려면 서비스 레이어 전체를 뜯어고쳐야 합니다.


```typescript
class MySQLDatabase {
  connect() { /* MySQL 연결 */ }
}

class MainService {
  private db: MySQLDatabase;

  constructor() {
    this.db = new MySQLDatabase(); // 구체적인 클래스에 직접 의존 (DIP 위반!)
  }
}
```


### ⭕ 실무 적용 예시 (추상화 벽 세우기)


중간에 `Database` 인터페이스를 두고, 서비스는 이 인터페이스만 바라보게 합니다. 실제 어떤 DB를 쓸지는 외부에서 주입(DI)받습니다.


```typescript
interface Database {
  connect(): void;
}

// 구체적인 구현체들
class MySQLDatabase implements Database { connect() { /* ... */ } }
class MongoDB implements Database { connect() { /* ... */ } }

class MainService {
  private db: Database; // 추상화(인터페이스)에 의존

  // 외부에서 주입받음 (Dependency Injection)
  constructor(database: Database) {
    this.db = database;
  }
  
  start() { this.db.connect(); }
}

// 실행할 때 원하는 DB를 갈아끼울 수 있음
const serviceWithMySQL = new MainService(new MySQLDatabase());
const serviceWithMongo = new MainService(new MongoDB());
```


한눈에 보는 SOLID 요약 


| **원칙**             | **핵심 요약**                 | **실무에서의 목표**                    | **핵심 키워드**          |
| ------------------ | ------------------------- | ------------------------------- | ------------------- |
| **SRP** (단일 책임)    | 하나의 클래스는 하나의 역할만!         | 코드가 비대해져서 꼬이는 것 방지              | #책임분리 #클래스_다이어트     |
| **OCP** (개방-폐쇄)    | 기존 코드 수정 없이 새 기능 추가!      | 기존 시스템을 건드려 생기는 버그 방지           | #인터페이스 #추상화 #확장성    |
| **LSP** (리스코프 치환)  | 자식은 언제나 부모 역할을 완벽히!       | 상속 구조에서 예상치 못한 대참사 방지           | #올바른_상속 #행동_규약_준수   |
| **ISP** (인터페이스 분리) | 안 쓰는 메서드는 강제로 구현 금지!      | 가볍고 명확하게 인터페이스 쪼개기              | #인터페이스_분할 #필요한_것만   |
| **DIP** (의존역전)     | 구체 기술이 아닌 변하지 않는 추상화에 의존! | 기술 스택 변경(DB, 외부 API 등)에 유연하게 대처 | #의존성_주입 #DI #느슨한_결합 |


## 정리하며 느낀 점 (My Takeaway)

- **원칙은 '목적'이 아니라 '수단'이다**
처음 SOLID 원칙을 접했을 때는 무조건 이 규칙에 맞춰서 정답 같은 코드를 짜야 한다는 강박이 있었습니다. 하지만 실무 예제들을 정리하다 보니, 원칙을 지키는 것보다 "이 코드가 6개월 뒤의 나나 동료들이 고치기 편한 코드인가?"라는 본질적인 질문이 더 중요하다는 것을 깨달았습니다.
- **결국 핵심은 '추상화'와 '격리'**
5가지 원칙이 각각 다르게 보이지만, 결국 관통하는 핵심은 하나였습니다. **변하기 쉬운 것(구체적인 기술, 비즈니스 로직)과 변하지 않는 것(인터페이스, 역할)을 분리**하고, 서로에게 미치는 영향을 최소한으로 격리하는 것입니다. 이 감각을 익히는 것이 좋은 개발자가 되는 첫걸음이라 생각합니다.
- **과유불급(過猶不及), 트레이드 오프의 미학**
단일 책임 원칙(SRP)을 지키겠다고 클래스를 무작위로 쪼개면 파일 개수가 수십 개로 늘어나 코드 가독성이 오히려 떨어질 수 있습니다. 무조건적인 원칙 맹신보다는, 프로젝트의 규모와 팀원들의 숙련도에 맞춰 비용과 효율의 균형(Trade-off)을 잡는 유연한 시각을 가져야겠습니다.

**앞으로의 다짐**


앞으로 코드를 작성할 때


`if-else`  가 끊임없이 늘어나거나(OCP 위반), 하나의 클래스가 너무 많은 일을 하려고 할 때 머릿속에서 경고등이 켜질 것 같습니다. 리팩토링을 할 때마다 이 노트를 꺼내 보며 실무 코드에 녹여내는 연습을 꾸준히 이어가겠습니다.


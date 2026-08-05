---
title: "Node.js(Prisma) 환경에서 데이터베이스 인덱스 설정으로 조회 쿼리 속도 개선하기"
date: 2026-06-18
last_modified_at: 2026-07-15
categories:
  - "Node.js"
tags:
  []
excerpt: "대용량 테이블 조회 시 발생하는 성능 병목을 해결하기 위해, Prisma 스키마에 복합 인덱스를 정의하고 실행 계획을 최적화하여 쿼리 속도를 향상시킵니다."
toc: true
toc_sticky: true
---


서비스의 회원 수가 늘어나고 테이블에 쌓이는 데이터가 수백만 건을 넘어서기 시작하면, 잘 돌아가던 애플리케이션의 특정 API가 갑자기 느려지는 현상을 목격하게 됩니다. 대부분의 경우 원인은 백엔드 어플리케이션 로직이 아닌, 데이터베이스 단에서 발생하는 풀 테이블 스캔(Full Table Scan)에 있습니다. 원하는 데이터를 찾기 위해 책의 첫 페이지부터 끝 페이지까지 전부 훑어보고 있는 것입니다.


2026년 현재 Node.js 진영에서 가장 사랑받는 ORM인 **Prisma**는 직관적인 쿼리 빌더를 제공하지만, 데이터베이스 모델링 단계에서 올바른 인덱스(Index) 설정을 누락하면 심각한 성능 저하를 피할 수 없습니다. 이번 포스팅에서는 Prisma 환경에서 데이터베이스 인덱스를 전략적으로 설정하여 조회 쿼리 속도를 극한으로 끌어올리는 실무 최적화 가이드를 공유합니다.


## 1. 데이터베이스 인덱스(Index)란 무엇인가?


데이터베이스 인덱스는 책의 맨 뒤에 있는 '찾아보기(색인)'와 같습니다. 인덱스를 설정하면 데이터베이스는 지정된 컬럼의 값들을 정렬하여 별도의 저장 공간에 **B-Tree(Balanced Tree)** 등의 구조로 보관합니다.


조회(`SELECT`) 요청이 들어왔을 때 데이터베이스는 이 정렬된 색인 테이블을 먼저 확인하여, 수백만 개의 데이터 중 원하는 로우(Row)의 물리적 위치로 단번에 점프(O(log N)의 시간 복잡도)합니다. 이 성능 혁신은 데이터 규모가 커질수록 기하급수적인 차이를 만들어냅니다.


## 2. Prisma에서 인덱스 설정하는 방법 (`schema.prisma`)


Prisma에서는 데이터베이스 마이그레이션 파일이나 raw SQL을 직접 건드리지 않고, `schema.prisma` 파일의 모델 선언부 안에서 `@index` 속성을 사용하여 아주 직관적으로 인덱스를 명시할 수 있습니다.


### 📄 단일 컬럼 인덱스와 복합 인덱스 설정 예시


```typescript
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique // @unique는 자동으로 유니크 인덱스를 생성합니다.
  name      String
  role      Role     @default(USER)
  createdAt DateTime @default(now())

  // 1. 특정 컬럼 단독 조회 속도 개선을 위한 단일 인덱스
  @@index([role])
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  status    String   @default("DRAFT")
  viewCount Int      @default(0)
  authorId  Int
  createdAt DateTime @default(now())

  // 2. 다중 조건 검색을 위한 복합 인덱스 (Composite Index)
  @@index([authorId, status])
}
```


이렇게 설정을 마친 후 터미널에 마이그레이션 명령어를 실행하면 데이터베이스 엔진에 물리적인 인덱스 레이어가 즉시 반영됩니다.


```typescript
npx prisma migrate dev --name init
```


## 3. 실무 필수 체크리스트: 복합 인덱스의 '좌측 매칭 원칙'과 순서의 중요성


두 개 이상의 컬럼을 묶어서 설정하는 복합 인덱스(`@@index([authorId, status])`)를 설계할 때는 반드시 데이터베이스 엔진의 작동 원리인 **가장 왼쪽 컬럼 기준 매칭(Leftmost Prefix)** 법칙을 이해해야 합니다.


데이터베이스는 복합 인덱스를 만들 때 **첫 번째로 명시한 컬럼(****`authorId`****)을 기준으로 먼저 정렬**한 뒤, 그 안에서 두 번째 컬럼(`status`)을 정렬합니다. 따라서 다음과 같은 쿼리 실행 시 인덱스 작동 여부가 갈립니다.

- **인덱스를 완벽히 타는 쿼리**

```typescript
// authorId와 status를 모두 조건으로 준 경우
const posts = await prisma.post.findMany({
  where: { authorId: 123, status: "PUBLISHED" }
});

// 첫 번째 컬럼(authorId)만 조건으로 준 경우
const posts = await prisma.post.findMany({
  where: { authorId: 123 }
});
```

- 인덱스를 전혀 타지 못하고 풀 스캔하는 쿼리

```typescript
// 첫 번째 컬럼을 건너뛰고 두 번째 컬럼(status)만 조건으로 준 경우
const posts = await prisma.post.findMany({
  where: { status: "PUBLISHED" }
});
```


복합 인덱스 테이블은 `authorId` 순으로 정렬되어 있기 때문에, `status`만 달랑 주면 데이터베이스는 인덱스 지도를 읽지 못하고 다시 전체 테이블을 뒤지는 멍청한 짓을 반복하게 됩니다. 따라서 복합 인덱스를 짤 때는 카디널리티(Cardinality, 중복도가 낮고 데이터 값이 가장 다양한 컬럼)가 높은 컬럼을 반드시 왼쪽에 배치해야 성능 이점을 극대화할 수 있습니다.


## 4. 인덱스가 항상 좋은 것은 아니다: Trade-off와 부작용


인덱스는 마법의 탄환이 아닙니다. 조회 속도를 얻는 대신 명확한 리스크 비용을 지불해야 합니다.

1. **쓰기 성능 저하 (CUD)**: `INSERT`, `UPDATE`, `DELETE`가 발생할 때마다 데이터베이스는 실제 데이터 테이블뿐만 아니라, **정렬되어 있는 인덱스 테이블까지 실시간으로 다시 계산하고 정렬**해야 합니다. 데이터 삽입과 수정이 과도하게 빈번한 테이블에 인덱스를 남발하면 오히려 쓰기 성능이 급격히 훼손됩니다.
2. **저장 공간 차지**: 인덱스는 물리적인 색인 페이지를 따로 빌드하여 디스크에 저장하므로, 테이블당 인덱스가 과도하게 많아지면 배보다 배꼽이 더 큰 데이터베이스 용량 낭비로 이어집니다. 보통 테이블당 3~4개 이하로 유지하는 것이 건강한 인덱스 아키텍처 가이드라인입니다.

## 5. 결론: 실행 계획(`EXPLAIN`)을 확인하는 데이터 주도 튜닝


JPA나 Prisma 같은 모던 ORM을 쓸 때 가장 경계해야 하는 것은 데이터베이스가 백엔드 코드 뒤로 추상화되어 '블랙박스'가 되는 현상입니다.


내가 작성한 Prisma 쿼리가 인덱스를 제대로 타고 있는지 의심된다면, 상용 로그에 찍힌 SQL 문을 그대로 복사하여 데이터베이스 클라이언트에서 **`EXPLAIN`** **키워드**를 붙여 실행해 보세요. 실행 계획의 `type` 필드가 `ALL`(Full Table Scan)인지, `ref`나 `range`(Index Scan)인지 눈으로 교차 검증하는 버릇을 들여야 합니다.


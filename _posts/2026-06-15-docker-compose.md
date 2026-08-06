---
title: "도커 컴포즈로 로컬 개발 환경 한 번에 세팅하기"
date: 2026-06-15
last_modified_at: 2026-08-06
categories:
  - "DevOps/인프라"
tags:
  - "Docker"
excerpt: "로컬 PC에 직접 데이터베이스를 설치하는 번거로움을 줄이고, 파일 하나로 백엔드 서버와 DB 컨테이너를 안전하게 격리하고 연동하는 컨테이너화 과정을 정리해 보려고 합니다."
toc: true
toc_sticky: true
---

> **왜 도커 컴포즈와 프리즈마를 함께 쓸까요?**  
> 로컬 컴퓨터에 PostgreSQL이나 MySQL 같은 무거운 데이터베이스를 직접 설치할 필요가 없습니다. 명령어 한 줄이면 Node.js 애플리케이션과 독립된 DB 컨테이너가 자동으로 뜨고, Prisma 인프라까지 완벽하게 연결되어 '개발 환경 파편화' 문제를 우려 없이 해결할 수 있습니다.

## 1. 프로젝트 기본 디렉터리 구조


시작하기 전, 프로젝트 루트 폴더의 구조를 아래와 같이 구성합니다.


```typescript
my-app/
├── node_modules/
├── prisma/
│   └── schema.prisma    # Prisma 스키마 파일
├── src/
│   └── index.ts         # Node.js 메인 실행 파일
├── .env                 # 환경 변수 파일 (DB 접속 정보)
├── docker-compose.yml   # 도커 컴포즈 설정 파일
├── package.json
└── tsconfig.json
```


## 2. 핵심 설정 파일 작성하기


### ① `docker-compose.yml`


로컬 개발용 PostgreSQL 데이터베이스를 정의합니다. 데이터를 보존하기 위해 볼륨(`db_data`)도 함께 설정합니다.


```yaml
version: '3.8'

services:
  postgres-db:
    image: postgres:15-alpine
    container_name: node_prisma_postgres
    restart: always
    environment:
      POSTGRES_USER: myuser
      POSTGRES_PASSWORD: mypassword
      POSTGRES_DB: mydb
    ports:
      - "5432:5432"
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
```


### ② `.env`


도커 컴포즈에서 설정한 DB 계정 정보를 기반으로 Prisma가 접근할 연결 주소(URL)를 작성합니다.


```yaml
# docker-compose.yml의 환경변수와 매칭되어야 합니다.
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/mydb?schema=public"
```


### ③ `prisma/schema.prisma`


Prisma 가 바라볼 데이터베이스 정보와 예시로 사용할 간단한 `User` 모델을 정의합니다.


```typescript
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
}
```


## 3. 실행 및 개발 워크플로우


노션에서 보기 편하게 체크리스트 형태로 실행 순서를 정리했습니다.


**1단계: 도커 컴포즈로 DB 컨테이너 실행하기**


```bash
# 백그라운드에서 PostgreSQL 컨테이너를 실행합니다 (-d 옵션)
docker compose up -d
```



**2단계: Prisma 마이그레이션 실행 (DB에 테이블 생성)**


```bash
# schema.prisma를 읽어 도커 DB에 테이블을 만들고 Client를 생성합니다
npx prisma migrate dev --name init
```


## 4. 마치며 느낀 점

- "내 컴퓨터에서는 잘 되는데?" 소멸

    
새로운 팀원이 합류하거나 다른 노트북에서 작업할 때, 데이터베이스를 설치하고 계정을 설정하던 시간이 사라졌습니다. `docker compose up`과 `prisma migrate` 단 두 줄이면 누구나 10초 만에 완벽히 동일한 개발 환경을 가질 수 있다는 게 정말 강력하게 다가옵니다.

- 추상화된 인프라의 편리함

    Prisma 덕분에 SQL 쿼리문을 직접 짜지 않아도 TypeScript 타입 안정성을 챙기며 개발할 수 있고, 도커 덕분에 실제 DB 인프라 관리 부담이 최소화되었습니다. 백엔드 개발자에게 이 두 조합은 로컬 생산성을 극대화하는 최고의 치트키 조합인 것 같습니다.


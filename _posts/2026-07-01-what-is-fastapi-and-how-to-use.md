---
title: "Untitled"
date: 2026-07-01
last_modified_at: 2026-07-15
categories:
  - "Python"
tags:
  []
excerpt: "Python 환경에서 비동기(Async) 기반의 고성능 API 서버를 가장 쉽고 빠르게 구축할 수 있는 웹 프레임워크인 FastAPI의 핵심 특징과 기본 구동 방법에 대해 알아봅니다."
toc: true
toc_sticky: true
---


## 1. FastAPI란?


**FastAPI**는 Python 3.8+ 이상에서 표준 Python 타입 힌트를 바탕으로 고성능 API를 빌드하기 위한 현대적이고 빠른 웹 프레임워크입니다.


### 💡 핵심 핵심 장점

- **압도적인 속도 (High Performance):** NodeJS 및 Go와 대등할 정도로 Python 프레임워크 중 가장 빠른 성능을 자랑합니다. (`Uvicorn`과 `async/await` 지원 덕분)
- **빠른 개발 속도 (Fast to code):** 기본 기능을 개발하는 속도가 기존 대비 약 200%에서 300%까지 빨라집니다.
- **적은 버그 (Fewer bugs):** 개발자에 의한 에러가 약 40% 감소합니다.
- **자동 문서화 (Automatic docs):** 코드를 작성하면 대화형 API 문서(`Swagger UI`/`ReDoc`)가 자동으로 생성됩니다.
- **Pydantic 기반의 타입 검증:** 데이터가 들어오고 나갈 때 데이터 구조와 타입을 자동으로 검증해 줍니다.

## 2. 개발 환경 준비하기


FastAPI 서버를 실행하기 위해서는 프레임워크 본체와 ASGI 서버인 `uvicorn`이 필요합니다.


```plain text
pip install fastapi uvicorn
```


## 3. 기본 코드 구조 (`main.py`)


가장 표준적이고 직관적인 FastAPI의 기본 아키텍처 예시입니다.


```python
from fastapi import FastAPI
from pydantic import BaseModel

# FastAPI 인스턴스 생성
app = FastAPI(title="내 데이터 플랫폼 API")

# 데이터 검증을 위한 Pydantic 모델 정의
class Item(BaseModel):
    name: str
    price: float
    is_offer: bool = None

# GET 요청 (기본 엔드포인트)
@app.get("/")
def read_root():
    return {"message": "Hello World! FastAPI 서버가 정상 작동 중입니다."}

# GET 요청 (패스 파라미터 및 쿼리 파라미터 활용)
@app.get("/items/{item_id}")
def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "search_query": q}

# POST 요청 (Pydantic 모델을 통한 자동 바인딩 및 데이터 유효성 검증)
@app.post("/items")
def create_item(item: Item):
    return {"message": "데이터가 성공적으로 수신되었습니다.", "data": item}
```


## 4. 실행 및 테스트 방법


터미널에서 아래 명령어를 실행하여 로컬 서버를 구동합니다.


```python
uvicorn main:app --reload
```

- `main:app`: `main.py` 파일의 `app` 인스턴스를 실행하라는 의미입니다.
- `-reload`: 코드가 변경될 때마다 서버가 자동으로 재시작되는 개발용 옵션입니다.

## 5. 핵심 기능 (심화)


### ① Async/Await 기반의 비동기 처리


FastAPI는 외부 API 호출이나 데이터베이스(DB) 조회처럼 대기 시간이 발생하는 I/O 작업을 병목(Blocking) 없이 효율적으로 처리할 수 있습니다.

- **장점:** 초당 수천 개의 요청을 지연 없이 처리하여 서버 성능을 극대화합니다.

```python
import asyncio
from fastapi import FastAPI

@app.get("/async-data")
async def get_large_data():
    # 외부 시스템 연동이나 복잡한 쿼리 처리를 비동기로 대기 (예시)
    await asyncio.sleep(2) 
    return {"status": "success", "data": "대용량 데이터 조회 완료"}
```


### ② Dependency Injection (의존성 주입)


FastAPI는 `Depends`라는 강력한 의존성 주입 기능을 제공합니다. 이를 통해 데이터베이스 세션 관리, 사용자 인증/인가, 공통 로직 등을 비즈니스 로직과 완벽히 분리하여 재사용할 수 있습니다.


```python
from fastapi import Depends, HTTPException, status, FastAPI

# 공통 인증 함수 (예시)
def verify_token(token: str = None):
    if token != "secret-token":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다."
        )
    return {"user": "admin"}

# 엔드포인트에 의존성 주입 적용
@app.get("/protected-route")
def get_protected_data(current_user: dict = Depends(verify_token)):
    return {"message": "인증 성공", "user_info": current_user}
```


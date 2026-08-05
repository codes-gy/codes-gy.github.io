---
title: "파이썬 프로젝트 초기 세팅 가이드"
date: 2026-07-01
last_modified_at: 2026-07-01
categories:
  - "Python"
tags:
  []
excerpt: "파이썬 백엔드 개발(FastAPI)을 시작할 때 반드시 거쳐야 하는 필수 초기 세팅 방법을 정리한 가이드입니다."
toc: true
toc_sticky: true
---


## 개요


파이썬 프로젝트는 프로젝트 간 라이브러리 버전 충돌을 방지하기 위해 **가상환경(Virtual Environment)** 세팅이 필수입니다. 본 가이드는 리눅스(Ubuntu) 환경 및 WebStorm/PyCharm IDE를 기준으로 FastAPI 개발 환경을 구축하는 순서를 다룹니다.


## 1. 시스템 패키지 설치 (리눅스 환경 최초 1회)


리눅스(Ubuntu/Debian) 환경에서 파이썬 가상환경 모듈과 패키지 관리자(`pip`)를 사용하기 위해 시스템 패키지를 먼저 업데이트하고 설치합니다.


```bash
sudo apt update
sudo apt install python3-pip python3-venv -y
```


## 2. 가상환경(Virtual Environment) 생성


프로젝트의 루트 폴더(예: `backend/`)로 이동한 후, 해당 프로젝트만의 독립된 라이브러리 공간을 생성합니다. 일반적으로 폴더명은 `.venv` 또는 `venv`로 지정합니다.


```bash
# 프로젝트 백엔드 폴더로 이동
cd /project/backend

# 가상환경 생성 (폴더명을 .venv로 지정)
python3 -m venv .venv
```


명령어를 실행하면 프로젝트 폴더 내에 `.venv`라는 이름의 폴더가 생성되며, 그 안에 독립된 파이썬 실행 파일들이 담깁니다.




## 3. 가상환경 활성화 (Activate) 및 종료 (Deactivate)


생성된 가상환경 안으로 진입해야만 컴퓨터 전체 공간이 아닌, 프로젝트 전용 공간에 패키지를 설치하고 실행할 수 있습니다.


### 🔹 가상환경 켜기 (활성화)


```bash
source .venv/bin/activate
```

- **성공 확인:** 명령어를 입력하면 터미널 프롬프트 맨 앞에 `(.venv)`라는 표시가 나타납니다.
- _예시:_ _`(.venv) user@hostname:~/backend$`_

### 🔹 가상환경 끄기 (종료)


작업을 마치고 원래의 시스템 터미널 환경으로 돌아가려면 아래 명령어를 입력합니다.


```bash
deactivate
```


## 4. 의존성 패키지(Dependencies) 설치 및 관리


노드(Node.js)의 `package.json`과 같은 역할을 하는 **`requirements.txt`** 파일을 이용해 프로젝트 패키지를 관리합니다.


### 🔹 방법 A: `requirements.txt` 파일로 한 번에 설치하기

1. 프로젝트 루트에 `requirements.txt` 파일을 생성하고 아래와 같이 필요한 패키지를 작성합니다.

```plain text
fastapi==0.111.0
uvicorn==0.30.1
pydantic==2.7.4
playwright==1.44.0
```

1. 가상환경이 **활성화된 상태**에서 아래 명령어를 실행하여 모두 설치합니다.

```plain text
pip install -r requirements.txt
```


### 🔹 방법 B: 터미널에서 직접 설치하고 리스트 추출하기

1. 필요한 패키지를 직접 설치합니다.

```plain text
pip install fastapi uvicorn pydantic playwright
```

1. 현재 가상환경에 설치된 패키지 목록을 `requirements.txt`로 내보냅니다.

```plain text
pip freeze > requirements.txt
```


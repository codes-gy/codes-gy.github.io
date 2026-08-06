---
title: "GitHub Actions와 Docker로 구축하는 백엔드 서버 애플리케이션 자동 배포"
date: 2026-06-18
last_modified_at: 2026-08-06
categories:
  - "DevOps/인프라"
tags:
  - "Docker"
  - "GitHub"
excerpt: "GitHub Actions 워크플로우를 통해 코드를 자동으로 검증 및 빌드하고, 도커 이미지로 팩키징하여 클라우드 서버 인프라에 다운타임 없이 배포하는 파이프라인을 완성합니다."
toc: true
toc_sticky: true
---


소규모 스타트업이나 1인 기업이 비즈니스를 운영할 때 가장 부족한 자원은 바로 '물리적 시간'입니다. 코드를 수정할 때마다 서버에 직접 접속해서 빌드하고, Docker 이미지를 빌드해 컨테이너를 재실행하는 수동 배포 방식은 귀중한 개발 시간을 갉아먹는 주범입니다.


이번 포스팅에서는 모던 DevOps의 표준으로 자리 잡은 **GitHub Actions**와 **Docker**를 결합하여, 코드 푸시(Push) 단 한 번으로 클라우드 서버에 애플리케이션이 자동으로 빌드 및 배포되는 CI/CD(지속적 통합/지속적 배포) 파이프라인 구축 로드맵을 공유합니다. 2026년 현재 클라우드 인프라 아키텍처 환경에서도 가장 비용 효율적이고 강력한 자동화 구성 방식입니다.


## 1. 아키텍처 개요


우리가 구축할 자동 배포 파이프라인의 전체적인 흐름은 다음과 같습니다.

1. **Code Push**: 개발자가 개발을 완료하고 `main` 브랜치에 코드를 `git push`합니다.
2. **CI (GitHub Actions)**: GitHub 가상 환경에서 코드가 자동으로 체크아웃되고, 테스트 및 빌드가 수행됩니다.
3. **Docker Build & Push**: 빌드된 아티팩트를 Docker 이미지로 패키징하여 이미지 저장소(Docker Hub 또는 AWS ECR)로 업로드합니다.
4. **CD (Deploy)**: 배포 대상 서버(EC2 등)에 SSH로 접속하여 최신 Docker 이미지를 다운로드(Pull)받고, 기존 컨테이너를 내린 뒤 새 컨테이너를 가동(Run)합니다.

이 가이드라인을 도입하면 배포 과정에서 발생하는 사람의 실수(Human Error)를 제로(0)로 만들 수 있습니다.


## 2. 1단계: 프로젝트 환경에 Dockerfile 작성하기


먼저 프로젝트 루트 디렉토리에 백엔드 애플리케이션을 가상화하기 위한 `Dockerfile`을 작성해야 합니다. 여기서는 경량화와 빌드 속도 최적화를 위해 **멀티 스테이지 빌드(Multi-stage Build)** 기법을 적용합니다.


### Spring Boot (Java) 환경 예시


```docker
# 1. 빌드 스테이지
FROM gradle:8.5-jdk17 AS builder
WORKDIR /app
COPY . .
RUN ./gradlew bootJar --no-daemon

# 2. 실행 스테이지
FROM openjdk:17-slim
WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "-Dspring.profiles.active=prod", "app.jar"]
```


Node.js 환경 예시


```docker
# 1. 빌드 스테이지
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# 2. 실행 스테이지
FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```


멀티 스테이지 빌드를 사용하면 최종 배포용 이미지에 빌드 도구나 소스 코드가 포함되지 않기 때문에 **이미지 용량을 최대 80% 이상 줄일 수 있고**, 이는 배포 속도 단축과 서버 디스크 용량 절약으로 이어집니다.


## 3. 2단계: GitHub Actions 워크플로우 명세서 작성 (`.github/workflows/deploy.yaml`)


GitHub 저장소의 `.github/workflows/` 폴더 내에 `deploy.yml` 파일을 생성하고 아래와 같이 파이프라인 규칙을 선언합니다.


```yaml
name: Backend CI/CD

on:
  push:
    branches: [ "main" ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    # 1. 소스 코드 체크아웃
    - name: Checkout Source Code
      uses: actions/checkout@v4

    # 2. Docker Hub 로그인
    - name: Login to Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ secrets.DOCKERHUB_USERNAME }}
        password: ${{ secrets.DOCKERHUB_TOKEN }}

    # 3. Docker 이미지 빌드 및 푸시
    - name: Build and Push Docker Image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ secrets.DOCKERHUB_USERNAME }}/backend-app:latest

    # 4. SSH 원격 접속 후 운영 서버 배포 스크립트 실행
    - name: Deploy to Cloud Server via SSH
      uses: appleboy/ssh-action@v1.0.3
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        key: ${{ secrets.SERVER_SSH_KEY }}
        script: |
          docker login -u ${{ secrets.DOCKERHUB_USERNAME }} -p ${{ secrets.DOCKERHUB_TOKEN }}
          docker pull ${{ secrets.DOCKERHUB_USERNAME }}/backend-app:latest
          docker stop backend-container || true
          docker rm backend-container || true
          docker run -d --name backend-container -p 80:8080 ${{ secrets.DOCKERHUB_USERNAME }}/backend-app:latest
          docker image prune -f
```


## 4. 체크리스트


자동 배포를 처음 구축할 때 반드시 마주치는 트러블슈팅과 보안 제약 사항입니다.


### 1. 보안 환경 변수화


절대로 `deploy.yml` 파일이나 `Dockerfile` 내부에 서버 IP, 패스워드, API Key를 평문으로 노출해서는 안 됩니다. 소스 코드가 공개되거나 GitHub 계정이 탈취되었을 때 리소스가 도용되는 끔찍한 사고로 이어집니다.

- **해결책**: GitHub 저장소의 `Settings` ➡️ `Secrets and variables` ➡️ `Actions` 메뉴로 이동하여 민감한 자격 증명을 Repository Secrets 변수로 등록하고, 쉘 스크립트 내에서는 `${{ secrets.XXXX }}` 문법으로 주입받아야 안전합니다.

### 2. 배포 시 발생하는 다운타임


위 워크플로우의 배포 스크립트를 보면 기존 컨테이너를 중지(`docker stop`)하고 새 컨테이너를 띄우는 사이에 몇 초에서 몇 분간 **서비스가 먹통이 되는 다운타임**이 발생합니다. 사용자가 접속 중이라면 502 Bad Gateway 에러를 보게 됩니다.

- **해결책**: 향후 트래픽이 늘어나면 서버 내에 Nginx를 리버스 프록시로 두고, Docker 가상 네트워크 안에서 두 개의 컨테이너를 번갈아 띄우는 **블루-그린(Blue-Green) 무중단 배포** 아키텍처나 `Docker Compose`를 활용한 롤링 업데이트로 시스템을 고도화해야 합니다.

## 5. 결론


CI/CD 파이프라인 구축은 단순한 기술적 유희가 아닙니다. 한 번 올바르게 세팅해 둔 자동화 인프라는 개발자가 배포에 신경 쓰는 에너지를 온전히 비즈니스 로직 설계와 가치 창출에만 집중할 수 있도록 돕습니다.


내가 코딩하고 `git push`를 마친 뒤 커피 한 잔을 마시는 사이에, 클라우드 가상 로봇이 테스트를 돌리고 패키징을 마쳐 실서버에 코드를 반영해 두는 자동화의 짜릿함을 경험해 보세요. 인프라의 시간 혁신이야말로 비즈니스 스케일업의 가장 단단한 주춧돌입니다.


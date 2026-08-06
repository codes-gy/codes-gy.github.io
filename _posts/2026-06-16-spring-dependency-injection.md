---
title: "스프링 의존성 주입 방식에 대해 정리"
date: 2026-06-16
last_modified_at: 2026-08-06
categories:
  - "백엔드"
tags:
  - "Spring Boot"
  - "Java"
  - "Spring"
excerpt: "스프링 프레임워크에서 의존성 주입을 구현하는 3가지 방법의 차이점에 대한 내용입니다."
toc: true
toc_sticky: true
---


## 1. DI 란 무엇일까?


객체가 필요한 의존성을 개발자가 직접 생성하지 않고 스프링 컨테이너에서 주입해 주는 기술입니다.


> 필요한 부품을 직접 만들지 않고 외부에서 받아 사용해서 객체간의 결합도가 낮아지고 유연성이 높아지는 개발 방식입니다.


## 2. 의존성 주입를 사용하는 3가지 방법


> - 필드 주입  
>   
> - 수정자 주입  
>   
> - 생성자 주입


### 필드 주입 방식


클래스 필드에 `@Autowired` 어노테이션을 직접 붙여 주입받는 방식입니다.


```java
@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;
}
```


### 수정자 주입 방식


Setter 메서드에 `@Autowired`를 붙여 의존성을 주입받는 방식입니다.


```java
@Service
public class UserService {

    private UserRepository userRepository;

    @Autowired
    public void setUserRepository(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
}
```


### 생성자 주입 방식


```java
@Service
public class UserService {

    private final UserRepository userRepository;

    // 생성자가 1개만 존재할 경우 @Autowired 생략 가능
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }
}
```


> - **생성자가 1개인 경우**: `@Autowired` 생략 가능 (스프링이 자동으로 해당 생성자로 주입)  
>   
> - **생성자가 2개 이상인 경우**: 주입받을 특정 생성자에 **`@Autowired`** **작성**


## 3. 비교


| **구분**      | **필드 주입** | **수정자 주입**  | **생성자 주입**     |
| ----------- | --------- | ----------- | -------------- |
| **특징**      | 코드가 간결함   | 선택적 주입 시 유용 | **불변성 보장
안전함** |
| **`final`** | 사용 불가     | 사용 불가       | **사용 가능**      |


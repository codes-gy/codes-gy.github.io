---
title: "Spring Boot에서 TDD로 개발하기"
date: 2026-08-06
last_modified_at: 2026-08-06
categories:
  - "테스트"
tags:
  - "Java"
  - "Spring Boot"
excerpt: "테스트 코드를 먼저 작성하고, 이를 통과하는 최소한의 프로덕션 코드를 구현한 뒤, 지속적으로 리팩토링해 나가는 개발 방법입니다"
toc: true
toc_sticky: true
---


## **1. TDD(Test-Driven Development) 핵심**



TDD는 **'실패하는 테스트 → 최소한의 구현 → 리팩토링'** 순서를 철저히 지키는 개발 방법론입니다.


> 🔴 **RED (실패)**: 구현하려는 로직의 실패하는 테스트 코드를 먼저 작성합니다.  
> 🟢 **GREEN (성공)**: 테스트를 가장 빠르게 통과시키는 최소한의 프로덕션 코드를 작성합니다.  
>   
> 🔵 **REFACTOR (개선)**: 테스트 통과를 유지하며 중복을 제거하고 가독성을 높입니다.


## 2. 어떻게 작성하지?


> - 테스트 코드가 로직 실패를 정확히 감지하는지 먼저 확인합니다.  
>   
> - 객체의 내부 동작보다 외부에서 어떻게 사용할지 먼저 고민하게 됩니다.  
>   
> - 테스트를 통과할 만큼의 필요 코드만 작성하도록 합니다.


## 3. 작성 방법(포인트 충전 기능 TDD)


### Step 1. 🔴 RED — 실패하는 테스트 작성


비즈니스 로직(Service)이 완성되지 않은 상태에서 요구사항("충전 금액이 0 이하이면 예외가 발생한다")을 검증하는 테스트를 먼저 만듭니다.


```java
@ExtendWith(MockitoExtension.class)
// @ExtendWith: JUnit5 환경에서 Mockito 프레임워크 확장 기능을 활성화합니다.
class PointServiceTest {

    @Mock
    // @Mock: 가짜(Mock) 객체를 생성합니다. DB 연동 없이 단위 테스트를 빠르게 실행하도록 돕습니다.
    private PointRepository pointRepository;

    @InjectMocks
    // @InjectMocks: @Mock으로 생성된 가짜 객체들을 해당 서비스 객체에 자동으로 주입해 줍니다.
    private PointService pointService;

    @Test
    // @Test: 해당 메서드가 독립적으로 실행 가능한 테스트 케이스임을 명시합니다.
    @DisplayName("충전 금액이 0 이하이면 IllegalArgumentException 예외가 발생한다")
    // @DisplayName: 테스트 실행 결과 창에 보여줄 직관적인 설명을 작성합니다.
    void chargePoint_AmountZero_ThrowsException() {
        // given
        Long userId = 1L;
        long invalidAmount = 0L;

        // when & then
        assertThatThrownBy(() -> pointService.charge(userId, invalidAmount))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("충전 금액은 0보다 커야 합니다.");
    }
}
```


### Step 2. 🟢 GREEN — 최소한의 프로덕션 코드 작성


테스트를 통과시킬 수 있는 최소한의 검증 로직만 추가합니다.


```java
@Service
// @Service: Spring의 Service 레이어 빈(Bean)으로 등록합니다.
@RequiredArgsConstructor
// @RequiredArgsConstructor: final 필드에 대한 생성자를 자동으로 만들어 의존성을 주입(DI)받습니다.
public class PointService {

    private final PointRepository pointRepository;

    @Transactional
    // @Transactional: 메서드 내의 데이터베이스 작업을 하나의 트랜잭션으로 묶어 처리합니다.
    public void charge(Long userId, long amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("충전 금액은 0보다 커야 합니다.");
        }
    }
}
```


### Step 3. 🔵 REFACTOR — 코드 정돈 및 기능 확장


성공하는 테스트를 기반으로 비즈니스 로직을 완성하고 코드를 깔끔하게 작성합니다.


```java
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
// readOnly = true: 기본 조회의 성능을 최적화하고, CUD 메서드에만 별도로 @Transactional을 지정합니다.
public class PointService {

    private final PointRepository pointRepository;

    @Transactional
    public PointResponse charge(Long userId, long amount) {
        validateAmount(amount);

        Point point = pointRepository.findByUserId(userId)
                .orElseGet(() -> new Point(userId, 0L));

        point.addAmount(amount);
        return PointResponse.from(point);
    }

    private void validateAmount(long amount) {
        if (amount <= 0) {
            throw new IllegalArgumentException("충전 금액은 0보다 커야 합니다.");
        }
    }
}
```


### 4. 어노테이션


| **어노테이션**                             | **설명**                                        |
| ------------------------------------- | --------------------------------------------- |
| `@ExtendWith(MockitoExtension.class)` | 순수 단위 테스트에서 Mockito 가짜 객체를 가볍게 사용하기 위해 지정     |
| `@Mock`                               | DB나 외부 API 등 실제 객체 대신 동작을 흉내 낼 가짜 객체 생성       |
| `@InjectMocks`                        | 생성된 `@Mock` 객체들을 해당 서비스 클래스 생성자로 자동으로 주입      |
| `@WebMvcTest`                         | Controller 레이어만 슬라이스 테스트할 때 사용 (`MockMvc` 활용) |
| `@DataJpaTest`                        | Repository 레이어만 인메모리 DB(H2 등) 환경에서 테스트할 때 사용  |


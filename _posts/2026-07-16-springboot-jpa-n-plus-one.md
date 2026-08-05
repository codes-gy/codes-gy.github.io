---
title: "Spring Boot와 JPA 환경에서 N+1 문제 완벽하게 해결하기"
date: 2026-07-16
last_modified_at: 2026-07-15
categories:
  - "자바"
tags:
  []
excerpt: "데이터베이스 조회 성능 저하의 주범인 JPA N+1 문제의 발생 원인을 분석하고, Fetch Join과 EntityGraph를 통해 쿼리를 최적화하는 방법을 살펴봅니다."
toc: true
toc_sticky: true
---


JPA(Java Persistence API)는 자바 개발자에게 혁신적인 편리함을 제공하지만, 실무에서 대규모 트래픽을 처리하거나 복잡한 연관 관계를 다룰 때 반드시 마주치게 되는 가장 대표적인 성능 저하 주범이 있습니다. 바로 **N+1 문제**입니다.


코드가 직관적이라는 이유로 무심코 작성한 단 한 줄의 조회가 서비스 전체의 데이터베이스를 마비시키는 치명적인 병목을 만들어내기도 합니다. 이번 포스팅에서는 2026년 현재 모던 백엔드 아키텍처에서도 여전히 중요하게 다뤄지는 JPA N+1 문제의 발생 원인을 분석하고, 이를 프로덕션 환경에서 안전하고 완벽하게 해결하는 실무 튜닝 노하우를 공유합니다.


## 1. N+1 문제란 무엇인가?


N+1 문제는 조회하고자 하는 주 객체(Parent)를 가져오기 위한 쿼리 1번(1)을 실행했는데, 주 객체가 가지고 있는 **연관 관계 엔티티(Child)를 조회하기 위한 추가 쿼리가 N번(N)** 더 실행되는 현상을 말합니다.


가장 흔한 예시인 `팀(Team)`과 `회원(Member)`의 1:N 관계를 코드로 살펴보겠습니다.


```java
@Entity
public class Team {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private str name;

    @OneToMany(mappedBy = "team", fetch = FetchType.LAZY)
    private List<Member> members = new ArrayList<>();
}

@Entity
public class Member {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private str username;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id")
    private Team team;
}
```



많은 개발자들이 `FetchType.LAZY(지연 로딩)`를 설정하면 N+1 문제가 발생하지 않을 것이라 오해합니다. 하지만 지연 로딩은 단지 연관 데이터의 조회 시점을 뒤로 미룰 뿐, 다음과 같이 루프를 돌며 연관 객체에 접근하는 순간 여전히 N+1 문제가 터지게 됩니다.




```java
// 1. 모든 팀을 조회 (쿼리 1번 발송)
List<Team> teams = teamRepository.findAll(); 

// 2. 각 팀의 회원 이름을 출력하기 위해 루프 가동
for (Team team : teams) {
    // 지연 로딩된 members 프록시가 실제 초기화되면서 팀 개수(N)만큼 추가 쿼리 발생!
    System.out.println(team.getMembers().size()); 
}
```


데이터베이스에 팀이 10개 저장되어 있다면, 주 쿼리 1번 외에 각 팀에 속한 회원을 가져오기 위한 쿼리가 10번 더 실행되어 총 11번(1 + 10)의 SQL이 날아갑니다. 만약 데이터가 1만 개라면 기하급수적인 성능 파탄으로 이어집니다.


## 2. 해결책 1: Fetch Join으로 한 방에 가져오기


N+1 문제를 해결하는 가장 확실하고 정석적인 방법은 JPQL의 `fetch join`을 사용하는 것입니다. 데이터베이스 수준에서 일반 `INNER JOIN`을 사용하면서 연관된 엔티티까지 `SELECT` 절에 한 번에 끌고 와 영속성 컨텍스트에 통째로 올리는 방식입니다.


```java
public interface TeamRepository extends JpaRepository<Team, Long> {

    @Query("select t from Team t join fetch t.members")
    List<Team> findAllFetchJoin();
}
```


DB 로그 비교


**기존 실행 로그 (N+1 발생)**


```sql
SELECT * FROM team; -- 1번
SELECT * FROM member WHERE team_id = 1; -- N번 시작
SELECT * FROM member WHERE team_id = 2;
```


Fetch Join 적용 후


```sql
SELECT t.*, m.* 
FROM team t 
INNER JOIN member m ON t.id = m.team_id; -- 단 1번 호!
```


지연 로딩 설정과 상관없이 단 1번의 조인 쿼리로 주 객체와 자식 객체를 모두 프록시가 아닌 실제 엔티티 객체로 채워 넣기 때문에 성능이 비약적으로 상승합니다.


## 3. 해결책 2: `@EntityGraph` 활용하기


JPQL 쿼리문을 직접 작성하는 것이 번거롭다면 스프링 데이터 JPA가 제공하는 `@EntityGraph` 어노테이션을 사용할 수 있습니다. 어노테이션의 속성에 같이 조회할 연관 관계 필드명을 명시해 주면 내부적으로 Fetch Join을 수행합니다.


```java
public interface TeamRepository extends JpaRepository<Team, Long> {

    @EntityGraph(attributePaths = {"members"})
    @Query("select t from Team t")
    List<Team> findAllEntityGraph();
}
```


기본적으로 쿼리 메서드 위에 가볍게 얹어서 쓸 수 있어 가독성이 좋지만, 조금만 복잡한 조인이 들어가도 JPQL을 명시해야 하므로 실무에서는 기본 조회 메서드를 재정의할 때 주로 선택됩니다.


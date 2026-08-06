---
title: "절차지향 프로그래밍의 개념과 특징 이해하기"
date: 2026-07-31
last_modified_at: 2026-08-06
categories:
  - "백엔드"
tags:
  - "Python"
excerpt: "절차지향 프로그래밍의 기본 개념과 순차적 흐름 처리 방식, 핵심 특징 및 장단점을 정리한 내용입니다."
toc: true
toc_sticky: true
---


## 1. 절차지향 프로그래밍이란?


절차지향 프로그래밍은 **순차적인 처리가 중심이 되는 프로그래밍**입니다.


> 절차는 순서만을 의미하는 것이 아니라 해결해야 할 문제를 여러 개의 작은 함수 단위로 나누고, 이 함수들을 순차적으로 실행하여 프로그램을 완성하는 방식입니다.


## 2. 절차지향 프로그래밍의 핵심 특징


> - 프로그램 전체의 거대한 기능을 먼저 정의한 뒤, 이를 작은 단위의 함수로 쪼개어 나가는 방식으로 설계합니다.  
>   
> - 작성된 코드가 위에서 아래로 순차적으로 실행되며, 프로그램의 실행 흐름을 직관적으로 파악할 수 있습니다.  
>   
> - 데이터를 저장하는 변수와, 그 데이터를 처리하는 함수가 별개로 독립되어 존재합니다.  
>   
> - 반복되는 로직을 함수로 묶어 필요할 때 호출하여 사용합니다.


## 3. 예제


계좌의 입출금 및 잔액 조회를 절차지향 방식으로 작성한 코드입니다. 데이터와 이를 처리하는 함수가 독립적으로 나뉘어 관리됩니다.


```python
# 1. 데이터 정의
account_balance = 0


# 2. 로직 정의
def deposit(amount):
    global account_balance
    if amount <= 0:
        print("입금 금액은 0보다 커야 합니다.")
        return
    account_balance += amount
    print(f"{amount}원 입금 완료. (현재 잔액: {account_balance}원)")


def withdraw(amount):
    global account_balance
    if amount > account_balance:
        print("잔액이 부족합니다.")
        return
    account_balance -= amount
    print(f"{amount}원 출금 완료. (현재 잔액: {account_balance}원)")


def get_balance():
    print(f"현재 잔액 조회: {account_balance}원")


# 3. 순차 실행
print("=== 뱅킹 시스템 실행 ===")
deposit(10000)  # 10,000원 입금
withdraw(3000)  # 3,000원 출금
get_balance()  # 잔액 확인
withdraw(8000)  # 잔액 부족 출금 시도
```


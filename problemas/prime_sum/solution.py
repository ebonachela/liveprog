from math import sqrt, ceil

n = int(input())

def isPrime(x):
    if x <= 1:
        return False

    for i in range(1, int(sqrt(x))):
        if x % i != 0:
            return False

    return True

for i in range(n):
    x = int(input())
    flag = False
    
    for a in range(1, ceil(x / 2)):
        if isPrime(a) and isPrime(x - a):
            flag = True
            break
    
    if flag:
        print('yes')
    else:
        print('no')
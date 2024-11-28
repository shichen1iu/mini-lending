<<<<<<< HEAD
# Mini-lending

## 概述
这是一个去中心化借贷协议，目前支持 SOL 和 USDC 两种资产。用户可以在不同资产池中进行存款和借款操作。
![[Pasted image 20241128153607.png]]
## 主要功能

### 存款
- 支持 SOL 和 USDC 两种资产的存款
- 存款可赚取相应的存款利息
- 存入的资产可作为借款抵押物

### 借款
- 支持 SOL 和 USDC 两种资产的借款
- 需要超额抵押才能进行借款
- 借款需支付相应的借款利息

### 清算机制
- 系统通过健康因子（Health Factor）监控借款头寸的安全性
- 当健康因子低于 1 时，将触发清算机制
- 清算过程自动执行，确保系统的稳定性

## 风险提示
请注意：
- 借款时需谨慎评估自己的还款能力
- 及时关注健康因子的变化
- 市场波动可能导致抵押物价值变化，进而影响健康因子

![[Pasted image 20241128154041.png]]

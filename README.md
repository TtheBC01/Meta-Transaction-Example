# Simple Meta-Transaction Example

This repo shows how to implement an 
[EIP-2771](https://eips.ethereum.org/EIPS/eip-2771) compatible contract using the OpenZeppelin contract library. 
The example also relies on [EIP-712](https://eips.ethereum.org/EIPS/eip-712) for typed data signing. The example 
uses the [Hardhat](https://hardhat.org/) framework for compilation and execution. 

There is only one contract to inspect; [Greeter.sol](/contracts/Greeter.sol). The Greeter contract is nearly identical
to the default Greeter contract created by the Hardhat sample project, except that the `greet()` function now emits
a `Greetings` event that logs `_msgSender`. 

## Setup

```
git clone https://github.com/TtheBC01/Meta-Transaction-Example.git
cd Meta-Transaction-Example
npm install
```

## Execution

Compile Greeter.sol like this:

```
npx hardhat compile
```

Run the unit tests that illustrate how to utilize EIP-2771 like this:

```
npx hardhat test
```

If you want to see the emitted Ethereum Events showing the value of `_msgSender`, use event tracing:

```
npx hardhat test --trace
```

## Expected behavior

In the [first unit test](/test/sample-test.js#L87), a normal call to `greet()` is preformed by an account acting as
an end user. You will see that the end user's funds are used in order to pay for the transaction fee. If you turn on 
event tracing, you will see the following event emitted:

```
CALL Greeter.greet()
   EVENT Greeter.Greatings(who=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, what="Hello, World!")
```

In the [second unit test](/test/sample-test.js#L106), a new account, `relayer`, will submit a transaction from
an instance of the [`MinimalForwarder`](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/metatx/MinimalForwarder.sol) implementation which will implicitly make a call to the `greet()` function on behalf
of the `endUser` account. After the transaction is mined, you will see the the balance of `endUser` remains the same and 
event tracing will show that the address of `endUser` was logged in the Ethereum event. 

```
CALL MinimalForwarder.execute(req=[0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9, 0, 1000000, 0, 0xcfae3217], signature=0xfb9baab92637d5705af021d26a09fb9f074105a64e7ce75178a05ede934a86e066f31d4083f6a029e06fc136eed56e8812332a598473bab9a83c5a5638722b551c)
   STATICCALL UnknownContractAndFunction(to=0x0000000000000000000000000000000000000001, input=0x98046c9bd2d93e6f7746a1b40edb54e82cb00199c40fbe6e17647cf1d794751c000000000000000000000000000000000000000000000000000000000000001cfb9baab92637d5705af021d26a09fb9f074105a64e7ce75178a05ede934a86e066f31d4083f6a029e06fc136eed56e8812332a598473bab9a83c5a5638722b55, ret=0x000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb92266)
   CALL Greeter.greet()
      EVENT Greeter.Greatings(who=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266, what="Hello, World!")
```
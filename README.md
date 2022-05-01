# Simple Meta-Transaction Example

This repo shows how to use the OpenZeppelin meta-transaction library to implement an 
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
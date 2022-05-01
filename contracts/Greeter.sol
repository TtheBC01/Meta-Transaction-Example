//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/metatx/ERC2771Context.sol";

import "hardhat/console.sol";


contract Greeter is ERC2771Context {

    event Greatings(address indexed who, string what);

    string private greeting;

    constructor(string memory _greeting, address trustedForwarder)
      ERC2771Context(trustedForwarder)
	{ 
        console.log("Deploying a Greeter with greeting:", _greeting);
        greeting = _greeting;
    }

    function greet() external {
	    address owner = _msgSender();
	    emit Greatings(owner, greeting);
    }

    function setGreeting(string memory _greeting) public {
        console.log("Changing greeting from '%s' to '%s'", greeting, _greeting);
        greeting = _greeting;
    }
}

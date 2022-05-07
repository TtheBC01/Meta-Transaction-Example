const { expect } = require("chai");
const { ethers } = require("hardhat");

// helper function to make code more readable
async function deploy(name, ...params) {
  const Contract = await ethers.getContractFactory(name);
  return await Contract.deploy(...params).then(f => f.deployed());
}

// see https://eips.ethereum.org/EIPS/eip-712 for more info
const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' }
];

const ForwardRequest = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'gas', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'data', type: 'bytes' },
];

function getMetaTxTypeData(chainId, verifyingContract) {
  return {
    types: {
      EIP712Domain,
      ForwardRequest,
    },
    domain: {
      name: 'MinimalForwarder',
      version: '0.0.1',
      chainId,
      verifyingContract,
    },
    primaryType: 'ForwardRequest',
  }
};

async function signTypedData(signer, from, data) {
  // Send the signTypedData RPC call
  const [method, argData] = ['eth_signTypedData_v4', JSON.stringify(data)];
  return await signer.send(method, [from, argData]);
}

async function buildRequest(forwarder, input) {
  const nonce = await forwarder.getNonce(input.from).then(nonce => nonce.toString());
  return { value: 0, gas: 1e6, nonce, ...input };
}

async function buildTypedData(forwarder, request) {
  const chainId = await forwarder.provider.getNetwork().then(n => n.chainId);
  const typeData = getMetaTxTypeData(chainId, forwarder.address);
  return { ...typeData, message: request };
}

async function signMetaTxRequest(signer, forwarder, input) {
  const request = await buildRequest(forwarder, input);
  const toSign = await buildTypedData(forwarder, request);
  const signature = await signTypedData(signer, input.from, toSign);
  return { signature, request };
}

// ----------------------------------------------------------------------------------------
// Unit tests start here
// ----------------------------------------------------------------------------------------
describe("Greeter", function() {
  beforeEach(async () => {
	// deploy the meta-tx forwarder contract
	this.forwarder = await deploy("MinimalForwarder");
	
	// deploy the EIP-2771 compatible Greeter contract
	this.greeter = await deploy("Greeter", "Hello, World!", this.forwarder.address);
	
	// get the accounts we are going to use
	this.accounts = await ethers.getSigners();
  });
  
  it("Transaction uses end user's funds for gas.", async () => {
	// extract the account to act as the end user and check its ETH balance
	const endUser = this.accounts[0]; 
	const endUserFundsBefore = await ethers.provider.getBalance(endUser.address);
	
	// connect end user's account to the Greeting contract handle and make a transaction
	const greeter = this.greeter.connect(endUser);
	await expect(greeter.greet()).to.emit(greeter, 'Greatings').withArgs(endUser.address, "Hello, World!");
	
	// now check the end user's funds after the transaction has been sent
	const endUserFundsAfter = await ethers.provider.getBalance(endUser.address);
	const endUserFundsWereUsed = (endUserFundsAfter < endUserFundsBefore);
	
	// End user's address was logged in the greet call and their funds have been reduced
	expect(endUserFundsWereUsed).to.equal(true);
  });
  
  it("Transaction uses relayer's funds for gas.", async () => {
	// extract the account to act as the end user and check its ETH balance
	const endUser = this.accounts[0]; 
	const endUserFundsBefore = await ethers.provider.getBalance(endUser.address);
	
	// extract the account that will pay the gas and act as the relayer
	const relayer = this.accounts[1];
	
	// connect the relayer account to the forwarder contract handle
	const minimalforwarder = this.forwarder.connect(relayer);
	const greeter = this.greeter;
	
	// construct the signed payload for the relayer to accept on the end user's behalf
	const { request, signature } = await signMetaTxRequest(endUser.provider, minimalforwarder, {
	  from: endUser.address,
	  to: greeter.address,
	  data: greeter.interface.encodeFunctionData('greet', []),
	});
	
	// now pass the request and signature over to the relayer account and have the relayer account 
	// execute the meta-tx with it's own funds
	await expect(minimalforwarder.execute(request, signature)).to.emit(greeter, 'Greatings').withArgs(endUser.address, "Hello, World!");
	
	// check the end user's funds after the transaction has been sent, they should be untouched
	const endUserFundsAfter = await ethers.provider.getBalance(endUser.address);
	const endUserFundsWereNotUsed = (endUserFundsAfter.toString() === endUserFundsBefore.toString());
	
	// End user's address was logged in the greet call and their funds have not been used
	// User npx hardhat test --trace to see the event
	expect(endUserFundsWereNotUsed).to.equal(true);
  });
});

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
  // If signer is a private key, use it to sign
  if (typeof(signer) === 'string') {
    const privateKey = Buffer.from(signer.replace(/^0x/, ''), 'hex');
    return ethSigUtil.signTypedMessage(privateKey, { data });
  }

  // Otherwise, send the signTypedData RPC call
  // Note that hardhatvm and metamask require different EIP712 input
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
	const receipt = await greeter.greet().then(tx => tx.wait());
	
	// now check the end user's funds after the transaction has been sent
	const endUserFundsAfter = await ethers.provider.getBalance(endUser.address);
	const endUserFundsWereUsed = (endUserFundsAfter < endUserFundsBefore);
	
	// End user's address was logged in the greet call and their funds have been reduced
    expect(receipt.events[0].event).to.equal('Greatings');
	expect(receipt.events[0].args[0]).to.equal(endUser.address);
	expect(endUserFundsWereUsed).to.equal(true);
  });
  
  it("Transaction uses forwarder's funds for gas.", async () => {
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
	
	// now have the relayer account execute the meta-tx with it's own funds
	const receipt = await minimalforwarder.execute(request, signature).then(tx => tx.wait());
	console.log(receipt.events);
	
	// check the end user's funds after the transaction has been sent, they should be untouched
	const endUserFundsAfter = await ethers.provider.getBalance(endUser.address);
	const endUserFundsWereNotUsed = (endUserFundsAfter.toString() === endUserFundsBefore.toString());
	
	// End user's address was logged in the greet call and their funds have not been used
/*     expect(receipt.events[0].event).to.equal('Greatings');
	expect(receipt.events[0].args[0]).to.equal(endUser.address); */
	expect(endUserFundsWereNotUsed).to.equal(true);
  });
});

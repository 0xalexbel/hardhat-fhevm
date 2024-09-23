import hre from "hardhat";
import { Contract, ethers } from "ethers";

import { HardhatFhevmInstances, Signers, createInstances, getSigners, initSigners } from "./test_utils";
import { deployEncryptedERC20Fixture } from "./TestEncryptedERC20.fixture";

describe("TestEncryptedERC20", function () {
  let signers: Signers;
  let contractAddress: string;
  let erc20: Contract;
  /* eslint-disable @typescript-eslint/no-unused-vars */
  let instances: HardhatFhevmInstances;

  before(async function () {
    await initSigners();
    signers = getSigners();
  });

  beforeEach(async function () {
    //"0x569243Df3e9B9e275Fb83Fb4395E33050c9b2cD8"
    //"0x25a1FB309C560662e03EA48C4DE47Bf0b45c2B47"
    erc20 = await deployEncryptedERC20Fixture("0x25a1FB309C560662e03EA48C4DE47Bf0b45c2B47");
    contractAddress = await erc20.getAddress();
    console.log(contractAddress);
    instances = await createInstances(signers);
  });

  it("Test2: should transfer tokens between two users", async function () {
    // const aliceERC20 = erc20.connect(signers.alice) as ethers.Contract;
    // const transaction = await aliceERC20.mint(10000);
    // const t1 = await transaction.wait();
    // expect(t1?.status).to.eq(1);

    const aliceBalanceHandleBefore = await erc20.balanceOf(signers.alice);
    // const a1 = await hre.fhevm.isAllowed(aliceBalanceHandleBefore, ethers.ZeroAddress);
    // const a2 = await hre.fhevm.isAllowed(aliceBalanceHandleBefore, erc20);
    // const a3 = await hre.fhevm.isAllowed(aliceBalanceHandleBefore, signers.alice);
    // const a4 = await hre.fhevm.isAllowed(aliceBalanceHandleBefore, signers.bob);
    // const a5 = await hre.fhevm.isAllowed(aliceBalanceHandleBefore, signers.carol);

    // console.log("zero =" + a1);
    // console.log("erc20=" + a2);
    // console.log("alice=" + a3);
    // console.log("bob  =" + a4);
    // console.log("carol=" + a5);

    const aliceClearBalanceBefore = await hre.fhevm.decrypt64(
      aliceBalanceHandleBefore,
      ethers.ZeroAddress,
      signers.bob,
    );
    console.log(aliceClearBalanceBefore);

    // // Decrypt Alice's balance
    // const balanceHandleAlice = await erc20.balanceOf(signers.alice);
    // const { publicKey, privateKey } = instances.alice.generateKeypair();
    // const eip712 = instances.alice.createEIP712(publicKey, contractAddress);
    // const signature = await signers.alice.signTypedData(
    //   eip712.domain,
    //   { Reencrypt: eip712.types.Reencrypt },
    //   eip712.message,
    // );
    // const balanceAlice = await instances.alice.reencrypt(
    //   aliceBalanceHandleBefore,
    //   privateKey,
    //   publicKey,
    //   signature.replace("0x", ""),
    //   contractAddress,
    //   signers.alice.address,
    // );
    // console.log(balanceAlice);
  });

  // it("should mint the contract", async function () {
  //   const transaction = await erc20.mint(1000);
  //   await transaction.wait();

  //   // Reencrypt Alice's balance
  //   const balanceHandleAlice = await erc20.balanceOf(signers.alice);
  //   const { publicKey: publicKeyAlice, privateKey: privateKeyAlice } = instances.alice.generateKeypair();
  //   const eip712 = instances.alice.createEIP712(publicKeyAlice, contractAddress);
  //   const signatureAlice = await signers.alice.signTypedData(
  //     eip712.domain,
  //     { Reencrypt: eip712.types.Reencrypt },
  //     eip712.message,
  //   );
  //   const balanceAlice = await instances.alice.reencrypt(
  //     balanceHandleAlice,
  //     privateKeyAlice,
  //     publicKeyAlice,
  //     signatureAlice.replace("0x", ""),
  //     contractAddress,
  //     signers.alice.address,
  //   );
  //   expect(balanceAlice).to.equal(1000n);

  //   const totalSupply = await erc20.totalSupply();
  //   expect(totalSupply).to.equal(1000n);
  // });

  // it("should transfer tokens between two users", async function () {
  //   // const transaction = await erc20.mint(10000);
  //   // const t1 = await transaction.wait();
  //   // expect(t1?.status).to.eq(1);

  //   // const input = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
  //   // input.add64(1337);
  //   // const encryptedTransferAmount = input.encrypt();
  //   // const tx = await erc20["transfer(address,bytes32,bytes)"](
  //   //   signers.bob.address,
  //   //   encryptedTransferAmount.handles[0],
  //   //   encryptedTransferAmount.inputProof,
  //   // );
  //   // const t2 = await tx.wait();
  //   // expect(t2?.status).to.eq(1);

  //   // Reencrypt Alice's balance
  //   const balanceHandleAlice = await erc20.balanceOf(signers.alice);
  //   const { publicKey: publicKeyAlice, privateKey: privateKeyAlice } = instances.alice.generateKeypair();
  //   const eip712 = instances.alice.createEIP712(publicKeyAlice, contractAddress);
  //   const signatureAlice = await signers.alice.signTypedData(
  //     eip712.domain,
  //     { Reencrypt: eip712.types.Reencrypt },
  //     eip712.message,
  //   );
  //   const balanceAlice = await instances.alice.reencrypt(
  //     balanceHandleAlice,
  //     privateKeyAlice,
  //     publicKeyAlice,
  //     signatureAlice.replace("0x", ""),
  //     contractAddress,
  //     signers.alice.address,
  //   );

  //   console.log(balanceAlice);
  // });

  // it("should transfer tokens between two users", async function () {
  //   const transaction = await erc20.mint(10000);
  //   const t1 = await transaction.wait();
  //   expect(t1?.status).to.eq(1);

  //   const input = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
  //   input.add64(1337);
  //   const encryptedTransferAmount = input.encrypt();
  //   const tx = await erc20["transfer(address,bytes32,bytes)"](
  //     signers.bob.address,
  //     encryptedTransferAmount.handles[0],
  //     encryptedTransferAmount.inputProof,
  //   );
  //   const t2 = await tx.wait();
  //   expect(t2?.status).to.eq(1);

  //   // Reencrypt Alice's balance
  //   const balanceHandleAlice = await erc20.balanceOf(signers.alice);
  //   const { publicKey: publicKeyAlice, privateKey: privateKeyAlice } = instances.alice.generateKeypair();
  //   const eip712 = instances.alice.createEIP712(publicKeyAlice, contractAddress);
  //   const signatureAlice = await signers.alice.signTypedData(
  //     eip712.domain,
  //     { Reencrypt: eip712.types.Reencrypt },
  //     eip712.message,
  //   );
  //   const balanceAlice = await instances.alice.reencrypt(
  //     balanceHandleAlice,
  //     privateKeyAlice,
  //     publicKeyAlice,
  //     signatureAlice.replace("0x", ""),
  //     contractAddress,
  //     signers.alice.address,
  //   );

  //   console.log(balanceAlice);
  //   expect(balanceAlice).to.equal(10000n - 1337n);

  //   // Reencrypt Bob's balance
  //   const balanceHandleBob = await erc20.balanceOf(signers.bob);

  //   const { publicKey: publicKeyBob, privateKey: privateKeyBob } = instances.bob.generateKeypair();
  //   const eip712Bob = instances.bob.createEIP712(publicKeyBob, contractAddress);
  //   const signatureBob = await signers.bob.signTypedData(
  //     eip712Bob.domain,
  //     { Reencrypt: eip712Bob.types.Reencrypt },
  //     eip712Bob.message,
  //   );
  //   const balanceBob = await instances.bob.reencrypt(
  //     balanceHandleBob,
  //     privateKeyBob,
  //     publicKeyBob,
  //     signatureBob.replace("0x", ""),
  //     contractAddress,
  //     signers.bob.address,
  //   );

  //   expect(balanceBob).to.equal(1337n);
  //   console.log(balanceBob);
  // });

  // it("Test1: should mint the contract", async function () {
  //   const balanceHandleBefore = await erc20.balanceOf(signers.alice);
  //   const aliceERC20 = erc20.connect(signers.alice) as ethers.Contract;

  //   const tx = await aliceERC20.mint(1000);
  //   await tx.wait(1);

  //   const balanceHandleAfter = await erc20.balanceOf(signers.alice);

  //   const clearBalanceBefore = await hre.fhevm.decrypt64(balanceHandleBefore);
  //   const clearBalanceAfter = await hre.fhevm.decrypt64(balanceHandleAfter);

  //   expect(clearBalanceAfter - clearBalanceBefore).to.eq(1000n);
  // });

  // it("Test2: should transfer tokens between two users", async function () {
  //   const aliceBalanceHandleBefore = await erc20.balanceOf(signers.alice);
  //   const aliceClearBalanceBefore = await hre.fhevm.decrypt64(aliceBalanceHandleBefore);
  //   console.log(aliceClearBalanceBefore);

  //   // Decrypt Alice's balance
  //   const balanceHandleAlice = await erc20.balanceOf(signers.alice);
  //   const { publicKey, privateKey } = instances.alice.generateKeypair();
  //   const eip712 = instances.alice.createEIP712(publicKey, contractAddress);
  //   const signature = await signers.alice.signTypedData(
  //     eip712.domain,
  //     { Reencrypt: eip712.types.Reencrypt },
  //     eip712.message,
  //   );
  //   const balanceAlice = await instances.alice.reencrypt(
  //     aliceBalanceHandleBefore,
  //     privateKey,
  //     publicKey,
  //     signature.replace("0x", ""),
  //     contractAddress,
  //     signers.alice.address,
  //   );
  //   console.log(balanceAlice);

  //   // const bobBalanceHandleBefore = await erc20.balanceOf(signers.bob);
  //   // const bobClearBalanceBefore = await hre.fhevm.decrypt64(bobBalanceHandleBefore);

  //   // const aliceERC20 = erc20.connect(signers.alice) as ethers.Contract;

  //   // // const transaction = await erc20.mint(10000);
  //   // // const t1 = await transaction.wait();
  //   // // expect(t1?.status).to.eq(1);
  //   // const input = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
  //   // input.add64(1337);
  //   // const encryptedTransferAmount = input.encrypt();

  //   // const tx = await aliceERC20["transfer(address,bytes32,bytes)"](
  //   //   signers.bob.address,
  //   //   encryptedTransferAmount.handles[0],
  //   //   encryptedTransferAmount.inputProof,
  //   // );
  //   // const t2 = await tx.wait();
  //   // expect(t2?.status).to.eq(1);

  //   // // Decrypt Alice's balance
  //   // const aliceBalanceHandle = await aliceERC20.balanceOf(signers.alice);
  //   // const aliceBalanceAfter = await hre.fhevm.decrypt64(aliceBalanceHandle);
  //   // console.log(aliceBalanceAfter);
  //   // //https://gateway.devnet.zama.ai/

  //   // //expect(aliceBalanceAfter).to.equal(aliceClearBalanceBefore - 1337n);

  //   // // Decrypt Bob's balance
  //   // // const balanceHandleBob = await erc20.balanceOf(signers.bob);
  //   // // const balanceBob = await hre.fhevm.decrypt64(balanceHandleBob);
  //   // // expect(balanceBob).to.equal(bobClearBalanceBefore + 1337n);
  // });

  // // it("Test3: reencrypt - should transfer tokens between two users", async function () {
  // //   const transaction = await erc20.mint(10000);
  // //   const t1 = await transaction.wait();
  // //   expect(t1?.status).to.eq(1);

  // //   const input = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
  // //   input.add64(1337);
  // //   const encryptedTransferAmount = input.encrypt();
  // //   const tx = await erc20["transfer(address,bytes32,bytes)"](
  // //     signers.bob.address,
  // //     encryptedTransferAmount.handles[0],
  // //     encryptedTransferAmount.inputProof,
  // //   );
  // //   const t2 = await tx.wait();
  // //   expect(t2?.status).to.eq(1);

  // //   // Decrypt Alice's balance
  // //   const balanceHandleAlice = await erc20.balanceOf(signers.alice);
  // //   const { publicKey, privateKey } = instances.alice.generateKeypair();
  // //   const eip712 = instances.alice.createEIP712(publicKey, contractAddress);
  // //   const signature = await signers.alice.signTypedData(
  // //     eip712.domain,
  // //     { Reencrypt: eip712.types.Reencrypt },
  // //     eip712.message,
  // //   );
  // //   const balanceAlice = await instances.alice.reencrypt(
  // //     balanceHandleAlice,
  // //     privateKey,
  // //     publicKey,
  // //     signature.replace("0x", ""),
  // //     contractAddress,
  // //     signers.alice.address,
  // //   );

  // //   expect(balanceAlice).to.equal(BigInt(10000 - 1337));
  // // });

  // // it("Test4: should not transfer tokens between two users", async function () {
  // //   const transaction = await erc20.mint(1000);
  // //   await transaction.wait();

  // //   const input = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
  // //   input.add64(1337);
  // //   const encryptedTransferAmount = input.encrypt();
  // //   const tx = await erc20["transfer(address,bytes32,bytes)"](
  // //     signers.bob.address,
  // //     encryptedTransferAmount.handles[0],
  // //     encryptedTransferAmount.inputProof,
  // //   );
  // //   await tx.wait();

  // //   // Decrypt Alice's balance
  // //   const balanceHandleAlice = await erc20.balanceOf(signers.alice);
  // //   const balanceAlice = await hre.fhevm.decrypt64(balanceHandleAlice);
  // //   expect(balanceAlice).to.equal(1000n);

  // //   // Decrypt Bob's balance
  // //   const balanceHandleBob = await erc20.balanceOf(signers.bob);
  // //   const balanceBob = await hre.fhevm.decrypt64(balanceHandleBob);
  // //   expect(balanceBob).to.equal(0n);
  // // });

  // // it("Test5: should be able to transferFrom only if allowance is sufficient", async function () {
  // //   const transaction = await erc20.mint(10000);
  // //   await transaction.wait();

  // //   const inputAlice = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
  // //   inputAlice.add64(1337);
  // //   const encryptedAllowanceAmount = inputAlice.encrypt();
  // //   const tx = await erc20["approve(address,bytes32,bytes)"](
  // //     signers.bob.address,
  // //     encryptedAllowanceAmount.handles[0],
  // //     encryptedAllowanceAmount.inputProof,
  // //   );
  // //   await tx.wait();

  // //   const bobErc20 = erc20.connect(signers.bob);
  // //   const inputBob1 = instances.bob.createEncryptedInput(contractAddress, signers.bob.address);
  // //   inputBob1.add64(1338); // above allowance so next tx should actually not send any token
  // //   const encryptedTransferAmount = inputBob1.encrypt();

  // //   /* eslint-disable @typescript-eslint/ban-ts-comment */
  // //   //@ts-ignore
  // //   const tx2 = await bobErc20["transferFrom(address,address,bytes32,bytes)"](
  // //     signers.alice.address,
  // //     signers.bob.address,
  // //     encryptedTransferAmount.handles[0],
  // //     encryptedTransferAmount.inputProof,
  // //   );
  // //   await tx2.wait();

  // //   // Decrypt Alice's balance
  // //   const balanceHandleAlice = await erc20.balanceOf(signers.alice);
  // //   const balanceAlice = await hre.fhevm.decrypt64(balanceHandleAlice);
  // //   expect(balanceAlice).to.equal(10000n); // check that transfer did not happen, as expected

  // //   // Decrypt Bob's balance
  // //   const balanceHandleBob = await erc20.balanceOf(signers.bob);
  // //   const balanceBob = await hre.fhevm.decrypt64(balanceHandleBob);
  // //   expect(balanceBob).to.equal(0n); // check that transfer did not happen, as expected

  // //   const inputBob2 = instances.bob.createEncryptedInput(contractAddress, signers.bob.address);
  // //   inputBob2.add64(1337); // below allowance so next tx should send token
  // //   const encryptedTransferAmount2 = inputBob2.encrypt();

  // //   /* eslint-disable @typescript-eslint/ban-ts-comment */
  // //   //@ts-ignore
  // //   const tx3 = await bobErc20["transferFrom(address,address,bytes32,bytes)"](
  // //     signers.alice.address,
  // //     signers.bob.address,
  // //     encryptedTransferAmount2.handles[0],
  // //     encryptedTransferAmount2.inputProof,
  // //   );
  // //   await tx3.wait();

  // //   // Decrypt Alice's balance
  // //   const balanceHandleAlice2 = await erc20.balanceOf(signers.alice);
  // //   const balanceAlice2 = await hre.fhevm.decrypt64(balanceHandleAlice2);
  // //   expect(balanceAlice2).to.equal(BigInt(10000 - 1337)); // check that transfer did happen this time

  // //   // Decrypt Bob's balance
  // //   const balanceHandleBob2 = await erc20.balanceOf(signers.bob);
  // //   const balanceBob2 = await hre.fhevm.decrypt64(balanceHandleBob2);
  // //   expect(balanceBob2).to.equal(1337n); // check that transfer did happen this time
  // // });
});

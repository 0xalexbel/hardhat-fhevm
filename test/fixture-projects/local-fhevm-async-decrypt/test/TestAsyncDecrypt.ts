import { expect } from "chai";
import hre from "hardhat";
import { HardhatFhevmInstances, Signers, createInstances, getSigners, initSigners } from "./test_utils";
import { ethers } from "ethers";

describe("TestAsyncDecrypt", function () {
  let signers: Signers;
  let relayerAddress: string;
  //let contract: TestAsyncDecrypt;
  let contract: ethers.Contract;
  let contractAddress: string;
  let instances: HardhatFhevmInstances;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let snapshotId: any;

  before(async function () {
    await initSigners();
    signers = getSigners();
    relayerAddress = hre.fhevm.gatewayRelayerWallet().address;

    // very first request of decryption always fail at the moment due to a gateway bug
    // TODO: remove following 8 lines when the gateway bug will be fixed
    const contractFactory = await hre.ethers.getContractFactory("TestAsyncDecrypt");
    contract = await contractFactory.connect(signers.alice).deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
    instances = await createInstances(signers);
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx = await contract.connect(signers.carol).requestUint8({ gasLimit: 5_000_000 });
    await tx.wait(); // this first request is here just to silence the current gateway bug at the moment
    await hre.fhevm.waitNBlocks(1);
  });

  beforeEach(async function () {
    const contractFactory = await hre.ethers.getContractFactory("TestAsyncDecrypt");
    contract = await contractFactory.connect(signers.alice).deploy();
    await contract.waitForDeployment();
    contractAddress = await contract.getAddress();
    instances = await createInstances(signers);
  });

  it("Test1: test async decrypt bool", async function () {
    const balanceBeforeR = await hre.ethers.provider.getBalance(relayerAddress);
    const balanceBeforeU = await hre.ethers.provider.getBalance(signers.carol.address);
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx2 = await contract.connect(signers.carol).requestBool({ gasLimit: 5_000_000 });
    await tx2.wait();
    const balanceAfterU = await hre.ethers.provider.getBalance(signers.carol.address);
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yBool();
    expect(y).to.equal(true);
    const balanceAfterR = await hre.ethers.provider.getBalance(relayerAddress);
    console.log("gas paid by relayer (fulfil tx) : ", balanceBeforeR - balanceAfterR);
    console.log("gas paid by user (request tx) : ", balanceBeforeU - balanceAfterU);
  });

  it("Test2: test async decrypt uint4", async function () {
    const balanceBefore = await hre.ethers.provider.getBalance(relayerAddress);
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx2 = await contract.connect(signers.carol).requestUint4({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint4();
    expect(y).to.equal(4n);
    const balanceAfter = await hre.ethers.provider.getBalance(relayerAddress);
    console.log(balanceBefore - balanceAfter);
  });

  it("Test3: test async decrypt uint8", async function () {
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx2 = await contract.connect(signers.carol).requestUint8({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint8();
    expect(y).to.equal(42n);
  });

  it("Test4: test async decrypt uint16", async function () {
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx2 = await contract.connect(signers.carol).requestUint16({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint16();
    expect(y).to.equal(16n);
  });

  it("Test5: test async decrypt uint32", async function () {
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx2 = await contract.connect(signers.carol).requestUint32(5, 15, { gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint32();
    expect(y).to.equal(52n); // 5+15+32
  });

  it("Test6: test async decrypt uint64", async function () {
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx2 = await contract.connect(signers.carol).requestUint64({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint64();
    expect(y).to.equal(18446744073709551600n);
  });

  it("Test7: test async decrypt address", async function () {
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx2 = await contract.connect(signers.carol).requestAddress({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yAddress();
    expect(y).to.equal("0x8ba1f109551bD432803012645Ac136ddd64DBA72");
  });

  it("Test8: test async decrypt several addresses", async function () {
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx2 = await contract.connect(signers.carol).requestSeveralAddresses({ gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yAddress();
    const y2 = await contract.yAddress2();
    expect(y).to.equal("0x8ba1f109551bD432803012645Ac136ddd64DBA72");
    expect(y2).to.equal("0xf48b8840387ba3809DAE990c930F3b4766A86ca3");
  });

  it("Test9: test async decrypt mixed", async function () {
    const contractFactory = await hre.ethers.getContractFactory("TestAsyncDecrypt");
    const contract2 = await contractFactory.connect(signers.alice).deploy();
    /* eslint-disable @typescript-eslint/ban-ts-comment */
    //@ts-ignore
    const tx2 = await contract2.connect(signers.carol).requestMixed(5, 15, { gasLimit: 5_000_000 });
    await tx2.wait();
    await hre.fhevm.waitForAllDecryptions();
    const yB = await contract2.yBool();
    expect(yB).to.equal(true);
    let y = await contract2.yUint4();
    expect(y).to.equal(4n);
    y = await contract2.yUint8();
    expect(y).to.equal(42n);
    y = await contract2.yUint16();
    expect(y).to.equal(16n);
    const yAdd = await contract2.yAddress();
    expect(yAdd).to.equal("0x8ba1f109551bD432803012645Ac136ddd64DBA72");
    y = await contract2.yUint32();
    expect(y).to.equal(52n); // 5+15+32
    y = await contract2.yUint64();
    expect(y).to.equal(18446744073709551600n);
  });

  it("Test10: test async decrypt uint64 non-trivial", async function () {
    const inputAlice = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
    inputAlice.add64(18446744073709550042n);
    const encryptedAmount = inputAlice.encrypt();
    const tx = await contract.requestUint64NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof, {
      gasLimit: 5_000_000,
    });
    await tx.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yUint64();
    expect(y).to.equal(18446744073709550042n);
  });

  it("Test11: test async decrypt ebytes256 non-trivial", async function () {
    const inputAlice = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
    inputAlice.addBytes256(18446744073709550022n);
    const encryptedAmount = inputAlice.encrypt();
    const tx = await contract.requestEbytes256NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof, {
      gasLimit: 5_000_000,
    });
    await tx.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yBytes256();
    expect(y).to.equal(hre.ethers.toBeHex(18446744073709550022n, 256));
  });

  it("Test12: test async decrypt ebytes256 non-trivial with snapshot [skip-on-coverage]", async function () {
    if (hre.network.name === "hardhat") {
      snapshotId = await hre.ethers.provider.send("evm_snapshot");
      const inputAlice = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
      inputAlice.addBytes256(18446744073709550022n);
      const encryptedAmount = inputAlice.encrypt();
      const tx = await contract.requestEbytes256NonTrivial(encryptedAmount.handles[0], encryptedAmount.inputProof, {
        gasLimit: 5_000_000,
      });
      await tx.wait();
      await hre.fhevm.waitForAllDecryptions();
      const y = await contract.yBytes256();
      expect(y).to.equal(hre.ethers.toBeHex(18446744073709550022n, 256));

      await hre.ethers.provider.send("evm_revert", [snapshotId]);
      const inputAlice2 = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
      inputAlice2.addBytes256(424242n);
      const encryptedAmount2 = inputAlice2.encrypt();
      const tx2 = await contract.requestEbytes256NonTrivial(encryptedAmount2.handles[0], encryptedAmount2.inputProof, {
        gasLimit: 5_000_000,
      });
      await tx2.wait();
      await hre.fhevm.waitForAllDecryptions();
      const y2 = await contract.yBytes256();
      expect(y2).to.equal(hre.ethers.toBeHex(424242n, 256));
    }
  });

  it("Test13: test async decrypt mixed with ebytes256", async function () {
    const inputAlice = instances.alice.createEncryptedInput(contractAddress, signers.alice.address);
    inputAlice.addBytes256(18446744073709550032n);
    const encryptedAmount = inputAlice.encrypt();
    const tx = await contract.requestMixedBytes256(encryptedAmount.handles[0], encryptedAmount.inputProof, {
      gasLimit: 5_000_000,
    });
    await tx.wait();
    await hre.fhevm.waitForAllDecryptions();
    const y = await contract.yBytes256();
    expect(y).to.equal(hre.ethers.toBeHex(18446744073709550032n, 256));
    const yb = await contract.yBool();
    expect(yb).to.equal(true);
    const yAdd = await contract.yAddress();
    expect(yAdd).to.equal("0x8ba1f109551bD432803012645Ac136ddd64DBA72");
  });
});

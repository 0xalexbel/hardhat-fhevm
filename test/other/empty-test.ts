import { expect } from "chai";

/**
 * This is an empty test. Used for dev+debugging only
 */

// npx hardhat test ./test/test.ts
describe("Empty Test For Debug Purpose", function () {
  before(async function () {});

  beforeEach(async function () {});

  it("should be true", async function () {
    const a = 1;
    expect(a).is.eq(1);
  });
});

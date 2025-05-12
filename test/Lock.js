const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");

describe("Lock Contract", () => {
  async function deployLockContractFixture() {
    const ONE_YEAR = 365 * 24 * 60 * 60;
    const ONE_GWEI = 1_000_000_000;
    const unlockTime = (await time.latest()) + ONE_YEAR;
    const lockedAmount = ONE_GWEI;

    const [owner, otherUser] = await ethers.getSigners();
    const LockFactory = await ethers.getContractFactory("Lock");
    const lock = await LockFactory.deploy(unlockTime, { value: lockedAmount });

    return { lock, unlockTime, lockedAmount, owner, otherUser };
  }

  describe("Deployment", () => {
    it("sets the correct unlock time", async () => {
      const { lock, unlockTime } = await loadFixture(deployLockContractFixture);
      expect(await lock.unlockTime()).to.equal(unlockTime);
    });

    it("assigns the deployer as owner", async () => {
      const { lock, owner } = await loadFixture(deployLockContractFixture);
      expect(await lock.owner()).to.equal(owner.address);
    });

    it("receives and locks the funds", async () => {
      const { lock, lockedAmount } = await loadFixture(deployLockContractFixture);
      const contractBalance = await ethers.provider.getBalance(lock.target);
      expect(contractBalance).to.equal(lockedAmount);
    });

    it("reverts if unlock time is not in the future", async () => {
      const currentTime = await time.latest();
      const LockFactory = await ethers.getContractFactory("Lock");
      await expect(LockFactory.deploy(currentTime, { value: 1 }))
        .to.be.revertedWith("Unlock time should be in the future");
    });
  });

  describe("Withdrawals", () => {
    describe("Validation Checks", () => {
      it("reverts if withdrawn too early", async () => {
        const { lock } = await loadFixture(deployLockContractFixture);
        await expect(lock.withdraw()).to.be.revertedWith("You can't withdraw yet");
      });

      it("reverts if non-owner tries to withdraw", async () => {
        const { lock, unlockTime, otherUser } = await loadFixture(deployLockContractFixture);
        await time.increaseTo(unlockTime);
        await expect(lock.connect(otherUser).withdraw()).to.be.revertedWith("You aren't the owner");
      });

      it("allows owner to withdraw after unlock time", async () => {
        const { lock, unlockTime } = await loadFixture(deployLockContractFixture);
        await time.increaseTo(unlockTime);
        await expect(lock.withdraw()).not.to.be.reverted;
      });
    });

    describe("Events", () => {
      it("emits a Withdrawal event", async () => {
        const { lock, unlockTime, lockedAmount } = await loadFixture(deployLockContractFixture);
        await time.increaseTo(unlockTime);
        await expect(lock.withdraw())
          .to.emit(lock, "Withdrawal")
          .withArgs(lockedAmount, anyValue);
      });
    });

    describe("Funds Transfer", () => {
      it("transfers locked funds to owner", async () => {
        const { lock, unlockTime, lockedAmount, owner } = await loadFixture(deployLockContractFixture);
        await time.increaseTo(unlockTime);
        await expect(lock.withdraw()).to.changeEtherBalances(
          [owner, lock],
          [lockedAmount, -lockedAmount]
        );
      });
    });
  });
});

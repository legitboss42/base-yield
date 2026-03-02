import { expect } from "chai";
import { ethers } from "hardhat";

describe("BaseYieldVault", function () {
  async function deployFixture() {
    const [owner, user] = await ethers.getSigners();

    const usdcFactory = await ethers.getContractFactory("MockERC20");
    const usdc = await usdcFactory.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();

    const aTokenFactory = await ethers.getContractFactory("MockAToken");
    const aToken = await aTokenFactory.deploy();
    await aToken.waitForDeployment();

    const poolFactory = await ethers.getContractFactory("MockAavePool");
    const pool = await poolFactory.deploy(await usdc.getAddress(), await aToken.getAddress());
    await pool.waitForDeployment();

    await aToken.setPool(await pool.getAddress());

    const vaultFactory = await ethers.getContractFactory("BaseYieldVault");
    const vault = await vaultFactory.deploy(
      await usdc.getAddress(),
      await pool.getAddress(),
      await aToken.getAddress(),
      "BaseYield USDC Vault",
      "byvUSDC"
    );
    await vault.waitForDeployment();

    await usdc.mint(user.address, ethers.parseUnits("1000", 6));
    await usdc.connect(user).approve(await vault.getAddress(), ethers.MaxUint256);

    return { owner, user, usdc, aToken, pool, vault };
  }

  it("supplies to Aave on deposit", async function () {
    const { user, usdc, aToken, vault } = await deployFixture();

    const depositAmount = ethers.parseUnits("100", 6);
    await expect(vault.connect(user).deposit(depositAmount, user.address))
      .to.emit(vault, "SuppliedToAave")
      .withArgs(depositAmount);

    expect(await vault.balanceOf(user.address)).to.equal(depositAmount);
    expect(await aToken.balanceOf(await vault.getAddress())).to.equal(depositAmount);
    expect(await usdc.balanceOf(await vault.getAddress())).to.equal(0n);
    expect(await vault.totalAssets()).to.equal(depositAmount);
  });

  it("withdraws from Aave on redeem/withdraw", async function () {
    const { user, usdc, aToken, vault } = await deployFixture();
    const depositAmount = ethers.parseUnits("100", 6);
    const withdrawAmount = ethers.parseUnits("40", 6);

    await vault.connect(user).deposit(depositAmount, user.address);

    await expect(vault.connect(user).withdraw(withdrawAmount, user.address, user.address))
      .to.emit(vault, "WithdrawnFromAave")
      .withArgs(withdrawAmount);

    expect(await aToken.balanceOf(await vault.getAddress())).to.equal(
      depositAmount - withdrawAmount
    );
    expect(await usdc.balanceOf(user.address)).to.equal(
      ethers.parseUnits("1000", 6) - depositAmount + withdrawAmount
    );
  });

  it("totalAssets includes idle USDC and aToken balance", async function () {
    const { user, usdc, vault } = await deployFixture();
    const depositAmount = ethers.parseUnits("100", 6);
    const idleTopUp = ethers.parseUnits("7.5", 6);

    await vault.connect(user).deposit(depositAmount, user.address);
    await usdc.mint(await vault.getAddress(), idleTopUp);

    expect(await vault.totalAssets()).to.equal(depositAmount + idleTopUp);
  });

  it("enforces pause controls", async function () {
    const { owner, user, vault } = await deployFixture();
    const amount = ethers.parseUnits("1", 6);

    await vault.connect(owner).setDepositsPaused(true);
    await expect(vault.connect(user).deposit(amount, user.address)).to.be.revertedWith(
      "deposits paused"
    );

    await vault.connect(owner).setDepositsPaused(false);
    await vault.connect(user).deposit(amount, user.address);

    await vault.connect(owner).setWithdrawsPaused(true);
    await expect(
      vault.connect(user).withdraw(amount, user.address, user.address)
    ).to.be.revertedWith("withdraws paused");
  });

  it("blocks rescuing USDC unless explicitly enabled", async function () {
    const { owner, usdc, vault } = await deployFixture();
    const oneUsdc = ethers.parseUnits("1", 6);

    await usdc.mint(await vault.getAddress(), oneUsdc);
    await expect(
      vault.connect(owner).rescueToken(await usdc.getAddress(), owner.address, oneUsdc)
    ).to.be.revertedWith("asset rescue disabled");

    await vault.connect(owner).setAllowAssetRescue(true);
    await vault.connect(owner).rescueToken(await usdc.getAddress(), owner.address, oneUsdc);

    expect(await usdc.balanceOf(owner.address)).to.equal(oneUsdc);
  });
});

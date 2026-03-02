// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IAavePool} from "./interfaces/IAavePool.sol";

contract BaseYieldVault is ERC4626, Ownable2Step, ReentrancyGuard {
  using SafeERC20 for IERC20;

  event SuppliedToAave(uint256 amount);
  event WithdrawnFromAave(uint256 amount);
  event DepositsPauseUpdated(bool paused);
  event WithdrawsPauseUpdated(bool paused);
  event AssetRescueToggleUpdated(bool allowAssetRescue);
  event FeesEnabledUpdated(bool enabled);
  event FeeConfigUpdated(uint16 managementFeeBps, uint16 performanceFeeBps);

  uint16 public constant MAX_FEE_BPS = 2000;

  IAavePool public immutable aavePool;
  IERC20 public immutable aToken;

  bool public depositsPaused;
  bool public withdrawsPaused;
  bool public allowAssetRescue;

  // Reserved for v2 fee implementation. Fees are not charged in this MVP.
  bool public feesEnabled;
  uint16 public managementFeeBps;
  uint16 public performanceFeeBps;

  constructor(
    address asset_,
    address aavePool_,
    address aToken_,
    string memory name_,
    string memory symbol_
  ) ERC20(name_, symbol_) ERC4626(IERC20(asset_)) Ownable(msg.sender) {
    require(asset_ != address(0), "asset=0");
    require(aavePool_ != address(0), "pool=0");
    require(aToken_ != address(0), "aToken=0");

    aavePool = IAavePool(aavePool_);
    aToken = IERC20(aToken_);

    // Approval set once in constructor to reduce recurring allowance updates.
    IERC20(asset_).forceApprove(aavePool_, type(uint256).max);
  }

  function decimals() public view override(ERC4626) returns (uint8) {
    return ERC4626.decimals();
  }

  function totalAssets() public view override returns (uint256) {
    return IERC20(asset()).balanceOf(address(this)) + aToken.balanceOf(address(this));
  }

  function maxDeposit(address receiver) public view override returns (uint256) {
    if (depositsPaused) return 0;
    return super.maxDeposit(receiver);
  }

  function maxMint(address receiver) public view override returns (uint256) {
    if (depositsPaused) return 0;
    return super.maxMint(receiver);
  }

  function maxWithdraw(address owner) public view override returns (uint256) {
    if (withdrawsPaused) return 0;
    return super.maxWithdraw(owner);
  }

  function maxRedeem(address owner) public view override returns (uint256) {
    if (withdrawsPaused) return 0;
    return super.maxRedeem(owner);
  }

  function deposit(
    uint256 assets,
    address receiver
  ) public override nonReentrant returns (uint256) {
    require(!depositsPaused, "deposits paused");
    return super.deposit(assets, receiver);
  }

  function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256) {
    require(!depositsPaused, "deposits paused");
    return super.mint(shares, receiver);
  }

  function withdraw(
    uint256 assets,
    address receiver,
    address owner
  ) public override nonReentrant returns (uint256) {
    require(!withdrawsPaused, "withdraws paused");
    return super.withdraw(assets, receiver, owner);
  }

  function redeem(
    uint256 shares,
    address receiver,
    address owner
  ) public override nonReentrant returns (uint256) {
    require(!withdrawsPaused, "withdraws paused");
    return super.redeem(shares, receiver, owner);
  }

  function setDepositsPaused(bool paused) external onlyOwner {
    depositsPaused = paused;
    emit DepositsPauseUpdated(paused);
  }

  function setWithdrawsPaused(bool paused) external onlyOwner {
    withdrawsPaused = paused;
    emit WithdrawsPauseUpdated(paused);
  }

  function setAllowAssetRescue(bool allowRescue) external onlyOwner {
    allowAssetRescue = allowRescue;
    emit AssetRescueToggleUpdated(allowRescue);
  }

  function setFeesEnabled(bool enabled) external onlyOwner {
    feesEnabled = enabled;
    emit FeesEnabledUpdated(enabled);
  }

  function setFeeConfig(uint16 managementFeeBps_, uint16 performanceFeeBps_) external onlyOwner {
    require(managementFeeBps_ <= MAX_FEE_BPS, "management fee too high");
    require(performanceFeeBps_ <= MAX_FEE_BPS, "performance fee too high");
    managementFeeBps = managementFeeBps_;
    performanceFeeBps = performanceFeeBps_;
    emit FeeConfigUpdated(managementFeeBps_, performanceFeeBps_);
  }

  function rescueToken(address token, address to, uint256 amount) external onlyOwner {
    require(to != address(0), "to=0");
    require(token != asset() || allowAssetRescue, "asset rescue disabled");
    IERC20(token).safeTransfer(to, amount);
  }

  function _deposit(
    address caller,
    address receiver,
    uint256 assets,
    uint256 shares
  ) internal override {
    super._deposit(caller, receiver, assets, shares);
    _supplyToAave(assets);
  }

  function _withdraw(
    address caller,
    address receiver,
    address owner,
    uint256 assets,
    uint256 shares
  ) internal override {
    _ensureLiquidity(assets);
    super._withdraw(caller, receiver, owner, assets, shares);
  }

  function _supplyToAave(uint256 amount) internal {
    if (amount == 0) return;
    aavePool.supply(asset(), amount, address(this), 0);
    emit SuppliedToAave(amount);
  }

  function _ensureLiquidity(uint256 assets) internal {
    uint256 idleBalance = IERC20(asset()).balanceOf(address(this));
    if (idleBalance >= assets) return;

    uint256 shortfall = assets - idleBalance;
    uint256 withdrawn = aavePool.withdraw(asset(), shortfall, address(this));
    require(withdrawn >= shortfall, "insufficient Aave liquidity");
    emit WithdrawnFromAave(withdrawn);
  }
}

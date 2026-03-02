// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MockAToken} from "./MockAToken.sol";

contract MockAavePool {
  using SafeERC20 for IERC20;

  IERC20 public immutable usdc;
  MockAToken public immutable aToken;

  constructor(address usdc_, address aToken_) {
    usdc = IERC20(usdc_);
    aToken = MockAToken(aToken_);
  }

  function supply(address asset, uint256 amount, address onBehalfOf, uint16) external {
    require(asset == address(usdc), "unsupported asset");
    usdc.safeTransferFrom(msg.sender, address(this), amount);
    aToken.mint(onBehalfOf, amount);
  }

  function withdraw(address asset, uint256 amount, address to) external returns (uint256) {
    require(asset == address(usdc), "unsupported asset");
    aToken.burn(msg.sender, amount);
    usdc.safeTransfer(to, amount);
    return amount;
  }

  function getReserveData(
    address asset
  )
    external
    view
    returns (
      uint256,
      uint128,
      uint128,
      uint128,
      uint128,
      uint128,
      uint40,
      uint16,
      address,
      address,
      address,
      address,
      address
    )
  {
    require(asset == address(usdc), "unsupported asset");
    return (0, 0, 0, 0, 0, 0, 0, 0, address(aToken), address(0), address(0), address(0), address(0));
  }
}

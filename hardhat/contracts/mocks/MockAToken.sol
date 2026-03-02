// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAToken is ERC20 {
  address public pool;

  constructor() ERC20("Mock Aave USDC", "maUSDC") {}

  modifier onlyPool() {
    require(msg.sender == pool, "not pool");
    _;
  }

  function decimals() public pure override returns (uint8) {
    return 6;
  }

  function setPool(address pool_) external {
    require(pool == address(0), "pool already set");
    pool = pool_;
  }

  function mint(address to, uint256 amount) external onlyPool {
    _mint(to, amount);
  }

  function burn(address from, uint256 amount) external onlyPool {
    _burn(from, amount);
  }
}

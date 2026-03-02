import { parseAbi, parseAbiItem } from "viem";

export const usdcAbi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)"
]);

export const vaultAbi = parseAbi([
  "function deposit(uint256 assets, address receiver) external returns (uint256 shares)",
  "function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares)",
  "function convertToAssets(uint256 shares) external view returns (uint256 assets)",
  "function balanceOf(address account) external view returns (uint256 shares)",
  "function totalAssets() external view returns (uint256)"
]);

export const depositEventAbi = parseAbiItem(
  "event Deposit(address indexed caller, address indexed owner, uint256 assets, uint256 shares)"
);

export const withdrawEventAbi = parseAbiItem(
  "event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)"
);

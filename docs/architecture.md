# BaseYield Architecture

## High-level Components
- `hardhat/contracts/BaseYieldVault.sol`
  - ERC-4626 vault over USDC
  - supplies deposits to Aave V3 Pool
  - withdraws from Aave on redemptions
  - owner emergency controls (pause deposits/withdraws, rescue token guardrails)
- `hardhat/scripts/*.ts`
  - resolve canonical Aave addresses by chain and query `Pool.getReserveData(USDC)`
  - deploy vault from resolved addresses
  - smoke-check deployed vault metadata/state
- `web/` Next.js dashboard
  - wallet connect (wagmi + RainbowKit)
  - approve/deposit/withdraw
  - activity indexer from logs
  - points + referral UI
- `web/app/api/points/route.ts`
  - lightweight JSON-backed points engine
  - computes points from indexed deposit/withdraw events

## Asset Flow (Text Diagram)
1. User approves USDC to `BaseYieldVault`.
2. User calls `deposit(assets, receiver)` on vault.
3. Vault mints ERC-4626 shares and calls `AavePool.supply(USDC, assets, vault, 0)`.
4. Vault holds aUSDC as principal + yield position.
5. User calls `withdraw(assets, receiver, owner)`.
6. Vault calls `AavePool.withdraw(USDC, needed, vault)` as required.
7. Vault transfers USDC back to user and burns shares.

## Accounting
- `totalAssets()` = `idle USDC balance` + `aToken balance`.
- USDC and shares are both 6 decimals.
- Fee config variables exist but are off by default.

## Events and Metrics
- Onchain:
  - ERC-4626 `Deposit`
  - ERC-4626 `Withdraw`
  - `SuppliedToAave(uint256 amount)`
  - `WithdrawnFromAave(uint256 amount)`
- Frontend-derived metrics:
  - deposit count
  - withdrawal count
  - unique depositors (from `Deposit.owner`)
  - TVL (`totalAssets`)

## Offchain Points
- Formula: `points = deposit_amount_usdc * time_held_hours`.
- Engine consumes replayed deposit/withdraw events.
- Uses FIFO lot accounting per wallet.
- Data persisted to `web/data/points-store.json`.
- Points are not tokens and have no onchain minting.

## Network Address Resolution
- Mainnet and Sepolia Aave pool addresses are sourced from `@bgd-labs/aave-address-book`.
- USDC reserve `aToken` is resolved dynamically via `Pool.getReserveData`.
- Resolver output is saved to `hardhat/addresses/addresses.<chainId>.json`.

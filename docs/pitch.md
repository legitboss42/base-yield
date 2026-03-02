# BaseYield Pitch

## Problem
Retail users on Base want stablecoin yield, but most options are fragmented or overly technical. Users often have to:
- bridge, swap, and pick protocols manually
- manage approvals and pool selection themselves
- understand risk tradeoffs across many vault strategies

## Solution
BaseYield is a focused USDC vault on Base:
- single-asset strategy (USDC)
- ERC-4626 interface for familiar integrations
- automated supply to Aave V3
- anytime withdrawals

This keeps UX simple while using battle-tested DeFi primitives.

## Why Base
- low transaction costs and fast settlement for frequent retail interactions
- strong wallet distribution (Coinbase Wallet, MetaMask, RainbowKit support)
- ideal chain for consumer-facing finance products

## MVP Scope
- deployable contracts for Base Sepolia and Base Mainnet
- wallet-connected dashboard with approve/deposit/withdraw flow
- activity analytics from onchain logs (deposits, withdrawals, unique depositors, TVL)
- offchain points leaderboard + referral support for growth loops

## Traction Signals
BaseYield intentionally captures measurable usage signals:
- rich onchain vault events (ERC-4626 + Aave supply/withdraw events)
- referral-aware front-end sessions (`?ref=0x...`)
- event-synced points leaderboard keyed by wallet addresses

## Roadmap
1. MVP launch on Base Sepolia, then Mainnet.
2. Add risk/health monitoring and circuit-breaker policies.
3. Add optional fee switch activation after governance setup.
4. Add additional curated strategies only after proving PMF with USDC-only flow.

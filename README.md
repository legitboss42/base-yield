# BaseYield MVP

Retail-friendly USDC vault on Base using ERC-4626 + Aave V3.

- Vault contract: `hardhat/contracts/BaseYieldVault.sol`
- Deploy scripts: `hardhat/scripts/resolveAave.ts`, `deploy.ts`, `smoke.ts`
- Frontend: Next.js App Router in `web/`
- Docs: `docs/pitch.md`, `docs/architecture.md`

## Repo Structure
```text
/
  hardhat/
    contracts/
    scripts/
    test/
    hardhat.config.ts
    .env.example
  web/
  docs/
  README.md
```

## Prerequisites
- Windows + PowerShell
- Node.js installed
- Wallet (MetaMask or Coinbase Wallet)
- Base RPCs and funded deployer private key

## Important Network Note
Circle USDC addresses are configured as the preferred tokens:
- Base mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

`resolveAave.ts` queries `Pool.getReserveData` and writes the usable reserve token/aToken for the target chain.  
If a preferred USDC is not an active Aave reserve on that test network, resolver falls back to the Aave-listed USDC underlying and records that in the output JSON.
It also writes `supportedUsdc` so the web app can show balances for alternate USDC variants.

## Security Notes (MVP)
- ReentrancyGuard enabled
- aToken address validated against Aave reserve
- Strict liquidity check on withdraw
- Fees disabled by default
- Rescue disabled for USDC unless explicitly toggled

## Stage 1: Install Dependencies
From repo root:

```powershell
Set-Location "C:\Users\vicky\Desktop\Web Growth\Base Yield"

Set-Location .\hardhat
npm install

Set-Location ..\web
npm install

Set-Location ..
```

## Stage 2: Configure Environment

### Hardhat env
```powershell
Set-Location .\hardhat
Copy-Item .env.example .env
notepad .env
```

Set:
- `PRIVATE_KEY=0x...`
- `BASE_SEPOLIA_RPC_URL=...`
- `BASE_MAINNET_RPC_URL=...`

### Frontend env
```powershell
Set-Location ..\web
Copy-Item .env.example .env.local
notepad .env.local
Set-Location ..
```

## Stage 3: Contracts - Compile and Test
```powershell
Set-Location .\hardhat
npm run build
npm test
Set-Location ..
```

## Stage 4: Base Sepolia Deployment (Demo)
```powershell
Set-Location .\hardhat

# Resolve USDC + Aave Pool + aToken
npx hardhat run scripts/resolveAave.ts --network baseSepolia

# Deploy vault
npx hardhat run scripts/deploy.ts --network baseSepolia

# Smoke check
npx hardhat run scripts/smoke.ts --network baseSepolia

# Inspect output files
Get-Content .\addresses\addresses.84532.json
Get-Content .\addresses\deployments.84532.json
Get-Content .\addresses\vault.84532.json

Set-Location ..
```

## Get vault address (Base Sepolia)
Get everything (resolve + deploy + print) in one flow:

```powershell
Set-Location "C:\Users\vicky\Desktop\Web Growth\Base Yield\hardhat"
npm install
Copy-Item .env.example .env
notepad .env
npm run deploy:all:sepolia
```

Equivalent command style:

```powershell
cd hardhat
npm install
cp .env.example .env
npm run deploy:all:sepolia
```

This prints:
1. resolves Aave addresses
2. deploys the vault
3. prints chainId, network, vault address, deployment block
4. prints a ready-to-copy `web/.env.local` block
5. writes:
   - `hardhat/addresses/vault.<chainId>.json`
   - `hardhat/addresses/deployments.<chainId>.json`

If deploy fails, check these likely causes:
- `Set PRIVATE_KEY in hardhat/.env`
- `Set BASE_SEPOLIA_RPC_URL or BASE_MAINNET_RPC_URL`
- `Fund wallet with Base Sepolia ETH (testnet) for gas`
- run resolve first so `hardhat/addresses/addresses.<chainId>.json` exists

After `deploy:all:sepolia`, copy the printed block into `web/.env.local` and restart web:

```powershell
Set-Location "C:\Users\vicky\Desktop\Web Growth\Base Yield\web"
notepad .env.local
npm run dev
```

## Stage 5: Configure Frontend for Sepolia
1. Copy values from `hardhat/addresses/deployments.84532.json`.
2. Update `web/.env.local`:
   - `NEXT_PUBLIC_CHAIN_ID=84532`
   - `NEXT_PUBLIC_VAULT_ADDRESS=<deployed vault>`
   - `NEXT_PUBLIC_USDC_ADDRESS=<resolved usdc>`
   - `NEXT_PUBLIC_USDC_ALTERNATES=<comma-separated alternate USDC tokens from print:vault output>`
   - `NEXT_PUBLIC_EXPLORER_BASE_URL=https://sepolia.basescan.org`
   - `NEXT_PUBLIC_DEPLOYMENT_BLOCK=<deploymentBlock>`

Run app:
```powershell
Set-Location .\web
npm run dev
```

Open:
- Landing: `http://localhost:3000/`
- Dashboard: `http://localhost:3000/app`

## Stage 6: Mainnet Ready-to-Launch Flow
```powershell
Set-Location .\hardhat

npx hardhat run scripts/resolveAave.ts --network base
npx hardhat run scripts/deploy.ts --network base
npx hardhat run scripts/smoke.ts --network base

Get-Content .\addresses\deployments.8453.json
Get-Content .\addresses\vault.8453.json
Set-Location ..
```

Then update `web/.env.local` with mainnet values:
- `NEXT_PUBLIC_CHAIN_ID=8453`
- `NEXT_PUBLIC_EXPLORER_BASE_URL=https://basescan.org`
- plus mainnet vault/usdc/deployment block

## Sepolia Faucet Steps (Placeholders)
1. Fund Base Sepolia ETH  
   - `<BASE_SEPOLIA_ETH_FAUCET_LINK>`
2. Fund Base Sepolia USDC for testing  
   - `<BASE_SEPOLIA_USDC_FAUCET_LINK>`

## Demo Script
1. Connect wallet on `/app`.
2. Approve USDC.
3. Deposit USDC.
4. Confirm shares and estimated assets increase.
5. Withdraw part of position.
6. Show activity panel updates:
   - total deposits
   - total withdrawals
   - unique depositors
   - TVL
7. Show points and leaderboard.
8. Share referral URL: `/app?ref=0xYourWallet`.

## Scripts Summary
In `hardhat/`:
- `npm run build` compile contracts
- `npm test` run unit tests
- `npm run resolve:aave -- --network <baseSepolia|base>`
- `npm run resolve:aave:sepolia`
- `npm run resolve:aave:base`
- `npm run deploy:vault -- --network <baseSepolia|base>`
- `npm run deploy:vault:sepolia`
- `npm run deploy:vault:base`
- `npm run print:vault -- --network <baseSepolia|base>`
- `npm run print:vault:sepolia`
- `npm run print:vault:base`
- `npm run deploy:all:sepolia` (resolve + deploy + print)
- `npm run deploy:all:base` (resolve + deploy + print)
- `npm run deploy:all` (legacy baseSepolia alias)
- `npm run deploy -- --network <baseSepolia|base>` (legacy alias)
- `npm run smoke -- --network <baseSepolia|base>`

In `web/`:
- `npm run dev`
- `npm run lint`
- `npm run build`

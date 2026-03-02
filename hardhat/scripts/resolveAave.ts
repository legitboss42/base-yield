import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";
import { AaveV3Base, AaveV3BaseSepolia } from "@bgd-labs/aave-address-book";

const IPoolAbi =
  require("@aave/core-v3/artifacts/contracts/interfaces/IPool.sol/IPool.json").abi;

const USDC_BY_CHAIN: Record<number, string> = {
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
};

type NetworkResolution = {
  chainId: number;
  networkName: string;
  usdc: string;
  preferredUsdc: string;
  supportedUsdc: string[];
  aavePool: string;
  aToken: string;
  addressBookUnderlying: string;
  addressBookAToken: string;
  usedFallbackUnderlying: boolean;
  explorerBaseUrl: string;
  resolvedAt: string;
};

function getPoolAndAsset(chainId: number) {
  if (chainId === 8453) {
    return {
      pool: AaveV3Base.POOL,
      asset: AaveV3Base.ASSETS.USDC
    };
  }

  if (chainId === 84532) {
    return {
      pool: AaveV3BaseSepolia.POOL,
      asset: AaveV3BaseSepolia.ASSETS.USDC
    };
  }

  throw new Error(
    `Unsupported chainId ${chainId}. Use Base mainnet (8453) or Base Sepolia (84532).`
  );
}

async function main() {
  const currentNetwork = await ethers.provider.getNetwork();
  const chainId = Number(currentNetwork.chainId);
  const preferredUsdc = USDC_BY_CHAIN[chainId];

  if (!preferredUsdc) {
    throw new Error(`USDC is not configured for chainId ${chainId}`);
  }

  const { pool, asset } = getPoolAndAsset(chainId);
  const poolContract = new ethers.Contract(pool, IPoolAbi, ethers.provider);
  const preferredReserveData = await poolContract.getReserveData(preferredUsdc);
  let discoveredAToken = preferredReserveData.aTokenAddress as string;
  let usdc = preferredUsdc;
  let usedFallbackUnderlying = false;

  if (discoveredAToken === ethers.ZeroAddress) {
    const fallbackReserveData = await poolContract.getReserveData(asset.UNDERLYING);
    const fallbackAToken = fallbackReserveData.aTokenAddress as string;

    if (fallbackAToken === ethers.ZeroAddress) {
      throw new Error(
        `Pool.getReserveData has no USDC reserve on chain ${chainId} for preferred or fallback underlying`
      );
    }

    usdc = asset.UNDERLYING;
    discoveredAToken = fallbackAToken;
    usedFallbackUnderlying = true;
  }

  const supportedUsdc = Array.from(
    new Set([preferredUsdc, asset.UNDERLYING].map((address) => address.toLowerCase()))
  );

  const resolution: NetworkResolution = {
    chainId,
    networkName: network.name,
    usdc,
    preferredUsdc,
    supportedUsdc,
    aavePool: pool,
    aToken: discoveredAToken,
    addressBookUnderlying: asset.UNDERLYING,
    addressBookAToken: asset.A_TOKEN,
    usedFallbackUnderlying,
    explorerBaseUrl: chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org",
    resolvedAt: new Date().toISOString()
  };

  const outDir = path.join(__dirname, "..", "addresses");
  fs.mkdirSync(outDir, { recursive: true });

  const filePath = path.join(outDir, `addresses.${chainId}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(resolution, null, 2)}\n`, "utf8");

  console.log(`Resolved Aave addresses for chain ${chainId}`);
  console.log(`USDC selected for vault: ${resolution.usdc}`);
  console.log(`Preferred Circle USDC: ${resolution.preferredUsdc}`);
  console.log(`Supported USDC variants: ${resolution.supportedUsdc.join(", ")}`);
  console.log(`Aave Pool: ${resolution.aavePool}`);
  console.log(`USDC aToken (Pool.getReserveData): ${resolution.aToken}`);
  if (usedFallbackUnderlying) {
    console.log("Notice: preferred Circle USDC has no active Aave reserve on this network.");
    console.log("Using Aave USDC underlying from address-book fallback for live demo compatibility.");
  }
  console.log(`Saved: ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

type DeploymentRecord = {
  vaultAddress: string;
};

type VaultRecord = {
  vaultAddress: string;
};

type AddressResolution = {
  aavePool: string;
  aToken: string;
};

const VAULT_ABI = [
  "function asset() view returns (address)",
  "function aavePool() view returns (address)",
  "function aToken() view returns (address)",
  "function totalAssets() view returns (uint256)",
  "function symbol() view returns (string)",
  "function name() view returns (string)"
];

function readJsonOrNull<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

async function main() {
  const currentNetwork = await ethers.provider.getNetwork();
  const chainId = Number(currentNetwork.chainId);

  const deploymentPath = path.join(__dirname, "..", "addresses", `deployments.${chainId}.json`);
  const resolvedPath = path.join(__dirname, "..", "addresses", `addresses.${chainId}.json`);
  const vaultPath = path.join(__dirname, "..", "addresses", `vault.${chainId}.json`);

  const deployment = readJsonOrNull<DeploymentRecord>(deploymentPath);
  const vaultRecord = readJsonOrNull<VaultRecord>(vaultPath);
  const resolved = readJsonOrNull<AddressResolution>(resolvedPath);

  const vaultAddress =
    process.env.VAULT_ADDRESS || vaultRecord?.vaultAddress || deployment?.vaultAddress;

  if (!vaultAddress) {
    throw new Error(
      `Vault address not found. Set VAULT_ADDRESS or deploy first (${deploymentPath}).`
    );
  }

  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, ethers.provider);

  const [asset, pool, aToken, totalAssets, symbol, name] = await Promise.all([
    vault.asset(),
    vault.aavePool(),
    vault.aToken(),
    vault.totalAssets(),
    vault.symbol(),
    vault.name()
  ]);

  console.log("BaseYieldVault smoke check");
  console.log(`Vault: ${vaultAddress}`);
  console.log(`Name/Symbol: ${name} (${symbol})`);
  console.log(`Asset: ${asset}`);
  console.log(`Pool: ${pool}`);
  console.log(`aToken: ${aToken}`);
  console.log(`totalAssets: ${totalAssets.toString()}`);

  if (resolved) {
    console.log(`Resolved Pool match: ${resolved.aavePool.toLowerCase() === pool.toLowerCase()}`);
    console.log(`Resolved aToken match: ${resolved.aToken.toLowerCase() === aToken.toLowerCase()}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

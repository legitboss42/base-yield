import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

type VaultRecord = {
  chainId: number;
  network: string;
  vaultAddress: string | null;
  deploymentBlock: number | null;
  status: "success" | "failed";
  error?: string;
};

type AddressRecord = {
  usdc?: string;
  supportedUsdc?: string[];
};

type DeploymentRecord = {
  deploymentBlock?: number | null;
};

function readJsonOrNull<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

async function main() {
  const currentNetwork = await ethers.provider.getNetwork();
  const chainId = Number(currentNetwork.chainId);
  const networkName = network.name;

  const outDir = path.join(__dirname, "..", "addresses");
  const vaultPath = path.join(outDir, `vault.${chainId}.json`);
  const addressesPath = path.join(outDir, `addresses.${chainId}.json`);
  const deploymentPath = path.join(outDir, `deployments.${chainId}.json`);

  const vaultRecord = readJsonOrNull<VaultRecord>(vaultPath);
  const addressRecord = readJsonOrNull<AddressRecord>(addressesPath);
  const deploymentRecord = readJsonOrNull<DeploymentRecord>(deploymentPath);

  if (!vaultRecord) {
    throw new Error(`Missing ${vaultPath}. Run deploy script first.`);
  }

  const vaultAddress = vaultRecord.vaultAddress;
  const deploymentBlock = deploymentRecord?.deploymentBlock ?? 0;
  const usdc = addressRecord?.usdc ?? "";
  const supportedUsdc = (addressRecord?.supportedUsdc ?? []).filter(Boolean);
  const alternateUsdc = supportedUsdc.filter(
    (token) => token.toLowerCase() !== usdc.toLowerCase()
  );

  console.log("Vault address output");
  console.log("chainId:", chainId);
  console.log("network:", networkName);
  console.log("vaultAddress:", vaultAddress ?? "(not deployed)");
  console.log("deploymentBlock:", deploymentBlock);
  console.log("USDC:", usdc || "(unknown)");
  if (supportedUsdc.length > 0) {
    console.log("supportedUsdc:", supportedUsdc.join(", "));
  }
  console.log("vault file:", vaultPath);
  console.log("addresses file:", addressesPath);
  console.log("deployment file:", deploymentPath);

  if (!vaultAddress || vaultAddress === ethers.ZeroAddress || vaultRecord.status !== "success") {
    console.log("");
    console.log("Vault deployment status is not successful.");
    if (vaultRecord.error) {
      console.log("error:", vaultRecord.error);
    }
    throw new Error("Vault address is unavailable. Fix deployment and rerun.");
  }

  console.log("");
  console.log("Copy into web/.env.local:");
  console.log(`NEXT_PUBLIC_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`NEXT_PUBLIC_USDC_ADDRESS=${usdc}`);
  console.log(`NEXT_PUBLIC_USDC_ALTERNATES=${alternateUsdc.join(",")}`);
  console.log(`NEXT_PUBLIC_CHAIN_ID=${chainId}`);
  console.log(`NEXT_PUBLIC_DEPLOYMENT_BLOCK=${deploymentBlock}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

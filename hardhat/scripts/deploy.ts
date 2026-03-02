import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

const IPoolAbi =
  require("@aave/core-v3/artifacts/contracts/interfaces/IPool.sol/IPool.json").abi;

type AddressResolution = {
  chainId: number;
  usdc: string;
  aavePool: string;
  aToken: string;
};

type DeploymentRecord = {
  chainId: number;
  network: string;
  deployer: string | null;
  vaultAddress: string | null;
  usdc: string | null;
  aavePool: string | null;
  aToken: string | null;
  deploymentBlock: number | null;
  deployedAt: string;
  status: "success" | "failed";
  error?: string;
};

type VaultRecord = {
  chainId: number;
  network: string;
  vaultAddress: string | null;
  deploymentBlock: number | null;
  updatedAt: string;
  status: "success" | "failed";
  error?: string;
};

function loadResolvedAddresses(chainId: number): AddressResolution {
  const filePath = path.join(__dirname, "..", "addresses", `addresses.${chainId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${filePath}. Run the resolve script first (e.g. npm run resolve:aave:${network.name === "baseSepolia" ? "sepolia" : "base"}).`
    );
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as AddressResolution;

  if (!parsed.usdc || !parsed.aavePool || !parsed.aToken) {
    throw new Error(`Invalid address file: ${filePath}`);
  }

  if (
    parsed.usdc === ethers.ZeroAddress ||
    parsed.aavePool === ethers.ZeroAddress ||
    parsed.aToken === ethers.ZeroAddress
  ) {
    throw new Error(`Zero address detected in ${filePath}`);
  }

  return parsed;
}

async function main() {
  const currentNetwork = await ethers.provider.getNetwork();
  const chainId = Number(currentNetwork.chainId);
  const networkName = network.name;

  const outDir = path.join(__dirname, "..", "addresses");
  fs.mkdirSync(outDir, { recursive: true });

  let deployerAddress: string | null = null;
  let usdc: string | null = null;
  let aavePool: string | null = null;
  let aToken: string | null = null;
  let vaultAddress: string | null = null;
  let deploymentBlock: number | null = null;
  let errorMessage: string | undefined;

  try {
    if (!process.env.PRIVATE_KEY) {
      throw new Error("Set PRIVATE_KEY in hardhat/.env");
    }

    const signers = await ethers.getSigners();
    if (signers.length === 0) {
      throw new Error("Set PRIVATE_KEY in hardhat/.env");
    }
    const [deployer] = signers;
    deployerAddress = deployer.address;

    const resolved = loadResolvedAddresses(chainId);
    usdc = resolved.usdc;
    aavePool = resolved.aavePool;
    aToken = resolved.aToken;

    console.log("Deploying BaseYieldVault with:");
    console.log("USDC:", usdc);
    console.log("Aave Pool:", aavePool);
    console.log("aToken:", aToken);

    const poolContract = new ethers.Contract(aavePool, IPoolAbi, ethers.provider);
    const reserveData = await poolContract.getReserveData(usdc);
    const onchainAToken = reserveData.aTokenAddress as string;
    if (onchainAToken.toLowerCase() !== aToken.toLowerCase()) {
      throw new Error(`aToken mismatch. resolved=${aToken} onchain=${onchainAToken}`);
    }
    console.log("Validated aToken against Pool.getReserveData:", onchainAToken);

    const vaultFactory = await ethers.getContractFactory("BaseYieldVault");
    const vault = await vaultFactory.deploy(
      usdc,
      aavePool,
      aToken,
      "BaseYield USDC",
      "byUSDC"
    );
    await vault.waitForDeployment();

    const deploymentTx = vault.deploymentTransaction();
    const receipt = deploymentTx ? await deploymentTx.wait() : null;
    vaultAddress = await vault.getAddress();
    deploymentBlock = receipt?.blockNumber ?? null;

    console.log("Deployment summary");
    console.log("chainId:", chainId);
    console.log("network:", networkName);
    console.log("vaultAddress:", vaultAddress);
    console.log("deploymentBlock:", deploymentBlock ?? "unknown");
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Deployment failed:", errorMessage);
    console.error("Likely causes:");
    console.error("Set PRIVATE_KEY in hardhat/.env");
    console.error("Set BASE_SEPOLIA_RPC_URL or BASE_MAINNET_RPC_URL");
    console.error("Fund wallet with Base Sepolia ETH (testnet) for gas");
    console.error("Run the resolve script first so addresses.<chainId>.json exists");
  }

  const deploymentRecord: DeploymentRecord = {
    chainId,
    network: networkName,
    deployer: deployerAddress,
    vaultAddress,
    usdc,
    aavePool,
    aToken,
    deploymentBlock,
    deployedAt: new Date().toISOString(),
    status: vaultAddress ? "success" : "failed",
    ...(errorMessage ? { error: errorMessage } : {})
  };

  const deploymentPath = path.join(outDir, `deployments.${chainId}.json`);

  const vaultRecord: VaultRecord = {
    chainId,
    network: networkName,
    vaultAddress,
    deploymentBlock,
    updatedAt: new Date().toISOString(),
    status: vaultAddress ? "success" : "failed",
    ...(errorMessage ? { error: errorMessage } : {})
  };
  const vaultPath = path.join(outDir, `vault.${chainId}.json`);

  let deploymentWriteError: string | null = null;
  let vaultWriteError: string | null = null;

  try {
    fs.writeFileSync(deploymentPath, `${JSON.stringify(deploymentRecord, null, 2)}\n`, "utf8");
  } catch (error) {
    deploymentWriteError = error instanceof Error ? error.message : String(error);
    console.error("Failed writing deployment file:", deploymentWriteError);
  }

  try {
    fs.writeFileSync(vaultPath, `${JSON.stringify(vaultRecord, null, 2)}\n`, "utf8");
  } catch (error) {
    vaultWriteError = error instanceof Error ? error.message : String(error);
    console.error("Failed writing vault file:", vaultWriteError);
  }

  console.log("Deployment result");
  console.log("chainId:", chainId);
  console.log("network:", networkName);
  console.log("vaultAddress:", vaultAddress ?? "(not deployed)");
  console.log("deploymentBlock:", deploymentBlock ?? "unknown");
  console.log("Files written:");
  console.log("deployment file:", deploymentPath, deploymentWriteError ? "(failed)" : "(ok)");
  console.log("vault file:", vaultPath, vaultWriteError ? "(failed)" : "(ok)");

  if (deploymentWriteError || vaultWriteError) {
    throw new Error(
      `File write failure. deployment=${deploymentWriteError ?? "ok"} vault=${vaultWriteError ?? "ok"}`
    );
  }

  if (!vaultAddress) {
    throw new Error(
      `Deployment did not produce a vault address. Check ${deploymentPath} and ${vaultPath} for failure details.`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

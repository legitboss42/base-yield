import { base, baseSepolia } from "wagmi/chains";

export const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532");
export const TARGET_CHAIN = TARGET_CHAIN_ID === 8453 ? base : baseSepolia;
export const SUPPORTED_CHAINS = [baseSepolia, base] as const;

export function getExplorerBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ??
    (TARGET_CHAIN_ID === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org")
  );
}

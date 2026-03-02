"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";
import { formatUnits, isAddress, parseAbi, parseUnits, zeroAddress } from "viem";
import { depositEventAbi, usdcAbi, vaultAbi, withdrawEventAbi } from "@/lib/abis";
import { getExplorerBaseUrl, TARGET_CHAIN, TARGET_CHAIN_ID } from "@/lib/chains";

type ActivityEvent = {
  id: string;
  type: "deposit" | "withdraw";
  user: string;
  amountUsdc: string;
  timestamp: number;
};

type LeaderboardRow = {
  address: string;
  points: number;
  referrer?: string;
};

type PointsResponse = {
  leaderboard: LeaderboardRow[];
  pointsByAddress: Record<string, number>;
};

const VAULT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}` | undefined;
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS as `0x${string}` | undefined;
const USDC_ALTERNATES = process.env.NEXT_PUBLIC_USDC_ALTERNATES ?? "";
const EXPLORER_BASE_URL = getExplorerBaseUrl();
const DEPLOYMENT_BLOCK = BigInt(process.env.NEXT_PUBLIC_DEPLOYMENT_BLOCK ?? "0");
const vaultDecimalsAbi = parseAbi(["function decimals() view returns (uint8)"]);

function formatUsdc(value?: bigint) {
  if (value === undefined) return "--";
  return Number(formatUnits(value, 6)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseUsdcInput(value: string) {
  if (!value.trim()) return null;
  try {
    return parseUnits(value, 6);
  } catch {
    return null;
  }
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function DashboardApp() {
  const searchParams = useSearchParams();
  const { address, chain, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: TARGET_CHAIN_ID });
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  const [origin, setOrigin] = useState("");
  const [depositInput, setDepositInput] = useState("");
  const [withdrawInput, setWithdrawInput] = useState("");
  const [referrer, setReferrer] = useState<string | null>(null);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [depositCount, setDepositCount] = useState(0);
  const [withdrawCount, setWithdrawCount] = useState(0);
  const [uniqueDepositors, setUniqueDepositors] = useState(0);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [myPoints, setMyPoints] = useState(0);
  const [activityVersion, setActivityVersion] = useState(0);
  const [lastTx, setLastTx] = useState<{ hash: `0x${string}`; label: string } | null>(null);

  const targetVault = VAULT_ADDRESS && isAddress(VAULT_ADDRESS) ? VAULT_ADDRESS : undefined;
  const targetUsdc = USDC_ADDRESS && isAddress(USDC_ADDRESS) ? USDC_ADDRESS : undefined;
  const alternateUsdcTokens = useMemo(
    () =>
      USDC_ALTERNATES.split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) => isAddress(entry) && entry !== targetUsdc?.toLowerCase()) as `0x${string}`[],
    [targetUsdc]
  );
  const configured = Boolean(targetVault && targetUsdc);
  const wrongChain = Boolean(isConnected && chain?.id !== TARGET_CHAIN_ID);
  const depositUnits = parseUsdcInput(depositInput);
  const withdrawUnits = parseUsdcInput(withdrawInput);

  const {
    data: usdcBalance,
    refetch: refetchUsdcBalance,
    isLoading: isLoadingUsdc
  } = useReadContract({
    address: targetUsdc,
    abi: usdcAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && targetUsdc)
    }
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: targetUsdc,
    abi: usdcAbi,
    functionName: "allowance",
    args: address && targetVault ? [address, targetVault] : undefined,
    query: {
      enabled: Boolean(address && targetUsdc && targetVault)
    }
  });

  const { data: alternateBalances } = useReadContracts({
    contracts: alternateUsdcTokens.map((token) => ({
      address: token,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: address ? [address] : undefined
    })),
    query: {
      enabled: Boolean(address && alternateUsdcTokens.length > 0)
    }
  });

  const { data: sharesBalance, refetch: refetchShares } = useReadContract({
    address: targetVault,
    abi: vaultAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: Boolean(address && targetVault)
    }
  });

  const { data: vaultDecimalsData } = useReadContract({
    address: targetVault,
    abi: vaultDecimalsAbi,
    functionName: "decimals",
    query: {
      enabled: Boolean(targetVault)
    }
  });

  const { data: estimatedAssets, refetch: refetchEstimatedAssets } = useReadContract({
    address: targetVault,
    abi: vaultAbi,
    functionName: "convertToAssets",
    args: [sharesBalance ?? 0n],
    query: {
      enabled: Boolean(targetVault)
    }
  });

  const { data: totalAssets, refetch: refetchTotalAssets } = useReadContract({
    address: targetVault,
    abi: vaultAbi,
    functionName: "totalAssets",
    query: {
      enabled: Boolean(targetVault)
    }
  });

  const { isLoading: isTxConfirming, isSuccess: isTxConfirmed } = useWaitForTransactionReceipt({
    hash: lastTx?.hash,
    chainId: TARGET_CHAIN_ID,
    query: { enabled: Boolean(lastTx?.hash) }
  });

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const maybeRef = searchParams.get("ref");
    if (maybeRef && isAddress(maybeRef) && maybeRef !== zeroAddress) {
      localStorage.setItem("baseyield_ref", maybeRef.toLowerCase());
    }

    const stored = localStorage.getItem("baseyield_ref");
    setReferrer(stored && isAddress(stored) ? stored : null);
  }, [searchParams]);

  useEffect(() => {
    if (!isTxConfirmed) return;
    void Promise.all([
      refetchUsdcBalance(),
      refetchAllowance(),
      refetchShares(),
      refetchEstimatedAssets(),
      refetchTotalAssets()
    ]);
    setActionError(null);
    setActivityVersion((v) => v + 1);
  }, [
    isTxConfirmed,
    refetchAllowance,
    refetchEstimatedAssets,
    refetchShares,
    refetchTotalAssets,
    refetchUsdcBalance
  ]);

  useEffect(() => {
    setActionError(null);
  }, [depositInput, withdrawInput]);

  useEffect(() => {
    if (!publicClient || !targetVault) return;

    let cancelled = false;
    const fetchActivity = async () => {
      setActivityLoading(true);
      setActivityError(null);

      try {
        const [depositLogs, withdrawLogs] = await Promise.all([
          publicClient.getLogs({
            address: targetVault,
            event: depositEventAbi,
            fromBlock: DEPLOYMENT_BLOCK,
            toBlock: "latest"
          }),
          publicClient.getLogs({
            address: targetVault,
            event: withdrawEventAbi,
            fromBlock: DEPLOYMENT_BLOCK,
            toBlock: "latest"
          })
        ]);

        const uniqueBlockHeights = new Set<bigint>();
        [...depositLogs, ...withdrawLogs].forEach((log) => {
          if (log.blockNumber !== null) {
            uniqueBlockHeights.add(log.blockNumber);
          }
        });

        const timestampMap = new Map<string, number>();
        await Promise.all(
          Array.from(uniqueBlockHeights).map(async (blockNumber) => {
            const block = await publicClient.getBlock({ blockNumber });
            timestampMap.set(blockNumber.toString(), Number(block.timestamp));
          })
        );

        const depositEvents: ActivityEvent[] = depositLogs.map((log) => ({
          id: `${log.transactionHash}-${String(log.logIndex)}`,
          type: "deposit",
          user: String(log.args.owner).toLowerCase(),
          amountUsdc: formatUnits(log.args.assets ?? 0n, 6),
          timestamp:
            log.blockNumber !== null ? timestampMap.get(log.blockNumber.toString()) ?? 0 : 0
        }));

        const withdrawEvents: ActivityEvent[] = withdrawLogs.map((log) => ({
          id: `${log.transactionHash}-${String(log.logIndex)}`,
          type: "withdraw",
          user: String(log.args.owner).toLowerCase(),
          amountUsdc: formatUnits(log.args.assets ?? 0n, 6),
          timestamp:
            log.blockNumber !== null ? timestampMap.get(log.blockNumber.toString()) ?? 0 : 0
        }));

        const events = [...depositEvents, ...withdrawEvents].sort((a, b) => {
          if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
          return b.id.localeCompare(a.id);
        });

        if (cancelled) return;

        setActivityEvents(events);
        setDepositCount(depositLogs.length);
        setWithdrawCount(withdrawLogs.length);
        setUniqueDepositors(new Set(depositEvents.map((event) => event.user)).size);

        const referralMap: Record<string, string> = {};
        if (address && referrer) {
          referralMap[address.toLowerCase()] = referrer.toLowerCase();
        }

        const pointsResponse = await fetch("/api/points", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events, referrals: referralMap })
        });

        if (pointsResponse.ok) {
          const payload = (await pointsResponse.json()) as PointsResponse;
          setLeaderboard(payload.leaderboard ?? []);
          if (address) {
            setMyPoints(payload.pointsByAddress?.[address.toLowerCase()] ?? 0);
          }
        }
      } catch (error) {
        if (cancelled) return;
        setActivityError(error instanceof Error ? error.message : "Unable to load activity");
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    };

    void fetchActivity();

    return () => {
      cancelled = true;
    };
  }, [address, activityVersion, publicClient, referrer, targetVault]);

  const allowanceEnough = useMemo(() => {
    if (!depositUnits) return false;
    if (allowance === undefined) return false;
    return allowance >= depositUnits;
  }, [allowance, depositUnits]);

  const hasEnoughUsdcForDeposit = useMemo(() => {
    if (!depositUnits) return false;
    if (usdcBalance === undefined) return true;
    return usdcBalance >= depositUnits;
  }, [depositUnits, usdcBalance]);

  const vaultDecimals = Number(vaultDecimalsData ?? 6);
  const formattedShares =
    sharesBalance === undefined ? "--" : formatUnits(sharesBalance, vaultDecimals);
  const alternateUsdcRows = useMemo(
    () =>
      alternateUsdcTokens
        .map((token, index) => {
          const result = alternateBalances?.[index]?.result;
          const balance = typeof result === "bigint" ? result : 0n;
          return { token, balance };
        })
        .filter((row) => row.balance > 0n),
    [alternateBalances, alternateUsdcTokens]
  );

  const referralLink =
    address && origin ? `${origin}/app?ref=${address.toLowerCase()}` : "Connect wallet to generate";

  const runApprove = async () => {
    if (!targetUsdc || !targetVault) return;
    if (!depositUnits || depositUnits <= 0n) {
      setActionError("Enter a deposit amount to approve.");
      return;
    }
    if (usdcBalance !== undefined && usdcBalance === 0n) {
      setActionError(`No supported USDC balance detected for vault asset ${targetUsdc}.`);
      return;
    }
    if (usdcBalance !== undefined && usdcBalance < depositUnits) {
      setActionError("Insufficient USDC balance for this deposit amount.");
      return;
    }

    setActionError(null);
    const hash = await writeContractAsync({
      address: targetUsdc,
      abi: usdcAbi,
      functionName: "approve",
      args: [targetVault, depositUnits],
      chainId: TARGET_CHAIN_ID
    });
    setLastTx({ hash, label: "Approve USDC" });
  };

  const runDeposit = async () => {
    if (!targetVault || !address || !depositUnits || depositUnits <= 0n) return;
    if (usdcBalance !== undefined && usdcBalance < depositUnits) {
      setActionError("Insufficient USDC balance for this deposit amount.");
      return;
    }
    if (!allowanceEnough) {
      setActionError("Allowance is lower than deposit amount. Approve this amount first.");
      return;
    }

    setActionError(null);
    const hash = await writeContractAsync({
      address: targetVault,
      abi: vaultAbi,
      functionName: "deposit",
      args: [depositUnits, address],
      chainId: TARGET_CHAIN_ID
    });
    setLastTx({ hash, label: "Deposit USDC" });
    setDepositInput("");
  };

  const runWithdraw = async () => {
    if (!targetVault || !address || !withdrawUnits || withdrawUnits <= 0n) return;
    const hash = await writeContractAsync({
      address: targetVault,
      abi: vaultAbi,
      functionName: "withdraw",
      args: [withdrawUnits, address, address],
      chainId: TARGET_CHAIN_ID
    });
    setLastTx({ hash, label: "Withdraw USDC" });
    setWithdrawInput("");
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8 md:px-8">
      <section className="grid gap-4 rounded-2xl border border-[color:var(--ink-muted)]/30 bg-[color:var(--surface-soft)]/70 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--ink-muted)]">BaseYield</p>
          <h1 className="font-display text-3xl leading-tight text-[color:var(--ink)] md:text-4xl">
            USDC vault dashboard
          </h1>
          <p className="max-w-xl text-sm text-[color:var(--ink-muted)]">
            Deposit USDC, vault shares are minted, and assets are supplied to Aave V3. Withdraw any time.
          </p>
        </div>
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[color:var(--ink-muted)]/25 bg-[color:var(--surface)] p-4">
          <p className="text-sm text-[color:var(--ink-muted)]">
            Target network: <span className="font-semibold text-[color:var(--ink)]">{TARGET_CHAIN.name}</span>
          </p>
          <ConnectButton />
          {wrongChain ? (
            <button
              type="button"
              onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
              className="rounded-md bg-[color:var(--accent)] px-3 py-2 text-sm font-semibold text-black"
              disabled={isSwitching}
            >
              {isSwitching ? "Switching..." : `Switch to ${TARGET_CHAIN.name}`}
            </button>
          ) : null}
        </div>
      </section>

      {!configured ? (
        <section className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          Missing env values. Set NEXT_PUBLIC_VAULT_ADDRESS and NEXT_PUBLIC_USDC_ADDRESS.
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="metric-card">
          <p>Wallet USDC</p>
          <h3>{isLoadingUsdc ? "Loading..." : formatUsdc(usdcBalance)}</h3>
        </article>
        <article className="metric-card">
          <p>Shares</p>
          <h3>{formattedShares}</h3>
        </article>
        <article className="metric-card">
          <p>Estimated assets</p>
          <h3>{formatUsdc(estimatedAssets)}</h3>
        </article>
        <article className="metric-card">
          <p>Vault TVL</p>
          <h3>{formatUsdc(totalAssets)}</h3>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="panel space-y-4">
          <h2 className="panel-title">Vault actions</h2>
          <p className="text-sm text-[color:var(--ink-muted)]">
            1) Approve USDC 2) Deposit 3) Withdraw whenever you need liquidity.
          </p>

          <div className="space-y-3">
            <label className="field-label" htmlFor="depositAmount">
              Deposit amount (USDC)
            </label>
            <input
              id="depositAmount"
              className="field-input"
              placeholder="100.00"
              value={depositInput}
              onChange={(event) => setDepositInput(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                disabled={
                  !isConnected || wrongChain || isWritePending || !depositUnits || depositUnits <= 0n
                }
                onClick={runApprove}
              >
                Approve USDC
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  !isConnected ||
                  wrongChain ||
                  isWritePending ||
                  !depositUnits ||
                  depositUnits <= 0n ||
                  !allowanceEnough ||
                  !hasEnoughUsdcForDeposit
                }
                onClick={runDeposit}
              >
                Deposit
              </button>
            </div>
            {!depositUnits || depositUnits <= 0n ? (
              <p className="text-xs text-amber-800">Enter a deposit amount to approve.</p>
            ) : usdcBalance !== undefined && usdcBalance === 0n ? (
              <p className="text-xs text-red-700">
                No supported USDC balance detected for vault asset {targetUsdc ?? "configured USDC"}.
              </p>
            ) : usdcBalance !== undefined && depositUnits > usdcBalance ? (
              <p className="text-xs text-red-700">Insufficient USDC balance for this deposit amount.</p>
            ) : !allowanceEnough ? (
              <p className="text-xs text-amber-800">Approval is required for the current deposit amount.</p>
            ) : null}
            {alternateUsdcRows.length > 0 ? (
              <p className="text-xs text-[color:var(--ink-muted)]">
                Other USDC balances detected:{" "}
                {alternateUsdcRows
                  .map((row) => `${formatUsdc(row.balance)} @ ${shortAddress(row.token)}`)
                  .join(" | ")}
                . Vault accepts only {shortAddress(targetUsdc ?? zeroAddress)}.
              </p>
            ) : null}
            {actionError ? <p className="text-xs text-red-700">{actionError}</p> : null}
          </div>

          <div className="space-y-3">
            <label className="field-label" htmlFor="withdrawAmount">
              Withdraw amount (USDC)
            </label>
            <input
              id="withdrawAmount"
              className="field-input"
              placeholder="25.00"
              value={withdrawInput}
              onChange={(event) => setWithdrawInput(event.target.value)}
            />
            <button
              type="button"
              className="btn-primary"
              disabled={!isConnected || wrongChain || isWritePending || !withdrawUnits || withdrawUnits <= 0n}
              onClick={runWithdraw}
            >
              Withdraw
            </button>
          </div>

          {lastTx ? (
            <div className="rounded-md border border-[color:var(--ink-muted)]/30 bg-[color:var(--surface)] p-3 text-sm">
              <p className="font-semibold">{lastTx.label}</p>
              <p>
                {isTxConfirming ? "Confirming..." : "Submitted"}
                {" | "}
                <a
                  className="underline"
                  href={`${EXPLORER_BASE_URL}/tx/${lastTx.hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction
                </a>
              </p>
            </div>
          ) : null}
        </div>

        <aside className="panel space-y-4">
          <h2 className="panel-title">Risk panel</h2>
          <div className="rounded-lg border border-emerald-700/20 bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-semibold">Low risk: Aave V3 USDC</p>
            <p className="mt-1">
              Funds are supplied to Aave V3 in USDC. Smart-contract and protocol risks still apply.
            </p>
          </div>
          <p className="text-sm text-[color:var(--ink-muted)]">
            Flow: Wallet USDC -&gt; BaseYieldVault (ERC-4626 shares) -&gt; Aave V3 Pool -&gt; aToken accrual.
          </p>
          <Link className="text-sm font-semibold underline" href="/">
            Back to overview
          </Link>
        </aside>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel space-y-3">
          <h2 className="panel-title">Activity</h2>
          {activityLoading ? <p className="text-sm text-[color:var(--ink-muted)]">Loading logs...</p> : null}
          {activityError ? <p className="text-sm text-red-700">{activityError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="stat-row">
              <span>Total deposits</span>
              <strong>{depositCount}</strong>
            </div>
            <div className="stat-row">
              <span>Total withdrawals</span>
              <strong>{withdrawCount}</strong>
            </div>
            <div className="stat-row">
              <span>Unique depositors</span>
              <strong>{uniqueDepositors}</strong>
            </div>
            <div className="stat-row">
              <span>Indexed events</span>
              <strong>{activityEvents.length}</strong>
            </div>
          </div>
        </div>

        <div className="panel space-y-3">
          <h2 className="panel-title">Points + referrals</h2>
          <p className="text-sm text-[color:var(--ink-muted)]">
            Points = deposit_amount_usdc x time_held_hours. Offchain and non-transferable.
          </p>
          <div className="stat-row">
            <span>Your points</span>
            <strong>{myPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          </div>
          <div className="rounded-md border border-[color:var(--ink-muted)]/25 bg-[color:var(--surface)] p-3 text-xs">
            <p className="mb-1 font-semibold">Active referral</p>
            <p className="break-all">{referrer ?? "None"}</p>
          </div>
          <div className="rounded-md border border-[color:var(--ink-muted)]/25 bg-[color:var(--surface)] p-3 text-xs">
            <p className="mb-1 font-semibold">Your referral link</p>
            <p className="break-all">{referralLink}</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[color:var(--ink)]">Leaderboard</p>
            <ol className="space-y-1 text-sm">
              {leaderboard.slice(0, 20).map((entry, index) => (
                <li key={entry.address} className="flex items-center justify-between rounded-md bg-[color:var(--surface)] px-3 py-2">
                  <span>
                    #{index + 1} {shortAddress(entry.address)}
                  </span>
                  <span className="font-semibold">
                    {entry.points.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </main>
  );
}


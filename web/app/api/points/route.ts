import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ActivityEvent = {
  id: string;
  type: "deposit" | "withdraw";
  user: string;
  amountUsdc: string;
  timestamp: number;
};

type PositionLot = {
  amountUsdc: number;
  timestamp: number;
};

type UserPoints = {
  basePoints: number;
  lots: PositionLot[];
  referrer?: string;
};

type PointsStore = {
  users: Record<string, UserPoints>;
  eventCount: number;
  updatedAt: string;
};

const STORE_PATH = path.join(process.cwd(), "data", "points-store.json");
// MVP note: This endpoint rebuilds points from event logs. V2 will use persistent storage/indexer.

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

function sanitizeEvents(events: unknown[]): ActivityEvent[] {
  const sanitized: ActivityEvent[] = [];

  for (const rawEvent of events) {
    if (!rawEvent || typeof rawEvent !== "object") continue;

    const event = rawEvent as Partial<ActivityEvent>;
    if (event.type !== "deposit" && event.type !== "withdraw") continue;
    if (typeof event.user !== "string" || !isAddress(event.user)) continue;
    if (typeof event.id !== "string" || !event.id) continue;
    if (typeof event.timestamp !== "number" || !Number.isFinite(event.timestamp) || event.timestamp <= 0) {
      continue;
    }
    if (typeof event.amountUsdc !== "string") continue;

    const parsedAmount = Number(event.amountUsdc);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) continue;

    const clampedAmount = Math.round(parsedAmount * 1e6) / 1e6;
    if (!Number.isFinite(clampedAmount) || clampedAmount <= 0) continue;

    sanitized.push({
      id: event.id,
      type: event.type,
      user: normalizeAddress(event.user),
      amountUsdc: clampedAmount.toString(),
      timestamp: event.timestamp
    });
  }

  return sanitized;
}

function createEmptyStore(): PointsStore {
  return {
    users: {},
    eventCount: 0,
    updatedAt: new Date().toISOString()
  };
}

async function readStore(): Promise<PointsStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as PointsStore;
  } catch {
    return createEmptyStore();
  }
}

async function writeStore(store: PointsStore) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function ensureUser(store: PointsStore, address: string): UserPoints {
  const normalized = normalizeAddress(address);
  if (!store.users[normalized]) {
    store.users[normalized] = {
      basePoints: 0,
      lots: []
    };
  }
  return store.users[normalized];
}

function applyDeposit(store: PointsStore, event: ActivityEvent) {
  const user = ensureUser(store, event.user);
  const amount = Number(event.amountUsdc);
  if (!Number.isFinite(amount) || amount <= 0) return;
  user.lots.push({ amountUsdc: amount, timestamp: event.timestamp });
}

function applyWithdraw(store: PointsStore, event: ActivityEvent) {
  const user = ensureUser(store, event.user);
  let remaining = Number(event.amountUsdc);

  if (!Number.isFinite(remaining) || remaining <= 0) return;

  while (remaining > 0 && user.lots.length > 0) {
    const lot = user.lots[0];
    const consumed = Math.min(lot.amountUsdc, remaining);
    const heldSeconds = Math.max(event.timestamp - lot.timestamp, 0);
    const heldHours = heldSeconds / 3600;

    user.basePoints += consumed * heldHours;
    lot.amountUsdc -= consumed;
    remaining -= consumed;

    if (lot.amountUsdc <= 0.000001) {
      user.lots.shift();
    }
  }
}

function buildSnapshot(store: PointsStore) {
  const now = Math.floor(Date.now() / 1000);
  const pointsByAddress: Record<string, number> = {};

  for (const [address, user] of Object.entries(store.users)) {
    const floatingPoints = user.lots.reduce((acc, lot) => {
      const heldHours = Math.max(now - lot.timestamp, 0) / 3600;
      return acc + lot.amountUsdc * heldHours;
    }, 0);
    pointsByAddress[address] = user.basePoints + floatingPoints;
  }

  const leaderboard = Object.entries(pointsByAddress)
    .map(([address, points]) => ({
      address,
      points,
      referrer: store.users[address]?.referrer
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 20);

  return { pointsByAddress, leaderboard };
}

export async function GET(request: NextRequest) {
  const store = await readStore();
  const snapshot = buildSnapshot(store);
  const address = request.nextUrl.searchParams.get("address");

  return NextResponse.json({
    ...snapshot,
    userPoints: address ? snapshot.pointsByAddress[normalizeAddress(address)] ?? 0 : null,
    eventCount: store.eventCount,
    updatedAt: store.updatedAt
  });
}

export async function POST(request: NextRequest) {
  let body: {
    events?: unknown[];
    referrals?: Record<string, string>;
  };

  try {
    body = (await request.json()) as {
      events?: unknown[];
      referrals?: Record<string, string>;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const events = sanitizeEvents(Array.isArray(body.events) ? body.events : []);
  const referrals = body.referrals ?? {};

  const rebuiltStore = createEmptyStore();
  const sortedEvents = events.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.id.localeCompare(b.id);
  });

  for (const event of sortedEvents) {
    if (event.type === "deposit") applyDeposit(rebuiltStore, event);
    if (event.type === "withdraw") applyWithdraw(rebuiltStore, event);
  }

  for (const [userAddress, referrerAddress] of Object.entries(referrals)) {
    if (!isAddress(userAddress) || !isAddress(referrerAddress)) continue;
    const user = ensureUser(rebuiltStore, userAddress);
    user.referrer = normalizeAddress(referrerAddress);
  }

  rebuiltStore.eventCount = sortedEvents.length;
  rebuiltStore.updatedAt = new Date().toISOString();
  await writeStore(rebuiltStore);

  const snapshot = buildSnapshot(rebuiltStore);
  return NextResponse.json({
    ...snapshot,
    eventCount: rebuiltStore.eventCount,
    updatedAt: rebuiltStore.updatedAt
  });
}

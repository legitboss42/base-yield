import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 pb-12 md:px-8">
      <section className="hero-grid">
        <div className="space-y-4">
          <p className="pill">Built on Base + Aave V3</p>
          <h1 className="font-display text-4xl leading-tight text-[color:var(--ink)] md:text-6xl">
            1-click USDC yield on Base
          </h1>
          <p className="max-w-2xl text-base text-[color:var(--ink-muted)]">
            BaseYield is a retail-friendly ERC-4626 vault: deposit USDC, vault funds are supplied to Aave V3,
            and you can withdraw any time.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className="btn-primary" href="/app">
              Start earning
            </Link>
            <a className="btn-secondary" href="https://aave.com" target="_blank" rel="noreferrer">
              Read Aave docs
            </a>
          </div>
        </div>
        <aside className="panel">
          <h2 className="panel-title">Low risk profile</h2>
          <p className="text-sm text-[color:var(--ink-muted)]">
            Strategy scope is intentionally narrow for the MVP:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[color:var(--ink)]">
            <li>USDC only</li>
            <li>Aave V3 Pool only</li>
            <li>Anytime withdrawals</li>
            <li>No leveraged strategies</li>
          </ul>
        </aside>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="panel">
          <h3 className="panel-title">How it works</h3>
          <p className="text-sm text-[color:var(--ink-muted)]">
            Deposit USDC into the vault and receive shares. The vault supplies USDC to Aave V3 and holds aUSDC.
          </p>
        </article>
        <article className="panel">
          <h3 className="panel-title">Why Base</h3>
          <p className="text-sm text-[color:var(--ink-muted)]">
            Fast finality, low fees, familiar wallet UX, and strong distribution for consumer DeFi use cases.
          </p>
        </article>
        <article className="panel">
          <h3 className="panel-title">Usage signals</h3>
          <p className="text-sm text-[color:var(--ink-muted)]">
            Built-in activity metrics, referral links, and offchain points leaderboard to track early traction.
          </p>
        </article>
      </section>
    </main>
  );
}

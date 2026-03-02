import { Suspense } from "react";
import { DashboardApp } from "@/components/dashboard-app";

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-6xl px-5 py-8">Loading...</main>}>
      <DashboardApp />
    </Suspense>
  );
}

import type { Metadata } from "next";

import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Analytics" };

export default function AdminAnalyticsPage() {
  return (
    <>
      <PageHeader title="Analytics" />
      <main className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <AnalyticsDashboard />
      </main>
    </>
  );
}

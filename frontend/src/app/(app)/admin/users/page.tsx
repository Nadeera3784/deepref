import type { Metadata } from "next";

import { UsersTable } from "@/components/admin/users-table";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  return (
    <>
      <PageHeader title="Users" />
      <main className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <UsersTable />
      </main>
    </>
  );
}

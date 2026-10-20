import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { PasswordForm, ProfileForm } from "@/components/settings-forms";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <main className="mx-auto grid w-full max-w-2xl gap-6 p-4 md:p-6">
        <ProfileForm />
        <PasswordForm />
      </main>
    </>
  );
}

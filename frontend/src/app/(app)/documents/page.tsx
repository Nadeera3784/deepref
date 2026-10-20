import type { Metadata } from "next";

import { DocumentsTable } from "@/components/documents/documents-table";
import { UploadDropzone } from "@/components/documents/upload-dropzone";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Documents" };

export default function DocumentsPage() {
  return (
    <>
      <PageHeader title="Documents" />
      <main className="mx-auto w-full max-w-5xl space-y-8 p-4 md:p-6">
        <section className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Your knowledge base</h2>
          <p className="text-muted-foreground text-sm">
            Upload PDFs, then ask questions about them in a chat. Indexing runs in the background.
          </p>
        </section>
        <UploadDropzone />
        <DocumentsTable />
      </main>
    </>
  );
}

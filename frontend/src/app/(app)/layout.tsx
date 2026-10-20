import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { Logo } from "@/components/logo";
import { Sidebar, SidebarHeader, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      {/* The sidebar reads the current path, which is request-time data on dynamic routes. */}
      <Suspense fallback={<SidebarFallback />}>
        <AppSidebar />
      </Suspense>
      <SidebarInset className="min-w-0">{children}</SidebarInset>
    </SidebarProvider>
  );
}

function SidebarFallback() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Logo className="px-1 py-1.5 group-data-[collapsible=icon]:[&>span]:hidden" />
      </SidebarHeader>
    </Sidebar>
  );
}

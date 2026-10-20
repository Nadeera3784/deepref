import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="bg-muted/40 flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <Logo className="text-lg" />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}

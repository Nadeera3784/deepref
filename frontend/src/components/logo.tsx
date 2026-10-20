import Image from "next/image";

import { cn } from "@/lib/utils";

/** Brand mark: stacked pages (the knowledge base) with one highlighted, cited passage. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.svg"
      alt=""
      width={32}
      height={32}
      unoptimized
      priority
      className={cn("size-8 shrink-0", className)}
    />
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span>
        Deep<span className="text-blue-600 dark:text-blue-400">Ref</span>
      </span>
    </div>
  );
}

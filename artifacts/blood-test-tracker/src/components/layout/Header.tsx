import { ReactNode } from "react";
import { MobileNav } from "./Sidebar";
import { Button } from "@/components/ui/button";

export function Header({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-background border-b sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <MobileNav />
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {children}
      </div>
    </header>
  );
}

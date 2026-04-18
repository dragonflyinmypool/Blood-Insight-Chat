import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, TestTube, LineChart, MessageSquare, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/tests", label: "Blood Tests", icon: TestTube },
  { href: "/markers", label: "Marker History", icon: LineChart },
  { href: "/chat", label: "AI Chat", icon: MessageSquare },
];

function NavLinks({ className = "", onItemClick }: { className?: string, onItemClick?: () => void }) {
  const [location] = useLocation();

  return (
    <nav className={`flex flex-col gap-2 ${className}`}>
      {NAV_ITEMS.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href}>
            <span
              onClick={onItemClick}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <div className="hidden md:flex flex-col w-64 bg-card border-r h-[100dvh] sticky top-0">
      <div className="p-6">
        <Link href="/">
          <span className="flex items-center gap-2 font-semibold text-lg text-primary tracking-tight">
            <Activity className="h-6 w-6" />
            Vitality
          </span>
        </Link>
      </div>
      <div className="px-4 flex-1">
        <NavLinks />
      </div>
      <div className="p-4 border-t text-xs text-muted-foreground text-center">
        Personal Health Companion
      </div>
    </div>
  );
}

export function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="p-6">
          <Link href="/">
            <span className="flex items-center gap-2 font-semibold text-lg text-primary tracking-tight">
              <Activity className="h-6 w-6" />
              Vitality
            </span>
          </Link>
        </div>
        <div className="px-4">
          <NavLinks />
        </div>
      </SheetContent>
    </Sheet>
  );
}

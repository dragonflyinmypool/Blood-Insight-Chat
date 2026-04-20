"use client";

import * as React from "react";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ displayName, email }: { displayName: string | null; email: string }) {
  const name = displayName ?? email;
  const initial = (displayName ?? email).trim().charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-start gap-2 px-2 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            {initial || <User className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium">{name}</p>
            {displayName && <p className="truncate text-xs text-muted-foreground">{email}</p>}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="truncate text-sm">{displayName ?? "Account"}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="POST">
          <button type="submit" className="w-full">
            <DropdownMenuItem className="cursor-pointer" asChild>
              <span className="flex w-full items-center gap-2">
                <LogOut className="h-4 w-4" />
                Sign out
              </span>
            </DropdownMenuItem>
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

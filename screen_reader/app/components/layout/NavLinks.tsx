"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/app/lib/format";

const links = [
  { href: "/library", label: "My recipes" },
  { href: "/#how-it-works", label: "How it works" },
];

// Reads the current URL to highlight the active link. The URL is only known
// at request time, so SiteHeader wraps this in <Suspense>.
export default function NavLinks() {
  return <LinkList pathname={usePathname()} />;
}

export function LinkList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="hidden flex-1 items-center gap-[30px] text-sm md:flex">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "transition hover:text-rose",
                active ? "font-semibold text-rose" : "text-muted",
              )}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { CookingPot, Plus, UserRound } from "lucide-react";
import NavLinks, { LinkList } from "./NavLinks";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
      <nav className="flex h-[88px] items-center gap-10 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-rose">
          <CookingPot size={29} strokeWidth={1.7} aria-hidden />
          <span className="font-display text-[34px] leading-none tracking-[-1px]">
            simmer
          </span>
        </Link>

        <Suspense fallback={<LinkList pathname={null} />}>
          <NavLinks />
        </Suspense>

        <div className="ml-auto flex items-center gap-10 md:ml-0">
          <Link
            href="/"
            className="flex h-11 items-center gap-2 rounded-md bg-rose px-[18px] text-[13px] font-semibold text-white transition hover:bg-rose-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pastel-pink"
          >
            <Plus size={17} strokeWidth={1.7} aria-hidden />
            <span className="hidden sm:inline">New cooking video</span>
            <span className="sm:hidden">New</span>
          </Link>
          <span
            className="hidden h-9 w-9 items-center justify-center rounded-full bg-peach text-ink sm:flex"
            aria-label="Account"
          >
            <UserRound size={18} strokeWidth={1.7} aria-hidden />
          </span>
        </div>
      </nav>
    </header>
  );
}

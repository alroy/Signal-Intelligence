"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "My Objectives" },
  { href: "/patterns", label: "Shared Patterns" },
  { href: "/settings", label: "Settings" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-6">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium transition-colors ${
              isActive
                ? "text-gray-900 border-b-2 border-[#3BD1BB] pb-0.5"
                : "text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-200 pb-0.5"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

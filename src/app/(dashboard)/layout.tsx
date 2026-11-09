"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/numeros", label: "Números" },
  { href: "/contatos", label: "Contatos" },
  { href: "/mensagens", label: "Mensagens" },
  { href: "/fluxos", label: "Fluxos" },
  { href: "/configuracoes", label: "Configurações" },
  { href: "/logs", label: "Logs" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-900">Follow-up WhatsApp</span>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded px-3 py-1.5 text-sm ${
                    active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="hidden text-sm text-neutral-500 hover:text-neutral-900 md:inline"
            >
              Sair
            </button>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Abrir menu"
              className="rounded border border-neutral-300 p-2 text-neutral-700 md:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="mt-3 flex flex-col gap-1 border-t border-neutral-100 pt-3 md:hidden">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`rounded px-3 py-2 text-sm ${
                    active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="rounded px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-100"
            >
              Sair
            </button>
          </nav>
        )}
      </header>
      <main className="flex-1 bg-neutral-50 p-4 sm:p-6">{children}</main>
    </div>
  );
}

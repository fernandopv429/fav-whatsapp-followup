"use client";

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

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
        <span className="text-sm font-semibold text-neutral-900">
          Follow-up WhatsApp
        </span>
        <nav className="flex gap-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-3 py-1.5 text-sm ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleLogout}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          Sair
        </button>
      </header>
      <main className="flex-1 bg-neutral-50 p-6">{children}</main>
    </div>
  );
}

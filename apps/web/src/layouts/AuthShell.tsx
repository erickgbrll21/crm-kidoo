import Link from 'next/link';
import { KidooMark } from './Sidebar';

export function AuthShell({ children, title, description }: { children: React.ReactNode; title: string; description: string }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(280px,42%)_1fr]">
      <aside className="relative hidden flex-col justify-between bg-sidebar px-10 py-10 text-sidebar-foreground lg:flex">
        <Link href="/login" className="inline-flex">
          <KidooMark className="h-11" />
        </Link>
        <div className="max-w-sm">
          <p className="text-[28px] leading-tight font-semibold tracking-[-0.03em] text-balance">
            De lead enriquecido a contrato, sem deixar a conversa esfriar.
          </p>
          <p className="mt-4 text-sm text-sidebar-muted">
            Pipeline, follow-up e Setup + MRR da Kidoo Hub num só lugar — com o diagnóstico do Antigravity Engine na mesa.
          </p>
        </div>
        <p className="text-xs text-sidebar-muted">Uso interno · Pedro, Arthur e Erick</p>
      </aside>
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[400px]">
          <Link href="/login" className="mb-8 inline-flex lg:hidden">
            <KidooMark tone="on-light" className="h-9" />
          </Link>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

import { Link } from 'react-router';
import { KidooMark } from './Sidebar';

export function AuthShell({ children, title, description }: { children: React.ReactNode; title: string; description: string }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(280px,42%)_1fr]">
      <aside className="relative hidden flex-col justify-between bg-sidebar px-10 py-10 text-sidebar-foreground lg:flex">
        <Link to="/login" className="flex items-center gap-3">
          <KidooMark className="size-9" />
          <span>
            <span className="block text-[15px] font-semibold">Kidoo Hub</span>
            <span className="block text-xs text-sidebar-muted">Revenue CRM</span>
          </span>
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
          <Link to="/login" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <KidooMark className="size-8 text-moss-800" />
            <span className="text-sm font-semibold">Kidoo Revenue CRM</span>
          </Link>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

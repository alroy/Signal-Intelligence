import Image from "next/image";
import { LoginButton } from "@/components/login-button";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50">
      {/* Signal grid background */}
      <div className="signal-grid absolute inset-0" />

      {/* Scanning line */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-scan h-px w-full bg-gradient-to-r from-transparent via-[#3BD1BB]/20 to-transparent" />
      </div>

      {/* Glassmorphism card */}
      <div className="relative z-10 w-full max-w-md animate-entrance rounded-2xl border border-slate-200/50 bg-white/70 px-10 py-12 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
        <div className="text-center">
          <Image
            src="/logo.svg"
            alt="Zencity"
            width={156}
            height={40}
            className="mx-auto mb-8"
            priority
          />
          <h1 className="text-xl font-semibold uppercase tracking-[0.25em] text-slate-800">
            Signal Intelligence
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Monitor signals that matter for your objectives
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <LoginButton />
        </div>
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-8 text-[11px] tracking-wider text-slate-400">
        Strategic Intelligence for Product Leaders
      </p>
    </div>
  );
}

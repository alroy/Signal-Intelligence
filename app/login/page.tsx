import Image from "next/image";
import { LoginButton } from "@/components/login-button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white">
      <div className="flex w-full max-w-sm flex-col items-center space-y-8 animate-entrance">
        <div className="text-center">
          <Image
            src="/logo.svg"
            alt="Zencity"
            width={156}
            height={40}
            className="mx-auto mb-6"
            priority
          />
          <h1 className="text-2xl font-semibold tracking-widest text-gray-900 uppercase">
            Signal Intelligence
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            Monitor signals that matter for your objectives
          </p>
        </div>
        <LoginButton />
      </div>
    </div>
  );
}

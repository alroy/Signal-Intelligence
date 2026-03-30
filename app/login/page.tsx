import { LoginButton } from "@/components/login-button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Signal Intelligence
          </h1>
          <p className="mt-2 text-gray-600">
            Monitor signals that matter for your objectives
          </p>
        </div>
        <LoginButton />
      </div>
    </div>
  );
}

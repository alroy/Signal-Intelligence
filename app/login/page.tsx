import { LoginButton } from "@/components/login-button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="flex w-full max-w-sm flex-col items-center space-y-8">
        <div className="text-center">
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

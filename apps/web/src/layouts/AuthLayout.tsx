import { Outlet, Navigate } from "react-router-dom";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";

export default function AuthLayout() {
  const hasToken = !!localStorage.getItem("auth_token");

  if (hasToken) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0F172A]">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <Logo size="lg" variant="full" color="light" tagline className="mb-10" />
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

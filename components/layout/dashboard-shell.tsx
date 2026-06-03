import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <AppSidebar />
      </div>
      <div className="lg:pl-72">
        <MobileNav />
        <Topbar />
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

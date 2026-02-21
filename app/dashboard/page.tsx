import { DashboardContent } from "./_components/dashboard-content";

export const metadata = {
  title: "Dashboard — Trading AI",
};

export default function DashboardPage() {
  return (
    <main className="container mx-auto py-8 px-4 max-w-7xl">
      <DashboardContent />
    </main>
  );
}

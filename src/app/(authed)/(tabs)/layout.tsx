import { TabBar } from "@/components/TabBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col">{children}</main>
      <TabBar />
    </div>
  );
}

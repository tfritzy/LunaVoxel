import Navigation from "./Navigation";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

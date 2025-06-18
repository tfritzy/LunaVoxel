interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col">
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}

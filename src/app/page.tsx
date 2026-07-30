import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">SpeakFlow AI</h1>
        <p className="text-muted-foreground mt-1 text-sm">每天開口說英文</p>
      </div>
      <Link
        href="/practice/shadowing"
        className="bg-primary text-primary-foreground rounded-full px-8 py-3.5 text-sm font-medium shadow-lg active:scale-95"
      >
        開始跟讀練習
      </Link>
    </main>
  );
}

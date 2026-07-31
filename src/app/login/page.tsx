import { login, signup } from "./actions";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">SpeakFlow AI</h1>
        <p className="text-muted-foreground mt-1 text-sm">登入或建立帳號，開始每天練習</p>
      </div>

      {params.message === "check-email" && (
        <p className="mb-4 rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-600">
          已寄出驗證信，請至信箱收信完成註冊後再登入。
        </p>
      )}
      {params.error && (
        <p className="border-destructive/30 bg-destructive/5 text-destructive mb-4 rounded-lg border p-3 text-sm">
          {params.error}
        </p>
      )}

      <form className="flex flex-col gap-4">
        {params.next && <input type="hidden" name="next" value={params.next} />}
        <Field label="顯示名稱（選填，僅註冊時使用）">
          <input
            name="displayName"
            type="text"
            autoComplete="nickname"
            className="bg-card border-border w-full rounded-lg border px-3 py-2.5 text-sm"
          />
        </Field>

        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="bg-card border-border w-full rounded-lg border px-3 py-2.5 text-sm"
          />
        </Field>

        <Field label="密碼">
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            className="bg-card border-border w-full rounded-lg border px-3 py-2.5 text-sm"
          />
        </Field>

        <div className="mt-2 flex flex-col gap-2">
          <button
            formAction={login}
            className="bg-primary text-primary-foreground rounded-lg py-3 text-sm font-medium"
          >
            登入
          </button>
          <button
            formAction={signup}
            className="border-border rounded-lg border py-3 text-sm font-medium"
          >
            註冊新帳號
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

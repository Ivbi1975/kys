import { useState } from "react";

const CORRECT_PASSWORD = "Muratabi12.";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => {
    return sessionStorage.getItem("app_unlocked") === "true";
  });
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password1 || !password2) {
      setError("Lütfen her iki şifreyi de girin.");
      return;
    }

    if (password1 !== CORRECT_PASSWORD || password2 !== CORRECT_PASSWORD) {
      setError("Şifre hatalı. Lütfen tekrar deneyin.");
      return;
    }

    sessionStorage.setItem("app_unlocked", "true");
    setUnlocked(true);
  };

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 w-full max-w-md space-y-6 border border-green-200 dark:border-gray-700"
      >
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-green-800 dark:text-green-400">
            Kurban Hisse Kağıdı
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Devam etmek için şifreleri girin
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              1. Şifre
            </label>
            <input
              type="password"
              value={password1}
              onChange={(e) => setPassword1(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              placeholder="1. şifreyi girin"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              2. Şifre
            </label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
              placeholder="2. şifreyi girin"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center font-medium">{error}</p>
        )}

        <button
          type="submit"
          className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow-md"
        >
          Giriş Yap
        </button>
      </form>
    </div>
  );
}

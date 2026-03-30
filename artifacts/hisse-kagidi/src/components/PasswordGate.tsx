import { useState, useEffect } from "react";
import { fetchPhotoToken } from "@/lib/api";

const API_BASE = import.meta.env.BASE_URL
  ? `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/").replace(/\/$/, "")
  : "/api";

const DORTLUKLER = [
  "Hâtırası gönüllerde yaşar, ismi dillerde,\nMurat Abi namı gezer her bir mecliste,\nKadrini bilmeyen kalır daim müşkilde,\nHürmet etmeyen kalır kahvesiz elde.",
  "Hâtırası gönüllerde yaşar, ismi dillerde,\nMurat Abi adı anılır her bir sözde,\nKıymet bilmeyen kalır kendi derdinde,\nHürmet etmeyen kalır çaysız elde.",
  "Sözleri ibret olur, dolaşır dillerde,\nMurat Abi namı anılır her yerde,\nBir dokunuşla açar düğümü en derinde,\nMeseleler bir bir delip geçer önünde.",
  "Hikmeti derin olur, sözü hep yerinde,\nMurat Abi adı parlar her bir ilminde,\nEl uzatsa çözülür en müşkil bir anda,\nSetler dahi delip açılır yol önünde.",
  "İşi düşen bulur çâre onun izinde,\nMurat Abi nâmı yankı bulur her yerde,\nBir bakışı kifâyet eder nice müşkile,\nDağlar bile delip yol verir önünde.",
  "Ferâseti yol gösterir karanlık her hâlde,\nMurat Abi sözü ölçü olur her sözde,\nÇetin işler erir gider bir anda özünde,\nTaşlar dahi delip çözülür önünde.",
  "Himmeti yetişir en dar vakit her derde,\nMurat Abi yâdı düşmez hiçbir dilden de,\nBir iş varsa nihâyet bulur onun izinde,\nDuvarlar bile delip eğilir önünde.",
];

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => {
    return sessionStorage.getItem("app_unlocked") === "true";
  });
  const [dortluk] = useState(() => DORTLUKLER[Math.floor(Math.random() * DORTLUKLER.length)]);
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password1 || !password2) {
      setError("Lütfen her iki şifreyi de girin.");
      return;
    }

    if (password1 !== password2) {
      setError("Şifreler eşleşmiyor.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password1 }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Bağlantı hatası." }));
        setError(data.error || "Şifre hatalı. Lütfen tekrar deneyin.");
        return;
      }

      const data = await res.json();
      sessionStorage.setItem("app_unlocked", "true");
      sessionStorage.setItem("app_api_key", data.apiKey);
      fetchPhotoToken().catch(() => {});
      setUnlocked(true);
    } catch {
      setError("Sunucuya bağlanılamadı. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (unlocked) {
      fetchPhotoToken().catch(() => {});
    }
  }, [unlocked]);

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-green-100 dark:from-gray-900 dark:to-gray-800 p-4">
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
            <div className="relative">
              <input
                type={showPassword1 ? "text" : "password"}
                value={password1}
                onChange={(e) => setPassword1(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                placeholder="1. şifreyi girin"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword1(!showPassword1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                aria-label={showPassword1 ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                <EyeIcon open={showPassword1} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              2. Şifre
            </label>
            <div className="relative">
              <input
                type={showPassword2 ? "text" : "password"}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition"
                placeholder="2. şifreyi girin"
              />
              <button
                type="button"
                onClick={() => setShowPassword2(!showPassword2)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                aria-label={showPassword2 ? "Şifreyi gizle" : "Şifreyi göster"}
              >
                <EyeIcon open={showPassword2} />
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center font-medium">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-lg transition-colors shadow-md"
        >
          {loading ? "Doğrulanıyor..." : "Giriş Yap"}
        </button>
      </form>

        <div className="mt-6 max-w-md w-full text-center px-4">
          <p className="italic text-green-700/70 dark:text-green-400/60 text-sm leading-relaxed whitespace-pre-line font-serif">
            {dortluk}
          </p>
        </div>
    </div>
  );
}

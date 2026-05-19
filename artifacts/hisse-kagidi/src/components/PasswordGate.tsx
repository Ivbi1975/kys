import { useState, useEffect } from "react";
import { fetchPhotoToken } from "@/lib/api";
import { API_BASE } from "@/lib/api-base";

const DORTLUKLER = [
  "Hâtırası gönüllerde yaşar, ismi dillerde,\nMurat Abi namı gezer her bir mecliste,\nKadrini bilmeyen kalır daim müşkilde,\nHürmet etmeyen kalır kahvesiz elde.",
  "Hâtırası gönüllerde yaşar, ismi dillerde,\nMurat Abi adı anılır her bir sözde,\nKıymet bilmeyen kalır kendi derdinde,\nHürmet etmeyen kalır çaysız elde.",
  "Sözleri ibret olur, dolaşır dillerde,\nMurat Abi namı anılır her yerde,\nBir dokunuşla açar düğümü en derinde,\nMeseleler bir bir delip geçer önünde.",
  "Hikmeti derin olur, sözü hep yerinde,\nMurat Abi adı parlar her bir ilminde,\nEl uzatsa çözülür en müşkil bir anda,\nSetler dahi delip açılır yol önünde.",
  "İşi düşen bulur çâre onun izinde,\nMurat Abi nâmı yankı bulur her yerde,\nBir bakışı kifâyet eder nice müşkile,\nDağlar bile delip yol verir önünde.",
  "Ferâseti yol gösterir karanlık her hâlde,\nMurat Abi sözü ölçü olur her sözde,\nÇetin işler erir gider bir anda özünde,\nTaşlar dahi delip çözülür önünde.",
  "Himmeti yetişir en dar vakit her derde,\nMurat Abi yâdı düşmez hiçbir dilden de,\nBir iş varsa nihâyet bulur onun izinde,\nDuvarlar bile delip eğilir önünde.",
];

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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
  const [focus1, setFocus1] = useState(false);
  const [focus2, setFocus2] = useState(false);

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
      const sessionToken = data.token;
      if (!sessionToken) {
        setError("Sunucu geçerli bir oturum token'ı döndürmedi.");
        return;
      }
      sessionStorage.setItem("app_unlocked", "true");
      sessionStorage.setItem("app_session_token", sessionToken);
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
    <>
      <style>{`
        @keyframes cardEnter {
          from { opacity: 0; transform: translateY(14px) scale(0.985); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        .pg-card { animation: cardEnter 0.42s cubic-bezier(0.22,1,0.36,1) both; }
        .pg-btn:not(:disabled):hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
          box-shadow: 0 22px 44px rgba(0,217,111,0.30), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .pg-btn:not(:disabled):active {
          transform: translateY(0);
          filter: brightness(0.97);
        }
        .pg-eye:hover { color: #d7e2f1; }
      `}</style>

      <main
        style={{
          minHeight: "100svh",
          background: `
            radial-gradient(circle at 80% 15%, rgba(0,255,170,0.13), transparent 28%),
            radial-gradient(circle at 15% 85%, rgba(0,190,255,0.08), transparent 32%),
            linear-gradient(135deg, #07111f 0%, #101b2c 45%, #07101c 100%)
          `,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#f4f7fb",
          overflowX: "hidden",
        }}
      >
        <section style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", alignItems: "center" }}>

          {/* Card */}
          <form
            onSubmit={handleSubmit}
            className="pg-card"
            style={{
              width: "100%",
              background: "rgba(8,17,31,0.75)",
              border: "1px solid rgba(148,163,184,0.20)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.04)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: 28,
              padding: "clamp(28px, 6vw, 52px) clamp(22px, 8vw, 56px)",
            }}
          >
            {/* Emblem */}
            <div style={{
              width: 68,
              height: 68,
              borderRadius: 999,
              display: "grid",
              placeItems: "center",
              margin: "0 auto 22px",
              background: "rgba(16,185,129,0.08)",
              border: "1px solid rgba(16,185,129,0.32)",
              boxShadow: "0 0 28px rgba(16,185,129,0.14)",
              color: "#22e38f",
            }}>
              <ShieldIcon />
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: "clamp(26px, 5vw, 40px)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              color: "#22e38f",
              textAlign: "center",
              margin: 0,
            }}>
              Kurban Hisse Kağıdı
            </h1>

            {/* Subtitle */}
            <p style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: "#b8c4d6",
              textAlign: "center",
              margin: "10px 0 0",
            }}>
              Devam etmek için şifreleri girin
            </p>

            {/* Divider */}
            <div style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(148,163,184,0.22), transparent)",
              margin: "28px 0",
            }} />

            {/* Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Password 1 */}
              <div>
                <label style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#e5edf7",
                  marginBottom: 9,
                  letterSpacing: "0.01em",
                }}>
                  1. Şifre
                </label>
                <div style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  height: 60,
                  borderRadius: 14,
                  background: focus1 ? "rgba(15,27,45,0.96)" : "rgba(15,27,45,0.82)",
                  border: `1px solid ${error && !password1 ? "rgba(239,68,68,0.55)" : focus1 ? "rgba(34,227,143,0.55)" : "rgba(148,163,184,0.26)"}`,
                  boxShadow: focus1 ? "0 0 0 4px rgba(34,227,143,0.09)" : "none",
                  transition: "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
                }}>
                  <span style={{ position: "absolute", left: 18, color: focus1 ? "#22e38f" : "#7a90a8", transition: "color 160ms ease", pointerEvents: "none" }}>
                    <LockIcon />
                  </span>
                  <input
                    type={showPassword1 ? "text" : "password"}
                    value={password1}
                    onChange={(e) => setPassword1(e.target.value)}
                    onFocus={() => setFocus1(true)}
                    onBlur={() => setFocus1(false)}
                    placeholder="1. şifreyi girin"
                    autoComplete="new-password"
                    autoFocus
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "transparent",
                      border: 0,
                      outline: 0,
                      color: "#f4f7fb",
                      fontSize: 16,
                      padding: "0 54px 0 50px",
                      fontFamily: "inherit",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword1(!showPassword1)}
                    aria-label={showPassword1 ? "1. şifreyi gizle" : "1. şifreyi göster"}
                    className="pg-eye"
                    style={{
                      position: "absolute",
                      right: 18,
                      background: "none",
                      border: 0,
                      padding: 0,
                      cursor: "pointer",
                      color: "#7a90a8",
                      display: "flex",
                      transition: "color 160ms ease",
                    }}
                  >
                    <EyeIcon open={showPassword1} />
                  </button>
                </div>
              </div>

              {/* Password 2 */}
              <div>
                <label style={{
                  display: "block",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#e5edf7",
                  marginBottom: 9,
                  letterSpacing: "0.01em",
                }}>
                  2. Şifre
                </label>
                <div style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  height: 60,
                  borderRadius: 14,
                  background: focus2 ? "rgba(15,27,45,0.96)" : "rgba(15,27,45,0.82)",
                  border: `1px solid ${error && !password2 ? "rgba(239,68,68,0.55)" : focus2 ? "rgba(34,227,143,0.55)" : "rgba(148,163,184,0.26)"}`,
                  boxShadow: focus2 ? "0 0 0 4px rgba(34,227,143,0.09)" : "none",
                  transition: "border-color 160ms ease, box-shadow 160ms ease, background 160ms ease",
                }}>
                  <span style={{ position: "absolute", left: 18, color: focus2 ? "#22e38f" : "#7a90a8", transition: "color 160ms ease", pointerEvents: "none" }}>
                    <LockIcon />
                  </span>
                  <input
                    type={showPassword2 ? "text" : "password"}
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    onFocus={() => setFocus2(true)}
                    onBlur={() => setFocus2(false)}
                    placeholder="2. şifreyi girin"
                    autoComplete="new-password"
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "transparent",
                      border: 0,
                      outline: 0,
                      color: "#f4f7fb",
                      fontSize: 16,
                      padding: "0 54px 0 50px",
                      fontFamily: "inherit",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword2(!showPassword2)}
                    aria-label={showPassword2 ? "2. şifreyi gizle" : "2. şifreyi göster"}
                    className="pg-eye"
                    style={{
                      position: "absolute",
                      right: 18,
                      background: "none",
                      border: 0,
                      padding: 0,
                      cursor: "pointer",
                      color: "#7a90a8",
                      display: "flex",
                      transition: "color 160ms ease",
                    }}
                  >
                    <EyeIcon open={showPassword2} />
                  </button>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: 20,
                background: "rgba(239,68,68,0.09)",
                border: "1px solid rgba(239,68,68,0.26)",
                color: "#fecaca",
                borderRadius: 12,
                padding: "11px 14px",
                fontSize: 14,
                textAlign: "center",
                lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="pg-btn"
              style={{
                marginTop: 28,
                width: "100%",
                height: 60,
                border: "none",
                borderRadius: 14,
                background: loading
                  ? "rgba(0,185,86,0.55)"
                  : "linear-gradient(135deg, #00b956 0%, #00d96f 55%, #18e38a 100%)",
                color: "#fff",
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                boxShadow: loading ? "none" : "0 18px 36px rgba(0,217,111,0.20), inset 0 1px 0 rgba(255,255,255,0.16)",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease",
                fontFamily: "inherit",
              }}
            >
              {loading ? "Doğrulanıyor..." : "Giriş Yap"}
            </button>
          </form>

          {/* Poem */}
          <div style={{ marginTop: 32, width: "100%", maxWidth: 480, textAlign: "center" }}>
            <div style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(34,227,143,0.38), transparent)",
              marginBottom: 16,
            }} />
            <p style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: "italic",
              fontSize: "clamp(13px, 2.2vw, 15px)",
              lineHeight: 1.7,
              color: "rgba(34,227,143,0.65)",
              letterSpacing: "0.01em",
              margin: 0,
              whiteSpace: "pre-line",
            }}>
              {dortluk}
            </p>
            <div style={{
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(34,227,143,0.38), transparent)",
              marginTop: 16,
            }} />
          </div>

        </section>
      </main>
    </>
  );
}

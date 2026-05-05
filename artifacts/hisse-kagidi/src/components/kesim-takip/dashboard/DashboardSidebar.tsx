import { useState, useRef, useEffect } from "react";
import {
  Scissors, ClipboardList, BarChart2, StickyNote, X, Menu, Pencil, Check,
} from "lucide-react";

const ORG_NAME_KEY = "kesim-takip-org-name";
const DEFAULT_ORG = "İhlas Vakfı";

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

interface NavItem {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; "aria-hidden"?: boolean }>;
  label: string;
  action: "list" | "report" | "notes";
}

const NAV_ITEMS: NavItem[] = [
  { icon: ClipboardList, label: "Kesim Listesi", action: "list" },
  { icon: BarChart2, label: "Raporlar", action: "report" },
  { icon: StickyNote, label: "Notlar", action: "notes" },
];

interface DashboardSidebarProps {
  open: boolean;
  onClose: () => void;
  activeAction: "list" | "report" | "notes";
  onNav: (action: "list" | "report" | "notes") => void;
}

export function DashboardSidebar({ open, onClose, activeAction, onNav }: DashboardSidebarProps) {
  const [orgName, setOrgName] = useState<string>(() =>
    localStorage.getItem(ORG_NAME_KEY) || DEFAULT_ORG
  );
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(orgName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    const final = trimmed || DEFAULT_ORG;
    setOrgName(final);
    localStorage.setItem(ORG_NAME_KEY, final);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") { setEditValue(orgName); setEditing(false); }
  };

  const startEditing = () => {
    setEditValue(orgName);
    setEditing(true);
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col w-[260px] shrink-0 transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "#071522", borderRight: "1px solid rgba(148,163,184,0.10)" }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5 border-b"
          style={{ borderColor: "rgba(148,163,184,0.10)" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
            style={{ background: "rgba(0,201,134,0.16)" }}
          >
            <img src="/kurban-logo.png" alt="Logo" className="w-5 h-5 object-contain" style={{ filter: "invert(1) sepia(1) saturate(3) hue-rotate(110deg) brightness(1.1)" }} />
          </div>
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: "#f8fafc" }}>KESİM TAKİP</p>
            <p className="text-[10px] tracking-widest" style={{ color: "#94a3b8" }}>SİSTEMİ</p>
          </div>
          <button
            className="ml-auto lg:hidden p-1 rounded-lg hover:bg-white/10 transition-colors"
            onClick={onClose}
            aria-label="Menüyü kapat"
          >
            <X className="w-4 h-4" style={{ color: "#94a3b8" }} aria-hidden />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ icon: Icon, label, action }) => {
            const active = activeAction === action;
            return (
              <button
                key={action}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                style={
                  active
                    ? {
                        background: "linear-gradient(90deg, rgba(0,201,134,0.16), rgba(0,201,134,0.04))",
                        borderLeft: "3px solid #00c986",
                        color: "#00c986",
                        paddingLeft: "9px",
                      }
                    : {
                        color: "#94a3b8",
                        borderLeft: "3px solid transparent",
                        paddingLeft: "9px",
                      }
                }
                onClick={() => { onNav(action); if (open) onClose(); }}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Profile / Org */}
        <div
          className="px-4 py-4 border-t"
          style={{ borderColor: "rgba(148,163,184,0.10)" }}
        >
          <div className="flex items-center gap-3 group">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none"
              style={{ background: "rgba(0,201,134,0.20)", color: "#00c986" }}
              aria-hidden
            >
              {getInitials(orgName)}
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleSave}
                    className="flex-1 min-w-0 text-xs font-semibold rounded-md px-1 py-0.5 outline-none"
                    style={{
                      background: "rgba(148,163,184,0.12)",
                      color: "#f8fafc",
                      border: "1px solid rgba(0,201,134,0.40)",
                    }}
                    aria-label="Kurum adını düzenle"
                    maxLength={40}
                  />
                  <button
                    onClick={handleSave}
                    className="shrink-0 w-5 h-5 flex items-center justify-center rounded"
                    style={{ color: "#00c986" }}
                    aria-label="Kaydet"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold truncate" style={{ color: "#f8fafc" }}>{orgName}</p>
                  <button
                    onClick={startEditing}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                    style={{ color: "#94a3b8" }}
                    aria-label="Kurum adını değiştir"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
              <p className="text-[10px] truncate" style={{ color: "#94a3b8" }}>Ekip Yöneticisi</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export function SidebarToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="lg:hidden p-2 rounded-xl transition-colors"
      style={{ color: "#94a3b8" }}
      onClick={onClick}
      aria-label="Menüyü aç"
    >
      <Menu className="w-5 h-5" aria-hidden />
    </button>
  );
}

import {
  Scissors, LayoutDashboard, FolderOpen, Beef,
  ClipboardList, BarChart2, StickyNote, Calendar,
  Users, Settings, X, Menu,
} from "lucide-react";

const NAV_ITEMS = [
  { icon: ClipboardList, label: "Kesim Listesi", active: true },
  { icon: LayoutDashboard, label: "Kontrol Paneli", active: false },
  { icon: FolderOpen, label: "Projeler", active: false },
  { icon: Beef, label: "Hayvanlar", active: false },
  { icon: Scissors, label: "Kesim İşlemleri", active: false },
  { icon: BarChart2, label: "Raporlar", active: false },
  { icon: StickyNote, label: "Notlar", active: false },
  { icon: Calendar, label: "Takvim", active: false },
  { icon: Users, label: "Kullanıcılar", active: false },
  { icon: Settings, label: "Ayarlar", active: false },
];

interface DashboardSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function DashboardSidebar({ open, onClose }: DashboardSidebarProps) {
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
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "rgba(148,163,184,0.10)" }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(0,201,134,0.16)" }}
          >
            <Scissors className="w-4.5 h-4.5" style={{ color: "#00c986" }} />
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
            <X className="w-4 h-4" style={{ color: "#94a3b8" }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
            <button
              key={label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                active
                  ? "border-l-[3px]"
                  : "hover:bg-white/5"
              }`}
              style={
                active
                  ? {
                      background: "linear-gradient(90deg, rgba(0,201,134,0.16), rgba(0,201,134,0.04))",
                      borderLeftColor: "#00c986",
                      color: "#00c986",
                    }
                  : { color: "#94a3b8", borderLeft: "3px solid transparent" }
              }
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>

        {/* Profile */}
        <div
          className="px-4 py-4 border-t"
          style={{ borderColor: "rgba(148,163,184,0.10)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "rgba(0,201,134,0.20)", color: "#00c986" }}
            >
              HC
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: "#f8fafc" }}>HC Çiftliği</p>
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
      <Menu className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

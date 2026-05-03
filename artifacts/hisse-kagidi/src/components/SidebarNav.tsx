import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ChevronDown, ChevronRight, FolderOpen,
  PanelLeftClose, Home, Trash2,
  BookOpen, Layers, Scissors
} from "lucide-react";
import { fetchHomeData } from "@/lib/api/projects";
import type { HomeData } from "@/lib/api/projects";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function useHomeData() {
  const [data, setData] = useState<HomeData | null>(null);
  const load = useCallback(() => {
    fetchHomeData().then(setData).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  return data;
}

interface SidebarNavProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SidebarNav({ collapsed, onToggle }: SidebarNavProps) {
  const homeData = useHomeData();
  const [location, navigate] = useLocation();
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set());

  const activeProjectId =
    location.match(/^\/proje\/([^/]+)/)?.[1] ||
    location.match(/^\/bagis-havuzu\/([^/]+)/)?.[1] ||
    null;
  const activeKesimId = location.match(/^\/kesim\/([^/]+)/)?.[1] || null;

  useEffect(() => {
    if (!homeData) return;
    setOpenProjects(prev => {
      const next = new Set(prev);
      if (activeProjectId) next.add(activeProjectId);
      if (activeKesimId) {
        const ka = homeData.kesimAlanlari.find(k => k.id === activeKesimId);
        if (ka?.projectId) next.add(ka.projectId);
      }
      return next;
    });
  }, [activeProjectId, activeKesimId, homeData]);

  const toggleProject = (id: string) => {
    setOpenProjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const go = (path: string) => navigate(path);

  const sidebarBase = cn(
    "flex flex-col border-r flex-shrink-0 overflow-hidden",
    "transition-[width] duration-300 ease-in-out",
    "bg-[hsl(222,47%,8%)] border-[hsl(222,40%,13%)]",
    collapsed ? "w-[52px]" : "w-[220px]"
  );

  const activeProjects = homeData?.projects.filter(p => !p.deletedAt && !p.archivedAt) ?? [];
  const getKesimForProject = (projectId: string) =>
    homeData?.kesimAlanlari.filter(k => k.projectId === projectId && !k.deletedAt) ?? [];
  const orphanKesim = homeData?.kesimAlanlari.filter(k => !k.projectId && !k.deletedAt && k.name !== "__havuz__") ?? [];

  return (
    <aside className={sidebarBase}>
      <SidebarHeader collapsed={collapsed} onToggle={onToggle} />

      <nav className="flex-1 overflow-y-auto overflow-x-hidden thin-scrollbar flex flex-col py-2 gap-1">

        {/* Ana Sayfa */}
        <div className="px-2">
          <NavItem
            collapsed={collapsed}
            icon={<Home className="h-[15px] w-[15px]" />}
            label="Ana Sayfa"
            active={location === "/" || location === ""}
            onClick={() => go("/")}
          />
        </div>

        {/* Projeler */}
        {activeProjects.length > 0 && (
          <div className="mt-1">
            <SectionLabel icon={<FolderOpen className="h-3 w-3" />} label="Projeler" collapsed={collapsed} />
            <div className="px-2 mt-1 space-y-0.5">
              {activeProjects.map(project => {
                const kesimList = getKesimForProject(project.id);
                const isOpen = openProjects.has(project.id);
                const isProjectActive = activeProjectId === project.id;

                return (
                  <div key={project.id}>
                    {/* Project row */}
                    <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-0.5")}>
                      {!collapsed && (
                        <button
                          className="flex-shrink-0 w-5 h-[30px] flex items-center justify-center rounded-md text-white/20 hover:text-white/50 hover:bg-white/5 transition-all duration-150"
                          onClick={() => toggleProject(project.id)}
                        >
                          {isOpen
                            ? <ChevronDown className="h-3 w-3" />
                            : <ChevronRight className="h-3 w-3" />}
                        </button>
                      )}
                      <NavItem
                        collapsed={collapsed}
                        icon={<FolderOpen className="h-[15px] w-[15px]" />}
                        label={project.name}
                        active={isProjectActive}
                        onClick={() => {
                          go(`/proje/${project.id}`);
                          if (!isOpen) toggleProject(project.id);
                        }}
                        className="flex-1 min-w-0"
                        badge={!collapsed && !isOpen && kesimList.length > 0 ? String(kesimList.length) : undefined}
                      />
                    </div>

                    {/* Expanded kesim list */}
                    {!collapsed && isOpen && (
                      <div className="ml-[22px] mt-0.5 mb-1 pl-3 border-l border-white/[0.07] space-y-0.5">
                        {kesimList.map(ka => (
                          <NavItem
                            key={ka.id}
                            collapsed={false}
                            icon={
                              <span className="h-[14px] w-[14px] flex-shrink-0 flex items-center justify-center">
                                <img src="/kurban-logo.png" alt="" className="h-[13px] w-[13px] object-contain opacity-50" />
                              </span>
                            }
                            label={ka.name}
                            active={activeKesimId === ka.id}
                            onClick={() => go(`/kesim/${ka.id}`)}
                            small
                          />
                        ))}
                        {kesimList.length === 0 && (
                          <p className="text-[11px] text-white/18 px-2 py-1.5 italic">Kesim alanı yok</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bağımsız kesimler */}
        {orphanKesim.length > 0 && (
          <div className="mt-1">
            <SectionLabel icon={<Scissors className="h-3 w-3" />} label="Bağımsız" collapsed={collapsed} />
            <div className="px-2 mt-1 space-y-0.5">
              {orphanKesim.map(ka => (
                <NavItem
                  key={ka.id}
                  collapsed={collapsed}
                  icon={<Layers className="h-[15px] w-[15px]" />}
                  label={ka.name}
                  active={activeKesimId === ka.id}
                  onClick={() => go(`/kesim/${ka.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 min-h-4" />

        {/* Footer links */}
        <div className="px-2 pb-2">
          <div className="h-px bg-white/[0.06] mb-2" />
          <div className="space-y-0.5">
            <NavItem
              collapsed={collapsed}
              icon={<BookOpen className="h-[15px] w-[15px]" />}
              label="API Dokümantasyon"
              active={location === "/api-dokumantasyon"}
              onClick={() => go("/api-dokumantasyon")}
              muted
            />
            <NavItem
              collapsed={collapsed}
              icon={<Trash2 className="h-[15px] w-[15px]" />}
              label="Çöp Kutusu"
              active={location === "/cop-kutusu"}
              onClick={() => go("/cop-kutusu")}
              muted
            />
          </div>
        </div>
      </nav>
    </aside>
  );
}

function SidebarHeader({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className={cn(
      "flex items-center h-[52px] flex-shrink-0 border-b border-[hsl(222,40%,13%)]",
      collapsed ? "flex-col justify-center gap-1 px-0" : "justify-between px-3"
    )}>
      {collapsed ? (
        <button
          onClick={onToggle}
          className="w-[34px] h-[34px] rounded-lg bg-primary/15 ring-1 ring-primary/20 flex items-center justify-center hover:bg-primary/22 transition-all duration-150"
        >
          <img src="/kurban-logo.png" alt="" className="h-[15px] w-[15px] object-contain" />
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-[28px] h-[28px] rounded-lg bg-primary/15 ring-1 ring-primary/20 flex items-center justify-center flex-shrink-0">
              <img src="/kurban-logo.png" alt="" className="h-[14px] w-[14px] object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-white/80 leading-none tracking-wide">KYS</p>
              <p className="text-[9px] text-white/25 tracking-[0.12em] uppercase leading-none mt-[3px]">Kurban Yönetim</p>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="h-7 w-7 rounded-md flex items-center justify-center text-white/22 hover:text-white/55 hover:bg-white/[0.06] transition-all duration-150 flex-shrink-0"
          >
            <PanelLeftClose className="h-[14px] w-[14px]" />
          </button>
        </>
      )}
    </div>
  );
}

function SectionLabel({ icon, label, collapsed }: { icon: React.ReactNode; label: string; collapsed: boolean }) {
  if (collapsed) return <div className="h-1" />;
  return (
    <div className="flex items-center gap-2 px-3 mb-0.5">
      <span className="text-white/20">{icon}</span>
      <span className="text-[9.5px] font-semibold text-white/22 uppercase tracking-[0.13em]">{label}</span>
    </div>
  );
}

interface NavItemProps {
  collapsed: boolean;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  className?: string;
  small?: boolean;
  muted?: boolean;
  badge?: string;
}

function NavItem({ collapsed, icon, label, active, onClick, className, small, muted, badge }: NavItemProps) {
  const button = (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex items-center w-full rounded-lg text-left select-none",
        "transition-all duration-150",
        small ? "gap-2 px-2 py-[5px]" : "gap-2.5 px-2.5 py-[7px]",
        active
          ? "bg-primary/[0.14] text-white"
          : muted
            ? "text-white/28 hover:text-white/55 hover:bg-white/[0.04]"
            : "text-white/50 hover:text-white/85 hover:bg-white/[0.05]",
        collapsed && "justify-center px-0 py-[9px]",
        className
      )}
    >
      {active && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-r-full bg-primary" />
      )}
      <span className={cn(
        "flex-shrink-0 transition-colors duration-150",
        active
          ? "text-primary"
          : muted
            ? "text-white/22 group-hover:text-white/40"
            : "text-white/35 group-hover:text-white/65"
      )}>
        {icon}
      </span>
      {!collapsed && (
        <span className={cn(
          "flex-1 truncate leading-none",
          small ? "text-[12px]" : "text-[13px]",
          active ? "font-medium" : "font-normal"
        )}>
          {label}
        </span>
      )}
      {!collapsed && badge && (
        <span className="ml-auto flex-shrink-0 text-[10px] font-medium text-white/25 bg-white/[0.07] rounded-full px-1.5 py-0.5 leading-none">
          {badge}
        </span>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="text-[12px] font-medium">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ChevronDown, ChevronRight, FolderOpen, Inbox,
  PanelLeftClose, PanelLeftOpen, Home, Trash2, Scissors, BookOpen
} from "lucide-react";
import { fetchHomeData } from "@/lib/api/projects";
import type { HomeData } from "@/lib/api/projects";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
    "flex flex-col border-r transition-all duration-200 overflow-hidden flex-shrink-0",
    "bg-[hsl(224,50%,9%)] border-[hsl(224,50%,14%)]",
    collapsed ? "w-12" : "w-64"
  );

  if (!homeData) {
    return (
      <aside className={sidebarBase}>
        <SidebarHeader collapsed={collapsed} onToggle={onToggle} />
      </aside>
    );
  }

  const activeProjects = homeData.projects.filter(p => !p.deletedAt && !p.archivedAt);
  const getKesimForProject = (projectId: string) =>
    homeData.kesimAlanlari.filter(k => k.projectId === projectId && !k.deletedAt);
  const orphanKesim = homeData.kesimAlanlari.filter(k => !k.projectId && !k.deletedAt && k.name !== "__havuz__");

  return (
    <aside className={sidebarBase}>
      <SidebarHeader collapsed={collapsed} onToggle={onToggle} />

      <nav className="flex-1 overflow-y-auto thin-scrollbar py-3 px-2 flex flex-col gap-0.5">

        {/* Ana Sayfa */}
        <NavItem
          collapsed={collapsed}
          icon={<Home className="h-4 w-4 flex-shrink-0" />}
          label="Ana Sayfa"
          active={location === "/" || location === ""}
          onClick={() => go("/")}
        />

        {/* Bağış Havuzları */}
        {activeProjects.length > 0 && (
          <>
            <SectionLabel icon={<Inbox className="h-3 w-3" />} label="Bağış Havuzları" collapsed={collapsed} />
            {activeProjects.map(project => (
              <NavItem
                key={`havuz-${project.id}`}
                collapsed={collapsed}
                icon={<Inbox className="h-4 w-4 flex-shrink-0" />}
                label={project.name}
                active={location === `/bagis-havuzu/${project.id}`}
                onClick={() => go(`/bagis-havuzu/${project.id}`)}
                indent
              />
            ))}
          </>
        )}

        {/* Projeler */}
        {activeProjects.length > 0 && (
          <>
            <SectionLabel icon={<FolderOpen className="h-3 w-3" />} label="Projeler" collapsed={collapsed} />
            {activeProjects.map(project => {
              const kesimList = getKesimForProject(project.id);
              const isOpen = openProjects.has(project.id);
              const isProjectActive = activeProjectId === project.id;
              return (
                <div key={project.id}>
                  <div className={cn("flex items-center gap-0.5", collapsed ? "justify-center" : "")}>
                    {!collapsed && (
                      <button
                        className="flex-shrink-0 w-5 h-7 flex items-center justify-center rounded text-white/25 hover:text-white/55 hover:bg-white/5 transition-colors"
                        onClick={() => toggleProject(project.id)}
                      >
                        {isOpen
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <NavItem
                      collapsed={collapsed}
                      icon={<FolderOpen className="h-4 w-4 flex-shrink-0" />}
                      label={project.name}
                      active={isProjectActive}
                      onClick={() => {
                        go(`/proje/${project.id}`);
                        if (!isOpen) toggleProject(project.id);
                      }}
                      className="flex-1 min-w-0"
                    />
                  </div>

                  {!collapsed && isOpen && (
                    <div className="ml-5 mt-0.5 mb-1 space-y-0.5 border-l-2 border-white/8 pl-2">
                      {kesimList.map(ka => (
                        <NavItem
                          key={ka.id}
                          collapsed={false}
                          icon={<img src="/kurban-logo.png" alt="" className="h-3.5 w-3.5 flex-shrink-0 object-contain opacity-60" />}
                          label={ka.name}
                          active={activeKesimId === ka.id}
                          onClick={() => go(`/kesim/${ka.id}`)}
                          small
                        />
                      ))}
                      {kesimList.length === 0 && (
                        <p className="text-[11px] text-white/20 px-2 py-1.5 italic">Kesim alanı yok</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Bağımsız Kesim Alanları */}
        {orphanKesim.length > 0 && (
          <>
            <SectionLabel icon={<Scissors className="h-3 w-3" />} label="Bağımsız Kesim Alanları" collapsed={collapsed} />
            {orphanKesim.map(ka => (
              <NavItem
                key={ka.id}
                collapsed={collapsed}
                icon={<img src="/kurban-logo.png" alt="" className="h-4 w-4 flex-shrink-0 object-contain opacity-70" />}
                label={ka.name}
                active={activeKesimId === ka.id}
                onClick={() => go(`/kesim/${ka.id}`)}
                indent
              />
            ))}
          </>
        )}

        {/* Boşluk bırak */}
        <div className="flex-1" />

        {/* Ayırıcı + Alt Menü */}
        <div className="mt-2 pt-2 border-t border-white/8 space-y-0.5">
          <NavItem
            collapsed={collapsed}
            icon={<BookOpen className="h-4 w-4 flex-shrink-0" />}
            label="API Dokümantasyon"
            active={location === "/api-dokumantasyon"}
            onClick={() => go("/api-dokumantasyon")}
            muted
          />
          <NavItem
            collapsed={collapsed}
            icon={<Trash2 className="h-4 w-4 flex-shrink-0" />}
            label="Çöp Kutusu"
            active={location === "/cop-kutusu"}
            onClick={() => go("/cop-kutusu")}
            muted
          />
        </div>
      </nav>
    </aside>
  );
}

function SidebarHeader({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <div className={cn(
      "flex items-center border-b border-[hsl(224,50%,14%)] h-12 flex-shrink-0 gap-2",
      collapsed ? "justify-center px-0" : "justify-between px-3"
    )}>
      {!collapsed && (
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
            <img src="/kurban-logo.png" alt="" className="h-3 w-3 object-contain opacity-90" />
          </div>
          <span className="text-[11px] font-bold text-white/50 uppercase tracking-[0.15em]">Gezgin</span>
        </div>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white/35 hover:text-white/75 hover:bg-white/6 transition-colors"
        onClick={onToggle}
      >
        {collapsed
          ? <PanelLeftOpen className="h-4 w-4" />
          : <PanelLeftClose className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function SectionLabel({ icon, label, collapsed }: { icon: React.ReactNode; label: string; collapsed: boolean }) {
  if (collapsed) return <div className="h-3" />;
  return (
    <div className="flex items-center gap-1.5 px-2 pt-3 pb-1">
      <span className="text-white/25">{icon}</span>
      <span className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.12em]">{label}</span>
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
  indent?: boolean;
}

function NavItem({ collapsed, icon, label, active, onClick, className, small, muted, indent }: NavItemProps) {
  const button = (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 w-full rounded-lg text-left transition-all duration-150 select-none relative",
        small
          ? "px-2 py-1.5 text-[13px]"
          : "px-2.5 py-2 text-[13.5px]",
        active && [
          "bg-primary/15 text-white font-medium",
          "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
          "before:h-5 before:w-[3px] before:rounded-r-full before:bg-primary",
        ],
        !active && muted && "text-white/30 hover:text-white/55 hover:bg-white/5",
        !active && !muted && "text-white/55 hover:text-white/90 hover:bg-white/7",
        indent && !collapsed && "pl-3.5",
        collapsed && "justify-center px-0 py-2.5",
        className
      )}
    >
      <span className={cn(
        "flex-shrink-0",
        active ? "text-primary" : muted ? "text-white/25" : "text-white/40"
      )}>
        {icon}
      </span>
      {!collapsed && <span className="truncate leading-tight">{label}</span>}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="text-sm font-medium">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

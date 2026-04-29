import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { ChevronDown, ChevronRight, FolderOpen, Inbox, PanelLeftClose, PanelLeftOpen, Home, Trash2 } from "lucide-react";
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

  if (!homeData) {
    return (
      <aside className={cn("flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-200", collapsed ? "w-12" : "w-60")}>
        <div className="flex items-center justify-end p-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={onToggle}>
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </aside>
    );
  }

  const activeProjects = homeData.projects.filter(p => !p.deletedAt && !p.archivedAt);
  const getKesimForProject = (projectId: string) =>
    homeData.kesimAlanlari.filter(k => k.projectId === projectId && !k.deletedAt);
  const orphanKesim = homeData.kesimAlanlari.filter(k => !k.projectId && !k.deletedAt && k.name !== "__havuz__");

  return (
    <aside className={cn(
      "flex flex-col border-r transition-all duration-200 overflow-hidden flex-shrink-0",
      "bg-[hsl(222,47%,10%)] border-[hsl(222,47%,15%)]",
      collapsed ? "w-12" : "w-60"
    )}>
      {/* Header */}
      <div className={cn(
        "flex items-center border-b border-[hsl(222,47%,15%)] h-12 flex-shrink-0",
        collapsed ? "justify-center px-0" : "justify-between px-3"
      )}>
        {!collapsed && (
          <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Gezgin</span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/40 hover:text-white/80 hover:bg-white/5"
          onClick={onToggle}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 thin-scrollbar space-y-0.5 px-2">
        {/* Home */}
        <NavItem
          collapsed={collapsed}
          icon={<Home className="h-4 w-4 flex-shrink-0" />}
          label="Ana Sayfa"
          active={location === "/" || location === ""}
          onClick={() => go("/")}
        />

        {/* Bağış Havuzu per project */}
        {activeProjects.map(project => (
          <NavItem
            key={`havuz-${project.id}`}
            collapsed={collapsed}
            icon={<Inbox className="h-4 w-4 flex-shrink-0" />}
            label={`Havuz: ${project.name}`}
            active={location === `/bagis-havuzu/${project.id}`}
            onClick={() => go(`/bagis-havuzu/${project.id}`)}
          />
        ))}

        {/* Divider */}
        {!collapsed && activeProjects.length > 0 && (
          <div className="pt-2 pb-1 px-1">
            <div className="h-px bg-white/8" />
          </div>
        )}

        {/* Projects tree */}
        {activeProjects.map(project => {
          const kesimList = getKesimForProject(project.id);
          const isOpen = openProjects.has(project.id);
          const isProjectActive = activeProjectId === project.id;
          return (
            <div key={project.id}>
              <div className={cn("flex items-center gap-1", collapsed ? "justify-center" : "")}>
                {!collapsed && (
                  <button
                    className="flex-shrink-0 p-1 rounded text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
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
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-white/8 pl-2">
                  {kesimList.map(ka => (
                    <NavItem
                      key={ka.id}
                      collapsed={false}
                      icon={<img src="/kurban-logo.png" alt="" className="h-3.5 w-3.5 flex-shrink-0 object-contain opacity-70" />}
                      label={ka.name}
                      active={activeKesimId === ka.id}
                      onClick={() => go(`/kesim/${ka.id}`)}
                      small
                    />
                  ))}
                  {kesimList.length === 0 && (
                    <p className="text-xs text-white/25 px-2 py-1 italic">Kesim listesi yok</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Orphan kesim lists */}
        {orphanKesim.length > 0 && (
          <div>
            {!collapsed && (
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest px-2 pt-3 pb-1">
                Listeler
              </p>
            )}
            {orphanKesim.map(ka => (
              <NavItem
                key={ka.id}
                collapsed={collapsed}
                icon={<img src="/kurban-logo.png" alt="" className="h-4 w-4 flex-shrink-0 object-contain opacity-70" />}
                label={ka.name}
                active={activeKesimId === ka.id}
                onClick={() => go(`/kesim/${ka.id}`)}
              />
            ))}
          </div>
        )}

        {/* Divider before trash */}
        <div className="pt-2 pb-1 px-1">
          <div className="h-px bg-white/8" />
        </div>

        {/* Çöp Kutusu */}
        <NavItem
          collapsed={collapsed}
          icon={<Trash2 className="h-4 w-4 flex-shrink-0" />}
          label="Çöp Kutusu"
          active={location === "/cop-kutusu"}
          onClick={() => go("/cop-kutusu")}
          muted
        />
      </nav>
    </aside>
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
}

function NavItem({ collapsed, icon, label, active, onClick, className, small, muted }: NavItemProps) {
  const button = (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 w-full rounded-md text-left transition-all duration-150 select-none",
        small
          ? "px-2 py-1.5 text-[13px]"
          : "px-2.5 py-2 text-sm",
        active
          ? "bg-primary text-primary-foreground font-medium shadow-sm"
          : muted
            ? "text-white/35 hover:text-white/60 hover:bg-white/5"
            : "text-white/65 hover:text-white hover:bg-white/8",
        collapsed && "justify-center px-0 py-2.5",
        className
      )}
    >
      <span className={cn(active ? "text-primary-foreground" : muted ? "text-white/35" : "text-white/50")}>
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="text-sm">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

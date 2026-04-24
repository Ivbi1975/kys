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
      <aside className={cn("flex flex-col bg-muted/30 border-r transition-all duration-200", collapsed ? "w-10" : "w-56")}>
        <div className="flex items-center justify-end p-1.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
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
    <aside className={cn("flex flex-col bg-muted/30 border-r transition-all duration-200 overflow-hidden flex-shrink-0", collapsed ? "w-10" : "w-56")}>
      <div className={cn("flex items-center border-b h-10 flex-shrink-0", collapsed ? "justify-center px-0" : "justify-between px-2")}>
        {!collapsed && <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Gezgin</span>}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto py-1 thin-scrollbar">
        {/* Home */}
        <NavItem
          collapsed={collapsed}
          icon={<Home className="h-3.5 w-3.5 flex-shrink-0" />}
          label="Ana Sayfa"
          active={location === "/" || location === ""}
          onClick={() => go("/")}
        />

        {/* Bağış Havuzu per project — at the top */}
        {activeProjects.map(project => (
          <NavItem
            key={`havuz-${project.id}`}
            collapsed={collapsed}
            icon={<Inbox className="h-3.5 w-3.5 flex-shrink-0" />}
            label={`Havuz: ${project.name}`}
            active={location === `/bagis-havuzu/${project.id}`}
            onClick={() => go(`/bagis-havuzu/${project.id}`)}
          />
        ))}

        {/* Projects */}
        {activeProjects.map(project => {
          const kesimList = getKesimForProject(project.id);
          const isOpen = openProjects.has(project.id);
          const isProjectActive = activeProjectId === project.id;
          return (
            <div key={project.id}>
              <div className={cn("flex items-center gap-1 group", collapsed ? "justify-center px-1.5 py-0.5" : "px-1.5 py-0.5")}>
                {!collapsed && (
                  <button
                    className="flex-shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground"
                    onClick={() => toggleProject(project.id)}
                  >
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                )}
                <NavItem
                  collapsed={collapsed}
                  icon={<FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />}
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
                <div className="ml-5">
                  {kesimList.map(ka => (
                    <NavItem
                      key={ka.id}
                      collapsed={false}
                      icon={<img src="/kurban-logo.png" alt="" className="h-3 w-3 flex-shrink-0 object-contain" />}
                      label={ka.name}
                      active={activeKesimId === ka.id}
                      onClick={() => go(`/kesim/${ka.id}`)}
                      small
                    />
                  ))}
                  {kesimList.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-0.5 italic">Kesim listesi yok</p>
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
              <p className="text-xs text-muted-foreground uppercase tracking-wide px-2 pt-2 pb-0.5">Listelenim</p>
            )}
            {orphanKesim.map(ka => (
              <NavItem
                key={ka.id}
                collapsed={collapsed}
                icon={<img src="/kurban-logo.png" alt="" className="h-3.5 w-3.5 flex-shrink-0 object-contain" />}
                label={ka.name}
                active={activeKesimId === ka.id}
                onClick={() => go(`/kesim/${ka.id}`)}
              />
            ))}
          </div>
        )}

        {/* Çöp Kutusu */}
        <NavItem
          collapsed={collapsed}
          icon={<Trash2 className="h-3.5 w-3.5 flex-shrink-0" />}
          label="Çöp Kutusu"
          active={location === "/cop-kutusu"}
          onClick={() => go("/cop-kutusu")}
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
}

function NavItem({ collapsed, icon, label, active, onClick, className, small }: NavItemProps) {
  const button = (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 w-full rounded text-left transition-colors",
        small ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-xs",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground/70 hover:bg-muted hover:text-foreground",
        collapsed && "justify-center px-0 py-1",
        className
      )}
    >
      {icon}
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return button;
}

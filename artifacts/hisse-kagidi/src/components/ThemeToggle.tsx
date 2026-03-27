import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/lib/useTheme";

interface ThemeToggleProps {
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
}

export function ThemeToggle({ size = "sm", className = "h-8 w-8 p-0" }: ThemeToggleProps) {
  const { toggle, mode } = useTheme();

  const title = mode === "light" ? "Koyu Mod" : mode === "dark" ? "Sistem" : "Açık Mod";
  const icon = mode === "light"
    ? <Sun className="w-4 h-4" />
    : mode === "dark"
    ? <Moon className="w-4 h-4" />
    : <Monitor className="w-4 h-4" />;

  return (
    <Button
      variant="ghost"
      size={size}
      className={className}
      onClick={toggle}
      title={title}
      aria-label={title}
    >
      {icon}
    </Button>
  );
}

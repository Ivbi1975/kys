import type { IconType } from "react-icons";
import {
  FaLock, FaMosque, FaHourglass, FaCalendarDay, FaCloud,
  FaSkull, FaWallet, FaHeart, FaCommentDots, FaBell,
  FaPrayingHands, FaSun, FaStar, FaChild, FaCrown,
  FaExclamationCircle, FaCut, FaHorse, FaDrumstickBite, FaLink,
} from "react-icons/fa";

interface CategoryEntry {
  Icon: IconType;
  bg: string;
}

export const CATEGORY_CONFIG: Record<string, CategoryEntry> = {
  vacip:           { Icon: FaLock,               bg: "bg-indigo-700"   },
  ulke_talebi:     { Icon: FaMosque,             bg: "bg-purple-900"   },
  erken_kesim:     { Icon: FaHourglass,          bg: "bg-amber-700"    },
  "2.gün":         { Icon: FaCalendarDay,        bg: "bg-teal-700"     },
  "3.gün":         { Icon: FaSun,                bg: "bg-lime-700"     },
  mevta:           { Icon: FaCloud,              bg: "bg-slate-600"    },
  mevta_kurbani:   { Icon: FaSkull,              bg: "bg-cyan-800"     },
  ödeme_notu:      { Icon: FaWallet,             bg: "bg-emerald-700"  },
  adak:            { Icon: FaHeart,              bg: "bg-purple-700"   },
  akika:           { Icon: FaBell,               bg: "bg-rose-700"     },
  Şafi:            { Icon: FaPrayingHands,       bg: "bg-red-900"      },
  nafile:          { Icon: FaStar,               bg: "bg-cyan-700"     },
  sünnet:          { Icon: FaChild,              bg: "bg-green-700"    },
  sabah_kesimi:    { Icon: FaSun,                bg: "bg-orange-700"   },
  iletişim_talebi: { Icon: FaCommentDots,        bg: "bg-violet-700"   },
  et_talebi:       { Icon: FaDrumstickBite,      bg: "bg-green-800"    },
  hayvan_tercihi:  { Icon: FaHorse,              bg: "bg-fuchsia-800"  },
  ilk_hayvan:      { Icon: FaCrown,              bg: "bg-sky-700"      },
  acil:            { Icon: FaExclamationCircle,  bg: "bg-red-600"      },
  özel_kesim:      { Icon: FaCut,                 bg: "bg-amber-600"    },
  aynı_hayvan:     { Icon: FaLink,               bg: "bg-blue-700"     },
};

const FALLBACK_BG = "bg-gray-600";

interface CategoryBadgeProps {
  cat: string;
  count?: number;
  onClick?: () => void;
  active?: boolean;
  size?: "sm" | "md";
}

export function CategoryBadge({ cat, count, onClick, active, size = "md" }: CategoryBadgeProps) {
  const entry = CATEGORY_CONFIG[cat];
  const Icon = entry?.Icon;
  const bg = entry?.bg ?? FALLBACK_BG;
  const label = cat.replace(/_/g, " ");

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-white cursor-pointer select-none transition-all ${bg} ${active ? "ring-1 ring-white/50" : "hover:brightness-110"}`}
        onClick={onClick}
      >
        {Icon && <Icon className="w-2.5 h-2.5 flex-shrink-0" />}
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white cursor-pointer select-none transition-all ${bg} ${active ? "ring-2 ring-white/40 brightness-125" : "hover:brightness-110"}`}
      onClick={onClick}
    >
      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      <span className="text-xs font-medium">{label}</span>
      {count !== undefined && <span className="text-xs font-bold ml-0.5">{count}</span>}
    </span>
  );
}

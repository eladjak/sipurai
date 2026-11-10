import { Moon, Library, UsersRound, HeartHandshake } from "lucide-react";

export const navItems = (t) => [
  { href: "/", label: t("shell.tonight"), icon: Moon },
  { href: "/shelf", label: t("shell.shelf"), icon: Library },
  { href: "/heroes", label: t("shell.heroes"), icon: UsersRound },
  { href: "/parents", label: t("shell.parents"), icon: HeartHandshake },
];

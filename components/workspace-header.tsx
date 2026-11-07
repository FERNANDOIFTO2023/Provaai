"use client";

import { useEffect, useRef, type ComponentType } from "react";
import { LogOut, Menu, X } from "./animated-icons";

type Section = {
  id: string;
  short: string;
  name: string;
  icon: ComponentType<{ size?: number }>;
};

export default function WorkspaceHeader({
  sections,
  view,
  className,
  email,
  demo,
  busy,
  menuOpen,
  onMenu,
  onNavigate,
  onSignOut,
}: {
  sections: Section[];
  view: string;
  className?: string;
  email?: string;
  demo: boolean;
  busy: boolean;
  menuOpen: boolean;
  onMenu: () => void;
  onNavigate: (view: string) => void;
  onSignOut: () => void;
}) {
  const navigation = useRef<HTMLElement>(null);
  const current = sections.find((section) => section.id === view);
  const account = demo
    ? "Professor visitante"
    : email?.split("@")[0] || "Professor";
  const initials = account
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  useEffect(() => {
    const nav = navigation.current;
    const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !selected) return;
    // Move somente a faixa de navegação, sem deslocar a página do professor.
    const left = selected.offsetLeft - nav.offsetLeft;
    if (left < nav.scrollLeft) nav.scrollLeft = Math.max(0, left - 8);
    else if (left + selected.offsetWidth > nav.scrollLeft + nav.clientWidth)
      nav.scrollLeft = left + selected.offsetWidth - nav.clientWidth + 8;
  }, [view]);

  return (
    <header className="topbar workspace-header">
      <div className="workspace-header-row">
        <div className="workspace-header-location">
          <button
            type="button"
            className="icon-button mobile-menu"
            onClick={onMenu}
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            aria-controls="teacher-sidebar"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
          <span className="header-location-mark" aria-hidden="true">
            <img src="/bloub/bloub-symbol.svg" width="25" height="25" alt="" />
          </span>
          <div className="header-location-copy">
            <span className="header-eyebrow">Seu espaço de ensino</span>
            <div className="header-breadcrumb">
              <span>{current?.name || "Meu espaço"}</span>
              {className && view === "classes" && (
                <>
                  <span
                    className="header-breadcrumb-divider"
                    aria-hidden="true"
                  >
                    /
                  </span>
                  <strong title={className}>{className}</strong>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="workspace-header-account">
          <div
            className="header-account"
            title={demo ? "Modo demonstração" : email}
          >
            <span className="header-account-avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="header-account-copy">
              <strong>{account}</strong>
              <small>{demo ? "Demonstração" : "Conta do professor"}</small>
            </span>
          </div>
          <button
            type="button"
            className="header-signout"
            disabled={busy}
            onClick={onSignOut}
            aria-label="Sair da conta"
            title="Sair da conta"
          >
            <LogOut size={17} />
            <span>Sair</span>
          </button>
        </div>
      </div>
      <nav
        ref={navigation}
        className="workspace-header-nav"
        aria-label="Telas do professor"
      >
        {sections.map((section) => (
          <button
            type="button"
            key={section.id}
            aria-current={view === section.id ? "page" : undefined}
            onClick={() => onNavigate(section.id)}
          >
            <section.icon size={17} />
            <span>{section.short}</span>
            <span className="header-active-dot" aria-hidden="true" />
          </button>
        ))}
      </nav>
    </header>
  );
}

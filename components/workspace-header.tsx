"use client";

import { useEffect, useId, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";

type Section = {
  id: string;
  short: string;
  name: string;
};

export default function WorkspaceHeader({
  sections,
  view,
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
  email?: string;
  demo: boolean;
  busy: boolean;
  menuOpen: boolean;
  onMenu: () => void;
  onNavigate: (view: string) => void;
  onSignOut: () => void;
}) {
  const more = useRef<HTMLDetailsElement>(null);
  const indicatorId = useId();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (more.current) more.current.open = false;
  }, [view]);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !more.current?.contains(event.target) &&
        more.current
      )
        more.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return (
    <header className="topbar workspace-header">
      <button
        type="button"
        className="icon-button mobile-menu"
        onClick={onMenu}
        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={menuOpen}
        aria-controls="teacher-sidebar"
      >
        {menuOpen ? "Fechar" : "Menu"}
      </button>
      <nav className="workspace-header-nav" aria-label="Telas do professor">
        {sections.map((section, index) => (
          <button
            className={
              index < 2 ? "header-primary-link" : "header-overflow-link"
            }
            type="button"
            key={section.id}
            aria-current={view === section.id ? "page" : undefined}
            onClick={() => onNavigate(section.id)}
          >
            {view === section.id && (
              <motion.span
                className="header-active-indicator"
                layoutId={indicatorId}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { duration: 0.2, ease: "easeOut" }
                }
                aria-hidden="true"
              />
            )}
            <span className="header-nav-label">{section.short}</span>
          </button>
        ))}
        <details
          ref={more}
          className="header-more"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary")?.focus();
            }
          }}
        >
          <summary
            className={
              sections.slice(2).some((section) => section.id === view)
                ? "is-active"
                : undefined
            }
          >
            Mais
          </summary>
          <div className="header-more-pages">
            {sections.slice(2).map((section) => (
              <button
                type="button"
                key={section.id}
                aria-current={view === section.id ? "page" : undefined}
                onClick={() => {
                  if (more.current) more.current.open = false;
                  onNavigate(section.id);
                }}
              >
                {section.short}
              </button>
            ))}
          </div>
        </details>
      </nav>
      <div className="workspace-header-account">
        <span
          className="header-session-label"
          title={demo ? "Demonstração" : email}
        >
          {demo ? "Demonstração" : email}
        </span>
        <button
          type="button"
          className="header-signout"
          disabled={busy}
          onClick={onSignOut}
          aria-label="Sair da conta"
          title="Sair da conta"
        >
          <span>Sair</span>
        </button>
      </div>
    </header>
  );
}

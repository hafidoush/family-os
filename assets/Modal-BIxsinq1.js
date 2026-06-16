import{j as a}from"./vendor-dnd-Dyg3YmpX.js";import{r as t,a as E}from"./vendor-react-ChHgBwk8.js";const v=t.createContext(null);function z(){const e=t.useContext(v);if(!e)throw new Error("Modal sub-components must be used inside <Modal>");return e}function C({children:e,showClose:s=!0,className:o=""}){const{onClose:l}=z();return a.jsxs("div",{className:`fos-modal-header ${o}`,children:[a.jsx("div",{className:"fos-modal-header-content",children:e}),s&&a.jsx("button",{type:"button",className:"fos-modal-close",onClick:l,"aria-label":"Fermer",children:a.jsx("svg",{width:"18",height:"18",viewBox:"0 0 18 18",fill:"none","aria-hidden":"true",children:a.jsx("path",{d:"M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5",stroke:"currentColor",strokeWidth:"1.75",strokeLinecap:"round"})})})]})}function D({children:e,className:s="",flush:o=!1}){return a.jsx("div",{className:`fos-modal-body${o?" fos-modal-body--flush":""} ${s}`,children:e})}function S({children:e,className:s="",align:o="end"}){return a.jsx("div",{className:`fos-modal-footer fos-modal-footer--${o} ${s}`,children:e})}const $={sm:"400px",md:"520px",lg:"680px",full:"calc(100vw - 2 * var(--space-4))"};function p({open:e,isOpen:s,onClose:o,variant:l="default",size:h="md",persistent:n=!1,titleId:g,title:B,children:y,className:k=""}){const c=e??s??!1,f=t.useRef(null),m=t.useRef(null);t.useEffect(()=>(c?(m.current=document.activeElement,requestAnimationFrame(()=>{var r;(r=f.current)==null||r.focus()}),document.body.style.overflow="hidden"):(document.body.style.overflow="",m.current instanceof HTMLElement&&m.current.focus()),()=>{document.body.style.overflow=""}),[c]);const w=t.useCallback(r=>{if(r.key==="Escape"&&!n&&(r.preventDefault(),o()),r.key==="Tab"){const b=f.current;if(!b)return;const u=b.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),d=u[0],i=u[u.length-1];r.shiftKey?document.activeElement===d&&(r.preventDefault(),i==null||i.focus()):document.activeElement===i&&(r.preventDefault(),d==null||d.focus())}},[o,n]),j=t.useCallback(()=>{n||o()},[o,n]);if(!c)return null;const M=$[h];return E.createPortal(a.jsxs(v.Provider,{value:{onClose:o},children:[a.jsx(N,{}),a.jsx("div",{className:`fos-modal-backdrop fos-modal-backdrop--${l}`,onClick:j,"aria-hidden":"true"}),a.jsxs("div",{ref:f,role:"dialog","aria-modal":"true","aria-labelledby":g,tabIndex:-1,className:`fos-modal fos-modal--${l} fos-modal--${h} ${k}`,style:{"--modal-max-width":M},onKeyDown:w,onClick:r=>r.stopPropagation(),children:[a.jsx("div",{className:"fos-modal-highlight","aria-hidden":"true"}),y]})]}),document.body)}p.Header=C;p.Body=D;p.Footer=S;let x=!1;function N(){return t.useEffect(()=>{if(x)return;x=!0;const e=document.createElement("style");e.id="fos-modal-styles",e.textContent=F,document.head.appendChild(e)},[]),null}const F=`
/* ═══════════════════════════════════════════════════════════════════════════
   FAMILY OS — Modal styles
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Backdrop ───────────────────────────────────────────────────────────── */

.fos-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay, 300);
  background: var(--surface-overlay, hsla(262, 30%, 20%, 0.45));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: fos-backdrop-in var(--duration-normal, 200ms) var(--ease-out, ease) forwards;
}

.fos-modal-backdrop--sheet {
  background: var(--surface-overlay, hsla(262, 30%, 20%, 0.35));
}

@keyframes fos-backdrop-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── Dialog — base ──────────────────────────────────────────────────────── */

.fos-modal {
  position: fixed;
  z-index: var(--z-modal, 400);
  display: flex;
  flex-direction: column;
  outline: none;
  overflow: hidden;

  /* Glassmorphism fort */
  background: var(--glass-bg-strong, hsla(0, 0%, 100%, 0.88));
  backdrop-filter: var(--glass-blur-strong, blur(32px));
  -webkit-backdrop-filter: var(--glass-blur-strong, blur(32px));
  border: 1px solid var(--glass-border-strong, hsla(0, 0%, 100%, 0.75));
  box-shadow: var(--glass-shadow-strong, 0 16px 48px hsla(262, 30%, 20%, 0.16));
}

/* Reflet interne en haut (signature glassmorphism) */
.fos-modal-highlight {
  position: absolute;
  inset: 0;
  top: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    hsla(0, 0%, 100%, 0.7) 40%,
    hsla(0, 0%, 100%, 0.7) 60%,
    transparent 100%
  );
  pointer-events: none;
  z-index: 1;
}

/* ── Variante default (centré) ──────────────────────────────────────────── */

.fos-modal--default {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(var(--modal-max-width, 520px), calc(100vw - var(--space-8, 2rem)));
  max-height: min(90dvh, 800px);
  border-radius: var(--radius-2xl, 20px);

  animation: fos-modal-in var(--duration-slow, 350ms) var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1)) forwards;
}

@keyframes fos-modal-in {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 12px)) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

/* ── Variante alert (compact, centré, légèrement smaller) ───────────────── */

.fos-modal--alert {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(360px, calc(100vw - var(--space-8, 2rem)));
  max-height: min(80dvh, 480px);
  border-radius: var(--radius-2xl, 20px);

  /* Ombre plus dramatique pour les alertes */
  box-shadow:
    0 20px 60px hsla(262, 30%, 20%, 0.20),
    0 4px 16px  hsla(262, 30%, 20%, 0.12);

  animation: fos-modal-alert-in var(--duration-normal, 200ms) var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1)) forwards;
}

@keyframes fos-modal-alert-in {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

/* ── Variante sheet (bottom sheet iOS) ─────────────────────────────────── */

.fos-modal--sheet {
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-height: 92dvh;
  border-radius: var(--radius-2xl, 20px) var(--radius-2xl, 20px) 0 0;
  padding-bottom: var(--safe-bottom, 0px);

  /* Poignée en haut */
  padding-top: 20px;

  animation: fos-sheet-in var(--duration-slow, 350ms) var(--ease-snappy, cubic-bezier(0.2,0,0,1)) forwards;
}

.fos-modal--sheet::before {
  content: '';
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border-default, hsla(240, 7%, 82%, 1));
}

@keyframes fos-sheet-in {
  from {
    transform: translateY(100%);
    opacity: 0.8;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Sheet desktop : centré comme modal */
@media (min-width: 768px) {
  .fos-modal--sheet {
    bottom: auto;
    top: 50%;
    left: 50%;
    right: auto;
    width: min(560px, calc(100vw - 2rem));
    max-height: min(85dvh, 720px);
    border-radius: var(--radius-2xl, 20px);
    padding-top: 0;
    transform: translate(-50%, -50%);
    animation: fos-modal-in var(--duration-slow, 350ms) var(--ease-spring, cubic-bezier(0.34,1.56,0.64,1)) forwards;
  }
  .fos-modal--sheet::before { display: none; }
}

/* ── Header ─────────────────────────────────────────────────────────────── */

.fos-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-5, 1.25rem) var(--space-5, 1.25rem) var(--space-4, 1rem);
  border-bottom: 1px solid var(--border-subtle, hsla(240, 8%, 90%, 1));
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.fos-modal-header-content {
  flex: 1;
  min-width: 0;
}

.fos-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full, 9999px);
  border: none;
  background: var(--bg-sunken, var(--color-neutral-100));
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  margin-top: -2px;
  transition: var(--transition-interactive);
}

.fos-modal-close:hover {
  background: var(--border-subtle);
  color: var(--text-primary);
  transform: scale(1.08);
}

.fos-modal-close:active {
  transform: scale(0.94);
}

/* ── Body ───────────────────────────────────────────────────────────────── */

.fos-modal-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-5, 1.25rem);
  position: relative;
  z-index: 2;

  /* Scrollbar discrète */
  scrollbar-width: thin;
  scrollbar-color: var(--border-default) transparent;
}

.fos-modal-body::-webkit-scrollbar {
  width: 4px;
}
.fos-modal-body::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 2px;
}

.fos-modal-body--flush {
  padding: 0;
}

/* ── Footer ─────────────────────────────────────────────────────────────── */

.fos-modal-footer {
  display: flex;
  gap: var(--space-3, 0.75rem);
  padding: var(--space-4, 1rem) var(--space-5, 1.25rem) var(--space-5, 1.25rem);
  border-top: 1px solid var(--border-subtle, hsla(240, 8%, 90%, 1));
  flex-shrink: 0;
  position: relative;
  z-index: 2;
}

.fos-modal-footer--start   { justify-content: flex-start; }
.fos-modal-footer--center  { justify-content: center; }
.fos-modal-footer--end     { justify-content: flex-end; }
.fos-modal-footer--stretch { & > * { flex: 1; } }

/* ── Dark mode ──────────────────────────────────────────────────────────── */

@media (prefers-color-scheme: dark) {
  .fos-modal {
    border-color: var(--glass-border-strong);
  }
  .fos-modal-highlight {
    background: linear-gradient(
      90deg,
      transparent 0%,
      hsla(0, 0%, 100%, 0.12) 40%,
      hsla(0, 0%, 100%, 0.12) 60%,
      transparent 100%
    );
  }
  .fos-modal-close {
    background: var(--surface-2);
  }
  .fos-modal-close:hover {
    background: var(--surface-1);
  }
}

/* ── Reduced motion ─────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .fos-modal,
  .fos-modal-backdrop {
    animation: none !important;
  }
  .fos-modal--default,
  .fos-modal--alert {
    transform: translate(-50%, -50%) !important;
    opacity: 1 !important;
  }
  .fos-modal--sheet {
    transform: translateY(0) !important;
    opacity: 1 !important;
  }
}
`;export{p as M};

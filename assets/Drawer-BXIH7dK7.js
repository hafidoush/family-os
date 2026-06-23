import{j as t}from"./vendor-dnd-BL-GPP-h.js";import{r as i,a as D}from"./vendor-react-fwmUM2PW.js";const Y=120,z=.5;function w(e){return Array.from(e.querySelectorAll('a[href], button:not([disabled]), textarea, input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(r=>!r.closest('[aria-hidden="true"]'))}const T=`
/* ── Drawer styles — injectés une seule fois dans <head> ── */

/* Overlay / backdrop */
.fos-drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background: var(--surface-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-normal) var(--ease-out);
  will-change: opacity;
}
.fos-drawer-backdrop.is-open {
  opacity: 1;
  pointer-events: auto;
}

/* Panel commun */
.fos-drawer-panel {
  position: fixed;
  z-index: var(--z-modal);
  display: flex;
  flex-direction: column;
  background: var(--glass-bg-strong);
  backdrop-filter: var(--glass-blur-strong);
  -webkit-backdrop-filter: var(--glass-blur-strong);
  border: 1px solid var(--glass-border-strong);
  box-shadow: var(--glass-shadow-strong);
  will-change: transform, opacity;
  overflow: hidden;
  pointer-events: none;

  /* Typographie de base */
  font-family: var(--font-body);
  color: var(--text-primary);
}

/* ── Ancre BOTTOM ── */
.fos-drawer-panel[data-anchor="bottom"] {
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
  padding-bottom: var(--safe-bottom);

  /* Slide depuis le bas */
  transform: translateY(100%);
  opacity: 0;
  transition:
    transform var(--duration-slow) var(--ease-spring),
    opacity   var(--duration-normal) var(--ease-out);
}
.fos-drawer-panel[data-anchor="bottom"].is-open {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}

/* Tailles — hauteur max (bottom) */
.fos-drawer-panel[data-anchor="bottom"][data-size="sm"]   { max-height: 35dvh; }
.fos-drawer-panel[data-anchor="bottom"][data-size="md"]   { max-height: 60dvh; }
.fos-drawer-panel[data-anchor="bottom"][data-size="lg"]   { max-height: 82dvh; }
.fos-drawer-panel[data-anchor="bottom"][data-size="full"] { max-height: 94dvh; }

/* ── Ancre RIGHT ── */
.fos-drawer-panel[data-anchor="right"] {
  top: 0;
  right: 0;
  bottom: 0;
  border-radius: var(--radius-2xl) 0 0 var(--radius-2xl);

  transform: translateX(100%);
  opacity: 0;
  transition:
    transform var(--duration-slow) var(--ease-spring),
    opacity   var(--duration-normal) var(--ease-out);
}
.fos-drawer-panel[data-anchor="right"].is-open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}

/* Tailles — largeur (right) */
.fos-drawer-panel[data-anchor="right"][data-size="sm"]   { width: min(320px, 90vw); }
.fos-drawer-panel[data-anchor="right"][data-size="md"]   { width: min(420px, 90vw); }
.fos-drawer-panel[data-anchor="right"][data-size="lg"]   { width: min(560px, 92vw); }
.fos-drawer-panel[data-anchor="right"][data-size="full"] { width: 100vw; border-radius: 0; }

/* ── Poignée swipe ── */
.fos-drawer-handle {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-3) var(--space-4) var(--space-1);
  cursor: grab;
  touch-action: none;
  user-select: none;
}
.fos-drawer-handle:active { cursor: grabbing; }

.fos-drawer-handle-bar {
  width: 36px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--border-default);
  transition: background var(--duration-fast) var(--ease-out),
              width var(--duration-fast) var(--ease-spring);
}
.fos-drawer-handle:hover .fos-drawer-handle-bar,
.fos-drawer-handle:active .fos-drawer-handle-bar {
  background: var(--border-strong);
  width: 44px;
}

/* ── Header ── */
.fos-drawer-header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5) var(--space-3);
}
/* Quand il y a une poignée, on réduit le padding top du header */
.fos-drawer-panel[data-anchor="bottom"] .fos-drawer-handle + .fos-drawer-header {
  padding-top: var(--space-2);
}

.fos-drawer-header-text {
  flex: 1;
  min-width: 0;
}

.fos-drawer-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--leading-tight);
  color: var(--text-primary);
  margin: 0;
  /* Cormorant/Lora ont une belle lettre italique — on en profite légèrement */
  font-style: normal;
  letter-spacing: -0.01em;
}

.fos-drawer-description {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: var(--leading-relaxed);
}

/* Bouton fermeture */
.fos-drawer-close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-full);
  background: var(--bg-sunken);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 18px;
  line-height: 1;
  transition: var(--transition-interactive);
  -webkit-tap-highlight-color: transparent;
  margin-top: 2px; /* alignement optique avec le titre */
}
.fos-drawer-close:hover {
  background: var(--primary-subtle);
  color: var(--primary-dark);
  transform: scale(1.05);
}
.fos-drawer-close:active {
  transform: scale(0.92);
  background: var(--primary-subtle);
}

/* ── Séparateur optique sous le header ── */
.fos-drawer-divider {
  flex-shrink: 0;
  height: 1px;
  margin: 0 var(--space-5);
  background: linear-gradient(
    90deg,
    transparent,
    var(--border-subtle) 20%,
    var(--border-subtle) 80%,
    transparent
  );
}

/* ── Body — zone scrollable ── */
.fos-drawer-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: var(--space-4) var(--space-5);
  overscroll-behavior: contain;

  /* Scrollbar discrète */
  scrollbar-width: thin;
  scrollbar-color: var(--border-subtle) transparent;
}
.fos-drawer-body::-webkit-scrollbar { width: 4px; }
.fos-drawer-body::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: var(--radius-full);
}

/* ── Footer ── */
.fos-drawer-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5) var(--space-4);
  border-top: 1px solid var(--border-subtle);
  background: linear-gradient(
    0deg,
    var(--glass-bg-strong) 70%,
    transparent
  );
}

/* ── Transition de translation pendant le swipe (inline style) ── */
.fos-drawer-panel.is-swiping {
  transition: none !important;
}

/* ── Accessibilité : focus visible ── */
.fos-drawer-panel *:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .fos-drawer-backdrop,
  .fos-drawer-panel {
    transition-duration: var(--duration-instant) !important;
  }
}
`;function I(){i.useEffect(()=>{const e="fos-drawer-styles";if(!document.getElementById(e)){const r=document.createElement("style");r.id=e,r.textContent=T,document.head.appendChild(r)}},[])}function P(e){i.useEffect(()=>{if(!e)return;const r=document.body.style.overflow;return document.body.style.overflow="hidden",()=>{document.body.style.overflow=r}},[e])}function R(e,r){const l=i.useRef(null);return i.useEffect(()=>{var n;if(r){l.current=document.activeElement;const o=requestAnimationFrame(()=>{var c;if(!e.current)return;(c=w(e.current)[0])==null||c.focus({preventScroll:!0})});return()=>cancelAnimationFrame(o)}else(n=l.current)==null||n.focus({preventScroll:!0})},[r,e]),{handleKeyDown:i.useCallback(n=>{if(n.key!=="Tab"||!e.current)return;const o=w(e.current);if(o.length===0)return;const u=o[0],c=o[o.length-1];n.shiftKey?document.activeElement===u&&(n.preventDefault(),c.focus()):document.activeElement===c&&(n.preventDefault(),u.focus())},[e])}}function C(e,r,l){const[a,n]=i.useState({active:!1,startY:0,currentY:0,startTime:0}),o=a.active?Math.max(0,a.currentY-a.startY):0,u=i.useCallback(s=>{if(!l||s.target.closest('button, input, select, textarea, a, [role="button"], [role="checkbox"], [role="switch"], label'))return;const d=e.current;if(!d)return;const f=d.querySelector(".fos-drawer-body");f&&f.scrollTop>0&&!s.target.closest(".fos-drawer-handle")||(n({active:!0,startY:s.clientY,currentY:s.clientY,startTime:Date.now()}),s.currentTarget.setPointerCapture(s.pointerId))},[l,e]),c=i.useCallback(s=>{a.active&&n(d=>({...d,currentY:s.clientY}))},[a.active]),v=i.useCallback(()=>{if(!a.active)return;const s=Math.max(0,a.currentY-a.startY),d=Date.now()-a.startTime,f=d>0?s/d:0;(s>Y||f>z)&&r(),n(p=>({...p,active:!1,currentY:p.startY}))},[a,r]),h=a.active&&o>0?{transform:`translateY(${o}px)`,opacity:Math.max(0,1-o/300)}:void 0;return{onPointerDown:u,onPointerMove:c,onPointerUp:v,swipeStyle:h,isSwiping:a.active&&o>0}}let N=0,L=0;function F({isOpen:e,onClose:r,title:l,description:a,size:n="md",anchor:o="bottom",showHandle:u=!0,footer:c,children:v,className:h="",id:s}){I(),P(e);const d=i.useRef(null),f=i.useRef(`fos-drawer-title-${++N}`).current,p=i.useRef(`fos-drawer-desc-${++L}`).current,{handleKeyDown:g}=R(d,e);i.useEffect(()=>{if(!e)return;const m=E=>{E.key==="Escape"&&r()};return document.addEventListener("keydown",m),()=>document.removeEventListener("keydown",m)},[e,r]);const{onPointerDown:x,onPointerMove:y,onPointerUp:b,swipeStyle:k,isSwiping:S}=C(d,r,o==="bottom"),j=t.jsx("svg",{width:"14",height:"14",viewBox:"0 0 14 14",fill:"none","aria-hidden":"true",children:t.jsx("path",{d:"M1 1L13 13M13 1L1 13",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"})});return typeof document>"u"?null:D.createPortal(t.jsxs(t.Fragment,{children:[t.jsx("div",{className:`fos-drawer-backdrop${e?" is-open":""}`,"aria-hidden":"true",onClick:r}),t.jsxs("div",{ref:d,id:s,role:"dialog","aria-modal":"true","aria-labelledby":l?f:void 0,"aria-describedby":a?p:void 0,"data-anchor":o,"data-size":n,className:["fos-drawer-panel",e?"is-open":"",S?"is-swiping":"",h].filter(Boolean).join(" "),style:k,onKeyDown:g,onPointerDown:x,onPointerMove:y,onPointerUp:b,onPointerCancel:b,tabIndex:-1,children:[o==="bottom"&&u&&t.jsx("div",{className:"fos-drawer-handle","aria-hidden":"true",title:"Glisser vers le bas pour fermer",children:t.jsx("div",{className:"fos-drawer-handle-bar"})}),(l||a)&&t.jsxs(t.Fragment,{children:[t.jsxs("div",{className:"fos-drawer-header",children:[t.jsxs("div",{className:"fos-drawer-header-text",children:[l&&t.jsx("h2",{id:f,className:"fos-drawer-title",children:l}),a&&t.jsx("p",{id:p,className:"fos-drawer-description",children:a})]}),t.jsx("button",{type:"button",className:"fos-drawer-close",onClick:r,"aria-label":"Fermer",children:j})]}),t.jsx("div",{className:"fos-drawer-divider","aria-hidden":"true"})]}),t.jsx("div",{className:"fos-drawer-body",children:v}),c&&t.jsx("div",{className:"fos-drawer-footer",children:c})]})]}),document.body)}export{F as D};

/**
 * [V1] Auditoría de la pantalla que se está viendo, para repetir las medidas del rediseño a cada ancho (375, 768, 1024
 * y 1440 px). Solo existe en desarrollo: se llama desde la consola con `__uiAudit()`.
 */
export interface UiAudit {
  ancho: number;
  alto: number;
  /** Elementos con texto que se salen de la ventana por la derecha. */
  fuera: string[];
  /** Controles visibles que miden menos de 44 px de ancho o de alto. */
  controlesPequenos: string[];
  controles: number;
  selectores: number;
  palabras: number;
  emojis: number;
  /** Textos visibles por debajo de 14 px. */
  textosPequenos: number;
  /** Parte del alto de la ventana que ocupa la pista (0 si no hay). */
  pista: number;
}

const MIN_TOUCH = 44, MIN_TEXT = 14;
const EMOJI = /\p{Extended_Pictographic}/gu;

const visible = (element: Element): boolean => {
  const box = element.getBoundingClientRect();
  if (box.width === 0 || box.height === 0 || box.bottom <= 0 || box.top >= window.innerHeight) return false;
  const style = getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05;
};
const name = (element: Element) => (element.getAttribute('aria-label') || element.textContent || element.tagName).trim().slice(0, 30);

export function uiAudit(root: ParentNode = document): UiAudit {
  const texts: Element[] = [];
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (parent && node.textContent && node.textContent.trim() && visible(parent) && !parent.closest('svg, canvas, [aria-hidden="true"]')) texts.push(parent);
  }
  const unique = [...new Set(texts)];
  // Lo que queda dentro de una zona con desplazamiento lateral propio no cuenta como «fuera».
  const scrolls = (element: Element) => { for (let up = element.parentElement; up; up = up.parentElement) { const o = getComputedStyle(up).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') return up.getBoundingClientRect().right <= window.innerWidth + 1; } return false; };
  // Un botón de radio o una casilla se toca en su etiqueta: se mide la etiqueta.
  const controls = [...root.querySelectorAll('button, select, a[href], input:not([type="hidden"]), [role="tab"]')]
    .map(control => (control instanceof HTMLInputElement && control.closest('label') ? control.closest('label')! : control)).filter(visible);
  const allText = unique.map(element => [...element.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ')).join(' ');
  const canvas = [...root.querySelectorAll('canvas')].filter(visible).sort((a, b) => b.clientHeight - a.clientHeight)[0];
  return {
    ancho: window.innerWidth,
    alto: window.innerHeight,
    fuera: unique.filter(element => element.getBoundingClientRect().right > window.innerWidth + 1 && !scrolls(element)).map(name),
    controlesPequenos: [...new Set(controls)].filter(control => { const box = control.getBoundingClientRect(); return box.width < MIN_TOUCH - 0.5 || box.height < MIN_TOUCH - 0.5; }).map(name),
    controles: new Set(controls).size,
    selectores: [...root.querySelectorAll('select')].filter(visible).length,
    palabras: allText.split(/\s+/).filter(word => /[\p{L}\p{N}]/u.test(word)).length,
    emojis: (allText.match(EMOJI) ?? []).length,
    textosPequenos: unique.filter(element => parseFloat(getComputedStyle(element).fontSize) < MIN_TEXT).length,
    pista: canvas ? Math.round(100 * canvas.getBoundingClientRect().height / window.innerHeight) / 100 : 0,
  };
}

if (typeof window !== 'undefined') (window as unknown as { __uiAudit: typeof uiAudit }).__uiAudit = uiAudit;

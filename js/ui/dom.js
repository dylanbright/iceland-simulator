/* Tiny DOM helper. All text goes through textContent, never innerHTML. */
(function () {
  'use strict';
  const IS = (globalThis.IS = globalThis.IS || {});

  /** h('div', {class:'x', onclick: fn}, 'text', childNode, ['nested', ...]) */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) el.style.setProperty(sk, sv);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    const append = (c) => {
      if (c == null || c === false) return;
      if (Array.isArray(c)) c.forEach(append);
      else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    };
    children.forEach(append);
    return el;
  }

  IS.dom = { h };
  IS.ui = IS.ui || {};
})();

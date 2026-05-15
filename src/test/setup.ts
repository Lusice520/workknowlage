import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined' && typeof CSSStyleSheet === 'undefined') {
  // Mermaid 11.x uses new CSSStyleSheet() in its theme compilation pipeline.
  // jsdom does not ship a CSSStyleSheet constructor, so we provide a minimal
  // polyfill that supports insertRule / replaceSync.
  const kCSSStyleSheet = function CSSStyleSheet(this: any) {
    const rules: string[] = [];
    this.cssRules = [];
    this.insertRule = (rule: string, index?: number) => {
      rules.push(rule);
      this.cssRules.push({ cssText: rule });
      return this.cssRules.length - 1;
    };
    this.replaceSync = (text: string) => {
      rules.length = 0;
      this.cssRules.length = 0;
      rules.push(text);
      this.cssRules.push({ cssText: text });
    };
    this.toString = () => rules.join('\n');
  } as any;
  (globalThis as any).CSSStyleSheet = kCSSStyleSheet;
}

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverMock,
  });
}

type SVGElementWithBBox = SVGElement & { getBBox?: () => DOMRect };

if (
  typeof SVGElement !== 'undefined'
  && typeof (SVGElement.prototype as SVGElementWithBBox).getBBox === 'undefined'
) {
  // jsdom does not implement SVGElement.getBBox which Mermaid uses to
  // measure text during layout. Return a dummy SVGRect.
  (SVGElement.prototype as SVGElementWithBBox).getBBox = function () {
    return { x: 0, y: 0, width: 10, height: 10 } as DOMRect;
  };
}

if (typeof HTMLElement !== 'undefined' && !HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}

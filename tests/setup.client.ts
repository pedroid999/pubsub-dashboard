import '@testing-library/jest-dom/vitest';

if (typeof window !== 'undefined') {
  const mockMatchMedia = (matches: boolean): MediaQueryList =>
    ({
      matches,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (_query: string) => mockMatchMedia(false),
  });
}

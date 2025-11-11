import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock PixiJS for tests (it requires WebGL which isn't available in jsdom)
vi.mock('pixi.js', () => ({
  Application: vi.fn(),
  Container: vi.fn(),
  Graphics: vi.fn(),
  Text: vi.fn(),
  Assets: {
    load: vi.fn(),
    get: vi.fn(),
  },
}));

// Mock GSAP for tests
vi.mock('gsap', () => ({
  default: {
    to: vi.fn(),
    from: vi.fn(),
    timeline: vi.fn(() => ({
      to: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      call: vi.fn().mockReturnThis(),
    })),
    killTweensOf: vi.fn(),
    utils: {
      random: vi.fn((min: number, max: number) => (min + max) / 2),
    },
  },
  timeline: vi.fn(() => ({
    to: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    call: vi.fn().mockReturnThis(),
  })),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock requestAnimationFrame
globalThis.requestAnimationFrame = vi.fn((cb) => {
  cb(0);
  return 0;
});

globalThis.cancelAnimationFrame = vi.fn();


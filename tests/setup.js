/**
 * Jest test setup
 */

// Store registered custom elements
global.registeredElements = {};

// Spy on customElements.define to capture registered classes
// jsdom provides customElements, so we spy on it rather than replacing it
const originalDefine = window.customElements.define.bind(window.customElements);
jest.spyOn(window.customElements, 'define').mockImplementation((name, constructor) => {
  global.registeredElements[name] = constructor;
  // Still call original so jsdom registers it properly
  try {
    originalDefine(name, constructor);
  } catch (e) {
    // Ignore "already defined" errors on re-runs
  }
});

// Mock window.customCards
window.customCards = window.customCards || [];

// Mock console.info to suppress card registration message
jest.spyOn(console, 'info').mockImplementation(() => {});

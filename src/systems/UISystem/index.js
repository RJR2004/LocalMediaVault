// UISystem Public API (Renderer Process Only)
// All data flows through window.electronAPI IPC. No electron/fs/path imports here.

import { injectTheme, getVariable } from './ThemeManager.js';

// Import new UI components for export
import TagSelector from './TagSelector.jsx';
import RatingSlider from './RatingSlider.jsx';

/**
 * Fetch theme from main process via IPC and inject CSS variables into :root.
 */
async function applyTheme() {
  const themeMap = await window.electronAPI.getTheme();
  if (themeMap) {
    injectTheme(themeMap);
  }
}

/**
 * Return the current value of a single CSS custom property.
 * @param {string} name - CSS variable name e.g. "--theme-accent-color"
 * @returns {string|null}
 */
function getThemeVariable(name) {
  return getVariable(name);
}

export { applyTheme, getThemeVariable, TagSelector, RatingSlider };

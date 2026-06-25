// ThemeManager - Theme and color management (Renderer Process Only)
// Converts theme.json key-value pairs into CSS custom properties injected on :root.

const UI_DEFAULTS = {
  '--ui-radius': '8px',
  '--grid-gap': '12px',
  '--card-aspect-ratio': '2 / 3',
  '--ui-font-size': '14px',
  '--card-width': '180px'
};

/**
 * Convert a theme.json RGB/RGBA string value into a CSS rgba() string.
 * "30,30,30"     -> rgba(30,30,30,1)
 * "0,0,0,180"    -> rgba(0,0,0,0.7059)
 * @param {string} rawValue
 * @returns {string}
 */
function toRgba(rawValue) {
  const parts = rawValue.split(',').map(s => s.trim());
  if (parts.length === 3) {
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, 1)`;
  }
  if (parts.length === 4) {
    const alpha = parseInt(parts[3], 10) / 255;
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }
  return rawValue;
}

/**
 * Map a dot-notation theme key to a kebab-case CSS custom property name.
 * theme.background.dark -> --theme-background-dark
 * @param {string} key
 * @returns {string}
 */
function keyToCssVar(key) {
  return '--' + key.replace(/\./g, '-');
}

/**
 * Build a CSS string of variable declarations from a theme key-value map.
 * @param {object} themeMap - e.g. { "theme.background.dark": "30,30,30", ... }
 * @returns {string}
 */
function buildCssVariables(themeMap) {
  const lines = [];

  for (const [key, rawValue] of Object.entries(themeMap)) {
    const varName = keyToCssVar(key);
    lines.push(`  ${varName}: ${toRgba(rawValue)};`);
  }

  for (const [varName, value] of Object.entries(UI_DEFAULTS)) {
    lines.push(`  ${varName}: ${value};`);
  }

  return lines.join('\n');
}

/**
 * Inject CSS variables into the document :root.
 * @param {object} themeMap
 */
function injectTheme(themeMap) {
  let styleTag = document.getElementById('uisystem-theme');
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = 'uisystem-theme';
    document.head.appendChild(styleTag);
  }

  styleTag.textContent = `:root {\n${buildCssVariables(themeMap)}\n}`;
}

/**
 * Read a single CSS custom property value from the computed :root styles.
 * @param {string} name - CSS variable name e.g. "--theme-accent-color"
 * @returns {string|null}
 */
function getVariable(name) {
  const root = getComputedStyle(document.documentElement);
  return root.getPropertyValue(name).trim() || null;
}

export { injectTheme, getVariable };

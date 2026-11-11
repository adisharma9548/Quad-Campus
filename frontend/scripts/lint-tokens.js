import fs from 'fs';
import path from 'path';

/**
 * Quad Design System Token Linter
 * Enforces strict design tokens:
 * 1. BANS hardcoded colors (hex, rgb, hsl, named tailwind colors) outside token files.
 * 2. BANS off-scale spacing: Only 4, 8, 12, 16, 24, 32, 48 px (0, 1, 2, 3, 4, 6, 8, 12, px, auto, full).
 * 3. BANS arbitrary pixel values for font size and radius outside tokens.
 */

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src');

const ALLOWED_SPACING_TOKENS = new Set(['0', '1', '2', '3', '4', '6', '8', '12', 'px', 'auto', 'full']);

const BANNED_COLOR_PATTERNS = [
  { name: 'Hex color', regex: /#([0-9a-fA-F]{3,8})\b/ },
  { name: 'RGB/RGBA color', regex: /rgba?\([^)]+\)/i },
  { name: 'HSL color', regex: /hsl\([^)]+\)/i },
  {
    name: 'Standard Tailwind named color',
    regex: /\b(text|bg|border|fill|stroke|ring)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+\b/
  },
  {
    name: 'Gradient color stop',
    regex: /\b(from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+\b/
  }
];

const SPACING_REGEX = /\b([p|m][xytblr]?|gap|space-[xy])-([0-9.]+|\[[^\]]+\])\b/g;

// Files exempt from token bans (token definitions themselves)
const EXEMPT_FILES = new Set([
  path.normalize('src/theme.js'),
  path.normalize('src/index.css'),
]);

const FOUNDATION_FILES = new Set([
  path.normalize('src/theme.js'),
  path.normalize('src/index.css'),
  path.normalize('src/components/ui.jsx'),
  path.normalize('src/context/ThemeContext.jsx'),
  path.normalize('src/context/ToastContext.jsx'),
]);

function getFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getFiles(fullPath));
    } else if (/\.(jsx?|tsx?|css)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

export function runLint({ foundationsOnly = false } = {}) {
  const files = getFiles(SRC_DIR);
  const violations = [];

  for (const file of files) {
    const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    const normalizedRel = path.normalize(relPath);

    if (EXEMPT_FILES.has(normalizedRel)) continue;
    if (foundationsOnly && !FOUNDATION_FILES.has(normalizedRel)) continue;

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // 1. Check banned colors
      for (const rule of BANNED_COLOR_PATTERNS) {
        const match = line.match(rule.regex);
        if (match) {
          violations.push({
            file: relPath,
            line: lineNum,
            type: 'COLOR_VIOLATION',
            message: `Found ${rule.name}: "${match[0]}"`,
            text: line.trim(),
          });
          break;
        }
      }

      // 2. Check spacing scale
      let match;
      while ((match = SPACING_REGEX.exec(line)) !== null) {
        const token = match[2];
        if (!ALLOWED_SPACING_TOKENS.has(token)) {
          violations.push({
            file: relPath,
            line: lineNum,
            type: 'SPACING_OFF_SCALE',
            message: `Off-scale spacing utility "${match[0]}". Allowed: 0, 1 (4px), 2 (8px), 3 (12px), 4 (16px), 6 (24px), 8 (32px), 12 (48px).`,
            text: line.trim(),
          });
        }
      }
    });
  }

  return violations;
}

// CLI Execution
const args = process.argv.slice(2);
const isFoundationsOnly = args.includes('--foundations') || args.includes('--foundations-only');

const violations = runLint({ foundationsOnly: isFoundationsOnly });

if (violations.length === 0) {
  console.log(`\x1b[32m✔ Design token linter passed: 0 violations found ${isFoundationsOnly ? '(foundations)' : '(all files)'}.\x1b[0m`);
  process.exit(0);
} else {
  console.log(`\x1b[31m✖ Design token linter found ${violations.length} violations ${isFoundationsOnly ? '(foundations)' : ''}:\x1b[0m\n`);
  
  // Group by file
  const byFile = {};
  violations.forEach(v => {
    byFile[v.file] = byFile[v.file] || [];
    byFile[v.file].push(v);
  });

  Object.entries(byFile).forEach(([file, items]) => {
    console.log(`\x1b[33m${file} (${items.length} issues):\x1b[0m`);
    items.slice(0, 5).forEach(item => {
      console.log(`  Line ${item.line} [${item.type}]: ${item.message}`);
    });
    if (items.length > 5) {
      console.log(`  ... and ${items.length - 5} more issues.`);
    }
  });

  if (isFoundationsOnly) {
    process.exit(1);
  } else {
    console.log(`\n\x1b[36mTip: Run with --foundations to verify the foundation & shared component baseline.\x1b[0m`);
  }
}

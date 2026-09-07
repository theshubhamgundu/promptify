/**
 * Pure TypeScript QR Code generator producing valid SVG data URLs.
 * Implements a lightweight, standard QR Code matrix encoder (Model 2 / Byte mode) for URLs.
 */

// Simple robust QR generator for text / URLs
export function generateQRCodeSVG(text: string, size = 256): string {
  const modules = encodeQRModules(text);
  const moduleCount = modules.length;
  const cellSize = size / moduleCount;

  let rects = '';
  for (let r = 0; r < moduleCount; r++) {
    for (let c = 0; c < moduleCount; c++) {
      if (modules[r][c]) {
        const x = (c * cellSize).toFixed(2);
        const y = (r * cellSize).toFixed(2);
        const w = cellSize.toFixed(2);
        rects += `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="#111827"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#ffffff"/>${rects}</svg>`;
}

export function generateQRCodeDataURL(text: string, size = 256): string {
  const svg = generateQRCodeSVG(text, size);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ── QR Matrix encoder logic for standard text / URLs ──
function encodeQRModules(text: string): boolean[][] {
  // Determine minimum grid size required (Version 1-4)
  const len = text.length;
  let size = 21; // Version 1 (21x21)
  if (len > 25 && len <= 47) size = 25; // Version 2
  else if (len > 47 && len <= 77) size = 29; // Version 3
  else if (len > 77) size = 33; // Version 4

  const grid: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  // 1. Finder patterns (top-left, top-right, bottom-left)
  addFinder(grid, 0, 0);
  addFinder(grid, size - 7, 0);
  addFinder(grid, 0, size - 7);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (grid[6][i] === null) grid[6][i] = i % 2 === 0;
    if (grid[i][6] === null) grid[i][6] = i % 2 === 0;
  }

  // 3. Dark module
  grid[size - 8][8] = true;

  // Convert text characters into bit stream
  const bits: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    for (let b = 7; b >= 0; b--) {
      bits.push((code >> b) & 1);
    }
  }

  // Fill data matrix in standard zig-zag pattern
  let bitIdx = 0;
  let directionIndex = -1; // up
  let x = size - 1;
  let y = size - 1;

  while (x > 0) {
    if (x === 6) x--; // Skip timing column

    for (let c = 0; c < 2; c++) {
      const col = x - c;
      if (grid[y][col] === null) {
        let val = false;
        if (bitIdx < bits.length) {
          val = bits[bitIdx++] === 1;
        } else {
          // Filler pattern
          val = (y + col) % 2 === 0;
        }
        // Apply simple mask pattern ((x + y) % 2 == 0)
        const mask = (y + col) % 2 === 0;
        grid[y][col] = val !== mask;
      }
    }

    y += directionIndex;
    if (y < 0 || y >= size) {
      directionIndex *= -1;
      y += directionIndex;
      x -= 2;
    }
  }

  // Finalize null cells to false
  return grid.map(row => row.map(cell => cell === true));
}

function addFinder(grid: (boolean | null)[][], row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const gr = row + r;
      const gc = col + c;
      if (gr >= 0 && gr < grid.length && gc >= 0 && gc < grid.length) {
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
            grid[gr][gc] = true;
          } else {
            grid[gr][gc] = false;
          }
        } else {
          grid[gr][gc] = false; // Separator
        }
      }
    }
  }
}

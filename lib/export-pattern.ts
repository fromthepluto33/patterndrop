"use client";

type ExportLayout = "grid" | "brick";
type ExportLayerType =
  "circle" | "square" | "triangle" | "arrow" | "line" | "image" | "svg";

export type ExportFormat = "png" | "jpeg" | "webp" | "svg";

interface ExportLayer {
  type: ExportLayerType;
  color: string;
  opacity: number;
  scale: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  offset: { x: number; y: number };
  src?: string;
  rawSvg?: string;
  width?: number;
  height?: number;
}

interface ExportBackground {
  type: "color" | "image" | "transparent";
  color?: string;
  src?: string;
}

interface ExportOptions {
  size: number;
  layers: ExportLayer[];
  layout: ExportLayout;
  spacing: number;
  background: ExportBackground;
}

const BASE_TILE = 110;

const FORMAT_MIME: Record<Exclude<ExportFormat, "svg">, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const FORMAT_EXT: Record<ExportFormat, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  svg: "svg",
};

function svgToDataUrl(svgText: string): string {
  const bytes = new TextEncoder().encode(svgText);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return `data:image/svg+xml;base64,${window.btoa(bin)}`;
}

function tintSvg(raw: string, color: string): string {
  const styled = raw.replace(
    "</svg>",
    `<style>*{fill:${color}!important;stroke:${color}!important}</style></svg>`
  );
  return svgToDataUrl(styled);
}

function motifSvg(layer: ExportLayer, x: number, y: number): string {
  const s = layer.scale / 100;
  const sx = layer.flipH ? -1 : 1;
  const sy = layer.flipV ? -1 : 1;
  const size = 26;
  const opacity = layer.opacity / 100;
  const isImage = layer.type === "image" || layer.type === "svg";
  const cx = x + layer.offset.x;
  const cy = y + layer.offset.y;

  let imgW = 0;
  let imgH = 0;
  if (isImage) {
    const iw = layer.width ?? 200;
    const ih = layer.height ?? 200;
    const box = size * 2;
    const ar = iw / ih;
    if (ar >= 1) {
      imgW = box;
      imgH = box / ar;
    } else {
      imgH = box;
      imgW = box * ar;
    }
  }

  const inner: string[] = [];
  if (layer.type === "circle") {
    inner.push(`<circle r="${size}"/>`);
  } else if (layer.type === "square") {
    inner.push(
      `<rect x="${-size * 0.7}" y="${-size * 0.7}" width="${size * 1.4}" height="${size * 1.4}"/>`
    );
  } else if (layer.type === "triangle") {
    inner.push(
      `<polygon points="0,${-size} ${-size * 0.87},${size * 0.55} ${size * 0.87},${size * 0.55}"/>`
    );
  } else if (layer.type === "arrow") {
    inner.push(
      `<g><rect x="${-size * 0.75}" y="-1.75" width="${size * 1.35}" height="3.5" rx="1.75"/><polygon points="${size * 0.45},0 ${size * 0.45 - 9},-8 ${size * 0.45 - 9},8"/></g>`
    );
  } else if (layer.type === "line") {
    inner.push(
      `<rect x="${-size}" y="-1.75" width="${size * 2}" height="3.5" rx="1.75"/>`
    );
  } else if (isImage) {
    const href =
      layer.type === "svg"
        ? tintSvg(layer.rawSvg ?? "", layer.color)
        : layer.src;
    inner.push(
      `<image href="${href}" x="${-imgW / 2}" y="${-imgH / 2}" width="${imgW}" height="${imgH}" preserveAspectRatio="xMidYMid meet"/>`
    );
  }

  return `<g transform="translate(${cx} ${cy})"><g transform="scale(${sx},${sy}) rotate(${layer.rotation}) scale(${s})" opacity="${opacity}" fill="${layer.color}">${inner.join("")}</g></g>`;
}

export function buildPatternSvg(opts: ExportOptions, opaqueBg = false): string {
  const { size, layers, layout, spacing, background } = opts;
  const tileSize = BASE_TILE + spacing;
  const stepX = tileSize;
  const stepY = tileSize * 0.9;

  // Точная копия раскладки PatternCanvas: тот же якорь решётки (-stepX, -stepY)
  // и та же логика сдвига кирпичной кладки, чтобы экспорт совпадал с холстом.
  const cols = Math.ceil(size / stepX) + 2;
  const rows = Math.ceil(size / stepY) + 2;

  const motifs: string[] = [];
  for (let r = 0; r < rows; r++) {
    const shiftX = layout === "brick" && r % 2 === 1 ? stepX / 2 : 0;
    const y = -stepY + r * stepY;
    for (let c = 0; c < cols; c++) {
      const x = -stepX + c * stepX + shiftX;
      for (const layer of layers) {
        motifs.push(motifSvg(layer, x, y));
      }
    }
  }

  let bg = "";
  if (background.type === "color" && background.color) {
    bg = `<rect width="${size}" height="${size}" fill="${background.color}"/>`;
  } else if (background.type === "image" && background.src) {
    bg = `<image href="${background.src}" x="0" y="0" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice"/>`;
  } else if (opaqueBg) {
    bg = `<rect width="${size}" height="${size}" fill="#ffffff"/>`;
  }

  const body = `${bg}${motifs.join("")}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`;
}

function rasterize(
  svg: string,
  size: number,
  mime: string,
  quality?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Не удалось создать контекст холста"));
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        resolve(canvas.toDataURL(mime, quality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Не удалось подготовить изображение"));
    img.src = svgToDataUrl(svg);
  });
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export interface ExportResult {
  dataUrl: string;
  mime: string;
  filename: string;
}

export async function exportPattern(
  opts: ExportOptions,
  format: ExportFormat,
  quality?: number
): Promise<ExportResult> {
  const size = opts.size;
  const filename = `pattern-${size}.${FORMAT_EXT[format]}`;

  if (format === "svg") {
    const svg = buildPatternSvg(opts);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    return {
      dataUrl: URL.createObjectURL(blob),
      mime: "image/svg+xml",
      filename,
    };
  }

  const mime = FORMAT_MIME[format];
  const opaqueBg = format === "jpeg";
  const svg = buildPatternSvg(opts, opaqueBg);
  const dataUrl = await rasterize(svg, size, mime, quality);
  return { dataUrl, mime, filename };
}

export function downloadExport(result: ExportResult) {
  triggerDownload(result.dataUrl, result.filename);
}

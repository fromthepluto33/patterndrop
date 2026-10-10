"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  ArrowRight,
  Ban,
  Circle,
  Copy,
  Download,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  Minus,
  Move,
  Plus,
  Settings2,
  Shapes,
  Square,
  Trash2,
  Triangle,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { usePanelView } from "@/components/panel-view-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  downloadExport,
  exportPattern,
  type ExportFormat,
} from "@/lib/export-pattern";
import { cn } from "@/lib/utils";

type ShapeType = "circle" | "square" | "triangle" | "arrow" | "line";
type LayerType = ShapeType | "image" | "svg";
type LayoutMode = "grid" | "brick";
type BackgroundType = "color" | "image" | "transparent";

interface CanvasBackground {
  type: BackgroundType;
  color?: string;
  src?: string;
  name?: string;
}

interface Layer {
  id: string;
  name: string;
  type: LayerType;
  color: string;
  opacity: number;
  scale: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  visible: boolean;
  offset: { x: number; y: number };
  src?: string;
  rawSvg?: string;
  width?: number;
  height?: number;
}

interface EditorSnapshot {
  layers: Layer[];
  activeId: string;
  selectedIds: string[];
  layout: LayoutMode;
  spacing: number;
  background: CanvasBackground;
}

const HISTORY_LIMIT = 200;
const STRUCTURAL_CHANGE = -1;

function cloneSnapshot(s: EditorSnapshot): EditorSnapshot {
  return {
    ...s,
    layers: s.layers.map((l) => ({ ...l, offset: { ...l.offset } })),
    background: { ...s.background },
  };
}

function arrEq(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function bgEq(a: CanvasBackground, b: CanvasBackground): boolean {
  return (
    a.type === b.type &&
    a.color === b.color &&
    a.src === b.src &&
    a.name === b.name
  );
}

function layerPropsDiffer(a: Layer, b: Layer): string[] {
  const diff: string[] = [];
  if (a.name !== b.name) diff.push("name");
  if (a.type !== b.type) diff.push("type");
  if (a.color !== b.color) diff.push("color");
  if (a.opacity !== b.opacity) diff.push("opacity");
  if (a.scale !== b.scale) diff.push("scale");
  if (a.rotation !== b.rotation) diff.push("rotation");
  if (a.flipH !== b.flipH) diff.push("flipH");
  if (a.flipV !== b.flipV) diff.push("flipV");
  if (a.visible !== b.visible) diff.push("visible");
  if (a.offset.x !== b.offset.x || a.offset.y !== b.offset.y)
    diff.push("offset");
  return diff;
}

function historyDiffCount(a: EditorSnapshot, b: EditorSnapshot): number {
  if (a.layers.length !== b.layers.length) return STRUCTURAL_CHANGE;
  let dims = 0;
  if (a.layout !== b.layout) dims++;
  if (a.spacing !== b.spacing) dims++;
  if (a.activeId !== b.activeId) dims++;
  if (!arrEq(a.selectedIds, b.selectedIds)) dims++;
  if (!bgEq(a.background, b.background)) dims++;
  let offsetGroups = 0;
  let propDiffs = 0;
  for (let i = 0; i < a.layers.length; i++) {
    const la = a.layers[i];
    const lb = b.layers[i];
    if (la.id !== lb.id) return STRUCTURAL_CHANGE;
    const diffs = layerPropsDiffer(la, lb);
    if (diffs.length === 0) continue;
    if (diffs.length === 1 && diffs[0] === "offset") offsetGroups = 1;
    else propDiffs += diffs.length;
  }
  return dims + offsetGroups + propDiffs;
}

const SHAPES: { type: ShapeType; label: string; Icon: LucideIcon }[] = [
  { type: "circle", label: "Круг", Icon: Circle },
  { type: "square", label: "Квадрат", Icon: Square },
  { type: "triangle", label: "Треугольник", Icon: Triangle },
  { type: "arrow", label: "Стрелка", Icon: ArrowRight },
  { type: "line", label: "Линия", Icon: Minus },
];

const PRESET_COLORS = [
  "#8b5cf6",
  "#f472b6",
  "#22d3ee",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#1e293b",
  "#ffffff",
  "#000000",
];

const START_LAYERS: Layer[] = [
  {
    id: "l1",
    name: "Фигура · Круг",
    type: "circle",
    color: "#8b5cf6",
    opacity: 90,
    scale: 100,
    rotation: 0,
    flipH: false,
    flipV: false,
    visible: true,
    offset: { x: 0, y: 0 },
  },
  {
    id: "l2",
    name: "Фигура · Треугольник",
    type: "triangle",
    color: "#f472b6",
    opacity: 100,
    scale: 85,
    rotation: 0,
    flipH: false,
    flipV: false,
    visible: true,
    offset: { x: 0, y: 0 },
  },
  {
    id: "l3",
    name: "Фигура · Квадрат",
    type: "square",
    color: "#22d3ee",
    opacity: 70,
    scale: 65,
    rotation: 45,
    flipH: false,
    flipV: false,
    visible: true,
    offset: { x: 0, y: 0 },
  },
];

const LAYOUT_LABELS: Record<LayoutMode, string> = {
  grid: "Обычная сетка",
  brick: "Кирпичная кладка",
};

const BASE_TILE = 110;

let idCounter = 1000;
const nextId = () => `l${++idCounter}`;

const isColorable = (layer: Layer) => layer.type !== "image";

type AlignMode = "left" | "centerX" | "right" | "top" | "middleY" | "bottom";
type AlignTarget = "canvas" | "layer";

function getExtents(layer: Layer): { hx: number; hy: number } {
  const s = layer.scale / 100;
  const size = 26;
  let hx: number;
  let hy: number;
  if (layer.type === "image" || layer.type === "svg") {
    const iw = layer.width ?? 200;
    const ih = layer.height ?? 200;
    const box = size * 2;
    const ar = iw / ih;
    hx = (ar >= 1 ? box : box * ar) / 2;
    hy = (ar >= 1 ? box / ar : box) / 2;
  } else {
    switch (layer.type) {
      case "circle":
        hx = size;
        hy = size;
        break;
      case "square":
        hx = size * 0.7;
        hy = size * 0.7;
        break;
      case "triangle":
        hx = size * 0.87;
        hy = size;
        break;
      case "arrow":
        hx = size * 0.75;
        hy = 8;
        break;
      case "line":
        hx = size;
        hy = 1.75;
        break;
      default:
        hx = size;
        hy = size;
    }
  }
  return { hx: hx * s, hy: hy * s };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function measureImage(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () =>
      resolve({ w: img.naturalWidth || 200, h: img.naturalHeight || 200 });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function decodeDataUrl(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  const meta = dataUrl.slice(0, idx);
  const data = dataUrl.slice(idx + 1);
  if (meta.includes(";base64")) {
    const bin = window.atob(data);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  return decodeURIComponent(data);
}

function svgDataUrl(svgText: string): string {
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
  return svgDataUrl(styled);
}

export function PatternEditor() {
  const [layers, setLayers] = useState<Layer[]>(START_LAYERS);
  const [activeId, setActiveId] = useState("l1");
  const [selectedIds, setSelectedIds] = useState<string[]>(["l1"]);
  const [groups, setGroups] = useState<string[][]>([]);
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const [spacing, setSpacing] = useState(24);
  const [background, setBackground] = useState<CanvasBackground>({
    type: "color",
    color: "#ffffff",
  });
  const {
    uiVisible,
    settingsOpen,
    layersOpen,
    setUiVisible,
    setSettingsOpen,
    setLayersOpen,
    toggleUi,
    toggleSettings,
    toggleLayers,
  } = usePanelView();
  const [exportSize, setExportSize] = useState(1024);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportQuality, setExportQuality] = useState(92);
  const [exporting, setExporting] = useState(false);

  const pastRef = useRef<EditorSnapshot[]>([]);
  const futureRef = useRef<EditorSnapshot[]>([]);
  const stateRef = useRef<EditorSnapshot>({
    layers: START_LAYERS,
    activeId: "l1",
    selectedIds: ["l1"],
    layout: "grid",
    spacing: 24,
    background: { type: "color", color: "#ffffff" },
  });
  stateRef.current = {
    layers,
    activeId,
    selectedIds,
    layout,
    spacing,
    background,
  };

  const pushHistory = useCallback(() => {
    const cur = cloneSnapshot(stateRef.current);
    const last = pastRef.current.length
      ? pastRef.current[pastRef.current.length - 1]
      : undefined;
    if (last) {
      const d = historyDiffCount(last, cur);
      if (d === 0) return;
      if (d !== STRUCTURAL_CHANGE && d === 1) return;
    }
    pastRef.current = [...pastRef.current, cur].slice(-HISTORY_LIMIT);
    futureRef.current = [];
  }, []);

  const applySnapshot = useCallback((s: EditorSnapshot) => {
    setLayers(s.layers);
    setActiveId(s.activeId);
    setSelectedIds(s.selectedIds);
    setLayout(s.layout);
    setSpacing(s.spacing);
    setBackground(s.background);
  }, []);

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(cloneSnapshot(stateRef.current));
    applySnapshot(prev);
  }, [applySnapshot]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(cloneSnapshot(stateRef.current));
    applySnapshot(next);
  }, [applySnapshot]);

  const active = layers.find((l) => l.id === activeId) ?? layers[0];
  const visibleLayers = layers.filter((l) => l.visible);
  const allVector =
    visibleLayers.length > 0 && visibleLayers.every((l) => l.type !== "image");

  const handleExport = async () => {
    if (visibleLayers.length === 0) return;
    setExporting(true);
    try {
      const result = await exportPattern(
        {
          size: exportSize,
          layers: visibleLayers,
          layout,
          spacing,
          background,
        },
        exportFormat,
        exportQuality / 100
      );
      downloadExport(result);
      toast.success(
        `Паттерн ${exportSize}px · ${exportFormat.toUpperCase()} скачан`
      );
    } catch {
      toast.error("Не удалось выполнить экспорт");
    } finally {
      setExporting(false);
    }
  };

  const updateLayer = (id: string, patch: Partial<Layer>) => {
    pushHistory();
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
    );
  };

  const handleBackgroundChange = (bg: CanvasBackground) => {
    pushHistory();
    setBackground(bg);
    if (bg.type === "transparent" && exportFormat === "jpeg") {
      setExportFormat("png");
    }
  };

  const updateActive = (patch: Partial<Layer>) => {
    if (!active) return;
    updateLayer(active.id, patch);
  };

  const resetOffset = () => {
    pushHistory();
    if (selectedIds.length > 0) {
      setLayers((prev) =>
        prev.map((l) =>
          selectedIds.includes(l.id) ? { ...l, offset: { x: 0, y: 0 } } : l
        )
      );
    } else if (active) {
      updateLayer(active.id, { offset: { x: 0, y: 0 } });
    }
  };

  const handleDragOffset = useCallback(
    (ids: string[], dx: number, dy: number) => {
      pushHistory();
      if (ids.length === 0) return;
      const patches: Record<string, { x: number; y: number }> = {};
      for (const id of ids) {
        const target = layers.find((l) => l.id === id);
        if (!target) continue;
        patches[id] = {
          x: Math.round(target.offset.x + dx),
          y: Math.round(target.offset.y + dy),
        };
      }
      setLayers((prev) =>
        prev.map((l) => (patches[l.id] ? { ...l, offset: patches[l.id] } : l))
      );
    },
    [layers, pushHistory]
  );

  const selectLayer = (id: string, additive: boolean) => {
    setActiveId(id);
    const group = groups.find((g) => g.includes(id));
    if (additive) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
    } else if (group) {
      setSelectedIds(group);
    } else {
      setSelectedIds([id]);
    }
  };

  const toggleGroup = () => {
    const sel = selectedIds.filter((id) => layers.some((l) => l.id === id));
    if (sel.length === 0) return;
    const exact = groups.find(
      (g) =>
        g.length === sel.length &&
        [...g].sort().join(",") === [...sel].sort().join(",")
    );
    if (exact) {
      setGroups((prev) => prev.filter((g) => g !== exact));
      toast.success("Слои разгруппированы");
    } else if (sel.length > 1) {
      setGroups((prev) => [...prev, sel]);
      toast.success(`Сгруппировано слоёв: ${sel.length}`);
    } else {
      setGroups((prev) =>
        prev
          .map((g) => g.filter((x) => x !== sel[0]))
          .filter((g) => g.length > 0)
      );
      toast.success("Слой исключён из группы");
    }
  };

  const ungroupSelection = () => {
    const sel = selectedIds;
    if (sel.length === 0) return;
    setGroups((prev) =>
      prev
        .map((g) => g.filter((x) => !sel.includes(x)))
        .filter((g) => g.length > 0)
    );
    toast.success("Слои разгруппированы");
  };

  const selectAll = () => {
    if (layers.length === 0) return;
    setSelectedIds(layers.map((l) => l.id));
  };

  const toggleSelectAllLayers = () => {
    if (layers.length === 0) return;
    if (selectedIds.length === layers.length) {
      pushHistory();
      setSelectedIds([]);
      setActiveId("");
    } else {
      pushHistory();
      selectAll();
      setActiveId(layers[layers.length - 1].id);
    }
  };

  const reorderActive = (direction: "lower" | "raise" | "bottom" | "top") => {
    if (!active) return;
    const idx = layers.findIndex((l) => l.id === active.id);
    if (idx < 0) return;
    const count = layers.length;
    if (direction === "lower" && idx > 0) reorderLayer(idx, idx - 1);
    else if (direction === "raise" && idx < count - 1)
      reorderLayer(idx, idx + 1);
    else if (direction === "bottom" && idx !== 0) reorderLayer(idx, 0);
    else if (direction === "top" && idx !== count - 1)
      reorderLayer(idx, count - 1);
  };

  const handleSelectFromCanvas = (id: string, additive: boolean) =>
    selectLayer(id, additive);

  const referenceLayer = (): Layer | undefined => {
    if (!active) return undefined;
    const idx = layers.findIndex((l) => l.id === active.id);
    for (let i = idx - 1; i >= 0; i--) {
      if (layers[i].visible) return layers[i];
    }
    return undefined;
  };

  const alignLayers = (
    ids: string[],
    mode: AlignMode,
    target: AlignTarget,
    reference?: Layer
  ) => {
    const stepX = BASE_TILE + spacing;
    const stepY = stepX * 0.9;
    const patches: Record<string, { x: number; y: number }> = {};
    for (const id of ids) {
      const layer = layers.find((l) => l.id === id);
      if (!layer) continue;
      const a = getExtents(layer);
      let nx = layer.offset.x;
      let ny = layer.offset.y;
      if (target === "canvas") {
        if (mode === "left") nx = -stepX / 2 + a.hx;
        else if (mode === "centerX") nx = 0;
        else if (mode === "right") nx = stepX / 2 - a.hx;
        else if (mode === "top") ny = -stepY / 2 + a.hy;
        else if (mode === "middleY") ny = 0;
        else if (mode === "bottom") ny = stepY / 2 - a.hy;
      } else if (reference) {
        const r = getExtents(reference);
        if (mode === "left") nx = reference.offset.x - r.hx + a.hx;
        else if (mode === "centerX") nx = reference.offset.x;
        else if (mode === "right") nx = reference.offset.x + r.hx - a.hx;
        else if (mode === "top") ny = reference.offset.y - r.hy + a.hy;
        else if (mode === "middleY") ny = reference.offset.y;
        else if (mode === "bottom") ny = reference.offset.y + r.hy - a.hy;
      }
      patches[id] = { x: Math.round(nx), y: Math.round(ny) };
    }
    setLayers((prev) =>
      prev.map((l) => (patches[l.id] ? { ...l, offset: patches[l.id] } : l))
    );
  };

  const alignActive = (mode: AlignMode, target: AlignTarget) => {
    const sel =
      selectedIds.length > 0 ? selectedIds : active ? [active.id] : [];
    if (sel.length === 0) return;
    pushHistory();
    if (sel.length === 1) {
      const ref = target === "layer" ? referenceLayer() : undefined;
      alignLayers(sel, mode, target, ref);
    } else if (target === "canvas") {
      alignLayers(sel, mode, target);
    } else {
      const primary =
        layers.find((l) => l.id === activeId) ??
        layers.find((l) => l.id === sel[0]);
      if (!primary) return;
      alignLayers(
        sel.filter((id) => id !== primary.id),
        mode,
        "layer",
        primary
      );
    }
  };

  const addShape = (type: ShapeType) => {
    const def = SHAPES.find((s) => s.type === type);
    if (!def) return;
    pushHistory();
    const layer: Layer = {
      id: nextId(),
      name: `Фигура · ${def.label}`,
      type,
      color: "#8b5cf6",
      opacity: 100,
      scale: 100,
      rotation: 0,
      flipH: false,
      flipV: false,
      visible: true,
      offset: { x: 0, y: 0 },
    };
    setLayers((prev) => [...prev, layer]);
    setActiveId(layer.id);
    setSelectedIds([layer.id]);
    toast.success(`Слой «${layer.name}» добавлен`);
  };

  const addImageFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      toast.error("Поддерживаются только файлы изображений");
      return;
    }
    pushHistory();
    const created: Layer[] = [];
    for (const file of images) {
      const isSvg =
        file.type === "image/svg+xml" ||
        file.name.toLowerCase().endsWith(".svg");
      const dataUrl = await readAsDataURL(file);
      const dims = await measureImage(dataUrl);
      let rawSvg: string | undefined;
      if (isSvg) rawSvg = decodeDataUrl(dataUrl);
      const name =
        file.name.replace(/\.[^.]+$/, "") || (isSvg ? "SVG" : "Изображение");
      created.push({
        id: nextId(),
        name,
        type: isSvg ? "svg" : "image",
        color: "#8b5cf6",
        opacity: 100,
        scale: 100,
        rotation: 0,
        flipH: false,
        flipV: false,
        visible: true,
        offset: { x: 0, y: 0 },
        src: isSvg ? undefined : dataUrl,
        rawSvg,
        width: dims?.w ?? 200,
        height: dims?.h ?? 200,
      });
    }
    setLayers((prev) => [...prev, ...created]);
    setActiveId(created[created.length - 1].id);
    setSelectedIds([created[created.length - 1].id]);
    toast.success(
      created.length === 1
        ? `Слой «${created[0].name}» добавлен`
        : `Добавлено слоёв: ${created.length}`
    );
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length) void addImageFiles(files);
  };

  const duplicateLayer = (id: string) => {
    const orig = layers.find((l) => l.id === id);
    if (!orig) return;
    pushHistory();
    const copy: Layer = {
      ...orig,
      id: nextId(),
      name: `${orig.name} · копия`,
      offset: { ...orig.offset },
    };
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setActiveId(copy.id);
    setSelectedIds([copy.id]);
    toast.success("Слой продублирован");
  };

  const handleClearAll = () => {
    pushHistory();
    setLayers([]);
    setActiveId("");
    setSelectedIds([]);
    setBackground({ type: "color", color: "#ffffff" });
    toast.success("Страница очищена");
  };

  const removeLayers = useCallback(
    (ids: string[]) => {
      pushHistory();
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const next = layers.filter((l) => !idSet.has(l.id));
      const removedCount = layers.length - next.length;
      setLayers(next);
      setSelectedIds((prev) => prev.filter((x) => !idSet.has(x)));
      setGroups((prev) =>
        prev
          .map((g) => g.filter((x) => !idSet.has(x)))
          .filter((g) => g.length > 0)
      );
      if (idSet.has(activeId)) {
        const removedIdx = layers.findIndex((l) => l.id === activeId);
        setActiveId(
          next[Math.max(0, Math.min(removedIdx, next.length - 1))]?.id ?? ""
        );
      }
      if (removedCount > 0)
        toast.success(
          removedCount === 1 ? "Слой удалён" : `Удалено слоёв: ${removedCount}`
        );
    },
    [layers, activeId, pushHistory]
  );

  const removeLayer = useCallback(
    (id: string) => {
      removeLayers([id]);
    },
    [removeLayers]
  );

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const ctrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (ctrl && key === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (ctrl && key === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (ctrl && key === "s") {
        e.preventDefault();
        void handleExport();
        return;
      }
      if (ctrl && key === "d") {
        e.preventDefault();
        if (active) duplicateLayer(active.id);
        return;
      }
      if (ctrl && key === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelection();
        else toggleGroup();
        return;
      }
      if (ctrl && key === "a") {
        e.preventDefault();
        selectAll();
        return;
      }
      if (ctrl && key === "0") {
        e.preventDefault();
        if (active) updateActive({ offset: { x: 0, y: 0 } });
        return;
      }
      if (ctrl && e.key === "[") {
        e.preventDefault();
        reorderActive(e.shiftKey ? "bottom" : "lower");
        return;
      }
      if (ctrl && e.key === "]") {
        e.preventDefault();
        reorderActive(e.shiftKey ? "top" : "raise");
        return;
      }
      if (e.key === "Escape") {
        setGroups([]);
        return;
      }
      if (key === "e") {
        e.preventDefault();
        toggleUi();
        return;
      }
      if (key === "1") {
        e.preventDefault();
        toggleSettings();
        return;
      }
      if (key === "2") {
        e.preventDefault();
        toggleLayers();
        return;
      }
      if (key === "x") {
        e.preventDefault();
        if (active) updateActive({ flipH: !active.flipH });
        return;
      }
      if (key === "y") {
        e.preventDefault();
        if (active) updateActive({ flipV: !active.flipV });
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const ids =
          selectedIds.length > 0 ? selectedIds : active ? [active.id] : [];
        removeLayers(ids);
        return;
      }
      const deltas: Record<string, { x: number; y: number }> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      const delta = deltas[e.key];
      if (!delta) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const ids =
        selectedIds.length > 0 ? selectedIds : active ? [active.id] : [];
      handleDragOffset(ids, delta.x * step, delta.y * step);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    layers,
    active,
    activeId,
    selectedIds,
    handleDragOffset,
    removeLayers,
    undo,
    redo,
    handleExport,
    duplicateLayer,
    updateActive,
    selectAll,
    reorderActive,
    toggleGroup,
    ungroupSelection,
    toggleUi,
    toggleSettings,
    toggleLayers,
  ]);

  const reorderLayer = (from: number, to: number) => {
    if (from === to) return;
    pushHistory();
    setLayers((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const changeLayout = (mode: LayoutMode) => {
    pushHistory();
    setLayout(mode);
  };

  const changeSpacing = (value: number) => {
    pushHistory();
    setSpacing(value);
  };

  return (
    <div
      className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-muted/40"
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files"))
          e.preventDefault();
      }}
      onDrop={handleDropFiles}
    >
      <PatternCanvas
        layers={layers}
        selectedIds={selectedIds}
        layout={layout}
        spacing={spacing}
        background={background}
        onDragOffset={handleDragOffset}
        onResetOffset={resetOffset}
        onSelect={handleSelectFromCanvas}
      />

      {uiVisible && active && (
        <OffsetIndicator
          x={active.offset.x}
          y={active.offset.y}
          count={selectedIds.length}
          onReset={resetOffset}
        />
      )}

      {!uiVisible && (
        <button
          aria-label="Показать интерфейс"
          title="Показать интерфейс"
          onClick={() => setUiVisible(true)}
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border bg-background/90 px-3 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:bg-background"
        >
          <Eye className="size-4" />
          Показать интерфейс
        </button>
      )}

      {uiVisible && settingsOpen && (
        <SettingsPanel
          layout={layout}
          onLayoutChange={changeLayout}
          spacing={spacing}
          onSpacingChange={changeSpacing}
          layer={active}
          selectedCount={selectedIds.length}
          hasLayers={layers.length > 0}
          onLayerChange={updateActive}
          onAlign={alignActive}
          canAlignLayer={referenceLayer() !== undefined}
          background={background}
          onBackgroundChange={handleBackgroundChange}
          exportSize={exportSize}
          onExportSizeChange={setExportSize}
          exportFormat={exportFormat}
          onExportFormatChange={setExportFormat}
          exportQuality={exportQuality}
          onExportQualityChange={setExportQuality}
          canExport={visibleLayers.length > 0}
          allVector={allVector}
          exporting={exporting}
          onExport={handleExport}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {uiVisible && layersOpen && (
        <LayersPanel
          layers={layers}
          selectedIds={selectedIds}
          onSelect={selectLayer}
          onToggleSelectAll={toggleSelectAllLayers}
          onToggleVisibility={(id, visible) => updateLayer(id, { visible })}
          onRemove={removeLayer}
          onDuplicate={duplicateLayer}
          onReorder={reorderLayer}
          onAddShape={addShape}
          onAddImageFiles={(files) => void addImageFiles(files)}
          onClearAll={handleClearAll}
          onClose={() => setLayersOpen(false)}
        />
      )}
    </div>
  );
}

function PatternCanvas({
  layers,
  selectedIds,
  layout,
  spacing,
  background,
  onDragOffset,
  onResetOffset,
  onSelect,
}: {
  layers: Layer[];
  selectedIds: string[];
  layout: LayoutMode;
  spacing: number;
  background: CanvasBackground;
  onDragOffset: (ids: string[], dx: number, dy: number) => void;
  onResetOffset: () => void;
  onSelect: (id: string, additive: boolean) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const update = () =>
      setSize({ width: svg.clientWidth, height: svg.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  const W = size.width || 600;
  const H = size.height || 400;

  const tileSize = BASE_TILE + spacing;
  const stepX = tileSize;
  const stepY = tileSize * 0.9;
  const cols = Math.ceil(W / stepX) + 2;
  const rows = Math.ceil(H / stepY) + 2;

  let bgStyle: React.CSSProperties = {};
  if (background.type === "color") {
    bgStyle = { background: background.color };
  } else if (background.type === "image") {
    bgStyle = {
      backgroundImage: `url(${background.src})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  } else {
    bgStyle = {
      backgroundImage:
        "linear-gradient(45deg,#d4d4d8 25%,transparent 25%),linear-gradient(-45deg,#d4d4d8 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d4d4d8 75%),linear-gradient(-45deg,transparent 75%,#d4d4d8 75%)",
      backgroundSize: "20px 20px",
      backgroundPosition: "0 0,0 10px,10px -10px,-10px 0",
    };
  }

  const tiles: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    let shiftX = 0;
    if (layout === "brick") shiftX = r % 2 === 1 ? stepX / 2 : 0;
    const baseY = -stepY + r * stepY;
    for (let c = 0; c < cols; c++) {
      const x = -stepX + c * stepX + shiftX;
      tiles.push({ x, y: baseY });
    }
  }

  const dragIdsRef = useRef<string[]>([]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      className="block h-full w-full"
      style={bgStyle}
      onPointerDown={(e) => {
        const target = e.target as Element;
        const motifEl = target.closest?.("[data-layer-id]");
        const layerId = motifEl?.getAttribute("data-layer-id");
        if (layerId) {
          const additive = e.ctrlKey || e.metaKey || e.shiftKey;
          if (selectedIds.includes(layerId)) {
            dragIdsRef.current = selectedIds;
          } else if (additive) {
            onSelect(layerId, true);
            dragIdsRef.current = [...selectedIds, layerId];
          } else {
            onSelect(layerId, false);
            dragIdsRef.current = [layerId];
          }
        } else {
          dragIdsRef.current = [];
        }
        target.setPointerCapture?.(e.pointerId);
        const startX = e.clientX;
        const startY = e.clientY;
        const onMove = (ev: PointerEvent) => {
          onDragOffset(
            dragIdsRef.current,
            ev.clientX - startX,
            ev.clientY - startY
          );
        };
        const onUp = () => {
          dragIdsRef.current = [];
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }}
      onDoubleClick={onResetOffset}
    >
      {tiles.map((t, i) => (
        <g key={i}>
          {layers.map((layer) => {
            if (!layer.visible) return null;
            return (
              <Motif
                key={layer.id}
                layer={layer}
                x={t.x + layer.offset.x}
                y={t.y + layer.offset.y}
                selected={selectedIds.includes(layer.id)}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function Motif({
  layer,
  x,
  y,
  selected,
}: {
  layer: Layer;
  x: number;
  y: number;
  selected?: boolean;
}) {
  const s = layer.scale / 100;
  const sx = layer.flipH ? -1 : 1;
  const sy = layer.flipV ? -1 : 1;
  const size = 26;
  const opacity = layer.opacity / 100;

  const isImage = layer.type === "image" || layer.type === "svg";
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

  const href =
    layer.type === "svg" ? tintSvg(layer.rawSvg ?? "", layer.color) : layer.src;

  const { hx, hy } = getExtents(layer);
  const pad = 4;
  const bx = hx + pad;
  const by = hy + pad;

  return (
    <g transform={`translate(${x} ${y})`} data-layer-id={layer.id}>
      {selected && (
        <rect
          x={-bx}
          y={-by}
          width={bx * 2}
          height={by * 2}
          rx={6}
          fill="none"
          stroke="#6366f1"
          strokeWidth={1.5}
          strokeDasharray="5 4"
          className="pointer-events-none"
        />
      )}
      <g
        transform={`scale(${sx},${sy}) rotate(${layer.rotation}) scale(${s})`}
        opacity={opacity}
        fill={layer.color}
      >
        {layer.type === "circle" && <circle r={size} />}
        {layer.type === "square" && (
          <rect
            x={-size * 0.7}
            y={-size * 0.7}
            width={size * 1.4}
            height={size * 1.4}
          />
        )}
        {layer.type === "triangle" && (
          <polygon
            points={`0,${-size} ${-size * 0.87},${size * 0.55} ${size * 0.87},${size * 0.55}`}
          />
        )}
        {layer.type === "arrow" && (
          <g>
            <rect
              x={-size * 0.75}
              y={-1.75}
              width={size * 1.35}
              height={3.5}
              rx={1.75}
            />
            <polygon
              points={`${size * 0.45},0 ${size * 0.45 - 9},-8 ${size * 0.45 - 9},8`}
            />
          </g>
        )}
        {layer.type === "line" && (
          <rect x={-size} y={-1.75} width={size * 2} height={3.5} rx={1.75} />
        )}
        {isImage && (
          <image
            href={href}
            x={-imgW / 2}
            y={-imgH / 2}
            width={imgW}
            height={imgH}
            preserveAspectRatio="xMidYMid meet"
          />
        )}
      </g>
    </g>
  );
}

function DraggablePanel({
  title,
  icon,
  align = "left",
  offset = { x: 16, y: 72 },
  onClose,
  className,
  footer,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  align?: "left" | "right";
  offset?: { x: number; y: number };
  onClose: () => void;
  className?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const clampPos = (nx: number, ny: number) => {
    const el = panelRef.current;
    const w = el?.offsetWidth ?? 240;
    const h = el?.offsetHeight ?? 160;
    const minY = 56;
    return {
      x: Math.min(Math.max(nx, 0), Math.max(0, window.innerWidth - w)),
      y: Math.min(Math.max(ny, minY), Math.max(minY, window.innerHeight - h)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, label")) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = rect.left;
    const originY = rect.top;
    const onMove = (ev: PointerEvent) => {
      setPos(
        clampPos(
          originX + (ev.clientX - startX),
          originY + (ev.clientY - startY)
        )
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos(clampPos(pos.x, pos.y));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  return (
    <div
      ref={panelRef}
      className={cn(
        "pointer-events-auto fixed z-40 flex max-h-[calc(100vh-4.5rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-xl",
        className
      )}
      style={
        pos
          ? { left: pos.x, top: pos.y }
          : align === "right"
            ? { right: offset.x, top: offset.y }
            : { left: offset.x, top: offset.y }
      }
    >
      <div
        onPointerDown={handlePointerDown}
        className="flex h-9 shrink-0 cursor-move select-none items-center justify-between gap-2 border-b px-3"
        title="Перетащите панель в удобное место"
      >
        <span className="flex min-w-0 items-center gap-2 truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <GripVertical className="size-4 shrink-0" />
          {icon}
          {title}
        </span>
        <button
          aria-label={`Закрыть панель «${title}»`}
          title="Закрыть"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      {footer && <div className="shrink-0 border-t">{footer}</div>}
    </div>
  );
}

function OffsetIndicator({
  x,
  y,
  count,
  onReset,
}: {
  x: number;
  y: number;
  count: number;
  onReset: () => void;
}) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
      <span className="flex items-center gap-1">
        <Move className="size-3.5" />
        {count > 1 ? `Смещение (${count} слоёв)` : "Смещение"}
      </span>
      <span className="font-medium text-foreground">
        X {x > 0 ? "+" : ""}
        {x}px · Y {y > 0 ? "+" : ""}
        {y}px
      </span>
      {(x !== 0 || y !== 0) && (
        <button
          className="pointer-events-auto rounded-full px-1.5 text-xs font-medium text-primary hover:underline"
          onClick={onReset}
        >
          сброс
        </button>
      )}
    </div>
  );
}

function OffsetControl({
  x,
  y,
  onCommit,
}: {
  x: number;
  y: number;
  onCommit: (axis: "x" | "y", value: number) => void;
}) {
  const [focused, setFocused] = useState<"x" | "y" | null>(null);
  const [draftX, setDraftX] = useState(String(x));
  const [draftY, setDraftY] = useState(String(y));
  const [prev, setPrev] = useState({ x, y });

  if ((prev.x !== x || prev.y !== y) && focused === null) {
    setPrev({ x, y });
    setDraftX(String(x));
    setDraftY(String(y));
  }

  const field = (
    label: string,
    axis: "x" | "y",
    value: string,
    onChange: (v: string) => void
  ) => (
    <label className="flex items-center gap-1.5">
      <span className="w-3 shrink-0 text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      <Input
        type="text"
        inputMode="numeric"
        value={value}
        aria-label={`Смещение по оси ${label}`}
        className="h-7 w-full px-2 text-right text-xs"
        onFocus={() => setFocused(axis)}
        onBlur={() => {
          setFocused(null);
          const raw = value.trim();
          if (raw !== "" && !Number.isNaN(Number(raw)))
            onCommit(axis, Number(raw));
        }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
      <span className="w-4 shrink-0 text-[10px] leading-none text-muted-foreground">
        px
      </span>
    </label>
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      {field("X", "x", draftX, setDraftX)}
      {field("Y", "y", draftY, setDraftY)}
    </div>
  );
}

const ALIGN_X_MODES: { key: AlignMode; label: string; Icon: LucideIcon }[] = [
  { key: "left", label: "По левому краю", Icon: AlignHorizontalJustifyStart },
  {
    key: "centerX",
    label: "По центру по горизонтали",
    Icon: AlignHorizontalJustifyCenter,
  },
  { key: "right", label: "По правому краю", Icon: AlignHorizontalJustifyEnd },
];

const ALIGN_Y_MODES: { key: AlignMode; label: string; Icon: LucideIcon }[] = [
  { key: "top", label: "По верхнему краю", Icon: AlignVerticalJustifyStart },
  {
    key: "middleY",
    label: "По середине по вертикали",
    Icon: AlignVerticalJustifyCenter,
  },
  { key: "bottom", label: "По нижнему краю", Icon: AlignVerticalJustifyEnd },
];

function AlignmentControls({
  onAlign,
  canAlignLayer,
  relativeLabel = "Относительно слоя ниже",
}: {
  onAlign: (mode: AlignMode, target: AlignTarget) => void;
  canAlignLayer: boolean;
  relativeLabel?: string;
}) {
  const renderRow = (
    title: string,
    modes: typeof ALIGN_X_MODES,
    target: AlignTarget,
    disabled: boolean
  ) => (
    <div className="space-y-1">
      <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <div className="flex gap-1">
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            title={m.label}
            aria-label={m.label}
            disabled={disabled}
            onClick={() => onAlign(m.key, target)}
            className="flex h-7 flex-1 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <m.Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      {renderRow("Относительно холста", ALIGN_X_MODES, "canvas", false)}
      {renderRow("Относительно холста", ALIGN_Y_MODES, "canvas", false)}
      <Separator className="my-1" />
      {renderRow(relativeLabel, ALIGN_X_MODES, "layer", !canAlignLayer)}
      {renderRow(relativeLabel, ALIGN_Y_MODES, "layer", !canAlignLayer)}
    </div>
  );
}

function SettingsPanel({
  layout,
  onLayoutChange,
  spacing,
  onSpacingChange,
  layer,
  selectedCount,
  hasLayers,
  onLayerChange,
  onAlign,
  canAlignLayer,
  background,
  onBackgroundChange,
  exportSize,
  onExportSizeChange,
  exportFormat,
  onExportFormatChange,
  exportQuality,
  onExportQualityChange,
  canExport,
  allVector,
  exporting,
  onExport,
  onClose,
}: {
  layout: LayoutMode;
  onLayoutChange: (m: LayoutMode) => void;
  spacing: number;
  onSpacingChange: (n: number) => void;
  layer: Layer | undefined;
  selectedCount: number;
  hasLayers: boolean;
  onLayerChange: (patch: Partial<Layer>) => void;
  onAlign: (mode: AlignMode, target: AlignTarget) => void;
  canAlignLayer: boolean;
  background: CanvasBackground;
  onBackgroundChange: (bg: CanvasBackground) => void;
  exportSize: number;
  onExportSizeChange: (n: number) => void;
  exportFormat: ExportFormat;
  onExportFormatChange: (f: ExportFormat) => void;
  exportQuality: number;
  onExportQualityChange: (n: number) => void;
  canExport: boolean;
  allVector: boolean;
  exporting: boolean;
  onExport: () => void;
  onClose: () => void;
}) {
  return (
    <DraggablePanel
      title="Настройки"
      icon={<Settings2 className="size-3.5" />}
      align="left"
      offset={{ x: 16, y: 72 }}
      onClose={onClose}
      className="w-[32rem] max-w-[calc(100vw-2rem)]"
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-0 p-4">
        <section className="space-y-2.5">
          <SectionTitle>Выбранные слои</SectionTitle>
          {selectedCount > 1 ? (
            <>
              <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
                <span className="text-sm font-medium">
                  Выбрано слоёв: {selectedCount}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Индивидуальные свойства отдельного слоя недоступны при
                мультивыборе. Перемещение и выравнивание применяются сразу ко
                всем выбранным слоям.
              </p>
              <Separator className="my-1.5" />
              <SectionTitle>Выравнивание</SectionTitle>
              <AlignmentControls
                onAlign={onAlign}
                canAlignLayer
                relativeLabel="Относительно активного слоя"
              />
            </>
          ) : layer ? (
            <>
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium">
                  {layer.name}
                </span>
                <div
                  className="size-4 shrink-0 rounded-full ring-1 ring-foreground/10"
                  style={{ background: layer.color }}
                />
              </div>
              {isColorable(layer) && (
                <ColorPalette
                  value={layer.color}
                  onChange={(c) => onLayerChange({ color: c })}
                />
              )}
              <NumberSlider
                label="Масштаб"
                suffix="%"
                value={layer.scale}
                min={1}
                max={300}
                onChange={(n) => onLayerChange({ scale: n })}
              />
              <NumberSlider
                label="Поворот"
                suffix="°"
                value={layer.rotation}
                min={0}
                max={360}
                onChange={(n) => onLayerChange({ rotation: n })}
              />
              <NumberSlider
                label="Прозрачность"
                suffix="%"
                value={layer.opacity}
                min={1}
                max={100}
                onChange={(n) => onLayerChange({ opacity: n })}
              />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <CheckboxField
                  label="По горизонтали"
                  checked={layer.flipH}
                  onCheckedChange={(c) => onLayerChange({ flipH: c })}
                />
                <CheckboxField
                  label="По вертикали"
                  checked={layer.flipV}
                  onCheckedChange={(c) => onLayerChange({ flipV: c })}
                />
              </div>
              <Separator className="my-1.5" />
              <SectionTitle>Смещение</SectionTitle>
              <OffsetControl
                key={layer.id}
                x={layer.offset.x}
                y={layer.offset.y}
                onCommit={(axis, value) =>
                  onLayerChange({
                    offset: {
                      ...layer.offset,
                      [axis]: value,
                    },
                  })
                }
              />
              <Separator className="my-1.5" />
              <SectionTitle>Выравнивание</SectionTitle>
              <AlignmentControls
                onAlign={onAlign}
                canAlignLayer={canAlignLayer}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {hasLayers
                ? "Выберите хотя бы один слой, чтобы увидеть настройки."
                : "Нет слоёв. Добавьте фигуру или изображение."}
            </p>
          )}

          <Separator className="my-2.5" />

          <SectionTitle>Раскладка</SectionTitle>
          <div className="flex flex-col gap-1.5">
            {(Object.keys(LAYOUT_LABELS) as LayoutMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => onLayoutChange(mode)}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  layout === mode
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {LAYOUT_LABELS[mode]}
                {layout === mode && (
                  <Badge className="size-4 rounded-full p-0 text-[10px]">
                    ✓
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2.5">
          <NumberSlider
            label="Отступы между мотивами"
            suffix="px"
            value={spacing}
            min={0}
            max={100}
            onChange={onSpacingChange}
          />

          <Separator className="my-2.5" />

          <SectionTitle>Фон холста</SectionTitle>
          <BackgroundControl
            background={background}
            onChange={onBackgroundChange}
          />

          <Separator className="my-2" />

          <SectionTitle>Экспорт</SectionTitle>
          <ExportControl
            size={exportSize}
            onSizeChange={onExportSizeChange}
            format={exportFormat}
            onFormatChange={onExportFormatChange}
            quality={exportQuality}
            onQualityChange={onExportQualityChange}
            canExport={canExport}
            allVector={allVector}
            exporting={exporting}
            jpegDisabled={background.type === "transparent"}
            onExport={onExport}
          />
        </section>
      </div>
    </DraggablePanel>
  );
}

const EXPORT_FORMATS: { key: ExportFormat; label: string }[] = [
  { key: "png", label: "PNG" },
  { key: "jpeg", label: "JPEG" },
  { key: "webp", label: "WEBP" },
  { key: "svg", label: "SVG" },
];

function ExportControl({
  size,
  onSizeChange,
  format,
  onFormatChange,
  quality,
  onQualityChange,
  canExport,
  allVector,
  exporting,
  jpegDisabled,
  onExport,
}: {
  size: number;
  onSizeChange: (n: number) => void;
  format: ExportFormat;
  onFormatChange: (f: ExportFormat) => void;
  quality: number;
  onQualityChange: (n: number) => void;
  canExport: boolean;
  allVector: boolean;
  exporting: boolean;
  jpegDisabled: boolean;
  onExport: () => void;
}) {
  const svgDisabled = !allVector;

  return (
    <section className="space-y-2">
      <NumberSlider
        label="Размер холста"
        suffix="px"
        value={size}
        min={1}
        max={2000}
        onChange={onSizeChange}
      />
      <div className="grid grid-cols-4 gap-1.5">
        {EXPORT_FORMATS.map((f) => {
          const disabled =
            (f.key === "svg" && svgDisabled) ||
            (f.key === "jpeg" && jpegDisabled);
          return (
            <button
              key={f.key}
              type="button"
              disabled={disabled}
              onClick={() => onFormatChange(f.key)}
              className={cn(
                "rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                disabled
                  ? "cursor-not-allowed border-border text-muted-foreground/50 opacity-50"
                  : format === f.key
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      {(format === "jpeg" || format === "webp") && (
        <NumberSlider
          label="Качество"
          suffix="%"
          value={quality}
          min={1}
          max={100}
          onChange={onQualityChange}
        />
      )}
      {svgDisabled && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Shapes className="mt-0.5 size-3.5 shrink-0" />
          SVG доступен только для полностью векторных композиций (фигуры или
          SVG-изображения). Уберите растровые изображения.
        </p>
      )}
      {jpegDisabled && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Ban className="mt-0.5 size-3.5 shrink-0" />
          JPEG не поддерживает прозрачность. Выберите PNG, WEBP или SVG для
          прозрачного фона.
        </p>
      )}
      <Button
        variant="default"
        className="w-full gap-2"
        disabled={!canExport || exporting}
        onClick={onExport}
      >
        <Download className="size-4" />
        {exporting ? "Экспортируем…" : "Экспортировать"}
      </Button>
      {!canExport && (
        <p className="text-xs text-muted-foreground">
          Добавьте хотя бы один слой, чтобы экспортировать паттерн.
        </p>
      )}
    </section>
  );
}

function BackgroundControl({
  background,
  onChange,
}: {
  background: CanvasBackground;
  onChange: (bg: CanvasBackground) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const swatches = ["#ffffff", "#f3f4f6", "#fdf2f8", "#ede9fe", "#c7d2fe"];
  const colorValue: string =
    background.type === "color" && background.color
      ? background.color
      : swatches[0];

  const pickImageFile = async (files: File[]) => {
    const file = files.find((f) => f.type.startsWith("image/"));
    if (!file) {
      toast.error("Поддерживаются только файлы изображений");
      return;
    }
    const src = await readAsDataURL(file);
    const name = file.name.replace(/\.[^.]+$/, "") || "Фон";
    onChange({ type: "image", src, name });
    toast.success(`Фон «${name}» задан`);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) void pickImageFile(files);
    e.target.value = "";
  };

  const modes: { key: BackgroundType; label: string }[] = [
    { key: "transparent", label: "Прозрачный" },
    { key: "color", label: "Сплошной цвет" },
    { key: "image", label: "Изображение" },
  ];

  return (
    <section className="space-y-2">
      <div className="flex flex-col gap-1.5">
        {modes.map((m) => (
          <button
            key={m.key}
            onClick={() => {
              if (m.key === "transparent") onChange({ type: "transparent" });
              else if (m.key === "color")
                onChange({ type: "color", color: colorValue });
              else fileInputRef.current?.click();
            }}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-1 text-sm transition-colors",
              background.type === m.key && m.key !== "image"
                ? "border-primary/40 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {m.label}
            {m.key === "image" && background.type === "image" && (
              <Badge className="size-4 rounded-full p-0 text-[10px]">✓</Badge>
            )}
          </button>
        ))}
      </div>

      {background.type === "color" && (
        <>
          <div className="flex items-center gap-2">
            {swatches.map((c) => (
              <button
                key={c}
                aria-label={`Фон ${c}`}
                onClick={() => onChange({ type: "color", color: c })}
                className={cn(
                  "size-7 rounded-full ring-1 ring-inset ring-foreground/10 transition-transform",
                  colorValue.toLowerCase() === c.toLowerCase() &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
                style={{ background: c }}
              />
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="color"
              value={colorValue}
              onChange={(e) =>
                onChange({ type: "color", color: e.target.value })
              }
              className="size-7 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
            <span className="text-xs text-muted-foreground">
              Произвольный цвет
            </span>
          </label>
        </>
      )}

      {background.type === "image" && background.src && (
        <div
          className="flex items-center gap-2 rounded-lg border p-1.5"
          onDragOver={(e) => {
            if (Array.from(e.dataTransfer.types).includes("Files"))
              e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files).filter((f) =>
              f.type.startsWith("image/")
            );
            if (files.length) void pickImageFile(files);
          }}
        >
          <div
            className="size-10 shrink-0 rounded-md ring-1 ring-border"
            style={{
              backgroundImage: `url(${background.src})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {background.name ?? "Фон"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Перетащите новое изображение или нажмите «Заменить»
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            Заменить
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 text-sm">
        <Square className="size-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          {background.type === "transparent" && "Фон прозрачный"}
          {background.type === "color" && (
            <>
              Текущий цвет:{" "}
              <span className="font-medium text-foreground">
                {background.color}
              </span>
            </>
          )}
          {background.type === "image" && (
            <>Изображение: {background.name ?? "фон"}</>
          )}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
    </section>
  );
}

function ColorPalette({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            aria-label={`Цвет ${c}`}
            onClick={() => onChange(c)}
            className={cn(
              "size-5 rounded-full ring-1 ring-inset ring-foreground/10 transition-transform",
              value.toLowerCase() === c.toLowerCase() &&
                "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
            style={{ background: c }}
          />
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-6 cursor-pointer rounded border border-border bg-transparent p-0.5"
        />
        <span className="text-xs text-muted-foreground">Произвольный цвет</span>
      </label>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

function NumberSlider({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  if (prevValue !== value && !focused) {
    setPrevValue(value);
    setDraft(String(value));
  }

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "" || Number.isNaN(Number(trimmed))) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max, Math.max(min, Number(trimmed)));
    onChange(clamped);
    setDraft(String(clamped));
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 text-sm leading-snug text-muted-foreground">
          {label}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Input
            value={draft}
            type="text"
            inputMode="decimal"
            className="h-7 w-16 px-2 text-right text-xs"
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              commit(draft);
            }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(draft);
            }}
          />
          <span className="w-5 shrink-0 text-center text-[10px] leading-none text-muted-foreground">
            {suffix}
          </span>
        </div>
      </div>
      <Slider
        value={value}
        min={min}
        max={max}
        onValueChange={(n) => onChange(Array.isArray(n) ? n[0] : n)}
      />
    </div>
  );
}

function CheckboxField({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(Boolean(c))}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
    </label>
  );
}

function LayersPanel({
  layers,
  selectedIds,
  onSelect,
  onToggleSelectAll,
  onToggleVisibility,
  onRemove,
  onDuplicate,
  onReorder,
  onAddShape,
  onAddImageFiles,
  onClearAll,
  onClose,
}: {
  layers: Layer[];
  selectedIds: string[];
  onSelect: (id: string, additive: boolean) => void;
  onToggleSelectAll: () => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onAddShape: (type: ShapeType) => void;
  onAddImageFiles: (files: File[]) => void;
  onClearAll: () => void;
  onClose: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rows = layers.map((layer, ai) => ({ layer, ai })).reverse();

  const allSelected = layers.length > 0 && selectedIds.length === layers.length;

  const layerIcon = (type: LayerType) => {
    switch (type) {
      case "circle":
        return Circle;
      case "square":
        return Square;
      case "triangle":
        return Triangle;
      case "arrow":
        return ArrowRight;
      case "line":
        return Minus;
      case "image":
        return ImageIcon;
      case "svg":
        return Shapes;
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onAddImageFiles(files);
    e.target.value = "";
  };

  const handleRowDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length) {
      onAddImageFiles(files);
      setDragFrom(null);
      return;
    }
    if (dragFrom !== null) onReorder(dragFrom, targetIndex);
    setDragFrom(null);
  };

  return (
    <DraggablePanel
      title={`Слои · ${layers.length}`}
      icon={<Layers className="size-3.5" />}
      align="right"
      offset={{ x: 16, y: 72 }}
      onClose={onClose}
      className="w-64"
      footer={
        <div className="p-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
          >
            <Plus className="size-4" />
            Добавить слой
          </Button>
          {menuOpen && (
            <div className="mt-2 space-y-0.5 rounded-lg border bg-popover p-1.5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                <ImagePlus className="size-4 text-muted-foreground" />
                Изображение с диска
              </button>
              <div className="my-1 border-t" />
              {SHAPES.map((s) => (
                <button
                  key={s.type}
                  onClick={() => {
                    onAddShape(s.type);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <s.Icon className="size-4 text-muted-foreground" />
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onFileChange}
          />
          <div className="my-2 border-t" />
          <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                  Очистить всё
                </Button>
              }
            />
            <AlertDialogContent size="sm">
              <AlertDialogHeader>
                <AlertDialogMedia>
                  <Trash2 />
                </AlertDialogMedia>
                <AlertDialogTitle>Очистить страницу?</AlertDialogTitle>
                <AlertDialogDescription>
                  Все слои и фон холста будут удалены без возможности
                  восстановления. Действие нельзя отменить.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setClearOpen(false)}>
                  Отмена
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    setClearOpen(false);
                    onClearAll();
                  }}
                >
                  Очистить всё
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="mt-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <ImagePlus className="size-3.5" />
            Перетащите изображение на панель или холст
          </div>
        </div>
      }
    >
      <div
        className="space-y-1 p-2"
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes("Files"))
            e.preventDefault();
        }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith("image/")
          );
          if (files.length) onAddImageFiles(files);
        }}
      >
        {rows.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Нет слоёв. Добавьте фигуру или перетащите изображение.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 px-2 pb-1">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onToggleSelectAll}
                aria-label={
                  allSelected
                    ? "Снять выделение со всех слоёв"
                    : "Выделить все слои"
                }
              />
              <button
                onClick={onToggleSelectAll}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {allSelected ? "Снять выделение со всех" : "Выделить все"}
              </button>
            </div>
            {rows.map(({ layer, ai }) => {
              const Icon = layerIcon(layer.type);
              const isSelected = selectedIds.includes(layer.id);
              const isDragging = dragFrom === ai;
              return (
                <div
                  key={layer.id}
                  draggable
                  role="button"
                  tabIndex={0}
                  onClick={(e) =>
                    onSelect(layer.id, e.ctrlKey || e.metaKey || e.shiftKey)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      onSelect(layer.id, e.ctrlKey || e.metaKey || e.shiftKey);
                  }}
                  onDragStart={(e) => {
                    setDragFrom(ai);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => handleRowDrop(e, ai)}
                  onDragEnd={() => setDragFrom(null)}
                  className={cn(
                    "group flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-sm transition-colors",
                    isSelected
                      ? "border-primary/40 bg-primary/10"
                      : "border-transparent hover:bg-muted",
                    isDragging && "opacity-50"
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onClick={(e) => e.stopPropagation()}
                    onCheckedChange={() => onSelect(layer.id, true)}
                    aria-label={`Выделить слой ${layer.name}`}
                  />
                  <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
                  <div
                    className="flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-foreground/10"
                    style={{ color: layer.color }}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      !layer.visible &&
                        "text-muted-foreground line-through opacity-60"
                    )}
                  >
                    {layer.name}
                  </span>
                  <button
                    aria-label="Дублировать слой"
                    title="Дублировать"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(layer.id);
                    }}
                    className="rounded-md p-1 text-muted-foreground opacity-60 transition-colors hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  >
                    <Copy className="size-4" />
                  </button>
                  <button
                    aria-label={layer.visible ? "Скрыть слой" : "Показать слой"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(layer.id, !layer.visible);
                    }}
                    className="rounded-md p-1 text-muted-foreground opacity-60 transition-colors hover:bg-muted hover:text-foreground group-hover:opacity-100"
                  >
                    {layer.visible ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </button>
                  <button
                    aria-label="Удалить слой"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(layer.id);
                    }}
                    className="rounded-md p-1 text-muted-foreground opacity-60 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </DraggablePanel>
  );
}

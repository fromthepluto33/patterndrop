"use client";

import { useState } from "react";
import { CircleHelp } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ShortcutItem {
  keys: string[];
  desc: string;
}

interface ShortcutSection {
  title: string;
  items: ShortcutItem[];
}

const SHORTCUT_SECTIONS: ShortcutSection[] = [
  {
    title: "Слои и фигуры",
    items: [
      {
        keys: ["Delete", "Backspace"],
        desc: "Удалить активный (или все выделенные) слой",
      },
      { keys: ["Ctrl", "D"], desc: "Дублировать активный слой" },
      { keys: ["Ctrl", "G"], desc: "Сгруппировать выделенные слои" },
      { keys: ["Ctrl", "Shift", "G"], desc: "Разгруппировать выделенные слои" },
      { keys: ["Ctrl", "A"], desc: "Выделить все слои" },
    ],
  },
  {
    title: "Трансформация мотива",
    items: [
      { keys: ["Ctrl", "["], desc: "Понизить слой на один уровень в стеке" },
      { keys: ["Ctrl", "]"], desc: "Повысить слой на один уровень в стеке" },
      { keys: ["Ctrl", "Shift", "["], desc: "Переместить слой в самый низ" },
      { keys: ["Ctrl", "Shift", "]"], desc: "Переместить слой на самый верх" },
      { keys: ["X"], desc: "Отразить активный слой по горизонтали" },
      { keys: ["Y"], desc: "Отразить активный слой по вертикали" },
    ],
  },
  {
    title: "Вид и интерфейс",
    items: [
      { keys: ["E"], desc: "Скрыть / показать весь интерфейс" },
      { keys: ["1"], desc: "Скрыть / показать панель «Настройки»" },
      { keys: ["2"], desc: "Скрыть / показать панель «Слои»" },
      { keys: ["Ctrl", "0"], desc: "Сбросить смещение активного слоя в ноль" },
      {
        keys: ["←", "→", "↑", "↓"],
        desc: "Переместить слой (шаг 1px, с Shift — 10px)",
      },
    ],
  },
  {
    title: "Другое",
    items: [
      { keys: ["Ctrl", "S"], desc: "Скачать текущий экспорт" },
      { keys: ["Ctrl", "Z"], desc: "Отменить действие" },
      { keys: ["Ctrl", "Y"], desc: "Повторить отменённое" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-none text-foreground">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Горячие клавиши"
        aria-expanded={open}
        title="Горячие клавиши"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg"
      >
        <CircleHelp className="size-4" />
      </Button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-auto rounded-xl border bg-card p-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Горячие клавиши
              </h3>
              <button
                aria-label="Закрыть"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {SHORTCUT_SECTIONS.map((section) => (
                <section key={section.title}>
                  <p className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {section.title}
                  </p>
                  <ul className="space-y-1.5">
                    {section.items.map((item) => (
                      <li
                        key={item.keys.join("-")}
                        className="flex items-start justify-between gap-3 text-xs"
                      >
                        <span className="flex shrink-0 flex-wrap items-center gap-1">
                          {item.keys.map((k, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && (
                                <span className="text-muted-foreground">+</span>
                              )}
                              <Kbd>{k}</Kbd>
                            </span>
                          ))}
                        </span>
                        <span className="min-w-0 flex-1 text-right text-muted-foreground">
                          {item.desc}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <p className="mt-3 border-t pt-2 text-[10px] leading-relaxed text-muted-foreground">
              Клавиши работают, только когда фокус не находится в поле ввода.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

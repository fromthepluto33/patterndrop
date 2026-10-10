"use client";

import { Eye, EyeOff, Layers, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { usePanelView } from "@/components/panel-view-provider";
import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";

export function HeaderControls() {
  const {
    settingsOpen,
    toggleSettings,
    layersOpen,
    toggleLayers,
    uiVisible,
    toggleUi,
  } = usePanelView();

  return (
    <div className="flex items-center gap-1">
      <ThemeToggle />
      <div aria-hidden className="mx-1.5 h-5 w-px bg-border" />
      <div className="flex items-center gap-0.5">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Панель настроек"
          title={settingsOpen ? "Скрыть настройки" : "Показать настройки"}
          onClick={toggleSettings}
          className={cn(
            "rounded-lg transition-colors",
            settingsOpen && uiVisible
              ? "border-primary bg-primary text-white shadow-sm dark:border-transparent dark:bg-white dark:text-black"
              : "dark:border-white/15 dark:bg-black! dark:text-white"
          )}
        >
          <Settings2
            className={cn(
              "size-4",
              (!uiVisible || !settingsOpen) && "line-through"
            )}
          />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Панель слоёв"
          title={layersOpen ? "Скрыть слои" : "Показать слои"}
          onClick={toggleLayers}
          className={cn(
            "rounded-lg transition-colors",
            layersOpen && uiVisible
              ? "border-primary bg-primary text-white shadow-sm dark:border-transparent dark:bg-white dark:text-black"
              : "dark:border-white/15 dark:bg-black! dark:text-white"
          )}
        >
          <Layers
            className={cn(
              "size-4",
              (!uiVisible || !layersOpen) && "line-through"
            )}
          />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={
            uiVisible ? "Скрыть весь интерфейс" : "Показать интерфейс"
          }
          title={
            uiVisible
              ? "Скрыть весь интерфейс и оставить только холст"
              : "Показать интерфейс"
          }
          onClick={toggleUi}
        >
          {uiVisible ? (
            <Eye className="size-4" />
          ) : (
            <EyeOff className="size-4" />
          )}
        </Button>
      </div>
      <div aria-hidden className="mx-1.5 h-5 w-px bg-border" />
      <KeyboardShortcutsHelp />
    </div>
  );
}

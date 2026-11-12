import { VirtualRect } from './VirtualSurface';
import { VirtualUIDecorator } from './VirtualUIDecorator';

export interface MenuChoiceOption<V = string> {
  label: string;
  value: V;
}

export type MenuItemConfig =
  | {
      id: string;
      type: 'action';
      label: string;
      onSelect: () => void;
    }
  | {
      id: string;
      type: 'choice';
      label: string;
      options: MenuChoiceOption<string>[];
      getValue: () => string;
      onChange: (newValue: string) => void;
    };

export interface MenuScreenConfig {
  title: string;
  subtitle?: string;
  items: MenuItemConfig[];
  footerHint?: string;
  onBack?: () => void;
}

/**
 * Universal engine menu system rendered entirely onto the virtual pixel grid
 * via the object-oriented VirtualUIDecorator.
 * Supports keyboard navigation (Arrows/WASD/Enter/Escape), gamepad input,
 * and mouse pointer interaction in virtual pixel space (hover + click).
 */
export class MenuSystem {
  private readonly ui: VirtualUIDecorator;
  private currentScreen: MenuScreenConfig | null = null;
  private selectedIndex = 0;
  private visible = false;

  constructor(ui: VirtualUIDecorator) {
    this.ui = ui;
  }

  public show(screen: MenuScreenConfig, initialIndex?: number): void {
    const prevIndex = initialIndex !== undefined ? initialIndex : this.selectedIndex;
    this.currentScreen = screen;
    this.selectedIndex = Math.max(
      0,
      Math.min(prevIndex, Math.max(0, screen.items.length - 1))
    );
    this.visible = true;
    this.ui.getViewport().requestRender();
  }

  public hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.ui.getViewport().requestRender();
  }

  public isVisible(): boolean {
    return this.visible;
  }

  public getSelectedIndex(): number {
    return this.selectedIndex;
  }

  public handleKeyDown(event: KeyboardEvent): boolean {
    if (!this.visible || !this.currentScreen) return false;

    const { items, onBack } = this.currentScreen;
    if (items.length === 0) return false;

    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW': {
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + items.length) % items.length;
        this.ui.getViewport().requestRender();
        return true;
      }
      case 'ArrowDown':
      case 'KeyS': {
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % items.length;
        this.ui.getViewport().requestRender();
        return true;
      }
      case 'ArrowLeft':
      case 'KeyA': {
        const item = items[this.selectedIndex];
        if (item.type === 'choice') {
          event.preventDefault();
          this.cycleChoice(item, -1);
          return true;
        }
        return false;
      }
      case 'ArrowRight':
      case 'KeyD': {
        const item = items[this.selectedIndex];
        if (item.type === 'choice') {
          event.preventDefault();
          this.cycleChoice(item, 1);
          return true;
        }
        return false;
      }
      case 'Enter':
      case 'Space': {
        event.preventDefault();
        const item = items[this.selectedIndex];
        if (item.type === 'action') {
          item.onSelect();
        } else if (item.type === 'choice') {
          this.cycleChoice(item, 1);
        }
        this.ui.getViewport().requestRender();
        return true;
      }
      case 'Escape': {
        if (onBack) {
          event.preventDefault();
          onBack();
          this.ui.getViewport().requestRender();
          return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  /**
   * Renders the active menu screen directly onto the virtual pixel grid.
   */
  public render(bounds?: VirtualRect): void {
    if (!this.visible || !this.currentScreen) return;

    const surface = this.ui.getSurface();
    const theme = this.ui.getTheme();
    const area: VirtualRect = bounds ?? {
      x: 0,
      y: 0,
      width: surface.width,
      height: surface.height,
    };

    this.ui.drawModalBackdrop(area);

    const { title, subtitle, items, footerHint } = this.currentScreen;
    const rawScale = this.ui.getViewport().getUIScale();
    const bigMode = rawScale >= 1.6 && area.width >= 380 && area.height >= 360;

    const headingFont = this.ui.getHeadingFont();
    const candidateTitleScale = bigMode ? 2 : 1;
    const subScale = 1;
    const itemScale = bigMode ? 2 : 1;
    const pillScale = 1;
    const hintScale = 1;

    const padX = bigMode ? 12 : 8;
    const padY = bigMode ? 10 : 7;
    const boxW = Math.min(
      area.width - 8,
      Math.max(180, Math.round(area.width * 0.94))
    );
    const innerW = boxW - padX * 2;

    const titleAtCandidate = surface.measureText(
      title,
      candidateTitleScale,
      undefined,
      headingFont
    );
    const titleScale =
      titleAtCandidate.width > innerW ? 1 : candidateTitleScale;
    const titleH = surface.measureText(
      title,
      titleScale,
      undefined,
      headingFont
    ).height;
    const subLines = subtitle
      ? surface.drawWrappedText(subtitle, 0, -1000, innerW, {
          color: theme.textMuted,
          scale: subScale,
        }).lines
      : 0;
    const subH = subtitle
      ? subLines * surface.measureText('A', subScale).height +
        Math.max(0, subLines - 1) * 2 +
        3
      : 0;

    const actionRowH = bigMode ? 24 : 16;
    const choiceRowH = bigMode ? 36 : 27;
    const itemGap = bigMode ? 5 : 3;

    let itemsTotalH = 0;
    for (const item of items) {
      itemsTotalH += item.type === 'choice' ? choiceRowH : actionRowH;
    }
    itemsTotalH += Math.max(0, items.length - 1) * itemGap;

    const hintLines = footerHint
      ? surface.drawWrappedText(footerHint, 0, -1000, innerW, {
          color: theme.textMuted,
          scale: hintScale,
        }).lines
      : 0;
    const hintH = footerHint
      ? hintLines * surface.measureText('A', hintScale).height +
        Math.max(0, hintLines - 1) * 2 +
        5
      : 0;
    const headerGap = bigMode ? 7 : 5;

    const boxH = Math.min(
      area.height - 8,
      padY * 2 + titleH + subH + headerGap + itemsTotalH + hintH
    );
    const boxX = Math.round(area.x + (area.width - boxW) / 2);
    const boxY = Math.round(area.y + (area.height - boxH) / 2);

    this.ui.drawPanel(
      { x: boxX, y: boxY, width: boxW, height: boxH },
      {
        bgColor: theme.panelBg,
        borderColor: theme.borderHighlight,
        shadowColor: theme.bgOuter,
        radius: 3,
      }
    );

    const centerX = Math.round(boxX + boxW / 2);
    let cursorY = boxY + padY;

    // Menu Header
    this.ui.drawText(title, centerX, cursorY, {
      color: theme.accentBright,
      font: headingFont,
      scale: titleScale,
      align: 'center',
    });
    cursorY += titleH + 3;

    if (subtitle) {
      const wrapped = this.ui.drawWrappedText(
        subtitle,
        centerX,
        cursorY,
        innerW,
        {
          color: theme.textMuted,
          scale: subScale,
          align: 'center',
          lineHeight: 2,
        }
      );
      cursorY += wrapped.height;
    }

    cursorY += headerGap;

    // Menu Items List
    items.forEach((item, index) => {
      const isSelected = index === this.selectedIndex;
      const rowH = item.type === 'choice' ? choiceRowH : actionRowH;
      const rowRect: VirtualRect = {
        x: boxX + padX,
        y: cursorY,
        width: innerW,
        height: rowH,
      };

      this.ui.drawPanel(rowRect, {
        bgColor: isSelected ? theme.panelBg : theme.panelAlt,
        borderColor: isSelected ? theme.accent : theme.border,
        radius: 2,
      });

      if (item.type === 'action') {
        const textM = surface.measureText(item.label, itemScale);
        const textY = Math.round(rowRect.y + (rowRect.height - textM.height) / 2);
        const cursorX = rowRect.x + 6;

        if (isSelected) {
          this.ui.drawText('▶', cursorX, textY, {
            color: theme.accentBright,
            scale: itemScale,
          });
        }

        this.ui.drawText(item.label, cursorX + 10, textY, {
          color: isSelected ? theme.accentBright : theme.textMain,
          scale: itemScale,
        });

        this.ui.registerHitRegion({
          id: `menu-item-${item.id}`,
          rect: rowRect,
          layer: 'modal',
          onHover: () => {
            if (this.selectedIndex !== index) {
              this.selectedIndex = index;
              this.ui.getViewport().requestRender();
            }
          },
          onClick: () => {
            this.selectedIndex = index;
            item.onSelect();
          },
        });
      } else if (item.type === 'choice') {
        const labelY = rowRect.y + 3;
        const cursorX = rowRect.x + 5;

        if (isSelected) {
          this.ui.drawText('▶', cursorX, labelY, {
            color: theme.accentBright,
            scale: pillScale,
          });
        }

        this.ui.drawText(item.label, cursorX + 9, labelY, {
          color: isSelected ? theme.accentBright : theme.textMain,
          scale: pillScale,
        });

        // Choice Pills
        const currentVal = item.getValue();
        const pillGap = 3;
        const pillsAreaX = rowRect.x + 6;
        const pillsAreaW = rowRect.width - 12;
        const pillCount = Math.max(1, item.options.length);
        const pillW = Math.floor(
          (pillsAreaW - pillGap * (pillCount - 1)) / pillCount
        );
        const pillH = Math.max(11, rowRect.height - 15);
        const pillY = rowRect.y + rowRect.height - pillH - 3;

        this.ui.registerHitRegion({
          id: `menu-choice-row-${item.id}`,
          rect: rowRect,
          layer: 'modal',
          onHover: () => {
            if (this.selectedIndex !== index) {
              this.selectedIndex = index;
              this.ui.getViewport().requestRender();
            }
          },
          onClick: () => {
            this.selectedIndex = index;
            this.cycleChoice(item, 1);
          },
        });

        item.options.forEach((opt, optIdx) => {
          const isChosen = opt.value === currentVal;
          const pRect: VirtualRect = {
            x: pillsAreaX + optIdx * (pillW + pillGap),
            y: pillY,
            width: pillW,
            height: pillH,
          };

          this.ui.drawPanel(pRect, {
            bgColor: isChosen ? theme.accent : theme.bgOuter,
            borderColor: isChosen ? theme.accentBright : theme.border,
            radius: 1,
          });

          const optM = surface.measureText(opt.label, pillScale);
          const optFitScale =
            optM.width > pRect.width - 4
              ? Math.max(0.65, pillScale * ((pRect.width - 4) / optM.width))
              : pillScale;
          const fitM = surface.measureText(opt.label, optFitScale);

          this.ui.drawText(
            opt.label,
            Math.round(pRect.x + pRect.width / 2),
            Math.round(pRect.y + (pRect.height - fitM.height) / 2),
            {
              color: isChosen ? theme.textInverse : theme.textMuted,
              scale: optFitScale,
              align: 'center',
            }
          );

          this.ui.registerHitRegion({
            id: `menu-pill-${item.id}-${opt.value}`,
            rect: pRect,
            layer: 'modal',
            onHover: () => {
              if (this.selectedIndex !== index) {
                this.selectedIndex = index;
                this.ui.getViewport().requestRender();
              }
            },
            onClick: () => {
              this.selectedIndex = index;
              if (opt.value !== item.getValue()) {
                item.onChange(opt.value);
              }
              this.ui.getViewport().requestRender();
            },
          });
        });
      }

      cursorY += rowH + itemGap;
    });

    if (footerHint) {
      const hintY = boxY + boxH - hintH + 2;
      this.ui.drawWrappedText(footerHint, centerX, hintY, innerW, {
        color: theme.textMuted,
        scale: hintScale,
        align: 'center',
        lineHeight: 2,
      });
    }
  }

  private cycleChoice(
    item: Extract<MenuItemConfig, { type: 'choice' }>,
    delta: number
  ): void {
    const currentVal = item.getValue();
    const idx = item.options.findIndex((o) => o.value === currentVal);
    const nextIdx = (idx + delta + item.options.length) % item.options.length;
    item.onChange(item.options[nextIdx].value);
    this.ui.getViewport().requestRender();
  }
}

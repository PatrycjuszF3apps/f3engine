import { ControlEvent } from '../../input/ControlEvents';
import { ControlNode } from '../../nodes/ControlNode';
import { IVirtualSurface, VirtualRect } from '../../VirtualSurface';
import { DynamicText, resolveText } from './BasicControls';

export interface MenuChoiceOptionDescriptor<V = string> {
  label: DynamicText;
  value: V;
}

export type MenuItemDescriptor =
  | {
      id: string;
      type: 'action';
      label: DynamicText;
      onSelect: () => void;
    }
  | {
      id: string;
      type: 'choice';
      label: DynamicText;
      options: MenuChoiceOptionDescriptor<string>[];
      getValue: () => string;
      onChange: (newValue: string) => void;
    };

export interface MenuActionItemProps {
  label: DynamicText;
  itemScale?: number;
  onSelect: () => void;
  onHoverSelect?: () => void;
}

export interface MenuItemSelectionState {
  selected: boolean;
}

/**
 * Interactive action row control managed by a parent `MenuListControl`.
 */
export class MenuActionItemControl extends ControlNode<
  MenuActionItemProps,
  MenuItemSelectionState
> {
  public readonly itemType = 'action' as const;

  constructor(id: string, props: MenuActionItemProps) {
    super(id, props);
    this.interactive = true;
    this.focusable = true;
    this.cursor = 'pointer';
  }

  protected override createInitialState(): MenuItemSelectionState {
    return { selected: false };
  }

  public activate(): void {
    this.props.onSelect();
  }

  protected override onHoverChange(hovered: boolean): void {
    if (hovered) {
      this.props.onHoverSelect?.();
    }
  }

  protected override onClick(): void {
    this.props.onHoverSelect?.();
    this.props.onSelect();
  }

  protected override onRender(
    surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    const ui = this.getUI();
    if (!ui || bounds.width <= 0 || bounds.height <= 0) return;

    const theme = ui.getTheme();
    const isSelected = this.state.selected;
    const itemScale = this.props.itemScale ?? 1;
    const label = resolveText(this.props.label);

    ui.drawPanel(bounds, {
      bgColor: isSelected ? theme.panelBg : theme.panelAlt,
      borderColor: isSelected ? theme.accent : theme.border,
      radius: 2,
    });

    const textM = surface.measureText(label, itemScale);
    const textY = Math.round(bounds.y + (bounds.height - textM.height) / 2);
    const cursorX = bounds.x + 6;

    if (isSelected) {
      ui.drawText('▶', cursorX, textY, {
        color: theme.accentBright,
        scale: itemScale,
      });
    }

    ui.drawText(label, cursorX + 10, textY, {
      color: isSelected ? theme.accentBright : theme.textMain,
      scale: itemScale,
    });
  }
}

export interface ChoicePillControlProps<V = string> {
  label: DynamicText;
  value: V;
  pillScale?: number;
  isChosen: () => boolean;
  onSelectValue: (value: V) => void;
  onHoverParent?: () => void;
}

/**
 * Interactive option pill control managed by a parent `MenuChoiceItemControl`.
 */
export class ChoicePillControl<V = string> extends ControlNode<
  ChoicePillControlProps<V>
> {
  constructor(id: string, props: ChoicePillControlProps<V>) {
    super(id, props);
    this.interactive = true;
    this.cursor = 'pointer';
  }

  protected override onHoverChange(hovered: boolean): void {
    if (hovered) {
      this.props.onHoverParent?.();
    }
  }

  protected override onClick(): void {
    this.props.onHoverParent?.();
    this.props.onSelectValue(this.props.value);
  }

  protected override onRender(
    surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    const ui = this.getUI();
    if (!ui || bounds.width <= 0 || bounds.height <= 0) return;

    const theme = ui.getTheme();
    const isChosen = this.props.isChosen();
    const pillScale = this.props.pillScale ?? 1;
    const label = resolveText(this.props.label);

    ui.drawPanel(bounds, {
      bgColor: isChosen ? theme.accent : theme.bgOuter,
      borderColor: isChosen ? theme.accentBright : theme.border,
      radius: 1,
    });

    const optM = surface.measureText(label, pillScale);
    const optFitScale =
      optM.width > bounds.width - 4
        ? Math.max(0.65, pillScale * ((bounds.width - 4) / optM.width))
        : pillScale;
    const fitM = surface.measureText(label, optFitScale);

    ui.drawText(
      label,
      Math.round(bounds.x + bounds.width / 2),
      Math.round(bounds.y + (bounds.height - fitM.height) / 2),
      {
        color: isChosen ? theme.textInverse : theme.textMuted,
        scale: optFitScale,
        align: 'center',
      }
    );
  }
}

export interface MenuChoiceItemProps<V = string> {
  label: DynamicText;
  options: MenuChoiceOptionDescriptor<V>[];
  getValue: () => V;
  onChange: (newValue: V) => void;
  onHoverSelect?: () => void;
  pillScale?: number;
}

/**
 * Higher-level choice row control that creates and manages child `ChoicePillControl` nodes,
 * handles horizontal option cycling (`LEFT`/`RIGHT`), and synchronizes selection state with its parent `MenuListControl`.
 */
export class MenuChoiceItemControl<V = string> extends ControlNode<
  MenuChoiceItemProps<V>,
  MenuItemSelectionState
> {
  public readonly itemType = 'choice' as const;
  private readonly pillControls: Array<ChoicePillControl<V>> = [];

  constructor(id: string, props: MenuChoiceItemProps<V>) {
    super(id, props);
    this.interactive = true;
    this.focusable = true;
    this.cursor = 'pointer';

    props.options.forEach((opt, idx) => {
      const pill = new ChoicePillControl<V>(`${id}-pill-${idx}`, {
        label: opt.label,
        value: opt.value,
        pillScale: props.pillScale ?? 1,
        isChosen: () => this.props.getValue() === opt.value,
        onHoverParent: () => this.props.onHoverSelect?.(),
        onSelectValue: (val) => {
          if (val !== this.props.getValue()) {
            this.props.onChange(val);
            this.requestRender();
          }
        },
      });
      this.pillControls.push(pill);
      this.addChild(pill);
    });
  }

  protected override createInitialState(): MenuItemSelectionState {
    return { selected: false };
  }

  public cycleOption(delta: -1 | 1): void {
    const options = this.props.options;
    if (options.length === 0) return;
    const currentVal = this.props.getValue();
    const idx = options.findIndex((o) => o.value === currentVal);
    const nextIdx = (idx + delta + options.length) % options.length;
    const nextVal = options[nextIdx].value;
    if (nextVal !== currentVal) {
      this.props.onChange(nextVal);
    }
    this.requestRender();
  }

  protected override onHoverChange(hovered: boolean): void {
    if (hovered) {
      this.props.onHoverSelect?.();
    }
  }

  protected override onClick(): void {
    this.props.onHoverSelect?.();
    this.cycleOption(1);
  }

  protected override onLayout(bounds: VirtualRect): void {
    const pillGap = 3;
    const pillsAreaX = bounds.x + 6;
    const pillsAreaW = Math.max(10, bounds.width - 12);
    const pillCount = Math.max(1, this.pillControls.length);
    const pillW = Math.floor(
      (pillsAreaW - pillGap * (pillCount - 1)) / pillCount
    );
    const pillH = Math.max(11, bounds.height - 15);
    const pillY = bounds.y + bounds.height - pillH - 3;

    this.pillControls.forEach((pill, idx) => {
      pill.setBounds({
        x: pillsAreaX + idx * (pillW + pillGap),
        y: pillY,
        width: pillW,
        height: pillH,
      });
    });
  }

  protected override onRender(
    _surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    const ui = this.getUI();
    if (!ui || bounds.width <= 0 || bounds.height <= 0) return;

    const theme = ui.getTheme();
    const isSelected = this.state.selected;
    const pillScale = this.props.pillScale ?? 1;
    const label = resolveText(this.props.label);

    ui.drawPanel(bounds, {
      bgColor: isSelected ? theme.panelBg : theme.panelAlt,
      borderColor: isSelected ? theme.accent : theme.border,
      radius: 2,
    });

    const labelY = bounds.y + 3;
    const cursorX = bounds.x + 5;

    if (isSelected) {
      ui.drawText('▶', cursorX, labelY, {
        color: theme.accentBright,
        scale: pillScale,
      });
    }

    ui.drawText(label, cursorX + 9, labelY, {
      color: isSelected ? theme.accentBright : theme.textMain,
      scale: pillScale,
    });
  }
}

export type ManagedMenuItemNode =
  | MenuActionItemControl
  | MenuChoiceItemControl<string>;

export interface MenuListControlProps {
  items: MenuItemDescriptor[];
  bigMode?: boolean;
}

export interface MenuListControlState {
  selectedIndex: number;
}

/**
 * Higher-level composite menu list control in `UIKit.ClassicV1`.
 * Owns and orchestrates a collection of `MenuActionItemControl` and `MenuChoiceItemControl` child nodes:
 * - Automatically manages `selectedIndex` state and synchronizes child `selected` states.
 * - Handles normalized `UP`/`DOWN`/`LEFT`/`RIGHT`/`CONFIRM` control events so applications
 *   never need to manage menu traversal or focus logic manually.
 */
export class MenuListControl extends ControlNode<
  MenuListControlProps,
  MenuListControlState
> {
  private itemNodes: ManagedMenuItemNode[] = [];

  constructor(id: string, props: MenuListControlProps) {
    super(id, props);
    this.interactive = false;
    this.rebuildItemNodes(props.items);
  }

  protected override createInitialState(): MenuListControlState {
    return { selectedIndex: 0 };
  }

  protected override onResetState(): void {
    this.syncChildSelectionStates();
  }

  public setItems(
    items: MenuItemDescriptor[],
    preserveSelection = true
  ): this {
    const prevIdx = preserveSelection ? this.state.selectedIndex : 0;
    this.props = { ...this.props, items };
    this.rebuildItemNodes(items);
    this.setSelectedIndex(prevIdx);
    return this;
  }

  public getSelectedIndex(): number {
    return this.state.selectedIndex;
  }

  public setSelectedIndex(index: number): void {
    const count = this.itemNodes.length;
    const clamped =
      count === 0 ? 0 : Math.max(0, Math.min(index, count - 1));
    if (this.state.selectedIndex !== clamped) {
      this.setState({ selectedIndex: clamped }, false);
    }
    this.syncChildSelectionStates();
    this.requestRender();
  }

  public measureTotalHeight(bigMode: boolean): number {
    const actionRowH = bigMode ? 24 : 16;
    const choiceRowH = bigMode ? 36 : 27;
    const itemGap = bigMode ? 5 : 3;

    let totalH = 0;
    for (const item of this.itemNodes) {
      totalH += item.itemType === 'choice' ? choiceRowH : actionRowH;
    }
    totalH += Math.max(0, this.itemNodes.length - 1) * itemGap;
    return totalH;
  }

  protected override onLayout(bounds: VirtualRect): void {
    const bigMode = Boolean(this.props.bigMode);
    const actionRowH = bigMode ? 24 : 16;
    const choiceRowH = bigMode ? 36 : 27;
    const itemGap = bigMode ? 5 : 3;
    const itemScale = bigMode ? 2 : 1;

    let cursorY = bounds.y;
    for (const itemNode of this.itemNodes) {
      const rowH = itemNode.itemType === 'choice' ? choiceRowH : actionRowH;
      if (itemNode.itemType === 'action') {
        itemNode.setProps({ itemScale }, false);
      }
      itemNode.setBounds({
        x: bounds.x,
        y: cursorY,
        width: bounds.width,
        height: rowH,
      });
      cursorY += rowH + itemGap;
    }
  }

  protected override onControlEvent(event: ControlEvent): boolean {
    const count = this.itemNodes.length;
    if (count === 0) return false;

    if (event.kind === 'DIRECTION' && event.phase !== 'released') {
      switch (event.direction) {
        case 'UP': {
          const next = (this.state.selectedIndex - 1 + count) % count;
          this.setSelectedIndex(next);
          return true;
        }
        case 'DOWN': {
          const next = (this.state.selectedIndex + 1) % count;
          this.setSelectedIndex(next);
          return true;
        }
        case 'LEFT': {
          const current = this.itemNodes[this.state.selectedIndex];
          if (current && current.itemType === 'choice') {
            current.cycleOption(-1);
            return true;
          }
          return false;
        }
        case 'RIGHT': {
          const current = this.itemNodes[this.state.selectedIndex];
          if (current && current.itemType === 'choice') {
            current.cycleOption(1);
            return true;
          }
          return false;
        }
      }
    }

    if (event.kind === 'ACTION') {
      if (event.action === 'CONFIRM') {
        const current = this.itemNodes[this.state.selectedIndex];
        if (!current) return false;
        if (current.itemType === 'action') {
          current.activate();
        } else {
          current.cycleOption(1);
        }
        return true;
      }
      if (event.action === 'FOCUS_NEXT') {
        const next = (this.state.selectedIndex + 1) % count;
        this.setSelectedIndex(next);
        return true;
      }
      if (event.action === 'FOCUS_PREV') {
        const next = (this.state.selectedIndex - 1 + count) % count;
        this.setSelectedIndex(next);
        return true;
      }
    }

    return false;
  }

  private rebuildItemNodes(descriptors: MenuItemDescriptor[]): void {
    this.clearChildren(true);
    this.itemNodes = [];

    descriptors.forEach((desc, idx) => {
      if (desc.type === 'action') {
        const actionNode = new MenuActionItemControl(
          `${this.id}-item-${desc.id}`,
          {
            label: desc.label,
            onSelect: desc.onSelect,
            onHoverSelect: () => this.setSelectedIndex(idx),
          }
        );
        this.itemNodes.push(actionNode);
        this.addChild(actionNode);
      } else {
        const choiceNode = new MenuChoiceItemControl(
          `${this.id}-item-${desc.id}`,
          {
            label: desc.label,
            options: desc.options,
            getValue: desc.getValue,
            onChange: desc.onChange,
            onHoverSelect: () => this.setSelectedIndex(idx),
          }
        );
        this.itemNodes.push(choiceNode);
        this.addChild(choiceNode);
      }
    });

    this.syncChildSelectionStates();
  }

  private syncChildSelectionStates(): void {
    const sel = this.state.selectedIndex;
    this.itemNodes.forEach((node, idx) => {
      const shouldBeSelected = idx === sel;
      if (node.getState().selected !== shouldBeSelected) {
        node.setState({ selected: shouldBeSelected }, false);
      }
    });
  }
}

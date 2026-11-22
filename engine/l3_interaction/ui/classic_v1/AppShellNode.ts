import { CanvasNode } from '../../../l2_runtime/nodes/CanvasNode';
import { ContainerNode } from '../../../l2_runtime/nodes/ContainerNode';
import { IVirtualSurface, VirtualRect } from '../../../l1_infrastructure/VirtualSurface';
import {
  ControlDeckControl,
  ControlDeckControlProps,
  HeaderBarControl,
  HeaderBarControlProps,
} from './HUDControls';

export interface ModalBoundsProvider {
  getModalTargetBounds(availableBounds: VirtualRect): VirtualRect;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasModalBoundsProvider(node: CanvasNode<any, any>): node is CanvasNode<any, any> & ModalBoundsProvider {
  return (
    typeof (node as unknown as ModalBoundsProvider).getModalTargetBounds ===
    'function'
  );
}

export interface ResponsiveAppShellProps {
  header: HeaderBarControlProps;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentNode: CanvasNode<any, any>;
  controlDeck: ControlDeckControlProps;
}

export interface ResponsiveAppShellState {
  orientation: 'portrait' | 'horizontal';
}

/**
 * Higher-level responsive application shell container in `UIKit.ClassicV1`.
 *
 * Orchestrates four child branches automatically across Portrait and Horizontal viewport aspect ratios:
 * 1. `headerBar` (`HeaderBarControl`)
 * 2. `contentNode` (`CanvasNode` – main application board/viewport content)
 * 3. `controlDeck` (`ControlDeckControl` – on-screen D-Pad and action buttons)
 * 4. `modalLayer` (`ContainerNode` – top-most Z-order layer hosting modal dialogs and readiness prompts)
 */
export class ResponsiveAppShellNode extends ContainerNode<
  ResponsiveAppShellProps,
  ResponsiveAppShellState
> {
  public readonly headerBar: HeaderBarControl;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly contentNode: CanvasNode<any, any>;
  public readonly controlDeck: ControlDeckControl;
  public readonly modalLayer: ContainerNode;

  constructor(id: string, props: ResponsiveAppShellProps) {
    super(id, props);

    this.headerBar = new HeaderBarControl(`${id}-header`, props.header);
    this.contentNode = props.contentNode;
    this.controlDeck = new ControlDeckControl(
      `${id}-deck`,
      props.controlDeck
    );
    this.modalLayer = new ContainerNode(`${id}-modal-layer`);

    this.addControls(
      this.headerBar,
      this.contentNode,
      this.controlDeck,
      this.modalLayer
    );
  }

  protected override createInitialState(): ResponsiveAppShellState {
    return { orientation: 'portrait' };
  }

  /**
   * Opens only the modal child matching `modalId` inside `modalLayer` and hides all other modal children.
   */
  public showModal(modalId: string | null): this {
    this.modalLayer.activateOnlyChild(modalId);
    return this;
  }

  protected override onLayout(bounds: VirtualRect): void {
    const vw = bounds.width;
    const vh = bounds.height;
    if (vw <= 0 || vh <= 0) return;

    const isHorizontal = vw > vh * 1.12;
    const nextOrientation = isHorizontal ? 'horizontal' : 'portrait';
    if (this.state.orientation !== nextOrientation) {
      this.setState({ orientation: nextOrientation }, false);
    }

    let contentAvailRect: VirtualRect;

    if (isHorizontal) {
      const margin = Math.max(4, Math.round(vh * 0.02));
      const maxBoardSpace = vh - margin * 2;
      const sideW = Math.max(
        62,
        Math.floor((vw - maxBoardSpace - margin * 4) / 2)
      );

      const leftPanel: VirtualRect = {
        x: bounds.x + margin,
        y: bounds.y + margin,
        width: sideW,
        height: vh - margin * 2,
      };

      const rightPanel: VirtualRect = {
        x: bounds.x + vw - sideW - margin,
        y: bounds.y + margin,
        width: sideW,
        height: vh - margin * 2,
      };

      contentAvailRect = {
        x: leftPanel.x + leftPanel.width + margin,
        y: bounds.y + margin,
        width: rightPanel.x - (leftPanel.x + leftPanel.width) - margin * 2,
        height: vh - margin * 2,
      };

      this.headerBar.setProps({ layoutMode: 'left-sidebar' }, false);
      this.headerBar.setBounds(leftPanel);

      this.controlDeck.setProps({ layoutMode: 'right-sidebar' }, false);
      this.controlDeck.setBounds(rightPanel);
    } else {
      const margin = Math.max(4, Math.round(vw * 0.02));
      const headerH = Math.max(50, Math.min(82, Math.round(vh * 0.145)));
      const footerH = Math.max(46, Math.min(76, Math.round(vh * 0.125)));

      const headerRect: VirtualRect = {
        x: bounds.x + margin,
        y: bounds.y + margin,
        width: vw - margin * 2,
        height: headerH,
      };

      const footerRect: VirtualRect = {
        x: bounds.x + margin,
        y: bounds.y + vh - footerH - margin,
        width: vw - margin * 2,
        height: footerH,
      };

      contentAvailRect = {
        x: bounds.x + margin,
        y: headerRect.y + headerRect.height + margin,
        width: vw - margin * 2,
        height: footerRect.y - (headerRect.y + headerRect.height) - margin * 2,
      };

      this.headerBar.setProps({ layoutMode: 'top-bar' }, false);
      this.headerBar.setBounds(headerRect);

      this.controlDeck.setProps({ layoutMode: 'bottom-bar' }, false);
      this.controlDeck.setBounds(footerRect);
    }

    this.contentNode.setBounds(contentAvailRect);
    if (this.contentNode instanceof ContainerNode) {
      this.contentNode.performLayout();
    }

    const modalBounds = hasModalBoundsProvider(this.contentNode)
      ? this.contentNode.getModalTargetBounds(contentAvailRect)
      : contentAvailRect;

    this.modalLayer.setBounds(modalBounds);
    for (const modalChild of this.modalLayer.children) {
      if (modalChild instanceof CanvasNode) {
        modalChild.setBounds(modalBounds);
      }
      if (modalChild instanceof ContainerNode && modalChild.visible) {
        modalChild.performLayout();
      }
    }
  }

  protected override onRender(
    surface: IVirtualSurface,
    bounds: VirtualRect
  ): void {
    const ui = this.getUI();
    if (!ui || bounds.width <= 0 || bounds.height <= 0) return;

    const theme = ui.getTheme();
    ui.beginFrame(false);
    surface.clear(theme.bgOuter);
  }
}

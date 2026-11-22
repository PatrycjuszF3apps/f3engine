import {
  AppRootConfig,
  AppRootNode,
  I18nManager,
  L2_TOKENS,
  L3_TOKENS,
  L4_TOKENS,
  StorageStore,
  UIKit,
  VideoFilterManager,
  VideoFilterType,
} from '../../../../engine';
import { LayersPersistedState } from '../l1_infrastructure/LayersSettingsRepository';
import { LayersSettingsRepositoryRegistrar } from '../l1_infrastructure/LayersSettingsRepository.registrar';
import {
  LayersStringId,
  SupportedLocale,
} from '../l3_interaction/LayersI18nService';
import { LayersI18nServiceRegistrar } from '../l3_interaction/LayersI18nService.registrar';
import { StageLayerInteractionService } from '../l3_interaction/StageLayerInteractionService';
import { StageLayerInteractionServiceRegistrar } from '../l3_interaction/StageLayerInteractionService.registrar';
import {
  BackdropUniverseService,
  DepthSortStrategyMode,
} from '../l4_domain/BackdropUniverseService';
import { BackdropUniverseServiceRegistrar } from '../l4_domain/BackdropUniverseService.registrar';
import { LayeredStageContainerNode } from './LayeredStageContainerNode';
import { RealtimeZIndexChildOrderServiceRegistrar } from './RealtimeZIndexChildOrderService.registrar';

export interface LayersAppRootProps {
  store: StorageStore<LayersPersistedState>;
  i18n: I18nManager<SupportedLocale, LayersStringId>;
  filterManager: VideoFilterManager;
}

export interface LayersAppRootState {
  stagePaused: boolean;
}

/**
 * Top-level Application Root Node for the Multi-Layer Z-Index Compositor Demo.
 *
 * Injects custom Shadow Service Registrars (`*.registrar.ts`) across all 4 DDD layers:
 * - `l1_infrastructure`: `LayersSettingsRepositoryRegistrar`
 * - `l2_runtime`: `RealtimeZIndexChildOrderServiceRegistrar` (overrides `L2_TOKENS.ChildOrderService`)
 * - `l3_interaction`: `StageLayerInteractionServiceRegistrar` (overrides `L3_TOKENS.LayerElevationService`) & `LayersI18nServiceRegistrar`
 * - `l4_domain`: `BackdropUniverseServiceRegistrar` (overrides `L4_TOKENS.DomainDepthPolicyService`)
 */
export class LayersAppRootNode extends AppRootNode<
  LayersAppRootProps,
  LayersAppRootState
> {
  public readonly stageContainer: LayeredStageContainerNode;
  public readonly shellNode: UIKit.ClassicV1.ResponsiveAppShellNode;
  public readonly titleDialog: UIKit.ClassicV1.ModalDialogNode;
  public readonly pauseDialog: UIKit.ClassicV1.ModalDialogNode;
  public readonly settingsDialog: UIKit.ClassicV1.SettingsDialogNode;

  private readonly universeRegistrar: BackdropUniverseServiceRegistrar;
  private readonly universeService: BackdropUniverseService;
  private readonly interactionService: StageLayerInteractionService;
  private readonly unsubStore: () => void;
  private readonly unsubI18n: () => void;

  constructor(config: AppRootConfig, props: LayersAppRootProps) {
    const universeRegistrar = new BackdropUniverseServiceRegistrar();

    super(
      {
        ...config,
        registrars: {
          l1_infrastructure: [
            new LayersSettingsRepositoryRegistrar(props.store),
            ...(config.registrars?.l1_infrastructure ?? []),
          ],
          l2_runtime: [
            new RealtimeZIndexChildOrderServiceRegistrar(),
            ...(config.registrars?.l2_runtime ?? []),
          ],
          l3_interaction: [
            new StageLayerInteractionServiceRegistrar(),
            new LayersI18nServiceRegistrar(props.i18n),
            ...(config.registrars?.l3_interaction ?? []),
          ],
          l4_domain: [
            universeRegistrar,
            ...(config.registrars?.l4_domain ?? []),
          ],
        },
      },
      'layers-app-root',
      props
    );

    this.universeRegistrar = universeRegistrar;
    const { store, i18n, filterManager } = props;

    this.universeService = this.kernel.l4.resolve(
      L4_TOKENS.DomainDepthPolicyService
    ) as BackdropUniverseService;
    this.universeService.setSortMode(store.get().sortMode);

    this.interactionService = this.kernel.l3.resolve(
      L3_TOKENS.LayerElevationService
    ) as StageLayerInteractionService;

    const metadataService = this.kernel.l2.resolve(
      L2_TOKENS.NodeMetadataService
    );
    const childOrderService = this.kernel.l2.resolve(
      L2_TOKENS.ChildOrderService
    );

    this.stageContainer = new LayeredStageContainerNode('layered-stage', {
      universeService: this.universeService,
      interactionService: this.interactionService,
      metadataService,
      childOrderService,
      onPauseRequest: () => {
        this.freezeStageAndOpenPauseDialog();
      },
      onShuffleRequest: () => {
        this.shuffleUniverse();
      },
    });

    this.settingsDialog = new UIKit.ClassicV1.SettingsDialogNode(
      'layers-dialog-settings',
      {
        title: () => i18n.t('menu.settings.heading'),
        subtitle: () => i18n.t('menu.settings.subtitle'),
        backLabel: () => i18n.t('menu.settings.back'),
        footerHint: () => i18n.t('menu.settings.hint'),
        choices: [
          {
            id: 'language',
            label: () => i18n.t('menu.settings.language'),
            options: [
              { label: () => i18n.t('menu.settings.lang_en'), value: 'en' },
              { label: () => i18n.t('menu.settings.lang_pl'), value: 'pl' },
            ],
            getValue: () => store.get().language,
            onChange: (val) => store.set({ language: val as SupportedLocale }),
          },
          {
            id: 'sort-mode',
            label: () => i18n.t('menu.settings.sort_mode'),
            options: [
              { label: () => i18n.t('sort.wave'), value: 'wave' },
              { label: () => i18n.t('sort.random'), value: 'random' },
              { label: () => i18n.t('sort.groups'), value: 'groups' },
            ],
            getValue: () => store.get().sortMode,
            onChange: (val) =>
              store.set({ sortMode: val as DepthSortStrategyMode }),
          },
          {
            id: 'video-filter',
            label: () => i18n.t('menu.settings.video_filter'),
            options: [
              {
                label: () => i18n.t('menu.settings.filter_none'),
                value: 'none',
              },
              { label: () => i18n.t('menu.settings.filter_crt'), value: 'crt' },
              {
                label: () => i18n.t('menu.settings.filter_nokia'),
                value: 'nokia',
              },
            ],
            getValue: () => store.get().videoFilter,
            onChange: (val) =>
              store.set({ videoFilter: val as VideoFilterType }),
          },
        ],
      }
    );

    this.titleDialog = new UIKit.ClassicV1.ModalDialogNode(
      'layers-dialog-title',
      {
        title: () => i18n.t('menu.title.heading'),
        subtitle: () => i18n.t('menu.title.subtitle'),
        footerHint: () => i18n.t('menu.title.hint'),
        items: [
          {
            id: 'launch-stage',
            type: 'action',
            label: () => i18n.t('menu.title.start'),
            onSelect: () => this.resumeStage(),
          },
          {
            id: 'settings',
            type: 'action',
            label: () => i18n.t('menu.title.settings'),
            onSelect: () =>
              this.titleDialog.openSubDialog(this.settingsDialog),
          },
        ],
      }
    );

    this.pauseDialog = new UIKit.ClassicV1.ModalDialogNode(
      'layers-dialog-pause',
      {
        title: () => i18n.t('menu.pause.heading'),
        subtitle: () => i18n.t('menu.pause.subtitle'),
        footerHint: () => i18n.t('menu.pause.hint'),
        onBack: () => this.resumeStage(),
        items: [
          {
            id: 'resume',
            type: 'action',
            label: () => i18n.t('menu.pause.resume'),
            onSelect: () => this.resumeStage(),
          },
          {
            id: 'shuffle',
            type: 'action',
            label: () => i18n.t('menu.pause.shuffle'),
            onSelect: () => {
              this.shuffleUniverse();
              this.resumeStage();
            },
          },
          {
            id: 'settings',
            type: 'action',
            label: () => i18n.t('menu.pause.settings'),
            onSelect: () =>
              this.pauseDialog.openSubDialog(this.settingsDialog),
          },
          {
            id: 'title-screen',
            type: 'action',
            label: () => i18n.t('menu.pause.title_screen'),
            onSelect: () => this.openTitleDialog(),
          },
        ],
      }
    );

    this.shellNode = new UIKit.ClassicV1.ResponsiveAppShellNode(
      'layers-app-shell',
      {
        header: {
          brandTitle: () => i18n.t('header.brand_title'),
          brandBadge: () => i18n.t('header.brand_badge'),
          gamepadConnectedLabel: () => i18n.t('header.gamepad_connected'),
          gamepadDisconnectedLabel: () => i18n.t('header.gamepad_disconnected'),
          scoreCards: [
            {
              id: 'sort-mode',
              label: () => i18n.t('scoreboard.mode'),
              value: () => {
                const mode = store.get().sortMode;
                if (mode === 'random') return i18n.t('sort.random');
                if (mode === 'groups') return i18n.t('sort.groups');
                return i18n.t('sort.wave');
              },
              accent: true,
            },
            {
              id: 'front-node',
              label: () => i18n.t('scoreboard.top_node'),
              value: () => this.stageContainer.getFrontMostNodeSummary().shortName,
            },
            {
              id: 'top-z',
              label: () => i18n.t('scoreboard.top_z'),
              value: () =>
                String(this.stageContainer.getFrontMostNodeSummary().zIndex),
            },
            {
              id: 'pinned',
              label: () => i18n.t('scoreboard.focus'),
              value: () =>
                this.stageContainer.getPinnedNodeShortName() ??
                i18n.t('pin.none'),
            },
          ],
        },
        contentNode: this.stageContainer,
        controlDeck: {
          menuLabel: () => i18n.t('controls.menu_btn'),
          pauseLabel: () =>
            this.state.stagePaused
              ? i18n.t('controls.resume_btn')
              : i18n.t('controls.pause_btn'),
          restartLabel: () => i18n.t('controls.restart_btn'),
          onMenuClick: () => {
            if (!this.state.stagePaused) {
              this.freezeStageAndOpenPauseDialog();
            } else {
              this.openTitleDialog();
            }
          },
          onPauseClick: () => {
            if (this.state.stagePaused) {
              this.resumeStage();
            } else {
              this.freezeStageAndOpenPauseDialog();
            }
          },
          onRestartClick: () => {
            this.shuffleUniverse();
          },
        },
      }
    );

    this.shellNode.modalLayer.addControls(this.titleDialog, this.pauseDialog);
    this.addChild(this.shellNode);

    this.unsubI18n = i18n.subscribe(() => {
      i18n.translateDOM();
      this.viewport.setCanvasAriaLabel(i18n.t('board.canvas_aria'));
      this.requestRender();
    });

    this.unsubStore = store.subscribe((state) => {
      i18n.setLocale(state.language);
      this.universeService.setSortMode(state.sortMode);
      filterManager.apply(state.videoFilter);
      this.requestRender();
    });

    // Launch directly with the multi-layer animated stage active and running!
    this.resumeStage();
  }

  protected override createInitialState(): LayersAppRootState {
    return {
      stagePaused: false,
    };
  }

  public openTitleDialog(initialIndex = 0): void {
    this.setStageFrozen(true);
    this.titleDialog.resetState();
    this.titleDialog.open(initialIndex);
    this.shellNode.showModal(this.titleDialog.id);
  }

  public freezeStageAndOpenPauseDialog(initialIndex = 0): void {
    this.setStageFrozen(true);
    this.pauseDialog.resetState();
    this.pauseDialog.open(initialIndex);
    this.shellNode.showModal(this.pauseDialog.id);
  }

  public resumeStage(): void {
    this.shellNode.showModal(null);
    this.setStageFrozen(false);
  }

  public shuffleUniverse(): void {
    this.universeService.randomizeUniverse();
    this.interactionService.setPinnedNodeId(null);
    this.requestRender();
  }

  public override dispose(): void {
    this.unsubI18n();
    this.unsubStore();
    super.dispose();
  }

  private setStageFrozen(frozen: boolean): void {
    this.setState({ stagePaused: frozen }, false);
    this.universeRegistrar.setSimulationPaused(frozen);
    if (frozen) {
      this.stageContainer.freeze();
    } else {
      this.stageContainer.unfreeze();
    }
  }
}

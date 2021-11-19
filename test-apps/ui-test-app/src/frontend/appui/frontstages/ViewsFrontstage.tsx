/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { BeDuration } from "@itwin/core-bentley";
import {
  ActivityMessageDetails, ActivityMessageEndReason, IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType,
  ScreenViewport, ViewState,
} from "@itwin/core-frontend";
import { MapLayersWidgetControl } from "@itwin/map-layers"; // used to test map-layers widget control
import { NodeKey } from "@itwin/presentation-common";
import {
  BadgeType, CommonToolbarItem, ConditionalBooleanValue, ContentLayoutProps, RelativePosition, SpecialKey, StageUsage, ToolbarItemUtilities, WidgetState,
} from "@itwin/appui-abstract";
import { CustomToolbarItem, SelectionMode, useToolbarPopupContext } from "@itwin/components-react";
import { Point, ScrollView } from "@itwin/core-react";
import {
  BasicNavigationWidget, BasicToolWidget, CommandItemDef, ConfigurableUiManager, ContentGroup, ContentGroupProps,
  ContentGroupProvider, ContentProps, ContentViewManager, CoreTools, CursorInformation,
  CursorPopupContent, CursorPopupManager, CursorUpdatedEventArgs, CustomItemDef,
  EmphasizeElementsChangedArgs, Frontstage, FrontstageDef, FrontstageManager, FrontstageProps, FrontstageProvider,
  GroupItemDef, HideIsolateEmphasizeAction, HideIsolateEmphasizeActionHandler,
  HideIsolateEmphasizeManager, MessageManager,
  ModalDialogManager, ModelessDialogManager, ModelsTreeNodeType, StagePanel,
  SyncUiEventId, ToolbarHelper, UiFramework, Widget, WIDGET_OPACITY_DEFAULT, Zone, ZoneLocation, ZoneState,
} from "@itwin/appui-react";
import { Button, Slider } from "@itwin/itwinui-react";
import { SampleAppIModelApp, SampleAppUiActionId } from "../../../frontend/index";
// SVG Support - SvgPath or SvgSprite
// import { SvgPath } from "@itwin/core-react";
import { AccuDrawPopupTools } from "../../tools/AccuDrawPopupTools";
import { AppTools } from "../../tools/ToolSpecifications";
import { ToolWithDynamicSettings } from "../../tools/ToolWithDynamicSettings";
import { getSavedViewLayoutProps, OpenComponentExamplesPopoutTool, OpenCustomPopoutTool, OpenViewPopoutTool } from "../../tools/ImmediateTools";
import { AppUi } from "../AppUi";
// cSpell:Ignore contentviews statusbars uitestapp
import { IModelViewportControl } from "../contentviews/IModelViewport";
import { CalculatorDialog } from "../dialogs/CalculatorDialog";
import { SpinnerTestDialog } from "../dialogs/SpinnerTestDialog";
import { TestRadialMenu } from "../dialogs/TestRadialMenu";
import { ViewportDialog } from "../dialogs/ViewportDialog";
import { ExampleForm } from "../forms/ExampleForm";
import { AppStatusBarWidgetControl } from "../statusbars/AppStatusBar";
import { VerticalPropertyGridWidgetControl } from "../widgets/PropertyGridDemoWidget";
import { UnifiedSelectionPropertyGridWidgetControl } from "../widgets/UnifiedSelectionPropertyGridWidget";
import { UnifiedSelectionTableWidgetControl } from "../widgets/UnifiedSelectionTableWidget";
import { ViewportWidget } from "../widgets/ViewportWidget";
import { VisibilityWidgetControl } from "../widgets/VisibilityWidget";
import { NestedAnimationStage } from "./NestedAnimationStage";
import { ViewSelectorPanel } from "../../tools/ViewSelectorPanel";

function SvgApple(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' {...props}>
      <path d='m14.38732 12.46864a8.67507 8.67507 0 0 1 -.85133 1.54667 7.83909 7.83909 0 0 1 -1.096 1.33933 2.11842 2.11842 0 0 1 -1.40933.62733 3.50824 3.50824 0 0 1 -1.30133-.314 3.7014 3.7014 0 0 0 -1.40133-.31333 3.82728 3.82728 0 0 0 -1.44066.31333 3.84425 3.84425 0 0 1 -1.24467.33067 1.98968 1.98968 0 0 1 -1.44066-.644 8.203 8.203 0 0 1 -1.14667-1.38664 9.61729 9.61729 0 0 1 -1.21266-2.43466 8.99338 8.99338 0 0 1 -.50933-2.90134 5.34287 5.34287 0 0 1 .68865-2.772 4.05969 4.05969 0 0 1 1.44134-1.474 3.84792 3.84792 0 0 1 1.94933-.556 4.55944 4.55944 0 0 1 1.50733.35466 4.79788 4.79788 0 0 0 1.196.35534 7.06478 7.06478 0 0 0 1.326-.41866 4.34039 4.34039 0 0 1 1.802-.32334 3.8146 3.8146 0 0 1 2.99733 1.59533 3.37671 3.37671 0 0 0 -1.768 3.062 3.3911 3.3911 0 0 0 1.09733 2.54467 3.59839 3.59839 0 0 0 1.096.72733q-.132.386-.27933.74133zm-3.05466-12.14864a3.43565 3.43565 0 0 1 -.86533 2.23866 2.93869 2.93869 0 0 1 -2.45 1.22267 2.58687 2.58687 0 0 1 -.018-.30334 3.63848 3.63848 0 0 1 2.03667-3.11132 3.30968 3.30968 0 0 1 1.28-.36667 2.86658 2.86658 0 0 1 .01667.32z' />
    </svg>
  );
}

function MyLoremIpsumPanel() {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("mounting MyLoremIpsumPanel");
    return () => {
      // eslint-disable-next-line no-console
      console.log("unmounting MyLoremIpsumPanel");
    };
  }, []);

  return (
    <div style={{ width: "400px", height: "300px", padding: "6px 0px 6px 6px" }}>
      <ScrollView>
        <div>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
          dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
          proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
        </div>
        {false && <ViewportWidget iTwinName="iModelHubTest" imodelName="GrandCanyonTerrain" />}
        <div>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
          Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
          dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
          proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
        </div>
      </ScrollView>
    </div>
  );
}

/* eslint-disable react/jsx-key, deprecation/deprecation */
function MySliderPanel() {
  const [sliderValues, setSliderValues] = React.useState([50]);
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("mounting MySliderPanel");
    return () => {
      // eslint-disable-next-line no-console
      console.log("unmounting MySliderPanel");
    };
  }, []);

  const { closePanel } = useToolbarPopupContext();
  const handleApply = React.useCallback(() => {
    closePanel();
  }, [closePanel]);

  const handleChange = React.useCallback((values) => {
    setSliderValues(values);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", width: "300px", height: "68px", padding: "6px", boxSizing: "border-box" }}>
      <Slider style={{ width: "100%" }} min={0} max={100} values={sliderValues} step={1} onChange={handleChange} />
      <Button onClick={handleApply}>Apply</Button>
    </div>
  );
}

export class InitialIModelContentStageProvider extends ContentGroupProvider {
  public override prepareToSaveProps(contentGroupProps: ContentGroupProps) {
    const newContentsArray = contentGroupProps.contents.map((content: ContentProps) => {
      const newContent = { ...content };
      if (newContent.applicationData)
        delete newContent.applicationData;
      return newContent;
    });
    return { ...contentGroupProps, contents: newContentsArray };
  }

  public override applyUpdatesToSavedProps(contentGroupProps: ContentGroupProps) {
    const newContentsArray = contentGroupProps.contents.map((content: ContentProps) => {
      const newContent = { ...content };

      if (newContent.classId === IModelViewportControl.id) {
        newContent.applicationData = {
          ...newContent.applicationData,
          featureOptions:
          {
            defaultViewOverlay: {
              enableScheduleAnimationViewOverlay: true,
              enableAnalysisTimelineViewOverlay: true,
              enableSolarTimelineViewOverlay: true,
            },
          },
        };
      }
      return newContent;
    });
    return { ...contentGroupProps, contents: newContentsArray };
  }

  public async provideContentGroup(props: FrontstageProps): Promise<ContentGroup> {
    const viewIdsSelected = SampleAppIModelApp.getInitialViewIds();
    const iModelConnection = UiFramework.getIModelConnection();

    if (!iModelConnection)
      throw new Error(`Unable to generate content group if not iModelConnection is available`);

    if (0 === viewIdsSelected.length) {
      const savedViewLayoutProps = await getSavedViewLayoutProps(props.id, iModelConnection);
      if (savedViewLayoutProps) {
        const viewState = savedViewLayoutProps.contentGroupProps.contents[0].applicationData?.viewState;
        if (viewState) {
          UiFramework.setDefaultViewState(viewState);
        }
        return new ContentGroup(savedViewLayoutProps.contentGroupProps);
      }
      throw (Error(`Could not load saved layout ContentLayoutProps`));
    }

    // first find an appropriate layout
    const contentLayoutProps: ContentLayoutProps | undefined = AppUi.findLayoutFromContentCount(viewIdsSelected.length);
    if (!contentLayoutProps) {
      throw (Error(`Could not find layout ContentLayoutProps when number of viewStates=${viewIdsSelected.length}`));
    }

    let viewStates: ViewState[] = [];
    const promises = new Array<Promise<ViewState>>();
    viewIdsSelected.forEach((viewId: string) => {
      promises.push(iModelConnection.views.load(viewId));
    });

    try {
      viewStates = await Promise.all(promises);
    } catch { }

    // create the content props that specifies an iModelConnection and a viewState entry in the application data.
    const contentProps: ContentProps[] = [];
    viewStates.forEach((viewState, index) => {
      if (0 === index) {
        UiFramework.setDefaultViewState(viewState);
      }
      const thisContentProps: ContentProps = {
        id: `imodel-view-${index}`,
        classId: IModelViewportControl,
        applicationData:
        {
          viewState, iModelConnection,
          featureOptions:
          {
            defaultViewOverlay: {
              enableScheduleAnimationViewOverlay: true,
              enableAnalysisTimelineViewOverlay: true,
              enableSolarTimelineViewOverlay: true,
            },
          },
        },
      };
      contentProps.push(thisContentProps);
    });

    const myContentGroup: ContentGroup = new ContentGroup(
      {
        id: "views-frontstage-default-content-group",
        layout: contentLayoutProps,
        contents: contentProps,
      });
    return myContentGroup;
  }
}

export class ViewsFrontstage extends FrontstageProvider {
  private _contentGroupProvider = new InitialIModelContentStageProvider();
  public static stageId = "ViewsFrontstage";
  public get id(): string {
    return ViewsFrontstage.stageId;
  }

  public static unifiedSelectionPropertyGridId = "UnifiedSelectionPropertyGrid";
  private _additionalTools = new AdditionalTools();

  public static savedViewLayoutProps: string;

  private _rightPanel = {
    allowedZones: [2, 6, 9],
  };

  private _bottomPanel = {
    allowedZones: [2, 7],
  };

  private async applyVisibilityOverrideToSpatialViewports(frontstageDef: FrontstageDef, processedViewport: ScreenViewport, action: HideIsolateEmphasizeAction) {
    frontstageDef?.contentControls?.forEach(async (cc) => {
      const vp = cc.viewport;
      if (vp !== processedViewport && vp?.view?.isSpatialView() && vp.iModel === processedViewport.iModel) {
        switch (action) {
          case HideIsolateEmphasizeAction.ClearHiddenIsolatedEmphasized:
            HideIsolateEmphasizeManager.clearEmphasize(vp);
            break;
          case HideIsolateEmphasizeAction.EmphasizeSelectedElements:
            await HideIsolateEmphasizeManager.emphasizeSelected(vp);
            break;
          case HideIsolateEmphasizeAction.HideSelectedCategories:
            await HideIsolateEmphasizeManager.hideSelectedElementsCategory(vp);
            break;
          case HideIsolateEmphasizeAction.HideSelectedElements:
            HideIsolateEmphasizeManager.hideSelected(vp);
            break;
          case HideIsolateEmphasizeAction.HideSelectedModels:
            await HideIsolateEmphasizeManager.hideSelectedElementsModel(vp);
            break;
          case HideIsolateEmphasizeAction.IsolateSelectedCategories:
            await HideIsolateEmphasizeManager.isolateSelectedElementsCategory(vp);
            break;
          case HideIsolateEmphasizeAction.IsolateSelectedElements:
            HideIsolateEmphasizeManager.isolateSelected(vp);
            break;
          case HideIsolateEmphasizeAction.IsolateSelectedModels:
            await HideIsolateEmphasizeManager.isolateSelectedElementsModel(vp);
            break;
          case HideIsolateEmphasizeAction.ClearOverrideModels:
            HideIsolateEmphasizeManager.clearOverrideModels(vp);
            break;
          case HideIsolateEmphasizeAction.ClearOverrideCategories:
            HideIsolateEmphasizeManager.clearOverrideCategories(vp);
            break;
          default:
            break;
        }
      }
    });
  }

  private _onEmphasizeElementsChangedHandler = (args: EmphasizeElementsChangedArgs) => {
    if (FrontstageManager.activeFrontstageDef && FrontstageManager.activeFrontstageId === ViewsFrontstage.stageId)
      this.applyVisibilityOverrideToSpatialViewports(FrontstageManager.activeFrontstageDef, args.viewport, args.action); // eslint-disable-line @typescript-eslint/no-floating-promises
  };

  constructor() {
    super();

    HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.addListener(this._onEmphasizeElementsChangedHandler);
  }

  /** DEPRECATED way of providing button --- Get the CustomItemDef for ViewSelector  */
  // private get _viewSelectorItemDef() {
  //   return new CustomItemDef({
  //     customId: "sampleApp:viewSelector",
  //     reactElement: (
  //       <IModelConnectedViewSelector
  //         listenForShowUpdates={false}  // Demo for showing only the same type of view in ViewSelector - See IModelViewport.tsx, onActivated
  //       />
  //     ),
  //   });
  // }

  /** Commands that opens switches the content layout */
  private get _additionalNavigationVerticalToolbarItems() {
    const customPopupButton: CustomToolbarItem = {
      isCustom: true,
      id: "test.custom-popup-with-slider",
      itemPriority: 220,
      icon: "icon-arrow-left",
      label: "Slider Test",
      panelContentNode: <MySliderPanel />,
      keepContentsLoaded: true,
      groupPriority: 20,
    };

    const customViewSelectorButton: CustomToolbarItem = {
      isCustom: true,
      id: "sampleApp:viewSelector",
      itemPriority: 200,
      icon: "icon-saved-view",
      label: IModelApp.localization.getLocalizedString("SampleApp:buttons.selectViewToActivate"),
      panelContentNode: <ViewSelectorPanel />,
      keepContentsLoaded: true,
      groupPriority: 20,
    };

    return [
      // DEPRECATED way of providing view selector button --- ToolbarHelper.createToolbarItemFromItemDef(200, this._viewSelectorItemDef),
      customViewSelectorButton,
      ToolbarHelper.createToolbarItemFromItemDef(210,
        new GroupItemDef({
          label: "Layout Demos",
          panelLabel: "Layout Demos",
          iconSpec: "icon-placeholder",
          items: [AppTools.switchLayout1, AppTools.switchLayout2],
        }),
      ),
      customPopupButton,
    ];
  }

  public get frontstage() {
    const iModelConnection = UiFramework.getIModelConnection();

    return (
      <Frontstage id={ViewsFrontstage.stageId}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={this._contentGroupProvider}
        isInFooterMode={true} applicationData={{ key: "value" }}
        usage={StageUsage.General}
        version={3.1} // Defaults to 0. Increment this when Frontstage changes are meaningful enough to reinitialize saved user layout settings.
        contentManipulationTools={
          <Zone
            widgets={
              [
                <Widget isFreeform={true} element={<BasicToolWidget additionalHorizontalItems={this._additionalTools.additionalHorizontalToolbarItems}
                  additionalVerticalItems={this._additionalTools.additionalVerticalToolbarItems} showCategoryAndModelsContextTools={true} />} />,
              ]}
          />
        }
        toolSettings={
          <Zone
            allowsMerging
            widgets={
              [
                <Widget
                  iconSpec="icon-placeholder"
                  isToolSettings={true}
                  preferredPanelSize="fit-content"
                />,
              ]}
          />
        }
        viewNavigationTools={
          <Zone
            widgets={
              [
                <Widget isFreeform={true} element={
                  <BasicNavigationWidget additionalVerticalItems={this._additionalNavigationVerticalToolbarItems} />
                } />,
              ]}
          />
        }
        centerRight={
          <Zone
            allowsMerging
            defaultState={ZoneState.Minimized}
            initialWidth={400}
            widgets={[
              // Used when using map-layers as a package and not using UiItemsProvider (compatible with V1 of framework)
              <Widget id={MapLayersWidgetControl.id} label={MapLayersWidgetControl.label}
                control={MapLayersWidgetControl} iconSpec={MapLayersWidgetControl.iconSpec}
                applicationData={{ hideExternalMapLayers: false, mapTypeOptions: { supportTileUrl: true, supportWmsAuthentication: true }, fetchPublicMapLayerSources: true }} />,

              // <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.NavigationTree" control={NavigationTreeWidgetControl}
              //   applicationData={{ iModelConnection: this.iModelConnection }} fillZone={true} />,
              <Widget iconSpec="icon-visibility" label="Searchable Tree" control={VisibilityWidgetControl}
                applicationData={{
                  iModelConnection,
                  config: {
                    modelsTree: {
                      selectionMode: SelectionMode.Extended,
                      selectionPredicate: (_key: NodeKey, type: ModelsTreeNodeType) => type === ModelsTreeNodeType.Element,
                    },
                  },
                }}
                fillZone={true} />,
            ]}
          />
        }
        bottomLeft={
          <Zone
            allowsMerging
            defaultState={ZoneState.Minimized}
            initialWidth={400}
            widgets={
              [
                <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.UnifiedSelectionTable" control={UnifiedSelectionTableWidgetControl}
                  applicationData={{ iModelConnection }} fillZone={true} badgeType={BadgeType.New} />,
                /* <Widget iconSpec="icon-placeholder" label="External iModel View" control={ViewportWidgetControl} fillZone={true} badgeType={BadgeType.TechnicalPreview}
                   applicationData={{ iTwinName: "iModelHubTest", imodelName: "GrandCanyonTerrain" }} />, */
              ]}
          />
        }
        statusBar={
          <Zone
            widgets={
              [
                <Widget isStatusBar={true} control={AppStatusBarWidgetControl} />,
              ]}
          />
        }
        bottomRight={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true} mergeWithZone={ZoneLocation.CenterRight}
            initialWidth={450}
            widgets={
              [
                <Widget defaultState={WidgetState.Closed} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.UnifiedSelectPropertyGrid"
                  id={ViewsFrontstage.unifiedSelectionPropertyGridId}
                  control={UnifiedSelectionPropertyGridWidgetControl} fillZone={true}
                  applicationData={{ iModelConnection }}
                />,
                <Widget id="VerticalPropertyGrid" defaultState={WidgetState.Hidden} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VerticalPropertyGrid" control={VerticalPropertyGridWidgetControl} />,
              ]}
          />
        }
        rightPanel={
          <StagePanel
            allowedZones={this._rightPanel.allowedZones}
            maxSize={{ percentage: 50 }}
          />
        }
        bottomPanel={
          <StagePanel
            allowedZones={this._bottomPanel.allowedZones}
          />
        }
      />
    );
  }
}

/** Define a ToolWidget with Buttons to display in the TopLeft zone.
 */
class AdditionalTools {
  private _nestedGroup = new GroupItemDef({
    groupId: "nested-group",
    labelKey: "SampleApp:buttons.toolGroup",
    panelLabelKey: "SampleApp:buttons.toolGroup",
    iconSpec: "icon-placeholder",
    items: [AppTools.item1, AppTools.item2, AppTools.item3, AppTools.item4, AppTools.item5, AppTools.item6, AppTools.item7, AppTools.item8],
    // direction: Direction.Bottom,
    itemsInColumn: 7,
  });

  private _openNestedAnimationStageDef = new CommandItemDef({
    iconSpec: "icon-camera-animation",
    labelKey: "SampleApp:buttons.openNestedAnimationStage",
    execute: async () => {
      const activeContentControl = ContentViewManager.getActiveContentControl();
      if (activeContentControl && activeContentControl.viewport &&
        (undefined !== activeContentControl.viewport.view.analysisStyle || undefined !== activeContentControl.viewport.view.scheduleScript)) {
        const frontstageProvider = new NestedAnimationStage();
        const frontstageDef = await FrontstageDef.create(frontstageProvider);
        if (frontstageDef) {
          SampleAppIModelApp.saveAnimationViewId(activeContentControl.viewport.view.id);
          await FrontstageManager.openNestedFrontstage(frontstageDef);
        }
      }
    },
    isHidden: new ConditionalBooleanValue(() => {
      const activeContentControl = ContentViewManager.getActiveContentControl();
      if (activeContentControl && activeContentControl.viewport && (undefined !== activeContentControl.viewport.view.analysisStyle || undefined !== activeContentControl.viewport.view.scheduleScript))
        return false;
      return true;
    }, [SyncUiEventId.ActiveContentChanged]),
  });

  /** Command that opens a nested Frontstage */
  private get _openNestedAnimationStage() {
    return this._openNestedAnimationStageDef;
  }

  /** Tool that will start a sample activity and display ActivityMessage.
   */
  private _tool3 = async () => {
    let isCancelled = false;
    let progress = 0;

    const details = new ActivityMessageDetails(true, true, true, true);
    details.onActivityCancelled = () => {
      isCancelled = true;
    };
    IModelApp.notifications.setupActivityMessage(details);

    while (!isCancelled && progress <= 100) {
      IModelApp.notifications.outputActivityMessage("This is a sample activity message", progress);
      await BeDuration.wait(100);
      progress++;
    }

    const endReason = isCancelled ? ActivityMessageEndReason.Cancelled : ActivityMessageEndReason.Completed;
    IModelApp.notifications.endActivityMessage(endReason);
  };

  /** Tool that will display a pointer message on keyboard presses.
   */
  private _tool4Priority = OutputMessagePriority.Info;
  private _tool4Message = "Move the mouse or press an arrow key.";
  private _tool4Detailed = "Press an arrow key to change position or Escape to dismiss.";
  private _toolRelativePosition = RelativePosition.BottomRight;

  private _tool4 = () => {
    const details = new NotifyMessageDetails(this._tool4Priority, this._tool4Message, this._tool4Detailed, OutputMessageType.Pointer);
    const wrapper = ConfigurableUiManager.getWrapperElement();
    details.setPointerTypeDetails(wrapper, { x: CursorInformation.cursorX, y: CursorInformation.cursorY }, this._toolRelativePosition);
    IModelApp.notifications.outputMessage(details);
    document.addEventListener("keyup", this._handleTool4Keypress);
    document.addEventListener("mousemove", this._handleTool4MouseMove);
  };

  private _handleTool4Keypress = (event: KeyboardEvent) => {
    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "", this._tool4Detailed);
    let changed = false;

    switch (event.key) {
      case SpecialKey.ArrowLeft:
        details.briefMessage = "Left pressed";
        this._toolRelativePosition = RelativePosition.Left;
        changed = true;
        break;
      case SpecialKey.ArrowUp:
        details.briefMessage = "Up pressed";
        this._toolRelativePosition = RelativePosition.Top;
        changed = true;
        break;
      case SpecialKey.ArrowRight:
        details.briefMessage = "Right pressed";
        this._toolRelativePosition = RelativePosition.Right;
        changed = true;
        break;
      case SpecialKey.ArrowDown:
        details.briefMessage = "Down pressed";
        this._toolRelativePosition = RelativePosition.Bottom;
        changed = true;
        break;
      case SpecialKey.Escape:
        this._handleTool4Dismiss();
        break;
    }

    if (changed) {
      IModelApp.notifications.outputMessage(details);
      IModelApp.notifications.updatePointerMessage({ x: CursorInformation.cursorX, y: CursorInformation.cursorY }, this._toolRelativePosition);
    }
  };

  private _handleTool4MouseMove = () => {
    IModelApp.notifications.updatePointerMessage({ x: CursorInformation.cursorX, y: CursorInformation.cursorY }, this._toolRelativePosition);
  };

  private _handleTool4Dismiss = () => {
    IModelApp.notifications.closePointerMessage();
    document.removeEventListener("keyup", this._handleTool4Keypress);
    document.removeEventListener("mousemove", this._handleTool4Dismiss);
  };

  private get _activityMessageItem() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.activityMessage", execute: async () => { await this._tool3(); },
    });
  }

  private get _pointerMessageItem() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.pointerMessage", execute: () => { this._tool4(); },
    });
  }

  private get _outputMessageItem() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.outputMessage",
      execute: () => { IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Test", undefined, OutputMessageType.Sticky)); },
    });
  }

  private get _exampleFormItem() {
    return new CommandItemDef({
      iconSpec: "icon-annotation", label: "Open Example Form", execute: () => { ExampleForm.open(); },
    });
  }

  private get _radialMenuItem() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.openRadial", execute: () => { ModalDialogManager.openDialog(this.radialMenu()); },
    });
  }

  private radialMenu(): React.ReactNode {
    return (
      <TestRadialMenu opened={true} onClose={this._closeModal} />
    );
  }

  private _closeModal = () => {
    ModalDialogManager.closeDialog();
  };

  private get _openCalculatorItem() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.openCalculator", execute: () => { ModalDialogManager.openDialog(<CalculatorDialog opened={true} />); },
    });
  }

  private get _viewportDialogItem() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.viewportDialog", execute: () => { this.openViewportDialog(); },
    });
  }

  private get _spinnerTestDialogItem() {
    const id = "spinners";
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.spinnerTestDialog",
      execute: () => { ModelessDialogManager.openDialog(<SpinnerTestDialog opened={true} onClose={() => ModelessDialogManager.closeDialog(id)} />, id); },
    });
  }

  private _viewportDialogCnt: number = 0;

  private openViewportDialog(): void {
    this._viewportDialogCnt++;
    const id = `ViewportDialog_${this._viewportDialogCnt.toString()}`;

    const dialog = <ViewportDialog opened={true} iTwinName="iModelHubTest" imodelName="GrandCanyonTerrain" dialogId={id} />;

    ModelessDialogManager.openDialog(dialog, id);
  }

  private get _reduceWidgetOpacity() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.reduceWidgetOpacity", execute: () => { UiFramework.setWidgetOpacity(0.50); },
    });
  }

  private get _defaultWidgetOpacity() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.defaultWidgetOpacity", execute: () => { UiFramework.setWidgetOpacity(WIDGET_OPACITY_DEFAULT); },
    });
  }

  private get _startCursorPopup() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.startCursorPopup", execute: async () => {
        // const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
        const content = (
          <CursorPopupContent>
            {FrontstageManager.activeToolSettingsProvider?.toolSettingsNode}
          </CursorPopupContent>
        );
        // CursorPopupManager.open("test1", content, CursorInformation.cursorPosition, new Point(20, 20), RelativePosition.TopRight, 10);
        CursorPopupManager.open("test1", content, CursorInformation.cursorPosition, new Point(20, 20), RelativePosition.TopRight, 10);
        CursorInformation.onCursorUpdatedEvent.addListener(this._handleCursorUpdated);
        document.addEventListener("keyup", this._handleCursorPopupKeypress);
      },
    });
  }

  private get _addCursorPopups() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.addCursorPopups", execute: async () => {
        CursorPopupManager.open("testR1", <CursorPopupContent>Hello World!</CursorPopupContent>, CursorInformation.cursorPosition, new Point(40, 20), RelativePosition.Right, 10);
        CursorPopupManager.open("testBR1", <CursorPopupContent>Hello World!</CursorPopupContent>, CursorInformation.cursorPosition, new Point(20, 20), RelativePosition.BottomRight, 10);
        CursorPopupManager.open("testB1", <CursorPopupContent>Hello World!</CursorPopupContent>, CursorInformation.cursorPosition, new Point(20, 85), RelativePosition.Bottom, 10);
        CursorPopupManager.open("testBL1", <CursorPopupContent>Hello World!</CursorPopupContent>, CursorInformation.cursorPosition, new Point(20, 20), RelativePosition.BottomLeft, 10);
        CursorPopupManager.open("testL1", <CursorPopupContent>Hello World!</CursorPopupContent>, CursorInformation.cursorPosition, new Point(40, 20), RelativePosition.Left, 10);
        CursorPopupManager.open("testTL1", <CursorPopupContent>Hello World!</CursorPopupContent>, CursorInformation.cursorPosition, new Point(20, 20), RelativePosition.TopLeft, 10);
        CursorPopupManager.open("testT1", <CursorPopupContent>Hello World!</CursorPopupContent>, CursorInformation.cursorPosition, new Point(20, 100), RelativePosition.Top, 10);
      },
    });
  }

  private get _endCursorPopup() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.stopCursorPopup", execute: async () => {
        this._closeCursorPopup();
      },
    });
  }

  private _handleCursorUpdated(args: CursorUpdatedEventArgs) {
    // const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(args.direction);
    CursorPopupManager.updatePosition(args.newPt);
  }

  private _handleCursorPopupKeypress = (event: KeyboardEvent) => {
    switch (event.key) {
      case SpecialKey.Escape:
        this._closeCursorPopup();
        break;
    }
  };

  private get _clearMessages() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.clearMessages", execute: () => { MessageManager.clearMessages(); },
    });
  }

  private _closeCursorPopup() {
    CursorPopupManager.close("test1", false);
    CursorPopupManager.close("testR1", false);
    CursorPopupManager.close("testBR1", false);
    CursorPopupManager.close("testB1", false);
    CursorPopupManager.close("testBL1", false);
    CursorPopupManager.close("testL1", false);
    CursorPopupManager.close("testTL1", false);
    CursorPopupManager.close("testT1", false);
    CursorInformation.onCursorUpdatedEvent.removeListener(this._handleCursorUpdated);
    document.removeEventListener("keyup", this._handleCursorPopupKeypress);
  }

  // cSpell:disable

  /** Get the CustomItemDef for PopupButton  */
  private get _viewportPopupButtonItemDef() {
    return new CustomItemDef({
      customId: "test.custom-popup",
      iconSpec: "icon-arrow-down",
      label: "Popup Test",
      badgeType: BadgeType.New,
      popupPanelNode: <MyLoremIpsumPanel />,
    });
  }

  public formatGroupItemsItem = (): CommonToolbarItem => {
    const children = ToolbarHelper.constructChildToolbarItems([
      AppTools.openUnitsFormatDialogCommand,
      AppTools.setLengthFormatMetricCommand,
      AppTools.setLengthFormatImperialCommand,
      AppTools.toggleLengthFormatOverrideCommand,
    ]);
    const item = ToolbarItemUtilities.createGroupButton("tool-formatting-setting", 135, "icon-placeholder", "set formatting units", children, { badgeType: BadgeType.New, groupPriority: 40 });
    return item;
  };

  // cSpell:enable
  public additionalHorizontalToolbarItems: CommonToolbarItem[] = [
    // ToolbarHelper.createToolbarItemFromItemDef(0, CoreTools.keyinBrowserButtonItemDef, {groupPriority: -10 }),
    ToolbarHelper.createToolbarItemFromItemDef(0, CoreTools.keyinPaletteButtonItemDef, { groupPriority: -10 }),
    ToolbarHelper.createToolbarItemFromItemDef(5, this._openNestedAnimationStage, { groupPriority: -10 }),
    ToolbarHelper.createToolbarItemFromItemDef(115, AppTools.tool1, { groupPriority: 20 }),
    ToolbarHelper.createToolbarItemFromItemDef(120, AppTools.tool2, { groupPriority: 20 }),
    ToolbarHelper.createToolbarItemFromItemDef(125, this._viewportPopupButtonItemDef, { groupPriority: 20 }),
    ToolbarHelper.createToolbarItemFromItemDef(130, AppTools.toolWithSettings, { groupPriority: 30 }),
    ToolbarHelper.createToolbarItemFromItemDef(132, AppTools.analysisAnimationCommand, { groupPriority: 30 }),
    ToolbarHelper.createToolbarItemFromItemDef(135, ToolWithDynamicSettings.toolItemDef, { groupPriority: 30 }),
    ToolbarHelper.createToolbarItemFromItemDef(140, AppTools.toggleHideShowItemsCommand, { groupPriority: 30 }),
    ToolbarHelper.createToolbarItemFromItemDef(145, new CommandItemDef({
      commandId: "Show widget",
      iconSpec: <SvgApple />,
      label: "Show widget",
      execute: () => {
        const frontstageDef = FrontstageManager.activeFrontstageDef;
        if (!frontstageDef)
          return;
        const widgetDef = frontstageDef.findWidgetDef("uitestapp-test-wd3");
        if (!widgetDef)
          return;
        widgetDef.setWidgetState(WidgetState.Open);
        widgetDef.expand();
      },
    }), { groupPriority: 30 }),
    ToolbarHelper.createToolbarItemFromItemDef(140, CoreTools.restoreFrontstageLayoutCommandItemDef, { groupPriority: 40 }),
    this.formatGroupItemsItem(),
  ];

  public getMiscGroupItem = (): CommonToolbarItem => {
    const children = ToolbarHelper.constructChildToolbarItems([
      this._nestedGroup,
      AppTools.saveContentLayout,
      AppTools.restoreSavedContentLayout,
      this._startCursorPopup,
      this._addCursorPopups,
      this._endCursorPopup,
      AccuDrawPopupTools.addMenuButton,
      AccuDrawPopupTools.hideMenuButton,
      AccuDrawPopupTools.showCalculator,
      AccuDrawPopupTools.showAngleEditor,
      AccuDrawPopupTools.showLengthEditor,
      AccuDrawPopupTools.showHeightEditor,
      AccuDrawPopupTools.showInputEditor,
    ]);

    const groupHiddenCondition = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);
    const item = ToolbarItemUtilities.createGroupButton("SampleApp:buttons.anotherGroup", 130, "icon-placeholder", IModelApp.localization.getLocalizedString("SampleApp:buttons.anotherGroup"), children, { badgeType: BadgeType.New, isHidden: groupHiddenCondition, groupPriority: 30 });
    return item;
  };

  // test ToolbarHelper.createToolbarItemsFromItemDefs
  public additionalVerticalToolbarItems: CommonToolbarItem[] = [...ToolbarHelper.createToolbarItemsFromItemDefs([
    new GroupItemDef({
      labelKey: "SampleApp:buttons.openCloseProperties",
      panelLabel: "Open Close Properties",
      iconSpec: "icon-placeholder",
      items: [AppTools.verticalPropertyGridOpenCommand, AppTools.verticalPropertyGridOffCommand],
    }),
    new GroupItemDef({
      labelKey: "SampleApp:buttons.messageDemos",
      panelLabel: "Message Demos",
      iconSpec: "icon-placeholder",
      items: [this._activityMessageItem, this._pointerMessageItem, this._outputMessageItem, this._clearMessages],
    }),
    new GroupItemDef({
      labelKey: "SampleApp:buttons.dialogDemos",
      panelLabel: "Dialog Demos",
      iconSpec: "icon-placeholder",
      items: [
        this._radialMenuItem, this._exampleFormItem, this._viewportDialogItem, this._spinnerTestDialogItem,
        this._reduceWidgetOpacity, this._defaultWidgetOpacity, this._openCalculatorItem,
      ],
      badgeType: BadgeType.TechnicalPreview,
    }),
  ], 100, { groupPriority: 20 }), this.getMiscGroupItem(), OpenComponentExamplesPopoutTool.getActionButtonDef(400, 40),
  OpenCustomPopoutTool.getActionButtonDef(410, 40), OpenViewPopoutTool.getActionButtonDef(420, 40)];
}


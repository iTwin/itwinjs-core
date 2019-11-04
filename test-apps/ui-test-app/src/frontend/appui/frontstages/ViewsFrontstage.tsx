/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { BeDuration } from "@bentley/bentleyjs-core";

import {
  IModelConnection,
  IModelApp,
  ActivityMessageDetails,
  ActivityMessageEndReason,
  NotifyMessageDetails,
  OutputMessagePriority,
  OutputMessageType,
  ViewState,
} from "@bentley/imodeljs-frontend";

import { BadgeType, RelativePosition } from "@bentley/ui-abstract";
import { ScrollView, Point } from "@bentley/ui-core";

import {
  FrontstageProvider,
  ToolWidget,
  ZoneState,
  ContentLayoutDef,
  ContentLayoutProps,
  ContentGroup,
  ContentProps,
  ModalDialogManager,
  IModelConnectedViewSelector,
  ModelSelectorWidgetControl,
  Frontstage,
  Zone,
  Widget,
  GroupItemDef,
  BaseItemState,
  CoreTools,
  SyncUiEventId,
  WidgetState,
  ContentViewManager,
  StagePanel,
  FrontstageManager,
  CommandItemDef,
  ModelessDialogManager,
  UiFramework,
  WIDGET_OPACITY_DEFAULT,
  ItemList,
  ToolItemDef,
  ConditionalItemDef,
  ContentLayoutManager,
  SavedViewLayout,
  SavedViewLayoutProps,
  CustomItemDef,
  CursorInformation,
  CursorUpdatedEventArgs,
  RealityDataPickerControl,
  PopupButton,
  CursorPopupManager,
  CursorPopupContent,
  VisibilityWidget,
  VisibilityComponentHierarchy,
  ZoneLocation,
  StagePanelHeader,
  StagePanelLocation,
  IModelConnectedNavigationWidget,
  StagePanelState,
} from "@bentley/ui-framework";

import { AppUi } from "../AppUi";
import { TestRadialMenu } from "../dialogs/TestRadialMenu";
import { CalculatorDialog } from "../dialogs/CalculatorDialog";
import { AppTools } from "../../tools/ToolSpecifications";

import { SampleAppIModelApp, SampleAppUiActionId } from "../../../frontend/index";

// cSpell:Ignore contentviews statusbars
import { IModelViewportControl } from "../contentviews/IModelViewport";
import { AppStatusBarWidgetControl } from "../statusbars/AppStatusBar";
import { VerticalPropertyGridWidgetControl } from "../widgets/PropertyGridDemoWidget";
import { NavigationTreeWidgetControl } from "../widgets/NavigationTreeWidget";
import { VisibilityTreeWidgetControl } from "../widgets/VisibilityTreeWidget";
import { BreadcrumbDemoWidgetControl } from "../widgets/BreadcrumbDemoWidget";

import { FeedbackDemoWidget } from "../widgets/FeedbackWidget";
import { UnifiedSelectionPropertyGridWidgetControl } from "../widgets/UnifiedSelectionPropertyGridWidget";
import { UnifiedSelectionTableWidgetControl } from "../widgets/UnifiedSelectionTableWidget";
import { ViewportWidgetControl, ViewportWidget } from "../widgets/ViewportWidget";
import { ViewportDialog } from "../dialogs/ViewportDialog";
import { NestedAnimationStage } from "./NestedAnimationStage";
import { ExampleForm } from "../forms/ExampleForm";

// SVG Support - SvgPath or SvgSprite
// import { SvgPath } from "@bentley/ui-core";
// import rotateIcon from "../icons/rotate.svg";

import { AccuDrawPopupTools } from "../../tools/AccuDrawPopupTools";

export class ViewsFrontstage extends FrontstageProvider {
  public static savedViewLayoutProps: string;
  private _leftPanel = {
    widgets: [
      <Widget
        iconSpec="icon-placeholder"
        labelKey="SampleApp:widgets.VisibilityTree"
        control={VisibilityTreeWidgetControl}
      />,
    ],
  };

  private _rightPanel = {
    allowedZones: [2, 6, 9],
  };

  private _bottomPanel = {
    allowedZones: [2],
  };

  constructor(public viewStates: ViewState[], public iModelConnection: IModelConnection) {
    super();
  }

  /** Get the CustomItemDef for ViewSelector  */
  private get _viewSelectorItemDef() {
    return new CustomItemDef({
      customId: "sampleApp:viewSelector",
      reactElement: (
        <IModelConnectedViewSelector
          listenForShowUpdates={false}  // Demo for showing only the same type of view in ViewSelector - See IModelViewport.tsx, onActivated
        />
      ),
    });
  }

  public get frontstage() {
    // first find an appropriate layout
    const contentLayoutProps: ContentLayoutProps | undefined = AppUi.findLayoutFromContentCount(this.viewStates.length);
    if (!contentLayoutProps) {
      throw (Error("Could not find layout ContentLayoutProps when number of viewStates=" + this.viewStates.length));
    }

    const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(contentLayoutProps);

    // create the content props that specifies an iModelConnection and a viewState entry in the application data.
    const contentProps: ContentProps[] = [];
    for (const viewState of this.viewStates) {
      const thisContentProps: ContentProps = {
        classId: IModelViewportControl,
        applicationData: { viewState, iModelConnection: this.iModelConnection },
      };
      contentProps.push(thisContentProps);
    }
    const myContentGroup: ContentGroup = new ContentGroup({ contents: contentProps });
    return (
      <Frontstage id="ViewsFrontstage"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={contentLayoutDef} contentGroup={myContentGroup}
        isInFooterMode={true} applicationData={{ key: "value" }}
        topLeft={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<FrontstageToolWidget />} />,
            ]}
          />
        }
        topCenter={
          <Zone
            allowsMerging
            widgets={[
              <Widget
                iconSpec="icon-placeholder"
                isToolSettings={true}
              />,
            ]}
          />
        }
        topRight={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<IModelConnectedNavigationWidget suffixVerticalItems={new ItemList([this._viewSelectorItemDef])} />} />,
            ]}
          />
        }
        centerLeft={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true}
            widgets={[
              <Widget defaultState={WidgetState.Closed} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.FeedbackDemo" control={FeedbackDemoWidget}
                syncEventIds={[SampleAppUiActionId.setTestProperty]}
                stateFunc={(): WidgetState => SampleAppIModelApp.getTestProperty() !== "HIDE" ? WidgetState.Closed : WidgetState.Hidden}
              />,
              <Widget defaultState={WidgetState.Closed} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.BreadcrumbDemo" control={BreadcrumbDemoWidgetControl}
                syncEventIds={[SampleAppUiActionId.setTestProperty]}
                stateFunc={(): WidgetState => SampleAppIModelApp.getTestProperty() !== "HIDE" ? WidgetState.Closed : WidgetState.Hidden}
              />,
              <Widget defaultState={WidgetState.Closed} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.ModelSelector" control={ModelSelectorWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection }} fillZone={true}
                syncEventIds={[SampleAppUiActionId.setTestProperty]}
                stateFunc={(): WidgetState => SampleAppIModelApp.getTestProperty() !== "HIDE" ? WidgetState.Closed : WidgetState.Hidden}
              />,
            ]}
          />
        }
        centerRight={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true}
            widgets={[
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.NavigationTree" control={NavigationTreeWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection, rulesetId: "Items" }} fillZone={true} />,
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VisibilityTree" control={VisibilityTreeWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection }} fillZone={true} />,
              <Widget iconSpec={VisibilityWidget.iconSpec} label={VisibilityWidget.label} control={VisibilityWidget}
                applicationData={{ iModelConnection: this.iModelConnection, enableHierarchiesPreloading: [VisibilityComponentHierarchy.Categories] }} fillZone={true} />,
              <Widget iconSpec={RealityDataPickerControl.iconSpec} label={RealityDataPickerControl.label} control={RealityDataPickerControl}
                applicationData={{ iModelConnection: this.iModelConnection }} fillZone={true} />,
            ]}
          />
        }
        bottomLeft={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true}
            widgets={[
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.UnifiedSelectionTable" control={UnifiedSelectionTableWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection, rulesetId: "Items" }} fillZone={true} badgeType={BadgeType.New} />,
              <Widget iconSpec="icon-placeholder" label="External iModel View" control={ViewportWidgetControl} fillZone={true} betaBadge={true}
                applicationData={{ projectName: "iModelHubTest", imodelName: "86_Hospital" }} />,
            ]}
          />
        }
        bottomCenter={
          <Zone
            widgets={[
              <Widget isStatusBar={true} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.StatusBar" control={AppStatusBarWidgetControl} />,
            ]}
          />
        }
        bottomRight={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true} mergeWithZone={ZoneLocation.CenterRight}
            widgets={[
              <Widget defaultState={WidgetState.Closed} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.UnifiedSelectPropertyGrid"
                control={UnifiedSelectionPropertyGridWidgetControl} fillZone={true}
                applicationData={{ iModelConnection: this.iModelConnection, rulesetId: "Items" }}
                syncEventIds={[SyncUiEventId.SelectionSetChanged]}
                stateFunc={(): WidgetState => {
                  const activeContentControl = ContentViewManager.getActiveContentControl();
                  if (activeContentControl && activeContentControl.viewport && (activeContentControl.viewport.view.iModel.selectionSet.size > 0))
                    return WidgetState.Open;
                  return WidgetState.Closed;
                }}
              />,
              <Widget id="VerticalPropertyGrid" defaultState={WidgetState.Hidden} iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VerticalPropertyGrid" control={VerticalPropertyGridWidgetControl} />,
            ]}
          />
        }
        leftPanel={
          <StagePanel
            header={<StagePanelHeader
              collapseButton
              collapseButtonTitle="Collapse"
              location={StagePanelLocation.Left}
              title="Visibility tree"
            />}
            defaultState={StagePanelState.Minimized}
            size={280}
            widgets={this._leftPanel.widgets}
          />
        }
        rightPanel={
          <StagePanel
            allowedZones={this._rightPanel.allowedZones}
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
class FrontstageToolWidget extends React.Component {
  private _nestedGroup = new GroupItemDef({
    groupId: "nested-group",
    labelKey: "SampleApp:buttons.toolGroup",
    iconSpec: "icon-placeholder",
    items: [AppTools.item1, AppTools.item2, AppTools.item3, AppTools.item4, AppTools.item5,
    AppTools.item6, AppTools.item7, AppTools.item8],
    // direction: Direction.Bottom,
    itemsInColumn: 7,
  });

  private get _groupItemDef(): GroupItemDef {
    return this._nestedGroup;
  }

  private _openNestedAnimationStageDef = new CommandItemDef({
    iconSpec: "icon-camera-animation",
    labelKey: "SampleApp:buttons.openNestedAnimationStage",
    execute: async () => {
      const activeContentControl = ContentViewManager.getActiveContentControl();
      if (activeContentControl && activeContentControl.viewport &&
        (undefined !== activeContentControl.viewport.view.analysisStyle || undefined !== activeContentControl.viewport.view.scheduleScript)) {
        const frontstageProvider = new NestedAnimationStage();
        const frontstageDef = frontstageProvider.initializeDef();
        SampleAppIModelApp.saveAnimationViewId(activeContentControl.viewport.view.id);
        await FrontstageManager.openNestedFrontstage(frontstageDef);
      }
    },
    isVisible: false, // default to not show and then allow stateFunc to redefine.
    stateSyncIds: [SyncUiEventId.ActiveContentChanged],
    stateFunc: (currentState: Readonly<BaseItemState>): BaseItemState => {
      const returnState: BaseItemState = { ...currentState };
      const activeContentControl = ContentViewManager.getActiveContentControl();
      if (activeContentControl && activeContentControl.viewport &&
        (undefined !== activeContentControl.viewport.view.analysisStyle || undefined !== activeContentControl.viewport.view.scheduleScript))
        returnState.isVisible = true;
      else
        returnState.isVisible = false;
      return returnState;
    },
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
  }

  /** Tool that will display a pointer message on keyboard presses.
   */
  private _tool4Priority = OutputMessagePriority.Info;
  private _tool4Message = "Move the mouse or press an arrow key.";
  private _tool4Detailed = "Press an arrow key to change position or Escape to dismiss.";
  private _toolRelativePosition = RelativePosition.BottomRight;

  private _tool4 = () => {
    const details = new NotifyMessageDetails(this._tool4Priority, this._tool4Message, this._tool4Detailed, OutputMessageType.Pointer);
    const wrapper = document.getElementById("uifw-configurableui-wrapper");
    details.setPointerTypeDetails(wrapper!, { x: CursorInformation.cursorX, y: CursorInformation.cursorY }, this._toolRelativePosition);
    IModelApp.notifications.outputMessage(details);
    document.addEventListener("keyup", this._handleTool4Keypress);
    document.addEventListener("mousemove", this._handleTool4MouseMove);
  }

  private _handleTool4Keypress = (event: any) => {
    const details = new NotifyMessageDetails(OutputMessagePriority.Info, "", this._tool4Detailed);
    let changed = false;

    switch (event.keyCode) {
      case 37:
        details.briefMessage = "Left pressed";
        this._toolRelativePosition = RelativePosition.Left;
        changed = true;
        break;
      case 38:
        details.briefMessage = "Up pressed";
        this._toolRelativePosition = RelativePosition.Top;
        changed = true;
        break;
      case 39:
        details.briefMessage = "Right pressed";
        this._toolRelativePosition = RelativePosition.Right;
        changed = true;
        break;
      case 40:
        details.briefMessage = "Down pressed";
        this._toolRelativePosition = RelativePosition.Bottom;
        changed = true;
        break;
      case 27:  // Escape
        this._handleTool4Dismiss();
        break;
    }

    if (changed) {
      IModelApp.notifications.outputMessage(details);
      IModelApp.notifications.updatePointerMessage({ x: CursorInformation.cursorX, y: CursorInformation.cursorY }, this._toolRelativePosition);
    }
  }

  private _handleTool4MouseMove = () => {
    IModelApp.notifications.updatePointerMessage({ x: CursorInformation.cursorX, y: CursorInformation.cursorY }, this._toolRelativePosition);
  }

  private _handleTool4Dismiss = () => {
    IModelApp.notifications.closePointerMessage();
    document.removeEventListener("keyup", this._handleTool4Keypress);
    document.removeEventListener("mousemove", this._handleTool4Dismiss);
  }

  private get _tool3Item() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.activityMessage", execute: async () => { await this._tool3(); },
    });
  }

  private get _tool4Item() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.pointerMessage", execute: () => { this._tool4(); },
    });
  }

  private get _outputMessageItem() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.outputMessage",
      execute: () => { IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Test")); },
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
      <TestRadialMenu opened={true} />
    );
  }

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

  private _viewportDialogCnt: number = 0;

  private openViewportDialog(): void {
    this._viewportDialogCnt++;
    const id = "ViewportDialog_" + this._viewportDialogCnt.toString();

    const dialog = <ViewportDialog opened={true} projectName="iModelHubTest" imodelName="86_Hospital" dialogId={id} />;

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

  private get _saveContentLayout() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.saveContentLayout", betaBadge: true, execute: () => {
        if (ContentLayoutManager.activeLayout && ContentLayoutManager.activeContentGroup) {
          // Create props for the Layout, ContentGroup and ViewStates
          const savedViewLayoutProps = SavedViewLayout.viewLayoutToProps(ContentLayoutManager.activeLayout, ContentLayoutManager.activeContentGroup, true,
            (contentProps: ContentProps) => {
              if (contentProps.applicationData)
                delete contentProps.applicationData;
            });

          // Save the SavedViewLayoutProps
          ViewsFrontstage.savedViewLayoutProps = JSON.stringify(savedViewLayoutProps);
        }
      },
    });
  }

  private get _restoreContentLayout() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.restoreContentLayout", badgeType: BadgeType.New, execute: async () => {
        const iModelConnection = UiFramework.getIModelConnection();
        if (ViewsFrontstage.savedViewLayoutProps && iModelConnection) {
          // Parse SavedViewLayoutProps
          const savedViewLayoutProps: SavedViewLayoutProps = JSON.parse(ViewsFrontstage.savedViewLayoutProps);
          // Create ContentLayoutDef
          const contentLayoutDef = new ContentLayoutDef(savedViewLayoutProps.contentLayoutProps);
          // Create ViewStates
          const viewStates = await SavedViewLayout.viewStatesFromProps(iModelConnection, savedViewLayoutProps);

          // Add applicationData to the ContentProps
          savedViewLayoutProps.contentGroupProps.contents.forEach((contentProps: ContentProps, index: number) => {
            contentProps.applicationData = { viewState: viewStates[index], iModelConnection, rulesetId: "Items" };
          });
          const contentGroup = new ContentGroup(savedViewLayoutProps.contentGroupProps);

          // activate the layout
          await ContentLayoutManager.setActiveLayout(contentLayoutDef, contentGroup);

          // emphasize the elements
          SavedViewLayout.emphasizeElementsFromProps(contentGroup, savedViewLayoutProps);
        }
      },
    });
  }

  private get _startCursorPopup() {
    return new CommandItemDef({
      iconSpec: "icon-placeholder", labelKey: "SampleApp:buttons.startCursorPopup", execute: async () => {
        // const relativePosition = CursorInformation.getRelativePositionFromCursorDirection(CursorInformation.cursorDirection);
        const content = (
          <CursorPopupContent>
            {FrontstageManager.activeToolSettingsNode}
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

  private _handleCursorPopupKeypress = (event: any) => {
    switch (event.keyCode) {
      case 27:  // Escape
        this._closeCursorPopup();
        break;
    }
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

  /** example that hides the button if active content is not a 3d View */
  private _anotherGroupStateFunc = (currentState: Readonly<BaseItemState>): BaseItemState => {
    const returnState: BaseItemState = { ...currentState };
    returnState.isVisible = ContentViewManager.isContent3dView(ContentViewManager.getActiveContentControl());
    return returnState;
  }

  /** example that disables the button if active content is not a 3d view */
  private _measureStateFunc = (currentState: Readonly<BaseItemState>): BaseItemState => {
    const returnState: BaseItemState = { ...currentState };
    returnState.isEnabled = ContentViewManager.isContent3dView(ContentViewManager.getActiveContentControl());
    return returnState;
  }

  private _visibleTestStateFunc = (currentState: Readonly<BaseItemState>): BaseItemState => {
    const returnState: BaseItemState = { ...currentState };
    returnState.isVisible = SampleAppIModelApp.getTestProperty() !== "HIDE";
    return returnState;
  }

  private _enabledTestStateFunc = (currentState: Readonly<BaseItemState>): BaseItemState => {
    const returnState: BaseItemState = { ...currentState };
    returnState.isEnabled = SampleAppIModelApp.getTestProperty() !== "HIDE";
    return returnState;
  }

  private executeMeasureByPoints() {
    IModelApp.tools.run("Measure.Distance");
  }

  //  /** Get the CustomItemDef for PopupButton  */
  //  private get _popupButtonItemDef() {
  //    return new CustomItemDef({
  //      reactElement: (
  //        <PopupButton iconSpec="icon-arrow-down" label="Popup Test" betaBadge={true}>
  //          <div style={{ width: "200px", height: "100px" }}>
  //            hello world!
  //          </div>
  //        </PopupButton>
  //      ),
  //    });
  //  }

  // cSpell:disable

  /** Get the CustomItemDef for PopupButton  */
  private get _viewportPopupButtonItemDef() {
    return new CustomItemDef({
      reactElement: (
        <PopupButton iconSpec="icon-arrow-down" label="Popup Test" badgeType={BadgeType.New}>
          <div style={{ width: "400px", height: "300px" }}>
            <ScrollView>
              <div>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
                dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
                proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </div>
              <ViewportWidget projectName="iModelHubTest" imodelName="86_Hospital" />
              <div>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure
                dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
                proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
              </div>
            </ScrollView>
          </div>
        </PopupButton>
      ),
    });
  }

  // cSpell:enable

  private _horizontalToolbarItems = new ItemList([
    CoreTools.selectElementCommand,
    this._openNestedAnimationStage,
    new ToolItemDef({
      toolId: "Measure.Points", iconSpec: "icon-measure-distance", labelKey: "SampleApp:tools.Measure.Points.flyover",
      execute: this.executeMeasureByPoints, stateSyncIds: [SyncUiEventId.ActiveContentChanged], stateFunc: this._measureStateFunc,
      betaBadge: true,
    }),
    CoreTools.keyinBrowserButtonItemDef,
    AppTools.tool1,
    new ConditionalItemDef({
      conditionalId: "Conditional-tool-2",
      items: [AppTools.tool2, this._viewportPopupButtonItemDef],
      stateSyncIds: [SampleAppUiActionId.setTestProperty],
      stateFunc: this._enabledTestStateFunc,
      badgeType: BadgeType.New,
    }),
    AppTools.toolWithSettings,
    AppTools.toggleHideShowItemsCommand,
    new ConditionalItemDef({
      conditionalId: "Conditional-formatting",
      items: [
        new GroupItemDef({
          groupId: "tool-formatting-setting",
          labelKey: "SampleApp:buttons.toolGroup",
          iconSpec: "icon-placeholder",
          items: [AppTools.setLengthFormatMetricCommand, AppTools.setLengthFormatImperialCommand, AppTools.toggleLengthFormatCommand, CoreTools.clearSelectionItemDef],
          itemsInColumn: 4,
        }),
      ],
      stateSyncIds: [SampleAppUiActionId.setTestProperty],
      stateFunc: this._visibleTestStateFunc,
      betaBadge: true,
    }),
  ]);

  private _verticalToolbarItems = new ItemList([
    CoreTools.measureToolGroup,
    new GroupItemDef({
      labelKey: "SampleApp:buttons.openCloseProperties",
      panelLabel: "Open Close Properties",
      iconSpec: "icon-placeholder",
      items: [AppTools.verticalPropertyGridOpenCommand, AppTools.verticalPropertyGridOffCommand],
    }),
    new GroupItemDef({
      labelKey: "SampleApp:buttons.messageDemos",
      // deprecated way of using tooltip to specify panelLabel
      tooltip: "Message Demos (Tooltip)",
      iconSpec: "icon-placeholder",
      items: [this._tool3Item, this._tool4Item, this._outputMessageItem],
    }),
    new GroupItemDef({
      labelKey: "SampleApp:buttons.dialogDemos",
      panelLabel: "Dialog Demos",
      iconSpec: "icon-placeholder",
      items: [this._radialMenuItem, this._exampleFormItem, this._viewportDialogItem, this._reduceWidgetOpacity, this._defaultWidgetOpacity, this._openCalculatorItem],
      badgeType: BadgeType.New,
    }),
    new GroupItemDef({
      labelKey: "SampleApp:buttons.anotherGroup",
      iconSpec: "icon-placeholder",
      items: [
        AppTools.tool1, AppTools.tool2, this._groupItemDef,
        this._saveContentLayout, this._restoreContentLayout,
        this._startCursorPopup, this._addCursorPopups, this._endCursorPopup,
        AccuDrawPopupTools.addMenuButton, AccuDrawPopupTools.hideMenuButton, AccuDrawPopupTools.showCalculator,
        AccuDrawPopupTools.showAngleEditor, AccuDrawPopupTools.showLengthEditor, AccuDrawPopupTools.showHeightEditor,
      ],
      stateSyncIds: [SyncUiEventId.ActiveContentChanged],
      stateFunc: this._anotherGroupStateFunc,
      betaBadge: true,
    }),
  ]);

  public render() {
    return (
      <ToolWidget
        appButton={AppTools.backstageToggleCommand}
        horizontalItems={this._horizontalToolbarItems}
        verticalItems={this._verticalToolbarItems}
      />
    );
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { Id64String, BeDuration } from "@bentley/bentleyjs-core";

import {
  IModelConnection,
  IModelApp,
  ActivityMessageDetails,
  ActivityMessageEndReason,
  NotifyMessageDetails,
  OutputMessagePriority,
  OutputMessageType,
  RelativePosition,
} from "@bentley/imodeljs-frontend";

import {
  FrontstageProvider,
  ToolWidget,
  ZoneState,
  NavigationWidget,
  ContentLayoutDef,
  ContentLayoutProps,
  ContentGroup,
  ContentProps,
  ModalDialogManager,
  ViewSelector,
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
  PopupButton,
  CustomItemDef,
} from "@bentley/ui-framework";

import { AppUi } from "../AppUi";
import { TestRadialMenu } from "../dialogs/TestRadialMenu";
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
import { ViewportWidgetControl } from "../widgets/ViewportWidget";
import { ViewportDialog } from "../dialogs/ViewportDialog";
import { NestedAnimationStage } from "./NestedAnimationStage";

// SVG Support - SvgPath or SvgSprite
// import { SvgPath } from "@bentley/ui-core";

import { SvgSprite } from "@bentley/ui-core";
import rotateIcon from "../icons/rotate.svg";

export class ViewsFrontstage extends FrontstageProvider {

  constructor(public viewIds: Id64String[], public iModelConnection: IModelConnection) {
    super();
  }

  public get frontstage() {
    // first find an appropriate layout
    const contentLayoutProps: ContentLayoutProps | undefined = AppUi.findLayoutFromContentCount(this.viewIds.length);
    if (!contentLayoutProps) {
      throw (Error("Could not find layout ContentLayoutProps from number of viewIds: " + this.viewIds.length));
    }

    const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(contentLayoutProps);

    // create the content props.
    const contentProps: ContentProps[] = [];
    for (const viewId of this.viewIds) {
      const thisContentProps: ContentProps = {
        classId: IModelViewportControl,
        applicationData: { viewId, iModelConnection: this.iModelConnection, rulesetId: "Items" },
      };
      contentProps.push(thisContentProps);
    }
    const myContentGroup: ContentGroup = new ContentGroup({ contents: contentProps });

    return (
      <Frontstage id="ViewsFrontstage"
        defaultTool={AppTools.appSelectElementCommand}
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
            widgets={[
              <Widget isToolSettings={true} />,
            ]}
          />
        }
        topRight={
          <Zone
            widgets={[
              <Widget isFreeform={true} element={<FrontstageNavigationWidget />} />,
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
            ]}
          />
        }
        bottomLeft={
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true}
            widgets={[
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.UnifiedSelectionTable" control={UnifiedSelectionTableWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection, rulesetId: "Items" }} fillZone={true} />,
              <Widget iconSpec="icon-placeholder" label="External iModel View" control={ViewportWidgetControl} fillZone={true}
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
          <Zone defaultState={ZoneState.Minimized} allowsMerging={true}
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
          <StagePanel size="280px"
            widgets={[
              <Widget iconSpec="icon-placeholder" labelKey="SampleApp:widgets.VisibilityTree"
                control={VisibilityTreeWidgetControl}
                applicationData={{ iModelConnection: this.iModelConnection }} />,
            ]}
          />
        }
      />
    );
  }
}

/** Define a ToolWidget with Buttons to display in the TopLeft zone.
 */
class FrontstageToolWidget extends React.Component {

  private get _groupItemDef(): GroupItemDef {
    return new GroupItemDef({
      groupId: "nested-group",
      labelKey: "SampleApp:buttons.toolGroup",
      iconSpec: "icon-placeholder",
      items: [AppTools.item1, AppTools.item2, AppTools.item3, AppTools.item4, AppTools.item5,
      AppTools.item6, AppTools.item7, AppTools.item8],
      // direction: Direction.Bottom,
      itemsInColumn: 7,
    });
  }

  /** Command that opens a nested Frontstage */
  private get _openNestedAnimationStage() {
    return new CommandItemDef({
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
  private _tool4 = () => {
    const details = new NotifyMessageDetails(OutputMessagePriority.Error, "Press an arrow", "Press an arrow and move mouse to dismiss", OutputMessageType.Pointer);
    details.setPointerTypeDetails(IModelApp.viewManager.selectedView!.parentDiv,
      {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
    IModelApp.notifications.outputMessage(details);
    document.addEventListener("keyup", this._handleTool4Keypress);
    document.addEventListener("mousemove", this._handleTool4Dismiss);
  }

  private _handleTool4Keypress = (event: any) => {
    const details = new NotifyMessageDetails(OutputMessagePriority.Warning, "", "", OutputMessageType.Pointer);
    const viewport = IModelApp.viewManager.selectedView!.parentDiv;
    const midX = window.innerWidth / 2;
    const midY = window.innerHeight / 2;
    switch (event.keyCode) {
      case 37:
        details.briefMessage = "Left pressed";
        details.setPointerTypeDetails(viewport, { x: midX, y: midY }, RelativePosition.Left);
        IModelApp.notifications.outputMessage(details);
        break;
      case 38:
        details.briefMessage = "Up pressed";
        details.setPointerTypeDetails(viewport, { x: midX, y: midY }, RelativePosition.Top);
        IModelApp.notifications.outputMessage(details);
        break;
      case 39:
        details.briefMessage = "Right pressed";
        details.setPointerTypeDetails(viewport, { x: midX, y: midY }, RelativePosition.Right);
        IModelApp.notifications.outputMessage(details);
        break;
      case 40:
        details.briefMessage = "Down pressed";
        details.setPointerTypeDetails(viewport, { x: midX, y: midY }, RelativePosition.Bottom);
        IModelApp.notifications.outputMessage(details);
        break;
    }
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

  /** Get the CustomItemDef for PopupButton  */
  private get _popupButtonItemDef() {
    return new CustomItemDef({
      reactElement: (
        <PopupButton iconSpec="icon-arrow-down" label="Popup Test">
          <div style={{ width: "200px", height: "100px" }}>
            hello world!
          </div>
        </PopupButton>
      ),
    });
  }

  private get _horizontalToolbarItems(): ItemList {
    const items = new ItemList([
      AppTools.appSelectElementCommand,
      this._openNestedAnimationStage,
      new ToolItemDef({
        toolId: "Measure.Points", iconSpec: "icon-measure-distance", labelKey: "SampleApp:tools.Measure.Points.flyover",
        execute: this.executeMeasureByPoints, stateSyncIds: [SyncUiEventId.ActiveContentChanged], stateFunc: this._measureStateFunc,
      }),
      this._popupButtonItemDef,
      AppTools.tool1,
      new ConditionalItemDef({
        items: [AppTools.tool2],
        stateSyncIds: [SampleAppUiActionId.setTestProperty],
        stateFunc: this._enabledTestStateFunc,
      }),
      AppTools.toolWithSettings,
      AppTools.toggleHideShowItemsCommand,
      new ConditionalItemDef({
        items: [
          new GroupItemDef({
            labelKey: "SampleApp:buttons.toolGroup",
            iconSpec: "icon-placeholder",
            items: [AppTools.setLengthFormatMetricCommand, AppTools.setLengthFormatImperialCommand, AppTools.toggleLengthFormatCommand],
            itemsInColumn: 4,
          }),
        ],
        stateSyncIds: [SampleAppUiActionId.setTestProperty],
        stateFunc: this._visibleTestStateFunc,
      }),
    ]);
    return items;
  }

  private get _verticalToolbarItems(): ItemList {
    const items = new ItemList([
      new GroupItemDef({
        labelKey: "SampleApp:buttons.openCloseProperties",
        iconSpec: "icon-placeholder",
        items: [AppTools.verticalPropertyGridOpenCommand, AppTools.verticalPropertyGridOffCommand],
      }),
      new GroupItemDef({
        labelKey: "SampleApp:buttons.messageDemos",
        iconSpec: "icon-placeholder",
        items: [this._tool3Item, this._tool4Item, this._outputMessageItem],
      }),
      new GroupItemDef({
        labelKey: "SampleApp:buttons.dialogDemos",
        iconSpec: "icon-placeholder",
        items: [this._radialMenuItem, this._viewportDialogItem, this._reduceWidgetOpacity, this._defaultWidgetOpacity],
      }),
      new GroupItemDef({
        labelKey: "SampleApp:buttons.anotherGroup",
        iconSpec: "icon-placeholder",
        items: [AppTools.tool1, AppTools.tool2, this._groupItemDef],
        stateSyncIds: [SyncUiEventId.ActiveContentChanged],
        stateFunc: this._anotherGroupStateFunc,
      }),
    ]);
    return items;
  }

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

/** Define a NavigationWidget with Buttons to display in the TopRight zone.
 */
class FrontstageNavigationWidget extends React.Component {

  /** SVG Icon to use for the Rotate tool */
  // private get _rotateSvgIcon(): React.ReactNode {
  //   return (
  //     <SvgPath viewBoxWidth={91} viewBoxHeight={91} paths={[
  //       "M86.734,49.492c-4.305,0.01-17.991,1.527-20.508,1.943c-1.589,0.261-3.454,0.267-4.732,1.335   c-1.173,0.98-0.649,2.788,0.453,3.52c1.182,0.78,17.18,0.641,19.686,0.645c-0.216,0.404-4.764,8.202-7.226,11.423   c-4.994,6.53-12.322,11.926-20.213,14.39c-9.906,3.093-21.47,0.982-30.055-4.716c-4.252-2.82-7.595-6.813-10.364-11.047   c-2.37-3.625-4.53-8.918-8.038-11.526c-0.238-0.18-0.687-0.002-0.732,0.298c-0.548,3.663,1.414,7.707,2.843,10.992   c1.7,3.904,4.146,7.539,6.933,10.755c5.891,6.799,14.97,10.758,23.738,12.057c15.313,2.272,30.362-4.708,39.961-16.643   c2.182-2.715,4.058-5.652,5.88-8.618c-0.04,4.63-0.08,9.262-0.109,13.891c-0.026,4.004,6.195,4.008,6.222,0   c0.054-8.303,0.122-16.604,0.122-24.907C90.594,51.061,87.978,49.49,86.734,49.492z",
  //       "M17.98,20.688c5.096-5.933,12.107-11.209,19.818-13.11c10.523-2.591,23.726,1.216,31.448,8.788   c3.523,3.45,6.227,7.538,8.734,11.751c2.084,3.496,4.084,8.505,7.364,11.009c0.244,0.187,0.678-0.004,0.731-0.296   c0.637-3.572-1.238-7.563-2.511-10.82c-1.516-3.889-3.713-7.637-6.163-11.013C72.166,9.786,64.534,5.113,56.037,2.605   C39.996-2.125,24.416,4.048,13.693,16.4c-2.328,2.684-4.36,5.616-6.345,8.567c0.256-3.586,0.517-7.172,0.765-10.759   c0.278-3.995-5.944-3.977-6.221,0c-0.492,7.064-1.519,21.896-1.484,22.229c0.013,0.612-0.002,3.301,2.793,3.301   c3.233,0.002,10.855-0.29,14.028-0.466c2.881-0.16,5.805-0.179,8.675-0.475c1.158-0.121,3.727-0.079,3.836-1.451   c0.175-2.197-3.893-3.01-4.988-3.118c-3.061-0.304-13.198-1.281-15.208-1.447c0.288-0.488,0.571-0.964,0.853-1.389   C12.798,27.753,15.135,24.001,17.98,20.688z",
  //     ]} />
  //   );
  // }

  /** SVG Icon to use for the Rotate tool */
  private get _rotateSvgIcon2(): React.ReactNode {
    return (
      <SvgSprite src={rotateIcon} />
    );
  }

  /** Get CoreTools rotate tool but override the icon with an SVG Icon */
  private get _rotateViewCommand() {
    const toolItemDef = CoreTools.rotateViewCommand;
    toolItemDef.iconSpec = this._rotateSvgIcon2;
    return toolItemDef;
  }

  /** Get the CustomItemDef for ViewSelector  */
  private get _viewSelectorItemDef() {
    return new CustomItemDef({
      reactElement: (
        <ViewSelector imodel={SampleAppIModelApp.store.getState().sampleAppState!.iModelConnection} />
      ),
    });
  }

  private get _horizontalToolbarItems(): ItemList {
    const items = new ItemList([
      CoreTools.fitViewCommand,
      CoreTools.windowAreaCommand,
      CoreTools.zoomViewCommand,
      CoreTools.panViewCommand,
      CoreTools.sectionByPlaneCommand,
      this._rotateViewCommand,  /* Use an SVG icon  */
    ]);
    return items;
  }

  private get _verticalToolbarItems(): ItemList {
    const items = new ItemList([
      CoreTools.walkViewCommand,
      CoreTools.flyViewCommand,
      CoreTools.toggleCameraViewCommand,
      this._viewSelectorItemDef,
    ]);
    return items;
  }

  public render() {
    return (
      <NavigationWidget
        navigationAidId="CubeNavigationAid"
        iModelConnection={SampleAppIModelApp.store.getState().sampleAppState!.iModelConnection!}
        horizontalItems={this._horizontalToolbarItems}
        verticalItems={this._verticalToolbarItems}
      />
    );
  }
}

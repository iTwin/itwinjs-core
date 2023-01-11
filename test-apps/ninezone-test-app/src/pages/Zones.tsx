/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import "./Zones.scss";
import classnames from "classnames";
import rafSchedule, { ScheduleFn } from "raf-schd";
import * as React from "react";
import * as ReactDOM from "react-dom";
import {
  Button, ButtonProps, ButtonType, Omit, Point, PointProps, Rectangle, RectangleProps, Size, SizeProps, withOnOutsideClick, withTimeout,
} from "@bentley/ui-core";
import {
  Backstage,
  BackstageItem,
  BackstageSeparator,
  UserProfile,
  withContainIn,
  TitleBarButton,
  Footer,
  MessageCenterDialog,
  MessageCenter,
  MessageCenterMessage,
  MessageCenterTab,
  MessageButton,
  MessageHyperlink,
  MessageLayout,
  Message,
  MessageProgress,
  Status,
  Toast,
  FooterPopup,
  FooterPopupContentType,
  FooterSeparator,
  SnapMode,
  SnapModePanel,
  Snap,
  ToolAssistanceDialog,
  ToolAssistance,
  ToolAssistanceItem,
  ToolAssistanceSeparator,
  NineZoneNestedStagePanelsManagerProps,
  NineZoneManager,
  NineZoneManagerProps,
  NineZoneStagePanelManagerProps,
  getDefaultNineZoneStagePanelsManagerProps,
  NineZoneStagePanelsManagerProps,
  offsetAndContainInContainer,
  Tooltip,
  NestedStagePanelKey,
  StagePanelsManager,
  Splitter,
  StagePanel,
  StagePanelType,
  StagePanelTypeHelpers,
  StagePanels,
  ExpandableItem,
  GroupColumn,
  Group,
  NestedGroup,
  GroupToolExpander,
  GroupTool,
  withDragInteraction,
  Item,
  Toolbar,
  ToolbarPanelAlignment,
  Direction,
  DisabledResizeHandles,
  SafeAreaInsets,
  WidgetContent,
  HandleMode,
  TabGroup,
  TabSeparator,
  Tab,
  TabMode,
  HorizontalAnchor,
  ResizeHandle,
  Stacked,
  VerticalAnchor,
  VerticalAnchorHelpers,
  NestedToolSettings,
  ToolSettingsPopup,
  ScrollableToolSettings,
  ToolSettingsTab,
  Tools as ToolsWidget,
  AppButton,
  ToolSettings,
  DraggedWidgetManagerProps,
  ToolSettingsWidgetManagerProps,
  ToolSettingsWidgetMode,
  WidgetManagerProps,
  ZoneManagerProps,
  getDefaultZonesManagerProps,
  WidgetZoneId,
  widgetZoneIds,
  ZonesManagerProps,
  ZonesManagerTargetProps,
  ZonesManagerWidgetsProps,
  ZoneTargetType,
  Outline,
  BackTarget,
  MergeTarget,
  SplitterTarget,
  SplitterPaneTarget,
  StagePanelTarget,
  Zone,
  Zones,
} from "@bentley/ui-ninezone";

// eslint-disable-next-line @typescript-eslint/naming-convention
const TooltipWithTimeout = withTimeout(Tooltip);
// eslint-disable-next-line @typescript-eslint/naming-convention
const ToolGroupContained = withContainIn(withOnOutsideClick(Group, undefined, false));
// eslint-disable-next-line @typescript-eslint/naming-convention
const NestedToolGroupContained = withContainIn(withOnOutsideClick(NestedGroup, undefined, false));
// eslint-disable-next-line @typescript-eslint/naming-convention
const ItemWithDragInteraction = withDragInteraction(Item);
// eslint-disable-next-line @typescript-eslint/naming-convention
const ToolGroupSelectionContext = React.createContext(false);
ToolGroupSelectionContext.displayName = "nzdemo:ToolGroupSelectionContext";

// eslint-disable-next-line @typescript-eslint/naming-convention
const BlueButton = (props: ButtonProps & Omit<ButtonProps, "type">) => (
  <Button
    buttonType={ButtonType.Blue}
    {...props}
  />
);

// eslint-disable-next-line @typescript-eslint/naming-convention
const HollowButton = (props: ButtonProps & Omit<ButtonProps, "type">) => (
  <Button
    buttonType={ButtonType.Hollow}
    {...props}
  />
);

const displayNone = { display: "none" };

interface AppTools {
  1: ZoneTools;
  3: ZoneTools;
}

interface ZoneTools {
  horizontal: ToolbarTools;
  vertical: ToolbarTools;
}

type ToolbarTools = ReadonlyArray<ToolbarTool["id"]>;

interface ToolStore {
  readonly [id: string]: Tool;
}

enum MessageCenterActiveTab {
  AllMessages,
  Problems,
}

enum ToolSettingsMode {
  Minimized,
  Open,
}

enum VisibleMessage {
  None,
  Activity,
  Toast,
}

enum FooterWidget {
  None,
  ToolAssistance,
  Messages,
  SnapMode,
}

interface SimpleTool {
  readonly id: string;
  readonly isActive?: boolean;
  readonly isDisabled?: boolean;
  readonly isHidden?: boolean;
}

interface ToolGroup {
  readonly activeToolId: PanelTool["id"];
  readonly backTrays: ReadonlyArray<PanelExpander["id"]>;
  readonly id: string;
  readonly isOpen?: boolean;
  readonly title: string;
  readonly tools: ReadonlyArray<PanelTool["id"]>;
}

interface PanelExpander extends SimpleTool {
  readonly title: string;
  readonly tools: ReadonlyArray<PanelTool["id"]>;
}

type PanelTool = SimpleTool | PanelExpander;
type ToolbarTool = SimpleTool | ToolGroup;
type Tool = PanelTool | ToolbarTool;

const isToolGroup = (tool: Tool): tool is ToolGroup => {
  return (tool as ToolGroup).activeToolId !== undefined;
};

const isPanelExpander = (tool: Tool): tool is PanelExpander => {
  return (tool as PanelExpander).tools !== undefined;
};

type Theme = "light" | "dark";

interface MessageProps {
  onHideMessage: () => void;
}

class ActivityMessage extends React.PureComponent<MessageProps> {
  public render() {
    return (
      <Message
        status={Status.Information}
        icon={
          <i className="icon icon-activity" />
        }
      >
        <MessageLayout
          buttons={
            <>
              <MessageHyperlink onClick={this.props.onHideMessage}>Ok</MessageHyperlink>
              <MessageButton onClick={this.props.onHideMessage}>
                <i className="icon icon-close" />
              </MessageButton>
            </>
          }
          progress={
            <MessageProgress status={Status.Information} progress={33.33} />
          }
        >
          Rendering 'big-image.png'
        </MessageLayout>
      </Message>
    );
  }
}

interface ToastMessageProps extends MessageProps {
  animateOutTo: HTMLElement | null;
}

class ToastMessageExample extends React.PureComponent<ToastMessageProps> {
  public render() {
    return (
      <Toast
        animateOutTo={this.props.animateOutTo}
        content={
          <Message
            status={Status.Success}
            icon={
              <i className="icon icon-status-success-hollow" />
            }
          >
            <MessageLayout>Image 'big.png' saved.</MessageLayout>
          </Message>
        }
        onAnimatedOut={this.props.onHideMessage}
      />
    );
  }
}

interface FooterMessageExampleProps {
  toastMessageKey: React.Key;
  message: VisibleMessage;
  animateToastMessageTo: HTMLElement | null;
  onHideMessage: () => void;
}

class FooterMessageExample extends React.PureComponent<FooterMessageExampleProps> {
  public render() {
    switch (this.props.message) {
      case (VisibleMessage.Activity): {
        return (
          <ActivityMessage
            onHideMessage={this.props.onHideMessage}
          />
        );
      }
      case (VisibleMessage.Toast): {
        return this.props.animateToastMessageTo === undefined ? null : (
          <ToastMessageExample
            key={this.props.toastMessageKey}
            onHideMessage={this.props.onHideMessage}
            animateOutTo={this.props.animateToastMessageTo}
          />
        );
      }
    }
    return null;
  }
}

interface StatusZoneExampleProps extends MessageProps {
  bounds: RectangleProps;
  dropTarget: ZoneTargetType | undefined;
  isInFooterMode: boolean;
  message: VisibleMessage;
  onHideMessage: () => void;
  onTargetChanged: TargetChangedFn;
  onOpenWidgetChange: (widget: FooterWidget) => void;
  openWidget: FooterWidget;
  outlineBounds: RectangleProps | undefined;
  safeAreaInsets: SafeAreaInsets;
  targetBounds: RectangleProps;
  toastMessageKey: React.Key;
}

interface StatusZoneExampleState {
  messageCenterTab: MessageCenterActiveTab;
  messageCenterTarget: HTMLElement | null;
  snapModeTarget: HTMLElement | null;
  toolAssistanceTarget: HTMLElement | null;
}

class StatusZoneExample extends React.PureComponent<StatusZoneExampleProps, StatusZoneExampleState> {
  public readonly state: StatusZoneExampleState = {
    messageCenterTab: MessageCenterActiveTab.AllMessages,
    messageCenterTarget: null,
    snapModeTarget: null,
    toolAssistanceTarget: null,
  };

  private _messageCenterIndicator = React.createRef<HTMLDivElement>();
  private _snapModeIndicator = React.createRef<HTMLDivElement>();
  private _toolAssistanceIndicator = React.createRef<HTMLDivElement>();

  public render() {
    return (
      <>
        <Zone
          bounds={this.props.isInFooterMode ? undefined : this.props.bounds}
          id={8}
          isInFooterMode={this.props.isInFooterMode}
          safeAreaInsets={this.props.safeAreaInsets}
        >
          <Footer
            isInFooterMode={this.props.isInFooterMode}
            messages={
              <FooterMessageExample
                toastMessageKey={this.props.toastMessageKey}
                animateToastMessageTo={this.state.messageCenterTarget}
                onHideMessage={this.props.onHideMessage}
                message={this.props.message}
              />
            }
            safeAreaInsets={this.props.safeAreaInsets}
          >
            <div ref={this._handleToolAssistanceTarget}>
              <ToolAssistance
                icons={
                  <>
                    <i className="icon icon-cursor" />
                    <i className="icon icon-add" />
                  </>
                }
                indicatorRef={this._toolAssistanceIndicator}
                isInFooterMode={this.props.isInFooterMode}
                onClick={this._handleToggleToolAssistanceDialog}
              >
                {this.props.isInFooterMode ? "Start Point" : undefined}
              </ToolAssistance>
            </div>
            {this.props.isInFooterMode && <FooterSeparator />}
            <FooterPopup
              isOpen={this.props.openWidget === FooterWidget.Messages}
              onClose={this._handlePopupClose}
              onOutsideClick={this._handleMessageCenterOutsideClick}
              target={this.state.messageCenterTarget}
            >
              <MessageCenterDialog
                buttons={
                  <>
                    <TitleBarButton>
                      <i className="icon icon-placeholder" />
                    </TitleBarButton>
                    <TitleBarButton onClick={this._handlePopupClose}>
                      <i className="icon icon-close" />
                    </TitleBarButton>
                  </>
                }
                prompt="No messages."
                tabs={
                  <>
                    <MessageCenterTab
                      isActive={this.state.messageCenterTab === MessageCenterActiveTab.AllMessages}
                      onClick={this._handleAllMessagesTabClick}
                    >
                      All
                    </MessageCenterTab>
                    <MessageCenterTab
                      isActive={this.state.messageCenterTab === MessageCenterActiveTab.Problems}
                      onClick={this._handleProblemsTabClick}
                    >
                      Problems
                    </MessageCenterTab>
                  </>
                }
                title="Messages"
              >
                {this.state.messageCenterTab === MessageCenterActiveTab.AllMessages ?
                  <>
                    <MessageCenterMessage icon={<i className="icon icon-status-success nzdemo-success" />}>
                      Document saved successfully.
                    </MessageCenterMessage>
                    <MessageCenterMessage icon={<i className="icon icon-clock nzdemo-progress" />}>
                      <span>Downloading required assets.</span>
                      <br />
                      <i><small>75% complete</small></i>
                    </MessageCenterMessage>
                    <MessageCenterMessage icon={<i className="icon icon-status-rejected nzdemo-error" />}>
                      <span>Cannot attach reference.</span>
                      <br />
                      <i><u><small>Details...</small></u></i>
                    </MessageCenterMessage>
                    <MessageCenterMessage icon={<i className="icon icon-status-warning nzdemo-warning" />}>
                      Missing 10 fonts. Replaces with Arial.
                    </MessageCenterMessage>
                    <MessageCenterMessage icon={<i className="icon icon-star nzdemo-favorite" />}>
                      Your document has been favorited by 5 people in the...
                    </MessageCenterMessage>
                    <MessageCenterMessage icon={<i className="icon icon-status-success nzdemo-success" />}>
                      Navigator has successfully updated
                    </MessageCenterMessage>
                  </> :
                  <>
                    <MessageCenterMessage icon={<i className="icon icon-status-rejected nzdemo-error" />}>
                      Missing 10 fonts. Replaced with Arial.
                    </MessageCenterMessage>
                    <MessageCenterMessage>Cannot attach reference</MessageCenterMessage>
                    <MessageCenterMessage>Problem1</MessageCenterMessage>
                    <MessageCenterMessage>Problem2</MessageCenterMessage>
                    <MessageCenterMessage>Problem3</MessageCenterMessage>
                    <MessageCenterMessage>Problem4</MessageCenterMessage>
                    <MessageCenterMessage>Problem5</MessageCenterMessage>
                    <MessageCenterMessage>Problem6</MessageCenterMessage>
                  </>
                }
              </MessageCenterDialog>
            </FooterPopup>
            <MessageCenter
              onClick={this._handleToggleMessageCenterDialog}
              indicatorRef={this._messageCenterIndicator}
              isInFooterMode={this.props.isInFooterMode}
              label={this.props.isInFooterMode ? "Message(s):" : undefined}
              targetRef={this._handleMessageCenterTarget}
            >
              9+
            </MessageCenter>
            {this.props.isInFooterMode && <FooterSeparator />}
            <div ref={this._handleSnapModeTarget}>
              <SnapMode
                icon="k"
                indicatorRef={this._snapModeIndicator}
                isInFooterMode={this.props.isInFooterMode}
                onClick={this._handleToggleSnapModeDialog}
              >
                {this.props.isInFooterMode ? "Snap Mode" : undefined}
              </SnapMode>
            </div>
          </Footer>
        </Zone>
        <ZoneTargetExample
          bounds={this.props.targetBounds}
          dropTarget={this.props.dropTarget}
          isInFooterMode={this.props.isInFooterMode}
          onTargetChanged={this.props.onTargetChanged}
          safeAreaInsets={this.props.safeAreaInsets}
          zoneIndex={8}
        />
        {this.props.outlineBounds &&
          <Outline bounds={this.props.outlineBounds} />
        }
        <FooterPopup
          isOpen={this.props.openWidget === FooterWidget.ToolAssistance}
          onClose={this._handlePopupClose}
          onOutsideClick={this._handleToolAssistanceOutsideClick}
          target={this.state.toolAssistanceTarget}
        >
          <ToolAssistanceDialog
            title="Trim Multiple - Tool Assistance"
          >
            <ToolAssistanceItem>
              <i className="icon icon-cursor" />
              Identify piece to trim
            </ToolAssistanceItem>
            <ToolAssistanceSeparator>Inputs</ToolAssistanceSeparator>
            <ToolAssistanceItem>
              <i className="icon icon-cursor-click" />
              Clink on element
            </ToolAssistanceItem>
            <ToolAssistanceItem>
              <i className="icon  icon-placeholder" />
              Drag across elements
            </ToolAssistanceItem>
            <ToolAssistanceSeparator />
            <ToolAssistanceItem>
              <input type="checkbox" />
              Show prompt @ cursor
            </ToolAssistanceItem>
          </ToolAssistanceDialog>
        </FooterPopup>
        <FooterPopup
          contentType={FooterPopupContentType.Panel}
          isOpen={this.props.openWidget === FooterWidget.SnapMode}
          onClose={this._handlePopupClose}
          onOutsideClick={this._handleSnapModeOutsideClick}
          target={this.state.snapModeTarget}
        >
          <SnapModePanel
            title="Snap Mode"
          >
            <Snap icon="k" isActive>Keypoint</Snap>
            <Snap icon="i">Intersection</Snap>
            <Snap icon="c">Center</Snap>
            <Snap icon="n">Nearest</Snap>
          </SnapModePanel>
        </FooterPopup>
      </>
    );
  }

  private _handleMessageCenterTarget = (messageCenterTarget: HTMLElement | null) => {
    this.setState({ messageCenterTarget });
  }

  private _handleToolAssistanceTarget = (toolAssistanceTarget: HTMLElement | null) => {
    this.setState({ toolAssistanceTarget });
  }

  private _handleSnapModeTarget = (snapModeTarget: HTMLElement | null) => {
    this.setState({ snapModeTarget });
  }

  private _handleMessageCenterOutsideClick = (e: MouseEvent) => {
    if (!this._messageCenterIndicator.current)
      return;
    if (!(e.target instanceof Node))
      return;
    if (this._messageCenterIndicator.current.contains(e.target))
      return;
    this._handlePopupClose();
  }

  private _handleToolAssistanceOutsideClick = (e: MouseEvent) => {
    if (!this._toolAssistanceIndicator.current)
      return;
    if (!(e.target instanceof Node))
      return;
    if (this._toolAssistanceIndicator.current.contains(e.target))
      return;
    this._handlePopupClose();
  }

  private _handleSnapModeOutsideClick = (e: MouseEvent) => {
    if (!this._snapModeIndicator.current)
      return;
    if (!(e.target instanceof Node))
      return;
    if (this._snapModeIndicator.current.contains(e.target))
      return;
    this._handlePopupClose();
  }

  private _handleAllMessagesTabClick = () => {
    this.setState({ messageCenterTab: MessageCenterActiveTab.AllMessages });
  }

  private _handleProblemsTabClick = () => {
    this.setState({ messageCenterTab: MessageCenterActiveTab.Problems });
  }

  private _handlePopupClose = () => {
    this.props.onOpenWidgetChange(FooterWidget.None);
  }

  private _handleToggleMessageCenterDialog = () => {
    this.props.onOpenWidgetChange(this.props.openWidget === FooterWidget.Messages ? FooterWidget.None : FooterWidget.Messages);
  }

  private _handleToggleToolAssistanceDialog = () => {
    this.props.onOpenWidgetChange(this.props.openWidget === FooterWidget.ToolAssistance ? FooterWidget.None : FooterWidget.ToolAssistance);
  }

  private _handleToggleSnapModeDialog = () => {
    this.props.onOpenWidgetChange(this.props.openWidget === FooterWidget.SnapMode ? FooterWidget.None : FooterWidget.SnapMode);
  }
}

interface FloatingWidgetProps {
  disabledResizeHandles: DisabledResizeHandles;
  draggedWidget: DraggedWidgetManagerProps | undefined;
  fillZone: boolean;
  getWidgetContentRef: (id: WidgetZoneId) => React.Ref<HTMLDivElement>;
  horizontalAnchor: HorizontalAnchor;
  isCollapsed: boolean;
  isFloating: boolean;
  isInStagePanel: boolean;
  openWidgetId: WidgetZoneId | undefined;
  onResize: ((zoneId: WidgetZoneId, resizeBy: number, handle: ResizeHandle, filledHeightDiff: number) => void) | undefined;
  onTabClick: (widgetId: WidgetZoneId, tabIndex: number) => void;
  onTabDragStart: (widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps, widgetBounds: RectangleProps) => void;
  onTabDragEnd: () => void;
  onTabDrag: (dragged: PointProps) => void;
  tabIndex: number;
  verticalAnchor: VerticalAnchor;
  widgets: ReadonlyArray<WidgetZoneId>;
}

class FloatingWidget extends React.PureComponent<FloatingWidgetProps> {
  private _widget = React.createRef<Stacked>();

  public render() {
    return (
      <Stacked
        contentRef={this.props.openWidgetId ? this.props.getWidgetContentRef(this.props.openWidgetId) : undefined}
        fillZone={this.props.fillZone}
        disabledResizeHandles={this.props.disabledResizeHandles}
        horizontalAnchor={this.props.horizontalAnchor}
        isCollapsed={this.props.isCollapsed}
        isDragged={!!this.props.draggedWidget}
        isFloating={this.props.isFloating}
        isOpen={!!this.props.openWidgetId}
        isTabBarVisible={this.props.isInStagePanel}
        onResize={this.props.isInStagePanel ? undefined : this._handleResize}
        ref={this._widget}
        tabs={
          <FloatingZoneTabs
            draggedWidget={this.props.draggedWidget}
            horizontalAnchor={this.props.horizontalAnchor}
            isCollapsed={this.props.isCollapsed}
            isInStagePanel={this.props.isInStagePanel}
            isWidgetOpen={!!this.props.openWidgetId}
            onTabClick={this.props.onTabClick}
            onTabDragStart={this._handleTabDragStart}
            onTabDragEnd={this.props.onTabDragEnd}
            onTabDrag={this.props.onTabDrag}
            openWidgetId={this.props.openWidgetId}
            tabIndex={this.props.tabIndex}
            verticalAnchor={this.props.verticalAnchor}
            widgets={this.props.widgets}
          />
        }
        verticalAnchor={this.props.verticalAnchor}
      />
    );
  }

  private _handleResize = (resizeBy: number, handle: ResizeHandle, filledHeightDiff: number) => {
    this.props.onResize && this.props.onResize(this.props.widgets[0], resizeBy, handle, filledHeightDiff);
  }

  private _handleTabDragStart = (widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps, firstTab: RectangleProps) => {
    if (!this._widget.current)
      return;

    const firstTabBounds = Rectangle.create(firstTab);
    const stackedWidgetBounds = Rectangle.create(this._widget.current.getBounds());
    const offsetToFirstTab = stackedWidgetBounds.topLeft().getOffsetTo(firstTabBounds.topLeft());
    let widgetBounds;
    if (VerticalAnchorHelpers.isHorizontal(this.props.verticalAnchor))
      widgetBounds = stackedWidgetBounds.offsetX(offsetToFirstTab.x);
    else
      widgetBounds = stackedWidgetBounds.offsetY(offsetToFirstTab.y);
    this.props.onTabDragStart(widgetId, tabIndex, initialPosition, widgetBounds);
  }
}

interface FloatingZoneWidgetProps {
  disabledResizeHandles: DisabledResizeHandles;
  draggedWidget: DraggedWidgetManagerProps | undefined;
  getWidgetContentRef: (id: WidgetZoneId) => React.Ref<HTMLDivElement>;
  isInFooterMode: boolean;
  onResize: ((zoneId: WidgetZoneId, resizeBy: number, handle: ResizeHandle, filledHeightDiff: number) => void) | undefined;
  onTabClick: (widgetId: WidgetZoneId, tabIndex: number) => void;
  onTabDragStart: (widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps, widgetBounds: RectangleProps) => void;
  onTabDragEnd: () => void;
  onTabDrag: (dragged: PointProps) => void;
  openWidgetId: WidgetZoneId | undefined;
  safeAreaInsets: SafeAreaInsets;
  tabIndex: number;
  widget: WidgetManagerProps | undefined;
  zone: ZoneManagerProps;
}

class FloatingZoneWidget extends React.PureComponent<FloatingZoneWidgetProps> {
  public render() {
    const { draggedWidget, widget, zone } = this.props;
    const bounds = zone.floating ? zone.floating.bounds : zone.bounds;
    const zIndex = zone.floating ? { zIndex: zone.floating.stackId } : undefined;
    return (
      <Zone
        bounds={bounds}
        id={this.props.zone.id}
        isFloating={!!zone.floating}
        isInFooterMode={this.props.isInFooterMode}
        safeAreaInsets={this.props.safeAreaInsets}
        style={zIndex}
      >
        {widget && <FloatingWidget
          disabledResizeHandles={this.props.disabledResizeHandles}
          draggedWidget={draggedWidget}
          fillZone={zone.isLayoutChanged || !!zone.floating}
          getWidgetContentRef={this.props.getWidgetContentRef}
          horizontalAnchor={widget.horizontalAnchor}
          isCollapsed={false}
          isFloating={!!zone.floating}
          isInStagePanel={false}
          key={zone.id}
          onResize={this.props.onResize}
          onTabClick={this.props.onTabClick}
          onTabDrag={this.props.onTabDrag}
          onTabDragEnd={this.props.onTabDragEnd}
          onTabDragStart={this.props.onTabDragStart}
          openWidgetId={this.props.openWidgetId}
          tabIndex={this.props.tabIndex}
          verticalAnchor={widget.verticalAnchor}
          widgets={zone.widgets}
        />}
      </Zone>
    );
  }
}

interface FloatingZoneTabsProps {
  draggedWidget: DraggedWidgetManagerProps | undefined;
  horizontalAnchor: HorizontalAnchor;
  isCollapsed: boolean;
  isInStagePanel: boolean;
  isWidgetOpen: boolean;
  openWidgetId: WidgetZoneId | undefined;
  onTabClick: (widgetId: WidgetZoneId, tabIndex: number) => void;
  onTabDragStart: (widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps, firstTabBounds: RectangleProps) => void;
  onTabDragEnd: () => void;
  onTabDrag: (dragged: PointProps) => void;
  tabIndex: number;
  verticalAnchor: VerticalAnchor;
  widgets: ReadonlyArray<WidgetZoneId>;
}

class FloatingZoneTabs extends React.PureComponent<FloatingZoneTabsProps> {
  public render() {
    const tabs: JSX.Element[] = [];
    let i = -1;

    for (const widgetId of this.props.widgets) {
      i++;
      const widgetTabs = (
        <FloatingZoneWidgetTabs
          draggedWidget={this.props.draggedWidget}
          horizontalAnchor={this.props.horizontalAnchor}
          isCollapsed={this.props.isCollapsed}
          isInStagePanel={this.props.isInStagePanel}
          isStacked={this.props.widgets.length > 1}
          isWidgetOpen={this.props.isWidgetOpen}
          key={widgetId}
          onTabClick={this.props.onTabClick}
          onTabDragStart={this.props.onTabDragStart}
          onTabDragEnd={this.props.onTabDragEnd}
          onTabDrag={this.props.onTabDrag}
          isOpen={this.props.openWidgetId === widgetId}
          tabIndex={this.props.tabIndex}
          verticalAnchor={this.props.verticalAnchor}
          widgetId={widgetId}
        />
      );

      if (i !== 0)
        tabs.push(<TabSeparator
          isHorizontal={VerticalAnchorHelpers.isHorizontal(this.props.verticalAnchor)}
          key={`separator_${i}`}
        />);
      tabs.push(widgetTabs);
    }

    return tabs;
  }
}

interface FloatingZoneWidgetTabsProps {
  draggedWidget: DraggedWidgetManagerProps | undefined;
  horizontalAnchor: HorizontalAnchor;
  isCollapsed: boolean;
  isInStagePanel: boolean;
  isOpen: boolean;
  isWidgetOpen: boolean;
  tabIndex: number;
  isStacked: boolean;
  onTabClick: (widgetId: WidgetZoneId, tabIndex: number) => void;
  onTabDragStart: (widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps, firstTabBounds: RectangleProps) => void;
  onTabDragEnd: () => void;
  onTabDrag: (dragged: PointProps) => void;
  verticalAnchor: VerticalAnchor;
  widgetId: WidgetZoneId;
}

class FloatingZoneWidgetTabs extends React.PureComponent<FloatingZoneWidgetTabsProps> {
  private _firstTab = React.createRef<Tab>();

  private getTabHandleMode() {
    if (this.props.draggedWidget && this.props.draggedWidget.id === this.props.widgetId && this.props.draggedWidget.isUnmerge)
      return HandleMode.Visible;

    if (this.props.isStacked)
      return HandleMode.Hovered;

    return HandleMode.Timedout;
  }

  private getTab(tabIndex: number, mode: TabMode, lastPosition: PointProps | undefined) {
    return (
      <FloatingZoneWidgetTab
        horizontalAnchor={this.props.horizontalAnchor}
        isCollapsed={this.props.isCollapsed}
        isInStagePanel={this.props.isInStagePanel}
        lastPosition={lastPosition}
        mode={mode}
        onClick={this.props.onTabClick}
        onDragStart={this._handleDragStart}
        onDragEnd={this.props.onTabDragEnd}
        onDrag={this.props.onTabDrag}
        tabIndex={tabIndex}
        tabRef={tabIndex === 0 ? this._firstTab : undefined}
        verticalAnchor={this.props.verticalAnchor}
        widgetId={this.props.widgetId}
      />
    );
  }

  private _handleDragStart = (widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps) => {
    if (!this._firstTab.current)
      return;

    const bounds = this._firstTab.current.getBounds();
    this.props.onTabDragStart(widgetId, tabIndex, initialPosition, bounds);
  }

  public render() {
    const lastPosition = this.props.draggedWidget ? this.props.draggedWidget.lastPosition : undefined;
    const mode1 = !this.props.isWidgetOpen ? TabMode.Closed
      : this.props.isOpen && this.props.tabIndex === 0 ? TabMode.Active : TabMode.Open;
    const mode2 = !this.props.isWidgetOpen ? TabMode.Closed
      : this.props.isOpen && this.props.tabIndex === 1 ? TabMode.Active : TabMode.Open;
    const handleMode = this.getTabHandleMode();
    switch (this.props.widgetId) {
      case 4:
      case 9: {
        return (
          <TabGroup
            handle={handleMode}
            horizontalAnchor={this.props.horizontalAnchor}
            isCollapsed={this.props.isCollapsed}
            verticalAnchor={this.props.verticalAnchor}
          >
            {this.getTab(0, mode1, lastPosition)}
            {this.getTab(1, mode2, lastPosition)}
          </TabGroup>
        );
      }
      case 2:
      case 6:
      case 7:
      case 8: {
        return this.getTab(0, mode1, lastPosition);
      }
    }
    return null;
  }
}

interface FloatingZoneWidgetTabProps {
  horizontalAnchor: HorizontalAnchor;
  isCollapsed: boolean;
  isInStagePanel: boolean;
  lastPosition: PointProps | undefined;
  mode: TabMode;
  onClick: (widgetId: WidgetZoneId, tabIndex: number) => void;
  onDrag: (dragged: PointProps) => void;
  onDragEnd: () => void;
  onDragStart: (widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps) => void;
  tabIndex: number;
  tabRef?: React.Ref<Tab>;
  verticalAnchor: VerticalAnchor;
  widgetId: WidgetZoneId;
}

class FloatingZoneWidgetTab extends React.PureComponent<FloatingZoneWidgetTabProps> {
  public render() {
    return (
      <Tab
        horizontalAnchor={this.props.horizontalAnchor}
        isCollapsed={this.props.isCollapsed}
        isProtruding={!this.props.isInStagePanel}
        lastPosition={this.props.lastPosition}
        mode={this.props.mode}
        onClick={this._handleClick}
        onDragStart={this._handleDragStart}
        onDragEnd={this.props.onDragEnd}
        onDrag={this.props.onDrag}
        ref={this.props.tabRef}
        verticalAnchor={this.props.verticalAnchor}
      >
        {placeholderIcon}
      </Tab>
    );
  }

  private _handleClick = () => {
    this.props.onClick(this.props.widgetId, this.props.tabIndex);
  }

  private _handleDragStart = (initialPosition: PointProps) => {
    this.props.onDragStart(this.props.widgetId, this.props.tabIndex, initialPosition);
  }
}

interface TargetExampleProps {
  bounds: RectangleProps;
  dropTarget: ZoneTargetType | undefined;
  isInFooterMode: boolean;
  onTargetChanged: TargetChangedFn;
  safeAreaInsets: SafeAreaInsets;
  zoneIndex: WidgetZoneId;
}

class ZoneTargetExample extends React.PureComponent<TargetExampleProps> {
  public render() {
    return (
      <Zone
        bounds={this.props.bounds}
        id={this.props.zoneIndex}
        isInFooterMode={this.props.isInFooterMode}
        safeAreaInsets={this.props.safeAreaInsets}
      >
        {this.props.dropTarget === ZoneTargetType.Merge &&
          <MergeTarget
            onTargetChanged={this._handleMergeTargetChanged}
          />
        }
        {this.props.dropTarget === ZoneTargetType.Back &&
          <BackTarget
            onTargetChanged={this._handleBackTargetChanged}
            zoneIndex={this.props.zoneIndex}
          />
        }
      </Zone>
    );
  }

  private _handleMergeTargetChanged = (isTargeted: boolean) => {
    this.onTargetChanged(isTargeted, ZoneTargetType.Merge);
  }

  private _handleBackTargetChanged = (isTargeted: boolean) => {
    this.onTargetChanged(isTargeted, ZoneTargetType.Back);
  }

  private onTargetChanged(isTargeted: boolean, type: ZoneTargetType) {
    isTargeted ?
      this.props.onTargetChanged({
        zoneId: this.props.zoneIndex,
        type,
      }) :
      this.props.onTargetChanged(undefined);
  }
}

interface ToolSettingsWidgetProps {
  fillZone: boolean;
  getWidgetContentRef: (id: WidgetZoneId) => React.Ref<HTMLDivElement>;
  isFloating: boolean;
  lastPosition?: PointProps;
  mode: ToolSettingsMode;
  onDrag: (dragged: PointProps) => void;
  onDragEnd: () => void;
  onDragStart: (tabIndex: number, initialPosition: PointProps, widgetBounds: RectangleProps) => void;
  onResize: ((resizeBy: number, handle: ResizeHandle) => void) | undefined;
  onTabClick: () => void;
}

class ToolSettingsWidget extends React.PureComponent<ToolSettingsWidgetProps> {
  private _widget = React.createRef<ToolSettings>();

  private _hiddenVisibility: React.CSSProperties = {
    visibility: "hidden",
  };

  public render() {
    if (this.props.mode === ToolSettingsMode.Minimized)
      return (
        <ToolSettingsTab
          onClick={this.props.onTabClick}
        >
          {placeholderIcon}
        </ToolSettingsTab>
      );

    return (
      <ToolSettings
        buttons={
          <div style={this.props.isFloating ? this._hiddenVisibility : undefined}>
            <TitleBarButton
              onClick={this.props.onTabClick}
              title="Minimize"
            >
              <i className="icon icon-chevron-up" />
            </TitleBarButton>
          </div>
        }
        contentRef={this.props.getWidgetContentRef(2)}
        fillZone={this.props.fillZone}
        lastPosition={this.props.lastPosition}
        onDrag={this.props.onDrag}
        onDragEnd={this.props.onDragEnd}
        onDragStart={this._handleDragStart}
        onResize={this.props.isFloating ? this.props.onResize : undefined}
        ref={this._widget}
        title="Tool Settings"
      />
    );
  }

  private _handleDragStart = (initialPosition: PointProps) => {
    if (!this._widget.current)
      return;
    const bounds = this._widget.current.getBounds();
    this.props.onDragStart(0, initialPosition, bounds);
  }
}

interface TooltipExampleProps {
  getContainerSize: () => SizeProps;
  isTooltipVisible: boolean;
  onTooltipTimeout: () => void;
}

interface TooltipExampleState {
  tooltipPosition: PointProps;
}

class TooltipExample extends React.PureComponent<TooltipExampleProps, TooltipExampleState> {
  private _tooltipSize: SizeProps = new Size();
  private _mousePosition: PointProps = new Point();

  public readonly state = {
    tooltipPosition: {
      x: 0,
      y: 0,
    },
  };

  public componentDidMount(): void {
    document.addEventListener("mousemove", this._handleMouseMove);
  }

  public componentWillUnmount(): void {
    document.removeEventListener("mousemove", this._handleMouseMove);
  }

  public render() {
    return (
      <>
        {
          this.props.isTooltipVisible && (
            <TooltipWithTimeout
              icon={placeholderIcon}
              onTimeout={this.props.onTooltipTimeout}
              onSizeChanged={this._handleTooltipSizeChange}
              position={this.state.tooltipPosition}
              timeout={3000}
            >
              Start Point
            </TooltipWithTimeout>
          )
        }
      </>
    );
  }

  private _handleMouseMove = (position: PointProps) => {
    this._mousePosition = position;
    this.updateTooltipPosition();
  }

  private _handleTooltipSizeChange = (size: SizeProps) => {
    this._tooltipSize = size;
    this.updateTooltipPosition();
  }

  private updateTooltipPosition() {
    this.setState((prevState, props) => {
      const tooltipBounds = Rectangle.createFromSize(this._tooltipSize).offset(this._mousePosition);
      const tooltipPosition = offsetAndContainInContainer(tooltipBounds, props.getContainerSize());
      if (tooltipPosition.equals(prevState.tooltipPosition))
        return null;
      return {
        tooltipPosition,
      };
    });
  }
}

class Content extends React.PureComponent {
  private _canvas = React.createRef<HTMLCanvasElement>();
  private _ctx?: CanvasRenderingContext2D;

  public componentDidMount() {
    if (!this._canvas.current)
      return;

    const ctx = this._canvas.current.getContext("2d");
    if (!ctx)
      return;

    this._canvas.current.width = document.body.clientWidth;
    this._canvas.current.height = document.body.clientHeight;
    this.drawRandomCircles(ctx, this._canvas.current.width, this._canvas.current.height);

    this._ctx = ctx;
    window.addEventListener("resize", this._handleWindowResize);
  }

  public componentWillUnmount() {
    window.removeEventListener("resize", this._handleWindowResize);
  }

  public render() {
    return (
      <canvas
        ref={this._canvas}
        style={{ cursor: "crosshair" }}
      />
    );
  }

  private drawRandomCircles(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.fillStyle = "#333333DD";
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      const radius = Math.floor(Math.random() * 50) + 10;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  private _handleWindowResize = () => {
    if (!this._canvas.current)
      return;

    if (!this._ctx)
      return;

    const width = document.body.clientWidth;
    const height = document.body.clientHeight;
    this._canvas.current.width = width;
    this._canvas.current.height = height;
    this.drawRandomCircles(this._ctx, width, height);
  }
}

interface Widget2Tab1ContentState {
  isNestedPopupOpen: boolean;
  isPopupOpen: boolean;
  nestedToggle: HTMLElement | null;
  toggle: HTMLElement | null;
}

class Widget2Tab1Content extends React.PureComponent<{}, Widget2Tab1ContentState> {
  public readonly state: Widget2Tab1ContentState = {
    isNestedPopupOpen: false,
    isPopupOpen: false,
    nestedToggle: null,
    toggle: null,
  };

  public render() {
    return (
      <>
        <button
          onClick={this._handleToggleClick}
          ref={this._handleToggleRef}
        >
          Toggle
        </button>
        <ToolSettingsPopup
          isOpen={this.state.isPopupOpen}
          onClose={this._handleCloseTogglePopup}
          target={this.state.toggle}
        >
          <button
            onClick={this._handleNestedToggleClick}
            ref={this._handleNestedToggleRef}
          >
            Nested Toggle
          </button>
        </ToolSettingsPopup>
        <ToolSettingsPopup
          isOpen={this.state.isNestedPopupOpen}
          onClose={this._handleCloseNestedTogglePopup}
          target={this.state.nestedToggle}
        >
          <NestedToolSettings
            title="Nested"
            backButton={
              <HollowButton
                onClick={this._handleBackClick}
                style={{ padding: "5px", lineHeight: "0", margin: "0" }}
              >
                <i className="icon icon-progress-backward-2" />
              </HollowButton>
            }
          >
            <ScrollableToolSettings>
              1. Settings<br />
              2. Settings<br />
              3. Settings<br />
              4. Settings<br />
              5. Settings<br />
              6. Settings<br />
              7. Settings<br />
              8. Settings<br />
              9. Settings<br />
              10. Settings<br />
              11. Settings<br />
              12. Settings<br />
              13. Settings<br />
              14. Settings<br />
              15. Settings<br />
              16. Settings<br />
              17. Settings<br />
              18. Settings<br />
              19. Settings
            </ScrollableToolSettings>
          </NestedToolSettings>
        </ToolSettingsPopup>
      </>
    );
  }

  private _handleNestedToggleRef = (nestedToggle: HTMLElement | null) => {
    this.setState({ nestedToggle });
  }

  private _handleToggleRef = (toggle: HTMLElement | null) => {
    this.setState({ toggle });
  }

  private _handleToggleClick = () => {
    this.setState((prevState) => ({
      isNestedPopupOpen: false,
      isPopupOpen: !prevState.isPopupOpen,
    }));
  }

  private _handleCloseTogglePopup = () => {
    this.setState({
      isNestedPopupOpen: false,
      isPopupOpen: false,
    });
  }

  private _handleNestedToggleClick = () => {
    this.setState((prevState) => ({
      isNestedPopupOpen: !prevState.isNestedPopupOpen,
    }));
  }

  private _handleCloseNestedTogglePopup = () => {
    this.setState({ isNestedPopupOpen: false });
  }

  private _handleBackClick = () => {
    this.setState({ isNestedPopupOpen: false });
  }
}

interface Widget6Tab1ContentProps {
  theme: Theme;
  onChangeTheme: () => void;
}

class Widget6Tab1Content extends React.PureComponent<Widget6Tab1ContentProps> {
  public render() {
    return (
      <BlueButton
        onClick={this.props.onChangeTheme}
      >
        Theme: {this.props.theme}
      </BlueButton>
    );
  }
}

interface Widget7Tab1ContentProps {
  onOpenActivityMessage: () => void;
  onOpenToastMessage: () => void;
  onShowTooltip: () => void;
  onToggleBottomMostPanel: () => void;
  onToggleFooterMode: () => void;
}

class Widget7Tab1Content extends React.PureComponent<Widget7Tab1ContentProps> {
  public render() {
    return (
      <>
        <BlueButton onClick={this.props.onOpenActivityMessage}>
          Show Activity Message
        </BlueButton>
        <span style={{ background: "#cebbbb", width: "800px", height: "50px", display: "block" }}></span>
        <BlueButton onClick={this.props.onOpenToastMessage}>
          Show Toast Message
        </BlueButton>
        <br />
        <BlueButton
          onClick={this.props.onShowTooltip}
        >
          Show Tooltip
        </BlueButton>
        <br />
        <BlueButton
          onClick={this.props.onToggleFooterMode}
        >
          Change Footer Mode
        </BlueButton>
        <br />
        <BlueButton
          onClick={this.props.onToggleBottomMostPanel}
        >
          Show Bottom Most Panel
        </BlueButton>
      </>
    );
  }
}

class Widget9Tab1Content extends React.PureComponent {
  public render() {
    return (
      <>
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        <span style={{ background: "#cebbbb", width: "800px", height: "50px", display: "block" }} />
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
        Hello world 1!
        <br />
      </>
    );
  }
}

interface WidgetContentExampleProps extends Widget6Tab1ContentProps, Widget7Tab1ContentProps {
  anchor: HorizontalAnchor;
  isDisplayed: boolean;
  renderTo: Element | undefined;
  tabIndex: number;
  toolSettingsMode: ToolSettingsWidgetMode;
  widgetId: WidgetZoneId;
}

class WidgetContentExample extends React.PureComponent<WidgetContentExampleProps> {
  private _content = document.createElement("span");
  private _widgetContent = React.createRef<WidgetContent>();

  public componentDidMount() {
    if (!this.props.renderTo)
      return;
    this.props.renderTo.appendChild(this._content);
  }

  public componentDidUpdate(prevProps: WidgetContentExampleProps) {
    if (prevProps.renderTo === this.props.renderTo)
      return;

    if (!this.props.renderTo)
      return;

    this.props.renderTo.appendChild(this._content);
    this._widgetContent.current && this._widgetContent.current.forceUpdate();
  }

  public render() {
    let content: React.ReactNode;
    let className: string | undefined;
    switch (this.props.widgetId) {
      case 2: {
        content = (
          <>
            <Widget2Tab1Content />
            <div className="nzdemo-measurer" />
            <div className="nzdemo-expander" />
          </>
        );
        className = classnames(
          "nzdemo-tool-settings-content",
          this.props.toolSettingsMode === ToolSettingsWidgetMode.TitleBar && "nzdemo-title-bar",
          this.props.toolSettingsMode === ToolSettingsWidgetMode.Tab && "nzdemo-tab",
        );
        break;
      }
      case 4: {
        content = `Hello world from zone4! (${this.props.tabIndex})`;
        break;
      }
      case 6: {
        content = (
          <Widget6Tab1Content
            onChangeTheme={this.props.onChangeTheme}
            theme={this.props.theme} />
        );
        break;
      }
      case 7: {
        content = (
          <Widget7Tab1Content
            onOpenActivityMessage={this.props.onOpenActivityMessage}
            onOpenToastMessage={this.props.onOpenToastMessage}
            onShowTooltip={this.props.onShowTooltip}
            onToggleBottomMostPanel={this.props.onToggleBottomMostPanel}
            onToggleFooterMode={this.props.onToggleFooterMode} />
        );
        break;
      }
      case 8: {
        content = "Footer :)";
        break;
      }
      case 9: {
        switch (this.props.tabIndex) {
          case 0: {
            content = (
              <Widget9Tab1Content />
            );
            break;
          }
          case 1: {
            content = "Hello world 2!";
            break;
          }
        }
        break;
      }
    }
    return ReactDOM.createPortal(<WidgetContent
      anchor={this.props.anchor}
      className={className}
      content={content}
      ref={this._widgetContent}
      style={this.props.isDisplayed ? undefined : displayNone}
    />, this._content);
  }
}

interface ToolbarItemProps {
  dragDirection: Direction;
  onClick: (toolId: string) => void;
  onOpenPanel: (toolId: Tool["id"]) => void;
  panel: React.ReactNode | undefined;
  tool: ToolbarTool;
  toolStore: ToolStore;
}

class ToolbarItem extends React.PureComponent<ToolbarItemProps> {
  public render() {
    const { tool, ...props } = this.props;
    if (isToolGroup(tool)) {
      const activeTool = this.props.toolStore[tool.activeToolId] as PanelTool;
      return (
        <ExpandableItem
          {...props}
          isActive={activeTool.isActive}
          isDisabled={activeTool.isDisabled}
        >
          <ItemWithDragInteraction
            direction={this.props.dragDirection}
            icon={placeholderIcon}
            isActive={activeTool.isActive}
            isDisabled={activeTool.isDisabled}
            onClick={this._handleClick}
            onOpenPanel={this._handleOpenPanel}
            title={tool.activeToolId}
          />
        </ExpandableItem>
      );
    }

    return (
      <Item
        {...props}
        icon={placeholderIcon}
        isActive={tool.isActive}
        isDisabled={tool.isDisabled}
        onClick={this._handleClick}
        title={tool.id}
      />
    );
  }

  private _handleClick = () => {
    this.props.onClick(this.props.tool.id);
  }

  private _handleOpenPanel = () => {
    this.props.onOpenPanel(this.props.tool.id);
  }
}

interface ToolbarItemPanelProps {
  onExpandGroup: (toolId: string, trayId: string | undefined) => void;
  onOutsideClick: (toolId: string) => void;
  onToolClick: (args: ToolbarItemGroupToolClickArgs) => void;
  onBack: (toolId: string) => void;
  tool: ToolGroup;
  toolStore: ToolStore;
}

interface ToolbarItemGroupToolClickArgs {
  itemId: SimpleTool["id"];
  toolGroupId: ToolGroup["id"];
}

class ToolbarItemPanel extends React.PureComponent<ToolbarItemPanelProps> {
  public render() {
    const backTrayItem = this.props.tool.backTrays.length > 0 ? this.props.toolStore[this.props.tool.backTrays[this.props.tool.backTrays.length - 1]] as PanelExpander : undefined;
    const tools = backTrayItem ? backTrayItem.tools : this.props.tool.tools;
    const toolsPerColumn = 4;
    const columnToTools = tools.reduce<ReadonlyArray<ReadonlyArray<string>>>((acc, tool, index) => {
      const columnIndex = Math.floor(index / toolsPerColumn);
      if (columnIndex >= acc.length) {
        return [
          ...acc,
          [tool],
        ];
      }
      return [
        ...acc.slice(0, columnIndex),
        [
          ...acc[columnIndex],
          tool,
        ],
        ...acc.slice(columnIndex + 1),
      ];
    }, []);
    const columns = (
      columnToTools.map((columnTools, index) => (
        <GroupColumn key={index}>
          {columnTools.map((itemId) => {
            const item = this.props.toolStore[itemId] as PanelTool;
            if (isPanelExpander(item))
              return (
                <GroupColumnExpander
                  isDisabled={!!item.isDisabled}
                  itemId={itemId}
                  key={itemId}
                  onClick={this._handleExpanderClick}
                />
              );
            return (
              <GroupColumnTool
                isDisabled={!!item.isDisabled}
                itemId={itemId}
                key={itemId}
                label={itemId}
                onClick={this._handleGroupColumnToolClick}
              />
            );
          })}
        </GroupColumn>
      ))
    );

    if (backTrayItem)
      return (
        <ToolGroupSelectionContext.Consumer>
          {(activateOnPointerUp) => (
            <NestedToolGroupContained
              columns={columns}
              onBack={this._handleBack}
              onBackPointerUp={activateOnPointerUp ? this._handleBack : undefined}
              onOutsideClick={this._handleOutsideClick}
              title={backTrayItem.title}
            />
          )}
        </ToolGroupSelectionContext.Consumer>

      );

    return (
      <ToolGroupContained
        columns={columns}
        onOutsideClick={this._handleOutsideClick}
        title={this.props.tool.title}
      />
    );
  }

  private _handleBack = () => {
    this.props.onBack(this.props.tool.id);
  }

  private _handleGroupColumnToolClick = (itemId: SimpleTool["id"]) => {
    this.props.onToolClick({ itemId, toolGroupId: this.props.tool.id });
  }

  private _handleExpanderClick = (trayId: string) => {
    this.props.onExpandGroup(this.props.tool.id, trayId);
  }

  private _handleOutsideClick = () => {
    this.props.onOutsideClick(this.props.tool.id);
  }
}

interface GroupColumnExpanderProps {
  isDisabled: boolean;
  onClick: (itemId: string) => void;
  itemId: string;
}

function GroupColumnExpander(props: GroupColumnExpanderProps) {
  const { onClick, itemId } = props;
  const handleClick = React.useCallback(() => {
    onClick(itemId);
  }, [onClick, itemId]);
  const activateOnPointerUp = React.useContext(ToolGroupSelectionContext);
  return (
    <GroupToolExpander
      icon={placeholderIcon}
      isDisabled={props.isDisabled}
      label={props.itemId}
      onClick={handleClick}
      onPointerUp={activateOnPointerUp ? handleClick : undefined}
    />
  );
}

interface GroupColumnToolProps {
  isDisabled: boolean;
  itemId: string;
  label: string;
  onClick: (itemId: SimpleTool["id"]) => void;
}

function GroupColumnTool(props: GroupColumnToolProps) {
  const { onClick, itemId } = props;
  const handleClick = React.useCallback(() => {
    onClick(itemId);
  }, [onClick, itemId]);
  const activateOnPointerUp = React.useContext(ToolGroupSelectionContext);
  return (
    <GroupTool
      icon={placeholderIcon}
      isDisabled={props.isDisabled}
      label={props.label}
      onClick={handleClick}
      onPointerUp={activateOnPointerUp ? handleClick : undefined}
    />
  );
}

interface Zone1Props {
  bounds: RectangleProps;
  horizontalTools: ToolbarTools;
  isInFooterMode: boolean;
  onAppButtonClick: () => void;
  onOpenPanel: (toolId: Tool["id"]) => void;
  onOpenPanelGroup: (toolId: string, trayId: string | undefined) => void;
  onPanelBack: (toolId: string) => void;
  onPanelOutsideClick: (toolId: string) => void;
  onPanelToolClick: (args: ToolbarItemGroupToolClickArgs) => void;
  onToolClick: (toolId: string) => void;
  safeAreaInsets: SafeAreaInsets;
  verticalTools: ToolbarTools;
  toolStore: ToolStore;
}

const getVisibleTools = (tools: ToolbarTools, toolStore: ToolStore) => {
  return tools.filter((toolId) => {
    const tool = toolStore[toolId];
    const activeTool = isToolGroup(tool) ? toolStore[tool.activeToolId] as PanelTool : tool;
    return !activeTool.isHidden;
  });
};

class Zone1 extends React.PureComponent<Zone1Props> {
  private _appButton = (
    <AppButton
      icon={<i className="icon icon-home" />}
      onClick={this.props.onAppButtonClick}
    />
  );

  public render() {
    const horizontalTools = getVisibleTools(this.props.horizontalTools, this.props.toolStore);
    const verticalTools = getVisibleTools(this.props.verticalTools, this.props.toolStore);
    return (
      <Zone
        bounds={this.props.bounds}
        id={1}
        isInFooterMode={this.props.isInFooterMode}
        safeAreaInsets={this.props.safeAreaInsets}
      >
        <ToolsWidget
          button={this._appButton}
          horizontalToolbar={
            horizontalTools.length > 0 &&
            <ToolZoneToolbar
              expandsTo={Direction.Bottom}
              onOpenPanel={this.props.onOpenPanel}
              onOpenPanelGroup={this.props.onOpenPanelGroup}
              onPanelBack={this.props.onPanelBack}
              onPanelOutsideClick={this.props.onPanelOutsideClick}
              onPanelToolClick={this.props.onPanelToolClick}
              onToolClick={this.props.onToolClick}
              panelAlignment={ToolbarPanelAlignment.Start}
              tools={this.props.horizontalTools}
              toolStore={this.props.toolStore}
            />
          }
          verticalToolbar={
            verticalTools.length > 0 &&
            <ToolZoneToolbar
              expandsTo={Direction.Right}
              onOpenPanel={this.props.onOpenPanel}
              onOpenPanelGroup={this.props.onOpenPanelGroup}
              onPanelBack={this.props.onPanelBack}
              onPanelOutsideClick={this.props.onPanelOutsideClick}
              onPanelToolClick={this.props.onPanelToolClick}
              onToolClick={this.props.onToolClick}
              panelAlignment={ToolbarPanelAlignment.Start}
              tools={this.props.verticalTools}
              toolStore={this.props.toolStore}
            />
          }
        />
      </Zone>
    );
  }
}

interface Zone3Props extends Omit<Zone1Props, "onAppButtonClick"> {
}

class Zone3 extends React.PureComponent<Zone3Props> {
  public render() {
    const horizontalTools = getVisibleTools(this.props.horizontalTools, this.props.toolStore);
    const verticalTools = getVisibleTools(this.props.verticalTools, this.props.toolStore);
    return (
      <Zone
        bounds={this.props.bounds}
        id={3}
        isInFooterMode={this.props.isInFooterMode}
        safeAreaInsets={this.props.safeAreaInsets}
      >
        <ToolsWidget
          isNavigation
          horizontalToolbar={
            horizontalTools.length > 0 &&
            <ToolZoneToolbar
              expandsTo={Direction.Bottom}
              onOpenPanel={this.props.onOpenPanel}
              onOpenPanelGroup={this.props.onOpenPanelGroup}
              onPanelBack={this.props.onPanelBack}
              onPanelOutsideClick={this.props.onPanelOutsideClick}
              onPanelToolClick={this.props.onPanelToolClick}
              onToolClick={this.props.onToolClick}
              panelAlignment={ToolbarPanelAlignment.End}
              tools={horizontalTools}
              toolStore={this.props.toolStore}
            />
          }
          verticalToolbar={
            verticalTools.length > 0 &&
            <ToolZoneToolbar
              expandsTo={Direction.Left}
              onOpenPanel={this.props.onOpenPanel}
              onOpenPanelGroup={this.props.onOpenPanelGroup}
              onPanelBack={this.props.onPanelBack}
              onPanelOutsideClick={this.props.onPanelOutsideClick}
              onPanelToolClick={this.props.onPanelToolClick}
              onToolClick={this.props.onToolClick}
              panelAlignment={ToolbarPanelAlignment.Start}
              tools={verticalTools}
              toolStore={this.props.toolStore}
            />
          }
        />
      </Zone>
    );
  }
}

interface ToolZoneToolbarProps {
  children: (items: React.ReactNode) => React.ReactNode;
  expandsTo: Direction;
  onOpenPanel: (toolId: Tool["id"]) => void;
  onOpenPanelGroup: (toolId: string, trayId: string | undefined) => void;
  onPanelBack: (toolId: string) => void;
  onPanelOutsideClick: (toolId: string) => void;
  onPanelToolClick: (args: ToolbarItemGroupToolClickArgs) => void;
  onToolClick: (toolId: string) => void;
  panelAlignment: ToolbarPanelAlignment;
  tools: ToolbarTools;
  toolStore: ToolStore;
}

class ToolZoneToolbar extends React.PureComponent<ToolZoneToolbarProps> {
  public static readonly defaultProps = {
    // eslint-disable-next-line object-shorthand
    children: function (this: ToolZoneToolbarProps, items: React.ReactNode) {
      return (
        <Toolbar
          expandsTo={this.expandsTo}
          items={items}
          panelAlignment={this.panelAlignment}
        />
      );
    },
  };

  public render() {
    const items = this.props.tools.reduce((acc, toolId) => {
      const tool = this.props.toolStore[toolId];
      const panel = isToolGroup(tool) && tool.isOpen ? (
        <ToolbarItemPanel
          key={tool.id}
          onBack={this.props.onPanelBack}
          onExpandGroup={this.props.onOpenPanelGroup}
          onOutsideClick={this.props.onPanelOutsideClick}
          onToolClick={this.props.onPanelToolClick}
          tool={tool}
          toolStore={this.props.toolStore}
        />
      ) : undefined;

      const item = (
        <ToolbarItem
          dragDirection={this.props.expandsTo}
          key={tool.id}
          onClick={this.props.onToolClick}
          onOpenPanel={this.props.onOpenPanel}
          panel={panel}
          tool={tool}
          toolStore={this.props.toolStore}
        />
      );

      acc.push(item);
      return acc;
    }, new Array<React.ReactNode>());
    return this.props.children(items);
  }
}

interface BackstageItemExampleProps {
  id: number;
  isActive?: boolean;
  isDisabled?: boolean;
  label: string;
  onClick: (id: number) => void;
  safeAreaInsets: SafeAreaInsets;
}

class BackstageItemExample extends React.PureComponent<BackstageItemExampleProps> {
  public render() {
    return (
      <BackstageItem
        icon={<i className="icon icon-placeholder" />}
        isActive={this.props.isActive}
        isDisabled={this.props.isDisabled}
        onClick={this._handleClick}
        safeAreaInsets={this.props.safeAreaInsets}
      >
        {this.props.label}
      </BackstageItem>
    );
  }

  private _handleClick = () => {
    this.props.onClick(this.props.id);
  }
}

interface BackstageExampleProps {
  isOpen: boolean;
  onClose: () => void;
  safeAreaInsets: SafeAreaInsets;
}

interface BackstageExampleState {
  activeItem: number;
}

class BackstageExample extends React.PureComponent<BackstageExampleProps, BackstageExampleState> {
  public readonly state = {
    activeItem: 0,
  };

  private getItemProps(itemId: number): BackstageItemExampleProps {
    return {
      id: itemId,
      isActive: itemId === this.state.activeItem,
      label: `Item ${itemId}`,
      onClick: this._handleItemClick,
      safeAreaInsets: this.props.safeAreaInsets,
    };
  }

  public render() {
    return (
      <Backstage
        footer={
          <div style={{ textAlign: "center" }}>Backstage Footer</div>
        }
        header={
          <UserProfile
            color="#85a9cf"
            initials="NZ"
            safeAreaInsets={this.props.safeAreaInsets}
          >
            9-Zone
          </UserProfile>
        }
        isOpen={this.props.isOpen}
        onClose={this.props.onClose}
        safeAreaInsets={this.props.safeAreaInsets}
      >
        <BackstageItemExample
          {...this.getItemProps(0)}
          label="Zones"
        />
        <BackstageItemExample
          {...this.getItemProps(1)}
          isDisabled
          label="Disabled"
        />
        <BackstageSeparator />
        <BackstageItemExample
          {...this.getItemProps(2)}
        />
        <BackstageItemExample
          {...this.getItemProps(3)}
        />
        <BackstageItemExample
          {...this.getItemProps(4)}
        />
        <BackstageItemExample
          {...this.getItemProps(5)}
        />
        <BackstageItemExample
          {...this.getItemProps(6)}
        />
        <BackstageItemExample
          {...this.getItemProps(7)}
        />
        <BackstageItemExample
          {...this.getItemProps(8)}
        />
        <BackstageItemExample
          {...this.getItemProps(9)}
        />
        <BackstageItemExample
          {...this.getItemProps(10)}
        />
      </Backstage>
    );
  }

  private _handleItemClick = (activeItem: number) => {
    this.setState((prevState) => {
      return {
        ...prevState,
        activeItem,
      };
    });
  }
}

interface StagePanelTargetExampleProps {
  safeAreaInsets: SafeAreaInsets;
  type: ExampleStagePanelType;
  onTargetChanged: (target: ExampleStagePanelType | undefined) => void;
}

class StagePanelTargetExample extends React.PureComponent<StagePanelTargetExampleProps> {
  public render() {
    const type = getStagePanelType(this.props.type);
    return (
      <StagePanelTarget
        onTargetChanged={this._handleTargetChanged}
        safeAreaInsets={this.props.safeAreaInsets}
        type={type}
      />
    );
  }

  private _handleTargetChanged = (isTargeted: boolean) => {
    this.props.onTargetChanged(isTargeted ? this.props.type : undefined);
  }
}

interface SplitterTargetExampleProps {
  isVertical: boolean;
  isVisible: boolean;
  onTargetChanged: (target: ExampleStagePanelType | undefined) => void;
  type: ExampleStagePanelType;
  widgetCount: number;
}

class SplitterTargetExample extends React.PureComponent<SplitterTargetExampleProps> {
  public render() {
    return (
      <SplitterTarget
        isVertical={this.props.isVertical}
        onTargetChanged={this._handleTargetChanged}
        style={this.props.isVisible ? undefined : displayNone}
        paneCount={this.props.widgetCount}
      />
    );
  }

  private _handleTargetChanged = (isTargeted: boolean) => {
    this.props.onTargetChanged(isTargeted ? this.props.type : undefined);
  }
}

interface StagePanelWidgetProps extends FloatingWidgetProps {
  isTargetVisible: boolean;
  onTargetChanged: SplitterPaneTargetChangedFn;
  paneIndex: number;
  type: ExampleStagePanelType;
}

class StagePanelWidget extends React.PureComponent<StagePanelWidgetProps> {
  public render() {
    const { ...props } = this.props;
    return (
      <div style={{ height: "100%", position: "relative" }}>
        <FloatingWidget
          {...props}
        />
        {this.props.isTargetVisible && <SplitterPaneTarget
          onTargetChanged={this._handleTargetChanged}
        />}
      </div>
    );
  }

  private _handleTargetChanged = (isTargeted: boolean) => {
    const target = isTargeted ? this.props.paneIndex : undefined;
    this.props.onTargetChanged(target, this.props.type);
  }
}

interface WidgetStagePanelProps {
  getWidgetContentRef: (id: WidgetZoneId) => React.Ref<HTMLDivElement>;
  isInFooterMode: boolean;
  isSplitterTargetVisible: boolean;
  isZoneTargetVisible: boolean;
  onInitialize: (size: number, type: ExampleStagePanelType) => void;
  onResize: (resizeBy: number, type: ExampleStagePanelType) => void;
  onStagePanelTargetChanged: (target: ExampleStagePanelType | undefined) => void;
  onPaneTargetChanged: SplitterPaneTargetChangedFn;
  onTabClick: (widgetId: WidgetZoneId, tabIndex: number) => void;
  onTabDragStart: (widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps, widgetBounds: RectangleProps) => void;
  onTabDragEnd: () => void;
  onTabDrag: (dragged: PointProps) => void;
  onToggleCollapse: (panel: ExampleStagePanelType) => void;
  panel: NineZoneStagePanelManagerProps;
  safeAreaInsets: SafeAreaInsets;
  type: ExampleStagePanelType;
  widgets: ZonesManagerWidgetsProps;
}

class WidgetStagePanel extends React.PureComponent<WidgetStagePanelProps> {
  private _measurer = React.createRef<HTMLDivElement>();

  public componentDidMount(): void {
    this.initialize();
  }

  public componentDidUpdate(): void {
    this.initialize();
  }

  public render() {
    const type = getStagePanelType(this.props.type);
    const isVertical = StagePanelTypeHelpers.isVertical(type);
    let safeAreaInsets = this.props.safeAreaInsets;
    if (this.props.isInFooterMode)
      safeAreaInsets &= ~SafeAreaInsets.Bottom;
    return (
      <StagePanel
        onResize={this._handleResize}
        onToggleCollapse={this._handleToggleCollapse}
        safeAreaInsets={safeAreaInsets}
        size={this.props.panel.isCollapsed ? undefined : this.props.panel.size}
        type={type}
      >
        <div
          ref={this._measurer}
          style={{ width: "100%", height: "100%", position: "absolute", zIndex: -1 }}
        />
        <SplitterTargetExample
          isVertical={isVertical}
          isVisible={this.props.isSplitterTargetVisible}
          onTargetChanged={this.props.onStagePanelTargetChanged}
          type={this.props.type}
          widgetCount={this.props.panel.panes.length}
        />
        <Splitter
          isGripHidden={this.props.panel.isCollapsed}
          isVertical={isVertical}
        >
          {this.props.panel.panes.map((pane, index) => {
            const openWidgetId = pane.widgets.find((wId) => this.props.widgets[wId].tabIndex >= 0);
            const tabIndex = openWidgetId ? this.props.widgets[openWidgetId].tabIndex : 0;
            return (
              <StagePanelWidget
                disabledResizeHandles={DisabledResizeHandles.None}
                draggedWidget={undefined}
                fillZone
                getWidgetContentRef={this.props.getWidgetContentRef}
                horizontalAnchor={this.props.widgets[pane.widgets[0]].horizontalAnchor}
                isCollapsed={this.props.panel.isCollapsed}
                isFloating={false}
                isInStagePanel
                isTargetVisible={this.props.isZoneTargetVisible}
                key={index}
                onResize={undefined}
                onTabClick={this.props.onTabClick}
                onTabDrag={this.props.onTabDrag}
                onTabDragEnd={this.props.onTabDragEnd}
                onTabDragStart={this.props.onTabDragStart}
                onTargetChanged={this.props.onPaneTargetChanged}
                openWidgetId={openWidgetId}
                paneIndex={index}
                tabIndex={tabIndex}
                type={this.props.type}
                verticalAnchor={this.props.widgets[pane.widgets[0]].verticalAnchor}
                widgets={pane.widgets}
              />
            );
          })}
        </Splitter>
      </StagePanel>
    );
  }

  private _handleResize = (resizeBy: number) => {
    this.props.onResize(resizeBy, this.props.type);
  }

  private _handleToggleCollapse = () => {
    this.props.onToggleCollapse(this.props.type);
  }

  private initialize() {
    if (this.props.panel.size !== undefined)
      return;
    if (!this._measurer.current)
      return;
    const clientRect = this._measurer.current.getBoundingClientRect();
    const type = getStagePanelType(this.props.type);
    const size = StagePanelTypeHelpers.isVertical(type) ? clientRect.width : clientRect.height;
    this.props.onInitialize(size, this.props.type);
  }
}

type WidgetTabDragFn = (dragged: PointProps) => void;
type ZoneResizeFn = (zoneId: WidgetZoneId, resizeBy: number, handle: ResizeHandle, filledHeightDiff: number) => void;
type StagePanelResizeFn = (resizeBy: number, stagePanelType: ExampleStagePanelType) => void;
type SplitterPaneTargetChangedFn = (paneIndex: number | undefined, stagePanelType: ExampleStagePanelType) => void;
type TargetChangedFn = (target: ZonesManagerTargetProps | undefined) => void;

const placeholderIcon = (
  <i className="icon icon-placeholder" />
);

const getTabCount = (zone: WidgetZoneId): number => {
  switch (zone) {
    case 2:
    case 6:
    case 7:
      return 1;
    case 4:
    case 9:
      return 2;
  }
  return 0;
};

enum ExampleStagePanelType {
  Bottom,
  BottomMost,
  Left,
  Right,
  Top,
}

type InnerStagePanelType = ExampleStagePanelType.Left | ExampleStagePanelType.Top | ExampleStagePanelType.Right | ExampleStagePanelType.Bottom;
type OuterStagePanelType = ExampleStagePanelType.BottomMost;

interface BottomMostPanel extends NineZoneStagePanelManagerProps {
  readonly isVisible: boolean;
}

interface OuterPanels extends NineZoneStagePanelsManagerProps {
  readonly bottom: BottomMostPanel;
}

interface ExampleNestedStagePanelsProps extends NineZoneNestedStagePanelsManagerProps {
  readonly panels:
  { readonly [id in "inner"]: NineZoneStagePanelsManagerProps } &
  { readonly [id in "outer"]: OuterPanels };
}

interface ExampleZonesManagerProps extends NineZoneManagerProps {
  readonly nested: ExampleNestedStagePanelsProps;
}

const getStagePanelType = (type: ExampleStagePanelType): StagePanelType => {
  switch (type) {
    case ExampleStagePanelType.Bottom:
    case ExampleStagePanelType.BottomMost:
      return StagePanelType.Bottom;
    case ExampleStagePanelType.Left:
      return StagePanelType.Left;
    case ExampleStagePanelType.Right:
      return StagePanelType.Right;
    case ExampleStagePanelType.Top:
      return StagePanelType.Top;
  }
};

const getNestedStagePanel = (type: ExampleStagePanelType): NestedStagePanelKey<ExampleNestedStagePanelsProps> => {
  switch (type) {
    case ExampleStagePanelType.Bottom:
      return {
        id: "inner",
        type: StagePanelType.Bottom,
      };
    case ExampleStagePanelType.BottomMost:
      return {
        id: "outer",
        type: StagePanelType.Bottom,
      };
    case ExampleStagePanelType.Left:
      return {
        id: "inner",
        type: StagePanelType.Left,
      };
    case ExampleStagePanelType.Right:
      return {
        id: "inner",
        type: StagePanelType.Right,
      };
    case ExampleStagePanelType.Top:
      return {
        id: "inner",
        type: StagePanelType.Top,
      };
  }
};

const initialTheme: Theme = "light";

interface ZonesExampleProps {
  floatingZonesMeasurerRef: React.Ref<HTMLDivElement>;
  getContainerSize: () => SizeProps;
  getDisabledResizeHandles: (zoneId: WidgetZoneId) => DisabledResizeHandles;
  getDropTarget: (zoneId: WidgetZoneId) => ZoneTargetType | undefined;
  getGhostOutlineBounds: (zoneId: WidgetZoneId) => RectangleProps | undefined;
  getWidgetContentRef: (id: WidgetZoneId) => React.Ref<HTMLDivElement>;
  isTooltipVisible: boolean;
  message: VisibleMessage;
  onAppButtonClick: () => void;
  onCloseBottomMostPanel: () => void;
  onHideMessage: () => void;
  onOpenPanel: (toolId: Tool["id"]) => void;
  onOpenPanelGroup: (toolId: string, trayId: string | undefined) => void;
  onOpenWidgetChange: (openWidget: FooterWidget) => void;
  onResize: () => void;
  onStagePanelInitialize: (size: number, type: ExampleStagePanelType) => void;
  onStagePanelResize: (resizeBy: number, type: ExampleStagePanelType) => void;
  onStagePanelTargetChanged: (target: ExampleStagePanelType | undefined) => void;
  onTabClick: (widgetId: WidgetZoneId, tabIndex: number) => void;
  onTabDragStart: (widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps, widgetBounds: RectangleProps) => void;
  onTabDragEnd: () => void;
  onTabDrag: (dragged: PointProps) => void;
  onToggleCollapse: (panel: ExampleStagePanelType) => void;
  onToolClick: (toolId: string) => void;
  onTargetChanged: TargetChangedFn;
  onPanelBack: (toolId: string) => void;
  onPanelOutsideClick: (toolId: string) => void;
  onPanelToolClick: (args: ToolbarItemGroupToolClickArgs) => void;
  onPaneTargetChanged: SplitterPaneTargetChangedFn;
  onTooltipTimeout: () => void;
  onWidgetResize: (zoneId: WidgetZoneId, resizeBy: number, handle: ResizeHandle, filledHeightDiff: number) => void;
  openWidget: FooterWidget;
  safeAreaInsets: SafeAreaInsets;
  stagePanels: ExampleNestedStagePanelsProps;
  toastMessageKey: number;
  zones: ZonesManagerProps;
  zonesMeasurerRef: React.Ref<HTMLDivElement>;
  tools: AppTools;
  toolStore: ToolStore;
}

interface ZonesExampleState {
  allowPointerUpSelection: boolean;
  toolSettingsMode: ToolSettingsMode;
}

export class ZonesExample extends React.PureComponent<ZonesExampleProps, ZonesExampleState> {
  public readonly state: ZonesExampleState = {
    allowPointerUpSelection: false,
    toolSettingsMode: ToolSettingsMode.Open,
  };

  private _widgetModeStyle: React.CSSProperties = {
    position: "absolute",
  };

  private _footerModeStyle: React.CSSProperties = {
    ...this._widgetModeStyle,
    display: "flex",
    flexDirection: "column",
  };

  public componentDidMount(): void {
    window.addEventListener("resize", this._handleWindowResize, true);
    this.props.onResize();
  }

  public componentWillUnmount(): void {
    document.removeEventListener("resize", this._handleWindowResize, true);
  }

  public render() {
    return (
      <ToolGroupSelectionContext.Provider value={this.state.allowPointerUpSelection}>
        <Zones style={this.props.zones.isInFooterMode ? this._footerModeStyle : this._widgetModeStyle}>
          <TooltipExample
            getContainerSize={this.props.getContainerSize}
            isTooltipVisible={this.props.isTooltipVisible}
            onTooltipTimeout={this.props.onTooltipTimeout}
          />
          <StagePanels
            bottomPanel={this.renderOuterStagePanel(ExampleStagePanelType.BottomMost)}
          >
            <StagePanels
              bottomPanel={this.renderStagePanel(ExampleStagePanelType.Bottom)}
              leftPanel={this.renderStagePanel(ExampleStagePanelType.Left)}
              rightPanel={this.renderStagePanel(ExampleStagePanelType.Right)}
              topPanel={this.renderStagePanel(ExampleStagePanelType.Top)}
            >
              <div
                ref={this.props.zonesMeasurerRef}
                style={{
                  height: "100%",
                  position: "relative",
                }}
                onPointerDown={this._handlePointerDown}
                onPointerUp={this._handlePointerUp}
              >
                {widgetZoneIds.map((zoneId) => this.renderZone(zoneId))}
              </div>
            </StagePanels>
          </StagePanels>
          {this.renderStatusZone()}
          <div
            ref={this.props.floatingZonesMeasurerRef}
            style={{
              height: "100%",
              width: "100%",
              position: "absolute",
            }}
          />
        </Zones>
      </ToolGroupSelectionContext.Provider>
    );
  }

  private renderStagePanel(exampleType: InnerStagePanelType) {
    const draggedWidget = this.props.zones.draggedWidget;
    const type = getStagePanelType(exampleType);
    const panel = StagePanelsManager.getPanel(type, this.props.stagePanels.panels.inner);
    if (panel.panes.length === 0) {
      if (!draggedWidget)
        return undefined;
      return (
        <StagePanelTargetExample
          onTargetChanged={this.props.onStagePanelTargetChanged}
          safeAreaInsets={this.props.safeAreaInsets}
          type={exampleType}
        />
      );
    }

    const isSplitterTargetVisible = !!draggedWidget && !this.props.zones.target;
    const isZoneTargetVisible = !!draggedWidget;
    return (
      <WidgetStagePanel
        getWidgetContentRef={this.props.getWidgetContentRef}
        isInFooterMode={this.props.zones.isInFooterMode}
        isSplitterTargetVisible={isSplitterTargetVisible}
        isZoneTargetVisible={isZoneTargetVisible}
        onInitialize={this.props.onStagePanelInitialize}
        onPaneTargetChanged={this.props.onPaneTargetChanged}
        onResize={this.props.onStagePanelResize}
        onStagePanelTargetChanged={this.props.onStagePanelTargetChanged}
        onTabClick={this.props.onTabClick}
        onTabDragStart={this.props.onTabDragStart}
        onTabDragEnd={this.props.onTabDragEnd}
        onTabDrag={this.props.onTabDrag}
        onToggleCollapse={this.props.onToggleCollapse}
        panel={panel}
        safeAreaInsets={this.props.safeAreaInsets}
        type={exampleType}
        widgets={this.props.zones.widgets}
      />
    );
  }

  private renderOuterStagePanel(exampleType: OuterStagePanelType) {
    const type = getStagePanelType(exampleType);
    if (exampleType === ExampleStagePanelType.BottomMost && this.props.stagePanels.panels.outer.bottom.isVisible) {
      return (
        <StagePanel
          safeAreaInsets={this.props.safeAreaInsets}
          type={type}
        >
          <div
            style={{
              background: "#eee",
              padding: "10px 20px",
              display: "grid",
              alignItems: "center",
              gridAutoFlow: "column",
              gridAutoColumns: "1fr auto",
              boxSizing: "border-box",
            }}
          >
            Custom content of bottom most panel.
            <HollowButton onClick={this.props.onCloseBottomMostPanel} style={{ float: "right" }}>X</HollowButton>
          </div>
        </StagePanel>
      );
    }
    return undefined;
  }

  private renderZone(zoneId: WidgetZoneId) {
    switch (zoneId) {
      case 1:
        return this.renderZone1();
      case 2:
        return this.renderZone2();
      case 3:
        return this.renderZone3();
      case 8:
        return undefined;
      default:
        return this.renderFloatingZone(zoneId);
    }
  }

  private renderZone1() {
    const zoneId = 1;
    return (
      <Zone1
        bounds={this.props.zones.zones[zoneId].bounds}
        horizontalTools={this.props.tools[zoneId].horizontal}
        isInFooterMode={this.props.zones.isInFooterMode}
        key={zoneId}
        onAppButtonClick={this.props.onAppButtonClick}
        onOpenPanel={this._handleOpenPanel}
        onOpenPanelGroup={this.props.onOpenPanelGroup}
        onPanelBack={this.props.onPanelBack}
        onPanelOutsideClick={this.props.onPanelOutsideClick}
        onPanelToolClick={this.props.onPanelToolClick}
        onToolClick={this.props.onToolClick}
        safeAreaInsets={this.props.safeAreaInsets}
        toolStore={this.props.toolStore}
        verticalTools={this.props.tools[zoneId].vertical}
      />
    );
  }

  private renderZone2() {
    const zoneId = 2;
    const zone = this.props.zones.zones[zoneId];
    const bounds = zone.floating ? zone.floating.bounds : zone.bounds;
    const dropTarget = this.props.getDropTarget(zone.id);
    const lastPosition = this.props.zones.draggedWidget ? this.props.zones.draggedWidget.lastPosition : undefined;
    const outlineBounds = this.props.getGhostOutlineBounds(zone.id);
    const widget = zone.widgets.length > 0 ? this.props.zones.widgets[zone.widgets[0]] : undefined;
    const zoneWidget = this.props.zones.widgets[zoneId];
    if (zoneWidget.mode === ToolSettingsWidgetMode.Tab) {
      return this.renderFloatingZone(zoneId);
    }

    const zIndex = zone.floating ? { zIndex: zone.floating.stackId } : undefined;
    return (
      <React.Fragment
        key={zone.id}
      >
        <Zone
          bounds={bounds}
          id={zoneId}
          isFloating={!!zone.floating}
          isInFooterMode={this.props.zones.isInFooterMode}
          key={zoneId}
          safeAreaInsets={this.props.safeAreaInsets}
          style={zIndex}
        >
          {widget ?
            <ToolSettingsWidget
              fillZone={zone.isLayoutChanged && !!zone.floating}
              getWidgetContentRef={this.props.getWidgetContentRef}
              isFloating={!!zone.floating}
              lastPosition={lastPosition}
              mode={this.state.toolSettingsMode}
              onDrag={this.props.onTabDrag}
              onDragEnd={this.props.onTabDragEnd}
              onDragStart={this._handleToolSettingsDragStart}
              onResize={this._handleToolSettingsResize}
              onTabClick={this._handleToolSettingsTabClick}
            />
            : null}
        </Zone>
        <ZoneTargetExample
          bounds={zone.bounds}
          dropTarget={dropTarget}
          isInFooterMode={this.props.zones.isInFooterMode}
          onTargetChanged={this.props.onTargetChanged}
          safeAreaInsets={this.props.safeAreaInsets}
          zoneIndex={zone.id}
        />
        {outlineBounds && <Outline bounds={outlineBounds} />}
      </React.Fragment>
    );
  }

  private renderZone3() {
    const zoneId = 3;
    return (
      <Zone3
        bounds={this.props.zones.zones[zoneId].bounds}
        horizontalTools={this.props.tools[zoneId].horizontal}
        isInFooterMode={this.props.zones.isInFooterMode}
        key={zoneId}
        onOpenPanel={this._handleOpenPanel}
        onOpenPanelGroup={this.props.onOpenPanelGroup}
        onPanelBack={this.props.onPanelBack}
        onPanelOutsideClick={this.props.onPanelOutsideClick}
        onPanelToolClick={this.props.onPanelToolClick}
        onToolClick={this.props.onToolClick}
        safeAreaInsets={this.props.safeAreaInsets}
        toolStore={this.props.toolStore}
        verticalTools={this.props.tools[zoneId].vertical}
      />
    );
  }

  private renderStatusZone() {
    const zone = this.props.zones.zones[8];
    const isRectangularWidget = zone.widgets.length > 1;
    if (isRectangularWidget)
      return this.renderFloatingZone(zone.id);

    const outlineBounds = this.props.getGhostOutlineBounds(zone.id);
    const dropTarget = this.props.getDropTarget(zone.id);
    const bounds = zone.floating ? zone.floating.bounds : zone.bounds;

    return (
      <StatusZoneExample
        bounds={bounds}
        dropTarget={dropTarget}
        isInFooterMode={this.props.zones.isInFooterMode}
        key={zone.id}
        message={this.props.message}
        onHideMessage={this.props.onHideMessage}
        onOpenWidgetChange={this.props.onOpenWidgetChange}
        onTargetChanged={this.props.onTargetChanged}
        openWidget={this.props.openWidget}
        outlineBounds={outlineBounds}
        safeAreaInsets={this.props.safeAreaInsets}
        targetBounds={zone.bounds}
        toastMessageKey={this.props.toastMessageKey}
      />
    );
  }

  private renderFloatingZone(zoneId: WidgetZoneId) {
    const zone = this.props.zones.zones[zoneId];
    const dropTarget = this.props.getDropTarget(zone.id);
    const outlineBounds = this.props.getGhostOutlineBounds(zoneId);
    const widget = zone.widgets.length > 0 ? this.props.zones.widgets[zone.widgets[0]] : undefined;
    const draggedWidget = this.props.zones.draggedWidget;
    const openWidgetId = zone.widgets.find((wId) => this.props.zones.widgets[wId].tabIndex >= 0);
    const tabIndex = openWidgetId ? this.props.zones.widgets[openWidgetId].tabIndex : 0;
    return (
      <React.Fragment
        key={zone.id}
      >
        <FloatingZoneWidget
          disabledResizeHandles={this.props.getDisabledResizeHandles(zone.id)}
          draggedWidget={draggedWidget && (draggedWidget.id === zoneId) ? draggedWidget : undefined}
          getWidgetContentRef={this.props.getWidgetContentRef}
          isInFooterMode={this.props.zones.isInFooterMode}
          onResize={this.props.onWidgetResize}
          onTabClick={this.props.onTabClick}
          onTabDrag={this.props.onTabDrag}
          onTabDragEnd={this.props.onTabDragEnd}
          onTabDragStart={this.props.onTabDragStart}
          openWidgetId={openWidgetId}
          safeAreaInsets={this.props.safeAreaInsets}
          tabIndex={tabIndex}
          widget={widget}
          zone={zone}
        />
        <ZoneTargetExample
          bounds={zone.bounds}
          dropTarget={dropTarget}
          isInFooterMode={this.props.zones.isInFooterMode}
          onTargetChanged={this.props.onTargetChanged}
          safeAreaInsets={this.props.safeAreaInsets}
          zoneIndex={zone.id}
        />
        {outlineBounds && <Outline bounds={outlineBounds} />}
      </React.Fragment>
    );
  }

  private _handleWindowResize = () => {
    this.props.onResize();
  }

  private _handleToolSettingsTabClick = () => {
    this.setState((prevState) => ({
      toolSettingsMode: prevState.toolSettingsMode === ToolSettingsMode.Minimized ? ToolSettingsMode.Open : ToolSettingsMode.Minimized,
    }));
  }

  private _handleToolSettingsDragStart = (tabIndex: number, initialPosition: PointProps, widgetBounds: RectangleProps) => {
    this.props.onTabDragStart(2, tabIndex, initialPosition, widgetBounds);
  }

  private _handleToolSettingsResize = (resizeBy: number, handle: ResizeHandle) => {
    this.props.onWidgetResize(2, resizeBy, handle, 0);
  }

  private _handleOpenPanel = (toolId: Tool["id"]) => {
    this.setState({
      allowPointerUpSelection: true,
    });
    this.props.onOpenPanel(toolId);
  }

  private _handlePointerDown = () => {
    this.setState({
      allowPointerUpSelection: false,
    });
  }

  private _handlePointerUp = () => {
    this.setState({
      allowPointerUpSelection: false,
    });
  }
}

interface ZonesPageState {
  isBackstageOpen: boolean;
  isTooltipVisible: boolean;
  message: VisibleMessage;
  nineZone: ExampleZonesManagerProps;
  openWidget: FooterWidget;
  safeAreaInsets: SafeAreaInsets;
  theme: Theme;
  toastMessageKey: number;
  tools: AppTools;
  toolStore: ToolStore;
  widgetIdToContent: Partial<{ [id in WidgetZoneId]: HTMLDivElement | undefined }>;
}

const defaultNineZoneStagePanelsManagerProps = getDefaultNineZoneStagePanelsManagerProps();

const defaultZonesManagerProps = getDefaultZonesManagerProps();
const defaultZonesProps = {
  ...defaultZonesManagerProps,
  zones: {
    ...defaultZonesManagerProps.zones,
    9: {
      ...defaultZonesManagerProps.zones[9],
      isLayoutChanged: true,
    },
  },
};

const initialToolStore: ToolStore = {
  "disableTools": {
    id: "disableTools",
  },
  "toggleTools": {
    id: "toggleTools",
  },
  "toolSettings": {
    id: "toolSettings",
  },
  "cube": {
    activeToolId: "Test1",
    backTrays: [],
    id: "cube",
    title: "Tools",
    tools: [
      "Test1", "Test2", "Test3", "Test4", "Test5", "Test6",
    ],
  },
  "channel": {
    activeToolId: "Test1",
    backTrays: [],
    id: "channel",
    title: "Tools",
    tools: ["Test1"],
  },
  "chat": {
    id: "chat",
  },
  "browse": {
    id: "browse",
  },
  "validate": {
    activeToolId: "Validate",
    id: "validate",
    backTrays: [],
    title: "Tools",
    tools: ["Validate"],
  },
  "d2": {
    activeToolId: "3D#1",
    backTrays: [],
    id: "d2",
    title: "3D Tools",
    tools: ["3D#1", "3D#2"],
  },
  "clipboard": {
    activeToolId: "3D#2",
    id: "clipboard",
    backTrays: [],
    title: "Tools",
    tools: ["3D#1", "3D#2"],
  },
  "document": {
    id: "document",
  },
  "Test1": {
    id: "Test1",
  },
  "Test2": {
    id: "Test2",
    isDisabled: true,
  },
  "Test3": {
    id: "Test3",
    title: "Test3 Tools",
    tools: ["Test7"],
  },
  "Test4": {
    id: "Test4",
  },
  "Test5": {
    id: "Test5",
  },
  "Test6": {
    id: "Test6",
  },
  "Test7": {
    id: "Test7",
  },
  "3D#1": {
    id: "3D#1",
  },
  "3D#2": {
    id: "3D#2",
  },
  "Validate": {
    id: "Validate",
  },
};

export default class ZonesPage extends React.PureComponent<{}, ZonesPageState> {
  private _handleTabDrag: ScheduleFn<WidgetTabDragFn>;
  private _handleZoneResize: ScheduleFn<ZoneResizeFn>;
  private _handleStagePanelResize: ScheduleFn<StagePanelResizeFn>;

  private _nineZone = new NineZoneManager();
  private _widgetContentRefs = new Map<WidgetZoneId, React.Ref<HTMLDivElement>>();
  private _floatingZonesMeasurer = React.createRef<HTMLDivElement>();
  private _zonesMeasurer = React.createRef<HTMLDivElement>();
  private _zoneBounds: RectangleProps = { bottom: 0, left: 0, right: 0, top: 0 };

  public readonly state: ZonesPageState = {
    isBackstageOpen: false,
    isTooltipVisible: false,
    message: VisibleMessage.None,
    nineZone: {
      nested: {
        panels: {
          inner: defaultNineZoneStagePanelsManagerProps,
          outer: {
            ...defaultNineZoneStagePanelsManagerProps,
            bottom: {
              ...defaultNineZoneStagePanelsManagerProps.bottom,
              isVisible: false,
            },
          },
        },
      },
      zones: this._nineZone.getZonesManager().mergeZone(6, 9, defaultZonesProps),
    },
    openWidget: FooterWidget.None,
    safeAreaInsets: SafeAreaInsets.All,
    theme: initialTheme,
    toastMessageKey: 0,
    tools: {
      1: {
        horizontal: [
          "disableTools",
          "toggleTools",
          "toolSettings",
        ],
        vertical: [
          "cube",
          "validate",
        ],
      },
      3: {
        horizontal: [
          "d2",
        ],
        vertical: [
          "channel",
          "chat",
          "browse",
          "clipboard",
          "document",
        ],
      },
    },
    toolStore: initialToolStore,
    widgetIdToContent: {},
  };

  public constructor(p: {}) {
    super(p);

    this._handleTabDrag = rafSchedule((dragged: PointProps) => {
      this.setState((prevState) => {
        const zones = this._nineZone.getZonesManager().handleWidgetTabDrag(dragged, prevState.nineZone.zones);
        if (zones === prevState.nineZone.zones)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            zones,
          },
        };
      });
    });
    this._handleZoneResize = rafSchedule((zoneId: WidgetZoneId, resizeBy: number, handle: ResizeHandle, filledHeightDiff: number) => {
      this.setState((prevState) => {
        const zones = this._nineZone.getZonesManager().handleWidgetResize({ zoneId, resizeBy, handle, filledHeightDiff }, prevState.nineZone.zones);
        if (zones === prevState.nineZone.zones)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            zones,
          },
        };
      });
    });
    this._handleStagePanelResize = rafSchedule((resizeBy: number, type: ExampleStagePanelType) => {
      const panel = getNestedStagePanel(type);
      this.setState((prevState) => {
        const nested = this._nineZone.getNestedPanelsManager().resize(panel, resizeBy, prevState.nineZone.nested);
        if (nested === prevState.nineZone.nested)
          return null;
        return {
          nineZone: {
            ...prevState.nineZone,
            nested,
          },
        };
      });
    });
  }

  public componentDidMount() {
    this.setState((prevState) => ({
      nineZone: this._nineZone.showWidget(2, prevState.nineZone),
    }));
    this.setState((prevState) => {
      const manager = this._nineZone.getZonesManager();
      let zones = manager.setZoneWidth(4, 100, prevState.nineZone.zones);
      zones = manager.setZoneWidth(6, 100, zones);
      return {
        nineZone: {
          ...prevState.nineZone,
          zones,
        },
      };
    });
  }

  public componentDidUpdate() {
    if (!this._zonesMeasurer.current)
      return;
    this._handleResize();
  }

  public componentWillUnmount() {
    this._handleTabDrag.cancel();
    this._handleZoneResize.cancel();
  }

  public render() {
    const tabs = widgetZoneIds.reduce<Array<{ id: number, widget: WidgetManagerProps }>>((prev, zoneId) => {
      const widget = this.state.nineZone.zones.widgets[zoneId];
      const tabCount = getTabCount(zoneId);
      for (let i = 0; i < tabCount; i++) {
        prev.push({
          id: i,
          widget,
        });
      }
      return prev;
    }, []);
    return (
      <>
        <Content />
        <ZonesExample
          floatingZonesMeasurerRef={this._floatingZonesMeasurer}
          getContainerSize={this._handleGetContainerSize}
          getDisabledResizeHandles={this._handleGetDisabledResizeHandles}
          getDropTarget={this._getDropTarget}
          getGhostOutlineBounds={this._getGhostOutlineBounds}
          getWidgetContentRef={this._getWidgetContentRef}
          isTooltipVisible={this.state.isTooltipVisible}
          message={this.state.message}
          zones={this.state.nineZone.zones}
          onAppButtonClick={this._handleAppButtonClick}
          onCloseBottomMostPanel={this._handleToggleBottomMostPanel}
          onHideMessage={this._handleHideMessage}
          onOpenPanel={this._handleOpenPanel}
          onOpenPanelGroup={this._handleExpandPanelGroup}
          onOpenWidgetChange={this._handleOpenWidgetChange}
          onStagePanelInitialize={this._handleStagePanelInitialize}
          onStagePanelResize={this._handleStagePanelResize}
          onStagePanelTargetChanged={this._handleStagePanelTargetChanged}
          onPanelBack={this._handlePanelBack}
          onPanelOutsideClick={this._handlePanelOutsideClick}
          onPanelToolClick={this._handlePanelToolClick}
          onPaneTargetChanged={this._handlePaneTargetChanged}
          onResize={this._handleResize}
          onTabClick={this._handleTabClick}
          onTabDrag={this._handleTabDrag}
          onTabDragEnd={this._handleTabDragEnd}
          onTabDragStart={this._handleTabDragStart}
          onTargetChanged={this._handleTargetChanged}
          onToggleCollapse={this._handleStagePanelToggleCollapse}
          onToolClick={this._handleToolClick}
          onTooltipTimeout={this._handleTooltipTimeout}
          onWidgetResize={this._handleZoneResize}
          openWidget={this.state.openWidget}
          safeAreaInsets={this.state.safeAreaInsets}
          stagePanels={this.state.nineZone.nested}
          toastMessageKey={this.state.toastMessageKey}
          tools={this.state.tools}
          toolStore={this.state.toolStore}
          zonesMeasurerRef={this._zonesMeasurer}
        />
        {tabs.map((tab) => {
          const toolSettingsMode = tab.widget.id === 2 ? (tab.widget as ToolSettingsWidgetManagerProps).mode : ToolSettingsWidgetMode.Tab;
          return (
            <WidgetContentExample
              anchor={tab.widget.horizontalAnchor}
              isDisplayed={tab.widget.tabIndex === tab.id}
              key={`${tab.widget.id}_${tab.id}`}
              toolSettingsMode={toolSettingsMode}
              onChangeTheme={this._handleChangeTheme}
              onOpenActivityMessage={this._handleOpenActivityMessage}
              onOpenToastMessage={this._handleOpenToastMessage}
              onShowTooltip={this._handleShowTooltip}
              onToggleBottomMostPanel={this._handleToggleBottomMostPanel}
              onToggleFooterMode={this._handleToggleFooterMode}
              renderTo={this.state.widgetIdToContent[tab.widget.id]}
              tabIndex={tab.id}
              theme={this.state.theme}
              widgetId={tab.widget.id}
            />
          );
        })}
        <BackstageExample
          isOpen={this.state.isBackstageOpen}
          onClose={this._handleBackstageClose}
          safeAreaInsets={this.state.safeAreaInsets}
        />
      </>
    );
  }

  private getActiveTool(toolStore: ZonesPageState["toolStore"]): Tool | undefined {
    const ids = Object.keys(toolStore);
    for (const id of ids) {
      const tool = toolStore[id];
      if (isToolGroup(tool)) {
        const activeTool = toolStore[tool.activeToolId] as PanelTool;
        if (activeTool.isActive)
          return activeTool;
        continue;
      }
      if (tool.isActive)
        return tool;
    }
    return undefined;
  }

  private getToolWithOpenPanel(toolStore: ZonesPageState["toolStore"]): Tool | undefined {
    const toolId = Object.keys(toolStore).find((id) => {
      const tool = toolStore[id];
      return isToolGroup(tool) && tool.isOpen;
    });
    if (!toolId)
      return undefined;
    return toolStore[toolId];
  }

  private toggleIsDisabledForSomeTools(isDisabled: boolean, toolStore: ZonesPageState["toolStore"]): ZonesPageState["toolStore"] {
    return {
      ...toolStore,
      cube: {
        ...toolStore.cube,
        isDisabled,
      },
      browse: {
        ...toolStore.browse,
        isDisabled,
      },
      chat: {
        ...toolStore.chat,
        isDisabled,
      },
    };
  }

  private toggleIsHiddenForSomeTools(isHidden: boolean, toolStore: ZonesPageState["toolStore"]): ZonesPageState["toolStore"] {
    return {
      ...toolStore,
      validate: {
        ...toolStore.validate,
        isHidden,
      },
      d2: {
        ...toolStore.d2,
        isHidden,
      },
      clipboard: {
        ...toolStore.clipboard,
        isHidden,
      },
      document: {
        ...toolStore.document,
        isHidden,
      },
    };
  }

  private deactivateTool(toolId: string, state: ZonesPageState): ZonesPageState {
    const tool = state.toolStore[toolId];
    if (isToolGroup(tool) || !tool.isActive)
      return state;

    let toolStore = {
      ...state.toolStore,
      [toolId]: {
        ...tool,
        isActive: false,
      },
    };

    let nineZone = state.nineZone;
    switch (toolId) {
      case "toggleTools": {
        toolStore = this.toggleIsHiddenForSomeTools(false, toolStore);
        break;
      }
      case "toolSettings": {
        nineZone = this._nineZone.hideWidget(2, nineZone);
        break;
      }
      case "disableTools": {
        toolStore = this.toggleIsDisabledForSomeTools(false, toolStore);
        break;
      }
    }
    return {
      ...state,
      toolStore,
      nineZone,
    };
  }

  private activateTool(toolId: string, toolGroupId: ToolGroup["id"] | undefined, state: ZonesPageState): ZonesPageState {
    const activeTool = this.getActiveTool(state.toolStore);
    let newState = state;
    if (activeTool)
      newState = this.deactivateTool(activeTool.id, newState);

    let toolIdToActivate = toolId;
    const tool = state.toolStore[toolId];
    if (isToolGroup(tool)) {
      toolIdToActivate = tool.activeToolId;
    }

    if (activeTool && activeTool.id === toolIdToActivate) {
      return newState;
    }

    let nineZone = newState.nineZone;
    let toolStore = {
      ...newState.toolStore,
      [toolIdToActivate]: {
        ...newState.toolStore[toolIdToActivate],
        isActive: true,
      },
    };
    if (toolGroupId)
      toolStore = {
        ...toolStore,
        [toolGroupId]: {
          ...toolStore[toolGroupId],
          activeToolId: toolId,
        },
      };

    switch (toolIdToActivate) {
      case "toggleTools": {
        toolStore = this.toggleIsHiddenForSomeTools(true, toolStore);
        break;
      }
      case "toolSettings": {
        nineZone = this._nineZone.showWidget(2, nineZone);
        break;
      }
      case "disableTools": {
        toolStore = this.toggleIsDisabledForSomeTools(true, toolStore);
        break;
      }
      default: {
        // eslint-disable-next-line no-console
        console.log(`Activated: ${toolIdToActivate}`);
        break;
      }
    }

    return {
      ...newState,
      toolStore,
      nineZone,
    };
  }

  private closePanel(state: ZonesPageState): ZonesPageState {
    const tool = this.getToolWithOpenPanel(state.toolStore);
    if (!tool || !isToolGroup(tool) || !tool.isOpen)
      return state;

    return {
      ...state,
      toolStore: {
        ...state.toolStore,
        [tool.id]: {
          ...state.toolStore[tool.id],
          isOpen: false,
        },
      },
    };
  }

  private openPanel(toolId: string, state: ZonesPageState): ZonesPageState {
    const tool = state.toolStore[toolId];
    if (!isToolGroup(tool) || tool.isOpen)
      return state;

    return {
      ...state,
      toolStore: {
        ...state.toolStore,
        [toolId]: {
          ...state.toolStore[toolId],
          isOpen: true,
        },
      },
    };
  }

  private _handleOpenPanel = (toolId: Tool["id"]) => {
    this.setState((prevState) => {
      let state = prevState;
      state = this.closePanel(state);
      state = this.openPanel(toolId, state);
      if (state === prevState)
        return null;
      return state;
    });
  }

  private _handleToolClick = (toolId: string) => {
    this.setState((prevState) => {
      let state = prevState;
      state = this.closePanel(state);
      state = this.activateTool(toolId, undefined, state);
      return state;
    });
  }

  private _handlePanelOutsideClick = () => {
    this.setState((prevState) => this.closePanel(prevState));
  }

  private _handlePanelToolClick = ({ itemId, toolGroupId }: ToolbarItemGroupToolClickArgs) => {
    this.setState((prevState) => {
      let state = prevState;
      state = this.closePanel(state);
      state = this.activateTool(itemId, toolGroupId, state);
      return state;
    });
  }

  private _handleExpandPanelGroup = (toolId: string, trayId: string | undefined) => {
    this.setState((prevState) => {
      const tool = prevState.toolStore[toolId];
      if (!isToolGroup(tool))
        throw new TypeError();

      return {
        toolStore: {
          ...prevState.toolStore,
          [toolId]: {
            ...prevState.toolStore[toolId],
            backTrays: [...tool.backTrays, trayId],
          },
        },
      };
    });
  }

  private _handlePanelBack = (toolId: string) => {
    this.setState((prevState) => {
      const tool = prevState.toolStore[toolId];
      if (!isToolGroup(tool))
        throw new TypeError();

      const backTrays = tool.backTrays.slice(0, -1);
      return {
        toolStore: {
          ...prevState.toolStore,
          [toolId]: {
            ...prevState.toolStore[toolId],
            backTrays,
          },
        },
      };
    });
  }

  private _handleGetContainerSize = () => {
    return Rectangle.create(this._zoneBounds).getSize();
  }

  private _handleGetDisabledResizeHandles = (zoneId: WidgetZoneId) => {
    const manager = this._nineZone.getZonesManager();
    return manager.getDisabledResizeHandles(zoneId, this.state.nineZone.zones);
  }

  private _getDropTarget = (zoneId: WidgetZoneId) => {
    const zonesManager = this._nineZone.getZonesManager();
    return zonesManager.getDropTarget(zoneId, this.state.nineZone.zones);
  }

  private _getGhostOutlineBounds = (zoneId: WidgetZoneId) => {
    const zonesManager = this._nineZone.getZonesManager();
    return zonesManager.getGhostOutlineBounds(zoneId, this.state.nineZone.zones);
  }

  private _getWidgetContentRef = (widget: WidgetZoneId) => {
    const ref = this._widgetContentRefs.get(widget);
    if (ref)
      return ref;
    const newRef = (el: HTMLDivElement | null) => {
      this.setState((prevState) => ({
        widgetIdToContent: {
          ...prevState.widgetIdToContent,
          [widget]: el === null ? undefined : el,
        },
      }));
    };
    this._widgetContentRefs.set(widget, newRef);
    return newRef;
  }

  private _handleBackstageClose = () => {
    this.setState({ isBackstageOpen: false });
  }

  private _handleAppButtonClick = () => {
    this.setState({ isBackstageOpen: true });
  }

  private _handleTabClick = (widgetId: WidgetZoneId, tabIndex: number) => {
    this.setState((prevState) => {
      const nineZone = this._nineZone.handleWidgetTabClick(widgetId, tabIndex, prevState.nineZone);
      if (nineZone === prevState.nineZone)
        return null;
      return {
        nineZone,
      };
    });
  }

  private _handleTabDragEnd = () => {
    this.setState((prevState) => {
      const nineZone = this._nineZone.handleWidgetTabDragEnd(prevState.nineZone);
      if (nineZone === prevState.nineZone)
        return null;
      return {
        nineZone,
      };
    });
  }

  private _handleTabDragStart = (widgetId: WidgetZoneId, tabIndex: number, initialPosition: PointProps, widgetBounds: RectangleProps) => {
    this.setState((prevState) => {
      const nineZone = this._nineZone.handleWidgetTabDragStart({
        initialPosition,
        widgetBounds,
        widgetId,
        tabIndex,
      }, prevState.nineZone);
      if (nineZone === prevState.nineZone)
        return null;
      return {
        nineZone,
      };
    });

    if (widgetId === 8)
      this._handleTabDragEnd();
  }

  private _handleTargetChanged = (target: ZonesManagerTargetProps | undefined) => {
    this.setState((prevState) => {
      const zones = this._nineZone.getZonesManager().handleTargetChanged(target, prevState.nineZone.zones);
      if (zones === prevState.nineZone.zones)
        return null;
      return {
        nineZone: {
          ...prevState.nineZone,
          zones,
        },
      };
    });
  }

  private _handleToggleFooterMode = () => {
    this.setState((prevState) => {
      const zones = this._nineZone.getZonesManager().setIsInFooterMode(!prevState.nineZone.zones.isInFooterMode, prevState.nineZone.zones);
      const nineZone = zones === prevState.nineZone.zones ? prevState.nineZone : { ...prevState.nineZone, zones };
      const openWidget = FooterWidget.None;
      if (nineZone === prevState.nineZone && prevState.openWidget)
        return null;
      return {
        nineZone,
        openWidget,
      };
    });
  }

  private _handleResize = () => {
    if (!this._zonesMeasurer.current || !this._floatingZonesMeasurer.current)
      return;
    const zonesBounds = Rectangle.create(this._zonesMeasurer.current.getBoundingClientRect());
    let floatingZonesBounds = Rectangle.create(this._floatingZonesMeasurer.current.getBoundingClientRect());
    const offset = zonesBounds.topLeft().getOffsetTo(floatingZonesBounds.topLeft());
    floatingZonesBounds = floatingZonesBounds.setPosition(offset);
    this.setState((prevState) => {
      const zonesManager = this._nineZone.getZonesManager();
      let zones = prevState.nineZone.zones;
      zones = zonesManager.setZonesBounds(zonesBounds, zones);
      zones = zonesManager.setFloatingZonesBounds(floatingZonesBounds, zones);
      if (zones === prevState.nineZone.zones)
        return null;
      return {
        nineZone: {
          ...prevState.nineZone,
          zones,
        },
      };
    }, () => {
      this._zoneBounds = zonesBounds;
    });
  }

  private _handleChangeTheme = () => {
    this.setState((prevState) => {
      const theme = prevState.theme === "light" ? "dark" : "light";
      return {
        theme,
      };
    }, () => {
      document.documentElement.setAttribute("data-theme", this.state.theme);
    });
  }

  private _handleToggleBottomMostPanel = () => {
    this.setState((prevState) => {
      return {
        nineZone: {
          ...prevState.nineZone,
          nested: {
            ...prevState.nineZone.nested,
            panels: {
              ...prevState.nineZone.nested.panels,
              outer: {
                ...prevState.nineZone.nested.panels.outer,
                bottom: {
                  ...prevState.nineZone.nested.panels.outer.bottom,
                  isVisible: !prevState.nineZone.nested.panels.outer.bottom.isVisible,
                },
              },
            },
          },
        },
      };
    });
  }

  private _handleShowTooltip = () => {
    this.setState({ isTooltipVisible: true });
  }

  private _handleOpenActivityMessage = () => {
    this.setState({ message: VisibleMessage.Activity });
  }

  private _handleOpenToastMessage = () => {
    this.setState((prevState) => ({
      message: VisibleMessage.Toast,
      toastMessageKey: prevState.toastMessageKey + 1,
    }));
  }

  private _handleTooltipTimeout = () => {
    this.setState({ isTooltipVisible: false });
  }

  private _handleOpenWidgetChange = (openWidget: FooterWidget) => {
    this.setState({ openWidget });
  }

  private _handleHideMessage = () => {
    this.setState({ message: VisibleMessage.None });
  }

  private _handleStagePanelInitialize = (size: number, type: ExampleStagePanelType) => {
    const panel = getNestedStagePanel(type);
    this.setState((prevState) => {
      const nested = this._nineZone.getNestedPanelsManager().setSize(panel, size, prevState.nineZone.nested);
      if (nested === prevState.nineZone.nested)
        return null;
      return {
        nineZone: {
          ...prevState.nineZone,
          nested,
        },
      };
    });
  }

  private _handleStagePanelTargetChanged = (type: ExampleStagePanelType | undefined) => {
    let target;
    if (type !== undefined) {
      const panel = getNestedStagePanel(type);
      target = {
        panelId: panel.id,
        panelType: panel.type,
      };
    }
    this._nineZone.setPanelTarget(target);
  }

  private _handlePaneTargetChanged = (paneIndex: number | undefined, type: ExampleStagePanelType) => {
    const panel = getNestedStagePanel(type);
    this._nineZone.setPaneTarget(paneIndex === undefined ? undefined : {
      paneIndex,
      panelId: panel.id,
      panelType: panel.type,
    });
  }

  private _handleStagePanelToggleCollapse = (type: ExampleStagePanelType) => {
    const panel = getNestedStagePanel(type);
    this.setState((prevState) => {
      const prevPanels = prevState.nineZone.nested.panels[panel.id];
      const prevPanel = StagePanelsManager.getPanel(panel.type, prevPanels);
      const nested = this._nineZone.getNestedPanelsManager().setIsCollapsed(panel, !prevPanel.isCollapsed, prevState.nineZone.nested);
      if (nested === prevState.nineZone.nested)
        return null;

      return {
        nineZone: {
          ...prevState.nineZone,
          nested,
        },
      };
    });
  }
}

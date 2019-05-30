/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import * as React from "react";
import * as ReactDOM from "react-dom";
import rafSchedule, { ScheduleFn } from "raf-schd";
import { withTimeout, Button, ButtonType, ButtonProps, Omit, OmitChildrenProp, withOnOutsideClick } from "@bentley/ui-core";
import { Backstage } from "@src/backstage/Backstage";
import { BackstageItem } from "@src/backstage/Item";
import { BackstageSeparator } from "@src/backstage/Separator";
import { UserProfile } from "@src/backstage/UserProfile";
import { AppButton } from "@src/widget/tools/button/App";
import { Footer } from "@src/footer/Footer";
import { MessageCenterDialog } from "@src/footer/message-center/Dialog";
import { MessageCenter } from "@src/footer/message-center/Indicator";
import { MessageCenterMessage } from "@src/footer/message-center/Message";
import { MessageCenterTab } from "@src/footer/message-center/Tab";
import { SnapModePanel } from "@src/footer/snap-mode/Panel";
import { SnapMode } from "@src/footer/snap-mode/Indicator";
import { Snap } from "@src/footer/snap-mode/Snap";
import { ToolAssistance } from "@src/footer/tool-assistance/Indicator";
import { ToolAssistanceDialog } from "@src/footer/tool-assistance/Dialog";
import { ToolAssistanceItem } from "@src/footer/tool-assistance/Item";
import { ToolAssistanceSeparator } from "@src/footer/tool-assistance/Separator";
import { Message } from "@src/footer/message/Message";
import { MessageLayout } from "@src/footer/message/Layout";
import { Status } from "@src/footer/message/Status";
import { MessageButton } from "@src/footer/message/Button";
import { MessageProgress } from "@src/footer/message/Progress";
import { MessageHyperlink } from "@src/footer/message/Hyperlink";
import { TitleBarButton } from "@src/footer/dialog/Button";
import { Toast } from "@src/footer/message/Toast";
import { FooterPopup, FooterPopupContentType } from "@src/footer/Popup";
import { FooterSeparator } from "@src/footer/Separator";
import { NestedToolSettings } from "@src/widget/tool-settings/Nested";
import { ToolSettingsPopup } from "@src/widget/tool-settings/Popup";
import { ScrollableToolSettings } from "@src/widget/tool-settings/Scrollable";
import { ToolSettingsTab } from "@src/widget/tool-settings/Tab";
import { ToolSettings } from "@src/widget/ToolSettings";
import { ExpandableItem } from "@src/toolbar/item/expandable/Expandable";
import { Overflow } from "@src/toolbar/item/Overflow";
import { GroupColumn } from "@src/toolbar/item/expandable/group/Column";
import { GroupTool } from "@src/toolbar/item/expandable/group/tool/Tool";
import { GroupToolExpander } from "@src/toolbar/item/expandable/group/tool/Expander";
import { Group } from "@src/toolbar/item/expandable/group/Group";
import { NestedGroup } from "@src/toolbar/item/expandable/group/Nested";
import { HistoryIcon } from "@src/toolbar/item/expandable/history/Icon";
import { HistoryTray, History, DefaultHistoryManager } from "@src/toolbar/item/expandable/history/Tray";
import { Item } from "@src/toolbar/item/Item";
import { Toolbar, ToolbarPanelAlignment } from "@src/toolbar/Toolbar";
import { Scrollable } from "@src/toolbar/Scrollable";
import { Direction } from "@src/utilities/Direction";
import { PointProps, Point } from "@src/utilities/Point";
import { RectangleProps, Rectangle } from "@src/utilities/Rectangle";
import { Size, SizeProps } from "@src/utilities/Size";
import { WidgetContent } from "@src/widget/rectangular/Content";
import { ResizeHandle } from "@src/widget/rectangular/ResizeHandle";
import { TabSeparator } from "@src/widget/rectangular/tab/Separator";
import { TabGroup, HandleMode } from "@src/widget/rectangular/tab/Group";
import { Tab, TabMode } from "@src/widget/rectangular/tab/Tab";
import { Stacked, HorizontalAnchor, VerticalAnchor } from "@src/widget/Stacked";
import { Tools as ToolsWidget } from "@src/widget/Tools";
import { NineZone, getDefaultNineZoneProps, NineZoneProps, WidgetZoneIndex } from "@src/zones/state/NineZone";
import { DefaultStateManager } from "@src/zones/state/Manager";
import { WidgetProps, DraggingWidgetProps, Widget } from "@src/zones/state/Widget";
import { TargetType, TargetZoneProps } from "@src/zones/state/Target";
import { ZonePropsBase, DropTarget, StatusZoneManager, WidgetZone } from "@src/zones/state/Zone";
import { MergeTarget } from "@src/zones/target/Merge";
import { BackTarget } from "@src/zones/target/Back";
import { Zone } from "@src/zones/Zone";
import { Zones } from "@src/zones/Zones";
import { Outline } from "@src/zones/Outline";
import { Tooltip, offsetAndContainInContainer } from "@src/popup/Tooltip";
import { withContainIn } from "@src/base/WithContainIn";
import "./Zones.scss";

// tslint:disable-next-line:variable-name
const TooltipWithTimeout = withTimeout(Tooltip);
// tslint:disable-next-line:variable-name
const ToolGroupContained = withContainIn(withOnOutsideClick(Group, undefined, false));
// tslint:disable-next-line:variable-name
const NestedToolGroupContained = withContainIn(withOnOutsideClick(NestedGroup, undefined, false));

// tslint:disable-next-line:variable-name
const BlueButton = (props: ButtonProps & Omit<ButtonProps, "type">) => (
  <Button
    buttonType={ButtonType.Blue}
    {...props}
  />
);

// tslint:disable-next-line:variable-name
const HollowButton = (props: ButtonProps & Omit<ButtonProps, "type">) => (
  <Button
    buttonType={ButtonType.Hollow}
    {...props}
  />
);

interface ZoneTools {
  1: DirectionTools<Zone1HorizontalTools, Zone1VerticalTools>;
  3: DirectionTools<Zone3HorizontalTools, Zone3VerticalTools>;
}

interface HiddenZoneTools {
  1: DirectionTools<Zone1HorizontalTools, HiddenZone1VerticalTools>;
  3: DirectionTools<Tools, HiddenZone3VerticalTools>;
}

interface DirectionTools<THorizontal extends Tools = Tools, TVertical extends Tools = Tools> {
  horizontal: THorizontal;
  vertical: TVertical;
}

interface Zone1HorizontalTools extends Tools {
  disableTools: SimpleTool;
  toggleTools: SimpleTool;
  toolSettings: SimpleTool;
}

interface HiddenZone1VerticalTools extends Tools {
  cube: ToolGroup;
}

interface Zone1VerticalTools extends HiddenZone1VerticalTools {
  validate: ToolGroup;
}

interface Zone3HorizontalTools extends Tools {
  d2: ToolGroup;
  overflow: ToolGroup;
}

interface HiddenZone3VerticalTools extends Tools {
  channel: ToolGroup;
  chat: SimpleTool;
  browse: SimpleTool;
}

interface Zone3VerticalTools extends HiddenZone3VerticalTools {
  clipboard: ToolGroup;
  calendar: ToolGroup;
  chat2: SimpleTool;
  document: SimpleTool;
}

interface ToolLocation {
  zoneKey: keyof (ZoneTools);
  directionKey: keyof (DirectionTools);
  toolId: string;
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

interface HistoryItem {
  toolId: string;
  trayId: string;
  columnId: string;
  itemId: string;
}

interface ToolGroupItem {
  trayId?: string;
  isDisabled?: boolean;
}

interface ToolGroupColumn {
  items: { [id: string]: ToolGroupItem };
}

interface ToolGroupTray {
  title: string;
  columns: { [id: string]: ToolGroupColumn };
}

interface SimpleTool {
  id: string;
  isActive?: boolean;
  isDisabled?: boolean;
  isHidden?: boolean;
}

interface ToolGroup extends SimpleTool {
  trayId: string;
  backTrays: ReadonlyArray<string>;
  trays: { [id: string]: ToolGroupTray };
  direction: Direction;
  history: History<HistoryItem>;
  isExtended?: boolean;
  isOverflow?: boolean;
  isPanelOpen?: boolean;
}

type Tool = SimpleTool | ToolGroup;

interface Tools {
  [id: string]: Tool;
}

const isToolGroup = (tool: Tool): tool is ToolGroup => {
  return (tool as ToolGroup).trays !== undefined;
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
  animateOutTo: React.RefObject<HTMLElement>;
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
  animateToastMessageTo: React.RefObject<HTMLElement>;
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
  dropTarget: DropTarget;
  isInFooterMode: boolean;
  message: VisibleMessage;
  onHideMessage: () => void;
  onTargetChanged: TargetChangedHandler;
  onOpenWidgetChange: (widget: FooterWidget) => void;
  openWidget: FooterWidget;
  outlineBounds: RectangleProps | undefined;
  targetBounds: RectangleProps;
  toastMessageKey: React.Key;
}

interface StatusZoneExampleState {
  messageCenterTab: MessageCenterActiveTab;
}

class StatusZoneExample extends React.PureComponent<StatusZoneExampleProps, StatusZoneExampleState> {
  public readonly state: StatusZoneExampleState = {
    messageCenterTab: MessageCenterActiveTab.AllMessages,
  };

  private _messageCenterIndicator = React.createRef<HTMLDivElement>();
  private _messageCenterTarget = React.createRef<HTMLDivElement>();
  private _snapModeIndicator = React.createRef<HTMLDivElement>();
  private _snapModeTarget = React.createRef<HTMLDivElement>();
  private _toolAssistanceIndicator = React.createRef<HTMLDivElement>();
  private _toolAssistanceTarget = React.createRef<HTMLDivElement>();

  public render() {
    return (
      <>
        <Zone
          isInFooterMode={this.props.isInFooterMode}
          bounds={this.props.bounds}
        >
          <Footer
            isInFooterMode={this.props.isInFooterMode}
            messages={
              <FooterMessageExample
                toastMessageKey={this.props.toastMessageKey}
                animateToastMessageTo={this._messageCenterTarget}
                onHideMessage={this.props.onHideMessage}
                message={this.props.message}
              />
            }
          >
            <div ref={this._toolAssistanceTarget}>
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
              target={this._messageCenterTarget}
              isOpen={this.props.openWidget === FooterWidget.Messages}
              onClose={this._handlePopupClose}
              onOutsideClick={this._handleMessageCenterOutsideClick}
            >
              <MessageCenterDialog
                buttons={
                  <>
                    <TitleBarButton>
                      <i className={"icon icon-placeholder"} />
                    </TitleBarButton>
                    <TitleBarButton onClick={this._handlePopupClose}>
                      <i className={"icon icon-close"} />
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
                    <MessageCenterMessage icon={<i className={"icon icon-status-success nzdemo-success"} />}>
                      Document saved successfully.
                    </MessageCenterMessage>
                    <MessageCenterMessage icon={<i className={"icon icon-clock nzdemo-progress"} />}>
                      <span>Downloading required assets.</span>
                      <br />
                      <i><small>75% complete</small></i>
                    </MessageCenterMessage>
                    <MessageCenterMessage icon={<i className={"icon icon-status-rejected nzdemo-error"} />}>
                      <span>Cannot attach reference.</span>
                      <br />
                      <i><u><small>Details...</small></u></i>
                    </MessageCenterMessage>
                    <MessageCenterMessage icon={<i className={"icon icon-status-warning nzdemo-warning"} />}>
                      Missing 10 fonts. Replaces with Arial.
                      </MessageCenterMessage>
                    <MessageCenterMessage icon={<i className={"icon icon-star nzdemo-favorite"} />}>
                      Your document has been favorited by 5 people in the...
                    </MessageCenterMessage>
                    <MessageCenterMessage icon={<i className={"icon icon-status-success nzdemo-success"} />}>
                      Navigator has successfully updated
                    </MessageCenterMessage>
                  </> :
                  <>
                    <MessageCenterMessage icon={<i className={"icon icon-status-rejected nzdemo-error"} />}>
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
              targetRef={this._messageCenterTarget}
            >
              9+
            </MessageCenter>
            {this.props.isInFooterMode && <FooterSeparator />}
            <div ref={this._snapModeTarget}>
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
          zoneIndex={StatusZoneManager.id}
          dropTarget={this.props.dropTarget}
          onTargetChanged={this.props.onTargetChanged}
        />
        {this.props.outlineBounds &&
          <Outline bounds={this.props.outlineBounds} />
        }
        <FooterPopup
          isOpen={this.props.openWidget === FooterWidget.ToolAssistance}
          onClose={this._handlePopupClose}
          onOutsideClick={this._handleToolAssistanceOutsideClick}
          target={this._toolAssistanceTarget}
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
          target={this._snapModeTarget}
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
    this.setState(() => ({
      messageCenterTab: MessageCenterActiveTab.AllMessages,
    }));
  }

  private _handleProblemsTabClick = () => {
    this.setState(() => ({
      messageCenterTab: MessageCenterActiveTab.Problems,
    }));
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

interface FloatingZoneWidgetProps {
  bounds: RectangleProps;
  contentRef: React.RefObject<HTMLDivElement>;
  draggingWidget: DraggingWidgetProps | undefined;
  horizontalAnchor: HorizontalAnchor;
  onResize: (zoneId: WidgetZoneIndex, x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => void;
  onTabClick: (widgetId: WidgetZoneIndex, tabId: number) => void;
  onTabDragStart: (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, widgetOffset: PointProps) => void;
  onTabDragEnd: () => void;
  onTabDrag: (dragged: PointProps) => void;
  verticalAnchor: VerticalAnchor;
  zone: ZonePropsBase;
}

class FloatingZoneWidget extends React.PureComponent<FloatingZoneWidgetProps> {
  private _widget = React.createRef<Stacked>();

  public render() {
    const isOpen = this.props.zone.widgets.some((w) => w.tabIndex >= 0);
    const isDragged = this.props.draggingWidget && this.props.draggingWidget.id === this.props.zone.id;
    return (
      <Zone bounds={this.props.bounds}>
        <Stacked
          contentRef={this.props.contentRef}
          fillZone={this.props.zone.isLayoutChanged}
          horizontalAnchor={this.props.horizontalAnchor}
          isDragged={isDragged}
          isFloating={this.props.zone.floating ? true : false}
          isOpen={isOpen}
          onResize={this._handleResize}
          ref={this._widget}
          tabs={
            <FloatingZoneTabs
              anchor={this.props.horizontalAnchor}
              draggingWidget={this.props.draggingWidget}
              isOpen={isOpen}
              onTabClick={this.props.onTabClick}
              onTabDragStart={this._handleTabDragStart}
              onTabDragEnd={this.props.onTabDragEnd}
              onTabDrag={this.props.onTabDrag}
              zone={this.props.zone}
            />
          }
          verticalAnchor={this.props.verticalAnchor}
        />
      </Zone >
    );
  }

  private _handleResize = (x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => {
    this.props.onResize(this.props.zone.id, x, y, handle, filledHeightDiff);
  }

  private _handleTabDragStart = (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, firstTabBounds: RectangleProps) => {
    if (!this._widget.current)
      return;

    const firstTab = Rectangle.create(firstTabBounds).topLeft();
    const widget = Rectangle.create(this._widget.current.getBounds()).topLeft();
    const offset = widget.getOffsetTo(firstTab);
    this.props.onTabDragStart(widgetId, tabId, initialPosition, offset);
  }
}

interface FloatingZoneTabsProps {
  anchor: HorizontalAnchor;
  draggingWidget: DraggingWidgetProps | undefined;
  isOpen: boolean;
  onTabClick: (widgetId: WidgetZoneIndex, tabId: number) => void;
  onTabDragStart: (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, firstTabBounds: RectangleProps) => void;
  onTabDragEnd: () => void;
  onTabDrag: (dragged: PointProps) => void;
  zone: ZonePropsBase;
}

class FloatingZoneTabs extends React.PureComponent<FloatingZoneTabsProps> {
  public render() {
    const tabs: JSX.Element[] = [];
    let i = -1;

    for (const widget of this.props.zone.widgets) {
      i++;
      const widgetTabs = (
        <FloatingZoneWidgetTabs
          key={widget.id}
          anchor={this.props.anchor}
          draggingWidget={this.props.draggingWidget}
          isOpen={this.props.isOpen}
          isStacked={this.props.zone.widgets.length > 1}
          onTabClick={this.props.onTabClick}
          onTabDragStart={this.props.onTabDragStart}
          onTabDragEnd={this.props.onTabDragEnd}
          onTabDrag={this.props.onTabDrag}
          widget={widget}
        />
      );

      if (i !== 0)
        tabs.push(<TabSeparator key={`separator_${i}`} />);
      tabs.push(widgetTabs);
    }

    return tabs;
  }
}

interface FloatingZoneWidgetTabsProps {
  anchor: HorizontalAnchor;
  draggingWidget: DraggingWidgetProps | undefined;
  isOpen: boolean;
  isStacked: boolean;
  onTabClick: (widgetId: WidgetZoneIndex, tabId: number) => void;
  onTabDragStart: (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, firstTabBounds: RectangleProps) => void;
  onTabDragEnd: () => void;
  onTabDrag: (dragged: PointProps) => void;
  widget: WidgetProps;
}

class FloatingZoneWidgetTabs extends React.PureComponent<FloatingZoneWidgetTabsProps> {
  private _firstTab = React.createRef<Tab>();

  private getTabHandleMode() {
    if (this.props.draggingWidget && this.props.draggingWidget.id === this.props.widget.id && this.props.draggingWidget.isUnmerge)
      return HandleMode.Visible;

    if (this.props.isStacked)
      return HandleMode.Hovered;

    return HandleMode.Timedout;
  }

  private getTab(tabId: number, mode: TabMode, lastPosition: PointProps | undefined) {
    return (
      <FloatingZoneWidgetTab
        anchor={this.props.anchor}
        lastPosition={lastPosition}
        mode={mode}
        onClick={this.props.onTabClick}
        onDragStart={this._handleDragStart}
        onDragEnd={this.props.onTabDragEnd}
        onDrag={this.props.onTabDrag}
        tabId={tabId}
        tab={tabId === 1 ? this._firstTab : undefined}
        widgetId={this.props.widget.id}
      />
    );
  }

  private _handleDragStart = (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps) => {
    if (!this._firstTab.current)
      return;

    const bounds = this._firstTab.current.getBounds();
    this.props.onTabDragStart(widgetId, tabId, initialPosition, bounds);
  }

  public render() {
    const lastPosition = this.props.draggingWidget && this.props.draggingWidget.id === this.props.widget.id ?
      this.props.draggingWidget.lastPosition : undefined;
    const tabIndex = this.props.draggingWidget ? this.props.draggingWidget.tabIndex : -1;
    const mode1 = !this.props.isOpen ? TabMode.Closed : this.props.widget.tabIndex === 1 ? TabMode.Active : TabMode.Open;
    const mode2 = !this.props.isOpen ? TabMode.Closed : this.props.widget.tabIndex === 2 ? TabMode.Active : TabMode.Open;
    const lastPosition1 = tabIndex === 1 ? lastPosition : undefined;
    const lastPosition2 = tabIndex === 2 ? lastPosition : undefined;
    const handleMode = this.getTabHandleMode();
    switch (this.props.widget.id) {
      case 4: {
        return (
          <TabGroup
            anchor={this.props.anchor}
            handle={handleMode}
          >
            {this.getTab(1, mode1, lastPosition1)}
            {this.getTab(2, mode2, lastPosition2)}
          </TabGroup>
        );
      }
      case 6: {
        return this.getTab(1, mode1, lastPosition1);
      }
      case 7: {
        return this.getTab(1, mode1, lastPosition1);
      }
      case 8: {
        return this.getTab(1, mode1, lastPosition1);
      }
      case 9: {
        return (
          <TabGroup
            anchor={this.props.anchor}
            handle={handleMode}
          >
            {this.getTab(1, mode1, lastPosition1)}
            {this.getTab(2, mode2, lastPosition2)}
          </TabGroup>
        );
      }
    }
    return null;
  }
}

interface FloatingZoneWidgetTabProps {
  anchor: HorizontalAnchor;
  lastPosition: PointProps | undefined;
  mode: TabMode;
  onClick: (widgetId: WidgetZoneIndex, tabId: number) => void;
  onDragStart: (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps) => void;
  onDragEnd: () => void;
  onDrag: (dragged: PointProps) => void;
  tabId: number;
  tab?: React.RefObject<Tab>;
  widgetId: WidgetZoneIndex;
}

class FloatingZoneWidgetTab extends React.PureComponent<FloatingZoneWidgetTabProps> {
  public render() {
    return (
      <Tab
        anchor={this.props.anchor}
        lastPosition={this.props.lastPosition}
        mode={this.props.mode}
        onClick={this._handleClick}
        onDragStart={this._handleDragStart}
        onDragEnd={this.props.onDragEnd}
        onDrag={this.props.onDrag}
        ref={this.props.tab}
      >
        {placeholderIcon}
      </Tab>
    );
  }

  private _handleClick = () => {
    this.props.onClick(this.props.widgetId, this.props.tabId);
  }

  private _handleDragStart = (initialPosition: PointProps) => {
    this.props.onDragStart(this.props.widgetId, this.props.tabId, initialPosition);
  }
}

type TargetChangedHandler = (target: TargetZoneProps | undefined) => void;

interface TargetExampleProps {
  bounds: RectangleProps;
  dropTarget: DropTarget;
  zoneIndex: WidgetZoneIndex;
  onTargetChanged: TargetChangedHandler;
}

class ZoneTargetExample extends React.PureComponent<TargetExampleProps> {
  public render() {
    return (
      <Zone
        bounds={this.props.bounds}
      >
        {this.props.dropTarget === DropTarget.Merge &&
          <MergeTarget
            onTargetChanged={this._handleMergeTargetChanged}
          />
        }
        {this.props.dropTarget === DropTarget.Back &&
          <BackTarget
            onTargetChanged={this._handleBackTargetChanged}
            zoneIndex={this.props.zoneIndex}
          />
        }
      </Zone>
    );
  }

  private _handleMergeTargetChanged = (isTargeted: boolean) => {
    this.onTargetChanged(isTargeted, TargetType.Merge);
  }

  private _handleBackTargetChanged = (isTargeted: boolean) => {
    this.onTargetChanged(isTargeted, TargetType.Back);
  }

  private onTargetChanged(isTargeted: boolean, type: TargetType) {
    isTargeted ?
      this.props.onTargetChanged({
        zoneId: this.props.zoneIndex,
        type,
      }) :
      this.props.onTargetChanged(undefined);
  }
}

interface ToolSettingsWidgetProps {
  mode: ToolSettingsMode;
  onTabClick: () => void;
}

interface ToolSettingsWidgetState {
  isNestedPopupOpen: boolean;
  isPopupOpen: boolean;
}

class ToolSettingsWidget extends React.PureComponent<ToolSettingsWidgetProps, ToolSettingsWidgetState> {
  private _toggle = React.createRef<HTMLButtonElement>();
  private _nestedToggle = React.createRef<HTMLButtonElement>();

  public readonly state: ToolSettingsWidgetState = {
    isNestedPopupOpen: false,
    isPopupOpen: false,
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
          <TitleBarButton
            onClick={this.props.onTabClick}
            title="Minimize"
          >
            <i className={"icon icon-chevron-up"} />
          </TitleBarButton>
        }
        title="Tool Settings"
      >
        <button
          onClick={this._handleToggleClick}
          ref={this._toggle}
        >
          Toggle
        </button>
        <ToolSettingsPopup
          isOpen={this.state.isPopupOpen}
          onClose={this._handleCloseTogglePopup}
          target={this._toggle}
        >
          <button
            onClick={this._handleNestedToggleClick}
            ref={this._nestedToggle}
          >
            Nested Toggle
          </button>
        </ToolSettingsPopup>
        <ToolSettingsPopup
          isOpen={this.state.isNestedPopupOpen}
          onClose={this._handleCloseNestedTogglePopup}
          target={this._nestedToggle}
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
      </ToolSettings>
    );
  }

  private _handleToggleClick = () => {
    this.setState((prevState) => ({
      isNestedPopupOpen: false,
      isPopupOpen: !prevState.isPopupOpen,
    }));
  }

  private _handleCloseTogglePopup = () => {
    this.setState(() => ({
      isNestedPopupOpen: false,
      isPopupOpen: false,
    }));
  }

  private _handleNestedToggleClick = () => {
    this.setState((prevState) => ({
      isNestedPopupOpen: !prevState.isNestedPopupOpen,
    }));
  }

  private _handleCloseNestedTogglePopup = () => {
    this.setState(() => ({
      isNestedPopupOpen: false,
    }));
  }

  private _handleBackClick = () => {
    this.setState(() => ({
      isNestedPopupOpen: false,
    }));
  }
}

interface TooltipExampleProps {
  containerSize: SizeProps;
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
    this.setState((prevState) => {
      const tooltipBounds = Rectangle.createFromSize(this._tooltipSize).offset(this._mousePosition);
      const tooltipPosition = offsetAndContainInContainer(tooltipBounds, this.props.containerSize);
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

    this._canvas.current.width = window.innerWidth;
    this._canvas.current.height = window.innerHeight;
    this.drawRandomCircles(ctx, this._canvas.current.width, this._canvas.current.height);

    this._ctx = ctx;
    window.addEventListener("resize", this._handleWindowResize);
  }

  public componentWillUnmount() {
    window.removeEventListener("resize", this._handleWindowResize, true);
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

    const width = window.innerWidth;
    const height = window.innerHeight;
    this._canvas.current.width = width;
    this._canvas.current.height = height;
    this.drawRandomCircles(this._ctx, width, height);
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
        <br />
        <BlueButton
          onClick={this.props.onShowTooltip}
        >
          Show Tooltip
        </BlueButton>
        <br />
        <br />
        <BlueButton
          onClick={this.props.onToggleFooterMode}
        >
          Change Footer Mode
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
  renderTo: React.RefObject<Element>;
  tabIndex: number;
  widgetId: WidgetZoneIndex;
}

class WidgetContentExample extends React.PureComponent<WidgetContentExampleProps> {
  private _content = document.createElement("span");
  private _widgetContent = React.createRef<WidgetContent>();

  public componentDidMount() {
    if (!this.props.renderTo.current)
      return;
    this._content.style.display = this.props.isDisplayed ? null : "none";
    this.props.renderTo.current.appendChild(this._content);
  }

  public componentDidUpdate(prevProps: WidgetContentExampleProps) {
    if (this.props.isDisplayed !== prevProps.isDisplayed) {
      this._content.style.display = this.props.isDisplayed ? null : "none";
    }

    if (prevProps.renderTo === this.props.renderTo)
      return;

    if (!this.props.renderTo.current)
      return;

    this.props.renderTo.current.appendChild(this._content);
    this._widgetContent.current && this._widgetContent.current.forceUpdate();
  }

  public render() {
    let content: React.ReactNode;
    switch (this.props.widgetId) {
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
          case 1: {
            content = (
              <Widget9Tab1Content />
            );
            break;
          }
          case 2: {
            content = "Hello world 2!";
            break;
          }
        }
        break;
      }
    }
    return ReactDOM.createPortal(<WidgetContent
      anchor={this.props.anchor}
      content={content}
      ref={this._widgetContent}
    />, this._content);
  }
}

interface ToolbarItemProps {
  history: React.ReactNode | undefined;
  onClick: (toolId: string) => void;
  onIsHistoryExtendedChange: (toolId: string, isExtended: boolean) => void;
  panel: React.ReactNode | undefined;
  tool: Tool;
}

class ToolbarItem extends React.PureComponent<ToolbarItemProps> {
  public render() {
    const { onIsHistoryExtendedChange, tool, ...props } = this.props;
    if (!isToolGroup(tool))
      return (
        <Item
          {...props}
          icon={placeholderIcon}
          isActive={tool.isActive}
          isDisabled={tool.isDisabled}
          onClick={this._handleClick}
        />
      );

    if (tool.isOverflow)
      return (
        <Overflow
          {...props}
          isActive={tool.isActive}
          isDisabled={tool.isDisabled}
          onClick={this._handleClick}
        />
      );

    return (
      <ExpandableItem
        {...props}
        isActive={tool.isActive}
        isDisabled={tool.isDisabled}
        onIsHistoryExtendedChange={this._handleIsHistoryExtendedChange}
      >
        <Item
          icon={placeholderIcon}
          isActive={tool.isActive}
          isDisabled={tool.isDisabled}
          onClick={this._handleClick}
        />
      </ExpandableItem>
    );
  }

  private _handleClick = () => {
    this.props.onClick(this.props.tool.id);
  }

  private _handleIsHistoryExtendedChange = (isExtended: boolean) => {
    this.props.onIsHistoryExtendedChange(this.props.tool.id, isExtended);
  }
}

interface ToolbarItemHistoryTrayProps {
  onHistoryItemClick: (item: HistoryItem) => void;
  onIsHistoryExtendedChange: (toolId: string, isExtended: boolean) => void;
  tool: ToolGroup;
}

class ToolbarItemHistoryTray extends React.PureComponent<ToolbarItemHistoryTrayProps> {
  public render() {
    return (
      <HistoryTray
        direction={this.props.tool.direction}
        isExtended={this.props.tool.isExtended}
        onIsHistoryExtendedChange={this._handleIsHistoryExtendedChange}
        items={
          this.props.tool.history.map((entry) => {
            return (
              <ToolbarItemHistoryItem
                history={entry.item}
                key={entry.key}
                onClick={this._handleHistoryItemClick}
              />
            );
          })
        }
      />
    );
  }

  private _handleHistoryItemClick = (item: HistoryItem) => {
    this.props.onHistoryItemClick(item);
  }

  private _handleIsHistoryExtendedChange = (isExtended: boolean) => {
    this.props.onIsHistoryExtendedChange(this.props.tool.id, isExtended);
  }
}

interface ToolbarItemHistoryItemProps {
  history: HistoryItem;
  onClick: (history: HistoryItem) => void;
}

class ToolbarItemHistoryItem extends React.PureComponent<ToolbarItemHistoryItemProps> {
  public render() {
    return (
      <HistoryIcon
        onClick={this._handleClick}
      >
        {placeholderIcon}
      </HistoryIcon>
    );
  }

  private _handleClick = () => {
    this.props.onClick(this.props.history);
  }
}

interface ToolbarItemPanelProps {
  onExpandGroup: (toolId: string, trayId: string | undefined) => void;
  onOutsideClick: (toolId: string) => void;
  onToolClick: (args: ToolbarItemGroupToolClickArgs) => void;
  onBack: (toolId: string) => void;
  tool: ToolGroup;
}

interface ToolbarItemGroupToolClickArgs extends GroupColumnToolClickArgs {
  toolId: string;
}

class ToolbarItemPanel extends React.PureComponent<ToolbarItemPanelProps> {
  public render() {
    const tray = this.props.tool.trays[this.props.tool.trayId];
    const columns = (
      Object.keys(tray.columns).map((columnId) => {
        const column = tray.columns[columnId];
        return (
          <GroupColumn key={columnId}>
            {Object.keys(column.items).map((itemId) => {
              const item = column.items[itemId];
              if (item.trayId)
                return (
                  <GroupColumnExpander
                    key={itemId}
                    isDisabled={item.isDisabled || false}
                    label={itemId}
                    onClick={this._handleExpanderClick}
                    trayId={item.trayId}
                  />
                );
              return (
                <GroupColumnTool
                  columnId={columnId}
                  isDisabled={item.isDisabled || false}
                  itemId={itemId}
                  key={itemId}
                  label={itemId}
                  onClick={this._handleGroupColumnToolClick}
                  trayId={(this.props.tool as ToolGroup).trayId}
                />
              );
            })}
          </GroupColumn>
        );
      })
    );

    if (this.props.tool.backTrays.length > 0)
      return (
        <NestedToolGroupContained
          columns={columns}
          onBack={this._handleBack}
          onOutsideClick={this._handleOutsideClick}
          title={tray.title}
        />
      );

    return (
      <ToolGroupContained
        columns={columns}
        onOutsideClick={this._handleOutsideClick}
        title={tray.title}
      />
    );
  }

  private _handleBack = () => {
    this.props.onBack(this.props.tool.id);
  }

  private _handleGroupColumnToolClick = (args: GroupColumnToolClickArgs) => {
    this.props.onToolClick({ ...args, toolId: this.props.tool.id });
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
  label: string;
  onClick: (trayId: string) => void;
  trayId: string;
}

class GroupColumnExpander extends React.PureComponent<GroupColumnExpanderProps> {
  public render() {
    return (
      <GroupToolExpander
        label={this.props.label}
        icon={placeholderIcon}
        onClick={this._handleClick}
        isDisabled={this.props.isDisabled}
      />
    );
  }

  private _handleClick = () => {
    this.props.onClick(this.props.trayId);
  }
}

interface GroupColumnToolProps {
  columnId: string;
  isDisabled: boolean;
  itemId: string;
  label: string;
  onClick: (args: GroupColumnToolClickArgs) => void;
  trayId: string;
}

interface GroupColumnToolClickArgs {
  columnId: string;
  itemId: string;
  trayId: string;
}

class GroupColumnTool extends React.PureComponent<GroupColumnToolProps> {
  public render() {
    return (
      <GroupTool
        label={this.props.label}
        onClick={this._handleClick}
        icon={placeholderIcon}
        isDisabled={this.props.isDisabled}
      />
    );
  }

  private _handleClick = () => {
    const args: GroupColumnToolClickArgs = {
      columnId: this.props.columnId,
      itemId: this.props.itemId,
      trayId: this.props.trayId,
    };
    this.props.onClick(args);
  }
}

interface Zone1Props {
  bounds: RectangleProps;
  horizontalTools: Tools;
  onAppButtonClick: () => void;
  onHistoryItemClick: (item: HistoryItem) => void;
  onIsHistoryExtendedChange: (toolId: string, isExtended: boolean) => void;
  onOpenPanelGroup: (toolId: string, trayId: string | undefined) => void;
  onPanelBack: (toolId: string) => void;
  onPanelOutsideClick: (toolId: string) => void;
  onPanelToolClick: (args: ToolbarItemGroupToolClickArgs) => void;
  onToolClick: (toolId: string) => void;
  verticalTools: Tools;
}

class Zone1 extends React.PureComponent<Zone1Props> {
  private _appButton = (
    <AppButton
      icon={<i className="icon icon-home" />}
      onClick={this.props.onAppButtonClick}
    />
  );

  public render() {
    return (
      <Zone
        bounds={this.props.bounds}
      >
        <ToolsWidget
          button={this._appButton}
          horizontalToolbar={
            getNumberOfVisibleTools(this.props.horizontalTools) > 0 &&
            <ToolZoneToolbar
              expandsTo={Direction.Bottom}
              onHistoryItemClick={this.props.onHistoryItemClick}
              onIsHistoryExtendedChange={this.props.onIsHistoryExtendedChange}
              onOpenPanelGroup={this.props.onOpenPanelGroup}
              onPanelBack={this.props.onPanelBack}
              onPanelOutsideClick={this.props.onPanelOutsideClick}
              onPanelToolClick={this.props.onPanelToolClick}
              onToolClick={this.props.onToolClick}
              panelAlignment={ToolbarPanelAlignment.Start}
              tools={this.props.horizontalTools}
            />
          }
          verticalToolbar={
            getNumberOfVisibleTools(this.props.verticalTools) > 0 &&
            <ToolZoneToolbar
              expandsTo={Direction.Right}
              onHistoryItemClick={this.props.onHistoryItemClick}
              onIsHistoryExtendedChange={this.props.onIsHistoryExtendedChange}
              onOpenPanelGroup={this.props.onOpenPanelGroup}
              onPanelBack={this.props.onPanelBack}
              onPanelOutsideClick={this.props.onPanelOutsideClick}
              onPanelToolClick={this.props.onPanelToolClick}
              onToolClick={this.props.onToolClick}
              panelAlignment={ToolbarPanelAlignment.Start}
              tools={this.props.verticalTools}
            />
          }
        />
      </Zone>
    );
  }
}

interface Zone3Props extends Omit<Zone1Props, "onAppButtonClick"> {
  onToolbarScroll: () => void;
}

class Zone3 extends React.PureComponent<Zone3Props> {
  public render() {
    return (
      <Zone
        bounds={this.props.bounds}
      >
        <ToolsWidget
          isNavigation
          horizontalToolbar={
            getNumberOfVisibleTools(this.props.horizontalTools) > 0 &&
            <ToolZoneToolbar
              expandsTo={Direction.Bottom}
              onHistoryItemClick={this.props.onHistoryItemClick}
              onIsHistoryExtendedChange={this.props.onIsHistoryExtendedChange}
              onOpenPanelGroup={this.props.onOpenPanelGroup}
              onPanelBack={this.props.onPanelBack}
              onPanelOutsideClick={this.props.onPanelOutsideClick}
              onPanelToolClick={this.props.onPanelToolClick}
              onToolClick={this.props.onToolClick}
              panelAlignment={ToolbarPanelAlignment.End}
              tools={this.props.horizontalTools}
            />
          }
          verticalToolbar={
            getNumberOfVisibleTools(this.props.verticalTools) > 0 &&
            <ToolZoneScrollableToolbar
              expandsTo={Direction.Left}
              onHistoryItemClick={this.props.onHistoryItemClick}
              onIsHistoryExtendedChange={this.props.onIsHistoryExtendedChange}
              onOpenPanelGroup={this.props.onOpenPanelGroup}
              onPanelBack={this.props.onPanelBack}
              onPanelOutsideClick={this.props.onPanelOutsideClick}
              onPanelToolClick={this.props.onPanelToolClick}
              onScroll={this.props.onToolbarScroll}
              onToolClick={this.props.onToolClick}
              panelAlignment={ToolbarPanelAlignment.Start}
              tools={this.props.verticalTools}
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
  onHistoryItemClick: (item: HistoryItem) => void;
  onIsHistoryExtendedChange: (toolId: string, isExtended: boolean) => void;
  onOpenPanelGroup: (toolId: string, trayId: string | undefined) => void;
  onPanelBack: (toolId: string) => void;
  onPanelOutsideClick: (toolId: string) => void;
  onPanelToolClick: (args: ToolbarItemGroupToolClickArgs) => void;
  onToolClick: (toolId: string) => void;
  panelAlignment: ToolbarPanelAlignment;
  tools: Tools;
}

class ToolZoneToolbar extends React.PureComponent<ToolZoneToolbarProps> {
  public static readonly defaultProps = {
    // tslint:disable-next-line:space-before-function-paren object-literal-shorthand
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
    const items = Object.keys(this.props.tools).reduce((acc, toolId) => {
      const tool = this.props.tools[toolId];
      if (tool.isHidden)
        return acc;

      const panel = isToolGroup(tool) && tool.isPanelOpen ? (
        <ToolbarItemPanel
          key={tool.id}
          onBack={this.props.onPanelBack}
          onExpandGroup={this.props.onOpenPanelGroup}
          onOutsideClick={this.props.onPanelOutsideClick}
          onToolClick={this.props.onPanelToolClick}
          tool={tool}
        />
      ) : undefined;

      const history = isToolGroup(tool) &&
        !tool.isPanelOpen &&
        tool.history.length > 0 ? (
          <ToolbarItemHistoryTray
            key={tool.id}
            onHistoryItemClick={this.props.onHistoryItemClick}
            onIsHistoryExtendedChange={this.props.onIsHistoryExtendedChange}
            tool={tool}
          />
        ) : undefined;

      const item = (
        <ToolbarItem
          history={history}
          key={tool.id}
          onClick={this.props.onToolClick}
          onIsHistoryExtendedChange={this.props.onIsHistoryExtendedChange}
          panel={panel}
          tool={tool}
        />
      );

      acc.push(item);
      return acc;
    }, new Array<React.ReactNode>());
    return this.props.children(items);
  }
}

interface ScrollableToolbarProps extends OmitChildrenProp<ToolZoneToolbarProps> {
  onScroll: () => void;
}

class ToolZoneScrollableToolbar extends React.PureComponent<ScrollableToolbarProps> {
  public render() {
    const { onScroll, ...props } = this.props;
    return (
      <ToolZoneToolbar
        {...props}
      >
        {this._renderScrollableToolbar}
      </ToolZoneToolbar>
    );
  }

  private _renderScrollableToolbar = (items: React.ReactNode): React.ReactNode => {
    const { children, ...props } = this.props;
    return (
      <Scrollable
        items={items}
        {...props}
      />
    );
  }
}

interface BackstageItemExampleProps {
  id: number;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick: (id: number) => void;
}

class BackstageItemExample extends React.PureComponent<BackstageItemExampleProps> {
  public render() {
    return (
      <BackstageItem
        icon={<i className="icon icon-placeholder" />}
        isActive={this.props.isActive}
        isDisabled={this.props.isDisabled}
        onClick={this._handleClick}
      >
        {`Item ${this.props.id}`}
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
}

interface BackstageExampleState {
  activeItem: number;
}

class BackstageExample extends React.PureComponent<BackstageExampleProps, BackstageExampleState> {
  public readonly state = {
    activeItem: 0,
  };

  public render() {
    return (
      <Backstage
        header={
          <UserProfile
            color="#85a9cf"
            initials="NZ"
          >
            9-Zone
          </UserProfile>
        }
        isOpen={this.props.isOpen}
        onClose={this.props.onClose}
      >
        <BackstageItemExample
          id={0}
          isActive={this.state.activeItem === 0}
          onClick={this._handleItemClick}
        />
        <BackstageItemExample
          id={1}
          isActive={this.state.activeItem === 1}
          onClick={this._handleItemClick}
          isDisabled
        />
        <BackstageItemExample
          id={2}
          isActive={this.state.activeItem === 2}
          onClick={this._handleItemClick}
        />
        <BackstageSeparator />
        <BackstageItemExample
          id={3}
          isActive={this.state.activeItem === 3}
          onClick={this._handleItemClick}
        />
        <BackstageItemExample
          id={4}
          isActive={this.state.activeItem === 4}
          onClick={this._handleItemClick}
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

type WidgetTabDragFn = (dragged: PointProps) => void;
type ZoneResizeFn = (zoneId: WidgetZoneIndex, x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => void;

const placeholderIcon = (
  <i className="icon icon-placeholder" />
);

const getNumberOfVisibleTools = (tools: Tools) => {
  return Object.keys(tools).reduce<number>((acc, toolId) => {
    const tool = tools[toolId];
    if (tool.isHidden)
      return acc;
    return acc + 1;
  }, 0);
};

const getTabCount = (zone: WidgetZoneIndex): number => {
  switch (zone) {
    case 4:
      return 2;
    case 6:
      return 1;
    case 7:
      return 1;
    case 9:
      return 2;
  }
  return 0;
};

const hiddenZoneTools: HiddenZoneTools = {
  1: {
    horizontal: {
      disableTools: {
        id: "disableTools",
      },
      toggleTools: {
        id: "toggleTools",
      },
      toolSettings: {
        id: "toolSettings",
        isActive: true,
      },
    },
    vertical: {
      cube: {
        id: "cube",
        trayId: "tray1",
        backTrays: [],
        trays: {
          tray1: {
            title: "Tools",
            columns: {
              0: {
                items: {
                  Test1: {
                  },
                  Test2123123: {
                    isDisabled: true,
                  },
                  Test3: {
                    trayId: "tray2",
                  },
                  Test4: {
                  },
                  Test5: {
                    trayId: "disabled",
                    isDisabled: true,
                  },
                  Test6: {
                  },
                  Test7: {
                  },
                },
              },
              1: {
                items: {
                  Test5: {
                  },
                },
              },
              2: {
                items: {
                  ":)": {
                  },
                },
              },
            },
          },
          tray2: {
            title: "Test3",
            columns: {
              0: {
                items: {
                  Test1: {
                  },
                },
              },
            },
          },
        },
        direction: Direction.Right,
        history: [],
      },
    },
  },
  3: {
    horizontal: {
    },
    vertical: {
      channel: {
        id: "channel",
        trayId: "tray1",
        backTrays: [],
        trays: {
          tray1: {
            title: "Tools",
            columns: {
              0: {
                items: {
                  Test1: {
                  },
                },
              },
            },
          },
        },
        direction: Direction.Left,
        history: [],
      },
      chat: {
        id: "chat",
      },
      browse: {
        id: "browse",
      },
    },
  },
};

const zoneTools: ZoneTools = {
  ...hiddenZoneTools,
  1: {
    ...hiddenZoneTools[1],
    vertical: {
      ...hiddenZoneTools[1].vertical,
      validate: {
        id: "validate",
        trayId: "tray1",
        backTrays: [],
        trays: {
          tray1: {
            title: "Tools",
            columns: {
              0: {
                items: {
                  Validate: {
                  },
                },
              },
            },
          },
        },
        direction: Direction.Right,
        history: [],
      },
    },
  },
  3: {
    ...hiddenZoneTools[3],
    horizontal: {
      ...hiddenZoneTools[3].horizontal,
      d2: {
        backTrays: [],
        direction: Direction.Bottom,
        history: [],
        id: "d2",
        trayId: "3d",
        trays: {
          "3d": {
            title: "3D Tools",
            columns: {
              0: {
                items: {
                  "3D#1": {
                  },
                  "3D#2": {
                  },
                },
              },
            },
          },
        },
      },
      overflow: {
        backTrays: [],
        direction: Direction.Bottom,
        history: [],
        id: "overflow",
        isOverflow: true,
        trayId: "root",
        trays: {
          root: {
            title: "Overflow Tools",
            columns: {
              0: {
                items: {
                  Tool1: {
                  },
                  Tool2: {
                  },
                },
              },
            },
          },
        },
      },
    },
    vertical: {
      ...hiddenZoneTools[3].vertical,
      clipboard: {
        id: "clipboard",
        trayId: "tray1",
        backTrays: [],
        trays: {
          tray1: {
            title: "Tools",
            columns: {
              0: {
                items: {
                  "3D#1": {
                  },
                  "3D#2": {
                  },
                },
              },
            },
          },
        },
        direction: Direction.Left,
        history: [],
      },
      calendar: {
        id: "calendar",
        trayId: "tray1",
        backTrays: [],
        trays: {
          tray1: {
            title: "3D Tools",
            columns: {
              0: {
                items: {
                  "3D#1": {
                  },
                  "3D#2": {
                  },
                },
              },
            },
          },
        },
        direction: Direction.Left,
        history: [],
      },
      chat2: {
        id: "chat2",
      },
      document: {
        id: "document",
      },
    },
  },
};

const zoneKeys: Array<keyof ZoneTools> = [1, 3];
const directionKeys: Array<keyof DirectionTools> = ["horizontal", "vertical"];

const initialTheme: Theme = "light";

interface State {
  contentBounds: { [id in WidgetZoneIndex]?: RectangleProps };
  isBackstageOpen: boolean;
  isTooltipVisible: boolean;
  message: VisibleMessage;
  nineZone: NineZoneProps;
  openWidget: FooterWidget;
  theme: Theme;
  toolSettingsMode: ToolSettingsMode;
  tools: ZoneTools | HiddenZoneTools;
  toastMessageKey: number;
}

export default class ZonesExample extends React.PureComponent<{}, State> {
  private _handleWidgetTabDrag: ScheduleFn<WidgetTabDragFn>;
  private _handleZoneResize: ScheduleFn<ZoneResizeFn>;
  private _contentRefs = new Map<WidgetZoneIndex, React.RefObject<HTMLDivElement>>();

  public readonly state: State = {
    contentBounds: {},
    isBackstageOpen: false,
    isTooltipVisible: false,
    message: VisibleMessage.None,
    nineZone: DefaultStateManager.mergeZone(9, 6,
      DefaultStateManager.setAllowsMerging(4, false,
        getDefaultNineZoneProps(),
      ),
    ),
    openWidget: FooterWidget.None,
    theme: initialTheme,
    toastMessageKey: 0,
    tools: zoneTools,
    toolSettingsMode: ToolSettingsMode.Open,
  };

  public constructor(p: {}) {
    super(p);

    this._handleWidgetTabDrag = rafSchedule((dragged: PointProps) => {
      this.setState((prevState) => ({
        nineZone: DefaultStateManager.handleWidgetTabDrag(dragged, prevState.nineZone),
      }));
    });
    this._handleZoneResize = rafSchedule((zoneId: WidgetZoneIndex, x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => {
      this.setState((prevState) => ({
        nineZone: DefaultStateManager.handleResize(zoneId, x, y, handle, filledHeightDiff, prevState.nineZone),
      }));
    });
  }

  public componentDidMount(): void {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.layout(new Size(document.body.clientWidth, document.body.clientHeight), prevState.nineZone),
    }));

    window.addEventListener("resize", this._handleWindowResize, true);
  }

  public componentWillUnmount(): void {
    this._handleWidgetTabDrag.cancel();
    document.removeEventListener("resize", this._handleWindowResize, true);
  }

  public render() {
    const nineZone = new NineZone(this.state.nineZone);
    const zoneIds = Object.keys(this.state.nineZone.zones)
      .map((key) => Number(key) as WidgetZoneIndex);
    const tabs = zoneIds.reduce<Array<{ id: number, widget: Widget }>>((prev, zoneId) => {
      const widget = nineZone.getWidget(zoneId);
      const tabCount = getTabCount(zoneId);
      for (let i = 1; i <= tabCount; i++) {
        prev.push({ id: i, widget });
      }
      return prev;
    }, []);
    return (
      <div
        className={"nzdemo-pages-zones"}
      >
        <Content />
        <Zones>
          <TooltipExample
            containerSize={this.state.nineZone.size}
            isTooltipVisible={this.state.isTooltipVisible || false}
            onTooltipTimeout={this._handleTooltipTimeout}
          />
          {zoneIds.map((zoneId) => this.getZone(zoneId, nineZone))}
          {tabs.map((tab) => {
            return (
              <WidgetContentExample
                anchor={tab.widget.zone.horizontalAnchor}
                isDisplayed={tab.widget.props.tabIndex === tab.id}
                key={`${tab.widget.props.id}_${tab.id}`}
                onChangeTheme={this._handleChangeTheme}
                onOpenActivityMessage={this._handleOpenActivityMessage}
                onOpenToastMessage={this._handleOpenToastMessage}
                onShowTooltip={this._handleShowTooltip}
                onToggleFooterMode={this._handleToggleFooterMode}
                renderTo={this.getContentRef(tab.widget.zone.props.id)}
                tabIndex={tab.id}
                theme={this.state.theme}
                widgetId={tab.widget.props.id}
              />
            );
          })}
        </Zones>
        <BackstageExample
          isOpen={this.state.isBackstageOpen}
          onClose={this._handleBackstageClose}
        />
      </div>
    );
  }

  private getZone(zoneId: WidgetZoneIndex, nineZone: NineZone) {
    switch (zoneId) {
      case 1:
        return this.getZone1();
      case 2:
        return this.getZone2();
      case 3:
        return this.getZone3();
      case 8:
        return this.getStatusZone(nineZone.getStatusZone());
      default:
        return this.getFloatingZone(nineZone.getWidgetZone(zoneId));
    }
  }

  private getZone1() {
    const zoneId = 1;
    return (
      <Zone1
        bounds={this.state.nineZone.zones[zoneId].bounds}
        horizontalTools={this.state.tools[zoneId].horizontal}
        key={zoneId}
        onAppButtonClick={this._handleAppButtonClick}
        onHistoryItemClick={this._handleHistoryItemClick}
        onIsHistoryExtendedChange={this._handleIsToolHistoryExtendedChange}
        onOpenPanelGroup={this._handleExpandPanelGroup}
        onPanelBack={this._handlePanelBack}
        onPanelOutsideClick={this._handlePanelOutsideClick}
        onPanelToolClick={this._handlePanelToolClick}
        onToolClick={this._handleToolClick}
        verticalTools={this.state.tools[zoneId].vertical}
      />
    );
  }

  private getZone2() {
    const zoneId = 2;
    return (
      <Zone
        bounds={this.state.nineZone.zones[zoneId].bounds}
        key={zoneId}
      >
        {this.state.tools[1].horizontal.toolSettings.isActive ?
          <ToolSettingsWidget
            onTabClick={this._handleToolSettingsTabClick}
            mode={this.state.toolSettingsMode}
          />
          : null}
      </Zone>
    );
  }

  private getZone3() {
    const zoneId = 3;
    return (
      <Zone3
        bounds={this.state.nineZone.zones[zoneId].bounds}
        horizontalTools={this.state.tools[zoneId].horizontal}
        key={zoneId}
        onHistoryItemClick={this._handleHistoryItemClick}
        onIsHistoryExtendedChange={this._handleIsToolHistoryExtendedChange}
        onOpenPanelGroup={this._handleExpandPanelGroup}
        onPanelBack={this._handlePanelBack}
        onPanelOutsideClick={this._handlePanelOutsideClick}
        onPanelToolClick={this._handlePanelToolClick}
        onToolbarScroll={this._handleToolbarScroll}
        onToolClick={this._handleToolClick}
        verticalTools={this.state.tools[zoneId].vertical}
      />
    );
  }

  private getStatusZone(zone: StatusZoneManager) {
    const isRectangularWidget = zone.props.widgets.length > 1;
    if (isRectangularWidget)
      return this.getFloatingZone(zone);

    const outlineBounds = zone.getGhostOutlineBounds();
    const dropTarget = zone.getDropTarget();
    const bounds = zone.props.floating ? zone.props.floating.bounds : zone.props.bounds;

    return (
      <StatusZoneExample
        bounds={bounds}
        dropTarget={dropTarget}
        isInFooterMode={zone.props.isInFooterMode}
        key={zone.id}
        onTargetChanged={this._handleTargetChanged}
        outlineBounds={outlineBounds}
        message={this.state.message}
        onHideMessage={this._handleHideMessage}
        onOpenWidgetChange={this._handleOpenWidgetChange}
        openWidget={this.state.openWidget}
        targetBounds={zone.props.bounds}
        toastMessageKey={this.state.toastMessageKey}
      />
    );
  }

  private getFloatingZone(zone: WidgetZone) {
    const bounds = zone.props.floating ? zone.props.floating.bounds : zone.props.bounds;
    const outlineBounds = zone.getGhostOutlineBounds();
    const dropTarget = zone.getDropTarget();
    const draggingWidget = zone.nineZone.draggingWidget && zone.nineZone.draggingWidget.zone.id === zone.id ?
      zone.nineZone.draggingWidget.props : undefined;
    const floating = zone.props.floating;
    const style: React.CSSProperties | undefined = floating ? { zIndex: floating.stackId } : undefined;
    return (
      <span
        key={zone.id}
        style={style}
      >
        <FloatingZoneWidget
          bounds={bounds}
          contentRef={this.getContentRef(zone.id)}
          draggingWidget={draggingWidget}
          horizontalAnchor={zone.horizontalAnchor}
          onResize={this._handleZoneResize}
          onTabClick={this._handleWidgetTabClick}
          onTabDragStart={this._handleWidgetTabDragStart}
          onTabDragEnd={this._handleWidgetTabDragEnd}
          onTabDrag={this._handleWidgetTabDrag}
          verticalAnchor={zone.verticalAnchor}
          zone={zone.props}
        />
        <ZoneTargetExample
          bounds={zone.props.bounds}
          dropTarget={dropTarget}
          zoneIndex={zone.id}
          onTargetChanged={this._handleTargetChanged}
        />
        {outlineBounds && <Outline bounds={outlineBounds} />}
      </span>
    );
  }

  private getContentRef(widget: WidgetZoneIndex) {
    const ref = this._contentRefs.get(widget);
    if (ref)
      return ref;
    const newRef = React.createRef<HTMLDivElement>();
    this._contentRefs.set(widget, newRef);
    return newRef;
  }

  private locateTool(location: ToolLocation, state: State): Tool {
    return state.tools[location.zoneKey][location.directionKey][location.toolId];
  }

  private findToolLocation(predicate: (tool: Tool) => boolean, state: State): ToolLocation | undefined {
    for (const zoneKey of zoneKeys) {
      for (const directionKey of directionKeys) {
        const tools = state.tools[zoneKey][directionKey];
        const found = Object.keys(tools).find((id) => {
          const tool = state.tools[zoneKey][directionKey][id];
          return predicate(tool);
        });
        if (found)
          return {
            zoneKey,
            directionKey,
            toolId: found,
          };
      }
    }
    return undefined;
  }

  private findTool(predicate: (tool: Tool) => boolean, state: State): Tool | undefined {
    const location = this.findToolLocation(predicate, state);
    if (!location)
      return undefined;
    return this.locateTool(location, state);
  }

  private getToolLocation(toolId: string, state: State): ToolLocation {
    const toolLocation = this.findToolLocation((tool) => tool.id === toolId, state);
    if (!toolLocation)
      throw new ReferenceError();
    return toolLocation;
  }

  private getLocationOfToolWithOpenPanel(state: State) {
    return this.findToolLocation((tool) => {
      if (isToolGroup(tool) && tool.isPanelOpen)
        return true;
      return false;
    }, state);
  }

  private getActiveTool(state: State): Tool | undefined {
    return this.findTool((tool) => {
      if (tool.isActive)
        return true;
      return false;
    }, state);
  }

  private getToolWithOpenPanel(state: State): Tool | undefined {
    const location = this.getLocationOfToolWithOpenPanel(state);
    if (!location)
      return undefined;
    return this.locateTool(location, state);
  }

  private getTool(toolId: string, state: State): Tool {
    const location = this.getToolLocation(toolId, state);
    return this.locateTool(location, state);
  }

  private toggleIsDisabledForSomeTools(isDisabled: boolean, state: State): State {
    return {
      ...state,
      tools: {
        ...state.tools,
        1: {
          ...state.tools[1],
          vertical: {
            ...state.tools[1].vertical,
            cube: {
              ...state.tools[1].vertical.cube,
              isDisabled,
            },
          },
        },
        3: {
          ...state.tools[3],
          vertical: {
            ...state.tools[3].vertical,
            browse: {
              ...state.tools[3].vertical.browse,
              isDisabled,
            },
            chat: {
              ...state.tools[3].vertical.chat,
              isDisabled,
            },
          },
        },
      },
    };
  }

  private toggleIsHiddenForSomeTools(isHidden: boolean, state: State): State {
    return {
      ...state,
      tools: {
        ...state.tools,
        1: {
          ...state.tools[1],
          vertical: {
            ...state.tools[1].vertical,
            validate: {
              ...state.tools[1].vertical.validate,
              isHidden,
            },
          },
        },
        3: {
          ...state.tools[3],
          horizontal: {
            ...state.tools[3].horizontal,
            d2: {
              ...state.tools[3].horizontal.d2,
              isHidden,
            },
            overflow: {
              ...state.tools[3].horizontal.overflow,
              isHidden,
            },
          },
          vertical: {
            ...state.tools[3].vertical,
            clipboard: {
              ...state.tools[3].vertical.clipboard,
              isHidden,
            },
            calendar: {
              ...state.tools[3].vertical.calendar,
              isHidden,
            },
            chat2: {
              ...state.tools[3].vertical.chat2,
              isHidden,
            },
            document: {
              ...state.tools[3].vertical.document,
              isHidden,
            },
          },
        },
      },
    };
  }

  private deactivateTool(toolId: string, state: State): State {
    const tool = this.getTool(toolId, state);
    if (!tool.isActive)
      return state;

    const location = this.getToolLocation(toolId, state);
    state = {
      ...state,
      tools: {
        ...state.tools,
        [location.zoneKey]: {
          ...state.tools[location.zoneKey],
          [location.directionKey]: {
            ...state.tools[location.zoneKey][location.directionKey],
            [toolId]: {
              ...tool,
              isActive: false,
            },
          },
        },
      },
    };

    switch (toolId) {
      case "toggleTools": {
        return this.toggleIsHiddenForSomeTools(false, state);
      }
      case "disableTools": {
        return this.toggleIsDisabledForSomeTools(false, state);
      }
    }
    return state;
  }

  private activateTool(toolId: string, state: State): State {
    const location = this.getToolLocation(toolId, state);
    const tool = this.locateTool(location, state);
    if (!isToolGroup(tool)) {
      state = {
        ...state,
        tools: {
          ...state.tools,
          [location.zoneKey]: {
            ...state.tools[location.zoneKey],
            [location.directionKey]: {
              ...state.tools[location.zoneKey][location.directionKey],
              [toolId]: {
                ...tool,
                isActive: true,
              },
            },
          },
        },
      };
    }

    switch (toolId) {
      case "toggleTools": {
        return this.toggleIsHiddenForSomeTools(true, state);
      }
      case "toolSettings": {
        return {
          ...state,
          toolSettingsMode: ToolSettingsMode.Open,
        };
      }
      case "disableTools": {
        return this.toggleIsDisabledForSomeTools(true, state);
      }
    }
    return state;
  }

  private closePanel(toolId: string, state: State): State {
    const tool = this.getTool(toolId, state);
    if (!isToolGroup(tool))
      return state;

    if (!tool.isPanelOpen)
      return state;

    const location = this.getToolLocation(toolId, state);
    state = {
      ...state,
      tools: {
        ...state.tools,
        [location.zoneKey]: {
          ...state.tools[location.zoneKey],
          [location.directionKey]: {
            ...state.tools[location.zoneKey][location.directionKey],
            [location.toolId]: {
              ...state.tools[location.zoneKey][location.directionKey][location.toolId],
              isPanelOpen: false,
            },
          },
        },
      },
    };

    return state;
  }

  private openPanel(toolId: string, state: State): State {
    const tool = this.getTool(toolId, state);
    if (!isToolGroup(tool))
      return state;

    if (tool.isPanelOpen)
      return state;

    const location = this.getToolLocation(toolId, state);
    return {
      ...state,
      tools: {
        ...state.tools,
        [location.zoneKey]: {
          ...state.tools[location.zoneKey],
          [location.directionKey]: {
            ...state.tools[location.zoneKey][location.directionKey],
            [toolId]: {
              ...tool,
              isPanelOpen: true,
            },
          },
        },
      },
    };
  }

  private _handleTooltipTimeout = () => {
    this.setState(() => ({
      isTooltipVisible: false,
    }));
  }

  private _handleToolClick = (toolId: string) => {
    this.setState((prevState) => {
      const tool = this.getTool(toolId, prevState);
      const activeTool = this.getActiveTool(prevState);
      const toolWithOpenPanel = this.getToolWithOpenPanel(prevState);

      let state = prevState;
      if (toolWithOpenPanel) {
        state = this.closePanel(toolWithOpenPanel.id, prevState);
      }
      if (isToolGroup(tool) && !tool.isPanelOpen) {
        state = this.openPanel(toolId, state);
      }

      if (activeTool)
        state = this.deactivateTool(activeTool.id, state);
      if (!activeTool || activeTool.id !== toolId)
        state = this.activateTool(toolId, state);

      return state;
    });
  }

  private _handleIsToolHistoryExtendedChange = (toolId: string, isExtended: boolean) => {
    this.setState((prevState) => {
      const location = this.getToolLocation(toolId, prevState);
      const prevDirections = prevState.tools[location.zoneKey];
      const prevTools = prevDirections[location.directionKey];
      return {
        tools: {
          ...prevState.tools,
          [location.zoneKey]: {
            ...prevDirections,
            [location.directionKey]: {
              ...prevTools,
              [toolId]: {
                ...prevTools[toolId],
                isExtended,
              },
            },
          },
        },
      };
    });
  }

  private _handlePanelOutsideClick = (toolId: string) => {
    this.setState((prevState) => this.closePanel(toolId, prevState));
  }

  private _handlePanelToolClick = ({ toolId, trayId, columnId, itemId }: ToolbarItemGroupToolClickArgs) => {
    this.setState((prevState) => {
      const location = this.getToolLocation(toolId, prevState);
      const prevDirections = prevState.tools[location.zoneKey];
      const prevTools = prevDirections[location.directionKey];
      const tool = prevTools[toolId];
      if (!isToolGroup(tool))
        throw new TypeError();

      const key = columnId + "-" + itemId;
      const item: HistoryItem = { toolId, trayId, columnId, itemId };
      return {
        tools: {
          ...prevState.tools,
          [location.zoneKey]: {
            ...prevDirections,
            [location.directionKey]: {
              ...prevTools,
              [toolId]: {
                ...prevTools[toolId],
                isExtended: false,
                isPanelOpen: false,
                history: DefaultHistoryManager.addItem(key, item, tool.history),
              },
            },
          },
        },
      };
    });
  }

  private _handleAppButtonClick = () => {
    this.setState(() => ({
      isBackstageOpen: true,
    }));
  }

  private _handleBackstageClose = () => {
    this.setState(() => ({
      isBackstageOpen: false,
    }));
  }

  private _handleHistoryItemClick = (item: HistoryItem) => {
    this.setState((prevState) => {
      const location = this.getToolLocation(item.toolId, prevState);
      const prevDirections = prevState.tools[location.zoneKey];
      const prevTools = prevDirections[location.directionKey];
      const tool = prevTools[item.toolId];
      if (!isToolGroup(tool))
        throw new TypeError();

      return {
        tools: {
          ...prevState.tools,
          [location.zoneKey]: {
            ...prevDirections,
            [location.directionKey]: {
              ...prevTools,
              [item.toolId]: {
                ...prevTools[item.toolId],
                isExtended: false,
                history: DefaultHistoryManager.addItem(item.columnId + "-" + item.itemId, item, tool.history),
              },
            },
          },
        },
      };
    });
  }

  private _handleToolbarScroll = () => {
    this.setState((prevState) => {
      const newZoneTools: ZoneTools = {
        1: {
          horizontal: {} as Zone1HorizontalTools,
          vertical: {} as Zone1VerticalTools,
        },
        3: {
          horizontal: {} as Zone3HorizontalTools,
          vertical: {} as Zone3VerticalTools,
        },
      };
      return {
        tools: Object.keys(prevState.tools).reduce<ZoneTools>((zoneAcc, zoneKeyStr) => {
          const zoneKey = Number(zoneKeyStr) as keyof ZoneTools;
          const prevDirections = prevState.tools[zoneKey];
          (zoneAcc[zoneKey] as DirectionTools) = Object.keys(prevDirections).reduce<DirectionTools>((directionAcc, directionKeyStr) => {
            const directionKey = directionKeyStr as keyof DirectionTools;
            const prevTools = prevDirections[directionKey];
            (zoneAcc[zoneKey][directionKey] as Tools) = Object.keys(prevTools).reduce<Tools>((toolsAcc, toolId) => {
              const prevTool = prevTools[toolId];
              if (isToolGroup(prevTool)) {
                toolsAcc[toolId] = {
                  ...prevTool,
                  isPanelOpen: false,
                };
              } else {
                toolsAcc[toolId] = prevTool;
              }
              return toolsAcc;
            }, newZoneTools[zoneKey][directionKey]);
            return directionAcc;
          }, newZoneTools[zoneKey]);
          return zoneAcc;
        }, newZoneTools),
      };
    });
  }

  private _handleWindowResize = () => {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.layout(new Size(document.body.clientWidth, document.body.clientHeight), prevState.nineZone),
    }));
  }

  private _handleWidgetTabClick = (widgetId: WidgetZoneIndex, tabIndex: number) => {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.handleTabClick(widgetId, tabIndex, prevState.nineZone),
    }));
  }

  private _handleWidgetTabDragStart = (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, offset: PointProps) => {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.handleWidgetTabDragStart(widgetId, tabId, initialPosition, offset, prevState.nineZone),
    }));

    if (widgetId === StatusZoneManager.id)
      this._handleWidgetTabDragEnd();
  }

  private _handleWidgetTabDragEnd = () => {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.handleWidgetTabDragEnd(prevState.nineZone),
    }));
  }

  private _handleTargetChanged = (target: TargetZoneProps | undefined) => {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.handleTargetChanged(target, prevState.nineZone),
    }));
  }

  private _handleShowTooltip = () => {
    this.setState(() => ({
      isTooltipVisible: true,
    }));
  }

  private _handleExpandPanelGroup = (toolId: string, trayId: string | undefined) => {
    this.setState((prevState) => {
      const location = this.getToolLocation(toolId, prevState);
      const prevDirections = prevState.tools[location.zoneKey];
      const prevTools = prevDirections[location.directionKey];
      const tool = prevTools[toolId];
      if (!isToolGroup(tool))
        throw new TypeError();

      return {
        tools: {
          ...prevState.tools,
          [location.zoneKey]: {
            ...prevState.tools[location.zoneKey],
            [location.directionKey]: {
              ...prevState.tools[location.zoneKey][location.directionKey],
              [toolId]: {
                ...prevState.tools[location.zoneKey][location.directionKey][toolId],
                trayId,
                backTrays: [...tool.backTrays, tool.trayId],
              },
            },
          },
        },
      };
    });
  }

  private _handlePanelBack = (toolId: string) => {
    this.setState((prevState) => {
      const location = this.getToolLocation(toolId, prevState);
      const prevDirections = prevState.tools[location.zoneKey];
      const prevTools = prevDirections[location.directionKey];
      const tool = prevTools[toolId];
      if (!isToolGroup(tool))
        throw new TypeError();

      let trayId = tool.trayId;
      if (tool.backTrays.length > 0)
        trayId = tool.backTrays[tool.backTrays.length - 1];

      const backTrays = tool.backTrays.slice(0, -1);
      return {
        tools: {
          ...prevState.tools,
          [location.zoneKey]: {
            ...prevState.tools[location.zoneKey],
            [location.directionKey]: {
              ...prevState.tools[location.zoneKey][location.directionKey],
              [toolId]: {
                ...prevState.tools[location.zoneKey][location.directionKey][toolId],
                trayId,
                backTrays,
              },
            },
          },
        },
      };
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

  private _handleToggleFooterMode = () => {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.setIsInFooterMode(!prevState.nineZone.zones[StatusZoneManager.id].isInFooterMode, prevState.nineZone),
      openWidget: FooterWidget.None,
    }));
  }

  private _handleHideMessage = () => {
    this.setState(() => ({
      message: VisibleMessage.None,
    }));
  }

  private _handleOpenActivityMessage = () => {
    this.setState(() => ({
      message: VisibleMessage.Activity,
    }));
  }

  private _handleOpenToastMessage = () => {
    this.setState((prevState) => ({
      message: VisibleMessage.Toast,
      toastMessageKey: prevState.toastMessageKey + 1,
    }));
  }

  private _handleOpenWidgetChange = (openWidget: FooterWidget) => {
    this.setState(() => ({
      openWidget,
    }));
  }

  private _handleToolSettingsTabClick = () => {
    this.setState((prevState) => ({
      toolSettingsMode: prevState.toolSettingsMode === ToolSettingsMode.Minimized ? ToolSettingsMode.Open : ToolSettingsMode.Minimized,
    }));
  }
}

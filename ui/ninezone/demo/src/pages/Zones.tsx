/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import * as React from "react";
import * as ReactDOM from "react-dom";
import rafSchedule, { ScheduleFn } from "raf-schd";
import { BlueButton, HollowButton } from "@bentley/bwc";
import { Timer, withTimeout } from "@bentley/ui-core";
import { App } from "@src/app/App";
import { Content } from "@src/app/Content";
import { AppButton } from "@src/widget/tools/button/App";
import { MouseTracker } from "@src/context/MouseTracker";
import { Footer } from "@src/footer/Footer";
import { MessageCenter, MessageCenterButton } from "@src/footer/message-center/MessageCenter";
import { MessageCenterIndicator } from "@src/footer/message-center/Indicator";
import { MessageCenterMessage } from "@src/footer/message-center/Message";
import { MessageCenterTab } from "@src/footer/message-center/Tab";
import { SnapModeDialog } from "@src/footer/snap-mode/Dialog";
import { SnapModeIcon } from "@src/footer/snap-mode/Icon";
import { SnapModeIndicator } from "@src/footer/snap-mode/Indicator";
import { Snap } from "@src/footer/snap-mode/Snap";
import { ToolAssistanceIndicator } from "@src/footer/tool-assistance/Indicator";
import { ToolAssistanceDialog } from "@src/footer/tool-assistance/Dialog";
import { ToolAssistanceItem } from "@src/footer/tool-assistance/Item";
import { ToolAssistanceSeparator } from "@src/footer/tool-assistance/Separator";
import { Activity } from "@src/footer/message/Activity";
import { StatusMessage } from "@src/footer/message/content/status/Message";
import { MessageLayout } from "@src/footer/message/content/status/Layout";
import { Status } from "@src/footer/message/content/status/Status";
import { Label } from "@src/footer/message/content/Label";
import { MessageButton } from "@src/footer/message/content/Button";
import { Progress } from "@src/footer/message/content/Progress";
import { Hyperlink } from "@src/footer/message/content/Hyperlink";
import { Dialog } from "@src/footer/message/content/dialog/Dialog";
import { TitleBar } from "@src/footer/message/content/dialog/TitleBar";
import { DialogTitle } from "@src/footer/message/content/dialog/Title";
import { DialogButton } from "@src/footer/message/content/dialog/Button";
import { Buttons } from "@src/footer/message/content/dialog/content/Buttons";
import { ScrollableContent } from "@src/footer/message/content/dialog/content/Scrollable";
import { MessageResizeHandle } from "@src/footer/message/content/dialog/ResizeHandle";
import { Modal } from "@src/footer/message/Modal";
import { Sticky } from "@src/footer/message/Sticky";
import { Temporary } from "@src/footer/message/Temporary";
import { Toast, Stage } from "@src/footer/message/Toast";
import { Nested } from "@src/widget/tool-settings/Nested";
import { ScrollableArea } from "@src/widget/tool-settings/ScrollableArea";
import { Toggle } from "@src/widget/tool-settings/Toggle";
import { ToolSettings } from "@src/widget/tool-settings/Settings";
import { ToolSettingsTooltip } from "@src/widget/tool-settings/Tooltip";
import { ToolSettingsTab } from "@src/widget/tool-settings/Tab";
import { ToolSettingsWidget } from "@src/widget/ToolSettings";
import { ExpandableItem } from "@src/toolbar/item/expandable/Expandable";
import { Overflow } from "@src/toolbar/item/Overflow";
import { GroupColumn } from "@src/toolbar/item/expandable/group/Column";
import { GroupTool } from "@src/toolbar/item/expandable/group/tool/Tool";
import { GroupToolExpander } from "@src/toolbar/item/expandable/group/tool/Expander";
import { Group } from "@src/toolbar/item/expandable/group/Group";
import { NestedGroup } from "@src/toolbar/item/expandable/group/Nested";
import { HistoryIcon } from "@src/toolbar/item/expandable/history/Icon";
import { HistoryTray, History, DefaultHistoryManager } from "@src/toolbar/item/expandable/history/Tray";
import { Item } from "@src/toolbar/item/Icon";
import { Toolbar, ToolbarPanelAlignment } from "@src/toolbar/Toolbar";
import { Scrollable } from "@src/toolbar/Scrollable";
import { Direction } from "@src/utilities/Direction";
import { PointProps, Point } from "@src/utilities/Point";
import { Size, SizeProps } from "@src/utilities/Size";
import { ResizeHandle } from "@src/widget/rectangular/ResizeHandle";
import { Draggable } from "@src/widget/rectangular/tab/Draggable";
import { TabSeparator } from "@src/widget/rectangular/tab/Separator";
import { TabGroup, VisibilityMode } from "@src/widget/rectangular/tab/Group";
import { TabMode } from "@src/widget/rectangular/tab/Tab";
import { Stacked, HorizontalAnchor, VerticalAnchor } from "@src/widget/Stacked";
import { Tools as ToolsWidget } from "@src/widget/tools/Tools";
import { FooterZone } from "@src/zones/Footer";
import { NineZone, getDefaultNineZoneProps, NineZoneProps, WidgetZoneIndex } from "@src/zones/state/NineZone";
import { DefaultStateManager } from "@src/zones/state/Manager";
import { WidgetProps, DraggingWidgetProps } from "@src/zones/state/Widget";
import { TargetType, TargetZoneProps } from "@src/zones/state/Target";
import { ZonePropsBase, DropTarget, StatusZone } from "@src/zones/state/Zone";
import { Container } from "@src/zones/target/Container";
import { Merge } from "@src/zones/target/Merge";
import { Back } from "@src/zones/target/Back";
import { ZoneComponent } from "@src/zones/Zone";
import { Zones } from "@src/zones/Zones";
import { GhostOutline } from "@src/zones/GhostOutline";
import { ThemeContext, ThemeContextProps } from "@src/theme/Context";
import { Theme, DarkTheme, PrimaryTheme, LightTheme } from "@src/theme/Theme";
import { offsetAndContainInContainer } from "@src/popup/tooltip/Tooltip";
import { RectangleProps, Rectangle } from "@src/utilities/Rectangle";
import { withContainInViewport } from "@src/base/WithContainInViewport";
import { OmitChildrenProp } from "@src/utilities/Props";
import "./Zones.scss";

const adjustTooltipPosition = offsetAndContainInContainer();
// tslint:disable-next-line:variable-name
const TooltipWithTimeout = withTimeout(ToolSettingsTooltip);
// tslint:disable-next-line:variable-name
const ToolGroupContained = withContainInViewport(Group);
// tslint:disable-next-line:variable-name
const NestedToolGroupContained = withContainInViewport(NestedGroup);

interface State {
  isNestedPopoverOpen: boolean;
  isPopoverOpen: boolean;
  isTemporaryMessageVisible: number;
  isTooltipVisible: boolean;
  message: Message;
  nineZone: NineZoneProps;
  openWidget: FooterWidget;
  toolSettingsWidget: ToolSettingsWidgetMode;
  tools: ZoneTools | HiddenZoneTools;
  themeContext: ThemeContextProps;
  toastMessageKey: number;
}

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

enum ToolSettingsWidgetMode {
  Minimized,
  Open,
}

enum Message {
  None,
  Activity,
  Modal,
  Toast,
  Sticky,
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

const customTheme: Theme = {
  name: "custom",
};

interface MessageProps {
  onHideMessage: () => void;
}

class ActivityMessage extends React.PureComponent<MessageProps> {
  public render() {
    return (
      <Activity>
        <StatusMessage
          status={Status.Information}
          icon={
            <i className="icon icon-activity" />
          }
        >
          <MessageLayout
            label={
              <Label text="Rendering 'big-image.png'" />
            }
            buttons={
              <Hyperlink
                onClick={this.props.onHideMessage}
                text="Ok"
              />
            }
            progress={
              <Progress status={Status.Information} progress={33.33} />
            }
          />
        </StatusMessage>
      </Activity>
    );
  }
}

interface ModalMessageProps extends MessageProps {
  renderTo: () => HTMLElement;
}

class ModalMessage extends React.PureComponent<ModalMessageProps> {
  public render() {
    return (
      <Modal
        renderTo={this.props.renderTo}
        dialog={
          <Dialog
            titleBar={
              <TitleBar
                title={
                  <DialogTitle text="Dialog" />
                }
                buttons={
                  <DialogButton onClick={this.props.onHideMessage}>
                    <i className="icon icon-close" />
                  </DialogButton>
                }
              />
            }
            content={
              <Buttons
                buttons={
                  <>
                    <BlueButton
                      onClick={this.props.onHideMessage}
                    >
                      Yes
                        </BlueButton>
                    <HollowButton
                      onClick={this.props.onHideMessage}
                    >
                      No
                        </HollowButton>
                  </>
                }
                content={
                  <ScrollableContent
                    content={
                      <>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit.Integer vehicula viverra ante a finibus.Suspendisse tristique neque volutpat ex auctor, a consectetur nunc convallis.Nullam condimentum imperdiet elit vitae vulputate.Praesent ornare tellus luctus sem cursus, sed porta ligula pulvinar.In fringilla tellus sem, id sollicitudin leo condimentum sed.Quisque tempor sed risus gravida tincidunt.Nulla id hendrerit sapien.
                          <br />
                        <br />
                        In vestibulum ipsum lorem.Aliquam accumsan tortor sit amet facilisis lacinia.Nam quis lacus a urna eleifend finibus.Donec id purus id turpis viverra faucibus.Lorem ipsum dolor sit amet, consectetur adipiscing elit.Sed finibus dui ut efficitur interdum.Donec a congue mauris.Praesent ornare egestas accumsan.Pellentesque malesuada diam nisl, a elementum turpis commodo quis.Suspendisse vitae diam accumsan, ullamcorper ante in, porttitor turpis.Phasellus scelerisque tristique imperdiet.
                          <br />
                        <br />
                        Aenean interdum nulla ex, sed molestie lectus pulvinar ac.Mauris sagittis tempor justo ac imperdiet.Fusce iaculis cursus lectus sit amet semper.Quisque at volutpat magna, vitae lacinia nunc.Suspendisse a ipsum orci.Duis in mi sit amet purus blandit mattis porttitor mollis enim.Curabitur dictum nisi massa, eu luctus sapien viverra quis.
                          <br />
                        <br />
                        Ut sed pellentesque diam.Integer non pretium nibh.Nulla scelerisque ipsum ac porttitor lobortis.Suspendisse eu egestas felis, sit amet facilisis neque.In sit amet fermentum nisl.Proin volutpat ex et ligula auctor, id cursus elit fringilla.Nulla facilisi.Proin dictum a lectus a elementum.Mauris ultricies dapibus libero ut interdum.
                          <br />
                        <br />
                        Suspendisse blandit mauris metus, in accumsan magna venenatis pretium.Ut ante odio, tempor non quam at, scelerisque pulvinar dui.Duis in magna ut leo fermentum pellentesque venenatis vitae sapien.Suspendisse potenti.Nunc quis ex ac mi porttitor euismod.Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.Nunc tincidunt nunc id sem varius imperdiet.Phasellus congue orci vitae lorem malesuada, vel tempor tortor molestie.Nullam gravida tempus ornare.
                        </>
                    }
                  />
                }
              />
            }
            resizeHandle={< MessageResizeHandle />}
          />
        }
      />
    );
  }
}

class StickyMessage extends React.PureComponent<MessageProps> {
  public render() {
    return (
      <Sticky>
        <StatusMessage
          status={Status.Error}
          icon={
            <i className="icon icon-status-error-hollow" />
          }
        >
          <MessageLayout
            label={
              <Label text="Unable to load 3 fonts, replaced with Arial." />
            }
            buttons={
              <MessageButton onClick={this.props.onHideMessage}>
                <i className="icon icon-close" />
              </MessageButton>
            }
          />
        </StatusMessage>
      </Sticky>
    );
  }
}

interface ToastMessageProps extends MessageProps {
  animateOutTo: React.ReactInstance | undefined;
}

interface ToastMessageState {
  stage: Stage;
}

class ToastMessageExample extends React.PureComponent<ToastMessageProps, ToastMessageState> {
  public readonly state = {
    stage: Stage.Visible,
  };

  public render() {
    return (
      <Toast
        animateOutTo={this.props.animateOutTo}
        content={
          <StatusMessage
            status={Status.Success}
            icon={
              <i className="icon icon-status-success-hollow" />
            }
          >
            <MessageLayout
              label={
                <Label text="Image 'big.png' saved." />
              }
            />
          </StatusMessage>
        }
        onAnimatedOut={this.props.onHideMessage}
        onStageChange={this._handleToastStageChange}
        stage={this.state.stage}
        timeout={2500}
      />
    );
  }

  private _handleToastStageChange = (stage: Stage) => {
    this.setState(() => ({
      stage,
    }));
  }
}

interface FooterMessageExampleProps {
  toastMessageKey: React.Key;
  message: Message;
  renderModalMessageTo: () => HTMLElement;
  animateToastMessageTo: React.ReactInstance | undefined;
  onHideMessage: () => void;
}

class FooterMessageExample extends React.PureComponent<FooterMessageExampleProps> {
  public render() {
    switch (this.props.message) {
      case (Message.Activity): {
        return (
          <ActivityMessage
            onHideMessage={this.props.onHideMessage}
          />
        );
      }
      case (Message.Modal): {
        return (
          <ModalMessage
            onHideMessage={this.props.onHideMessage}
            renderTo={this.props.renderModalMessageTo}
          />
        );
      }
      case (Message.Toast): {
        return (
          <ToastMessageExample
            key={this.props.toastMessageKey}
            onHideMessage={this.props.onHideMessage}
            animateOutTo={this.props.animateToastMessageTo}
          />
        );
      }
      case (Message.Sticky): {
        return (
          <StickyMessage
            onHideMessage={this.props.onHideMessage}
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
  isInWidgetMode: boolean;
  message: Message;
  onHideMessage: () => void;
  onTargetChanged: TargetChangedHandler;
  onOpenWidgetChange: (widget: FooterWidget) => void;
  openWidget: FooterWidget;
  outlineBounds: RectangleProps | undefined;
  renderModalMessageTo: () => HTMLElement;
  targetBounds: RectangleProps;
  toastMessageKey: React.Key;
}

interface StatusZoneExampleState {
  messageCenterTab: MessageCenterActiveTab;
}

class StatusZoneExample extends React.PureComponent<StatusZoneExampleProps, StatusZoneExampleState> {
  private _footerMessages = React.createRef<MessageCenterIndicator>();

  public readonly state = {
    messageCenterTab: MessageCenterActiveTab.AllMessages,
  };

  public render() {
    return (
      <React.Fragment>
        <FooterZone
          isInFooterMode={!this.props.isInWidgetMode}
          bounds={this.props.bounds}
        >
          <Footer
            isInWidgetMode={this.props.isInWidgetMode}
            message={
              <FooterMessageExample
                toastMessageKey={this.props.toastMessageKey}
                animateToastMessageTo={this._footerMessages.current || undefined}
                onHideMessage={this.props.onHideMessage}
                message={this.props.message}
                renderModalMessageTo={this.props.renderModalMessageTo}
              />
            }
            indicators={
              <>
                <ToolAssistanceIndicator
                  dialog={
                    this.props.openWidget !== FooterWidget.ToolAssistance ? undefined :
                      <ToolAssistanceDialog
                        title="Trim Multiple - Tool Assistance"
                        items={
                          <>
                            <ToolAssistanceItem>
                              <i className="icon icon-cursor" />
                              Identify piece to trim
                              </ToolAssistanceItem>
                            <ToolAssistanceSeparator label="Inputs" />
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
                          </>
                        }
                      />
                  }
                  icons={
                    <>
                      <i className="icon icon-cursor" />
                      <i className="icon icon-add" />
                    </>
                  }
                  isStepStringVisible={!this.props.isInWidgetMode}
                  onClick={this._handleToggleToolAssistanceDialog}
                  stepString="Start Point"
                />
                <MessageCenterIndicator
                  ref={this._footerMessages}
                  label="Message(s):"
                  isLabelVisible={!this.props.isInWidgetMode}
                  balloonLabel="9+"
                  onClick={this._handleToggleMessageCenterDialog}
                  dialog={
                    this.props.openWidget !== FooterWidget.Messages ? undefined :
                      <MessageCenter
                        title="Messages"
                        buttons={
                          <>
                            <MessageCenterButton>
                              <i className={"icon icon-placeholder"} />
                            </MessageCenterButton>
                            <MessageCenterButton onClick={this._handleCloseMessageCenter}>
                              <i className={"icon icon-close"} />
                            </MessageCenterButton>
                          </>
                        }
                        tabs={
                          <>
                            <MessageCenterTab
                              isOpen={this.state.messageCenterTab === MessageCenterActiveTab.AllMessages}
                              onClick={this._handleAllMessagesTabClick}
                            >
                              All
                          </MessageCenterTab>
                            <MessageCenterTab
                              isOpen={this.state.messageCenterTab === MessageCenterActiveTab.Problems}
                              onClick={this._handleProblemsTabClick}
                            >
                              Problems
                          </MessageCenterTab>
                          </>
                        }
                        messages={this.state.messageCenterTab === MessageCenterActiveTab.AllMessages ?
                          <>
                            <MessageCenterMessage
                              icon={<i className={"icon icon-status-success nzdemo-success"} />}
                              content={"Document saved successfully."}
                            />
                            <MessageCenterMessage
                              icon={<i className={"icon icon-clock nzdemo-progress"} />}
                              content={
                                <>
                                  <span>Downloading required assets.</span>
                                  <br />
                                  <i><small>75% complete</small></i>
                                </>
                              }
                            />
                            <MessageCenterMessage
                              icon={<i className={"icon icon-status-rejected nzdemo-error"} />}
                              content={
                                <>
                                  <span>Cannot attach reference.</span>
                                  <br />
                                  <i><u><small>Details...</small></u></i>
                                </>
                              }
                            />
                            <MessageCenterMessage
                              icon={<i className={"icon icon-status-warning nzdemo-warning"} />}
                              content={"Missing 10 fonts. Replaces with Arial."}
                            />
                            <MessageCenterMessage
                              icon={<i className={"icon icon-star nzdemo-favorite"} />}
                              content={"Your document has been favorited by 5 people in the..."}
                            />
                            <MessageCenterMessage
                              icon={<i className={"icon icon-status-success nzdemo-success"} />}
                              content={"Navigator has successfully updated"}
                            />
                          </> :
                          <>
                            <MessageCenterMessage
                              icon={<i className={"icon icon-status-rejected"} style={{ color: "red" }} />}
                              content={"Missing 10 fonts. Replaced with Arial."}
                            />
                            <MessageCenterMessage
                              content={"Cannot attach reference"}
                            />
                            <MessageCenterMessage
                              content={"Problem1"}
                            />
                            <MessageCenterMessage
                              content={"Problem2"}
                            />
                            <MessageCenterMessage
                              content={"Problem3"}
                            />
                            <MessageCenterMessage
                              content={"Problem4"}
                            />
                            <MessageCenterMessage
                              content={"Problem5"}
                            />
                            <MessageCenterMessage
                              content={"Problem6"}
                            />
                          </>
                        }
                        prompt="No messages."
                      />
                  }
                />
                <SnapModeIndicator
                  label="Snap Mode"
                  isLabelVisible={!this.props.isInWidgetMode}
                  onClick={this._handleToggleSnapModeDialog}
                  icon={
                    <SnapModeIcon text="k" />
                  }
                  dialog={
                    this.props.openWidget !== FooterWidget.SnapMode ? undefined :
                      <SnapModeDialog
                        title="Snap Mode"
                        snaps={
                          <>
                            <Snap
                              key="1"
                              isActive
                              label="Keypoint"
                              icon={
                                <SnapModeIcon isActive text="k" />
                              }
                            />
                            <Snap
                              key="2"
                              label="Intersection"
                              icon={
                                <SnapModeIcon text="i" />
                              }
                            />
                            <Snap
                              key="3"
                              label="Center"
                              icon={
                                <SnapModeIcon text="c" />
                              }
                            />
                            <Snap
                              key="4"
                              label="Nearest"
                              icon={
                                <SnapModeIcon text="n" />
                              }
                            />
                          </>
                        }
                      />
                  }
                />
              </>
            }
          />
        </FooterZone>
        <ZoneTargetExample
          bounds={this.props.targetBounds}
          zoneIndex={StatusZone.id}
          dropTarget={this.props.dropTarget}
          onTargetChanged={this.props.onTargetChanged}
        />
        {!this.props.outlineBounds ? undefined :
          <GhostOutline bounds={this.props.outlineBounds} />
        }
      </React.Fragment>
    );
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

  private _handleCloseMessageCenter = () => {
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

interface FloatingZoneProps extends Widget6Tab1ContentProps, Widget7Tab1ContentProps {
  bounds: RectangleProps;
  draggingWidget: DraggingWidgetProps | undefined;
  dropTarget: DropTarget;
  horizontalAnchor: HorizontalAnchor;
  onResize: (zoneId: WidgetZoneIndex, x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => void;
  onTabClick: (widgetId: WidgetZoneIndex, tabId: number) => void;
  onTabDragStart: (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, widgetOffset: PointProps) => void;
  onTabDragEnd: () => void;
  onTabDrag: (dragged: PointProps) => void;
  onTargetChanged: TargetChangedHandler;
  outlineBounds: RectangleProps | undefined;
  targetBounds: RectangleProps;
  verticalAnchor: VerticalAnchor;
  zone: ZonePropsBase;
}

class FloatingZone extends React.PureComponent<FloatingZoneProps> {
  public render() {
    return (
      <>
        <ZoneComponent
          bounds={this.props.bounds}
        >
          {this.props.zone.widgets.length > 0 &&
            <FloatingZoneWidget
              draggingWidget={this.props.draggingWidget}
              horizontalAnchor={this.props.horizontalAnchor}
              onChangeTheme={this.props.onChangeTheme}
              onResize={this.props.onResize}
              onOpenActivityMessage={this.props.onOpenActivityMessage}
              onOpenModalMessage={this.props.onOpenModalMessage}
              onOpenToastMessage={this.props.onOpenToastMessage}
              onOpenStickyMessage={this.props.onOpenStickyMessage}
              onShowTooltip={this.props.onShowTooltip}
              onToggleFooterMode={this.props.onToggleFooterMode}
              onTabClick={this.props.onTabClick}
              onTabDragStart={this.props.onTabDragStart}
              onTabDragEnd={this.props.onTabDragEnd}
              onTabDrag={this.props.onTabDrag}
              verticalAnchor={this.props.verticalAnchor}
              zone={this.props.zone}
            />
          }
        </ZoneComponent>
        <ZoneTargetExample
          bounds={this.props.targetBounds}
          dropTarget={this.props.dropTarget}
          zoneIndex={this.props.zone.id}
          onTargetChanged={this.props.onTargetChanged}
        />
        {this.props.outlineBounds &&
          <GhostOutline bounds={this.props.outlineBounds} />
        }
      </>
    );
  }
}

interface FloatingZoneWidgetProps extends Widget6Tab1ContentProps, Widget7Tab1ContentProps {
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
  public render() {
    const isOpen = this.props.zone.widgets.some((w) => w.tabIndex >= 0);
    const activeWidget = this.props.zone.widgets.find((widget) => widget.tabIndex >= 0);
    const isDragged = this.props.draggingWidget && this.props.draggingWidget.id === this.props.zone.id;
    return (
      <Stacked
        content={
          activeWidget &&
          <WidgetContent
            onChangeTheme={this.props.onChangeTheme}
            onOpenActivityMessage={this.props.onOpenActivityMessage}
            onOpenModalMessage={this.props.onOpenModalMessage}
            onOpenToastMessage={this.props.onOpenToastMessage}
            onOpenStickyMessage={this.props.onOpenStickyMessage}
            onShowTooltip={this.props.onShowTooltip}
            onToggleFooterMode={this.props.onToggleFooterMode}
            tabIndex={activeWidget.tabIndex}
            widgetId={activeWidget.id}
          />
        }
        fillZone={this.props.zone.isLayoutChanged}
        horizontalAnchor={this.props.horizontalAnchor}
        isDragged={isDragged}
        isFloating={this.props.zone.floating ? true : false}
        isOpen={isOpen}
        onResize={this._handleResize}
        tabs={
          <FloatingZoneTabs
            anchor={this.props.horizontalAnchor}
            draggingWidget={this.props.draggingWidget}
            isOpen={isOpen}
            onTabClick={this.props.onTabClick}
            onTabDragStart={this.props.onTabDragStart}
            onTabDragEnd={this.props.onTabDragEnd}
            onTabDrag={this.props.onTabDrag}
            zone={this.props.zone}
          />
        }
        verticalAnchor={this.props.verticalAnchor}
      />
    );
  }

  private _handleResize = (x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => {
    this.props.onResize(this.props.zone.id, x, y, handle, filledHeightDiff);
  }
}

interface FloatingZoneTabsProps {
  anchor: HorizontalAnchor;
  draggingWidget: DraggingWidgetProps | undefined;
  isOpen: boolean;
  onTabClick: (widgetId: WidgetZoneIndex, tabId: number) => void;
  onTabDragStart: (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, widgetOffset: PointProps) => void;
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
  onTabDragStart: (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, widgetOffset: PointProps) => void;
  onTabDragEnd: () => void;
  onTabDrag: (dragged: PointProps) => void;
  widget: WidgetProps;
}

class FloatingZoneWidgetTabs extends React.PureComponent<FloatingZoneWidgetTabsProps> {
  private getTabHandleMode() {
    if (this.props.draggingWidget && this.props.draggingWidget.id === this.props.widget.id && this.props.draggingWidget.isUnmerge)
      return VisibilityMode.Visible;

    if (this.props.isStacked)
      return VisibilityMode.OnHover;

    return VisibilityMode.Timeout;
  }

  private getTab(tabId: number, mode: TabMode, lastPosition: PointProps | undefined) {
    return (
      <FloatingZoneWidgetTab
        anchor={this.props.anchor}
        lastPosition={lastPosition}
        mode={mode}
        onClick={this.props.onTabClick}
        onDragStart={this.props.onTabDragStart}
        onDragEnd={this.props.onTabDragEnd}
        onDrag={this.props.onTabDrag}
        tabId={tabId}
        widgetId={this.props.widget.id}
      />
    );
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
            handleMode={handleMode}
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
            handleMode={handleMode}
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
  onDragStart: (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, widgetOffset: PointProps) => void;
  onDragEnd: () => void;
  onDrag: (dragged: PointProps) => void;
  tabId: number;
  widgetId: WidgetZoneIndex;
}

class FloatingZoneWidgetTab extends React.PureComponent<FloatingZoneWidgetTabProps> {
  public render() {
    return (
      <Draggable
        key="3_1"
        mode={this.props.mode}
        onClick={this._handleClick}
        lastPosition={this.props.lastPosition}
        onDragStart={this._handleDragStart}
        onDragEnd={this.props.onDragEnd}
        onDrag={this.props.onDrag}
        anchor={this.props.anchor}
      >
        {placeholderIcon}
      </Draggable>
    );
  }

  private _handleClick = () => {
    this.props.onClick(this.props.widgetId, this.props.tabId);
  }

  private _handleDragStart = (initialPosition: PointProps, widgetOffset: PointProps) => {
    this.props.onDragStart(this.props.widgetId, this.props.tabId, initialPosition, widgetOffset);
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
      <ZoneComponent
        bounds={this.props.bounds}
      >
        <Container>
          {this.props.dropTarget === DropTarget.Merge &&
            <Merge
              onTargetChanged={this._handleMergeTargetChanged}
            />
          }
          {this.props.dropTarget === DropTarget.Back &&
            <Back
              onTargetChanged={this._handleBackTargetChanged}
              zoneIndex={this.props.zoneIndex}
            />
          }
        </Container>
      </ZoneComponent>
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

interface TooltipExampleProps {
  containerSize: SizeProps;
  isTooltipVisible: boolean;
  isTemporaryMessageVisible: number;
  onMessageHidden: () => void;
  onTooltipTimeout: () => void;
}

interface TooltipExampleState {
  temporaryMessageStyle: React.CSSProperties;
  tooltipPosition: PointProps;
}

class TooltipExample extends React.PureComponent<TooltipExampleProps, TooltipExampleState> {
  private _temporaryMessageTimer = new Timer(2000);
  private _tooltipSize: SizeProps = new Size();
  private _mousePosition: PointProps = new Point();

  public readonly state = {
    tooltipPosition: {
      x: 0,
      y: 0,
    },
    temporaryMessageStyle: {},
  };

  public componentDidMount(): void {
    this._temporaryMessageTimer.setOnExecute(this.props.onMessageHidden);

    if (this.props.isTemporaryMessageVisible !== 0)
      this._temporaryMessageTimer.start();
  }

  public componentWillUnmount(): void {
    this._temporaryMessageTimer.stop();
  }

  public componentDidUpdate(prevProps: TooltipExampleProps): void {
    if (this.props.isTemporaryMessageVisible !== 0 && this.props.isTemporaryMessageVisible !== prevProps.isTemporaryMessageVisible) {
      this._temporaryMessageTimer.start();
      this.setState(() => ({
        temporaryMessageStyle: {
          left: this._mousePosition.x,
          top: this._mousePosition.y,
        },
      }));
    }
  }

  public render() {
    return (
      <>
        <MouseTracker onPositionChange={this._handlePositionChange} />
        {
          this.props.isTooltipVisible && (
            <TooltipWithTimeout
              stepString="Start Point"
              timeout={3000}
              onTimeout={this.props.onTooltipTimeout}
              position={this.state.tooltipPosition}
              onSizeChanged={this._handleTooltipSizeChange}
            >
              {placeholderIcon}
            </TooltipWithTimeout>
          )
        }
        {this.props.isTemporaryMessageVisible !== 0 &&
          <Temporary
            style={this.state.temporaryMessageStyle}
          >
            Text element required.
          </Temporary>
        }
      </>
    );
  }

  private _handlePositionChange = (position: PointProps) => {
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
      const tooltipPosition = adjustTooltipPosition(tooltipBounds, this.props.containerSize);
      if (tooltipPosition.equals(prevState.tooltipPosition))
        return null;
      return {
        tooltipPosition,
      };
    });
  }
}

interface ContentExampleProps {
  onClick: () => void;
}

class ContentExample extends React.PureComponent<ContentExampleProps> {
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
        className="content"
        ref={this._canvas}
        onClick={this.props.onClick}
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
  onChangeTheme: (themeContext: ThemeContextProps) => void;
}

class Widget6Tab1Content extends React.PureComponent<Widget6Tab1ContentProps> {
  public render() {
    return (
      <ThemeContext.Consumer>
        {
          (context) => (
            <BlueButton
              onClick={this._handleButtonClick(context)}
            >
              Theme: {context.theme.name}
            </BlueButton>
          )
        }
      </ThemeContext.Consumer>
    );
  }

  private _handleButtonClick = (context: ThemeContextProps) => () => {
    this.props.onChangeTheme(context);
  }
}

interface Widget7Tab1ContentProps {
  onOpenActivityMessage: () => void;
  onOpenModalMessage: () => void;
  onOpenToastMessage: () => void;
  onOpenStickyMessage: () => void;
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
        <br />
        <BlueButton onClick={this.props.onOpenModalMessage}>
          Show Modal Message
            </BlueButton>
        <br />
        <BlueButton onClick={this.props.onOpenToastMessage}>
          Show Toast Message
        </BlueButton>
        <br />
        <BlueButton onClick={this.props.onOpenStickyMessage}>
          Show Sticky Message
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

interface WidgetContentProps extends Widget6Tab1ContentProps, Widget7Tab1ContentProps {
  widgetId: WidgetZoneIndex;
  tabIndex: number;
}

class WidgetContent extends React.PureComponent<WidgetContentProps> {
  public render() {
    switch (this.props.widgetId) {
      case 4: {
        return `Hello world from zone4! (${this.props.tabIndex})`;
      }
      case 6: {
        return (
          <Widget6Tab1Content
            onChangeTheme={this.props.onChangeTheme} />
        );
      }
      case 7: {
        return (
          <Widget7Tab1Content
            onOpenActivityMessage={this.props.onOpenActivityMessage}
            onOpenModalMessage={this.props.onOpenModalMessage}
            onOpenStickyMessage={this.props.onOpenStickyMessage}
            onOpenToastMessage={this.props.onOpenToastMessage}
            onShowTooltip={this.props.onShowTooltip}
            onToggleFooterMode={this.props.onToggleFooterMode} />
        );
      }
      case 8: {
        return "Footer :)";
      }
      case 9: {
        switch (this.props.tabIndex) {
          case 1: {
            return (
              <Widget9Tab1Content />
            );
          }
          case 2: {
            return "Hello world 2!";
          }
        }
      }
    }
    return undefined;
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
          title={tray.title}
          columns={columns}
          onBack={this._handleBack}
        />
      );

    return (
      <ToolGroupContained
        title={tray.title}
        columns={columns}
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
  onHistoryItemClick: (item: HistoryItem) => void;
  onIsHistoryExtendedChange: (toolId: string, isExtended: boolean) => void;
  onOpenPanelGroup: (toolId: string, trayId: string | undefined) => void;
  onPanelBack: (toolId: string) => void;
  onPanelToolClick: (args: ToolbarItemGroupToolClickArgs) => void;
  onToolClick: (toolId: string) => void;
  verticalTools: Tools;
}

const getNumberOfVisibleTools = (tools: Tools) => {
  return Object.keys(tools).reduce<number>((acc, toolId) => {
    const tool = tools[toolId];
    if (tool.isHidden)
      return acc;
    return acc + 1;
  }, 0);
};

class Zone1 extends React.PureComponent<Zone1Props> {
  private _appButton = (
    <AppButton
      icon={
        <i className="icon icon-home" />
      }
    />
  );

  public render() {
    return (
      <ZoneComponent
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
              onPanelToolClick={this.props.onPanelToolClick}
              onToolClick={this.props.onToolClick}
              panelAlignment={ToolbarPanelAlignment.Start}
              tools={this.props.verticalTools}
            />
          }
        />
      </ZoneComponent>
    );
  }
}

interface Zone3Props extends Zone1Props {
  onToolbarScroll: () => void;
}

class Zone3 extends React.PureComponent<Zone3Props> {
  public render() {
    return (
      <ZoneComponent
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
              onPanelToolClick={this.props.onPanelToolClick}
              onScroll={this.props.onToolbarScroll}
              onToolClick={this.props.onToolClick}
              panelAlignment={ToolbarPanelAlignment.Start}
              tools={this.props.verticalTools}
            />
          }
        />
      </ZoneComponent>
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

type WidgetTabDragFn = (dragged: PointProps) => void;
type ZoneResizeFn = (zoneId: WidgetZoneIndex, x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => void;

const placeholderIcon = (
  <i className="icon icon-placeholder" />
);

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

export default class ZonesExample extends React.PureComponent<{}, State> {
  private _app = React.createRef<App>();
  private _dialogContainer = document.createElement("div");
  private _scheduleWidgetTabDrag: ScheduleFn<WidgetTabDragFn>;
  private _scheduleZoneResize: ScheduleFn<ZoneResizeFn>;

  public readonly state = {
    isNestedPopoverOpen: false,
    isPopoverOpen: false,
    isTemporaryMessageVisible: 0,
    isTooltipVisible: false,
    message: Message.None,
    nineZone: DefaultStateManager.mergeZone(9, 6,
      DefaultStateManager.setAllowsMerging(4, false,
        getDefaultNineZoneProps(),
      ),
    ),
    openWidget: FooterWidget.None,
    themeContext: {
      theme: PrimaryTheme,
      change: (theme: Theme) => {
        this.setState((prevProps) => {
          return {
            themeContext: {
              ...prevProps.themeContext,
              theme,
            },
          };
        });
      },
    },
    toastMessageKey: 0,
    tools: zoneTools,
    toolSettingsWidget: ToolSettingsWidgetMode.Open,
  };

  public constructor(p: {}) {
    super(p);

    this._scheduleWidgetTabDrag = rafSchedule(this._handleWidgetTabDrag);
    this._scheduleZoneResize = rafSchedule(this._handleZoneResize);
  }

  public componentDidMount(): void {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.layout(new Size(document.body.clientWidth, document.body.clientHeight), prevState.nineZone),
    }));

    if (this._app.current) {
      const node = ReactDOM.findDOMNode(this._app.current);
      if (node && (node instanceof HTMLElement))
        node.appendChild(this._dialogContainer);
    }

    window.addEventListener("resize", this._handleWindowResize, true);
  }

  public componentWillUnmount(): void {
    this._scheduleWidgetTabDrag.cancel();
    document.removeEventListener("resize", this._handleWindowResize, true);
  }

  public render() {
    return (
      <ThemeContext.Provider value={this.state.themeContext}>
        <App
          className={"nzdemo-pages-zones"}
          ref={this._app}
        >
          {this.getZones()}
          {this.getBackstage()}
          {this.getContent()}
        </App>
      </ThemeContext.Provider>
    );
  }

  private getZones() {
    const zones = Object.keys(this.state.nineZone.zones)
      .map((key) => Number(key) as WidgetZoneIndex)
      .sort((id1, id2) => {
        const z1 = this.state.nineZone.zones[id1];
        const z2 = this.state.nineZone.zones[id2];
        if (!z1.floating && !z2.floating)
          return z1.id - z2.id;

        if (!z1.floating)
          return -1;

        if (!z2.floating)
          return 1;

        return z1.floating.stackId - z2.floating.stackId;
      });
    return (
      <Zones>
        <TooltipExample
          containerSize={this.state.nineZone.size}
          isTemporaryMessageVisible={this.state.isTemporaryMessageVisible}
          isTooltipVisible={this.state.isTooltipVisible || false}
          onMessageHidden={this._handleTooltipMessageHidden}
          onTooltipTimeout={this._handleTooltipTimeout}
        />
        {zones.map((z) => this.getZone(z))}
      </Zones>
    );
  }

  private getBackstage() {
    return undefined;
  }

  private getContent() {
    return (
      <Content>
        <ContentExample
          onClick={this._handleContentClick}
        />
      </Content>
    );
  }

  private getToolSettingsWidget() {
    const tab = (
      <ToolSettingsTab
        isActive={this.state.toolSettingsWidget === ToolSettingsWidgetMode.Open}
        onClick={this._handleToolSettingsWidgetTabClick}
      >
        {placeholderIcon}
      </ToolSettingsTab>
    );
    switch (this.state.toolSettingsWidget) {
      case ToolSettingsWidgetMode.Minimized: {
        return (
          <ToolSettingsWidget
            tab={tab}
          />
        );
      }
      case ToolSettingsWidgetMode.Open: {
        return (
          <ToolSettingsWidget
            tab={tab}
            content={
              <ToolSettings>
                <Toggle
                  content={"Toggle"}
                  onClick={this._handlePopoverToggleClick}
                  popoverContent={
                    !this.state.isPopoverOpen ? undefined :
                      <ToolSettings>
                        <Toggle
                          content={"Toggle for nested popover"}
                          onClick={this._handleNestedPopoverToggleClick}
                          popoverContent={
                            !this.state.isNestedPopoverOpen ? undefined :
                              <Nested
                                label="Nested"
                                backButton={
                                  <HollowButton
                                    onClick={this._handleNestedToolSettingsBackClick}
                                    style={{ padding: "5px", lineHeight: "0" }}
                                  >
                                    <i className="icon icon-progress-backward-2" />
                                  </HollowButton>
                                }
                              >
                                <ScrollableArea>
                                  1. Settings
                                  2. SettingsSettingsSettings
                                  3. Settings
                                  4. Settings
                                  5. Settings
                                  6. Settings
                                  7. Settings
                                  8. Settings
                                  9. Settings
                                  10. Settings
                                  11. Settings
                                  12. Settings
                                  13. Settings
                                  14. Settings
                                  15. Settings
                                  16. Settings
                                  17. Settings
                                  18. Settings
                                  19. Settings
                                </ScrollableArea>
                              </Nested>
                          }
                        />
                      </ToolSettings>
                  }
                />
              </ToolSettings>
            }
          />
        );
      }
    }
  }

  private getZone(zoneId: WidgetZoneIndex) {
    switch (zoneId) {
      case 1:
        return this.getZone1();
      case 2:
        return this.getZone2();
      case 3:
        return this.getZone3();
      case 8: {
        return this.getStatusZone();
      }
      default:
        return this.getFloatingZone(zoneId);
    }
  }

  private getZone1() {
    const zoneId = 1;
    return (
      <Zone1
        bounds={this.state.nineZone.zones[zoneId].bounds}
        horizontalTools={this.state.tools[zoneId].horizontal}
        key={zoneId}
        onHistoryItemClick={this._handleHistoryItemClick}
        onIsHistoryExtendedChange={this._handleIsToolHistoryExtendedChange}
        onOpenPanelGroup={this._handleExpandPanelGroup}
        onPanelBack={this._handlePanelBack}
        onPanelToolClick={this._handlePanelToolClick}
        onToolClick={this._handleToolClick}
        verticalTools={this.state.tools[zoneId].vertical}
      />
    );
  }

  private getZone2() {
    const zoneId = 2;
    return (
      <ZoneComponent
        bounds={this.state.nineZone.zones[zoneId].bounds}
        key={zoneId}
      >
        {this.state.tools[1].horizontal.toolSettings.isActive && this.getToolSettingsWidget()}
      </ZoneComponent>
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
        onPanelToolClick={this._handlePanelToolClick}
        onToolbarScroll={this._handleToolbarScroll}
        onToolClick={this._handleToolClick}
        verticalTools={this.state.tools[zoneId].vertical}
      />
    );
  }

  private getFloatingZone(zoneId: WidgetZoneIndex) {
    const nineZone = new NineZone(this.state.nineZone);
    const zone = nineZone.getWidgetZone(zoneId);
    const bounds = zone.props.floating ? zone.props.floating.bounds : zone.props.bounds;
    const outlineBounds = zone.getGhostOutlineBounds();
    const dropTarget = zone.getDropTarget();
    const draggingWidget = nineZone.draggingWidget && nineZone.draggingWidget.zone.id === zone.id ? nineZone.draggingWidget.props : undefined;
    return (
      <FloatingZone
        draggingWidget={draggingWidget}
        dropTarget={dropTarget}
        horizontalAnchor={zone.horizontalAnchor}
        key={zoneId}
        bounds={bounds}
        outlineBounds={outlineBounds}
        targetBounds={zone.props.bounds}
        onChangeTheme={this._handleChangeTheme}
        onOpenActivityMessage={this._handleOpenActivityMessage}
        onOpenModalMessage={this._handleOpenModalMessage}
        onOpenToastMessage={this._handleOpenToastMessage}
        onOpenStickyMessage={this._handleOpenStickyMessage}
        onResize={this._scheduleZoneResize}
        onShowTooltip={this._handleShowTooltip}
        onTabClick={this._handleWidgetTabClick}
        onTabDragStart={this._handleWidgetTabDragStart}
        onTabDragEnd={this._handleWidgetTabDragEnd}
        onTabDrag={this._scheduleWidgetTabDrag}
        onTargetChanged={this._handleTargetChanged}
        onToggleFooterMode={this._handleToggleFooterMode}
        verticalAnchor={zone.verticalAnchor}
        zone={zone.props}
      />
    );
  }

  private getStatusZone() {
    const zoneId = StatusZone.id;
    const nineZone = new NineZone(this.state.nineZone);
    const statusZone = nineZone.getStatusZone();
    const isRectangularWidget = statusZone.props.widgets.length > 1;
    if (isRectangularWidget)
      return this.getFloatingZone(zoneId);

    const outlineBounds = statusZone.getGhostOutlineBounds();
    const dropTarget = statusZone.getDropTarget();
    const bounds = statusZone.props.floating ? statusZone.props.floating.bounds : statusZone.props.bounds;

    return (
      <StatusZoneExample
        bounds={bounds}
        dropTarget={dropTarget}
        isInWidgetMode={!statusZone.props.isInFooterMode}
        key={zoneId}
        onTargetChanged={this._handleTargetChanged}
        outlineBounds={outlineBounds}
        renderModalMessageTo={this._renderModalMessageTo}
        message={this.state.message}
        onHideMessage={this._handleHideMessage}
        onOpenWidgetChange={this._handleOpenWidgetChange}
        openWidget={this.state.openWidget}
        targetBounds={statusZone.props.bounds}
        toastMessageKey={this.state.toastMessageKey}
      />
    );
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
          toolSettingsWidget: ToolSettingsWidgetMode.Open,
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

  private _handleContentClick = () => {
    this.setState((prevState) => ({
      isTemporaryMessageVisible: prevState.isTemporaryMessageVisible + 1,
    }));
  }

  private _handleTooltipMessageHidden = () => {
    this.setState(() => ({
      isTemporaryMessageVisible: 0,
    }));
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

  private _handlePopoverToggleClick = () => {
    this.setState((prevState) => ({
      isNestedPopoverOpen: false,
      isPopoverOpen: !prevState.isPopoverOpen,
    }));
  }

  private _handleNestedPopoverToggleClick = () => {
    this.setState((prevState) => ({
      isNestedPopoverOpen: !prevState.isNestedPopoverOpen,
    }));
  }

  private _handleNestedToolSettingsBackClick = () => {
    this.setState(() => ({
      isNestedPopoverOpen: false,
    }));
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

  private _handleZoneResize = (zoneId: WidgetZoneIndex, x: number, y: number, handle: ResizeHandle, filledHeightDiff: number) => {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.handleResize(zoneId, x, y, handle, filledHeightDiff, prevState.nineZone),
    }));
  }

  private _handleWidgetTabDragStart = (widgetId: WidgetZoneIndex, tabId: number, initialPosition: PointProps, offset: PointProps) => {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.handleWidgetTabDragStart(widgetId, tabId, initialPosition, offset, prevState.nineZone),
    }));

    if (widgetId === StatusZone.id)
      this._handleWidgetTabDragEnd();
  }

  private _handleWidgetTabDragEnd = () => {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.handleWidgetTabDragEnd(prevState.nineZone),
    }));
  }

  private _handleWidgetTabDrag = (dragged: PointProps) => {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.handleWidgetTabDrag(dragged, prevState.nineZone),
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

  private _renderModalMessageTo = () => this._dialogContainer;

  private _handleChangeTheme = ({ theme, change }: ThemeContextProps) => {
    switch (theme) {
      case PrimaryTheme: {
        change && change(LightTheme);
        break;
      }
      case LightTheme: {
        change && change(DarkTheme);
        break;
      }
      case DarkTheme: {
        change && change(customTheme);
        break;
      }
      case customTheme: {
        change && change(PrimaryTheme);
        break;
      }
    }
  }

  private _handleToggleFooterMode = () => {
    this.setState((prevState) => ({
      nineZone: DefaultStateManager.setIsInFooterMode(!prevState.nineZone.zones[StatusZone.id].isInFooterMode, prevState.nineZone),
      openWidget: FooterWidget.None,
    }));
  }

  private _handleHideMessage = () => {
    this.setState(() => ({
      message: Message.None,
    }));
  }

  private _handleOpenActivityMessage = () => {
    this.setState(() => ({
      message: Message.Activity,
    }));
  }

  private _handleOpenModalMessage = () => {
    this.setState(() => ({
      message: Message.Modal,
    }));
  }

  private _handleOpenToastMessage = () => {
    this.setState((prevState) => ({
      message: Message.Toast,
      toastMessageKey: prevState.toastMessageKey + 1,
    }));
  }

  private _handleOpenStickyMessage = () => {
    this.setState(() => ({
      message: Message.Sticky,
    }));
  }

  private _handleOpenWidgetChange = (openWidget: FooterWidget) => {
    this.setState(() => ({
      openWidget,
    }));
  }

  private _handleToolSettingsWidgetTabClick = () => {
    this.setState((prevState) => ({
      toolSettingsWidget: prevState.toolSettingsWidget === ToolSettingsWidgetMode.Minimized ? ToolSettingsWidgetMode.Open : ToolSettingsWidgetMode.Minimized,
    }));
  }
}

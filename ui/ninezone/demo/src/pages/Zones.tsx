/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import * as React from "react";
import rafSchedule, { ScheduleFn } from "raf-schd";
import { Timer, withTimeout, Button, ButtonType, ButtonProps, Omit, withOnOutsideClick } from "@bentley/ui-core";
import { Backstage } from "@src/backstage/Backstage";
import { BackstageItem } from "@src/backstage/Item";
import { BackstageSeparator } from "@src/backstage/Separator";
import { AppButton } from "@src/widget/tools/button/App";
import { MouseTracker } from "@src/context/MouseTracker";
import { Footer } from "@src/footer/Footer";
import {
  MessageCenterDialog as MessageCenterDialogComponent,
  MessageCenterDialogContent as MessageCenterDialogContentComponent,
  MessageCenterButton,
} from "@src/footer/message-center/Dialog";
import { MessageCenterIndicator } from "@src/footer/message-center/Indicator";
import { MessageCenterMessage } from "@src/footer/message-center/Message";
import { MessageCenterTab } from "@src/footer/message-center/Tab";
import { SnapModeDialog as SnapModeDialogComponent, SnapModeDialogContent as SnapModeDialogContentComponent } from "@src/footer/snap-mode/Dialog";
import { SnapModeIcon } from "@src/footer/snap-mode/Icon";
import { SnapModeIndicator } from "@src/footer/snap-mode/Indicator";
import { Snap } from "@src/footer/snap-mode/Snap";
import { ToolAssistanceIndicator } from "@src/footer/tool-assistance/Indicator";
import { ToolAssistanceDialog as ToolAssistanceDialogComponent, ToolAssistanceDialogContent as ToolAssistanceDialogContentComponent } from "@src/footer/tool-assistance/Dialog";
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
import { Toast } from "@src/footer/message/Toast";
import { Nested } from "@src/widget/tool-settings/Nested";
import { ScrollableArea } from "@src/widget/tool-settings/ScrollableArea";
import { Toggle } from "@src/widget/tool-settings/Toggle";
import { ToolSettingsContent } from "@src/widget/tool-settings/Content";
import { ToolSettingsTooltip } from "@src/widget/tool-settings/Tooltip";
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
import { WidgetProps, DraggingWidgetProps } from "@src/zones/state/Widget";
import { TargetType, TargetZoneProps } from "@src/zones/state/Target";
import { ZonePropsBase, DropTarget, StatusZoneManager } from "@src/zones/state/Zone";
import { Container } from "@src/zones/target/Container";
import { Merge } from "@src/zones/target/Merge";
import { Back } from "@src/zones/target/Back";
import { Zone } from "@src/zones/Zone";
import { StatusZone } from "@src/zones/Status";
import { ToolSettingsZone } from "@src/zones/ToolSettings";
import { Zones } from "@src/zones/Zones";
import { GhostOutline } from "@src/zones/GhostOutline";
import { offsetAndContainInContainer } from "@src/popup/tooltip/Tooltip";
import { RectangleProps, Rectangle } from "@src/utilities/Rectangle";
import { withContainIn, containHorizontally } from "@src/base/WithContainIn";
import { OmitChildrenProp } from "@src/utilities/Props";
import "./Zones.scss";

const adjustTooltipPosition = offsetAndContainInContainer();
// tslint:disable-next-line:variable-name
const TooltipWithTimeout = withTimeout(ToolSettingsTooltip);
// tslint:disable-next-line:variable-name
const ToolGroupContained = withContainIn(withOnOutsideClick(Group, undefined, false));
// tslint:disable-next-line:variable-name
const NestedToolGroupContained = withContainIn(withOnOutsideClick(NestedGroup, undefined, false));
// tslint:disable-next-line:variable-name
const ToolAssistanceDialog = withOnOutsideClick(ToolAssistanceDialogComponent, undefined, false);
// tslint:disable-next-line:variable-name
const ToolAssistanceDialogContent = withContainIn(ToolAssistanceDialogContentComponent);
// tslint:disable-next-line:variable-name
const SnapModeDialog = withOnOutsideClick(SnapModeDialogComponent, undefined, false);
// tslint:disable-next-line:variable-name
const SnapModeDialogContent = withContainIn(SnapModeDialogContentComponent);
// tslint:disable-next-line:variable-name
const MessageCenterDialog = withOnOutsideClick(MessageCenterDialogComponent, undefined, false);
// tslint:disable-next-line:variable-name
const MessageCenterDialogContent = withContainIn(MessageCenterDialogContentComponent);

// tslint:disable-next-line:variable-name
const BlueButton = (props: ButtonProps & Omit<ButtonProps, "type">) => (
  <Button
    type={ButtonType.Blue}
    {...props}
  />
);

// tslint:disable-next-line:variable-name
const HollowButton = (props: ButtonProps & Omit<ButtonProps, "type">) => (
  <Button
    type={ButtonType.Hollow}
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

type Theme = "light" | "dark";

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
              <Label>Rendering 'big-image.png'</Label>
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

class ModalMessage extends React.PureComponent<MessageProps> {
  public render() {
    return (
      <Modal
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
              <Label>Unable to load 3 fonts, replaced with Arial.</Label>
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
  animateOutTo: React.RefObject<HTMLElement>;
}

class ToastMessageExample extends React.PureComponent<ToastMessageProps> {
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
                <Label>Image 'big.png' saved.</Label>
              }
            />
          </StatusMessage>
        }
        onAnimatedOut={this.props.onHideMessage}
      />
    );
  }
}

interface FooterMessageExampleProps {
  toastMessageKey: React.Key;
  message: Message;
  animateToastMessageTo: React.RefObject<HTMLElement>;
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
      case (Message.Toast): {
        return this.props.animateToastMessageTo === undefined ? null : (
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
  isInFooterMode: boolean;
  message: Message;
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
  private _messageCenterIndicatorContainer = React.createRef<HTMLDivElement>();

  public readonly state = {
    messageCenterTab: MessageCenterActiveTab.AllMessages,
  };

  public render() {
    return (
      <React.Fragment>
        <StatusZone
          isInFooterMode={this.props.isInFooterMode}
          bounds={this.props.bounds}
        >
          <Footer
            isInFooterMode={this.props.isInFooterMode}
            message={
              <FooterMessageExample
                toastMessageKey={this.props.toastMessageKey}
                animateToastMessageTo={this._messageCenterIndicatorContainer}
                onHideMessage={this.props.onHideMessage}
                message={this.props.message}
              />
            }
            indicators={
              <>
                <ToolAssistanceIndicator
                  dialog={
                    this.props.openWidget !== FooterWidget.ToolAssistance ? undefined :
                      <ToolAssistanceDialog
                        content={
                          <ToolAssistanceDialogContent
                            containFn={containHorizontally}
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
                            title="Trim Multiple - Tool Assistance"
                          />
                        }
                        onOutsideClick={this._handleOnOutsideDialogClick}
                      />
                  }
                  icons={
                    <>
                      <i className="icon icon-cursor" />
                      <i className="icon icon-add" />
                    </>
                  }
                  onClick={this._handleToggleToolAssistanceDialog}
                  stepString={this.props.isInFooterMode ? "Start Point" : undefined}
                />
                <div ref={this._messageCenterIndicatorContainer}>
                  <MessageCenterIndicator
                    balloonLabel="9+"
                    dialog={
                      this.props.openWidget !== FooterWidget.Messages ? undefined :
                        <MessageCenterDialog
                          content={
                            <MessageCenterDialogContent
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
                              containFn={containHorizontally}
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
                              title="Messages"
                            />
                          }
                          onOutsideClick={this._handleOnOutsideDialogClick}
                        />
                    }
                    label={this.props.isInFooterMode ? "Message(s):" : undefined}
                    onClick={this._handleToggleMessageCenterDialog}
                  />
                </div>
                <SnapModeIndicator
                  label={this.props.isInFooterMode ? "Snap Mode" : undefined}
                  onClick={this._handleToggleSnapModeDialog}
                  icon={
                    <SnapModeIcon>k</SnapModeIcon>
                  }
                  dialog={
                    this.props.openWidget !== FooterWidget.SnapMode ? undefined :
                      <SnapModeDialog
                        content={
                          <SnapModeDialogContent
                            containFn={containHorizontally}
                            snaps={
                              <>
                                <Snap
                                  key="1"
                                  isActive
                                  label="Keypoint"
                                  icon={
                                    <SnapModeIcon isActive>k</SnapModeIcon>
                                  }
                                />
                                <Snap
                                  key="2"
                                  label="Intersection"
                                  icon={
                                    <SnapModeIcon>i</SnapModeIcon>
                                  }
                                />
                                <Snap
                                  key="3"
                                  label="Center"
                                  icon={
                                    <SnapModeIcon>c</SnapModeIcon>
                                  }
                                />
                                <Snap
                                  key="4"
                                  label="Nearest"
                                  icon={
                                    <SnapModeIcon>n</SnapModeIcon>
                                  }
                                />
                              </>
                            }
                            title="Snap Mode"
                          />
                        }
                        onOutsideClick={this._handleOnOutsideDialogClick}
                      />
                  }
                />
              </>
            }
          />
        </StatusZone>
        <ZoneTargetExample
          bounds={this.props.targetBounds}
          zoneIndex={StatusZoneManager.id}
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

  private _handleOnOutsideDialogClick = () => {
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
        <Zone
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
              theme={this.props.theme}
              zone={this.props.zone}
            />
          }
        </Zone>
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
  private _widget = React.createRef<Stacked>();

  public render() {
    const isOpen = this.props.zone.widgets.some((w) => w.tabIndex >= 0);
    const activeWidget = this.props.zone.widgets.find((widget) => widget.tabIndex >= 0);
    const isDragged = this.props.draggingWidget && this.props.draggingWidget.id === this.props.zone.id;
    return (
      <Stacked
        content={
          activeWidget &&
          <WidgetContentExample
            anchor={this.props.horizontalAnchor}
            onChangeTheme={this.props.onChangeTheme}
            onOpenActivityMessage={this.props.onOpenActivityMessage}
            onOpenModalMessage={this.props.onOpenModalMessage}
            onOpenToastMessage={this.props.onOpenToastMessage}
            onOpenStickyMessage={this.props.onOpenStickyMessage}
            onShowTooltip={this.props.onShowTooltip}
            onToggleFooterMode={this.props.onToggleFooterMode}
            tabIndex={activeWidget.tabIndex}
            theme={this.props.theme}
            widgetId={activeWidget.id}
          />
        }
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
        tabRef={tabId === 1 ? this._firstTab : undefined}
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
  tabRef?: React.RefObject<Tab>;
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
        ref={this.props.tabRef}
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

interface TooltipExampleProps {
  containerSize: SizeProps;
  isTooltipVisible: boolean;
  isTemporaryMessageVisible: number;
  onMessageHidden: () => void;
  onTooltipTimeout: () => void;
}

interface TooltipExampleState {
  temporaryMessageStyle: React.CSSProperties | undefined;
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
    temporaryMessageStyle: undefined,
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

interface ContentProps {
  onClick: () => void;
}

class Content extends React.PureComponent<ContentProps> {
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
        onClick={this.props.onClick}
        style={{ cursor: "crosshair" }}
        ref={this._canvas}
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
  anchor: HorizontalAnchor;
  tabIndex: number;
  widgetId: WidgetZoneIndex;
}

class WidgetContentExample extends React.PureComponent<WidgetContentProps> {
  public render() {
    let content: React.ReactNode;
    switch (this.props.widgetId) {
      case 4: {
        content = (`Hello world from zone4! (${this.props.tabIndex})`);
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
            onOpenModalMessage={this.props.onOpenModalMessage}
            onOpenStickyMessage={this.props.onOpenStickyMessage}
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
    return (
      <WidgetContent
        anchor={this.props.anchor}
        content={content}
      />
    );
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
    children: function(this: ToolZoneToolbarProps, items: React.ReactNode) {
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
        label={`Item ${this.props.id}`}
        onClick={this._handleClick}
      />
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
        isOpen={this.props.isOpen}
        items={
          <>
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
          </>
        }
        onClose={this.props.onClose}
      />
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

const initialTheme: Theme = "light";

interface State {
  isBackstageOpen: boolean;
  isNestedPopoverOpen: boolean;
  isPopoverOpen: boolean;
  isTemporaryMessageVisible: number;
  isTooltipVisible: boolean;
  message: Message;
  nineZone: NineZoneProps;
  openWidget: FooterWidget;
  theme: Theme;
  toolSettingsMode: ToolSettingsMode;
  tools: ZoneTools | HiddenZoneTools;
  toastMessageKey: number;
}

export default class ZonesExample extends React.PureComponent<{}, State> {
  private _scheduleWidgetTabDrag: ScheduleFn<WidgetTabDragFn>;
  private _scheduleZoneResize: ScheduleFn<ZoneResizeFn>;

  public readonly state = {
    isBackstageOpen: false,
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
    theme: initialTheme,
    toastMessageKey: 0,
    tools: zoneTools,
    toolSettingsMode: ToolSettingsMode.Open,
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

    window.addEventListener("resize", this._handleWindowResize, true);
  }

  public componentWillUnmount(): void {
    this._scheduleWidgetTabDrag.cancel();
    document.removeEventListener("resize", this._handleWindowResize, true);
  }

  public render() {
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
      <div
        className={"nzdemo-pages-zones"}
      >
        <Content
          onClick={this._handleContentClick}
        />
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
        <BackstageExample
          isOpen={this.state.isBackstageOpen}
          onClose={this._handleBackstageClose}
        />
        {this.state.message === Message.Modal &&
          <ModalMessage
            onHideMessage={this._handleHideMessage}
          />
        }
      </div>
    );
  }

  private getToolSettings() {
    if (this.state.toolSettingsMode === ToolSettingsMode.Minimized)
      return (
        <ToolSettingsTab
          onClick={this._handleToolSettingsTabClick}
        >
          {placeholderIcon}
        </ToolSettingsTab>
      );

    return (
      <ToolSettings
        buttons={
          <DialogButton
            onClick={this._handleToolSettingsTabClick}
            title="Minimize"
          >
            <i className={"icon icon-chevron-up"} />
          </DialogButton>
        }
        title="Tool Settings"
      >
        <ToolSettingsContent>
          <Toggle
            content={"Toggle"}
            onClick={this._handlePopoverToggleClick}
            popupContent={
              !this.state.isPopoverOpen ? undefined : (
                <ToolSettingsContent>
                  <Toggle
                    content={"Toggle for nested popover"}
                    onClick={this._handleNestedPopoverToggleClick}
                    popupContent={
                      !this.state.isNestedPopoverOpen ? undefined : (
                        <Nested
                          label="Nested"
                          backButton={
                            <HollowButton
                              onClick={this._handleNestedToolSettingsBackClick}
                              style={{ padding: "5px", lineHeight: "0", margin: "0" }}
                            >
                              <i className="icon icon-progress-backward-2" />
                            </HollowButton>
                          }
                        >
                          <ScrollableArea>
                            <ToolSettingsContent>
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
                            </ToolSettingsContent>
                          </ScrollableArea>
                        </Nested>
                      )
                    }
                  />
                </ToolSettingsContent>
              )
            }
          />
        </ToolSettingsContent>
      </ToolSettings>
    );
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
      <ToolSettingsZone
        bounds={this.state.nineZone.zones[zoneId].bounds}
        key={zoneId}
      >
        {this.state.tools[1].horizontal.toolSettings.isActive && this.getToolSettings()}
      </ToolSettingsZone>
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
        theme={this.state.theme}
        verticalAnchor={zone.verticalAnchor}
        zone={zone.props}
      />
    );
  }

  private getStatusZone() {
    const zoneId = StatusZoneManager.id;
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
        isInFooterMode={statusZone.props.isInFooterMode}
        key={zoneId}
        onTargetChanged={this._handleTargetChanged}
        outlineBounds={outlineBounds}
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

    if (widgetId === StatusZoneManager.id)
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

  private _handleToolSettingsTabClick = () => {
    this.setState((prevState) => ({
      toolSettingsMode: prevState.toolSettingsMode === ToolSettingsMode.Minimized ? ToolSettingsMode.Open : ToolSettingsMode.Minimized,
    }));
  }
}

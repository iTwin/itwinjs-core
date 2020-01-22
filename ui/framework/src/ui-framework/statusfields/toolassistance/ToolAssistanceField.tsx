/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Notification
 */

import * as React from "react";
import classnames from "classnames";

import { Logger } from "@bentley/bentleyjs-core";
import {
  IModelApp,
  ToolAssistanceInstructions, ToolAssistanceInstruction, ToolAssistanceSection, ToolAssistanceImage,
  ToolAssistanceKeyboardInfo, ToolAssistanceInputMethod,
} from "@bentley/imodeljs-frontend";
import {
  SvgSprite, FillCentered, LocalUiSettings, UiSettingsStatus, UiSettings,
  HorizontalTabs, UiCore, LabeledToggle, Icon,
} from "@bentley/ui-core";
import {
  ToolAssistance, ToolAssistanceDialog, FooterPopup,
  ToolAssistanceInstruction as NZ_ToolAssistanceInstruction, ToolAssistanceSeparator, ToolAssistanceItem, TitleBarButton,
} from "@bentley/ui-ninezone";

import { StatusFieldProps } from "../StatusFieldProps";
import { CursorPrompt } from "../../cursor/cursorprompt/CursorPrompt";
import { MessageManager, ToolAssistanceChangedEventArgs } from "../../messages/MessageManager";
import { FrontstageManager, ToolIconChangedEventArgs } from "../../frontstage/FrontstageManager";
import { StatusBarFieldId } from "../../statusbar/StatusBarWidgetControl";
import { UiFramework } from "../../UiFramework";

import "./ToolAssistanceField.scss";
import acceptPointIcon from "./accept-point.svg";
import cursorClickIcon from "./cursor-click.svg";
import clickLeftIcon from "./mouse-click-left.svg";
import clickRightIcon from "./mouse-click-right.svg";
import mouseWheelClickIcon from "./mouse-click-wheel.svg";
import clickLeftDragIcon from "./mouse-click-left-drag.svg";
import clickRightDragIcon from "./mouse-click-right-drag.svg";
import clickMouseWheelDragIcon from "./mouse-click-wheel-drag.svg";
import oneTouchTapIcon from "./gesture-one-finger-tap.svg";
import oneTouchDoubleTapIcon from "./gesture-one-finger-tap-double.svg";
import oneTouchDragIcon from "./gesture-one-finger-drag.svg";
import twoTouchTapIcon from "./gesture-two-finger-tap.svg";
import twoTouchDragIcon from "./gesture-two-finger-drag.svg";
import twoTouchPinchIcon from "./gesture-pinch.svg";
import touchCursorTapIcon from "./touch-cursor-point.svg";
import touchCursorDragIcon from "./touch-cursor-pan.svg";

/** Properties of [[ToolAssistanceField]] component.
 * @beta
 */
export interface ToolAssistanceFieldProps extends StatusFieldProps {
  /** Indicates whether to include promptAtCursor Checkbox. Defaults to true. */
  includePromptAtCursor: boolean;
  /** Optional parameter for persistent UI settings. Defaults to LocalUiSettings. */
  uiSettings: UiSettings;
  /** Cursor Prompt Timeout period. Defaults to 5000. */
  cursorPromptTimeout: number;
  /** Fade Out the Cursor Prompt when closed. */
  fadeOutCursorPrompt: boolean;
  /** Indicates whether to show promptAtCursor by default. Defaults to false. */
  defaultPromptAtCursor: boolean;
}

/** Default properties of [[ToolAssistanceField]] component.
 * @internal
 */
export type ToolAssistanceFieldDefaultProps = Pick<ToolAssistanceFieldProps,
  "includePromptAtCursor" | "uiSettings" | "cursorPromptTimeout" | "fadeOutCursorPrompt" | "defaultPromptAtCursor">;

/** @internal */
interface ToolAssistanceFieldState {
  instructions: ToolAssistanceInstructions | undefined;
  toolIconSpec: string;
  showPromptAtCursor: boolean;
  includeMouseInstructions: boolean;
  includeTouchInstructions: boolean;
  showMouseTouchTabs: boolean;
  showMouseInstructions: boolean;
  showTouchInstructions: boolean;
  mouseTouchTabIndex: number;
  isPinned: boolean;
  target: HTMLElement | null;
}

/** Tool Assistance Field React component.
 * @beta
 */
export class ToolAssistanceField extends React.Component<ToolAssistanceFieldProps, ToolAssistanceFieldState> {
  private static _toolAssistanceKey = "ToolAssistance";
  private static _showPromptAtCursorKey = "showPromptAtCursor";
  private static _mouseTouchTabIndexKey = "mouseTouchTabIndex";
  private _className: string;
  private _indicator = React.createRef<HTMLDivElement>();
  private _cursorPrompt: CursorPrompt;

  /** @internal */
  public static readonly defaultProps: ToolAssistanceFieldDefaultProps = {
    includePromptAtCursor: true,
    cursorPromptTimeout: 5000,
    fadeOutCursorPrompt: true,
    defaultPromptAtCursor: false,
    uiSettings: new LocalUiSettings(),
  };

  constructor(p: ToolAssistanceFieldProps) {
    super(p);

    const instance = this.constructor;
    this._className = instance.name;

    const mobile = UiFramework.isMobile();

    this.state = {
      instructions: undefined,
      toolIconSpec: "",
      showPromptAtCursor: false,
      includeMouseInstructions: !mobile,
      includeTouchInstructions: true,
      showMouseTouchTabs: false,
      showMouseInstructions: false,
      showTouchInstructions: false,
      mouseTouchTabIndex: 0,
      isPinned: false,
      target: null,
    };

    this._cursorPrompt = new CursorPrompt(this.props.cursorPromptTimeout, this.props.fadeOutCursorPrompt);
  }

  /** @internal */
  public componentDidMount() {
    MessageManager.onToolAssistanceChangedEvent.addListener(this._handleToolAssistanceChangedEvent);
    FrontstageManager.onToolIconChangedEvent.addListener(this._handleToolIconChangedEvent);

    let showPromptAtCursor = this.props.defaultPromptAtCursor;
    let result = this.props.uiSettings.getSetting(ToolAssistanceField._toolAssistanceKey, ToolAssistanceField._showPromptAtCursorKey);

    // istanbul ignore else
    if (result.status === UiSettingsStatus.Success)
      showPromptAtCursor = result.setting as boolean;

    let mouseTouchTabIndex = 0;
    result = this.props.uiSettings.getSetting(ToolAssistanceField._toolAssistanceKey, ToolAssistanceField._mouseTouchTabIndexKey);

    // istanbul ignore else
    if (result.status === UiSettingsStatus.Success)
      mouseTouchTabIndex = result.setting as number;

    this.setState({ showPromptAtCursor, mouseTouchTabIndex });
  }

  /** @internal */
  public componentWillUnmount() {
    MessageManager.onToolAssistanceChangedEvent.removeListener(this._handleToolAssistanceChangedEvent);
    FrontstageManager.onToolIconChangedEvent.removeListener(this._handleToolIconChangedEvent);
  }

  private _handleToolAssistanceChangedEvent = (args: ToolAssistanceChangedEventArgs): void => {
    let showMouseTouchTabs = false;
    let showMouseInstructions = false;
    let showTouchInstructions = false;

    if (args.instructions && args.instructions.sections) {
      const hasMouseInstructions = args.instructions.sections.some((section: ToolAssistanceSection) => {
        return section.instructions.some((instruction: ToolAssistanceInstruction) => this._isMouseInstruction(instruction));
      });
      const hasTouchInstructions = args.instructions.sections.some((section: ToolAssistanceSection) => {
        return section.instructions.some((instruction: ToolAssistanceInstruction) => this._isTouchInstruction(instruction));
      });

      if (this.state.includeMouseInstructions && this.state.includeTouchInstructions && hasMouseInstructions && hasTouchInstructions) {
        showMouseTouchTabs = true;
        showMouseInstructions = this.state.mouseTouchTabIndex === 0;
        showTouchInstructions = this.state.mouseTouchTabIndex === 1;
      } else {
        if (this.state.includeMouseInstructions && hasMouseInstructions)
          showMouseInstructions = true;
        else if (this.state.includeTouchInstructions && hasTouchInstructions)
          showTouchInstructions = true;
      }
    }

    this.setState(
      {
        instructions: args.instructions,
        showMouseTouchTabs,
        showMouseInstructions,
        showTouchInstructions,
      },
      () => {
        this._showCursorPrompt();
      },
    );
  }

  private _isBothInstruction = (instruction: ToolAssistanceInstruction) => {
    return instruction.inputMethod === undefined || instruction.inputMethod === ToolAssistanceInputMethod.Both;
  }

  private _isMouseInstruction = (instruction: ToolAssistanceInstruction) => instruction.inputMethod === ToolAssistanceInputMethod.Mouse;

  private _isTouchInstruction = (instruction: ToolAssistanceInstruction) => instruction.inputMethod === ToolAssistanceInputMethod.Touch;

  private _handleToolIconChangedEvent = (args: ToolIconChangedEventArgs): void => {
    this.setState(
      { toolIconSpec: args.iconSpec },
      () => {
        this._showCursorPrompt();
      },
    );

  }

  private _showCursorPrompt() {
    if (this.state.showPromptAtCursor && this.state.instructions)
      this._cursorPrompt.display(this.state.toolIconSpec, this.state.instructions.mainInstruction);
  }

  private _sectionHasDisplayableInstructions(section: ToolAssistanceSection): boolean {
    const displayableInstructions = this._getDisplayableInstructions(section);
    return displayableInstructions.length > 0;
  }

  private _getDisplayableInstructions(section: ToolAssistanceSection): ToolAssistanceInstruction[] {
    const displayableInstructions = section.instructions.filter((instruction: ToolAssistanceInstruction) => {
      return (
        this._isBothInstruction(instruction)
        || (this.state.showMouseInstructions && this._isMouseInstruction(instruction))
        || (this.state.showTouchInstructions && this._isTouchInstruction(instruction))
      );
    });
    return displayableInstructions;
  }

  private _handleMouseTouchTab = (index: number) => {
    this.props.uiSettings.saveSetting(ToolAssistanceField._toolAssistanceKey, ToolAssistanceField._mouseTouchTabIndexKey, index);

    const showMouseInstructions = index === 0;
    const showTouchInstructions = index === 1;

    this.setState({
      mouseTouchTabIndex: index,
      showMouseInstructions,
      showTouchInstructions,
    });
  }

  /** @internal */
  public render(): React.ReactNode {
    const { instructions } = this.state;

    const dialogTitle = (IModelApp.toolAdmin.activeTool) ? IModelApp.toolAdmin.activeTool.flyover : UiFramework.translate("toolAssistance.title");
    const mouseLabel = UiFramework.translate("toolAssistance.mouse");
    const touchLabel = UiFramework.translate("toolAssistance.touch");
    let prompt = "";
    let tooltip = "";
    let toolIcon: React.ReactNode;
    let dialogContent: React.ReactNode;

    if (instructions) {
      prompt = instructions.mainInstruction.text;
      toolIcon = <Icon iconSpec={this.state.toolIconSpec} />;

      let displayableSections: ToolAssistanceSection[] | undefined;
      if (instructions.sections) {
        displayableSections = instructions.sections.filter((section: ToolAssistanceSection) => this._sectionHasDisplayableInstructions(section));
      }

      dialogContent = (
        <div>
          {this.state.showMouseTouchTabs &&
            <HorizontalTabs className="uifw-toolAssistance-tabs" labels={[mouseLabel, touchLabel]} activeIndex={this.state.mouseTouchTabIndex} onClickLabel={this._handleMouseTouchTab} />
          }

          <div className="uifw-toolAssistance-content">
            <NZ_ToolAssistanceInstruction
              key="main"
              image={ToolAssistanceField.getInstructionImage(instructions.mainInstruction)}
              text={instructions.mainInstruction.text}
              isNew={instructions.mainInstruction.isNew} />

            {displayableSections && displayableSections.map((section: ToolAssistanceSection, index1: number) => {
              return (
                <React.Fragment key={index1.toString()}>
                  <ToolAssistanceSeparator key={index1.toString()}>{section.label}</ToolAssistanceSeparator>
                  {this._getDisplayableInstructions(section).map((instruction: ToolAssistanceInstruction, index2: number) => {
                    return (
                      <NZ_ToolAssistanceInstruction
                        key={index1.toString() + "-" + index2.toString()}
                        image={ToolAssistanceField.getInstructionImage(instruction)}
                        text={instruction.text}
                        isNew={instruction.isNew} />
                    );
                  })}
                </React.Fragment>
              );
            })}

            {this.props.includePromptAtCursor &&
              <>
                <ToolAssistanceSeparator key="prompt-sep" />
                <ToolAssistanceItem key="prompt-item">
                  <LabeledToggle
                    label={UiFramework.translate("toolAssistance.promptAtCursor")}
                    isOn={this.state.showPromptAtCursor} onChange={this._onPromptAtCursorChange} />
                </ToolAssistanceItem>
              </>
            }
          </div>
        </div>
      );
    }

    if (prompt)
      tooltip = prompt;

    // istanbul ignore next
    if (IModelApp.toolAdmin.activeTool)
      tooltip = `${IModelApp.toolAdmin.activeTool.flyover} > ${tooltip}  `;

    if (tooltip) {
      const lineBreak = "\u000d\u000a";
      tooltip = tooltip + lineBreak;
    }

    tooltip += UiFramework.translate("toolAssistance.moreInfo");

    return (
      <>
        <div ref={this._handleTargetRef} title={tooltip}>
          <ToolAssistance
            icons={
              <>
                {toolIcon}
              </>
            }
            indicatorRef={this._indicator}
            className="uifw-statusFields-toolassistance"
            isInFooterMode={this.props.isInFooterMode}
            onClick={this._handleToolAssistanceIndicatorClick}
          >
            {this.props.isInFooterMode ? prompt : undefined}
          </ToolAssistance>
        </div>
        <FooterPopup
          isOpen={this.props.openWidget === this._className}
          onClose={this._handleClose}
          onOutsideClick={this._handleOutsideClick}
          target={this.state.target}
          isPinned={this.state.isPinned}
        >
          <ToolAssistanceDialog
            buttons={
              <>
                {!this.state.isPinned &&
                  <TitleBarButton onClick={this._handlePinButtonClick} title={UiFramework.translate("toolAssistance.pin")}>
                    <i className={"icon icon-pin"} />
                  </TitleBarButton>
                }
                {this.state.isPinned &&
                  <TitleBarButton onClick={this._handleCloseButtonClick} title={UiCore.translate("dialog.close")}>
                    <i className={"icon icon-close"} />
                  </TitleBarButton>
                }
              </>
            }
            title={dialogTitle}
          >
            {dialogContent}
          </ToolAssistanceDialog>
        </FooterPopup>
      </>
    );
  }

  private _handleTargetRef = (target: HTMLElement | null) => {
    this.setState({ target });
  }

  private _onPromptAtCursorChange = (checked: boolean) => {
    this.props.uiSettings.saveSetting(ToolAssistanceField._toolAssistanceKey, ToolAssistanceField._showPromptAtCursorKey, checked);

    this.setState({ showPromptAtCursor: checked });
  }

  private _handleClose = () => {
    this.setOpenWidget(null);
  }

  private _handleOutsideClick = (e: MouseEvent) => {
    if (this.state.isPinned)
      return;

    if (!this._indicator.current ||
      !(e.target instanceof Node) ||
      this._indicator.current.contains(e.target))
      return;

    this._handleClose();
  }

  private _handleToolAssistanceIndicatorClick = () => {
    const isOpen = this.props.openWidget === this._className;
    if (isOpen) {
      if (this.state.isPinned)
        this.setState({ isPinned: false });
      this.setOpenWidget(null);
    } else
      this.setOpenWidget(this._className);
  }

  private _handlePinButtonClick = () => {
    this.setState({ isPinned: true });
  }

  private _handleCloseButtonClick = () => {
    this.setState({ isPinned: false });
    this._handleClose();
  }

  private setOpenWidget(openWidget: StatusBarFieldId) {
    // istanbul ignore else
    if (this.props.onOpenWidget)
      this.props.onOpenWidget(openWidget);
  }

  /** @internal */
  public static getInstructionImage(instruction: ToolAssistanceInstruction): React.ReactNode {
    let image: React.ReactNode;

    if ((typeof instruction.image === "string" || instruction.image !== ToolAssistanceImage.Keyboard) && instruction.keyboardInfo) {
      if (instruction.keyboardInfo.keys.length === 1 && !instruction.keyboardInfo.bottomKeys) {
        const key = instruction.keyboardInfo.keys[0];
        const rightImage = (typeof instruction.image === "string") ?
          <div className="uifw-toolassistance-icon-medium"><Icon iconSpec={instruction.image} /></div> :
          this.getInstructionSvgImage(instruction, true);

        image = (
          <FillCentered>
            {ToolAssistanceField.getKeyNode(key, 0, "uifw-toolassistance-key-modifier")}
            {rightImage}
          </FillCentered>
        );
      } else {
        Logger.logError(UiFramework.loggerCategory(this), `getInstructionImage: Invalid keyboardInfo provided with image`);
      }
    } else if (typeof instruction.image === "string") {
      if (instruction.image)
        image = <div className="uifw-toolassistance-icon-large"><Icon iconSpec={instruction.image} /></div>;
    } else if (instruction.image === ToolAssistanceImage.Keyboard) {
      if (instruction.keyboardInfo) {
        image = ToolAssistanceField.getInstructionKeyboardImage(instruction.keyboardInfo);
      } else {
        Logger.logError(UiFramework.loggerCategory(this), `getInstructionImage: ToolAssistanceImage.Keyboard specified but no keyboardInfo provided`);
      }
    } else {
      image = this.getInstructionSvgImage(instruction, false);
    }

    return image;
  }

  private static getInstructionSvgImage(instruction: ToolAssistanceInstruction, mediumSize: boolean): React.ReactNode {
    let image: React.ReactNode;
    let className = mediumSize ? "uifw-toolassistance-svg-medium" : "uifw-toolassistance-svg";

    // istanbul ignore else
    if (typeof instruction.image !== "string" && instruction.image !== ToolAssistanceImage.Keyboard) {
      const toolAssistanceImage: ToolAssistanceImage = instruction.image;
      let svgImage = "";

      switch (toolAssistanceImage) {
        case ToolAssistanceImage.AcceptPoint:
          svgImage = acceptPointIcon;
          break;
        case ToolAssistanceImage.CursorClick:
          svgImage = cursorClickIcon;
          break;
        case ToolAssistanceImage.LeftClick:
          svgImage = clickLeftIcon;
          break;
        case ToolAssistanceImage.RightClick:
          svgImage = clickRightIcon;
          break;
        case ToolAssistanceImage.MouseWheel:
          svgImage = mouseWheelClickIcon;
          break;
        case ToolAssistanceImage.LeftClickDrag:
          svgImage = clickLeftDragIcon;
          className = mediumSize ? "uifw-toolassistance-svg-medium-wide" : "uifw-toolassistance-svg-wide";
          break;
        case ToolAssistanceImage.RightClickDrag:
          svgImage = clickRightDragIcon;
          className = mediumSize ? "uifw-toolassistance-svg-medium-wide" : "uifw-toolassistance-svg-wide";
          break;
        case ToolAssistanceImage.MouseWheelClickDrag:
          svgImage = clickMouseWheelDragIcon;
          className = mediumSize ? "uifw-toolassistance-svg-medium-wide" : "uifw-toolassistance-svg-wide";
          break;
        case ToolAssistanceImage.OneTouchTap:
          svgImage = oneTouchTapIcon;
          break;
        case ToolAssistanceImage.OneTouchDoubleTap:
          svgImage = oneTouchDoubleTapIcon;
          break;
        case ToolAssistanceImage.OneTouchDrag:
          svgImage = oneTouchDragIcon;
          break;
        case ToolAssistanceImage.TwoTouchTap:
          svgImage = twoTouchTapIcon;
          break;
        case ToolAssistanceImage.TwoTouchDrag:
          svgImage = twoTouchDragIcon;
          break;
        case ToolAssistanceImage.TwoTouchPinch:
          svgImage = twoTouchPinchIcon;
          break;
        case ToolAssistanceImage.TouchCursorTap:
          svgImage = touchCursorTapIcon;
          break;
        case ToolAssistanceImage.TouchCursorDrag:
          svgImage = touchCursorDragIcon;
          className = mediumSize ? "uifw-toolassistance-svg-medium-wide" : "uifw-toolassistance-svg-wide";
          break;
      }

      image = (
        <div className={className}>
          {svgImage &&
            <SvgSprite src={svgImage} />
          }
        </div>
      );
    }

    return image;
  }

  private static getInstructionKeyboardImage(keyboardInfo: ToolAssistanceKeyboardInfo): React.ReactNode {
    let image: React.ReactNode;

    if (keyboardInfo.bottomKeys !== undefined) {
      image = (
        <div className="uifw-toolassistance-key-group">
          <span className="row1">
            {keyboardInfo.keys.map((key: string, index1: number) => {
              return ToolAssistanceField.getKeyNode(key, index1, "uifw-toolassistance-key-small");
            })}
          </span>
          <br />
          <span className="row2">
            {keyboardInfo.bottomKeys.map((key: string, index2: number) => {
              return ToolAssistanceField.getKeyNode(key, index2, "uifw-toolassistance-key-small");
            })}
          </span>
        </div>
      );
    } else if (keyboardInfo.keys.length === 2) {
      image = (
        <FillCentered>
          {keyboardInfo.keys.map((key: string, index3: number) => {
            let className = "uifw-toolassistance-key-medium";
            if (key.length > 1)
              className = "uifw-toolassistance-key-modifier";
            return ToolAssistanceField.getKeyNode(key, index3, className);
          })}
        </FillCentered>
      );
    } else if (keyboardInfo.keys[0]) {
      if (keyboardInfo.keys[0].length > 1)
        image = ToolAssistanceField.getKeyNode(keyboardInfo.keys[0], 0, "uifw-toolassistance-key-large");
      else
        image = ToolAssistanceField.getKeyNode(keyboardInfo.keys[0], 0);
    } else {
      Logger.logError(UiFramework.loggerCategory(this), `ToolAssistanceImage.Keyboard specified but ToolAssistanceKeyboardInfo not valid`);
    }

    return image;
  }

  private static getKeyNode(key: string, index: number, className?: string): React.ReactNode {
    return (
      <div key={index.toString()} className={classnames("uifw-toolassistance-key", className)}>
        <FillCentered>{key}</FillCentered>
      </div>
    );
  }
}

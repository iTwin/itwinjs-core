/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Notification */

import * as React from "react";
import classnames from "classnames";

import { Logger } from "@bentley/bentleyjs-core";
import {
  IModelApp,
  ToolAssistanceInstructions, ToolAssistanceInstruction, ToolAssistanceSection, ToolAssistanceImage,
  ToolAssistanceKeyboardInfo, ToolAssistanceInputMethod,
} from "@bentley/imodeljs-frontend";
import { Checkbox, SvgSprite, FillCentered, LocalUiSettings, UiSettingsStatus, UiSettings, HorizontalTabs } from "@bentley/ui-core";
import {
  ToolAssistance, ToolAssistanceDialog, FooterPopup,
  ToolAssistanceInstruction as NZ_ToolAssistanceInstruction, ToolAssistanceSeparator, ToolAssistanceItem,
} from "@bentley/ui-ninezone";

import {
  UiFramework, StatusFieldProps, StatusBarFieldId, Icon, MessageManager,
  FrontstageManager, ToolAssistanceChangedEventArgs, ToolIconChangedEventArgs, CursorPrompt,
} from "../../../ui-framework";

import "./ToolAssistanceField.scss";
import acceptPointIcon from "./accept-point.svg";
import cursorClickIcon from "./cursor-click.svg";
import clickLeftIcon from "./mouse-click-left.svg";
import clickRightIcon from "./mouse-click-right.svg";
import mouseWheelClickIcon from "./mouse-click-wheel.svg";
import clickLeftDragIcon from "./mouse-click-left-drag.svg";
import clickRightDragIcon from "./mouse-click-right-drag.svg";
import clickMouseWheelDragIcon from "./mouse-click-wheel-drag.svg";

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
}

/** Tool Assistance Field React component.
 * @beta
 */
export class ToolAssistanceField extends React.Component<ToolAssistanceFieldProps, ToolAssistanceFieldState> {
  private static _toolAssistanceKey = "ToolAssistance";
  private static _showPromptAtCursorKey = "showPromptAtCursor";
  private static _mouseTouchTabIndexKey = "mouseTouchTabIndex";
  private _className: string;
  private _target = React.createRef<HTMLDivElement>();
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

    this.props.uiSettings.saveSetting(ToolAssistanceField._toolAssistanceKey, ToolAssistanceField._showPromptAtCursorKey, this.state.showPromptAtCursor);
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

    let dialogTitle = UiFramework.translate("toolAssistance.title");
    const mouseLabel = UiFramework.translate("toolAssistance.mouse");
    const touchLabel = UiFramework.translate("toolAssistance.touch");
    let prompt = "";
    let tooltip = "";
    let toolIcon: React.ReactNode;
    let toolStateIcon: React.ReactNode;
    let dialogContent: React.ReactNode;

    // istanbul ignore next
    if (IModelApp.toolAdmin.activeTool)
      dialogTitle = IModelApp.toolAdmin.activeTool.flyover + " - " + dialogTitle;

    if (instructions) {
      prompt = instructions.mainInstruction.text;
      toolIcon = <Icon iconSpec={this.state.toolIconSpec} />;
      toolStateIcon = ToolAssistanceField.getInstructionImage(instructions.mainInstruction);

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
                  <Checkbox label={UiFramework.translate("toolAssistance.promptAtCursor")}
                    checked={this.state.showPromptAtCursor} onChange={this._onPromptAtCursorChange} />
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
      tooltip = IModelApp.toolAdmin.activeTool.flyover + " > " + tooltip;

    if (tooltip) {
      const lineBreak = "\u000d";
      tooltip = tooltip + lineBreak;
    }

    tooltip += UiFramework.translate("toolAssistance.moreInfo");

    return (
      <>
        <div ref={this._target} title={tooltip}>
          <ToolAssistance
            icons={
              <>
                {toolIcon}
                {toolStateIcon}
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
          target={this._target}
        >
          <ToolAssistanceDialog
            title={dialogTitle}
          >
            {dialogContent}
          </ToolAssistanceDialog>
        </FooterPopup>
      </>
    );
  }

  private _onPromptAtCursorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    const checked = target.checked;

    this.setState({ showPromptAtCursor: checked });
  }

  private _handleClose = () => {
    this.setOpenWidget(null);
  }

  private _handleOutsideClick = (e: MouseEvent) => {
    if (!this._indicator.current ||
      !(e.target instanceof Node) ||
      this._indicator.current.contains(e.target))
      return;

    this._handleClose();
  }

  private _handleToolAssistanceIndicatorClick = () => {
    const isOpen = this.props.openWidget === this._className;
    if (isOpen)
      this.setOpenWidget(null);
    else
      this.setOpenWidget(this._className);
  }

  private setOpenWidget(openWidget: StatusBarFieldId) {
    this.props.onOpenWidget(openWidget);
  }

  /** @internal */
  public static getInstructionImage(instruction: ToolAssistanceInstruction): React.ReactNode {
    let image: React.ReactNode;

    if (typeof instruction.image === "string") {
      if (instruction.image)
        image = <Icon iconSpec={instruction.image} />;
    } else if (instruction.image === ToolAssistanceImage.Keyboard) {
      if (instruction.keyboardInfo) {
        image = ToolAssistanceField.getInstructionKeyboardImage(instruction.keyboardInfo);
      } else {
        Logger.logError(UiFramework.loggerCategory(this), `ToolAssistanceImage.Keyboard specified but no keyboardInfo provided`);
      }
    } else {
      const toolAssistanceImage: ToolAssistanceImage = instruction.image;
      let svgImage = "";
      let className = "uifw-toolassistance-svg";

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
          className = "uifw-toolassistance-svg-wide";
          break;
        case ToolAssistanceImage.RightClickDrag:
          svgImage = clickRightDragIcon;
          className = "uifw-toolassistance-svg-wide";
          break;
        case ToolAssistanceImage.MouseWheelClickDrag:
          svgImage = clickMouseWheelDragIcon;
          className = "uifw-toolassistance-svg-wide";
          break;
      }

      if (svgImage) {
        image = (
          <div className={className}>
            <SvgSprite src={svgImage} />
          </div>
        );
      }
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
        <span>
          {keyboardInfo.keys.map((key: string, index3: number) => {
            return ToolAssistanceField.getKeyNode(key, index3, "uifw-toolassistance-key-medium");
          })}
        </span>
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

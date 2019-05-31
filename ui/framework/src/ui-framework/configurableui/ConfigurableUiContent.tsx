/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ConfigurableUi */

import * as React from "react";
import { connect } from "react-redux";

import { CommonProps } from "@bentley/ui-core";

import { UiFramework } from "../UiFramework";
import { ModalDialogRenderer } from "../dialog/ModalDialogManager";
import { ModelessDialogRenderer } from "../dialog/ModelessDialogManager";
import { ElementTooltip } from "../feedback/ElementTooltip";
import { FrontstageComposer } from "../frontstage/FrontstageComposer";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";
import { KeyboardShortcutMenu } from "../keyboardshortcut/KeyboardShortcutMenu";
import { PointerMessage } from "../messages/Pointer";
import { InputFieldMessage } from "../messages/InputField";
import { FrameworkState } from "../FrameworkState";

import "./configurableui.scss";

/** Properties for [[ConfigurableUiContent]]
 * @public
 */
export interface ConfigurableUiContentProps extends CommonProps {
  placeholder: string;
  appBackstage?: React.ReactNode;
}

function mapStateToProps(state: any) {
  const frameworkState = state[UiFramework.frameworkStateKey] as FrameworkState;  // since app sets up key, don't hard-code name
  // istanbul ignore if
  if (!frameworkState)
    return undefined;

  return {};
}

const mapDispatch = {
};

/** The ConfigurableUiContent component is the high order component the pages specified using ConfigurableUi */
class ConfigurableUiContentClass extends React.Component<ConfigurableUiContentProps> {

  public constructor(props: ConfigurableUiContentProps) {
    super(props);
  }

  public componentDidMount() {
    window.addEventListener("keydown", this._handleKeyDown);

    KeyboardShortcutManager.setFocusToHome();
  }

  public componentWillUnmount() {
    window.removeEventListener("keydown", this._handleKeyDown);
  }

  public render(): JSX.Element | undefined {
    return (
      <div id="uifw-configurableui-wrapper" className={this.props.className} style={this.props.style} data-testid="uifw-configurableui-wrapper"
        onMouseMove={this._handleMouseMove}
      >
        {this.props.appBackstage}
        <FrontstageComposer style={{ position: "relative", height: "100%" }} />
        <ModelessDialogRenderer />
        <ModalDialogRenderer />
        <ElementTooltip />
        <PointerMessage />
        <KeyboardShortcutMenu />
        <InputFieldMessage />
      </div>
    );
  }

  private _handleKeyDown(e: KeyboardEvent): void {
    const element = document.activeElement as HTMLElement;

    if (element === document.body && e.key !== "Escape") {
      KeyboardShortcutManager.processKey(e.key, e.altKey, e.ctrlKey, e.shiftKey);
    }
  }

  // private _handleFocusIn(e: Event): void {
  //   // tslint:disable-next-line:no-console
  //   console.log("focusin: ", e.target);
  // }

  private _handleMouseMove(e: React.MouseEvent): void {
    KeyboardShortcutManager.cursorX = e.clientX;
    KeyboardShortcutManager.cursorY = e.clientY;
  }
}

/** The ConfigurableUiContent component is the high order component the pages specified using ConfigurableUi
 * @public
 */
export const ConfigurableUiContent = connect(mapStateToProps, mapDispatch)(ConfigurableUiContentClass); // tslint:disable-line:variable-name

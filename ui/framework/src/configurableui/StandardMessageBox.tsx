/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MessageBox */

import * as React from "react";

import { MessageBoxType, MessageBoxIconType, MessageBoxValue } from "@bentley/imodeljs-frontend";
import { ButtonType, ButtonCluster } from "@bentley/ui-core";
import { MessageBox, MessageSeverity } from "@bentley/ui-core";

import { ModalDialogManager } from "./ModalDialogManager";

/** Props for StandardMessageBox React component */
export interface StandardMessageBoxProps {
  /** Indicates whether the message box is open */
  opened: boolean;
  /** The standard icon to display in the message box */
  iconType: MessageBoxIconType;
  /** Title to display in the message box */
  title: string;
  /** Controls the button set displayed */
  messageBoxType: MessageBoxType;
  /** Callback function for processing the message box result */
  onResult?: (result: MessageBoxValue) => void;
}

export interface StandardMessageBoxState {
  opened: boolean;
}

/** StandardMessageBox React component displays a standard icon, message text and a standard button set in the lower right. */
export class StandardMessageBox extends React.Component<StandardMessageBoxProps, StandardMessageBoxState> {

  /** hidden */
  public readonly state: Readonly<StandardMessageBoxState>;

  constructor(props: StandardMessageBoxProps) {
    super(props);
    this.state = {
      opened: this.props.opened,
    };
  }

  public render(): JSX.Element {
    const buttonCluster: ButtonCluster[] = new Array<ButtonCluster>();

    switch (this.props.messageBoxType) {
      case MessageBoxType.Ok:
      case MessageBoxType.LargeOk:
        buttonCluster.push({ type: ButtonType.OK, onClick: () => { this._handleButton(MessageBoxValue.Ok); } });
        break;
      case MessageBoxType.OkCancel:
      case MessageBoxType.MediumAlert:
        buttonCluster.push({ type: ButtonType.OK, onClick: () => { this._handleButton(MessageBoxValue.Ok); } });
        buttonCluster.push({ type: ButtonType.Cancel, onClick: () => { this._handleButton(MessageBoxValue.Cancel); } });
        break;
      case MessageBoxType.YesNo:
      case MessageBoxType.YesNoCancel:
        buttonCluster.push({ type: ButtonType.Yes, onClick: () => { this._handleButton(MessageBoxValue.Yes); } });
        buttonCluster.push({ type: ButtonType.No, onClick: () => { this._handleButton(MessageBoxValue.No); } });
        if (MessageBoxType.YesNoCancel === this.props.messageBoxType)
          buttonCluster.push({ type: ButtonType.Cancel, onClick: () => { this._handleButton(MessageBoxValue.Cancel); } });
        break;
    }

    let severity = MessageSeverity.None;
    switch (this.props.iconType) {
      case MessageBoxIconType.NoSymbol:
        severity = MessageSeverity.None;
        break;
      case MessageBoxIconType.Information:
        severity = MessageSeverity.Information;
        break;
      case MessageBoxIconType.Question:
        severity = MessageSeverity.Question;
        break;
      case MessageBoxIconType.Warning:
        severity = MessageSeverity.Warning;
        break;
      case MessageBoxIconType.Critical:
        severity = MessageSeverity.Error;
        break;
    }

    return (
      <MessageBox
        opened={this.state.opened}
        title={this.props.title}
        severity={severity}
        buttonCluster={buttonCluster}
        onClose={this._handleCancel}
        onEscape={this._handleCancel}
      >
        {this.props.children}
      </MessageBox>
    );
  }

  private _handleButton = (buttonType: MessageBoxValue) => {
    this._closeDialog(() => {
      if (this.props.onResult)
        this.props.onResult(buttonType);
    });
  }

  private _handleCancel = () => {
    this._closeDialog(() => {
      if (this.props.onResult)
        this.props.onResult(MessageBoxValue.Cancel);
    });
  }

  private _closeDialog = (followUp: () => void) => {
    this.setState((_prevState) => ({
      opened: false,
    }), () => {
      if (!this.state.opened)
        ModalDialogManager.closeModalDialog();
      followUp();
    });
  }
}

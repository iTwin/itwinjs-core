/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import * as React from "react";
import { UiFramework } from "../UiFramework";
import { ModelessDialog } from "../dialog/ModelessDialog";
import { AccuDrawFieldContainer } from "./AccuDrawFieldContainer";
import { Orientation } from "@bentley/ui-core";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";

/** @alpha */
export interface AccuDrawDialogProps {
  opened: boolean;
  dialogId: string;
  onClose?: () => void;
}

/** @internal */
interface AccuDrawDialogState {
  opened: boolean;
}

/** @alpha */
export class AccuDrawDialog extends React.Component<AccuDrawDialogProps, AccuDrawDialogState> {
  public readonly state: Readonly<AccuDrawDialogState>;
  private _title = UiFramework.translate("accuDraw.dialogTitle");

  constructor(props: AccuDrawDialogProps) {
    super(props);
    this.state = {
      opened: this.props.opened,
    };
  }

  public render(): JSX.Element {
    return (
      <ModelessDialog
        title={this._title}
        opened={this.state.opened}
        dialogId={this.props.dialogId}
        width={250}
        movable={true}
        onClose={this._handleCancel}
        onEscape={this._handleEscape}
      >
        <AccuDrawFieldContainer orientation={Orientation.Vertical} />
      </ModelessDialog >
    );
  }

  private _handleCancel = () => {
    this._closeDialog();
  };

  private _handleEscape = () => {
    KeyboardShortcutManager.setFocusToHome();
  };

  private _closeDialog = () => {
    this.setState(
      { opened: false },
      () => this.props.onClose && this.props.onClose()
    );
  };
}

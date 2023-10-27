/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, MessageBoxIconType, MessageBoxType } from "@itwin/core-frontend";
import { ModelessDialog, UiFramework } from "@itwin/appui-react";
import { Button, ComboBox } from "@itwin/itwinui-react";
import "./SampleModelessDialog.scss";

export interface SampleModelessDialogProps {
  opened: boolean;
  dialogId: string;
  onClose?: () => void;
}

export interface SampleModelessDialogState {
  opened: boolean;
}

export class SampleModelessDialog extends React.Component<SampleModelessDialogProps, SampleModelessDialogState> {
  public override readonly state: Readonly<SampleModelessDialogState>;
  private _title = "sample dialog";

  constructor(props: SampleModelessDialogProps) {
    super(props);
    this.state = {
      opened: this.props.opened,
    };
  }
  public override render(): React.ReactElement {
    return (
      <ModelessDialog
        title={this._title}
        opened={this.state.opened}
        dialogId={this.props.dialogId}
        width={450}
        height={250}
        onClose={this._handleCancel}
        onEscape={this._handleCancel}
        movable={true}
      >
        <div className="sample-options">
          <div>
            To demonstrate messagebox behaviour in modeless dialog
          </div>
          <ComboBox
            value={"hello"}
            inputProps={{
              placeholder: "localized1 placeholder",
            }}
            // onChange={(value: string) => memoizedOnViewDefinitionSelected(value)}
            options={

              [{
                disabled: false,
                label: "mm",
                sublabel: "Millimeter",
                value: "MM",
              },
              {
                disabled: false,
                label: "cm",
                sublabel: "Centimeter",
                value: "CM",
              }]}
          />

          <div className="sample-grid">
            <Button styleType="cta" onClick={this._onShowMessageBox}>Show Message box</Button>
            <Button styleType="cta" onClick={this._handleCancel}>Close</Button>
          </div>
        </div>

      </ModelessDialog >
    );
  }
  private _onShowMessageBox = async () => {
    const _result = await IModelApp.notifications.openMessageBox(MessageBoxType.LargeOk,
      "I should be displayed over the Sample Modeless dialog.",
      MessageBoxIconType.Warning);
  };

  private _handleCancel = () => {
    this._closeDialog();
  };

  private _closeDialog = () => {
    this.setState(
      { opened: false },
      () => this.props.onClose && this.props.onClose()
    );
    UiFramework.dialogs.modeless.close(this.props.dialogId);
  };
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Dialog, Spinner, SpinnerSize } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import { IModelApp } from "@bentley/imodeljs-frontend";

export interface SpinnerTestDialogProps {
  opened: boolean;
}

export interface SpinnerTestDialogState {
  opened: boolean;
}

export class SpinnerTestDialog extends React.Component<SpinnerTestDialogProps, SpinnerTestDialogState> {
  public readonly state: Readonly<SpinnerTestDialogState>;
  private _title = IModelApp.i18n.translate("SampleApp:buttons.spinnerTestDialog");

  constructor(props: SpinnerTestDialogProps) {
    super(props);
    this.state = {
      opened: this.props.opened,
    };
  }

  public render(): JSX.Element {
    return (
      <Dialog
        title={this._title}
        opened={this.state.opened}
        modal={true}
        width={470}
        height={370}
        onClose={this._handleCancel}
        onEscape={this._handleCancel}
        onOutsideClick={this._handleCancel}
      >
        <div style={{ width: "450px" }}>
          <Spinner size={SpinnerSize.XLarge} />
          <Spinner size={SpinnerSize.Large} />
          <Spinner size={SpinnerSize.Medium} />
          <Spinner size={SpinnerSize.Small} />
          <Spinner size={SpinnerSize.XLarge} />
          <Spinner size={SpinnerSize.Large} />
          <Spinner size={SpinnerSize.Medium} />
          <Spinner size={SpinnerSize.Small} />
        </div>
        <div style={{ width: "450px" }}>
          <Spinner size={SpinnerSize.XLarge} />
          <Spinner size={SpinnerSize.Large} />
          <Spinner size={SpinnerSize.Medium} />
          <Spinner size={SpinnerSize.Small} />
          <Spinner size={SpinnerSize.XLarge} />
          <Spinner size={SpinnerSize.Large} />
          <Spinner size={SpinnerSize.Medium} />
          <Spinner size={SpinnerSize.Small} />
        </div>
        <div style={{ width: "450px" }}>
          <Spinner size={SpinnerSize.XLarge} />
          <Spinner size={SpinnerSize.Large} />
          <Spinner size={SpinnerSize.Medium} />
          <Spinner size={SpinnerSize.Small} />
          <Spinner size={SpinnerSize.XLarge} />
          <Spinner size={SpinnerSize.Large} />
          <Spinner size={SpinnerSize.Medium} />
          <Spinner size={SpinnerSize.Small} />
        </div>
      </Dialog>
    );
  }

  private _handleCancel = () => {
    this._closeDialog();
  }

  private _closeDialog = () => {
    this.setState({
      opened: false,
    }), () => {
      if (!this.state.opened)
        ModalDialogManager.closeDialog();
    };
  }
}

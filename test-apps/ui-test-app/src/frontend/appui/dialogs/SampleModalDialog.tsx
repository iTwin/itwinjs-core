/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { Dialog } from "@itwin/core-react";
import { UiFramework } from "@itwin/appui-react";
import { DialogButtonType } from "@itwin/appui-abstract";

export interface SampleModalDialogProps {
  onResult?: (result: DialogButtonType) => void;
}

export class SampleModalDialog extends React.Component<SampleModalDialogProps> {
  private _title = IModelApp.localization.getLocalizedString("SampleApp:buttons.sampleModalDialog");

  constructor(props: SampleModalDialogProps) {
    super(props);
  }

  public override render(): React.ReactElement {
    return (
      <Dialog
        title={this._title}
        opened={true}
        modal={true}
        width={450}
        height={300}
        onClose={this._handleCancel}
        onEscape={this._handleCancel}
        onOutsideClick={this._handleCancel}
        buttonCluster={[
          { type: DialogButtonType.OK, onClick: this._handleOK },
          { type: DialogButtonType.Cancel, onClick: this._handleCancel },
        ]}
      >
        Lorem ipsum dolor sit amet, posse imperdiet ius in, mundi cotidieque ei per.
        Vel scripta ornatus assentior cu. Duo nonumy equidem te, per ad malis deserunt consetetur.
        In per invidunt conceptam. Ea pri aeque corrumpit. Eum ea ipsum perfecto vulputate, an cum oblique ornatus.
      </Dialog >
    );
  }

  private _handleOK = () => {
    this._closeDialog(() => this.props.onResult && this.props.onResult(DialogButtonType.OK));
  };

  private _handleCancel = () => {
    this._closeDialog(() => this.props.onResult && this.props.onResult(DialogButtonType.Cancel));
  };

  private _closeDialog = (followUp: () => void) => {
    followUp && followUp();
    UiFramework.dialogs.modal.close();
  };
}

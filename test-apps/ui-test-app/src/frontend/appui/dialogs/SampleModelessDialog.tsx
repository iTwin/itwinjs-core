/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { ModelessDialog, UiFramework } from "@itwin/appui-react";

export interface SampleModelessDialogProps {
  dialogId: string;
  onClose?: () => void;
  movable?: boolean;
}

export class SampleModelessDialog extends React.Component<SampleModelessDialogProps> {
  private _title = IModelApp.localization.getLocalizedString("SampleApp:buttons.sampleModelessDialog");

  constructor(props: SampleModelessDialogProps) {
    super(props);
  }

  public override render(): React.JSX.Element {
    return (
      <ModelessDialog
        title={this._title}
        opened={true}
        dialogId={this.props.dialogId}
        width={450}
        height={300}
        movable={this.props.movable}
        onClose={this._handleCancel}
        onEscape={this._handleCancel}
      /* onOutsideClick={this._handleCancel} */
      >
        {/*  cSpell:disable */}
        Lorem ipsum dolor sit amet, posse imperdiet ius in, mundi cotidieque ei per.
        Vel scripta ornatus assentior cu. Duo nonumy equidem te, per ad malis deserunt consetetur.
        In per invidunt conceptam. Ea pri aeque corrumpit. Eum ea ipsum perfecto vulputate, an cum oblique ornatus.
        {/*  cSpell:enable */}
      </ModelessDialog >
    );
  }

  private _handleCancel = () => {
    this._closeDialog();
  };

  private _closeDialog = () => {
    this.props.onClose && this.props.onClose();
    UiFramework.dialogs.modeless.close(this.props.dialogId);
  };
}

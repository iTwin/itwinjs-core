/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Dialog, DialogButtonType } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";

export interface TestModalDialogProps {
  opened: boolean;
  onResult?: (result: DialogButtonType) => void;
}

export interface TestModalDialogState {
  opened: boolean;
  movable: boolean;
  resizable: boolean;
  overlay: boolean;
}

export class TestModalDialog extends React.Component<TestModalDialogProps, TestModalDialogState> {
  public readonly state: Readonly<TestModalDialogState>;

  constructor(props: TestModalDialogProps) {
    super(props);
    this.state = {
      opened: this.props.opened,
      movable: false,
      resizable: false,
      overlay: true,
    };
  }
  public render(): JSX.Element {
    // cspell:disable
    return (
      <Dialog
        title={"Modal Dialog"}
        opened={this.state.opened}
        resizable={this.state.resizable}
        movable={this.state.movable}
        modal={this.state.overlay}
        buttonCluster={[
          { type: DialogButtonType.OK, onClick: this._handleOK },
          { type: DialogButtonType.Cancel, onClick: this._handleCancel },
        ]}
        onClose={this._handleCancel}
        onEscape={this._handleCancel}
        minHeight={200}
        maxHeight={500}
        onOutsideClick={this._handleCancel}
      >
        <p>Lorem ipsum dolor sit amet, posse imperdiet ius in, mundi cotidieque ei per. Vel scripta ornatus assentior cu. Duo nonumy equidem te, per ad malis deserunt consetetur. In per invidunt conceptam. Ea pri aeque corrumpit. Eum ea ipsum perfecto vulputate, an cum oblique ornatus.</p>
        <p>Deserunt perpetua intellegam ex qui. Sanctus epicuri molestiae vim ut, vix in dolorem mnesarchum. Quas tollit malorum usu id, sea dicat congue abhorreant ex. Reque tibique cu mel. Ea vix posse consequuntur, nam dicat nostrud ne. Id mea autem viderer, minim minimum adversarium ex vis, commodo malorum sea ei.</p>
        <p>Cu novum viris detraxit eam. Erat inimicus necessitatibus vim in, noster placerat pro an, modus homero percipitur duo no. Ius voluptatum reprehendunt id, nulla nemore ut his. Mei ei quis qualisque consetetur, illud possim id vel.</p>
        <p>Quando verear regione ius ei. Eum tractatos ullamcorper ei, vidisse repudiare ea his. Possim intellegam ne duo, solet malorum nostrum eum ut, ei alterum corrumpit eum. Has ad utroque eloquentiam. Qui case forensibus eloquentiam ne. Usu no nominati principes, primis luptatum mea ex. No dicit nullam qui.</p>
        <p>
          movable: <input type="checkbox" checked={this.state.movable} onChange={(_) => { this.setState((prevState) => ({ movable: !prevState.movable })); }} />
          resizable: <input type="checkbox" checked={this.state.resizable} onChange={(_) => { this.setState((prevState) => ({ resizable: !prevState.resizable })); }} />
          overlay: <input type="checkbox" checked={this.state.overlay} onChange={(_) => { this.setState((prevState) => ({ overlay: !prevState.overlay })); }} />
        </p>
      </Dialog>
    );
    // cspell:enable
  }

  private _handleOK = () => {
    this._closeDialog(() => {
      if (this.props.onResult)
        this.props.onResult(DialogButtonType.OK);
    });
  }

  private _handleCancel = () => {
    this._closeDialog(() => {
      if (this.props.onResult)
        this.props.onResult(DialogButtonType.Cancel);
    });
  }

  private _closeDialog = (followUp: () => void) => {
    this.setState({
      opened: false,
    }), () => {
      if (!this.state.opened)
        ModalDialogManager.closeDialog();
      followUp();
    };
  }
}

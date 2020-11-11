/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp, MessageBoxIconType, MessageBoxType } from "@bentley/imodeljs-frontend";
import { Button, ButtonType, DialogButtonStyle, DialogButtonType, MessageBox, MessageSeverity } from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";

export interface TestMessageBoxProps {
  opened: boolean;
  severity: MessageSeverity;
  title: string;
  onResult?: (result: DialogButtonType) => void;
}

export interface TestMessageBoxState {
  opened: boolean;
}

export class TestMessageBox extends React.Component<TestMessageBoxProps, TestMessageBoxState> {
  public readonly state: Readonly<TestMessageBoxState>;

  constructor(props: TestMessageBoxProps) {
    super(props);
    this.state = {
      opened: this.props.opened,
    };
  }

  /* eslint-disable @typescript-eslint/no-floating-promises */

  public render(): JSX.Element {
    // cspell:disable
    return (
      <MessageBox
        opened={this.state.opened}
        title={this.props.title}
        severity={this.props.severity}
        buttonCluster={[
          { type: DialogButtonType.Close, buttonStyle: DialogButtonStyle.Primary, onClick: () => { this._toggleOpened(); } },
        ]}
        onClose={this._toggleOpened}
        onEscape={this._toggleOpened}
      >
        Lorem ipsum dolor sit amet, posse imperdiet ius in, mundi cotidieque ei per. Vel scripta ornatus assentior cu. Duo nonumy equidem te, per ad malis deserunt consetetur. In per invidunt conceptam. Ea pri aeque corrumpit. Eum ea ipsum perfecto vulputate, an cum oblique ornatus.
        <div>
          <Button buttonType={ButtonType.Hollow} onClick={() => { IModelApp.notifications.openMessageBox(MessageBoxType.Ok, "This is a box opened using IModelApp.notifications.openMessageBox.", MessageBoxIconType.Information); }}>
            Open Another Modal
          </Button>
        </div>
      </MessageBox>
    );
    // cspell:enable
  }

  public componentDidUpdate(prevProps: TestMessageBoxProps) {
    if (prevProps !== this.props) {
      this.setState((_, props) => ({ opened: props.opened }));
    }
  }

  private _toggleOpened = () => {
    this.setState((prevState) => ({
      opened: !prevState.opened,
    }), () => {
      if (!this.state.opened)
        ModalDialogManager.closeDialog();
      if (this.props.onResult)
        this.props.onResult(DialogButtonType.Close);
    });
  };
}

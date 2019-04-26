/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { Id64String } from "@bentley/bentleyjs-core";
import { IModelConnection, IModelApp } from "@bentley/imodeljs-frontend";

import { LoadingSpinner } from "@bentley/ui-core";
import { ViewportComponent } from "@bentley/ui-components";
import { ModelessDialog, ModelessDialogManager } from "@bentley/ui-framework";
import { ExternalIModel } from "../widgets/ExternalIModel";

import "./ViewportDialog.scss";

export interface ViewportDialogProps {
  opened: boolean;
  projectName: string;
  imodelName: string;
  dialogId: string;
}

export interface ViewportDialogState {
  opened: boolean;
  viewId?: Id64String;
  iModelConnection?: IModelConnection;
}

export class ViewportDialog extends React.Component<ViewportDialogProps, ViewportDialogState> {
  private _loading = IModelApp.i18n.translate("SampleApp:Test.loading");
  public readonly state: Readonly<ViewportDialogState>;

  constructor(props: ViewportDialogProps) {
    super(props);
    this.state = {
      opened: this.props.opened,
    };
  }

  public async componentDidMount() {
    const externalIModel = new ExternalIModel(this.props.projectName, this.props.imodelName);
    await externalIModel.openIModel();

    if (externalIModel.viewId && externalIModel.iModelConnection) {
      this.setState({
        viewId: externalIModel.viewId,
        iModelConnection: externalIModel.iModelConnection,
      });
    }
  }

  public render(): JSX.Element {

    /* Demo values */
    const width = 400;
    const height = 300;
    const x = window.innerWidth - width - 90;
    const y = window.innerHeight - height - 90;

    return (
      <ModelessDialog
        className="viewport-dialog"
        title={this.props.dialogId}
        opened={this.state.opened}
        resizable={true}
        movable={true}
        width={width} height={height}
        x={x} y={y}
        minWidth={200} minHeight={100}
        onClose={() => this._handleClose()}
        onEscape={() => this._handleClose()}
        inset={false}
        dialogId={this.props.dialogId}
      >
        <div className="viewport-dialog-container" >
          {this.getContent()}
        </div>
      </ModelessDialog >
    );
  }

  private getContent(): React.ReactNode {
    const divStyle: React.CSSProperties = {
      height: "100%",
    };
    let content: React.ReactNode;

    if (this.state.viewId === undefined || this.state.iModelConnection === undefined)
      content = <div className="uifw-centered" style={divStyle}> <LoadingSpinner message={this._loading} /> </div>;
    else
      content = <ViewportComponent viewDefinitionId={this.state.viewId} imodel={this.state.iModelConnection} />;

    return content;
  }

  private _handleClose = () => {
    this._closeDialog(() => {
    });
  }

  private _closeDialog = (followUp: () => void) => {
    this.setState(() => ({
      opened: false,
    }), () => {
      if (!this.state.opened)
        ModelessDialogManager.closeDialog(this.props.dialogId);
      followUp();
    });
  }
}

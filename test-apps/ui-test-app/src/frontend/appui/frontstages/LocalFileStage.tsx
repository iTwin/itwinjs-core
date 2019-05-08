/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { Id64String } from "@bentley/bentleyjs-core";
import { ViewDefinitionProps } from "@bentley/imodeljs-common";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { FillCentered, Button, ButtonSize, ButtonType } from "@bentley/ui-core";
import { UiFramework, ModalFrontstageInfo, FrontstageManager } from "@bentley/ui-framework";

import { LocalFileSupport } from "../LocalFileSupport";
import { IModelViewPicker } from "../imodelopen/IModelViewPicker";
import { SampleAppIModelApp } from "../..";

/** Modal frontstage for opening a local file.
 */
export class LocalFileStage implements ModalFrontstageInfo {
  public static open() {
    if (LocalFileSupport.localFilesSupported()) {
      FrontstageManager.openModalFrontstage(new LocalFileStage());
    }
  }

  public title: string = UiFramework.i18n.translate("SampleApp:localFileStage.localFile");

  public get content(): React.ReactNode {
    return <LocalFilePage onClose={this._handleClose} onViewsSelected={this._handleViewsSelected} />;
  }

  private _handleClose = () => {
    FrontstageManager.closeModalFrontstage();
  }

  private _handleViewsSelected = async (iModelConnection: IModelConnection, views: Id64String[]) => {
    FrontstageManager.closeModalFrontstage();
    await SampleAppIModelApp.openViews(iModelConnection, views);
  }
}

interface LocalFilePageProps {
  onViewsSelected: (iModelConnection: IModelConnection, views: Id64String[]) => void;
  onClose: () => void;
}

interface LocalFilePageState {
  iModelConnection: IModelConnection | undefined;
}

/** LocalFilePage displays the file picker and view picker. */
class LocalFilePage extends React.Component<LocalFilePageProps, LocalFilePageState> {
  private _input: HTMLInputElement | null = null;

  public readonly state: Readonly<LocalFilePageState> = {
    iModelConnection: undefined,
  };

  public componentDidMount() {
    if (!this.state.iModelConnection && this._input) {
      this._clickInput();
    }
  }

  private _clickInput = () => {
    if (!this.state.iModelConnection && this._input) {
      this._input.click();
    }
  }

  private _handleChange = async (_e: React.ChangeEvent) => {
    if (this._input) {
      if (this._input.files && this._input.files.length) {
        const file: File = this._input.files[0];
        if (file) {
          const iModelConnection = await LocalFileSupport.openLocalFile(file.name);
          if (iModelConnection) {
            SampleAppIModelApp.setIsIModelLocal(true, true);
            this.setState({ iModelConnection });
          }
        }
      }
    }
  }

  private _handleViewsSelected = (views: ViewDefinitionProps[]): void => {
    const idsSelected = new Array<Id64String>();
    views.forEach((props: ViewDefinitionProps) => {
      if (props.id)
        idsSelected.push(props.id);
    });

    if (this.state.iModelConnection && idsSelected.length)
      this.props.onViewsSelected(this.state.iModelConnection, idsSelected);
  }

  public render() {
    if (!this.state.iModelConnection) {
      return (
        <FillCentered>
          <input id="file-input" ref={(e) => this._input = e}
            type="file" accept=".bim,.ibim" onChange={this._handleChange}
            style={{ display: "none" }} />
          <Button size={ButtonSize.Large} buttonType={ButtonType.Primary} onClick={this._clickInput}>
            {UiFramework.i18n.translate("SampleApp:localFileStage.selectFile")}
          </Button>
        </FillCentered >
      );
    } else {
      return (
        <IModelViewPicker iModelConnection={this.state.iModelConnection}
          onClose={this.props.onClose} onViewsSelected={this._handleViewsSelected} />
      );
    }
  }
}

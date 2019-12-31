/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";
import { Dialog, DialogButtonType, NumericInput } from "@bentley/ui-core";
import { ModalDialogManager } from "../../dialog/ModalDialogManager";
import {
  IModelApp, ScreenViewport, SpatialViewState,
  NotifyMessageDetails, OutputMessagePriority, IModelConnection,
  AuthorizedFrontendRequestContext,
} from "@bentley/imodeljs-frontend";

import "./SettingsModalDialog.scss";

/** Props for the [[SettingsModalDialog]] component */
interface SettingsModalDialogProps {
  iModelConnection: IModelConnection;
  opened: boolean;
  onResult?: (result: DialogButtonType) => void;
}

/** State for the [[SettingsModalDialog]] component */
interface SettingsModalDialogState {
  opened: boolean;
  movable: boolean;
  resizable: boolean;
  overlay: boolean;
  elevation: number;
}

const bingMapNamespace = "bingMapSettings";
const elevationSetting = "elevation";

/**
 * A dialog containing options for Bing Map settings
 * @alpha
 */
// istanbul ignore next
export class SettingsModalDialog extends React.Component<SettingsModalDialogProps, SettingsModalDialogState> {
  public readonly state: Readonly<SettingsModalDialogState>;
  private _newElevation: number = 0;
  private _isElevationValid: boolean = true;

  constructor(props: SettingsModalDialogProps) {
    super(props);

    this._initializeElevation();

    this.state = {
      opened: this.props.opened,
      movable: false,
      resizable: false,
      overlay: true,
      elevation: this._newElevation,
    };
  }

  private _initializeElevation = () => {
    const vp = IModelApp.viewManager.selectedView as ScreenViewport;
    const view = vp.view as SpatialViewState;
    const map = view.getDisplayStyle3d().settings.backgroundMap;
    this._newElevation = map && map.groundBias ? map.groundBias : 0;
  }

  /** @hidden */
  public render(): JSX.Element {
    return (
      <Dialog
        title={IModelApp.i18n.translate("UiFramework:realityData.bingMapSettings")}
        opened={this.state.opened}
        resizable={this.state.resizable}
        movable={this.state.movable}
        modal={this.state.overlay}
        buttonCluster={[
          { type: DialogButtonType.OK, onClick: () => { this._handleOK(); } },
          { type: DialogButtonType.Cancel, onClick: () => { this._handleCancel(); } },
        ]}
        onClose={() => this._handleCancel()}
        onEscape={() => this._handleCancel()}
        width={550}
        height={200}
      >
        <div className="bing-map-settings-elevation">
          <span>{IModelApp.i18n.translate("UiFramework:realityData.elevationOffset")}</span>
          <NumericInput strict={false} value={this.state.elevation} onChange={this._elevationChange} onKeyDown={this._onKeyDown} />
        </div>
      </Dialog>
    );
  }

  /** Disable commas and letters */
  private _onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.keyCode === 188 || (event.keyCode >= 65 && event.keyCode <= 90))
      event.preventDefault();
  }

  private _elevationChange = (value: number | null, _stringValue: string, _input: HTMLInputElement) => {
    if (this._newElevation === value)
      return;

    if (value === null)
      this._isElevationValid = false;
    else {
      this._isElevationValid = true;
      this._newElevation = value;
    }
  }

  private _handleOK = () => {
    this._isElevationValid ? this._setGroundBias() : this._displayError();

    this._closeDialog(() => {
      if (this.props.onResult)
        this.props.onResult(DialogButtonType.OK);
    });
  }

  private _displayError = () => {
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(
      OutputMessagePriority.Error,
      IModelApp.i18n.translate("UiFramework:realityData.invalidElevationError"),
      IModelApp.i18n.translate("UiFramework:realityData.invalidElevationDetails"),
    ));
  }

  private _setGroundBias = () => {
    const vp = IModelApp.viewManager.selectedView as ScreenViewport;
    vp.changeBackgroundMapProps({ groundBias: this._newElevation });
    vp.synchWithView();
    this.setState({ elevation: this._newElevation });
    this._saveSetting(); // tslint:disable-line:no-floating-promises
  }

  private _saveSetting = async () => {
    const contextId = this.props.iModelConnection.iModelToken.contextId;
    const iModelId = this.props.iModelConnection.iModelToken.iModelId;
    if (!contextId || !iModelId)
      return;

    const requestContext = await AuthorizedFrontendRequestContext.create();
    IModelApp.settings.saveSharedSetting(requestContext, this._newElevation, bingMapNamespace, elevationSetting, true, contextId, iModelId); // tslint:disable-line:no-floating-promises
  }

  private _handleCancel = () => {
    this._closeDialog(() => {
      if (this.props.onResult)
        this.props.onResult(DialogButtonType.Cancel);
    });
  }

  private _closeDialog = (followUp: () => void) => {
    this.setState(
      { opened: false },
      () => {
        if (!this.state.opened)
          ModalDialogManager.closeDialog();
        followUp();
      });
  }
}

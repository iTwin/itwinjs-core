/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Dialog, DialogButtonType } from "@bentley/ui-core";
import { ModalDialogManager, DefaultDialogGridContainer } from "@bentley/ui-framework";
import {
  DialogItemsManager,
  DialogItemValue,
  PropertyDescription,
  DialogPropertySyncItem,
} from "@bentley/ui-abstract";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { I18N } from "@bentley/imodeljs-i18n";

interface UnitsPopupProps {
  opened: boolean;
  i18N: I18N;
}

interface UnitsPopupState {
  opened: boolean;
}

enum UnitsOptions {
  Metric,
  Imperial,
}
/** UnitsPopup is a modal dialog with only one DialogItem. It is intended to be a very basic example of using DialogItem interfaces and the DialogItemsManager to create React UI
 * in an iModel.js app and to apply changes only when the user hits the OK button.
 */
export class UnitsPopup extends React.Component<UnitsPopupProps, UnitsPopupState> {
  public readonly state: Readonly<UnitsPopupState>;
  public static i18n: I18N;
  private _itemsManager: DialogItemsManager;
  constructor(props?: any, context?: any) {
    super(props, context);
    UnitsPopup.i18n = props.i18N;

    this.state = {
      opened: this.props.opened,
    };
    this._itemsManager = new DialogItemsManager();
    this._itemsManager.applyUiPropertyChange = this.applyUiPropertyChange;
  }
  private _handleOK = () => {
    IModelApp.quantityFormatter.useImperialFormats = (this.option === UnitsOptions.Metric ? false : true);
    this._closeDialog();
  }

  private _handleCancel = () => {
    this._closeDialog();
  }

  private _closeDialog = () => {
    this.setState((_prevState) => ({
      opened: false,
    }), () => {
      if (!this.state.opened)
        ModalDialogManager.closeDialog();
    });
  }

  /** The DefaultDialogGridContainer lays out a grid React components generated from DialogItem interfaces.  */
  public render(): JSX.Element {
    const item = { value: this._optionsValue, property: UnitsPopup._getEnumAsPicklistDescription(), editorPosition: { rowPriority: 0, columnIndex: 2 } };
    this._itemsManager.items = [item];
    return (
      <Dialog
        title={UnitsPopup.i18n.translate("dialogItemsSample:StatusBar.Units")}
        opened={this.state.opened}
        modal={true}
        buttonCluster={[
          { type: DialogButtonType.OK, onClick: () => { this._handleOK(); } },
          { type: DialogButtonType.Cancel, onClick: () => { this._handleCancel(); } },
        ]}
        onClose={() => this._handleCancel()}
        onEscape={() => this._handleCancel()}
        maxWidth={150}
      >
        <DefaultDialogGridContainer itemsManager={this._itemsManager} key={Date.now()} />
      </Dialog>
    );
  }

  // ------------- Enum based picklist ---------------
  private static _optionsName = "enumAsPicklist";
  private static _getEnumAsPicklistDescription = (): PropertyDescription => {
    return {
      name: UnitsPopup._optionsName,
      displayLabel: UnitsPopup.i18n.translate("dialogItemsSample:StatusBar.Units"),
      typename: "enum",
      enum: {
        choices: [
          { label: UnitsPopup.i18n.translate("dialogItemsSample:StatusBar.Metric"), value: UnitsOptions.Metric },
          { label: UnitsPopup.i18n.translate("dialogItemsSample:StatusBar.Imperial"), value: UnitsOptions.Imperial },
        ],
      },
    };
  }
  private _optionsValue: DialogItemValue = IModelApp.quantityFormatter.useImperialFormats ? { value: UnitsOptions.Imperial } : { value: UnitsOptions.Metric };

  public get option() {
    return this._optionsValue.value;
  }

  public set option(option) {
    this._optionsValue = { value: option };
  }

  public applyUiPropertyChange = (updatedValue: DialogPropertySyncItem): void => {
    this.option = updatedValue.value.value;
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Dialog, DialogButtonType } from "@bentley/ui-core";
import { ModalDialogManager, DefaultDialogGridContainer } from "@bentley/ui-framework";
import {
  ColorEditorParams,
  InputEditorSizeParams,
  DialogItemsManager,
  DialogItem,
  DialogItemValue,
  DialogPropertySyncItem,
  PropertyDescription,
  PropertyEditorParamTypes,
  SuppressLabelEditorParams,
  SyncPropertiesChangeEventArgs,
} from "@bentley/ui-abstract";
import { ColorDef, ColorByName } from "@bentley/imodeljs-common";
import {
  IModelApp,
  LengthDescription,
  NotifyMessageDetails,
  OutputMessagePriority,
} from "@bentley/imodeljs-frontend";

enum ColorOptions {
  Red,
  White,
  Blue,
  Yellow,
}

interface TestUiProviderDialogProps {
  opened: boolean;
  onResult?: (result: DialogButtonType) => void;
  itemsManager: DialogItemsManager;
  dialogItems?: DialogItem[];
}

interface TestUiProviderDialogState {
  opened: boolean;
  movable: boolean;
  resizable: boolean;
  overlay: boolean;

}

export class TestUiProviderDialog extends React.Component<TestUiProviderDialogProps, TestUiProviderDialogState> {

  private _itemsManager: DialogItemsManager;
  private _dialogItems?: DialogItem[];
  public readonly state: Readonly<TestUiProviderDialogState>;

  constructor(props: TestUiProviderDialogProps) {
    super(props);
    this._itemsManager = props.itemsManager;
    this._dialogItems = props.dialogItems === undefined ? this.supplyDialogItems() : props.dialogItems;
    this.state = {
      opened: this.props.opened,
      movable: false,
      resizable: true,
      overlay: true,
    };
    this._itemsManager.items = this._dialogItems;
    this._itemsManager.applyUiPropertyChange = this.applyUiPropertyChange;
  }
  public render(): JSX.Element {
    return (<Dialog
      title={"UI Provider Modal Dialog"}
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
      maxWidth={400}
    >
      <DefaultDialogGridContainer itemsManager={this._itemsManager} key={Date.now()} />
    </Dialog>
    );
  }

  private _handleOK = () => {
    this.storeValues();
    this._closeDialog(() => {
    });
  }

  private _handleCancel = () => {
    this._closeDialog(() => {
      if (this.props.onResult)
        this.props.onResult(DialogButtonType.Cancel);
    });
  }

  private _closeDialog = (followUp: () => void) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    this.setState({
      opened: false,
    }), () => {
      if (!this.state.opened)
        ModalDialogManager.closeDialog();
      followUp();
    };
  }
  private static _optionsName = "enumAsPicklist";
  private static _getEnumAsPicklistDescription = (): PropertyDescription => {
    return {
      name: TestUiProviderDialog._optionsName,
      displayLabel: "Options",
      typename: "enum",
      enum: {
        choices: [
          { label: "Red", value: ColorOptions.Red },
          { label: "White", value: ColorOptions.White },
          { label: "Blue", value: ColorOptions.Blue },
          { label: "Yellow", value: ColorOptions.Yellow },
        ],
      },
    };
  }

  private _optionsValue: DialogItemValue = { value: ColorOptions.Blue as number };

  public get option(): ColorOptions {
    return this._optionsValue.value as ColorOptions;
  }

  public set option(option: ColorOptions) {
    this._optionsValue = { value: option };
  }

  // ------------- Color ---------------
  private static _colorName = "color";
  private static _getColorDescription = (): PropertyDescription => {
    return {
      name: TestUiProviderDialog._colorName,
      displayLabel: "Color",
      typename: "number",
      editor: {
        name: "color-picker",
        params: [{
          type: PropertyEditorParamTypes.ColorData,
          colorValues: [
            ColorByName.blue as number,
            ColorByName.red as number,
            ColorByName.green as number,
            ColorByName.yellow as number,
            ColorByName.black as number,
            ColorByName.gray as number,
            ColorByName.purple as number,
            ColorByName.pink as number,
          ],
          numColumns: 3,
        } as ColorEditorParams,
        ],
      },
    };
  }

  private _colorValue: DialogItemValue = { value: ColorByName.blue as number };

  public get colorValue(): number {
    return this._colorValue.value as number;
  }

  public set colorValue(newValue: number) {
    this._colorValue.value = newValue;
  }

  public get colorDef(): ColorDef {
    return new ColorDef(this._optionsValue.value as number);
  }

  public set colorDef(colorValue: ColorDef) {
    this._optionsValue.value = colorValue.tbgr;
  }

  // ------------- use length toggle  ---------------
  private static _useLengthName = "useLength";
  private static _getUseLengthDescription = (): PropertyDescription => {
    return {
      name: TestUiProviderDialog._useLengthName,
      displayLabel: "",
      typename: "boolean",
      editor: {
        params: [{
          type: PropertyEditorParamTypes.SuppressEditorLabel,
          suppressLabelPlaceholder: true,
        } as SuppressLabelEditorParams,
        ],
      },
    };
  }

  public get useLength(): boolean {
    return this._useLengthValue.value as boolean;
  }

  public set useLength(option: boolean) {
    this._useLengthValue.value = option;
  }

  // ------------- Length ---------------
  private _useLengthValue: DialogItemValue = { value: true };

  private _lengthDescription = new LengthDescription();
  private static _lengthName = "length";

  // if _lengthValue also sets up display value then the "number-custom" type editor would not need to format the value before initially displaying it.
  private _lengthValue: DialogItemValue = { value: 1.5 };  // value in meters

  public get length(): number {
    return this._lengthValue.value as number;
  }

  public set length(option: number) {
    this._lengthValue.value = option;
  }

  // ------------- Weight ---------------
  private static _weightName = "weight";
  private static _getWeightDescription = (): PropertyDescription => {
    return {
      name: TestUiProviderDialog._weightName,
      displayLabel: "Weight",
      typename: "number",
      editor: {
        name: "weight-picker",
      },
    };
  }

  private _weightValue: DialogItemValue = { value: 3 };

  public get weight(): number {
    return this._weightValue.value as number;
  }

  public set weight(weightValue: number) {
    this._weightValue.value = weightValue;
  }

  // ------------- boolean based toggle button ---------------
  private static _lockToggleName = "lockToggle";
  private static _getLockToggleDescription = (): PropertyDescription => {
    return {
      name: TestUiProviderDialog._lockToggleName,
      displayLabel: "Lock",
      typename: "boolean",
      editor: { name: "toggle" },
    };
  }

  private _lockValue: DialogItemValue = { value: true };

  public get lock(): boolean {
    return this._lockValue.value as boolean;
  }

  public set lock(option: boolean) {
    this._lockValue.value = option;
  }

  // ------------- text based edit field ---------------
  private static _cityName = "city";
  private static _getCityDescription = (): PropertyDescription => {
    return {
      name: TestUiProviderDialog._cityName,
      displayLabel: "City",
      typename: "string",
    };
  }

  private _cityValue: DialogItemValue = { value: "Huntsville" };

  public get city(): string {
    return this._cityValue.value as string;
  }

  public set city(option: string) {
    this._cityValue.value = option;
  }

  // ------------- text based edit field ---------------
  private static _stateName = "stateName";
  private static _getStateDescription = (): PropertyDescription => {
    return {
      name: TestUiProviderDialog._stateName,
      displayLabel: "State",
      typename: "string",
      editor: {
        params: [{
          type: PropertyEditorParamTypes.InputEditorSize,
          size: 4,
          /* maxLength: 60,*/
        } as InputEditorSizeParams,
        ],
      },
    };
  }

  private _stateValue: DialogItemValue = { value: "AL" };

  public get stateName(): string {
    return this._stateValue.value as string;
  }

  public set stateName(option: string) {
    this._stateValue.value = option;
  }

  private getValueByItemName(itemName: string): DialogItemValue | undefined {
    const dialogItem = this._dialogItems === undefined ? undefined : this._dialogItems.find((item) => item.property.name === itemName);
    if (dialogItem !== undefined)
      return dialogItem.value;
    else
      return undefined;
  }
  private storeValues(): void {
    this._dialogItems = [...this._itemsManager.items];
    const newOptionsValue = this.getValueByItemName(TestUiProviderDialog._optionsName);
    this._optionsValue = newOptionsValue === undefined ? this._optionsValue : newOptionsValue;

    const newColorValue = this.getValueByItemName(TestUiProviderDialog._colorName);
    this._colorValue = newColorValue === undefined ? this._colorValue : newColorValue;

    const newWeightValue = this.getValueByItemName(TestUiProviderDialog._weightName);
    this._weightValue = newWeightValue === undefined ? this._weightValue : newWeightValue;

    const newLockValue = this.getValueByItemName(TestUiProviderDialog._lockToggleName);
    this._lockValue = newLockValue === undefined ? this._lockValue : newLockValue;

    const newCityValue = this.getValueByItemName(TestUiProviderDialog._cityName);
    this._cityValue = newCityValue === undefined ? this._cityValue : newCityValue;

    const newStateValue = this.getValueByItemName(TestUiProviderDialog._stateName);
    this._stateValue = newStateValue === undefined ? this._stateValue : newStateValue;

    const newLengthValue = this.getValueByItemName(TestUiProviderDialog._lengthName);
    this._lengthValue = newLengthValue === undefined ? this._lengthValue : newLengthValue;
  }
  private supplyDialogItems(): DialogItem[] {
    const dialogItems = new Array<DialogItem>();
    dialogItems.push({ value: this._optionsValue, property: TestUiProviderDialog._getEnumAsPicklistDescription(), editorPosition: { rowPriority: 0, columnIndex: 2 } });
    dialogItems.push({ value: this._colorValue, property: TestUiProviderDialog._getColorDescription(), editorPosition: { rowPriority: 0, columnIndex: 4 } });
    dialogItems.push({ value: this._weightValue, property: TestUiProviderDialog._getWeightDescription(), editorPosition: { rowPriority: 3, columnIndex: 2 } });
    dialogItems.push({ value: this._lockValue, property: TestUiProviderDialog._getLockToggleDescription(), editorPosition: { rowPriority: 5, columnIndex: 2 } });
    dialogItems.push({ value: this._cityValue, property: TestUiProviderDialog._getCityDescription(), editorPosition: { rowPriority: 10, columnIndex: 2 } });
    dialogItems.push({ value: this._stateValue, property: TestUiProviderDialog._getStateDescription(), editorPosition: { rowPriority: 10, columnIndex: 4 } });
    const lengthLock: DialogItem = { value: this._useLengthValue, property: TestUiProviderDialog._getUseLengthDescription(), editorPosition: { rowPriority: 20, columnIndex: 0 } };
    dialogItems.push({ value: this._lengthValue, property: this._lengthDescription, editorPosition: { rowPriority: 20, columnIndex: 2 }, isDisabled: false, lockProperty: lengthLock });
    return dialogItems;
  }

  private showColorInfoFromUi(updatedValue: DialogPropertySyncItem) {
    const tempColorDef = new ColorDef(updatedValue.value.value as number);
    const msg = `Property '${updatedValue.propertyName}' updated to value ${tempColorDef.toRgbString()}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

  private showInfoFromUi(updatedValue: DialogPropertySyncItem) {
    const msg = `Property '${updatedValue.propertyName}' updated to value ${updatedValue.value.value}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

  private syncLengthState() {
    const lengthItem = this._dialogItems?.find((item) => item.property.name === TestUiProviderDialog._lengthName);
    const useLengthItem = lengthItem ? lengthItem.lockProperty : undefined;
    if (!lengthItem || !useLengthItem)
      return;

    const syncItem: DialogPropertySyncItem = { value: lengthItem.value, propertyName: TestUiProviderDialog._lengthName, isDisabled: !this.useLength };
    const synchEventArgs: SyncPropertiesChangeEventArgs = { properties: [syncItem] };
    this._itemsManager.onSyncPropertiesChangeEvent.emit(synchEventArgs);
  }

  /** Used to send changes from UI */
  public applyUiPropertyChange = (updatedValue: DialogPropertySyncItem): void => {
    if (updatedValue.propertyName === TestUiProviderDialog._useLengthName) {
      this.useLength = updatedValue.value.value as boolean;
      this.showInfoFromUi(updatedValue);
      this.syncLengthState();
      return;
    }
    if (updatedValue.propertyName === TestUiProviderDialog._optionsName) {
      if (this._optionsValue.value !== updatedValue.value.value) {
        this.option = updatedValue.value.value as ColorOptions;
        this.showInfoFromUi(updatedValue);
      }
    } else if (updatedValue.propertyName === TestUiProviderDialog._lockToggleName) {
      this.lock = updatedValue.value.value as boolean;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === TestUiProviderDialog._cityName) {
      this.city = updatedValue.value.value as string;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === TestUiProviderDialog._stateName) {
      this.stateName = updatedValue.value.value as string;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === TestUiProviderDialog._lengthName) {
      this.length = updatedValue.value.value as number;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === TestUiProviderDialog._colorName) {
      this.colorValue = updatedValue.value.value as number;
      this.showColorInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === TestUiProviderDialog._weightName) {
      this.weight = updatedValue.value.value as number;
      this.showInfoFromUi(updatedValue);
    } else {
      // not an item we know about
      return;
    }
  }
}

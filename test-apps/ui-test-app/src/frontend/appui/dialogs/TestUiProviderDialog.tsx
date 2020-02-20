/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Dialog, DialogButtonType } from "@bentley/ui-core";
import { ModalDialogManager, DefaultReactDisplay } from "@bentley/ui-framework";
import {
  ColorEditorParams,
  InputEditorSizeParams,
  DialogItemsManager,
  DialogItem,
  DialogItemValue,
  DialogSyncItem,
  PropertyDescription,
  PropertyEditorParamTypes,
  PropertyValueFormat,
  SuppressLabelEditorParams,
  DialogItemsSyncArgs,
 } from "@bentley/ui-abstract";
import { ColorDef, ColorByName } from "@bentley/imodeljs-common";
import {
  IModelApp,
  LengthDescription,
  NotifyMessageDetails,
  OutputMessagePriority,
} from "@bentley/imodeljs-frontend";

const enum ColorOptions {
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

  constructor (props: TestUiProviderDialogProps) {
    super (props);
    this._itemsManager = props.itemsManager;
    this._dialogItems = props.dialogItems === undefined ? this.supplyDialogItems() : props.dialogItems;
    this.state = {
      opened: this.props.opened,
      movable: false,
      resizable: true,
      overlay: true,
    };
    this._itemsManager.items = this._dialogItems;
  }
  public render(): JSX.Element {
    return ( <Dialog
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
      onOutsideClick={this._handleCancel}
    >
      <DefaultReactDisplay itemsManager={this._itemsManager} key={Date.now()} />
    </Dialog>
    );
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
  public componentDidMount() {
    this._itemsManager.onDataChanged.addListener(this.applyUiPropertyChange);
  }

  public componentWillUnmount() {
    this._itemsManager.onDataChanged.removeListener(this.applyUiPropertyChange);
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

  private _optionsValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: ColorOptions.Blue as number };

  public get option(): ColorOptions {
    return this._optionsValue.value as ColorOptions;
  }

  public set option(option: ColorOptions) {
    this._optionsValue.value = option;
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

  private _colorValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: ColorByName.blue as number };

  public get colorValue(): number {
    return this._optionsValue.value as number;
  }

  public set colorValue(value: number) {
    this._optionsValue.value = value;
  }

  public get colorDef(): ColorDef {
    return new ColorDef(this._optionsValue.value as number);
  }

  public set colorDef(value: ColorDef) {
    this._optionsValue.value = value.tbgr;
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
  private _useLengthValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: true };

  private _lengthDescription = new LengthDescription();
  private static _lengthName = "length";

  // if _lengthValue also sets up display value then the "number-custom" type editor would not need to format the value before initially displaying it.
  private _lengthValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: 1.5 };  // value in meters

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

  private _weightValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: 3 };

  public get weight(): number {
    return this._weightValue.value as number;
  }

  public set weight(value: number) {
    this._weightValue.value = value;
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

  private _lockValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: true };

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

  private _cityValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: "Huntsville" };

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

  private _stateValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: "AL" };

  public get stateName(): string {
    return this._stateValue.value as string;
  }

  public set stateName(option: string) {
    this._stateValue.value = option;
  }

  // ------------- text based edit field ---------------
  private static _coordinateName = "coordinate";
  private static _getCoordinateDescription = (): PropertyDescription => {
    return {
      name: TestUiProviderDialog._coordinateName,
      displayLabel: "Coordinate",
      typename: "string",
    };
  }

  private _coordinateValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: "0.0, 0.0, 0.0" };

  public get coordinate(): string {
    return this._coordinateValue.value as string;
  }

  public set coordinate(option: string) {
    this._coordinateValue.value = option;
  }

  private supplyDialogItems(): DialogItem[] {
    const dialogItems = new Array<DialogItem>();
    dialogItems.push({ value: this._optionsValue, itemName: TestUiProviderDialog._optionsName, property: TestUiProviderDialog._getEnumAsPicklistDescription(), editorPosition: { rowPriority: 0, columnIndex: 2 }});
    dialogItems.push({ value: this._colorValue, itemName: TestUiProviderDialog._colorName, property: TestUiProviderDialog._getColorDescription(), editorPosition: { rowPriority: 0, columnIndex: 4 } });
    dialogItems.push({ value: this._weightValue, itemName: TestUiProviderDialog._weightName, property: TestUiProviderDialog._getWeightDescription(), editorPosition: { rowPriority: 3, columnIndex: 2 } });
    dialogItems.push({ value: this._lockValue, itemName: TestUiProviderDialog._lockToggleName, property: TestUiProviderDialog._getLockToggleDescription(), editorPosition: { rowPriority: 5, columnIndex: 2 } });
    dialogItems.push({ value: this._cityValue, itemName: TestUiProviderDialog._cityName, property: TestUiProviderDialog._getCityDescription(), editorPosition: { rowPriority: 10, columnIndex: 2 } });
    dialogItems.push({ value: this._stateValue, itemName: TestUiProviderDialog._stateName, property: TestUiProviderDialog._getStateDescription(), editorPosition: { rowPriority: 10, columnIndex: 4 } });
    dialogItems.push({ value: this._coordinateValue, itemName: TestUiProviderDialog._coordinateName, property: TestUiProviderDialog._getCoordinateDescription(), editorPosition: { rowPriority: 15, columnIndex: 2, columnSpan: 3 } });
    const lengthLock: DialogItem = {value: this._useLengthValue, itemName: TestUiProviderDialog._useLengthName, property: TestUiProviderDialog._getUseLengthDescription(), editorPosition: { rowPriority: 20, columnIndex: 0 }};
    dialogItems.push({value: this._lengthValue, itemName: TestUiProviderDialog._lengthName, property: this._lengthDescription, editorPosition: { rowPriority: 20, columnIndex: 2 }, isDisabled: false, lockProperty: lengthLock });
    return dialogItems;
  }

  private showColorInfoFromUi(updatedValue: DialogSyncItem) {
    const msg = `Property '${updatedValue.property.name}' updated to value ${this.colorDef.toRgbString()}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

  private showInfoFromUi(updatedValue: DialogSyncItem) {
    const msg = `Property '${updatedValue.property.name}' updated to value ${updatedValue.value.value}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

  private syncLengthState(): void {
    const lengthValue: DialogItemValue = { valueFormat: PropertyValueFormat.Primitive, value: this.length, displayValue:  this._lengthDescription.format(this.length as number) };
    const syncItem: DialogSyncItem = { value: lengthValue, itemName: TestUiProviderDialog._lengthName, isDisabled: !this.useLength, property: this._lengthDescription, editorPosition: {rowPriority: 0, columnIndex: 0} };
    const synchEventArgs: DialogItemsSyncArgs = { items: [syncItem] };
    this._itemsManager.onPropertiesChanged.emit (synchEventArgs);
  }

  /** Used to send changes from UI */
  public applyUiPropertyChange = (updatedValue: DialogSyncItem): void => {
    if (updatedValue.property.name === TestUiProviderDialog._optionsName) {
      if (this._optionsValue.value !== updatedValue.value.value) {
        this.option = updatedValue.value.value as ColorOptions;
        this.showInfoFromUi(updatedValue);
      }
    } else if (updatedValue.property.name === TestUiProviderDialog._lockToggleName) {
      this.lock = updatedValue.value.value as boolean;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.property.name === TestUiProviderDialog._cityName) {
      this.city = updatedValue.value.value as string;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.property.name === TestUiProviderDialog._stateName) {
      this.stateName = updatedValue.value.value as string;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.property.name === TestUiProviderDialog._useLengthName) {
      this.useLength = updatedValue.value.value as boolean;
      this.showInfoFromUi(updatedValue);
      this.syncLengthState();
    } else if (updatedValue.property.name === TestUiProviderDialog._lengthName) {
      this.length = updatedValue.value.value as number;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.property.name === TestUiProviderDialog._colorName) {
      this.colorValue = updatedValue.value.value as number;
      this.showColorInfoFromUi(updatedValue);
    } else if (updatedValue.property.name === TestUiProviderDialog._weightName) {
      this.weight = updatedValue.value.value as number;
      this.showInfoFromUi(updatedValue);
    }
  }
}

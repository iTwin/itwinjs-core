/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore picklist

import {
  IModelApp, PrimitiveTool,
  BeButtonEvent, EventHandled,
  ToolSettingsPropertyRecord, PropertyDescription, PrimitiveValue, ToolSettingsValue, ToolSettingsPropertySyncItem,
  NotifyMessageDetails, OutputMessagePriority, PropertyEditorParamTypes, QuantityType, ToolAssistance, ToolAssistanceImage,
  ColorEditorParams, InputEditorSizeParams, SuppressLabelEditorParams, AngleDescription, LengthDescription,
} from "@bentley/imodeljs-frontend";
import { Logger } from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";
import { ColorDef, ColorByName } from "@bentley/imodeljs-common";
import { FormatterSpec } from "@bentley/imodeljs-quantity";
import { UiFramework, CursorInformation, MenuItemProps } from "@bentley/ui-framework";

const enum ToolOptions {
  Red,
  White,
  Blue,
  Yellow,
}

export class ToolWithSettings extends PrimitiveTool {
  public static toolId = "ToolWithSettings";
  public readonly points: Point3d[] = [];
  private _showCoordinatesOnPointerMove = false;
  private _stationFormatterSpec?: FormatterSpec;
  private _lengthDescription = new LengthDescription();

  private toggleCoordinateUpdate() {
    this._showCoordinatesOnPointerMove = !this._showCoordinatesOnPointerMove;
  }

  // Tool Setting Properties
  // ------------- Enum based picklist ---------------
  private static enumAsPicklistMessage(str: string) { return IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Options." + str); }
  private static _optionsName = "enumAsPicklist";
  private static _getEnumAsPicklistDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._optionsName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.Options"),
      typename: "enum",
      enum: {
        choices: [
          { label: ToolWithSettings.enumAsPicklistMessage("Red"), value: ToolOptions.Red },
          { label: ToolWithSettings.enumAsPicklistMessage("White"), value: ToolOptions.White },
          { label: ToolWithSettings.enumAsPicklistMessage("Blue"), value: ToolOptions.Blue },
          { label: ToolWithSettings.enumAsPicklistMessage("Yellow"), value: ToolOptions.Yellow },
        ],
      },
    };
  }

  private _optionsValue = new ToolSettingsValue(ToolOptions.Blue);

  public get option(): ToolOptions {
    return this._optionsValue.value as ToolOptions;
  }

  public set option(option: ToolOptions) {
    this._optionsValue.value = option;
  }

  // ------------- Color ---------------
  private static _colorName = "color";
  private static _getColorDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._colorName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.Color"),
      typename: "number",
      editor: {
        name: "color-picker",
        params: [
          {
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
            numColumns: 2,
          } as ColorEditorParams,
        ],
      },
    };
  }

  private _colorValue = new ToolSettingsValue(ColorByName.blue as number);

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

  // ------------- Weight ---------------
  private static _weightName = "weight";
  private static _getWeightDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._weightName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.Weight"),
      typename: "number",
      editor: {
        name: "weight-picker",
      },
    };
  }

  private _weightValue = new ToolSettingsValue(3);

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
      name: ToolWithSettings._lockToggleName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.Lock"),
      typename: "boolean",
      editor: { name: "toggle" },
    };
  }

  private _lockValue = new ToolSettingsValue(true);

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
      name: ToolWithSettings._cityName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.City"),
      typename: "string",
    };
  }

  private _cityValue = new ToolSettingsValue("Exton");

  public get city(): string {
    return this._cityValue.value as string;
  }

  public set city(option: string) {
    this._cityValue.value = option;
  }

  // ------------- text based edit field ---------------
  private static _stateName = "state";
  private static _getStateDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._stateName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.State"),
      typename: "string",
      editor: {
        params: [
          {
            type: PropertyEditorParamTypes.InputEditorSize,
            size: 4,
            /* maxLength: 60,*/
          } as InputEditorSizeParams,
        ],
      },
    };
  }

  private _stateValue = new ToolSettingsValue("PA");

  public get state(): string {
    return this._stateValue.value as string;
  }

  public set state(option: string) {
    this._stateValue.value = option;
  }

  // ------------- text based edit field ---------------
  private static _coordinateName = "coordinate";
  private static _getCoordinateDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._coordinateName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.Coordinate"),
      typename: "string",
    };
  }

  private _coordinateValue = new ToolSettingsValue("0.0, 0.0, 0.0");

  public get coordinate(): string {
    return this._coordinateValue.value as string;
  }

  public set coordinate(option: string) {
    this._coordinateValue.value = option;
  }

  // ------------- display station value as text  ---------------
  public get stationFormatterSpec(): FormatterSpec | undefined {
    if (this._stationFormatterSpec)
      return this._stationFormatterSpec;

    const formatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(QuantityType.Stationing);
    if (formatterSpec) {
      this._stationFormatterSpec = formatterSpec;
      return formatterSpec;
    }

    Logger.logError("UITestApp.ToolWithSettings", "Station formatterSpec was expected to be set before tool started.");
    return undefined;
  }

  private static _stationName = "station";
  private static _getStationDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._stationName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.Station"),
      typename: "string",
    };
  }

  private formatStation(numberValue: number): string {
    if (this.stationFormatterSpec) {
      return IModelApp.quantityFormatter.formatQuantity(numberValue, this.stationFormatterSpec);
    }
    return numberValue.toFixed(2);
  }

  private _stationValue = new ToolSettingsValue(this.formatStation(0.0));

  public get station(): string {
    return this._stationValue.value as string;
  }

  public set station(option: string) {
    this._stationValue.value = option;
  }

  // ------------- use length toggle  ---------------
  private static _useLengthName = "useLength";
  private static _getUseLengthDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._useLengthName,
      displayLabel: "",
      typename: "boolean",
      editor: {
        params: [
          {
            type: PropertyEditorParamTypes.SuppressEditorLabel,
            suppressLabelPlaceholder: true,
          } as SuppressLabelEditorParams,
        ],
      },
    };
  }

  private _useLengthValue = new ToolSettingsValue(true);

  public get useLength(): boolean {
    return this._useLengthValue.value as boolean;
  }

  public set useLength(option: boolean) {
    this._useLengthValue.value = option;
  }

  // ------------- Length ---------------
  private static _lengthName = "length";

  // if _lengthValue also sets up display value then the "number-custom" type editor would not need to format the value before initially displaying it.
  private _lengthValue = new ToolSettingsValue(1.5);  // value in meters

  public get length(): number {
    return this._lengthValue.value as number;
  }

  public set length(option: number) {
    this._lengthValue.value = option;
  }

  // ------------- Angle ---------------

  // if _angleValue also sets up display value then the "number-custom" type editor would not need to format the value before initially displaying it.
  private _angleValue = new ToolSettingsValue(0.0);

  public get angle(): number {
    return this._angleValue.value as number;
  }

  public set angle(option: number) {
    this._angleValue.value = option;
  }

  // -------- end of ToolSettings ----------

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() { super.onPostInstall(); this.setupAndPromptForNextAction(); }
  public onUnsuspend(): void { this.provideToolAssistance(); }

  /** Establish current tool state and initialize drawing aides following onPostInstall, onDataButtonDown, onUndoPreviousStep, or other events that advance or back up the current tool state.
   * Enable snapping or auto-locate for AccuSnap.
   * Setup AccuDraw using AccuDrawHintBuilder.
   * Set view cursor when default cursor isn't applicable.
   * Provide tool assistance.
   */
  protected setupAndPromptForNextAction(): void {
    this.provideToolAssistance();
  }

  /** A tool is responsible for providing tool assistance appropriate to the current tool state following significant events.
   * After onPostInstall to establish instructions for the initial tool state.
   * After onUnsuspend to reestablish instructions when no longer suspended by a ViewTool or InputCollector.
   * After onDataButtonDown (or other tool event) advances or backs up the current tool state.
   * After onUndoPreviousStep or onRedoPreviousStep modifies the current tool state.
   */
  protected provideToolAssistance(): void {
    const mainInstruction = ToolAssistance.createInstruction(ToolAssistanceImage.CursorClick, IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.GetPoint"));
    const instructions = ToolAssistance.createInstructions(mainInstruction);

    IModelApp.notifications.setToolAssistance(instructions);
  }

  private showInfoFromCursorMenu(label: string) {
    const msg = `Context Menu selection - ${label}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

  public async onDataButtonDown(ev: BeButtonEvent): Promise<EventHandled> {
    // Used to test Cursor Menu
    if (ev.isAltKey) {
      const menuItems: MenuItemProps[] = [];
      menuItems.push({ id: "entry1", item: { label: "Label1", iconSpec: "icon-placeholder", execute: () => { this.showInfoFromCursorMenu("hello from entry1"); } } });
      menuItems.push({ id: "entry2", item: { label: "Label2", execute: () => { this.showInfoFromCursorMenu("hello from entry2"); } } });
      menuItems.push({ id: "entry3", item: { label: "Label3", iconSpec: "icon-placeholder", execute: () => { this.showInfoFromCursorMenu("hello from entry3"); } } });

      UiFramework.openCursorMenu({ items: menuItems, position: { x: CursorInformation.cursorX, y: CursorInformation.cursorY } });
      return EventHandled.No;
    }

    if (this.points.length < 2)
      this.points.push(ev.point.clone());
    else
      this.points[1] = ev.point.clone();
    this.toggleCoordinateUpdate();
    this.setupAndPromptForNextAction();

    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    /* Common reset behavior for primitive tools is calling onReinitialize to restart or exitTool to terminate. */
    this.onReinitialize();
    return EventHandled.No;
  }

  private syncCoordinateValue(coordinate: string, station: string): void {
    const coordinateValue = new ToolSettingsValue(coordinate);
    // clone coordinateValue if storing value within tool - in this case we are not
    const syncItem: ToolSettingsPropertySyncItem = { value: coordinateValue, propertyName: ToolWithSettings._coordinateName };
    const stationValue = new ToolSettingsValue(station);
    const stationSyncItem: ToolSettingsPropertySyncItem = { value: stationValue, propertyName: ToolWithSettings._stationName };
    this.syncToolSettingsProperties([syncItem, stationSyncItem]);
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (!this._showCoordinatesOnPointerMove)
      return;

    const point = ev.point.clone();
    const formattedString: string = `${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)}`;
    let distance = 0;
    if (this.points.length > 0)
      distance = point.distance(this.points[0]);

    this.syncCoordinateValue(formattedString, this.formatStation(distance));
  }

  public onRestartTool(): void {
    const tool = new ToolWithSettings();
    if (!tool.run())
      this.exitTool();
  }

  /** Used to supply DefaultToolSettingProvider with a list of properties to use to generate ToolSettings.  If undefined then no ToolSettings will be displayed */
  public supplyToolSettingsProperties(): ToolSettingsPropertyRecord[] | undefined {
    const readonly = true;
    const toolSettings = new Array<ToolSettingsPropertyRecord>();
    toolSettings.push(new ToolSettingsPropertyRecord(this._optionsValue.clone() as PrimitiveValue, ToolWithSettings._getEnumAsPicklistDescription(), { rowPriority: 0, columnIndex: 2 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._colorValue.clone() as PrimitiveValue, ToolWithSettings._getColorDescription(), { rowPriority: 2, columnIndex: 2 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._weightValue.clone() as PrimitiveValue, ToolWithSettings._getWeightDescription(), { rowPriority: 3, columnIndex: 2 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._lockValue.clone() as PrimitiveValue, ToolWithSettings._getLockToggleDescription(), { rowPriority: 5, columnIndex: 2 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._cityValue.clone() as PrimitiveValue, ToolWithSettings._getCityDescription(), { rowPriority: 10, columnIndex: 2 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._stateValue.clone() as PrimitiveValue, ToolWithSettings._getStateDescription(), { rowPriority: 10, columnIndex: 4 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._coordinateValue.clone() as PrimitiveValue, ToolWithSettings._getCoordinateDescription(), { rowPriority: 15, columnIndex: 2, columnSpan: 3 }, readonly));
    toolSettings.push(new ToolSettingsPropertyRecord(this._stationValue.clone() as PrimitiveValue, ToolWithSettings._getStationDescription(), { rowPriority: 16, columnIndex: 2, columnSpan: 3 }, readonly));
    toolSettings.push(new ToolSettingsPropertyRecord(this._useLengthValue.clone() as PrimitiveValue, ToolWithSettings._getUseLengthDescription(), { rowPriority: 20, columnIndex: 0 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._lengthValue.clone() as PrimitiveValue, new LengthDescription(), { rowPriority: 20, columnIndex: 2 }));
    toolSettings.push(new ToolSettingsPropertyRecord(this._angleValue.clone() as PrimitiveValue, new AngleDescription(), { rowPriority: 25, columnIndex: 2 }));
    return toolSettings;
  }

  private showColorInfoFromUi(updatedValue: ToolSettingsPropertySyncItem) {
    const msg = `Property '${updatedValue.propertyName}' updated to value ${this.colorDef.toRgbString()}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

  private showInfoFromUi(updatedValue: ToolSettingsPropertySyncItem) {
    const msg = `Property '${updatedValue.propertyName}' updated to value ${updatedValue.value.value}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

  private syncLengthState(): void {
    const lengthValue = new ToolSettingsValue(this.length);
    lengthValue.displayValue = this._lengthDescription.format(lengthValue.value as number);
    const syncItem: ToolSettingsPropertySyncItem = { value: lengthValue, propertyName: ToolWithSettings._lengthName, isDisabled: !this.useLength };
    this.syncToolSettingsProperties([syncItem]);
  }

  /** Used to send changes from UI back to Tool */
  public applyToolSettingPropertyChange(updatedValue: ToolSettingsPropertySyncItem): boolean {
    if (updatedValue.propertyName === ToolWithSettings._optionsName) {
      if (this._optionsValue.value !== updatedValue.value.value) {
        this.option = updatedValue.value.value as ToolOptions;
        this.showInfoFromUi(updatedValue);
      }
    } else if (updatedValue.propertyName === ToolWithSettings._lockToggleName) {
      this.lock = updatedValue.value.value as boolean;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === ToolWithSettings._cityName) {
      this.city = updatedValue.value.value as string;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === ToolWithSettings._stateName) {
      this.state = updatedValue.value.value as string;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === ToolWithSettings._useLengthName) {
      this.useLength = updatedValue.value.value as boolean;
      this.showInfoFromUi(updatedValue);
      this.syncLengthState();
    } else if (updatedValue.propertyName === ToolWithSettings._lengthName) {
      this.length = updatedValue.value.value as number;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === ToolWithSettings._colorName) {
      this.colorValue = updatedValue.value.value as number;
      this.showColorInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === ToolWithSettings._weightName) {
      this.weight = updatedValue.value.value as number;
      this.showInfoFromUi(updatedValue);
    }

    // return true is change is valid
    return true;
  }

}

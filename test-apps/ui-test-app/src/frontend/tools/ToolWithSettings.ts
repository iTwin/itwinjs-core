/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore picklist

import { Logger } from "@bentley/bentleyjs-core";
import { Point3d } from "@bentley/geometry-core";
import { ColorByName, ColorDef } from "@bentley/imodeljs-common";
import {
  AngleDescription, BeButtonEvent, EventHandled, IModelApp, LengthDescription, NotifyMessageDetails, OutputMessagePriority, PrimitiveTool,
  QuantityType, SurveyLengthDescription, ToolAssistance, ToolAssistanceImage,
} from "@bentley/imodeljs-frontend";
import { FormatterSpec } from "@bentley/imodeljs-quantity";
import {
  ColorEditorParams, DialogItem, DialogItemValue, DialogLayoutDataProvider, DialogPropertyItem, DialogPropertySyncItem, ImageCheckBoxParams,
  InputEditorSizeParams, PropertyChangeResult, PropertyChangeStatus, PropertyDescription, PropertyEditorParamTypes, RelativePosition,
  SuppressLabelEditorParams, SyncPropertiesChangeEvent,
} from "@bentley/ui-abstract";
import { CursorInformation, MenuItemProps, UiFramework } from "@bentley/ui-framework";

enum ToolOptions {
  Red = 1,
  White = 2,
  Blue = 3,
  Yellow = 4,
  Purple = 5,
  Pink = 6,
  Green = 7,
}

enum ToolOptionNames {
  Red = "Red",
  White = "White",
  Blue = "Blue",
  Yellow = "Yellow",
  Purple = "Purple",
  Pink = "Pink",
  Green = "Green",
}

class PointOnePopupSettingsProvider extends DialogLayoutDataProvider {
  // ------------- Weight ---------------
  private static _weightName = "weight";
  private static _getWeightDescription(): PropertyDescription {
    return {
      name: this._weightName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.Weight"),
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

  public set weight(weightVal: number) {
    this._weightValue.value = weightVal;
  }

  /** Called by UI to inform data provider of changes.  */
  public processChangesInUi(properties: DialogPropertyItem[]): PropertyChangeResult {
    if (properties.length > 0) {
      for (const prop of properties) {
        if (prop.propertyName === PointOnePopupSettingsProvider._weightName) {
          this.weight = prop.value.value! as number;
          const msg = `Set Weight = ${this.weight}`;
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
          continue;
        }
      }
    }
    return { status: PropertyChangeStatus.Success };
  }

  /** Called by UI to request available properties when UI is manually created. */
  public supplyDialogItems(): DialogItem[] | undefined {
    return [
      { value: this._weightValue, property: PointOnePopupSettingsProvider._getWeightDescription(), editorPosition: { rowPriority: 2, columnIndex: 1 } },
    ];
  }

  /** Get Sync UI Control Properties Event */
  public onSyncPropertiesChangeEvent = new SyncPropertiesChangeEvent();

  /** Called by UI to validate a property value */
  public validateProperty(_item: DialogPropertyItem): PropertyChangeResult {
    return { status: PropertyChangeStatus.Success };
  }

  /** Called to sync properties synchronously if a UiDataProvider is active for the UI */
  public syncProperties(_syncProperties: DialogPropertySyncItem[]) {
    return;
  }
}

class PointTwoPopupSettingsProvider extends DialogLayoutDataProvider {

  // ------------- text based edit field ---------------
  private static _sourcePropertyName = "source";
  private static _getSourceDescription = (): PropertyDescription => {
    return {
      name: PointTwoPopupSettingsProvider._sourcePropertyName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.Source"),
      typename: "string",
    };
  };

  private _sourceValue: DialogItemValue = { value: "unknown" };

  public get source(): string {
    return this._sourceValue.value as string;
  }

  public set source(option: string) {
    this._sourceValue.value = option;
  }

  /** Called by UI to inform data provider of changes.  */
  public processChangesInUi(properties: DialogPropertyItem[]): PropertyChangeResult {
    if (properties.length > 0) {
      for (const prop of properties) {
        if (prop.propertyName === PointTwoPopupSettingsProvider._sourcePropertyName) {
          this.source = prop.value.value ? prop.value.value as string : "";
          const msg = `Set Source = ${this.source}`;
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
          continue;
        }
      }
    }
    return { status: PropertyChangeStatus.Success };
  }

  /** Called by UI to request available properties when UI is manually created. */
  public supplyDialogItems(): DialogItem[] | undefined {
    return [
      { value: this._sourceValue, property: PointTwoPopupSettingsProvider._getSourceDescription(), editorPosition: { rowPriority: 1, columnIndex: 1 } },
    ];
  }

  /** Get Sync UI Control Properties Event */
  public onSyncPropertiesChangeEvent = new SyncPropertiesChangeEvent();

  /** Called by UI to validate a property value */
  public validateProperty(_item: DialogPropertyItem): PropertyChangeResult {
    return { status: PropertyChangeStatus.Success };
  }

  /** Called to sync properties synchronously if a UiDataProvider is active for the UI */
  public syncProperties(_syncProperties: DialogPropertySyncItem[]) {
    return;
  }
}

export class ToolWithSettings extends PrimitiveTool {
  private _pointOnePopupSettingsProvider = new PointOnePopupSettingsProvider();
  private _pointTwoPopupSettingsProvider = new PointTwoPopupSettingsProvider();
  public static toolId = "ToolWithSettings";
  public points: Point3d[] = [];
  private _showCoordinatesOnPointerMove = false;
  private _stationFormatterSpec?: FormatterSpec;
  private _lengthDescription = new LengthDescription();
  private _surveyLengthDescription = new SurveyLengthDescription(ToolWithSettings._surveyLengthName, "Survey");

  private toggleCoordinateUpdate() {
    this._showCoordinatesOnPointerMove = !this._showCoordinatesOnPointerMove;
  }

  // ------------- Color List ---------------
  private static _colorOptionPropertyName = "colorOption";
  private static enumAsPicklistMessage(str: string) { return IModelApp.i18n.translate(`SampleApp:tools.ToolWithSettings.Options.${str}`); }
  private static getEnumAsPicklistDescription(showExtendedSet: boolean): PropertyDescription {
    const colorChoices = showExtendedSet ? [
      { label: this.enumAsPicklistMessage(ToolOptionNames.Red), value: ToolOptions.Red },
      { label: this.enumAsPicklistMessage(ToolOptionNames.White), value: ToolOptions.White },
      { label: this.enumAsPicklistMessage(ToolOptionNames.Blue), value: ToolOptions.Blue },
      { label: this.enumAsPicklistMessage(ToolOptionNames.Yellow), value: ToolOptions.Yellow },
      { label: this.enumAsPicklistMessage(ToolOptionNames.Purple), value: ToolOptions.Purple },
      { label: this.enumAsPicklistMessage(ToolOptionNames.Pink), value: ToolOptions.Pink },
      { label: this.enumAsPicklistMessage(ToolOptionNames.Green), value: ToolOptions.Green },
    ] :
      [
        { label: this.enumAsPicklistMessage(ToolOptionNames.Red), value: ToolOptions.Red },
        { label: this.enumAsPicklistMessage(ToolOptionNames.White), value: ToolOptions.White },
        { label: this.enumAsPicklistMessage(ToolOptionNames.Blue), value: ToolOptions.Blue },
        { label: this.enumAsPicklistMessage(ToolOptionNames.Yellow), value: ToolOptions.Yellow },
      ];

    return {
      name: this._colorOptionPropertyName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.Color"),
      typename: "enum",
      enum: {
        choices: colorChoices,
      },
    };
  }

  private _colorOptionValue: DialogItemValue = { value: ToolOptions.Blue };

  public get colorOption(): ToolOptions {
    return this._colorOptionValue.value as ToolOptions;
  }

  public set colorOption(option: ToolOptions) {
    this._colorOptionValue.value = option;
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
          numColumns: 2,
        } as ColorEditorParams,
        ],
      },
    };
  };

  private _colorValue: DialogItemValue = { value: ColorByName.blue as number };

  public get colorValue(): number {
    return this._colorValue.value as number;
  }

  public set colorValue(colorVal: number) {
    this._colorValue.value = colorVal;
  }

  public get colorDef(): ColorDef {
    return ColorDef.create(this._colorValue.value as number);
  }

  public set colorDef(colorVal: ColorDef) {
    this._colorValue.value = colorVal.tbgr;
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
  };

  private _lockToggleDisabled = false;
  private _lockValue: DialogItemValue = { value: true };

  public get lock(): boolean {
    return this._lockValue.value as boolean;
  }

  public set lock(option: boolean) {
    this._lockValue.value = option;
  }

  // ------------- boolean based toggle button ---------------
  private static _imageCheckBoxName = "imageCheckBox";
  private static _getImageCheckBoxDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._imageCheckBoxName,
      displayLabel: "",
      typename: "boolean",
      editor: {
        name: "image-check-box",
        params: [{
          type: PropertyEditorParamTypes.CheckBoxImages,
          imageOff: "icon-clear-night",
          imageOn: "icon-clear-day",
        } as ImageCheckBoxParams, {
          type: PropertyEditorParamTypes.SuppressEditorLabel,
          suppressLabelPlaceholder: true,
        } as SuppressLabelEditorParams,
        ],
      },
    };
  };

  private _imageCheckboxDisabled = false;

  private _imageCheckBoxValue: DialogItemValue = { value: true };

  public get imageCheckBoxValue(): boolean {
    return this._imageCheckBoxValue.value as boolean;
  }

  public set imageCheckBoxValue(option: boolean) {
    this._imageCheckBoxValue.value = option;
  }

  // ------------- text based edit field ---------------
  private static _cityName = "city";
  private static _getCityDescription = (): PropertyDescription => {
    return {
      name: ToolWithSettings._cityName,
      displayLabel: IModelApp.i18n.translate("SampleApp:tools.ToolWithSettings.Prompts.City"),
      typename: "string",
    };
  };

  private _cityValue: DialogItemValue = { value: "Exton" };

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
        params: [{
          type: PropertyEditorParamTypes.InputEditorSize,
          size: 4,
          /* maxLength: 60,*/
        } as InputEditorSizeParams,
        ],
      },
    };
  };

  private _stateValue: DialogItemValue = { value: "PA" };

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
  };

  private _coordinateValue: DialogItemValue = { value: "0.0, 0.0, 0.0" };

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
  };

  private formatStation(numberValue: number): string {
    if (this.stationFormatterSpec) {
      return IModelApp.quantityFormatter.formatQuantity(numberValue, this.stationFormatterSpec);
    }
    return numberValue.toFixed(2);
  }

  private _stationValue: DialogItemValue = { value: this.formatStation(0.0) };

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
        params: [{
          type: PropertyEditorParamTypes.SuppressEditorLabel,
          suppressLabelPlaceholder: true,
        } as SuppressLabelEditorParams,
        ],
      },
    };
  };

  private _isUseLengthCheckboxDisabled = false;
  private _useLengthValue: DialogItemValue = { value: true };

  public get useLength(): boolean {
    return this._useLengthValue.value as boolean;
  }

  public set useLength(option: boolean) {
    this._useLengthValue.value = option;
  }

  // ------------- Length ---------------
  private static _lengthName = "length";

  // if _lengthValue also sets up display value then the "number-custom" type editor would not need to format the value before initially displaying it.
  private _lengthValue: DialogItemValue = { value: 1.5 };  // value in meters

  public get length(): number {
    return this._lengthValue.value as number;
  }

  public set length(option: number) {
    this._lengthValue.value = option;
  }

  // ------------- Survey Length ---------------
  private static _surveyLengthName = "surveyLength";

  // if _surveyLengthValue also sets up display value then the "number-custom" type editor would not need to format the value before initially displaying it.
  private _surveyLengthValue: DialogItemValue = { value: 51.25 };  // value in meters

  public get surveyLength(): number {
    return this._surveyLengthValue.value as number;
  }

  public set surveyLength(option: number) {
    this._surveyLengthValue.value = option;
  }

  // ------------- Angle ---------------

  // if _angleValue also sets up display value then the "number-custom" type editor would not need to format the value before initially displaying it.
  private _angleValue: DialogItemValue = { value: 0.0 };

  public get angle(): number {
    return this._angleValue.value as number;
  }

  public set angle(option: number) {
    this._angleValue.value = option;
  }

  // -------- end of ToolSettings ----------

  public requireWriteableTarget(): boolean { return false; }
  public onPostInstall() {
    super.onPostInstall();
    this.setupAndPromptForNextAction();
    this.points = [];
  }
  public onUnsuspend(): void { this.provideToolAssistance(); }

  /** Establish current tool state and initialize drawing aides following onPostInstall, onDataButtonDown, onUndoPreviousStep, or other events that advance or back up the current tool state.
   * Enable snapping or auto-locate for AccuSnap.
   * Setup AccuDraw using AccuDrawHintBuilder.
   * Set view cursor when default cursor isn't applicable.
   * Provide tool assistance.
   */
  protected setupAndPromptForNextAction(): void {
    const offset = IModelApp.uiAdmin.createXAndY(8, 0);

    if (1 === this.points.length)
      IModelApp.uiAdmin.openToolSettingsPopup(this._pointOnePopupSettingsProvider, IModelApp.uiAdmin.cursorPosition, offset, this._handleToolSettingsPopupCancel, RelativePosition.Right);
    else if (2 === this.points.length) {
      IModelApp.uiAdmin.openToolSettingsPopup(this._pointTwoPopupSettingsProvider, IModelApp.uiAdmin.cursorPosition, offset, this._handleToolSettingsPopupCancel, RelativePosition.Right);
    }

    this.provideToolAssistance();
  }

  private _handleToolSettingsPopupCancel = () => {
    IModelApp.uiAdmin.closeToolSettingsPopup();
  };

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
      menuItems.push({ id: "entry1", item: { label: "Label1", icon: "icon-placeholder", execute: () => { this.showInfoFromCursorMenu("hello from entry1"); } } });
      menuItems.push({ id: "entry2", item: { label: "Label2", execute: () => { this.showInfoFromCursorMenu("hello from entry2"); } } });
      menuItems.push({ id: "entry3", item: { label: "Label3", icon: "icon-placeholder", execute: () => { this.showInfoFromCursorMenu("hello from entry3"); } } });

      UiFramework.openCursorMenu({ items: menuItems, position: { x: CursorInformation.cursorX, y: CursorInformation.cursorY } });
      return EventHandled.No;
    }

    this.points.push(ev.point.clone());
    if (2 === this.points.length) {
      const msg = `Point One -> Weight=${this._pointOnePopupSettingsProvider.weight}`;
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
    } else if (3 === this.points.length) {
      const msg = `Point Two -> Source=${this._pointTwoPopupSettingsProvider.source}`;
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
    }

    this.toggleCoordinateUpdate();
    IModelApp.uiAdmin.closeToolSettingsPopup();
    if (3 === this.points.length)
      this.points = [];
    this.setupAndPromptForNextAction();

    return EventHandled.No;
  }

  public async onResetButtonUp(_ev: BeButtonEvent): Promise<EventHandled> {
    IModelApp.uiAdmin.closeToolSettingsPopup();

    /* Common reset behavior for primitive tools is calling onReinitialize to restart or exitTool to terminate. */
    this.onReinitialize();
    return EventHandled.No;
  }

  private syncCoordinateValue(coordinate: string, station: string, distance: number): void {
    const coordinateValue: DialogItemValue = { value: coordinate };
    // clone coordinateValue if storing value within tool - in this case we are not
    const syncItem: DialogPropertySyncItem = { value: coordinateValue, propertyName: ToolWithSettings._coordinateName, isDisabled: true };
    const stationValue: DialogItemValue = { value: station };
    const stationSyncItem: DialogPropertySyncItem = { value: stationValue, propertyName: ToolWithSettings._stationName, isDisabled: false };

    const surveyLengthValue: DialogItemValue = { value: distance, displayValue: this._surveyLengthDescription.format(distance) };
    const surveySyncItem: DialogPropertySyncItem = { value: surveyLengthValue, propertyName: ToolWithSettings._surveyLengthName, isDisabled: true };
    this.syncToolSettingsProperties([syncItem, stationSyncItem, surveySyncItem]);
  }

  public async onKeyTransition(wentDown: boolean, keyEvent: KeyboardEvent): Promise<EventHandled> {
    if (wentDown && keyEvent.key === "1") {
      this._isUseLengthCheckboxDisabled = !this._isUseLengthCheckboxDisabled;

      const syncItem: DialogPropertySyncItem = { propertyName: ToolWithSettings._useLengthName, value: this._useLengthValue, isDisabled: this._isUseLengthCheckboxDisabled };
      // test updating color option and available colors by providing a new enum list
      this.colorOption = this._isUseLengthCheckboxDisabled ? ToolOptions.Pink : ToolOptions.Red;
      const updatedColorListProperty = ToolWithSettings.getEnumAsPicklistDescription(this._isUseLengthCheckboxDisabled);
      const syncColorItem: DialogPropertySyncItem = { propertyName: ToolWithSettings._colorOptionPropertyName, value: this._colorOptionValue, property: updatedColorListProperty };
      this.syncToolSettingsProperties([syncItem, syncColorItem]);

      const isDisabledStr = this._isUseLengthCheckboxDisabled ? "disabled" : "enabled";
      const msg = `UseLength checkbox is now '${isDisabledStr}'`;
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
      return EventHandled.Yes;
    } else if (wentDown && keyEvent.key === "2") {
      this._imageCheckboxDisabled = !this._imageCheckboxDisabled;
      const syncItem: DialogPropertySyncItem = { propertyName: ToolWithSettings._imageCheckBoxName, value: this._imageCheckBoxValue, isDisabled: this._imageCheckboxDisabled };
      this.syncToolSettingsProperties([syncItem]);

      const isDisabledStr = this._imageCheckboxDisabled ? "disabled" : "enabled";
      const msg = `ImageCheckbox is now '${isDisabledStr}'`;
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
      return EventHandled.Yes;
    } else if (wentDown && keyEvent.key === "3") {
      this._lockToggleDisabled = !this._lockToggleDisabled;
      const syncItem: DialogPropertySyncItem = { propertyName: ToolWithSettings._lockToggleName, value: this._lockValue, isDisabled: this._lockToggleDisabled };
      this.syncToolSettingsProperties([syncItem]);

      const isDisabledStr = this._lockToggleDisabled ? "disabled" : "enabled";
      const msg = `Lock Toggle is now '${isDisabledStr}'`;
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
      return EventHandled.Yes;
    }
    return super.onKeyTransition(wentDown, keyEvent);
  }

  public async onMouseMotion(ev: BeButtonEvent): Promise<void> {
    if (!this._showCoordinatesOnPointerMove)
      return;

    const point = ev.point.clone();
    const formattedString: string = `${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)}`;
    let distance = 0;
    if (this.points.length > 0)
      distance = point.distance(this.points[0]);

    this.syncCoordinateValue(formattedString, this.formatStation(distance), distance);
  }

  public onRestartTool(): void {
    const tool = new ToolWithSettings();
    if (!tool.run())
      this.exitTool();
  }

  /** Used to supply DefaultToolSettingProvider with a list of properties to use to generate ToolSettings.  If undefined then no ToolSettings will be displayed */
  public supplyToolSettingsProperties(): DialogItem[] | undefined {
    const readonly = false;
    const toolSettings = new Array<DialogItem>();
    toolSettings.push({ value: this._colorOptionValue, property: ToolWithSettings.getEnumAsPicklistDescription(this._isUseLengthCheckboxDisabled), editorPosition: { rowPriority: 1, columnIndex: 1 } });
    toolSettings.push({ value: this._colorValue, property: ToolWithSettings._getColorDescription(), editorPosition: { rowPriority: 2, columnIndex: 2 } });
    toolSettings.push({ value: this._lockValue, property: ToolWithSettings._getLockToggleDescription(), editorPosition: { rowPriority: 5, columnIndex: 2 } });
    toolSettings.push({ value: this._cityValue, property: ToolWithSettings._getCityDescription(), editorPosition: { rowPriority: 10, columnIndex: 2 } });
    toolSettings.push({ value: this._stateValue, property: ToolWithSettings._getStateDescription(), editorPosition: { rowPriority: 10, columnIndex: 4 } });
    toolSettings.push({ value: this._coordinateValue, property: ToolWithSettings._getCoordinateDescription(), editorPosition: { rowPriority: 15, columnIndex: 2 }, isDisabled: readonly });
    toolSettings.push({ value: this._stationValue, property: ToolWithSettings._getStationDescription(), editorPosition: { rowPriority: 16, columnIndex: 2 }, isDisabled: readonly });
    const lengthLock = { value: this._useLengthValue, property: ToolWithSettings._getUseLengthDescription(), editorPosition: { rowPriority: 20, columnIndex: 0 }, isDisabled: this._isUseLengthCheckboxDisabled };
    toolSettings.push({ value: this._lengthValue, property: this._lengthDescription, editorPosition: { rowPriority: 20, columnIndex: 2 }, isDisabled: false, lockProperty: lengthLock });
    toolSettings.push({ value: this._surveyLengthValue, property: this._surveyLengthDescription, editorPosition: { rowPriority: 21, columnIndex: 2 }, isDisabled: readonly });
    toolSettings.push({ value: this._angleValue, property: new AngleDescription(), editorPosition: { rowPriority: 25, columnIndex: 2 } });
    toolSettings.push({ value: this._imageCheckBoxValue, property: ToolWithSettings._getImageCheckBoxDescription(), editorPosition: { rowPriority: 30, columnIndex: 2 } });
    return toolSettings;
  }

  private showColorInfoFromUi(updatedValue: DialogPropertySyncItem) {
    const msg = `Property '${updatedValue.propertyName}' updated to value ${this.colorDef.toRgbString()}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

  private showInfoFromUi(updatedValue: DialogPropertySyncItem) {
    const msg = `Property '${updatedValue.propertyName}' updated to value ${updatedValue.value.value}`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, msg));
  }

  private syncLengthState(): void {
    const lengthValue: DialogItemValue = { value: this.length, displayValue: this._lengthDescription.format(this.length) };
    const syncItem: DialogPropertySyncItem = { value: lengthValue, propertyName: ToolWithSettings._lengthName, isDisabled: !this.useLength };
    this.syncToolSettingsProperties([syncItem]);
  }

  /** Used to send changes from UI back to Tool */
  public applyToolSettingPropertyChange(updatedValue: DialogPropertySyncItem): boolean {
    if (updatedValue.propertyName === ToolWithSettings._lockToggleName) {
      this.lock = updatedValue.value.value as boolean;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === ToolWithSettings._imageCheckBoxName) {
      this.imageCheckBoxValue = updatedValue.value.value as boolean;
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
    } else if (updatedValue.propertyName === ToolWithSettings._surveyLengthName) {
      this.surveyLength = updatedValue.value.value as number;
      this.showInfoFromUi(updatedValue);
    } else if (updatedValue.propertyName === ToolWithSettings._colorName) {
      this.colorValue = updatedValue.value.value as number;
      this.showColorInfoFromUi(updatedValue);
    }

    // return true is change is valid
    return true;
  }
}

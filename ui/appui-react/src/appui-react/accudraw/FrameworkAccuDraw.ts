/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import { BeUiEvent } from "@itwin/core-bentley";
import {
  AccuDraw, BeButtonEvent, CompassMode, IModelApp, ItemField,
  NotifyMessageDetails, OutputMessagePriority, QuantityType, RotationMode,
} from "@itwin/core-frontend";
import { ConditionalBooleanValue } from "@itwin/appui-abstract";
import { UiSettings, UiSettingsStatus } from "@itwin/core-react";
import { UiFramework, UserSettingsProvider } from "../UiFramework";
import { SyncUiEventDispatcher, SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { AccuDrawUiSettings } from "./AccuDrawUiSettings";

// cspell:ignore dont

const compassModeToKeyMap = new Map<CompassMode, string>([
  [CompassMode.Polar, "polar"],
  [CompassMode.Rectangular, "rectangular"],
]);

const rotationModeToKeyMap = new Map<RotationMode, string>([
  [RotationMode.Top, "top"],
  [RotationMode.Front, "front"],
  [RotationMode.Side, "side"],
  [RotationMode.View, "view"],
  [RotationMode.ACS, "ACS"],
  [RotationMode.Context, "context"],
]);

/** Arguments for [[AccuDrawSetFieldFocusEvent]]
 * @beta */
export interface AccuDrawSetFieldFocusEventArgs {
  field: ItemField;
}

/** AccuDraw Set Field Focus event
 * @beta */
export class AccuDrawSetFieldFocusEvent extends BeUiEvent<AccuDrawSetFieldFocusEventArgs> { }

/** Arguments for [[AccuDrawSetFieldValueToUiEvent]]
 * @beta */
export interface AccuDrawSetFieldValueToUiEventArgs {
  field: ItemField;
  value: number;
  formattedValue: string;
}

/** AccuDraw Set Field Value to Ui event
 * @beta */
export class AccuDrawSetFieldValueToUiEvent extends BeUiEvent<AccuDrawSetFieldValueToUiEventArgs> { }

/** Arguments for [[AccuDrawSetFieldValueFromUiEvent]]
 * @beta */
export interface AccuDrawSetFieldValueFromUiEventArgs {
  field: ItemField;
  stringValue: string;
}

/** AccuDraw Set Field Value from Ui event
 * @beta */
export class AccuDrawSetFieldValueFromUiEvent extends BeUiEvent<AccuDrawSetFieldValueFromUiEventArgs> { }

/** Arguments for [[AccuDrawSetFieldLockEvent]]
 * @beta */
export interface AccuDrawSetFieldLockEventArgs {
  field: ItemField;
  lock: boolean;
}

/** AccuDraw Set Field Lock event
 * @beta */
export class AccuDrawSetFieldLockEvent extends BeUiEvent<AccuDrawSetFieldLockEventArgs> { }

/** Arguments for [[AccuDrawSetCompassModeEvent]]
 * @beta */
export interface AccuDrawSetCompassModeEventArgs {
  mode: CompassMode;
}

/** AccuDraw Set Compass Mode event
 * @beta */
export class AccuDrawSetCompassModeEvent extends BeUiEvent<AccuDrawSetCompassModeEventArgs> { }

/** AccuDraw Grab Input Focus event
 * @beta */
export class AccuDrawGrabInputFocusEvent extends BeUiEvent<{}> { }

/** AccuDraw Ui Settings Changed event
 * @beta */
export class AccuDrawUiSettingsChangedEvent extends BeUiEvent<{}> { }

/** Implementation of AccuDraw that sends events for UI and status changes
 * @beta
 */
export class FrameworkAccuDraw extends AccuDraw implements UserSettingsProvider {
  private static _displayNotifications = false;
  private static _uiSettings: AccuDrawUiSettings | undefined;
  private static _settingsNamespace = "AppUiSettings";
  private static _notificationsKey = "AccuDrawNotifications";
  public readonly providerId = "FrameworkAccuDraw";

  /** AccuDraw Set Field Focus event. */
  public static readonly onAccuDrawSetFieldFocusEvent = new AccuDrawSetFieldFocusEvent();
  /** AccuDraw Set Field Value to Ui event. */
  public static readonly onAccuDrawSetFieldValueToUiEvent = new AccuDrawSetFieldValueToUiEvent();
  /** AccuDraw Set Field Value from Ui event. */
  public static readonly onAccuDrawSetFieldValueFromUiEvent = new AccuDrawSetFieldValueFromUiEvent();
  /** AccuDraw Set Field Lock event. */
  public static readonly onAccuDrawSetFieldLockEvent = new AccuDrawSetFieldLockEvent();
  /** AccuDraw Set Mode event. */
  public static readonly onAccuDrawSetCompassModeEvent = new AccuDrawSetCompassModeEvent();
  /** AccuDraw Grab Input Focus event. */
  public static readonly onAccuDrawGrabInputFocusEvent = new AccuDrawGrabInputFocusEvent();

  /** Determines if AccuDraw.rotationMode === RotationMode.Top */
  public static readonly isTopRotationConditional = new ConditionalBooleanValue(() => IModelApp.accuDraw.rotationMode === RotationMode.Top, [SyncUiEventId.AccuDrawRotationChanged]);
  /** Determines if AccuDraw.rotationMode === RotationMode.Front */
  public static readonly isFrontRotationConditional = new ConditionalBooleanValue(() => IModelApp.accuDraw.rotationMode === RotationMode.Front, [SyncUiEventId.AccuDrawRotationChanged]);
  /** Determines if AccuDraw.rotationMode === RotationMode.Side */
  public static readonly isSideRotationConditional = new ConditionalBooleanValue(() => IModelApp.accuDraw.rotationMode === RotationMode.Side, [SyncUiEventId.AccuDrawRotationChanged]);
  /** Determines if AccuDraw.rotationMode === RotationMode.View */
  public static readonly isViewRotationConditional = new ConditionalBooleanValue(() => IModelApp.accuDraw.rotationMode === RotationMode.View, [SyncUiEventId.AccuDrawRotationChanged]);
  /** Determines if AccuDraw.rotationMode === RotationMode.ACS */
  public static readonly isACSRotationConditional = new ConditionalBooleanValue(() => IModelApp.accuDraw.rotationMode === RotationMode.ACS, [SyncUiEventId.AccuDrawRotationChanged]);
  /** Determines if AccuDraw.rotationMode === RotationMode.Context */
  public static readonly isContextRotationConditional = new ConditionalBooleanValue(() => IModelApp.accuDraw.rotationMode === RotationMode.Context, [SyncUiEventId.AccuDrawRotationChanged]);
  /** Determines if AccuDraw.compassMode === CompassMode.Polar */
  public static readonly isPolarModeConditional = new ConditionalBooleanValue(() => IModelApp.accuDraw.compassMode === CompassMode.Polar, [SyncUiEventId.AccuDrawCompassModeChanged]);
  /** Determines if AccuDraw.compassMode === CompassMode.Rectangular */
  public static readonly isRectangularModeConditional = new ConditionalBooleanValue(() => IModelApp.accuDraw.compassMode === CompassMode.Rectangular, [SyncUiEventId.AccuDrawCompassModeChanged]);

  /** AccuDraw Grab Input Focus event. */
  public static readonly onAccuDrawUiSettingsChangedEvent = new AccuDrawUiSettingsChangedEvent();

  /** Determines if notifications should be displayed for AccuDraw changes */
  public static get displayNotifications(): boolean { return FrameworkAccuDraw._displayNotifications; }
  public static set displayNotifications(v: boolean) {
    FrameworkAccuDraw._displayNotifications = v;
    void UiFramework.getUiSettingsStorage().saveSetting(this._settingsNamespace, this._notificationsKey, v);
  }

  public async loadUserSettings(storage: UiSettings): Promise<void> {
    const result = await storage.getSetting(FrameworkAccuDraw._settingsNamespace, FrameworkAccuDraw._notificationsKey);
    if (result.status === UiSettingsStatus.Success)
      FrameworkAccuDraw._displayNotifications = result.setting;
  }

  /** AccuDraw User Interface settings */
  public static get uiSettings(): AccuDrawUiSettings | undefined { return FrameworkAccuDraw._uiSettings; }
  public static set uiSettings(v: AccuDrawUiSettings | undefined) {
    FrameworkAccuDraw._uiSettings = v;
    FrameworkAccuDraw.onAccuDrawUiSettingsChangedEvent.emit({});
  }

  constructor() {
    super();
    FrameworkAccuDraw.onAccuDrawSetFieldValueFromUiEvent.addListener(this.handleSetFieldValueFromUiEvent);
    UiFramework.registerUserSettingsProvider(this);
  }

  private handleSetFieldValueFromUiEvent = async (args: AccuDrawSetFieldValueFromUiEventArgs) => {
    return this.processFieldInput(args.field, args.stringValue, false);
  };

  /** @internal */
  public override onCompassModeChange(): void {
    FrameworkAccuDraw.onAccuDrawSetCompassModeEvent.emit({ mode: this.compassMode });
    SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.AccuDrawCompassModeChanged);

    this.outputCompassModeMessage();
  }

  /** @internal */
  public override onRotationModeChange(): void {
    SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.AccuDrawRotationChanged);

    this.outputRotationMessage();
  }

  /** @internal */
  public override onFieldLockChange(index: ItemField): void {
    FrameworkAccuDraw.onAccuDrawSetFieldLockEvent.emit({ field: index, lock: this.getFieldLock(index) });
  }

  /** @internal */
  public override onFieldValueChange(index: ItemField): void {
    const value = this.getValueByIndex(index);
    const formattedValue = FrameworkAccuDraw.getFieldDisplayValue(index);
    FrameworkAccuDraw.onAccuDrawSetFieldValueToUiEvent.emit({ field: index, value, formattedValue });
  }

  private fieldValuesChanged(): void {
    this.onFieldValueChange(ItemField.X_Item);
    this.onFieldValueChange(ItemField.Y_Item);
    this.onFieldValueChange(ItemField.Z_Item);
    this.onFieldValueChange(ItemField.ANGLE_Item);
    this.onFieldValueChange(ItemField.DIST_Item);
  }

  /** @internal */
  public override setFocusItem(index: ItemField): void {
    FrameworkAccuDraw.onAccuDrawSetFieldFocusEvent.emit({ field: index });
  }

  /** Implemented by sub-classes to update ui fields to show current deltas or coordinates when inactive.
   * Should also choose active x or y input field in rectangular mode based on cursor position when
   * axis isn't locked to support "smart lock".
   * @internal
   */
  public override onMotion(_ev: BeButtonEvent): void {
    if (!this.isEnabled || this.isDeactivated || UiFramework.isContextMenuOpen)
      return;

    this.fieldValuesChanged();

    if (!this.dontMoveFocus)
      this.setFocusItem(this.newFocus);
  }

  /** Determine if the AccuDraw UI has focus
   * @internal
   */
  public override get hasInputFocus(): boolean {
    let hasFocus = false;
    const el = document.querySelector("div.uifw-accudraw-field-container");
    if (el)
      hasFocus = el.contains(document.activeElement);
    return hasFocus;
  }

  /** Implement this method to set focus to the AccuDraw UI.
   * @internal
   */
  public override grabInputFocus(): void {
    FrameworkAccuDraw.onAccuDrawGrabInputFocusEvent.emit({});
  }

  /** Gets the display value for an AccuDraw field */
  public static getFieldDisplayValue(index: ItemField): string {
    const value = IModelApp.accuDraw.getValueByIndex(index);
    let formattedValue = value.toString();

    const formatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(ItemField.ANGLE_Item === index ? QuantityType.Angle : QuantityType.Length);
    // istanbul ignore else
    if (formatterSpec)
      formattedValue = IModelApp.quantityFormatter.formatQuantity(value, formatterSpec);

    return formattedValue;
  }

  /** AccuDraw Set Field Value from Ui. */
  public static setFieldValueFromUi(field: ItemField, stringValue: string): void {
    FrameworkAccuDraw.onAccuDrawSetFieldValueFromUiEvent.emit({ field, stringValue });
  }

  private outputInfoMessage(message: string): void {
    // istanbul ignore else
    if (FrameworkAccuDraw.displayNotifications)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, message));
  }

  private outputCompassModeMessage(): void {
    if (FrameworkAccuDraw.displayNotifications) {
      let modeKey = compassModeToKeyMap.get(this.compassMode);
      // istanbul ignore if
      if (modeKey === undefined)
        modeKey = "polar";
      const modeString = UiFramework.translate(`accuDraw.compassMode.${modeKey}`);
      const modeMessage = UiFramework.localization.getLocalizedStringWithNamespace(UiFramework.localizationNamespace, "accuDraw.compassModeSet", { modeString });
      this.outputInfoMessage(modeMessage);
    }
  }

  private outputRotationMessage(): void {
    if (FrameworkAccuDraw.displayNotifications) {
      let rotationKey = rotationModeToKeyMap.get(this.rotationMode);
      // istanbul ignore if
      if (rotationKey === undefined)
        rotationKey = "top";
      const rotationString = UiFramework.translate(`accuDraw.rotation.${rotationKey}`);
      const rotationMessage = UiFramework.localization.getLocalizedStringWithNamespace(UiFramework.localizationNamespace, "accuDraw.rotationSet", { rotationString });
      this.outputInfoMessage(rotationMessage);
    }
  }
}

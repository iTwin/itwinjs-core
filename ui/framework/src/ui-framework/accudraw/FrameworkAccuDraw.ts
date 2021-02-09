/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import { AccuDraw, BeButtonEvent, CompassMode, IModelApp, ItemField, NotifyMessageDetails, OutputMessagePriority, QuantityType, RotationMode } from "@bentley/imodeljs-frontend";
import { AccuDrawField, AccuDrawMode, AccuDrawSetFieldValueFromUiEventArgs, AccuDrawUiAdmin, ConditionalBooleanValue } from "@bentley/ui-abstract";
import { UiFramework } from "../UiFramework";
import { SyncUiEventDispatcher, SyncUiEventId } from "../syncui/SyncUiEventDispatcher";

// cspell:ignore dont

/** @alpha */
export class FrameworkAccuDraw extends AccuDraw {
  private static _displayNotifications = false;

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

  /** Determines if notifications should be displayed for AccuDraw changes */
  public static get displayNotifications(): boolean { return FrameworkAccuDraw._displayNotifications; }
  public static set displayNotifications(v: boolean) { FrameworkAccuDraw._displayNotifications = v; }

  constructor() {
    super();
    AccuDrawUiAdmin.onAccuDrawSetFieldValueFromUiEvent.addListener(this.handleSetFieldValueFromUiEvent);
  }

  private handleSetFieldValueFromUiEvent = async (args: AccuDrawSetFieldValueFromUiEventArgs) => {
    const item = FrameworkAccuDraw.translateToItemField(args.field);
    return IModelApp.accuDraw.processFieldInput(item, args.stringValue, false);
  };

  /** @internal */
  public static translateFromItemField(item: ItemField): AccuDrawField {
    let field: AccuDrawField;
    switch (item) {
      case ItemField.Y_Item:
        field = AccuDrawField.Y;
        break;
      case ItemField.Z_Item:
        field = AccuDrawField.Z;
        break;
      case ItemField.ANGLE_Item:
        field = AccuDrawField.Angle;
        break;
      case ItemField.DIST_Item:
        field = AccuDrawField.Distance;
        break;
      case ItemField.X_Item:
      default:
        field = AccuDrawField.X;
        break;
    }
    return field;
  }

  /** @internal */
  public static translateToItemField(field: AccuDrawField): ItemField {
    let item: ItemField;
    switch (field) {
      case AccuDrawField.Y:
        item = ItemField.Y_Item;
        break;
      case AccuDrawField.Z:
        item = ItemField.Z_Item;
        break;
      case AccuDrawField.Angle:
        item = ItemField.ANGLE_Item;
        break;
      case AccuDrawField.Distance:
        item = ItemField.DIST_Item;
        break;
      case AccuDrawField.X:
      default:
        item = ItemField.X_Item;
        break;
    }
    return item;
  }

  /** @internal */
  public onCompassModeChange(): void {
    const accuDrawMode = this.compassMode === CompassMode.Rectangular ? AccuDrawMode.Rectangular : AccuDrawMode.Polar;
    IModelApp.uiAdmin.accuDrawUi.setMode(accuDrawMode);
    SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.AccuDrawCompassModeChanged);

    this.outputCompassModeMessage();
  }

  /** @internal */
  public onRotationModeChange(): void {
    SyncUiEventDispatcher.dispatchSyncUiEvent(SyncUiEventId.AccuDrawRotationChanged);

    this.outputRotationMessage();
  }

  /** @internal */
  public onFieldLockChange(index: ItemField): void {
    const field = FrameworkAccuDraw.translateFromItemField(index);
    IModelApp.uiAdmin.accuDrawUi.setFieldLock(field, this.getFieldLock(index));
  }

  /** @internal */
  public onFieldValueChange(index: ItemField): void {
    const field = FrameworkAccuDraw.translateFromItemField(index);
    const value = this.getValueByIndex(index);
    const formattedValue = FrameworkAccuDraw.getFieldDisplayValue(index);
    IModelApp.uiAdmin.accuDrawUi.setFieldValueToUi(field, value, formattedValue);
  }

  private fieldValuesChanged(): void {
    this.onFieldValueChange(ItemField.X_Item);
    this.onFieldValueChange(ItemField.Y_Item);
    this.onFieldValueChange(ItemField.Z_Item);
    this.onFieldValueChange(ItemField.ANGLE_Item);
    this.onFieldValueChange(ItemField.DIST_Item);
  }

  /** @internal */
  public setFocusItem(index: ItemField): void {
    const field = FrameworkAccuDraw.translateFromItemField(index);
    IModelApp.uiAdmin.accuDrawUi.setFieldFocus(field);
  }

  /** Implemented by sub-classes to update ui fields to show current deltas or coordinates when inactive.
   * Should also choose active x or y input field in rectangular mode based on cursor position when
   * axis isn't locked to support "smart lock".
   * @internal
   */
  public onMotion(_ev: BeButtonEvent): void {
    if (!this.isEnabled || this.isDeactivated || UiFramework.isContextMenuOpen)
      return;

    this.fieldValuesChanged();

    if (!this.dontMoveFocus)
      this.setFocusItem(this.newFocus);
  }

  /** @internal */
  public get hasInputFocus(): boolean {
    return IModelApp.uiAdmin.accuDrawUi.hasInputFocus;
  }

  /** Implement this method to set focus to the AccuDraw UI.
   * @internal
   */
  public grabInputFocus(): void {
    IModelApp.uiAdmin.accuDrawUi.grabInputFocus();
  }

  public static getFieldDisplayValue(index: ItemField): string {
    const value = IModelApp.accuDraw.getValueByIndex(index);
    let formattedValue = value.toString();

    const formatterSpec = IModelApp.quantityFormatter.findFormatterSpecByQuantityType(ItemField.ANGLE_Item === index ? QuantityType.Angle : QuantityType.Length);
    // istanbul ignore else
    if (formatterSpec)
      formattedValue = IModelApp.quantityFormatter.formatQuantity(value, formatterSpec);

    return formattedValue;
  }

  private outputInfoMessage(message: string): void {
    // istanbul ignore else
    if (FrameworkAccuDraw.displayNotifications)
      IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, message));
  }

  private outputCompassModeMessage(): void {
    if (FrameworkAccuDraw.displayNotifications) {
      let modeKey = "";
      switch(IModelApp.accuDraw.compassMode) {
        case CompassMode.Polar:
          modeKey = "polar";
          break;
        case CompassMode.Rectangular:
          modeKey = "rectangular";
          break;
      }
      const modeString = UiFramework.translate(`accuDraw.compassMode.${modeKey}`);
      const modeMessage = UiFramework.i18n.translateWithNamespace(UiFramework.i18nNamespace, "accuDraw.compassModeSet", {modeString});
      this.outputInfoMessage(modeMessage);
    }
  }

  private outputRotationMessage(): void {
    if (FrameworkAccuDraw.displayNotifications) {
      let rotationKey = "";
      switch(IModelApp.accuDraw.rotationMode) {
        case RotationMode.Top:
          rotationKey = "top";
          break;
        case RotationMode.Front:
          rotationKey = "front";
          break;
        case RotationMode.Side:
          rotationKey = "side";
          break;
        case RotationMode.View:
          rotationKey = "view";
          break;
        case RotationMode.ACS:
          rotationKey = "ACS";
          break;
        case RotationMode.Context:
          rotationKey = "context";
          break;
      }
      const rotationString = UiFramework.translate(`accuDraw.rotation.${rotationKey}`);
      const rotationMessage = UiFramework.i18n.translateWithNamespace(UiFramework.i18nNamespace, "accuDraw.rotationSet", {rotationString});
      this.outputInfoMessage(rotationMessage);
    }
  }
}

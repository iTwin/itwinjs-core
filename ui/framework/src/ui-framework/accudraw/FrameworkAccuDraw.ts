/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import { AccuDraw, BeButtonEvent, CompassMode, IModelApp, ItemField, QuantityType } from "@bentley/imodeljs-frontend";
import { AccuDrawField, AccuDrawMode, AccuDrawSetFieldValueFromUiEventArgs, AccuDrawUiAdmin } from "@bentley/ui-abstract";
import { UiFramework } from "../UiFramework";

// cspell:ignore dont

/** @alpha */
export class FrameworkAccuDraw extends AccuDraw {

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
  }

  /** @internal */
  public onFieldLockChange(index: ItemField) {
    const field = FrameworkAccuDraw.translateFromItemField(index);
    IModelApp.uiAdmin.accuDrawUi.setFieldLock(field, this.getFieldLock(index));
  }

  /** @internal */
  public onFieldValueChange(index: ItemField) {
    const field = FrameworkAccuDraw.translateFromItemField(index);
    const value = this.getValueByIndex(index);
    const formattedValue = FrameworkAccuDraw.getFieldDisplayValue(index);
    IModelApp.uiAdmin.accuDrawUi.setFieldValueToUi(field, value, formattedValue);
  }

  private fieldValuesChanged() {
    this.onFieldValueChange(ItemField.X_Item);
    this.onFieldValueChange(ItemField.Y_Item);
    this.onFieldValueChange(ItemField.Z_Item);
    this.onFieldValueChange(ItemField.ANGLE_Item);
    this.onFieldValueChange(ItemField.DIST_Item);
  }

  /** @internal */
  public setFocusItem(index: ItemField) {
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
  public get hasInputFocus() {
    return IModelApp.uiAdmin.accuDrawUi.hasInputFocus;
  }

  /** Implement this method to set focus to the AccuDraw UI.
   * @internal
   */
  public grabInputFocus() {
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

}

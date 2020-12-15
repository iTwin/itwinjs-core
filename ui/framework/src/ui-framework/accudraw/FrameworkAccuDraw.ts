/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module AccuDraw
 */

import { AccuDraw, CompassMode, IModelApp, ItemField } from "@bentley/imodeljs-frontend";
import { AccuDrawField, AccuDrawMode } from "@bentley/ui-abstract";

/** @alpha */
export class FrameworkAccuDraw extends AccuDraw {

  private translateItemField(item: ItemField): AccuDrawField {
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
  public onCompassModeChange(): void {
    const accuDrawMode = this.compassMode === CompassMode.Rectangular ? AccuDrawMode.Rectangular : AccuDrawMode.Polar;
    IModelApp.uiAdmin.accuDrawUi.setMode(accuDrawMode);
  }

  /** @internal */
  public onFieldLockChange(index: ItemField) {
    const field = this.translateItemField(index);
    IModelApp.uiAdmin.accuDrawUi.setFieldLock(field, this.getFieldLock(index));
  }

  /** @internal */
  public onFieldValueChange(index: ItemField) {
    const field = this.translateItemField(index);
    const value = this.getValueByIndex(index);
    IModelApp.uiAdmin.accuDrawUi.setFieldValueToUi(field, value);
  }

  /** @internal */
  public setFocusItem(index: ItemField) {
    const field = this.translateItemField(index);
    IModelApp.uiAdmin.accuDrawUi.setFieldFocus(field);
  }

}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Primitives, StandardTypeNames } from "@itwin/appui-abstract";

/** Base feature infos reader
 * @internal
 */
export abstract class FeatureInfoReader {

  // Optionally you can set the floating precision
  public floatPrecision: number|undefined;

  // Force display value of date to ISO 8601 format.
  // Turning this ON, will disable display value in end-user's locale
  public forceDateDisplayValueToIso = false;

  protected toFixedWithoutPadding = (value: number) => {
    return (this.floatPrecision === undefined ? value : parseFloat(value.toFixed(this.floatPrecision)));
  };

  protected getDisplayValue = (typename: StandardTypeNames, value: Primitives.Value|undefined) => {
    if (value === undefined) {
      return  "";
    } else if ( typename === StandardTypeNames.DateTime && this.forceDateDisplayValueToIso) {
      return (value as Date).toISOString();
    } else {
      return `${value}`;
    }
  };

}

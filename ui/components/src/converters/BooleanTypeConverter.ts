/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import UiComponents from "../UiComponents";
import { TypeConverter } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";

let sl10nTrue: string = "";
let sl10nFalse: string = "";

/** Boolean Type Converter.
 */
export class BooleanTypeConverter extends TypeConverter {
  private getLocalizedTrueFalse() {
    if (!sl10nTrue)
      sl10nTrue = UiComponents.i18n.translate("UiComponents:general.true");
    if (!sl10nFalse)
      sl10nFalse = UiComponents.i18n.translate("UiComponents:general.false");
  }

  public async convertToString(value: any): Promise<string> {
    this.getLocalizedTrueFalse();

    if (null === value || undefined === value)
      return "";

    if (value === sl10nTrue || value === sl10nFalse)
      return value;

    const booleanValue = value as boolean;
    const stringValue = booleanValue ? sl10nTrue : sl10nFalse;
    return stringValue;
  }

  public convertFromString(value: string): any {
    this.getLocalizedTrueFalse();

    if (null === value || undefined === value)
      return undefined;

    let booleanValue: boolean;
    booleanValue = (0 === value.toLocaleLowerCase().localeCompare(sl10nTrue.toLocaleLowerCase()));
    return booleanValue;
  }

  public get isBooleanType(): boolean { return true; }
}
TypeConverterManager.registerConverter("boolean", BooleanTypeConverter);
TypeConverterManager.registerConverter("bool", BooleanTypeConverter);

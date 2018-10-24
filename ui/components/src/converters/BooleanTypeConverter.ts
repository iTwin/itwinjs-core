/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import UiComponents from "../UiComponents";
import { TypeConverter } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import { Primitives } from "./valuetypes";

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

  public async convertToString(value?: Primitives.Boolean): Promise<string> {
    if (value === undefined)
      return "";

    this.getLocalizedTrueFalse();

    if (value === sl10nTrue || value === sl10nFalse)
      return value as string;

    return value ? sl10nTrue : sl10nFalse;
  }

  public async convertFromString(value: string): Promise<boolean> {
    this.getLocalizedTrueFalse();

    let booleanValue: boolean;
    booleanValue = (0 === value.toLocaleLowerCase().localeCompare(sl10nTrue.toLocaleLowerCase()));
    return booleanValue;
  }

  public sortCompare(a: Primitives.Boolean, b: Primitives.Boolean, _ignoreCase?: boolean): number {
    if (!!a === !!b)
      return 0;
    if (!!a && !b)
      return 1;
    return -1;
  }

  public get isBooleanType(): boolean { return true; }
}
TypeConverterManager.registerConverter("boolean", BooleanTypeConverter);
TypeConverterManager.registerConverter("bool", BooleanTypeConverter);

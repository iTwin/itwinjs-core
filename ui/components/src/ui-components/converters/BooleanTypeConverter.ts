/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { UiComponents } from "../UiComponents";
import { TypeConverter, StandardTypeConverterTypeNames } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import { Primitives } from "@bentley/imodeljs-frontend";

/** Boolean Type Converter.
 * @public
 */
export class BooleanTypeConverter extends TypeConverter {
  /** @internal */
  public static sl10nTrue: string = "";
  /** @internal */
  public static sl10nFalse: string = "";

  /** @internal */
  public static getLocalizedTrueFalse() {
    if (!BooleanTypeConverter.sl10nTrue)
      BooleanTypeConverter.sl10nTrue = UiComponents.translate("general.true");
    if (!BooleanTypeConverter.sl10nFalse)
      BooleanTypeConverter.sl10nFalse = UiComponents.translate("general.false");
  }

  public convertToString(value?: Primitives.Boolean) {
    if (value === undefined)
      return "";

    BooleanTypeConverter.getLocalizedTrueFalse();

    if (value === BooleanTypeConverter.sl10nTrue || value === BooleanTypeConverter.sl10nFalse)
      return value as string;

    return value ? BooleanTypeConverter.sl10nTrue : BooleanTypeConverter.sl10nFalse;
  }

  public convertFromString(value: string) {
    BooleanTypeConverter.getLocalizedTrueFalse();

    let booleanValue: boolean;
    booleanValue = (0 === value.toLocaleLowerCase().localeCompare(BooleanTypeConverter.sl10nTrue.toLocaleLowerCase()));
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

TypeConverterManager.registerConverter(StandardTypeConverterTypeNames.Boolean, BooleanTypeConverter);
TypeConverterManager.registerConverter(StandardTypeConverterTypeNames.Bool, BooleanTypeConverter);

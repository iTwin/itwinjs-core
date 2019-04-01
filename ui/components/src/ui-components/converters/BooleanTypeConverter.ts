/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import UiComponents from "../UiComponents";
import { TypeConverter } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import { Primitives } from "@bentley/imodeljs-frontend";

let sl10nTrue: string = "";
let sl10nFalse: string = "";

/** Boolean Type Converter.
 * @public
 */
export class BooleanTypeConverter extends TypeConverter {
  private getLocalizedTrueFalse() {
    if (!sl10nTrue)
      sl10nTrue = UiComponents.i18n.translate("UiComponents:general.true");
    if (!sl10nFalse)
      sl10nFalse = UiComponents.i18n.translate("UiComponents:general.false");
  }

  public convertToString(value?: Primitives.Boolean) {
    if (value === undefined)
      return "";

    this.getLocalizedTrueFalse();

    if (value === sl10nTrue || value === sl10nFalse)
      return value as string;

    return value ? sl10nTrue : sl10nFalse;
  }

  public convertFromString(value: string) {
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

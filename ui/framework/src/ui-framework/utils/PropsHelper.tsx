/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import * as React from "react";

import { UiFramework } from "../UiFramework";
import { StringGetter } from "../shared/ItemProps";
import { Icon } from "../shared/IconComponent";

export class PropsHelper {
  /** Get spec for returning a string. Could be a simple string of a 'StringGetter' method used to return the string. */
  public static getStringSpec(explicitValue: string | StringGetter | undefined, stringKey?: string): string | StringGetter {
    if (explicitValue) {
      if (typeof explicitValue === "string") {
        if (explicitValue.length > 0)
          return explicitValue;
      } else
        return explicitValue;
    }

    let outValue = "";
    if (stringKey)
      outValue = UiFramework.i18n.translate(stringKey);
    return outValue;
  }

  /** Get the display string. */
  public static getStringFromSpec(spec: string | StringGetter): string {
    let label = "";
    if (typeof spec === "string")
      label = spec;
    else
      label = spec();
    return label;
  }

  /** Get JSX element that defines an icon. If iconSpec is a string, then a web-font icon class is used otherwise a ReactNode holding an SVG icon is assumed.  */
  // tslint:disable-next-line:variable-name
  public static getIcon(iconSpec: string | React.ReactNode): JSX.Element | undefined {
    return (iconSpec) ? <Icon iconSpec={iconSpec} /> : undefined;
  }

  /** returns true if the two objects are the same using a shallow compare of each property */
  public static isShallowEqual(newObj: any, prevObj: any) {
    for (const key in newObj) {
      if (newObj[key] !== prevObj[key]) return false;
    }
    return true;
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import * as React from "react";
import { AbstractWidgetProps, BackstageItem, ConditionalStringValue, StringGetter } from "@itwin/appui-abstract";
import { Icon, IconHelper, IconSpec } from "@itwin/core-react";
import { UiFramework } from "../UiFramework";

/** A set of helper methods for various props
 * @public
 */
export class PropsHelper {
  /** Get spec for returning a string. Could be a simple string of a 'StringGetter' method used to return the string. */
  public static getStringSpec(explicitValue: string | StringGetter | ConditionalStringValue | undefined, stringKey?: string): string | StringGetter | ConditionalStringValue {
    if (explicitValue) {
      return explicitValue;
    }

    let outValue = "";
    if (stringKey)
      outValue = UiFramework.localization.getLocalizedString(stringKey);
    return outValue;
  }

  /** Get the display string. */
  public static getStringFromSpec(spec: string | StringGetter | ConditionalStringValue): string {
    let label = "";
    if (typeof spec === "string")
      label = spec;
    else if (spec instanceof ConditionalStringValue)
      label = spec.value;
    else
      label = spec();
    return label;
  }

  /** Get JSX element that defines an icon. If iconSpec is a string, then a web-font icon class is used otherwise a ReactNode holding an SVG icon is assumed.  */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  public static getIcon(iconSpec: string | ConditionalStringValue | React.ReactNode): React.JSX.Element | undefined {
    if (iconSpec instanceof ConditionalStringValue)
      return <Icon iconSpec={iconSpec.value} />;

    return (iconSpec) ? <Icon iconSpec={iconSpec} /> : undefined;
  }

  /** returns true if the two objects are the same using a shallow compare of each property */
  public static isShallowEqual(newObj: any, prevObj: any) {
    for (const key in newObj) {
      if (newObj[key] !== prevObj[key]) return false;
    }
    return true;
  }
  public static getAbstractPropsForReactIcon(iconSpec: IconSpec, internalData?: Map<string, any>): Partial<AbstractWidgetProps> | Partial<BackstageItem> { // eslint-disable-line deprecation/deprecation
    // istanbul ignore else
    if (!iconSpec || !React.isValidElement(iconSpec))
      return {};

    // istanbul ignore else
    if (!internalData)
      internalData = new Map<string,any>();

    const icon = IconHelper.getIconData(iconSpec, internalData);

    return (icon === "" ? {icon} : {icon, internalData });
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import type { Schema } from "./Schema";

/** @beta */
export interface CustomAttribute {
  className: string;
  [propName: string]: any;
}

/** @beta */
export interface CustomAttributeSet {
  [Symbol.iterator]: () => IterableIterator<[string, CustomAttribute]>;
  has(className: string): boolean;
  get(className: string): CustomAttribute | undefined;
}

/** @beta */
export interface CustomAttributeContainerProps {
  customAttributes?: CustomAttributeSet;
  fullName: string;
  schema: Schema;
}

/** @beta */
export function serializeCustomAttributes(customAttributes: CustomAttributeSet | undefined): any[] | undefined {
  if (undefined !== customAttributes) { // custom attributes is optional
    const attributes: any[] = [];
    for (const [, customAttribute] of customAttributes) {
      const attribute: { [value: string]: any } = {};
      Object.keys(customAttribute).map((property: any) => {
        const propertyName = property.toString();
        attribute[propertyName] = customAttribute[property];
      });
      attributes.push(attribute);
    }
    return (attributes.length > 0) ? attributes : undefined;
  }
  return undefined;
}

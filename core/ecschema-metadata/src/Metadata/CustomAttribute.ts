/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { Schema } from "./Schema";

/** @public @preview */
export interface CustomAttribute {
  className: string;
  [propName: string]: any;
}

/**
* A collection of custom attributes, accessed by full class names in the format `SchemaName.ClassName`.
* Iterates over, checks, and retrieves attributes. Class names are case-insensitive, separated by a dot (`.`).
* @param className - The full class name.
* @returns Iterator, boolean, or custom attribute.
* @public @preview
*/
export interface CustomAttributeSet {
  [Symbol.iterator]: () => IterableIterator<[string, CustomAttribute]>;
  has(className: string): boolean;
  get(className: string): CustomAttribute | undefined;
}

/** @public @preview */
export interface CustomAttributeContainerProps {
  customAttributes?: CustomAttributeSet;
  fullName: string;
  schema: Schema;
}

/** @internal */
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

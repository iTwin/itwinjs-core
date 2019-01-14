/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export interface CustomAttribute {
  className: string;
  [propName: string]: any;
}

export interface CustomAttributeSet {
  [Symbol.iterator]: () => IterableIterator<[string, CustomAttribute]>;
  has(className: string): boolean;
  get(className: string): CustomAttribute | undefined;
}

export interface CustomAttributeContainerProps {
  customAttributes?: CustomAttributeSet;
}

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
    return attributes;
  }
  return undefined;
}

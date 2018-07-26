/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { CustomAttributeContainerType, containerTypeToString } from "../ECObjects";

export interface CustomAttributeInstance {
  className: string;
  [propName: string]: any;
}

export class CustomAttributeSet {
   [name: string]: CustomAttributeInstance;
}

export interface CustomAttributeContainerProps {
  customAttributes?: CustomAttributeSet;
}

export default function processCustomAttributes(customAttributesJson: any, name: string, type: CustomAttributeContainerType): CustomAttributeSet | undefined { // TODO: Check for duplicate class names
  if (customAttributesJson === undefined)
    return undefined;
  if (!Array.isArray(customAttributesJson)) {
    throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${containerTypeToString(type)} ${name} has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
  }
  const customAttributeSet = new CustomAttributeSet();
  customAttributesJson.forEach((attribute: CustomAttributeInstance) => {
    customAttributeSet[attribute.className] = attribute;
  });
  return customAttributeSet;
}

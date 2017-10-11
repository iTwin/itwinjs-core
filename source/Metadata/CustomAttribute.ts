/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

// class CustomAttributeInstance {
//   public className: string;
// }

export class CustomAttributeSet {
//   public [name]: CustomAttributeInstance;
}

export interface ICustomAttributeContainer {
  customAttributes: CustomAttributeSet;
}

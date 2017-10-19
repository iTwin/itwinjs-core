/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

export interface CustomAttributeInstance {
  className: string;
}

export class CustomAttributeSet {
   [name: string]: CustomAttributeInstance;
}

export interface ICustomAttributeContainer {
  customAttributes?: CustomAttributeSet;
}

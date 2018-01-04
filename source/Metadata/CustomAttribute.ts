/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

export interface CustomAttributeInstance {
  className: string;
}

export class CustomAttributeSet {
   [name: string]: CustomAttributeInstance;
}

export interface CustomAttributeContainerProps {
  customAttributes?: CustomAttributeSet;
}

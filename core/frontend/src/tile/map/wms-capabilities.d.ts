/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
declare module "wms-capabilities" {
  export = WMS;

  declare class WMS {
    constructor() {}
    public parse(input: string): any;
  }
}

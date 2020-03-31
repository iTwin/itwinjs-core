/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/// <reference types="node" />
declare module "*.svg" {
  const value: any;
  export default value;
}

declare module "*.scss" {
  const value: any;
  export default value;
}

declare module "*.css" {
  const value: any;
  export default value;
}

// iModel.js Change: Add support for SVG Sprites.
declare module '*.svg?sprite' {
  const src: string;
  export default src;
}

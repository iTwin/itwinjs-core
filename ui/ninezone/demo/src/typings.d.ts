/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

declare module "*.json" {
  const value: any;
  export = value;
}

declare module "*.md" {
  const markdown: string;
  export = markdown;
}

declare module "*.svg" {
  const value: any;
  export = value;
}

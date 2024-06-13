/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ElementGeometry
 */

declare module "linebreak" {
  export = LineBreaker;

  export declare class LineBreaker {
    public constructor(str: string);
    public nextBreak(): { position: number, required: boolean };
  }
}


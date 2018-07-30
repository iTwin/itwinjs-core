/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Utilities */

/** Describes dimensions. */
export interface SizeProps {
  readonly width: number;
  readonly height: number;
}

export default class Size implements SizeProps {
  public constructor(public readonly width = 0, public readonly height = 0) {
  }
}

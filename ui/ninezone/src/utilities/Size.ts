/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

/** Describes [[Size]]. */
export interface SizeProps {
  readonly width: number;
  readonly height: number;
}

/** Describes 2d dimensions. */
export default class Size implements SizeProps {
  public constructor(public readonly width = 0, public readonly height = 0) {
  }
}

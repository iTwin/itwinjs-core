/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

/** Describes [[Size]].
 * @beta
 */
export interface SizeProps {
  readonly width: number;
  readonly height: number;
}

/** Describes 2d dimensions.
 * @beta
 */
export class Size implements SizeProps {
  /** Creates a size from [[SizeProps]]. */
  public static create(size: SizeProps) {
    return new Size(size.width, size.height);
  }

  /** Creates a size with specified dimensions. */
  public constructor(public readonly width = 0, public readonly height = 0) {
  }

  /** Checks if dimensions of two sizes are equal. */
  public equals(other: SizeProps) {
    if (this.width === other.width &&
      this.height === other.height)
      return true;
    return false;
  }
}

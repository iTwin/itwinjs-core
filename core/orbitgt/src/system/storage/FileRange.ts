/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.system.storage;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { ALong } from "../runtime/ALong";

/**
 * Class FileRange defines a content range in a file.
 */
/** @internal */
export class FileRange {
  /** The (integer) offset of the content range */
  public offset: ALong;
  /** The size of the content range */
  public size: int32;

  /**
   * Create a new content range.
   */
  public constructor(offset: ALong, size: int32) {
    this.offset = offset;
    this.size = size;
  }
}

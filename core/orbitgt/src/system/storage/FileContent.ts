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

import { ABuffer } from "../buffer/ABuffer";
import { ALong } from "../runtime/ALong";

/**
 * Class FileContent holds partial content (a single range) of a file.
 */
/** @internal */
export class FileContent {
  /** The (integer) offset of the content range */
  public offset: ALong;
  /** The content */
  public content: ABuffer;

  /**
   * Create a new content holder.
   */
  public constructor(offset: ALong, content: ABuffer) {
    this.offset = offset;
    this.content = content;
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.system.io;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

/**
 * Class OutStream defines a stream of bytes to write to.
 */
/** @internal */
export class OutStream {
  /**
   * Create a new stream.
   */
  public constructor() {}

  /**
   * Write the next byte (0.255) (the stream should only look at the lowest 8 bits of the value and ignore all others).
   */
  public write(value: int32): void {
    /* Override in subclasses */
  }

  /**
   * Close the stream
   */
  public close(): void {}
}

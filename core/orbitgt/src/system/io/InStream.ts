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
 * Class InStream defines a stream of bytes to read from.
 */
/** @internal */
export class InStream {
  /**
   * Create a new stream.
   */
  public constructor() {}

  /**
   * Read the next byte (range 0..255, or -1 at the end of the stream).
   */
  public read(): int32 {
    /* Override in subclasses */
    return -1;
  }

  /**
   * Close the stream
   */
  public close(): void {}
}

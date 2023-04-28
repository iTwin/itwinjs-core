/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.format.opc;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { ABuffer } from "../../../system/buffer/ABuffer";

/**
 * Class TileReadBuffer defines a memory buffer for reading a sequence of tiles.
 *
 * @version 1.0 January 2014
 */
/** @internal */
export class TileReadBuffer {
  /** The geometry buffer */
  private _geometryBuffer: ABuffer;
  /** The attribute buffers */
  private _attributeBuffers: Array<ABuffer>;

  /**
   * Create a new buffer.
   * @param attributeCount the number of attributes.
   */
  public constructor(attributeCount: int32) {
    this._geometryBuffer = null; //new ABuffer(1024);
    this._attributeBuffers = new Array<ABuffer>(attributeCount);
    for (let i: number = 0; i < attributeCount; i++)
      this._attributeBuffers[i] = null; //new ABuffer(1024);
  }

  /**
   * Get the geometry buffer.
   * @return the buffer.
   */
  public getGeometryBuffer(): ABuffer {
    return this._geometryBuffer;
  }

  /**
   * Set the geometry buffer.
   * @param buffer the buffer.
   */
  public setGeometryBuffer(buffer: ABuffer): void {
    this._geometryBuffer = buffer;
  }

  /**
   * Get the geometry buffer.
   * @param size the mimumum size of the buffer.
   * @return the buffer.
   */
  public getSizedGeometryBuffer(size: int32): ABuffer {
    if (this._geometryBuffer.size() < size) {
      this._geometryBuffer = new ABuffer(size + 1024);
    }
    return this._geometryBuffer;
  }

  /**
   * Get the attribute count.
   * @return the attribute count.
   */
  public getAttributeCount(): int32 {
    return this._attributeBuffers.length;
  }

  /**
   * Get an attribute buffer.
   * @param attributeIndex the index of the attribute.
   * @return the buffer.
   */
  public getAttributeBuffer(attributeIndex: int32): ABuffer {
    return this._attributeBuffers[attributeIndex];
  }

  /**
   * Get an attribute buffer.
   * @param attributeIndex the index of the attribute.
   * @param size the mimumum size of the buffer.
   * @return the buffer.
   */
  public getSizedAttributeBuffer(attributeIndex: int32, size: int32): ABuffer {
    let attributeBuffer: ABuffer = this._attributeBuffers[attributeIndex];
    if (attributeBuffer.size() < size) {
      attributeBuffer = new ABuffer(size + 1024);
      this._attributeBuffers[attributeIndex] = attributeBuffer;
    }
    return attributeBuffer;
  }

  /**
   * Set an attribute buffer.
   * @param attributeIndex the index of the attribute.
   * @param buffer the buffer.
   */
  public setAttributeBuffer(attributeIndex: int32, buffer: ABuffer): void {
    this._attributeBuffers[attributeIndex] = buffer;
  }
}

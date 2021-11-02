/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Serialization
 */
import { GeometryQuery } from "../curve/GeometryQuery";
import { BGFBReader } from "./BGFBReader";
import { BGFBWriter } from "./BGFBWriter";

/**
 * Top level entries to convert between GeometryQuery types and FlatBuffer Bytes.
 * @public
 */
export class BentleyGeometryFlatBuffer {
  private constructor() { }
  /**
   * Serialize bytes to a flatbuffer.
   * @public
   */
  public static geometryToBytes(data: GeometryQuery | GeometryQuery[], addVersionSignature: boolean = false): Uint8Array | undefined {
    return BGFBWriter.geometryToBytes(data, addVersionSignature ? signatureBytes : undefined);
  }

  /**
   * Deserialize bytes from a flatbuffer.
   *  @public
   * @param justTheBytes FlatBuffer bytes as created by BGFBWriter.createFlatBuffer (g);
   */
  public static bytesToGeometry(justTheBytes: Uint8Array, hasVersionSignature: boolean = false): GeometryQuery | GeometryQuery[] | undefined {
    return BGFBReader.bytesToGeometry(justTheBytes, hasVersionSignature ? signatureBytes : undefined);
  }
}

const signatureBytes = new Uint8Array([98, 103, 48, 48, 48, 49, 102, 98]);

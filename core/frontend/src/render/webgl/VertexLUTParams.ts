/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// import { assert } from "@bentley/bentleyjs-core";

/**
 * Stores vertex data (position, color ID, normal, UV params, etc) in a rectangular array
 * which will later be converted to a texture. Given a vertex ID, vertex shaders can sample
 * that texture to extract the vertex data. If vertex data contains indices into a color table,
 * the color table itself will be appended to the array following the vertex data.
 */
export class VertexLUTParams {
  // private readonly _data: Uint8Array;
  // private readonly _width: number;
  // private readonly _height: number;
}

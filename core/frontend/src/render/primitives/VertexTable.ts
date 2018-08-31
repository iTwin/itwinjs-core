/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { ColorDef, QParams2d, QParams3d } from "@bentley/imodeljs-common";

export interface VertexTableProps {
  /** The rectangular array of vertex data, of size width*height*numRgbaPerVertex bytes. */
  readonly data: Uint8Array;
  /** Quantization parameters for the vertex positions encoded into the array. */
  readonly qparams: QParams3d;
  /** The number of 4-byte 'RGBA' values in each row of the array. Must be divisible by numRgbaPerVertex. */
  readonly width: number;
  /** The number of rows in the array. */
  readonly height: number;
  /** Whether or not the vertex colors contain translucent colors. */
  readonly hasTranslucency: boolean;
  /** If no color table exists, the color to use for all vertices. */
  readonly uniformColor?: ColorDef;
  /** The number of vertices in the table. Must be less than (width*height)/numRgbaPerVertex. */
  readonly numVertices: number;
  /** The number of 4-byte 'RGBA' values associated with each vertex. */
  readonly numRgbaPerVertex: number;
  /** If vertex data include texture UV coordinates, the quantization params for those coordinates. */
  readonly uvParams?: QParams2d;
}

/**
 * Represents vertex data (position, color, normal, UV params, etc) in a rectangular array.
 * Each vertex is described by one or more contiguous 4-byte ('RGBA') values.
 * This allows vertex data to be uploaded to the GPU as a texture and vertex data to be sampled
 * from that texture using a single vertex ID representing an index into the array.
 * Vertex color is identified by a 16-bit index into a color table appended to the vertex data.
 */
export class VertexTable implements VertexTableProps {
  /** The rectangular array of vertex data, of size width*height*numRgbaPerVertex bytes. */
  public readonly data: Uint8Array;
  /** Quantization parameters for the vertex positions encoded into the array. */
  public readonly qparams: QParams3d;
  /** The number of 4-byte 'RGBA' values in each row of the array. Must be divisible by numRgbaPerVertex. */
  public readonly width: number;
  /** The number of rows in the array. */
  public readonly height: number;
  /** Whether or not the vertex colors contain translucent colors. */
  public readonly hasTranslucency: boolean;
  /** If no color table exists, the color to use for all vertices. */
  public readonly uniformColor?: ColorDef;
  /** The number of vertices in the table. Must be less than (width*height)/numRgbaPerVertex. */
  public readonly numVertices: number;
  /** The number of 4-byte 'RGBA' values associated with each vertex. */
  public readonly numRgbaPerVertex: number;
  /** If vertex data include texture UV coordinates, the quantization params for those coordinates. */
  public readonly uvParams?: QParams2d;

  /** Construct a VertexTable. The VertexTable takes ownership of all input data - it must not be later modified by the caller. */
  public constructor(props: VertexTableProps) {
    this.data = props.data;
    this.qparams = props.qparams;
    this.width = props.width;
    this.height = props.height;
    this.hasTranslucency = true === props.hasTranslucency;
    this.uniformColor = props.uniformColor;
    this.numVertices = props.numVertices;
    this.numRgbaPerVertex = props.numRgbaPerVertex;
    this.uvParams = props.uvParams;
  }
}

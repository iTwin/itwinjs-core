/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { AuxChannel as PolyfaceAuxChannel } from "@bentley/geometry-core";

/** @internal */
export interface AuxChannelProps {
  readonly name: string;
  readonly inputs: number[];
  readonly indices: number[];
}

/** @internal */
export interface QuantizedAuxChannelProps extends AuxChannelProps {
  readonly qOrigin: number[];
  readonly qScale: number[];
}

/** @internal */
export class AuxChannel implements AuxChannelProps {
  public readonly name: string;
  public readonly inputs: number[];
  public readonly indices: number[];

  public constructor(props: AuxChannelProps) {
    this.name = props.name;
    this.inputs = props.inputs;
    this.indices = props.indices;
  }
}

/** @internal */
export class AuxDisplacementChannel extends AuxChannel {
  public readonly qOrigin: Float32Array;
  public readonly qScale: Float32Array;

  public constructor(props: QuantizedAuxChannelProps) {
    super(props);
    this.qOrigin = Float32Array.from(props.qOrigin);
    this.qScale = Float32Array.from(props.qScale);
  }
}

/** @internal */
export class AuxParamChannel extends AuxChannel {
  public readonly qOrigin: number;
  public readonly qScale: number;

  public constructor(props: QuantizedAuxChannelProps) {
    super(props);
    this.qOrigin = props.qOrigin[0];
    this.qScale = props.qScale[0];
  }
}

/** @internal */
export interface AuxChannelTableProps {
  /** Rectangular array of per-vertex data, of size width * height * numBytesPerVertex bytes. */
  readonly data: Uint8Array;
  /** The number of 4-byte RGBA columns in each row of the array. */
  readonly width: number;
  /** The number of rows in the array. */
  readonly height: number;
  /** The number of vertices in the array. Must be no more than (width * height) / numBytesPerVertex. */
  readonly count: number;
  /** The number of bytes allocated for each vertex. Must be a multiple of two. */
  readonly numBytesPerVertex: number;
  /** Displacements used for animations. */
  readonly displacements?: QuantizedAuxChannelProps[];
  /** Normals used for animations. */
  readonly normals?: AuxChannelProps[];
  /** Scalar params used for animations. */
  readonly params?: QuantizedAuxChannelProps[];
}

/**
 * Represents one or more channels of auxiliary per-vertex data which can be used to animate and resymbolize a mesh in various ways.
 * Each channel holds a fixed number of bytes for each vertex (typically 2 bytes for normals and params, 6 bytes for displacements).
 * The channels are interleaved in a rectangular array such that the data for each vertex is stored contiguously; that is, if a displacement and
 * a normal channel exist, then the first vertex's displacement is followed by the first vertex's normal, which is followed by the second
 * vertex's displacement and normal; and so on.
 * @internal
 */
export class AuxChannelTable {
  /** Rectangular array of per-vertex data, of size width * height * numBytesPerVertex bytes. */
  public readonly data: Uint8Array;
  /** The number of 4-byte RGBA columns in each row of the array. */
  public readonly width: number;
  /** The number of rows in the array. */
  public readonly height: number;
  /** The number of vertices in the array. Must be no more than (width * height) / numBytesPerVertex. */
  public readonly numVertices: number;
  /** The number of bytes allocated for each vertex. Must be a multiple of two. */
  public readonly numBytesPerVertex: number;
  /** Displacements used for animations. */
  public readonly displacements?: AuxDisplacementChannel[];
  /** Normals used for animations. */
  public readonly normals?: AuxChannel[];
  /** Scalar params used for animations. */
  public readonly params?: AuxParamChannel[];

  private constructor(props: AuxChannelTableProps, displacements?: AuxDisplacementChannel[], normals?: AuxChannel[], params?: AuxParamChannel[]) {
    this.data = props.data;
    this.width = props.width;
    this.height = props.height;
    this.numVertices = props.count;
    this.numBytesPerVertex = props.numBytesPerVertex;
    this.displacements = displacements;
    this.normals = normals;
    this.params = params;
  }

  public static fromJSON(props: AuxChannelTableProps): AuxChannelTable | undefined {
    let displacements: AuxDisplacementChannel[] | undefined;
    let normals: AuxChannel[] | undefined;
    let params: AuxParamChannel[] | undefined;

    if (undefined !== props.displacements && 0 < props.displacements.length) {
      displacements = [];
      for (const displacement of props.displacements)
        displacements.push(new AuxDisplacementChannel(displacement));
    }

    if (undefined !== props.normals && 0 < props.normals.length) {
      normals = [];
      for (const normal of props.normals)
        normals.push(new AuxChannel(normal));
    }

    if (undefined !== props.params && 0 < props.params.length) {
      params = [];
      for (const param of props.params)
        params.push(new AuxParamChannel(param));
    }

    return undefined !== displacements || undefined !== normals || undefined !== params ? new AuxChannelTable(props, displacements, normals, params) : undefined;
  }

  public static fromChannels(_channels: ReadonlyArray<PolyfaceAuxChannel>, _numVertices: number): AuxChannelTable | undefined {
    return undefined; // ###TODO
  }
}

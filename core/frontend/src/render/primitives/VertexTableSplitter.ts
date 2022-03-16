/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, Id64 } from "@itwin/core-bentley";
import { ColorDef, PackedFeatureTable } from "@itwin/core-common";
import {
  computeDimensions, MeshParams, VertexIndices, VertexTable, VertexTableProps, VertexTableWithIndices,
} from "./VertexTable";
import { PointStringParams } from "./PointStringParams";

export type ComputeNodeId = (elementId: Id64.Uint32Pair) => number;

class IndexBuffer {
  private _data: Uint8Array;
  private _numIndices = 0;
  private readonly _index32 = new Uint32Array(1);
  private readonly _index8 = new Uint8Array(this._index32.buffer, 0, 3);

  public constructor() {
    this._data = new Uint8Array(9);
  }

  public get numIndices(): number {
    return this._numIndices;
  }

  public push(index: number): void {
    this.reserve(this.numIndices + 1);
    this._index32[0] = index;
    this._data.set(this._index8, this.numIndices * 3);
    this._numIndices++;
  }

  private reserve(numTotalIndices: number): void {
    const numTotalBytes = numTotalIndices * 3;
    if (this._data.length >= numTotalBytes)
      return;

    const numBytes = Math.floor(numTotalBytes * 1.5);
    const prevData = this._data;
    this._data = new Uint8Array(numBytes);
    this._data.set(prevData, 0);
  }

  public toUint8Array(): Uint8Array {
    return this._data.subarray(0, this.numIndices * 3);
  }
}

class VertexBuffer {
  private _data: Uint32Array;
  private _length: number;
  private readonly _source: VertexTable;

  public constructor(source: VertexTable) {
    this._source = source;
    this._data = new Uint32Array(3 * source.numRgbaPerVertex);
    this._length = 0;
  }

  public get length(): number {
    return this._length;
  }

  public get vertexSize(): number {
    return this._source.numRgbaPerVertex;
  }

  public push(vertex: Uint32Array): void {
    assert(vertex.length === this.vertexSize);
    this.reserve(this._length + 1);
    this._data.set(vertex, this.length * this.vertexSize);
    this._length++;
  }

  private reserve(newSize: number): void {
    newSize *= this.vertexSize;
    if (this._data.length >= newSize)
      return;

    newSize = Math.floor(newSize * 1.5);
    const prevData = this._data;
    this._data = new Uint32Array(newSize);
    this._data.set(prevData, 0);
  }

  public toUint8Array(): Uint8Array {
    return new Uint8Array(this._data.buffer, 0, this._length * 4 * this.vertexSize);
  }

  public buildVertexTable(maxDimension: number, colorTable: ColorTable | undefined): VertexTable {
    // ###TODO support material atlas.
    const source = this._source;
    colorTable = colorTable ?? source.uniformColor;
    assert(undefined !== colorTable);

    const colorTableLength = colorTable instanceof Uint32Array ? colorTable.length : 0;
    const dimensions = computeDimensions(this._length, this.vertexSize, colorTableLength, maxDimension);

    let rgbaData = this._data;
    if (dimensions.width * dimensions.height > this._data.length) {
      rgbaData = new Uint32Array(dimensions.width * dimensions.height);
      rgbaData.set(this._data, 0);
    }

    if (colorTable instanceof Uint32Array)
      rgbaData.set(colorTable, this.vertexSize * this.length);

    const tableProps: VertexTableProps = {
      data: new Uint8Array(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength),
      usesUnquantizedPositions: source.usesUnquantizedPositions,
      qparams: source.qparams,
      width: dimensions.width,
      height: dimensions.height,
      hasTranslucency: source.hasTranslucency,
      uniformColor: colorTable instanceof ColorDef ? colorTable : undefined,
      featureIndexType: source.featureIndexType,
      uniformFeatureID: source.uniformFeatureID,
      numVertices: this.length,
      numRgbaPerVertex: source.numRgbaPerVertex,
      uvParams: source.uvParams,
    };

    return new VertexTable(tableProps);
  }
}

type ColorTable = Uint32Array | ColorDef;

class ColorTableRemapper {
  private readonly _remappedIndices = new Map<number, number>();
  private readonly _colorTable: Uint32Array;
  public readonly colors: number[] = [];
  private readonly _32 = new Uint32Array(1);
  private readonly _16 = new Uint16Array(this._32.buffer);

  public constructor(colorTable: Uint32Array) {
    this._colorTable = colorTable;
  }

  public remap(vertex: Uint32Array): void {
    this._32[0] = vertex[1];
    const oldIndex = this._16[1];
    let newIndex = this._remappedIndices.get(oldIndex);
    if (undefined === newIndex) {
      newIndex = this.colors.length;
      this._remappedIndices.set(oldIndex, newIndex);
      const color = this._colorTable[oldIndex];
      this.colors.push(color);
    }

    this._16[1] = newIndex;
    vertex[1] = this._32[0];
  }

  public buildColorTable(): ColorTable {
    assert(this.colors.length > 0);
    return this.colors.length > 1 ? new Uint32Array(this.colors) : ColorDef.fromAbgr(this.colors[0]);
  }
}

class Node {
  public readonly vertices: VertexBuffer;
  private readonly _remappedIndices = new Map<number, number>();
  public readonly indices = new IndexBuffer();
  public readonly colors?: ColorTableRemapper;
  // ###TODO remap material indices.

  public constructor(vertexTable: VertexTable) {
    this.vertices = new VertexBuffer(vertexTable);
    if (undefined == vertexTable.uniformColor)
      this.colors = new ColorTableRemapper(new Uint32Array(vertexTable.data.buffer, vertexTable.data.byteOffset + 4 * vertexTable.numVertices * vertexTable.numRgbaPerVertex));
  }

  public addVertex(originalIndex: number, vertex: Uint32Array): void {
    let newIndex = this._remappedIndices.get(originalIndex);
    if (undefined === newIndex) {
      newIndex = this.vertices.length;
      this._remappedIndices.set(originalIndex, newIndex);

      this.colors?.remap(vertex);
      this.vertices.push(vertex);
    }

    this.indices.push(newIndex);
  }

  public buildOutput(maxDimension: number): VertexTableWithIndices {
    return {
      indices: new VertexIndices(this.indices.toUint8Array()),
      vertices: this.vertices.buildVertexTable(maxDimension, this.colors?.buildColorTable()),
    };
  }
}

interface VertexTableSplitArgs extends VertexTableWithIndices {
  featureTable: PackedFeatureTable;
}

class VertexTableSplitter {
  private readonly _input: VertexTableSplitArgs;
  private readonly _computeNodeId: ComputeNodeId;
  private readonly _nodes = new Map<number, Node>();

  private constructor(input: VertexTableSplitArgs, computeNodeId: ComputeNodeId) {
    this._input = input;
    this._computeNodeId = computeNodeId;
  }

  public static split(source: VertexTableSplitArgs, computeNodeId: ComputeNodeId): Map<number, Node> {
    const splitter = new VertexTableSplitter(source, computeNodeId);
    splitter.split();
    return splitter._nodes;
  }

  // ###TODO: Produce new color tables and material atlases, remapping indices.
  private split(): void {
    // Track the most recent feature and corresponding node to avoid repeated lookups - vertices for
    // individual features are largely contiguous.
    let curState = {
      featureIndex: -1,
      node: undefined as unknown as Node,
    };

    const vertSize = this._input.vertices.numRgbaPerVertex;
    const vertex = new Uint32Array(vertSize);
    const vertexTable = new Uint32Array(this._input.vertices.data.buffer, this._input.vertices.data.byteOffset, this._input.vertices.numVertices * vertSize);

    for (const index of this._input.indices) {
      // Extract the data for this vertex without allocating new typed arrays.
      const vertexOffset = index * vertSize;
      for (let i = 0; i < vertex.length; i++)
        vertex[i] = vertexTable[vertexOffset + i];

      // Determine to which element the vertex belongs and find the corresponding Node.
      const featureIndex = vertex[2] & 0x00ffffff;
      if (curState.featureIndex !== featureIndex) {
        curState.featureIndex = featureIndex;
        const elemId = this._input.featureTable.getElementIdPair(featureIndex);
        const nodeId = this._computeNodeId(elemId);
        let node = this._nodes.get(nodeId);
        if (undefined === node)
          this._nodes.set(nodeId, node = new Node(this._input.vertices));

        curState.node = node;
      }

      // Add the vertex to the appropriate node.
      curState.node.addVertex(index, vertex);
    }
  }
}

export interface SplitVertexTableArgs {
  featureTable: PackedFeatureTable;
  maxDimension: number;
  computeNodeId: ComputeNodeId;
}

export interface SplitPointStringArgs extends SplitVertexTableArgs {
  params: PointStringParams;
}

/** Given a PointStringParams and a function that can associate a node Id with an element Id, produce a mapping of nodes to PointStringParams, splitting up
 * the input params as needed.
 * @internal
 */
export function splitPointStringParams(args: SplitPointStringArgs): Map<number, PointStringParams> {
  const result = new Map<number, PointStringParams>();

  const nodes = VertexTableSplitter.split({
    indices: args.params.indices,
    vertices: args.params.vertices,
    featureTable: args.featureTable,
  }, args.computeNodeId);

  for (const [id, node] of nodes) {
    const { vertices, indices } = node.buildOutput(args.maxDimension);
    result.set(id, new PointStringParams(vertices, indices, args.params.weight));
  }

  return result;
}

export interface SplitMeshArgs extends SplitVertexTableArgs {
  params: MeshParams;
}

export function splitMeshParams(args: SplitMeshArgs): Map<number, MeshParams> {
  const result = new Map<number, MeshParams>();

  const nodes = VertexTableSplitter.split({
    indices: args.params.surface.indices,
    vertices: args.params.vertices,
    featureTable: args.featureTable,
  }, args.computeNodeId);

  for (const [id, node] of nodes) {
    const { vertices, indices } = node.buildOutput(args.maxDimension);
    const params = new MeshParams(
      vertices, {
        type: args.params.surface.type,
        indices,
        fillFlags: args.params.surface.fillFlags,
        hasBakedLighting: args.params.surface.hasBakedLighting,
        hasFixedNormals: args.params.surface.hasFixedNormals,
        textureMapping: args.params.surface.textureMapping,
        // ###TODO handle material atlases
        material: args.params.surface.material,
      },
      // ###TODO handle edges
      args.params.edges,
      args.params.isPlanar,
      // ###TODO handle aux channels.......
      args.params.auxChannels,
    );

    result.set(id, params);
  }

  return result;
}

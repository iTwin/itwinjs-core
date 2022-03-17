/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, Constructor, Id64 } from "@itwin/core-bentley";
import { ColorDef, PackedFeatureTable } from "@itwin/core-common";
import {
  computeDimensions, MeshParams, VertexIndices, VertexTable, VertexTableProps, VertexTableWithIndices,
} from "./VertexTable";
import { PointStringParams } from "./PointStringParams";
import { EdgeParams } from "./EdgeParams";

export type ComputeNodeId = (elementId: Id64.Uint32Pair) => number;

interface TypedArrayBuilderOptions {
  growthFactor?: number;
  initialCapacity?: number;
}

class TypedArrayBuilder<T extends Uint8Array | Uint16Array | Uint32Array> {
  protected readonly _constructor: Constructor<T>;
  protected _data: T;
  protected _length: number;
  protected readonly _growthFactor: number;

  protected constructor(constructor: Constructor<T>, options?: TypedArrayBuilderOptions) {
    this._constructor = constructor;
    this._data = new constructor(options?.initialCapacity ?? 0);
    this._growthFactor = options?.growthFactor ?? 1.5;
    this._length = 0;
  }

  public get length(): number {
    return this._length;
  }

  public get capacity(): number {
    return this._data.length;
  }

  public ensureCapacity(newCapacity: number): number {
    if (this.capacity >= newCapacity)
      return this.capacity;

    newCapacity *= this._growthFactor;
    const prevData = this._data;
    this._data = new this._constructor(newCapacity);
    this._data.set(prevData, 0);

    assert(this.capacity === newCapacity);
    return this.capacity;
  }

  public push(value: number): void {
    this.ensureCapacity(this.length + 1);
    this._data[this.length] = value;
    ++this._length;
  }

  public append(values: T): void {
    const newLength = this.length + values.length;
    this.ensureCapacity(newLength);
    this._data.set(values, this.length);
    this._length = newLength;
  }

  public toTypedArray(includeUnusedCapacity = false): T {
    if (includeUnusedCapacity)
      return this._data;

    const subarray = this._data.subarray(0, this.length);
    assert(subarray instanceof this._constructor);
    assert(subarray.buffer === this._data.buffer);
    return subarray;
  }
}

class Uint8ArrayBuilder extends TypedArrayBuilder<Uint8Array> {
  public constructor(options?: TypedArrayBuilderOptions) {
    super(Uint8Array, options);
  }
}

class Uint16ArrayBuilder extends TypedArrayBuilder<Uint16Array> {
  public constructor(options?: TypedArrayBuilderOptions) {
    super(Uint16Array, options);
  }
}

class Uint32ArrayBuilder extends TypedArrayBuilder<Uint32Array> {
  public constructor(options?: TypedArrayBuilderOptions) {
    super(Uint32Array, options);
  }

  public toUint8Array(includeUnusedCapacity = false): Uint8Array {
    if (includeUnusedCapacity)
      return new Uint8Array(this._data.buffer);

    return new Uint8Array(this._data.buffer, 0, this.length * 4);
  }
}

class IndexBuffer {
  private readonly _builder: Uint8ArrayBuilder;
  private readonly _index32 = new Uint32Array(1);
  private readonly _index8 = new Uint8Array(this._index32.buffer, 0, 3);

  public constructor() {
    this._builder = new Uint8ArrayBuilder({ initialCapacity: 9 });
  }

  public get numIndices(): number {
    assert((this._builder.length % 3) === 0);;;;
    return this._builder.length / 3;
  }

  public push(index: number): void {
    this._index32[0] = index;
    this._builder.append(this._index8);
  }

  public toVertexIndices(): VertexIndices {
    return new VertexIndices(this._builder.toTypedArray());
  }
}

class VertexBuffer {
  private readonly _builder: Uint32ArrayBuilder;
  private readonly _source: VertexTable;

  public constructor(source: VertexTable) {
    this._source = source;
    this._builder = new Uint32ArrayBuilder({ initialCapacity: 3 * source.numRgbaPerVertex });
  }

  public get length(): number {
    assert((this._builder.length % this.vertexSize) === 0);
    return this._builder.length / this.vertexSize;
  }

  public get vertexSize(): number {
    return this._source.numRgbaPerVertex;
  }

  public push(vertex: Uint32Array): void {
    assert(vertex.length === this.vertexSize);
    this._builder.append(vertex);
  }

  public buildVertexTable(maxDimension: number, colorTable: ColorTable | undefined): VertexTable {
    // ###TODO support material atlas.
    const source = this._source;
    colorTable = colorTable ?? source.uniformColor;
    assert(undefined !== colorTable);

    const colorTableLength = colorTable instanceof Uint32Array ? colorTable.length : 0;
    const dimensions = computeDimensions(this.length, this.vertexSize, colorTableLength, maxDimension);

    let rgbaData = this._builder.toTypedArray();
    if (dimensions.width * dimensions.height > rgbaData.length) {
      const prevData = rgbaData;
      rgbaData = new Uint32Array(dimensions.width * dimensions.height);
      rgbaData.set(prevData, 0);
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
  public readonly remappedIndices = new Map<number, number>();
  public readonly indices = new IndexBuffer();
  public readonly colors?: ColorTableRemapper;
  // ###TODO remap material indices.

  public constructor(vertexTable: VertexTable) {
    this.vertices = new VertexBuffer(vertexTable);
    if (undefined == vertexTable.uniformColor)
      this.colors = new ColorTableRemapper(new Uint32Array(vertexTable.data.buffer, vertexTable.data.byteOffset + 4 * vertexTable.numVertices * vertexTable.numRgbaPerVertex));
  }

  public addVertex(originalIndex: number, vertex: Uint32Array): void {
    let newIndex = this.remappedIndices.get(originalIndex);
    if (undefined === newIndex) {
      newIndex = this.vertices.length;
      this.remappedIndices.set(originalIndex, newIndex);

      this.colors?.remap(vertex);
      this.vertices.push(vertex);
    }

    this.indices.push(newIndex);
  }

  public buildOutput(maxDimension: number): VertexTableWithIndices {
    return {
      indices: this.indices.toVertexIndices(),
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

interface RemappedSegmentEdges {
  indices: IndexBuffer;
  endPointAndQuadIndices: Uint32ArrayBuilder;
}

interface RemappedSilhouetteEdges extends RemappedSegmentEdges {
  normalPairs: Uint32ArrayBuilder;
}

interface RemappedEdges {
  segments?: RemappedSegmentEdges;
  silhouettes?: RemappedSilhouetteEdges;
  // ###TODO polylines
  // ###TODO indexed edges
}

function remapSegmentEdges(type: "segments" | "silhouettes", source: EdgeParams, nodes: Map<number, Node>, edges: Map<number, RemappedEdges>): void {
  const src = source[type];
  if (!src)
    return;

  const srcEndPts = new Uint32Array(src.endPointAndQuadIndices.buffer, src.endPointAndQuadIndices.byteOffset, src.endPointAndQuadIndices.length / 4);
  let srcNormalPairs;
  if (type === "silhouettes") {
    assert(undefined !== source.silhouettes);
    srcNormalPairs = new Uint16Array(source.silhouettes.normalPairs.buffer, source.silhouettes.normalPairs.byteOffset, source.silhouettes.normalPairs.length / 2);
  }

  let curIndexIndex = 0;
  for (const index of src.indices) {
    for (const [id, node] of nodes) {
      const newIndex = node.remappedIndices.get(index);
      if (undefined === newIndex)
        continue;

      let endPointAndQuad = srcEndPts[curIndexIndex];
      const otherIndex = (endPointAndQuad & 0x00ffffff) >>> 0;
      const newOtherIndex = node.remappedIndices.get(otherIndex);
      assert(undefined !== newOtherIndex);
      endPointAndQuad = (endPointAndQuad & 0xff000000) | newOtherIndex;

      let entry = edges.get(id);
      if (!entry)
        edges.set(id, entry = { });

      if (srcNormalPairs) {
        if (!entry.silhouettes)
          entry.silhouettes = { indices: new IndexBuffer(), endPointAndQuadIndices: new Uint32ArrayBuilder(), normalPairs: new Uint32ArrayBuilder() };

        entry.silhouettes.normalPairs.push(srcNormalPairs[curIndexIndex]);
      } else if (!entry.segments) {
          entry.segments = { indices: new IndexBuffer(), endPointAndQuadIndices: new Uint32ArrayBuilder() };
      }

      const segments = entry[type];
      assert(undefined !== segments);

      segments.indices.push(newIndex);
      segments.endPointAndQuadIndices.push(endPointAndQuad);
    }

    ++curIndexIndex;
  }
}

function splitEdges(source: EdgeParams, nodes: Map<number, Node>): Map<number, EdgeParams> {
  const edges = new Map<number, RemappedEdges>();
  remapSegmentEdges("segments", source, nodes, edges);
  remapSegmentEdges("silhouettes", source, nodes, edges);

  // ###TODO polyline edges
  // ###TODO indexed edges

  const result = new Map<number, EdgeParams>();
  for (const [id, remappedEdges] of edges) {
    if (!remappedEdges.segments && !remappedEdges.silhouettes)
      continue;

    result.set(id, {
      weight: source.weight,
      linePixels: source.linePixels,
      segments: remappedEdges.segments ? {
        indices: remappedEdges.segments.indices.toVertexIndices(),
        endPointAndQuadIndices: remappedEdges.segments.endPointAndQuadIndices.toUint8Array(),
      } : undefined,
      silhouettes: remappedEdges.silhouettes ? {
        indices: remappedEdges.silhouettes.indices.toVertexIndices(),
        endPointAndQuadIndices: remappedEdges.silhouettes.endPointAndQuadIndices.toUint8Array(),
        normalPairs: remappedEdges.silhouettes.normalPairs.toUint8Array(),
      } : undefined,
    });
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

  let edges = args.params.edges ? splitEdges(args.params.edges, nodes) : undefined;

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
      edges?.get(id),
      args.params.isPlanar,
      // ###TODO handle aux channels.......
      args.params.auxChannels,
    );

    result.set(id, params);
  }

  return result;
}

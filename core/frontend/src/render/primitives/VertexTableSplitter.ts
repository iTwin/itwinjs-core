/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert, Uint32ArrayBuilder, Uint8ArrayBuilder } from "@itwin/core-bentley";
import { ColorDef, ComputeNodeId, PackedFeatureTable } from "@itwin/core-common";
import {
  computeDimensions, MeshParams, VertexIndices, VertexTable, VertexTableProps, VertexTableWithIndices,
} from "./VertexTable";
import { PointStringParams } from "./PointStringParams";
import { PolylineParams, TesselatedPolyline } from "./PolylineParams";
import { calculateEdgeTableParams, EdgeParams, EdgeTable, IndexedEdgeParams } from "./EdgeParams";
import { createSurfaceMaterial, SurfaceMaterial } from "./SurfaceParams";
import { IModelApp } from "../../IModelApp";
import { CreateRenderMaterialArgs } from "../RenderMaterial";

/** Builds up a [[VertexIndices]].
 * Exported strictly for tests.
 */
export class IndexBuffer {
  private readonly _builder: Uint8ArrayBuilder;
  private readonly _index32 = new Uint32Array(1);
  private readonly _index8 = new Uint8Array(this._index32.buffer, 0, 3);

  public constructor(initialCapacity = 3) {
    this._builder = new Uint8ArrayBuilder({ initialCapacity: initialCapacity * 3 });
  }

  public get numIndices(): number {
    assert((this._builder.length % 3) === 0);
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

/** Builds up a [[VertexTable]]. */
class VertexBuffer {
  private readonly _builder: Uint32ArrayBuilder;
  private readonly _source: VertexTable;

  /** `source` is the original table containing the vertex data from which individual vertices will be obtained. */
  public constructor(source: VertexTable) {
    this._source = source;
    this._builder = new Uint32ArrayBuilder({ initialCapacity: 3 * source.numRgbaPerVertex });
  }

  /** The number of vertices currently in the table. */
  public get length(): number {
    assert((this._builder.length % this.vertexSize) === 0);
    return this._builder.length / this.vertexSize;
  }

  /** The number of 32-bit unsigned integers (RGBA values) per vertex. */
  public get vertexSize(): number {
    return this._source.numRgbaPerVertex;
  }

  /** Append a vertex. `vertex` must be of size [[vertexSize]]. */
  public push(vertex: Uint32Array): void {
    assert(vertex.length === this.vertexSize);
    this._builder.append(vertex);
  }

  /** Construct the finished vertex table. */
  public buildVertexTable(maxDimension: number, colorTable: ColorTable | undefined, materialAtlasTable: MaterialAtlasTable): VertexTable {
    const source = this._source;
    colorTable = colorTable ?? source.uniformColor;
    assert(undefined !== colorTable);

    const colorTableLength = colorTable instanceof Uint32Array ? colorTable.length : 0;
    const materialAtlasTableLength = materialAtlasTable instanceof Uint32Array ? materialAtlasTable.length : 0;
    const dimensions = computeDimensions(this.length, this.vertexSize, colorTableLength + materialAtlasTableLength, maxDimension);

    let rgbaData = this._builder.toTypedArray();
    if (dimensions.width * dimensions.height > rgbaData.length) {
      const prevData = rgbaData;
      rgbaData = new Uint32Array(dimensions.width * dimensions.height);
      rgbaData.set(prevData, 0);
    }

    let tableSize = this.vertexSize * this.length;
    if (colorTable instanceof Uint32Array) {
      rgbaData.set(colorTable, tableSize);
      tableSize += colorTable.length;
    }

    if (materialAtlasTable instanceof Uint32Array)
      rgbaData.set(materialAtlasTable, tableSize);

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

/** Remaps portions of a source color table into a filtered target color table. */
class ColorTableRemapper {
  private readonly _remappedIndices = new Map<number, number>();
  private readonly _colorTable: Uint32Array;
  public readonly colors: number[] = [];
  private readonly _32 = new Uint32Array(1);
  private readonly _16 = new Uint16Array(this._32.buffer);

  public constructor(colorTable: Uint32Array) {
    this._colorTable = colorTable;
  }

  /** Extract the color index stored in `vertex`, ensure it is present in the remapped color table, and return its index in that table. */
  public remap(vertex: Uint32Array, usesUnquantizedPositions: boolean | undefined): void {
    const vertIndex = usesUnquantizedPositions ? 4 : 1;
    const shortIndex = usesUnquantizedPositions ? 0 : 1;
    this._32[0] = vertex[vertIndex];
    const oldIndex = this._16[shortIndex];
    let newIndex = this._remappedIndices.get(oldIndex);
    if (undefined === newIndex) {
      newIndex = this.colors.length;
      this._remappedIndices.set(oldIndex, newIndex);
      const color = this._colorTable[oldIndex];
      this.colors.push(color);
    }

    this._16[shortIndex] = newIndex;
    vertex[vertIndex] = this._32[0];
  }

  /** Construct the finished color table. */
  public buildColorTable(): ColorTable {
    assert(this.colors.length > 0);
    return this.colors.length > 1 ? new Uint32Array(this.colors) : ColorDef.fromAbgr(this.colors[0]);
  }
}

type MaterialAtlasTable = Uint32Array | SurfaceMaterial | undefined;

class MaterialAtlasRemapper {
  private readonly _remappedIndices = new Map<number, number>();
  private readonly _atlasTable: Uint32Array;
  public readonly materials: number[] = [];
  private readonly _32 = new Uint32Array(1);
  private readonly _8 = new Uint8Array(this._32.buffer);

  public constructor(_atlasTable: Uint32Array) {
    this._atlasTable = _atlasTable;
  }

  /** Extract the mat index stored in `vertex`, ensure it is present in the remapped atlas table, and return its index in that table. */
  public remap(vertex: Uint32Array, usesUnquantizedPositions: boolean | undefined): void {
    const vertIndex = usesUnquantizedPositions ? 3 : 2;
    this._32[0] = vertex[vertIndex];
    const oldIndex = this._8[3];
    let newIndex = this._remappedIndices.get(oldIndex);
    if (undefined === newIndex) {
      newIndex = this.materials.length / 4;
      this._remappedIndices.set(oldIndex, newIndex);
      let index = oldIndex * 4;
      this.materials.push(this._atlasTable[index++]);
      this.materials.push(this._atlasTable[index++]);
      this.materials.push(this._atlasTable[index++]);
      this.materials.push(this._atlasTable[index]);
    }

    this._8[3] = newIndex;
    vertex[vertIndex] = this._32[0];
  }

  private unpackFloat(value: number): number {
    this._32[0] = value;
    const valUint32 = this._32[0];
    const bias = 38.0;
    const temp = (valUint32 >>> 24) / 2.0;
    let exponent = Math.floor(temp);
    let sign = (temp - exponent) * 2.0;
    sign = -(sign * 2.0 - 1.0);
    const base = sign * (valUint32 & 0xffffff) / 16777216.0;
    exponent = exponent - bias;
    return base * Math.pow(10.0, exponent);
  }

  private materialFromAtlasEntry(entry: Uint32Array): SurfaceMaterial | undefined {
    const rgbOverridden = (entry[1] & 0x1000000) !== 0;
    const alphaOverridden = (entry[1] & 0x2000000) !== 0;
    const args: CreateRenderMaterialArgs = {
      alpha: alphaOverridden ? (entry[0] >>> 24) / 255.0 : undefined,
      diffuse: {
        color: rgbOverridden ? ColorDef.fromTbgr(entry[0] & 0xffffff) : undefined,
        weight: (entry[1] >>> 8) / 255.0,
      },
      specular: {
        color: ColorDef.fromTbgr(entry[2]),
        weight: ((entry[1] >>> 16) & 0xff) / 255.0,
        exponent: this.unpackFloat(entry[3]),
      },
    };
    const material = IModelApp.renderSystem.createRenderMaterial(args);
    return createSurfaceMaterial(material);
  }

  /** Construct the finished color table. */
  public buildAtlasTable(): MaterialAtlasTable {
    assert(this.materials.length > 0);
    const m = new Uint32Array(this.materials);
    return this.materials.length > 4 ? m : this.materialFromAtlasEntry(m);
  }
}

/** A node in a split vertex table. Each node corresponds to one or more elements. */
class Node {
  public readonly vertices: VertexBuffer;
  public readonly remappedIndices = new Map<number, number>();
  public readonly indices = new IndexBuffer();
  public readonly colors?: ColorTableRemapper;
  public readonly atlas?: MaterialAtlasRemapper;
  public readonly usesUnquantizedPositions?: boolean;

  /** `vertexTable` is the source table containing vertex data for all nodes, from which this node will extract the vertices belong to it. */
  public constructor(vertexTable: VertexTable, numColorsPrecedingAtlas: number | undefined) {
    this.vertices = new VertexBuffer(vertexTable);
    if (undefined === vertexTable.uniformColor)
      this.colors = new ColorTableRemapper(new Uint32Array(vertexTable.data.buffer, vertexTable.data.byteOffset + 4 * vertexTable.numVertices * vertexTable.numRgbaPerVertex));

    if (undefined !== numColorsPrecedingAtlas) {
      const atlasOffset = (vertexTable.numVertices * vertexTable.numRgbaPerVertex + numColorsPrecedingAtlas) * 4;
      this.atlas = new MaterialAtlasRemapper(new Uint32Array(vertexTable.data.buffer, vertexTable.data.byteOffset + atlasOffset));
    }

    this.usesUnquantizedPositions = vertexTable.usesUnquantizedPositions;
  }

  public addVertex(originalIndex: number, vertex: Uint32Array): void {
    let newIndex = this.remappedIndices.get(originalIndex);
    if (undefined === newIndex) {
      newIndex = this.vertices.length;
      this.remappedIndices.set(originalIndex, newIndex);

      this.colors?.remap(vertex, this.usesUnquantizedPositions);
      this.atlas?.remap(vertex, this.usesUnquantizedPositions);
      this.vertices.push(vertex);
    }

    this.indices.push(newIndex);
  }

  public buildOutput(maxDimension: number): VertexTableWithIndices {
    const materialAtlas = this.atlas?.buildAtlasTable();
    const material: SurfaceMaterial | undefined = (materialAtlas instanceof Uint32Array) ? undefined : materialAtlas;
    return {
      indices: this.indices.toVertexIndices(),
      vertices: this.vertices.buildVertexTable(maxDimension, this.colors?.buildColorTable(), materialAtlas),
      material,
    };
  }
}

interface VertexTableSplitArgs extends VertexTableWithIndices {
  featureTable: PackedFeatureTable;
  atlasOffset?: number;
}

class VertexTableSplitter {
  private readonly _input: VertexTableSplitArgs;
  private readonly _computeNodeId: ComputeNodeId;
  private readonly _nodes = new Map<number, Node>();

  private constructor(input: VertexTableSplitArgs, computeNodeId: ComputeNodeId) {
    this._input = input;
    this._computeNodeId = computeNodeId;
  }

  /** Split the source into one or more output nodes, returning a mapping of integer node Id to node. */
  public static split(source: VertexTableSplitArgs, computeNodeId: ComputeNodeId): Map<number, Node> {
    const splitter = new VertexTableSplitter(source, computeNodeId);
    splitter.split();
    return splitter._nodes;
  }

  private split(): void {
    // Track the most recent feature and corresponding node to avoid repeated lookups - vertices for
    // individual features are largely contiguous.
    const curState = {
      featureIndex: -1,
      node: undefined as unknown as Node,
    };

    const vertSize = this._input.vertices.numRgbaPerVertex;
    const vertex = new Uint32Array(vertSize);
    const vertexTable = new Uint32Array(this._input.vertices.data.buffer, this._input.vertices.data.byteOffset, this._input.vertices.numVertices * vertSize);

    const elemIdPair = { lower: 0, upper: 0 };
    for (const index of this._input.indices) {
      // Extract the data for this vertex without allocating new typed arrays.
      const vertexOffset = index * vertSize;
      for (let i = 0; i < vertex.length; i++)
        vertex[i] = vertexTable[vertexOffset + i];

      // Determine to which element the vertex belongs and find the corresponding Node.
      const featureIndex = vertex[2] & 0x00ffffff;
      if (curState.featureIndex !== featureIndex) {
        curState.featureIndex = featureIndex;
        this._input.featureTable.getElementIdPair(featureIndex, elemIdPair);
        const nodeId = this._computeNodeId(elemIdPair, featureIndex);
        let node = this._nodes.get(nodeId);
        if (undefined === node)
          this._nodes.set(nodeId, node = new Node(this._input.vertices, this._input.atlasOffset));

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
  const nodes = VertexTableSplitter.split({
    indices: args.params.indices,
    vertices: args.params.vertices,
    featureTable: args.featureTable,
  }, args.computeNodeId);

  const result = new Map<number, PointStringParams>();
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

class RemappedPolylineEdges {
  public readonly indices = new IndexBuffer();
  public readonly prevIndices = new IndexBuffer();
  public readonly nextIndicesAndParams = new Uint32ArrayBuilder();
}

interface RemappedIndexEdges {
  edges: Uint8ArrayBuilder;
  silhouettes: Uint8ArrayBuilder;
}

interface RemappedEdges {
  segments?: RemappedSegmentEdges;
  silhouettes?: RemappedSilhouetteEdges;
  polylines?: RemappedPolylineEdges;
  indexed?: RemappedIndexEdges;
}

interface RemappedIndex {
  node: Node;
  id: number;
  index: number;
}

function remapIndex(out: RemappedIndex, srcIndex: number, nodes: Map<number, Node>): boolean {
  for (const [id, node] of nodes) {
    const index = node.remappedIndices.get(srcIndex);
    if (undefined !== index) {
      out.index = index;
      out.node = node;
      out.id = id;
      return true;
    }
  }

  assert(false);
  return false;
}

function remapSegmentEdges(type: "segments" | "silhouettes", source: EdgeParams, nodes: Map<number, Node>, edges: Map<number, RemappedEdges>): void {
  const src = source[type];
  if (!src)
    return;

  const srcEndPts = new Uint32Array(src.endPointAndQuadIndices.buffer, src.endPointAndQuadIndices.byteOffset, src.endPointAndQuadIndices.length / 4);
  let srcNormalPairs;
  if (type === "silhouettes") {
    assert(undefined !== source.silhouettes);
    srcNormalPairs = new Uint32Array(source.silhouettes.normalPairs.buffer, source.silhouettes.normalPairs.byteOffset, source.silhouettes.normalPairs.length / 4);
  }

  let curIndexIndex = 0;
  const remappedIndex = { } as unknown as RemappedIndex;
  for (const srcIndex of src.indices) {
    if (remapIndex(remappedIndex, srcIndex, nodes)) {
      let endPointAndQuad = srcEndPts[curIndexIndex];
      const otherIndex = (endPointAndQuad & 0x00ffffff) >>> 0;
      const newOtherIndex = remappedIndex.node.remappedIndices.get(otherIndex);
      assert(undefined !== newOtherIndex);
      endPointAndQuad = (endPointAndQuad & 0xff000000) | newOtherIndex;

      let entry = edges.get(remappedIndex.id);
      if (!entry)
        edges.set(remappedIndex.id, entry = { });

      if (srcNormalPairs) {
        if (!entry.silhouettes)
          entry.silhouettes = { indices: new IndexBuffer(), endPointAndQuadIndices: new Uint32ArrayBuilder(), normalPairs: new Uint32ArrayBuilder() };

        entry.silhouettes.normalPairs.push(srcNormalPairs[curIndexIndex]);
      } else if (!entry.segments) {
        entry.segments = { indices: new IndexBuffer(), endPointAndQuadIndices: new Uint32ArrayBuilder() };
      }

      const segments = entry[type];
      assert(undefined !== segments);

      segments.indices.push(remappedIndex.index);
      segments.endPointAndQuadIndices.push(endPointAndQuad);
    }

    ++curIndexIndex;
  }
}

function remapPolylineEdges(src: TesselatedPolyline, nodes: Map<number, Node>, edges: Map<number, RemappedEdges>): void {
  const srcNextAndParam = new Uint32Array(src.nextIndicesAndParams.buffer, src.nextIndicesAndParams.byteOffset, src.nextIndicesAndParams.length / 4);
  const prevIter = src.prevIndices[Symbol.iterator]();
  let curIndexIndex = 0;
  const remappedIndex = { } as unknown as RemappedIndex;
  for (const srcIndex of src.indices) {
    if (remapIndex(remappedIndex, srcIndex, nodes)) {
      const prevIndex = prevIter.next().value;
      assert(undefined !== prevIndex);
      const newPrevIndex = remappedIndex.node.remappedIndices.get(prevIndex);
      assert(undefined !== newPrevIndex);

      let nextAndParam = srcNextAndParam[curIndexIndex];
      const nextIndex = (nextAndParam & 0x00ffffff) >>> 0;
      const newNextIndex = remappedIndex.node.remappedIndices.get(nextIndex);
      assert(undefined !== newNextIndex);
      nextAndParam = (nextAndParam & 0xff000000) | newNextIndex;

      let entry = edges.get(remappedIndex.id);
      if (!entry)
        edges.set(remappedIndex.id, entry = { });

      if (!entry.polylines)
        entry.polylines = new RemappedPolylineEdges();

      entry.polylines.indices.push(remappedIndex.index);
      entry.polylines.prevIndices.push(newPrevIndex);
      entry.polylines.nextIndicesAndParams.push(nextAndParam);
    }

    ++curIndexIndex;
  }
}

function remapIndexedEdges(src: IndexedEdgeParams, nodes: Map<number, Node>, edges: Map<number, RemappedEdges>): void {
  const srcEdgeData = src.edges.data;
  const numSegments = src.edges.numSegments;
  const silhouetteStartByteIndex = numSegments * 6 + src.edges.silhouettePadding;

  function getUint24EdgePair(byteIndex: number): [number, number] {
    return [srcEdgeData[byteIndex + 0] | (srcEdgeData[byteIndex + 1] << 8) | srcEdgeData[byteIndex + 2] << 16,
      srcEdgeData[byteIndex + 3] | (srcEdgeData[byteIndex + 4] << 8) | srcEdgeData[byteIndex + 5] << 16];
  }

  function setUint24EdgePair(indEdges: RemappedIndexEdges, value1: number, value2: number): void {
    indEdges.edges.push(value1 & 0x0000ff);
    indEdges.edges.push((value1 & 0x00ff00) >>> 8);
    indEdges.edges.push((value1 & 0xff0000) >>> 16);
    indEdges.edges.push(value2 & 0x0000ff);
    indEdges.edges.push((value2 & 0x00ff00) >>> 8);
    indEdges.edges.push((value2 & 0xff0000) >>> 16);
  }

  function getUint24SilPair(byteIndex: number): [number, number, number, number] {
    return [srcEdgeData[byteIndex + 0] | (srcEdgeData[byteIndex + 1] << 8) | srcEdgeData[byteIndex + 2] << 16,
      srcEdgeData[byteIndex + 3] | (srcEdgeData[byteIndex + 4] << 8) | srcEdgeData[byteIndex + 5] << 16,
      srcEdgeData[byteIndex + 6] | (srcEdgeData[byteIndex + 7] << 8), srcEdgeData[byteIndex + 8] | (srcEdgeData[byteIndex + 9] << 8)];
  }

  function setUint24SilPair(indSil: RemappedIndexEdges, value1: number, value2: number, norm1: number, norm2: number): void {
    indSil.silhouettes.push(value1 & 0x0000ff);
    indSil.silhouettes.push((value1 & 0x00ff00) >>> 8);
    indSil.silhouettes.push((value1 & 0xff0000) >>> 16);
    indSil.silhouettes.push(value2 & 0x0000ff);
    indSil.silhouettes.push((value2 & 0x00ff00) >>> 8);
    indSil.silhouettes.push((value2 & 0xff0000) >>> 16);
    indSil.silhouettes.push(norm1 & 0x0000ff);
    indSil.silhouettes.push((norm1 & 0x00ff00) >>> 8);
    indSil.silhouettes.push(norm2 & 0x0000ff);
    indSil.silhouettes.push((norm2 & 0x00ff00) >>> 8);
  }

  let maxIndex = 0;
  for (const srcIndex of src.indices)
    maxIndex = Math.max (srcIndex, maxIndex);

  const remappedIndex = { } as unknown as RemappedIndex;
  let es1Index = 0, es2Index = 0, n1 = 0, n2 = 0;
  for (let curSegment = 0, byteIndex = 0; curSegment <= maxIndex; ++curSegment) {
    if (curSegment < numSegments) {  // edges
      [es1Index, es2Index] = getUint24EdgePair(byteIndex);
      byteIndex += 6;
    } else {  // silhouettes
      byteIndex = silhouetteStartByteIndex + (curSegment - numSegments) * 10;
      [es1Index, es2Index, n1, n2] = getUint24SilPair(byteIndex);
    }

    if (remapIndex(remappedIndex, es1Index, nodes)) {
      let entry = edges.get(remappedIndex.id);
      if (!entry)
        edges.set(remappedIndex.id, entry = { });

      if (!entry.indexed)
        entry.indexed = { edges: new Uint8ArrayBuilder(), silhouettes: new Uint8ArrayBuilder() };

      if (curSegment < numSegments) {  // edges
        const newE1Index = remappedIndex.node.remappedIndices.get(es1Index);
        assert(undefined !== newE1Index);
        const newE2Index = remappedIndex.node.remappedIndices.get(es2Index);
        assert(undefined !== newE2Index);
        setUint24EdgePair(entry.indexed, newE1Index, newE2Index);
      } else {  // silhouettes
        const newS1Index = remappedIndex.node.remappedIndices.get(es1Index);
        assert(undefined !== newS1Index);
        const newS2Index = remappedIndex.node.remappedIndices.get(es2Index);
        assert(undefined !== newS2Index);
        setUint24SilPair(entry.indexed, newS1Index, newS2Index, n1, n2);
      }
    }
  }
}

function splitEdges(source: EdgeParams, nodes: Map<number, Node>): Map<number, EdgeParams> {
  const edges = new Map<number, RemappedEdges>();
  remapSegmentEdges("segments", source, nodes, edges);
  remapSegmentEdges("silhouettes", source, nodes, edges);

  if (source.polylines)
    remapPolylineEdges(source.polylines, nodes, edges);

  if (source.indexed)
    remapIndexedEdges(source.indexed, nodes, edges);

  const result = new Map<number, EdgeParams>();
  for (const [id, remappedEdges] of edges) {
    if (!remappedEdges.segments && !remappedEdges.silhouettes && !remappedEdges.indexed)
      continue;

    let edgeTable = { } as unknown as EdgeTable;
    let edgeIndices = { } as unknown as VertexIndices;
    if (remappedEdges.indexed) {
      const numSegmentEdges = remappedEdges.indexed.edges.length / 6;
      const numSilhouettes = remappedEdges.indexed.silhouettes.length / 10;
      const { width, height, silhouettePadding, silhouetteStartByteIndex } = calculateEdgeTableParams(numSegmentEdges, numSilhouettes, IModelApp.renderSystem.maxTextureSize);
      const data = new Uint8Array(width * height * 4);
      data.set(remappedEdges.indexed.edges.toTypedArray(), 0);
      if (numSilhouettes > 0)
        data.set(remappedEdges.indexed.silhouettes.toTypedArray(), silhouetteStartByteIndex + silhouettePadding);

      const numTotalEdges = numSegmentEdges + numSilhouettes;
      edgeIndices = new VertexIndices(new Uint8Array(numTotalEdges * 6 * 3));
      for (let i = 0; i < numTotalEdges; i++)
        for (let j = 0; j < 6; j++)
          edgeIndices.setNthIndex(i * 6 + j, i);

      edgeTable = {
        data,
        width,
        height,
        numSegments: numSegmentEdges,
        silhouettePadding,
      };
    }

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
      polylines: remappedEdges.polylines ? {
        indices: remappedEdges.polylines.indices.toVertexIndices(),
        prevIndices: remappedEdges.polylines.prevIndices.toVertexIndices(),
        nextIndicesAndParams: remappedEdges.polylines.nextIndicesAndParams.toUint8Array(),
      } : undefined,
      indexed: remappedEdges.indexed ? {
        indices: edgeIndices,
        edges: edgeTable,
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

  const mat = args.params.surface.material;
  const atlasOffset = undefined !== mat && mat.isAtlas ? mat.vertexTableOffset : undefined;

  const nodes = VertexTableSplitter.split({
    indices: args.params.surface.indices,
    vertices: args.params.vertices,
    featureTable: args.featureTable,
    atlasOffset,
  }, args.computeNodeId);

  const edges = args.params.edges ? splitEdges(args.params.edges, nodes) : undefined;

  for (const [id, node] of nodes) {
    const { vertices, indices, material } = node.buildOutput(args.maxDimension);
    const params = new MeshParams(
      vertices, {
        type: args.params.surface.type,
        indices,
        fillFlags: args.params.surface.fillFlags,
        hasBakedLighting: args.params.surface.hasBakedLighting,
        textureMapping: args.params.surface.textureMapping,
        material: material !== undefined ? material : args.params.surface.material,
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

export interface SplitPolylineArgs extends SplitVertexTableArgs {
  params: PolylineParams;
}

interface PolylineNode extends Node {
  prevIndices?: IndexBuffer;
  nextIndicesAndParams?: Uint32ArrayBuilder;
}

export function splitPolylineParams(args: SplitPolylineArgs): Map<number, PolylineParams> {
  const nodes = VertexTableSplitter.split({
    indices: args.params.polyline.indices,
    vertices: args.params.vertices,
    featureTable: args.featureTable,
  }, args.computeNodeId) as Map<number, PolylineNode>;

  const src = args.params.polyline;
  const srcNextAndParam = new Uint32Array(src.nextIndicesAndParams.buffer, src.nextIndicesAndParams.byteOffset, src.nextIndicesAndParams.length / 4);
  let curIndexIndex = 0;
  const remappedIndex = { } as unknown as RemappedIndex;
  for (const prevIndex of src.prevIndices) {
    if (remapIndex(remappedIndex, prevIndex, nodes)) {
      const node = remappedIndex.node as PolylineNode;
      if (!node.prevIndices) {
        assert(undefined === node.nextIndicesAndParams);
        node.prevIndices = new IndexBuffer(node.indices.numIndices);
        node.nextIndicesAndParams = new Uint32ArrayBuilder({ initialCapacity: node.indices.numIndices });
      } else {
        assert(undefined !== node.nextIndicesAndParams);
      }

      node.prevIndices.push(remappedIndex.index);

      let nextAndParam = srcNextAndParam[curIndexIndex];
      const nextIndex = (nextAndParam & 0x00ffffff) >>> 0;
      const newNextIndex = remappedIndex.node.remappedIndices.get(nextIndex);
      assert(undefined !== newNextIndex);
      nextAndParam = (nextAndParam & 0xff000000) | newNextIndex;
      node.nextIndicesAndParams.push(nextAndParam);
    }

    ++curIndexIndex;
  }

  const result = new Map<number, PolylineParams>();
  for (const [id, node] of nodes) {
    assert(undefined !== node.prevIndices && undefined !== node.nextIndicesAndParams);
    const { vertices, indices } = node.buildOutput(args.maxDimension);
    const params = new PolylineParams(
      vertices, {
        indices,
        prevIndices: node.prevIndices.toVertexIndices(),
        nextIndicesAndParams: node.nextIndicesAndParams.toUint8Array(),
      },
      args.params.weight,
      args.params.linePixels,
      args.params.isPlanar,
      args.params.type);

    result.set(id, params);
  }

  return result;
}

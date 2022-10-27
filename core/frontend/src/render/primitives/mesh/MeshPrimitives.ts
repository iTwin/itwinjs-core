/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { assert } from "@itwin/core-bentley";
import { AuxChannel, AuxChannelData, Point2d, Point3d, Range3d } from "@itwin/core-geometry";
import {
  ColorIndex, EdgeArgs, Feature, FeatureIndex, FeatureIndexType, FeatureTable, FillFlags, LinePixels, MeshEdges, MeshPolyline, MeshPolylineList,
  OctEncodedNormal, PolylineData, PolylineEdgeArgs, PolylineFlags, QParams3d, QPoint3dList, RenderMaterial, RenderTexture, SilhouetteEdgeArgs,
} from "@itwin/core-common";
import { InstancedGraphicParams } from "../../InstancedGraphicParams";
import { RenderGraphic } from "../../RenderGraphic";
import { RenderSystem } from "../../RenderSystem";
import { ColorMap } from "../ColorMap";
import { DisplayParams } from "../DisplayParams";
import { Triangle, TriangleList } from "../Primitives";
import { VertexKeyProps } from "../VertexKey";

/** A Point3d[] with an [[add]] method used to enable compatibility with the [[MeshPointList]] union type.
 * It is provided a range to contain all of the points. Each point added to the list is transformed to be relative to
 * the center of that range.
 * In the finished graphic, a transform is applied to transform back from the range's center.
 * @internal
 */
export interface Point3dList extends Array<Point3d> {
  /** Identical to `push`, except it returns `void` instead of `number`; compatible with [QPoint3dList.add]($common). */
  add(point: Point3d): void;
  /** The range containing all of the points to be contained in the list, computed in advance. */
  range: Range3d;
}

/** The list of points associated with a [[Mesh]].
 * @see [[Mesh.Props.quantizePositions]] to specify whether points should be quantized or not.
 * @internal
 */
export type MeshPointList = Point3dList | QPoint3dList;

/* Information needed to draw a set of indexed polylines using a shared vertex buffer.
 * @internal
 */
export interface PolylineArgs {
  colors: ColorIndex;
  features: FeatureIndex;
  width: number;
  linePixels: LinePixels;
  flags: PolylineFlags;
  points: QPoint3dList | Omit<Point3dList, "add">;
  polylines: PolylineData[];
}

/** @internal */
export namespace PolylineArgs {
  export function fromMesh(mesh: Mesh): PolylineArgs | undefined {
    if (!mesh.polylines || mesh.polylines.length === 0)
      return undefined;

    const polylines = [];
    for (const polyline of mesh.polylines) {
      const polylineData = new PolylineData();
      if (polylineData.init(polyline))
        polylines.push(polylineData);
    }

    if (polylines.length === 0)
      return undefined;

    const flags = new PolylineFlags(mesh.is2d, mesh.isPlanar);
    flags.isDisjoint = mesh.type === Mesh.PrimitiveType.Point;
    if (mesh.displayParams.regionEdgeType === DisplayParams.RegionEdgeType.Outline) {
      // This polyline is behaving as the edges of a region surface.
      if (!mesh.displayParams.gradient || mesh.displayParams.gradient.isOutlined)
        flags.setIsNormalEdge();
      else
        flags.setIsOutlineEdge(); // edges only displayed if fill undisplayed
    }

    const colors = new ColorIndex();
    mesh.colorMap.toColorIndex(colors, mesh.colors);

    const features = new FeatureIndex();
    mesh.toFeatureIndex(features);

    return {
      width: mesh.displayParams.width,
      linePixels: mesh.displayParams.linePixels,
      flags,
      polylines,
      points: mesh.points,
      colors,
      features,
    };
  }
}

/** The vertices of the edges are shared with those of the surface
 * @internal
 */
export class MeshArgsEdges {
  public edges = new EdgeArgs();
  public silhouettes = new SilhouetteEdgeArgs();
  public polylines = new PolylineEdgeArgs();
  public width = 0;
  public linePixels = LinePixels.Solid;

  public clear(): void {
    this.edges.clear();
    this.silhouettes.clear();
    this.polylines.clear();
    this.width = 0;
    this.linePixels = LinePixels.Solid;
  }
  public get isValid(): boolean { return this.edges.isValid || this.silhouettes.isValid || this.polylines.isValid; }
}

/* A carrier of information needed to describe a triangle mesh and its edges.
 * @internal
 */
export interface MeshArgs {
  edges?: MeshArgsEdges;
  vertIndices: number[];
  points: QPoint3dList | Omit<Point3dList, "add">;
  normals?: OctEncodedNormal[];
  colors: ColorIndex;
  features: FeatureIndex;
  fillFlags: FillFlags;
  isPlanar?: boolean;
  is2d?: boolean;
  hasBakedLighting?: boolean;
  isVolumeClassifier?: boolean;
  auxChannels?: ReadonlyArray<AuxChannel>;
  material?: RenderMaterial;
  textureMapping?: {
    texture: RenderTexture;
    uvParams: Point2d[];
  };
}

/** @internal */
export namespace MeshArgs {
  export function fromMesh(mesh: Mesh): MeshArgs | undefined {
    if (!mesh.triangles || mesh.triangles.isEmpty || mesh.points.length === 0)
      return undefined;

    const texture = mesh.displayParams.textureMapping?.texture;
    const textureMapping = texture && mesh.uvParams.length > 0 ? { texture, uvParams: mesh.uvParams } : undefined;

    const colors = new ColorIndex();
    mesh.colorMap.toColorIndex(colors, mesh.colors);

    const features = new FeatureIndex();
    mesh.toFeatureIndex(features);

    let edges;
    if (mesh.edges) {
      edges = new MeshArgsEdges();
      edges.width = mesh.displayParams.width;
      edges.linePixels = mesh.displayParams.linePixels;
      edges.edges.init(mesh.edges);
      edges.silhouettes.init(mesh.edges);

      const polylines = [];
      for (const meshPolyline of mesh.edges.polylines) {
        const polyline = new PolylineData();
        if (polyline.init(meshPolyline))
          polylines.push(polyline);
      }

      edges.polylines.init(polylines);
    }

    return {
      vertIndices: mesh.triangles.indices,
      points: mesh.points,
      normals: !mesh.displayParams.ignoreLighting && mesh.normals.length > 0 ? mesh.normals : undefined,
      textureMapping,
      colors,
      features,
      material: mesh.displayParams.material,
      fillFlags: mesh.displayParams.fillFlags,
      isPlanar: mesh.isPlanar,
      is2d: mesh.is2d,
      hasBakedLighting: true === mesh.hasBakedLighting,
      isVolumeClassifier: true === mesh.isVolumeClassifier,
      edges,
      auxChannels: mesh.auxChannels,
    };
  }
}

/** @internal */
export class Mesh {
  private readonly _data: TriangleList | MeshPolylineList;
  public readonly points: MeshPointList;
  public readonly normals: OctEncodedNormal[] = [];
  public readonly uvParams: Point2d[] = [];
  public readonly colorMap: ColorMap = new ColorMap(); // used to be called ColorTable
  public colors: number[] = [];
  public edges?: MeshEdges;
  public readonly features?: Mesh.Features;
  public readonly type: Mesh.PrimitiveType;
  public readonly is2d: boolean;
  public readonly isPlanar: boolean;
  public readonly hasBakedLighting: boolean;
  public readonly isVolumeClassifier: boolean;
  public displayParams: DisplayParams;
  private _auxChannels?: AuxChannel[];

  private constructor(props: Mesh.Props) {
    const { displayParams, features, type, range, is2d, isPlanar } = props;
    this._data = Mesh.PrimitiveType.Mesh === type ? new TriangleList() : new MeshPolylineList();
    this.displayParams = displayParams;
    this.features = features ? new Mesh.Features(features) : undefined;
    this.type = type;
    this.is2d = is2d;
    this.isPlanar = isPlanar;
    this.hasBakedLighting = (true === props.hasBakedLighting);
    this.isVolumeClassifier = (true === props.isVolumeClassifier);
    if (props.quantizePositions) {
      this.points = new QPoint3dList(QParams3d.fromRange(range));
    } else {
      const points = [] as unknown as Point3dList;
      points.range = range;
      const center = range.center;
      points.add = (pt: Point3d) => {
        // assert(range.containsPoint(pt)); rounding error triggers this sometimes...
        points.push(pt.minus(center));
      };
      this.points = points;
    }
  }

  public static create(props: Mesh.Props): Mesh { return new Mesh(props); }

  public get triangles(): TriangleList | undefined {
    return Mesh.PrimitiveType.Mesh === this.type ? this._data as TriangleList : undefined;
  }

  public get polylines(): MeshPolylineList | undefined {
    return Mesh.PrimitiveType.Mesh !== this.type ? this._data as MeshPolylineList : undefined;
  }

  public get auxChannels(): ReadonlyArray<AuxChannel> | undefined {
    return this._auxChannels;
  }

  public addAuxChannels(channels: ReadonlyArray<AuxChannel>, srcIndex: number): void {
    // The native version of this function appears to assume that all polyfaces added to the Mesh will have
    // the same number + type of aux channels.
    // ###TODO We should really produce a separate Mesh for each unique combination. For now just bail on mismatch.
    if (this._auxChannels) {
      if (this._auxChannels.length !== channels.length)
        return;

      for (let i = 0; i < channels.length; i++) {
        const src = channels[i];
        const dst = this._auxChannels[i];
        if (src.dataType !== dst.dataType || src.name !== dst.name || src.inputName !== dst.inputName)
          return;
      }
    }

    if (!this._auxChannels) {
      // Copy the channels, leaving each AuxData's values array empty.
      this._auxChannels = channels.map((x) => new AuxChannel(x.data.map((y) => new AuxChannelData(y.input, [])), x.dataType, x.name, x.inputName));
    }

    // Append the value at srcIndex from each source channel's data to our channels.
    for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
      const srcChannel = channels[channelIndex];
      const dstChannel = this._auxChannels[channelIndex];
      const dstIndex = dstChannel.valueCount;
      for (let dataIndex = 0; dataIndex < srcChannel.data.length; dataIndex++) {
        const dstData = dstChannel.data[dataIndex];
        dstData.copyValues(srcChannel.data[dataIndex], dstIndex, srcIndex, dstChannel.entriesPerValue);
      }
    }
  }

  public toFeatureIndex(index: FeatureIndex): void {
    if (undefined !== this.features)
      this.features.toFeatureIndex(index);
  }

  public toMeshArgs(): MeshArgs | undefined {
    return MeshArgs.fromMesh(this);
  }

  public toPolylineArgs(): PolylineArgs | undefined {
    return PolylineArgs.fromMesh(this);
  }

  public getGraphics(system: RenderSystem, instancesOrViewIndependentOrigin?: InstancedGraphicParams | Point3d): RenderGraphic | undefined {
    const meshArgs = this.toMeshArgs();
    if (meshArgs)
      return system.createTriMesh(meshArgs, instancesOrViewIndependentOrigin);

    const plArgs = this.toPolylineArgs();
    return plArgs ? system.createIndexedPolylines(plArgs, instancesOrViewIndependentOrigin) : undefined;
  }

  public addPolyline(poly: MeshPolyline): void {
    const { type, polylines } = this;

    assert(Mesh.PrimitiveType.Polyline === type || Mesh.PrimitiveType.Point === type);
    assert(undefined !== polylines);

    if (Mesh.PrimitiveType.Polyline === type && poly.indices.length < 2)
      return;

    if (undefined !== polylines)
      polylines.push(poly);
  }

  public addTriangle(triangle: Triangle): void {
    const { triangles, type } = this;

    assert(Mesh.PrimitiveType.Mesh === type);
    assert(undefined !== triangles);

    if (undefined !== triangles)
      triangles.addTriangle(triangle);
  }

  public addVertex(props: VertexKeyProps): number {
    const { feature, position, normal, uvParam, fillColor } = props;

    this.points.add(position);

    if (undefined !== normal)
      this.normals.push(normal);

    if (undefined !== uvParam)
      this.uvParams.push(uvParam);

    if (feature) {
      assert(undefined !== this.features);
      this.features.add(feature, this.points.length);
    }

    // Don't allocate color indices until we have non-uniform colors
    if (0 === this.colorMap.length) {
      this.colorMap.insert(fillColor);
      assert(this.colorMap.isUniform);
      assert(0 === this.colorMap.indexOf(fillColor));
    } else if (!this.colorMap.isUniform || !this.colorMap.hasColor(fillColor)) {
      // Back-fill uniform value (index=0) for existing vertices if previously uniform
      if (0 === this.colors.length)
        this.colors.length = this.points.length - 1;

      this.colors.push(this.colorMap.insert(fillColor));
      assert(!this.colorMap.isUniform);
    }

    return this.points.length - 1;
  }
}

/** @internal */
export namespace Mesh { // eslint-disable-line no-redeclare
  export enum PrimitiveType {
    Mesh, // eslint-disable-line @typescript-eslint/no-shadow
    Polyline,
    Point,
  }

  export class Features {
    public readonly table: FeatureTable;
    public indices: number[] = [];
    public uniform = 0;
    public initialized = false;

    public constructor(table: FeatureTable) { this.table = table; }

    public add(feat: Feature, numVerts: number): void {
      const index = this.table.insert(feat);
      if (!this.initialized) {
        // First feature - uniform.
        this.uniform = index;
        this.initialized = true;
      } else if (0 < this.indices.length) {
        // Already non-uniform
        this.indices.push(index);
      } else {
        // Second feature - back-fill uniform for existing verts
        while (this.indices.length < numVerts - 1)
          this.indices.push(this.uniform);

        this.indices.push(index);
      }
    }

    public setIndices(indices: number[]) {
      this.indices.length = 0;
      this.uniform = 0;
      this.initialized = 0 < indices.length;

      assert(0 < indices.length);
      if (1 === indices.length)
        this.uniform = indices[0];
      else if (1 < indices.length)
        this.indices = indices;
    }

    public toFeatureIndex(output?: FeatureIndex): FeatureIndex {
      const index = output ?? new  FeatureIndex();
      if (!this.initialized) {
        index.type = FeatureIndexType.Empty;
      } else if (this.indices.length === 0) {
        index.type = FeatureIndexType.Uniform;
        index.featureID = this.uniform;
      } else {
        index.type = FeatureIndexType.NonUniform;
        index.featureIDs = new Uint32Array(this.indices);
      }

      return index;
    }
  }

  export interface Props {
    displayParams: DisplayParams;
    features?: FeatureTable;
    type: Mesh.PrimitiveType;
    range: Range3d;
    quantizePositions: boolean;
    is2d: boolean;
    isPlanar: boolean;
    hasBakedLighting?: boolean;
    isVolumeClassifier?: boolean;
  }
}

/** @internal */
export class MeshList extends Array<Mesh> {
  public readonly features?: FeatureTable;
  public readonly range?: Range3d;
  constructor(features?: FeatureTable, range?: Range3d) {
    super();
    this.features = features;
    this.range = range;
  }
}

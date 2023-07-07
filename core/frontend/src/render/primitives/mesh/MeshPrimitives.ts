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
  OctEncodedNormal, PolylineEdgeArgs, PolylineFlags, PolylineIndices, PolylineTypeFlags, QParams3d, QPoint3dList, RenderMaterial,
  RenderTexture, SilhouetteEdgeArgs,
} from "@itwin/core-common";
import { InstancedGraphicParams } from "../../InstancedGraphicParams";
import { RenderGraphic } from "../../RenderGraphic";
import { RenderSystem } from "../../RenderSystem";
import { ColorMap } from "../ColorMap";
import { DisplayParams } from "../../../common/render/primitives/DisplayParams";
import { MeshPointList, MeshPrimitiveType, Point3dList } from "../../../common/render/primitives/MeshPrimitive";
import { Triangle, TriangleList } from "../Primitives";
import { VertexKeyProps } from "../VertexKey";

/** Arguments supplied to [[RenderSystem.createIndexedPolylines]] describing a set of "polylines" (i.e., line strings or point strings).
 * Line strings consist of two or more points, connected by segments between them with a width specified in pixels.
 * Point strings consist of one or more disconnected points, drawn as dots with a radius specified in pixels.
 * @public
 */
export interface PolylineArgs {
  /** The color(s) of the vertices. */
  colors: ColorIndex;
  /** The [Feature]($common)(s) contained in the [[polylines]]. */
  features: FeatureIndex;
  /** The width of the lines or radius of the points, in pixels. */
  width: number;
  /** The pixel pattern to apply to the line strings. */
  linePixels: LinePixels;
  /** Flags describing how to draw the [[polylines]]. */
  flags: PolylineFlags;
  /** The positions of the [[polylines]]' vertices. If the positions are not quantized, they must include
   * a precomputed [Range3d]($core-geometry) encompassing all of the points.
   */
  points: QPoint3dList | (Array<Point3d> & { range: Range3d });
  /** The set of polylines. Each entry in the array describes a separate line string or point string as a series of indices into [[points]]. */
  polylines: PolylineIndices[];
}

/** @public */
export namespace PolylineArgs {
  /** @internal */
  export function fromMesh(mesh: Mesh): PolylineArgs | undefined {
    if (!mesh.polylines || mesh.polylines.length === 0)
      return undefined;

    const polylines = [];
    for (const polyline of mesh.polylines)
      if (polyline.indices.length > 0)
        polylines.push(polyline.indices);

    if (polylines.length === 0)
      return undefined;

    const flags: PolylineFlags = {
      is2d: mesh.is2d,
      isPlanar: mesh.isPlanar,
      isDisjoint: mesh.type === MeshPrimitiveType.Point,
    };

    if (mesh.displayParams.regionEdgeType === DisplayParams.RegionEdgeType.Outline) {
      // This polyline is behaving as the edges of a region surface.
      if (!mesh.displayParams.gradient || mesh.displayParams.gradient.isOutlined)
        flags.type = PolylineTypeFlags.Edge;
      else
        flags.type = PolylineTypeFlags.Outline; // edges only displayed if fill undisplayed
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

/** Arguments supplied to [[RenderSystem.createTriMesh]] describing a triangle mesh.
 * @public
 */
export interface MeshArgs {
  /** @internal */
  edges?: MeshArgsEdges;
  /** The indices of the triangles. Each consecutive set of three indices represents one triangle.
   * The indices are used to index into the vertex attribute arrays like [[points]] and [[normals]].
   * Their values must be 32-bit unsigned integers.
   */
  vertIndices: number[];
  /** The positions of the mesh's vertices, indexed by [[vertIndices]]. If the positions are not quantized, they must include
   * a precomputed [Range3d]($core-geometry) encompassing all of the points.
   */
  points: QPoint3dList | (Array<Point3d> & { range: Range3d });
  /** The per-vertex normal vectors, indexed by [[vertIndices]].
   * Normal vectors are required if the mesh is to be lit or have [ThematicDisplay]($common) applied to it.
   */
  normals?: OctEncodedNormal[];
  /** The color(s) of the mesh. */
  colors: ColorIndex;
  /** The [Feature]($common)(s) contained in the mesh. */
  features: FeatureIndex;
  /** If [[isPlanar]] is `true`, describes how fill is applied to planar region interiors in wireframe mode.
   * Default: [FillFlags.ByView]($common).
   */
  fillFlags?: FillFlags;
  /** If `true`, indicates that the mesh represents a planar region. Default: false. */
  isPlanar?: boolean;
  /** If `true`, indicates that the mesh is two-dimensional - i.e., all [[points]] have the same z coordinate. */
  is2d?: boolean;
  /** If `true`, indicates that the mesh has a texture that includes static lighting - e.g., from photogrammetry. */
  hasBakedLighting?: boolean;
  /** @internal */
  isVolumeClassifier?: boolean;
  /** Auxiliary data associated with the mesh. */
  auxChannels?: ReadonlyArray<AuxChannel>;
  /** The material applied to the mesh. */
  material?: RenderMaterial;
  /** A texture mapping to be applied to the mesh. */
  textureMapping?: {
    /** The texture image. */
    texture: RenderTexture;
    /** The per-vertex texture coordinates, indexed by [[vertIndices]]. */
    uvParams: Point2d[];
  };
}

/** @public */
export namespace MeshArgs {
  /** @internal */
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
      for (const meshPolyline of mesh.edges.polylines)
        if (meshPolyline.indices.length > 0)
          polylines.push(meshPolyline.indices);

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
  public readonly type: MeshPrimitiveType;
  public readonly is2d: boolean;
  public readonly isPlanar: boolean;
  public readonly hasBakedLighting: boolean;
  public readonly isVolumeClassifier: boolean;
  public displayParams: DisplayParams;
  private _auxChannels?: AuxChannel[];

  private constructor(props: Mesh.Props) {
    const { displayParams, features, type, range, is2d, isPlanar } = props;
    this._data = MeshPrimitiveType.Mesh === type ? new TriangleList() : new MeshPolylineList();
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
    return MeshPrimitiveType.Mesh === this.type ? this._data as TriangleList : undefined;
  }

  public get polylines(): MeshPolylineList | undefined {
    return MeshPrimitiveType.Mesh !== this.type ? this._data as MeshPolylineList : undefined;
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

    assert(MeshPrimitiveType.Polyline === type || MeshPrimitiveType.Point === type);
    assert(undefined !== polylines);

    if (MeshPrimitiveType.Polyline === type && poly.indices.length < 2)
      return;

    if (undefined !== polylines)
      polylines.push(poly);
  }

  public addTriangle(triangle: Triangle): void {
    const { triangles, type } = this;

    assert(MeshPrimitiveType.Mesh === type);
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
    type: MeshPrimitiveType;
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

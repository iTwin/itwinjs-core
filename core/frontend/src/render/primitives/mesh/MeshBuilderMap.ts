/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Comparable, compareNumbers, compareBooleans, Dictionary, Id64 } from "@bentley/bentleyjs-core";
import { Range3d } from "@bentley/geometry-core";
import { PolyfacePrimitive } from "../Polyface";
import { DisplayParams } from "../DisplayParams";
import { ToleranceRatio } from "../Primitives";
import { MeshBuilder } from "./MeshBuilder";
import { Mesh, MeshList } from "./MeshPrimitives";
import { Geometry } from "../geometry/GeometryPrimitives";
import { GeometryList } from "../geometry/GeometryList";
import { StrokesPrimitive } from "../Strokes";
import { Feature, FeatureTable } from "@bentley/imodeljs-common";

export class MeshBuilderMap extends Dictionary<MeshBuilderMap.Key, MeshBuilder> {
  public readonly range: Range3d;
  // @ts-ignore (vertexTolerance unused so far)
  public readonly vertexTolerance: number;
  public readonly facetAreaTolerance: number;
  public readonly tolerance: number;
  public readonly is2d: boolean;
  public readonly features?: Mesh.Features;

  /** if true the order of keys created to store meshBuilders maintain order */
  private readonly _preserveKeyOrder: boolean;
  private _keyOrder: number = 0;

  constructor(tolerance: number, range: Range3d, is2d: boolean, preserveKeyOrder: boolean = false, id?: Id64) {
    super((lhs: MeshBuilderMap.Key, rhs: MeshBuilderMap.Key) => lhs.compare(rhs));
    this.tolerance = tolerance;
    this.vertexTolerance = tolerance * ToleranceRatio.vertex;
    this.facetAreaTolerance = tolerance * ToleranceRatio.facetArea;
    this.range = range;
    this.is2d = is2d;
    this._preserveKeyOrder = preserveKeyOrder;
    if (undefined !== id && id.isValid) {
      const table = new FeatureTable(1);
      this.features = new Mesh.Features(table);
      this.features.add(new Feature(id), 0);
    }
  }

  public static createFromGeometries(geometries: GeometryList, tolerance: number, range: Range3d, is2d: boolean, wantSurfacesOnly: boolean, wantPreserveOrder: boolean, id?: Id64): MeshBuilderMap {
    const map = new MeshBuilderMap(tolerance, range, is2d, wantPreserveOrder, id);

    for (const geom of geometries)
      map.loadGeometry(geom, wantSurfacesOnly);

    return map;
  }

  public toMeshes(): MeshList {
    const meshes = new MeshList(undefined !== this.features ? this.features.table : undefined);
    for (const builder of this._values)
      meshes.push(builder.mesh);

    return meshes;
  }

  /**
   * extract polyfaces and strokes from geometry into MeshBuilder stored in builderMap
   * @param geom Geometry instance to extract polyfaces and strokes from
   * @param wantSurfacesOnly if true prevent strokes from being loaded into builders
   */
  public loadGeometry(geom: Geometry, wantSurfacesOnly: boolean): void {
    this.loadPolyfacePrimitiveList(geom);

    if (!wantSurfacesOnly)
      this.loadStrokePrimitiveList(geom);
  }

  /**
   * extract polyface primitives from geometry in meshBuilder stored in builderMap
   * @param geom Geometry instance to extract polyfaces from
   */
  public loadPolyfacePrimitiveList(geom: Geometry): void {
    const polyfaces = geom.getPolyfaces(this.tolerance);

    if (polyfaces !== undefined)
      for (const polyface of polyfaces)
        this.loadIndexedPolyface(polyface);
  }

  /**
   * extract indexed polyfaces into meshBuilder stored in builderMap
   * @param polyface PolyfacePrimitive to extract indexed polyfaces from
   */
  public loadIndexedPolyface(polyface: PolyfacePrimitive): void {
    const { indexedPolyface, displayParams, isPlanar } = polyface;
    const { pointCount, normalCount } = indexedPolyface;
    const { fillColor, isTextured } = displayParams;
    const textureMapping = displayParams.textureMapping;

    if (pointCount === 0)
      return;

    const builder = this.getBuilder(displayParams, Mesh.PrimitiveType.Mesh, normalCount > 0, isPlanar);
    builder.addFromPolyface(indexedPolyface, { includeParams: isTextured, fillColor: fillColor.tbgr, mappedTexture: textureMapping });
  }

  /**
   * extract stroke primitives from geometry in meshBuilder stored in builderMap
   * @param geom Geometry instance to extract strokes from
   */
  public loadStrokePrimitiveList(geom: Geometry): void {
    const strokes = geom.getStrokes(this.tolerance);

    if (undefined !== strokes)
      for (const stroke of strokes)
        this.loadStrokesPrimitive(stroke);
  }

  /**
   * extract strokes primitive into meshBuilder stored in builderMap
   * @param strokePrimitive StrokesPrimitive instance to extractfrom
   */
  public loadStrokesPrimitive(strokePrimitive: StrokesPrimitive): void {
    const { displayParams, isDisjoint, isPlanar, strokes } = strokePrimitive;

    const type = isDisjoint ? Mesh.PrimitiveType.Point : Mesh.PrimitiveType.Polyline;
    const builder = this.getBuilder(displayParams, type, false, isPlanar);
    builder.addStrokePointLists(strokes, isDisjoint, displayParams.fillColor.tbgr);
  }

  public getBuilder(displayParams: DisplayParams, type: Mesh.PrimitiveType, hasNormals: boolean, isPlanar: boolean): MeshBuilder {
    const { facetAreaTolerance, tolerance, is2d, range } = this;
    const key = this.getKey(displayParams, type, hasNormals, isPlanar);

    return this.getBuilderFromKey(key, { displayParams, type, range, is2d, isPlanar, tolerance, areaTolerance: facetAreaTolerance, features: this.features });
  }

  public getKey(displayParams: DisplayParams, type: Mesh.PrimitiveType, hasNormals: boolean, isPlanar: boolean): MeshBuilderMap.Key {
    const key = new MeshBuilderMap.Key(displayParams, type, hasNormals, isPlanar);

    if (this._preserveKeyOrder)
      key.order = ++this._keyOrder;

    return key;
  }

  /**
   * gets builder associated with key if defined, otherwise creates a new builder and sets that with key
   * @param key MeshBuilderMap.Key to associate with builder
   * @param props MeshBuilder.Props required to create builder if it does not already exist
   * @returns builder reference, changes will update instance stored in builderMap
   */
  public getBuilderFromKey(key: MeshBuilderMap.Key, props: MeshBuilder.Props): MeshBuilder {
    let builder = this.get(key);
    if (undefined === builder) {
      builder = MeshBuilder.create(props);
      this.set(key, builder);
    }
    return builder;
  }
}

export namespace MeshBuilderMap {
  export class Key implements Comparable<Key> {
    public order: number = 0;
    public readonly params: DisplayParams;
    public readonly type: Mesh.PrimitiveType;
    public readonly hasNormals: boolean;
    public readonly isPlanar: boolean;

    constructor(params: DisplayParams, type: Mesh.PrimitiveType, hasNormals: boolean, isPlanar: boolean) {
      this.params = params;
      this.type = type;
      this.hasNormals = hasNormals;
      this.isPlanar = isPlanar;
    }

    public static createFromMesh(mesh: Mesh): Key {
      return new Key(mesh.displayParams, mesh.type, mesh.normals.length !== 0, mesh.isPlanar);
    }

    public compare(rhs: Key): number {
      let diff = compareNumbers(this.order, rhs.order);
      if (0 === diff) {
        diff = compareNumbers(this.type, rhs.type);
        if (0 === diff) {
          diff = compareBooleans(this.isPlanar, rhs.isPlanar);
          if (0 === diff) {
            diff = compareBooleans(this.hasNormals, rhs.hasNormals);
            if (0 === diff) {
              diff = this.params.compareForMerge(rhs.params);
            }
          }
        }
      }

      return diff;
    }

    public equals(rhs: Key): boolean { return 0 === this.compare(rhs); }
  }
}

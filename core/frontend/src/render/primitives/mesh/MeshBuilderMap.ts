/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Comparable, compareNumbers, compareBooleans, Dictionary } from "@bentley/bentleyjs-core";
import { Range3d } from "@bentley/geometry-core";
import { DisplayParams } from "../DisplayParams";
import { ToleranceRatio } from "../Primitives";
import { MeshBuilder } from "./MeshBuilder";
import { Mesh } from "./MeshPrimitives";

export class MeshBuilderMap extends Dictionary<MeshBuilderMap.Key, MeshBuilder> {
  public readonly range: Range3d;
  public readonly vertexTolerance: number;
  public readonly facetAreaTolerance: number;
  public readonly is2d: boolean;
  constructor(tolerance: number, range: Range3d, is2d: boolean) {
    super((lhs: MeshBuilderMap.Key, rhs: MeshBuilderMap.Key) => lhs.compare(rhs));
    this.vertexTolerance = tolerance * ToleranceRatio.vertex;
    this.facetAreaTolerance = tolerance * ToleranceRatio.facetArea;
    this.range = range;
    this.is2d = is2d;
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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

import { VariableType } from "./ShaderBuilder";
import { TechniqueId } from "./TechniqueId";

/**
 * Describes the details of an attribute associated with an attribute name.
 * @internal
 */
export interface AttributeDetails {
  /** Index used by GPU for binding attribute location for the associated attribute name. */
  location: number;
  /** What type of variable used for binding the attribute location. */
  type: VariableType;
}

type AttributeInfo = [string, number, VariableType];

class AttributeMapEntry {
  public readonly uninstanced = new Map<string, AttributeDetails>();
  public readonly instanced = new Map<string, AttributeDetails>();

  public constructor(attributes: AttributeInfo[]) {
    for (const attr of attributes) {
      const detail = { location: attr[1], type: attr[2] };
      this.uninstanced.set(attr[0], detail);
      this.instanced.set(attr[0], detail);
    }

    const instanceAttrs: Array<[string, VariableType]> = [
      ["a_instanceMatrixRow0", VariableType.Vec4],
      ["a_instanceMatrixRow1", VariableType.Vec4],
      ["a_instanceMatrixRow2", VariableType.Vec4],
      ["a_instanceOverrides", VariableType.Vec4],
      ["a_instanceRgba", VariableType.Vec4],
      ["a_featureId", VariableType.Vec3],
    ];

    let location = attributes.length;
    for (const attr of instanceAttrs) {
      this.instanced.set(attr[0], { location, type: attr[1] });
      ++location;
    }
  }
}

/**
 * A class with static methods which provide access to a global mapping between techniques and attribute details (location and variable type).
 * These details are used when constructing shaders and when setting up buffers through implementations of the BuffersContainer abstract class.
 * @internal
 */
export class AttributeMap {
  private readonly _attrMaps: Map<TechniqueId | undefined, AttributeMapEntry>;

  public constructor() {
    const posOnly = new AttributeMapEntry([["a_pos", 0, VariableType.Vec3]]);
    const skySphere = new AttributeMapEntry([
      ["a_pos", 0, VariableType.Vec3],
      ["a_worldPos", 1, VariableType.Vec3],
    ]);
    const polyline = new AttributeMapEntry([
      ["a_pos", 0, VariableType.Vec3],
      ["a_prevIndex", 1, VariableType.Vec3],
      ["a_nextIndex", 2, VariableType.Vec3],
      ["a_param", 3, VariableType.Float],
    ]);
    const edge = new AttributeMapEntry([
      ["a_pos", 0, VariableType.Vec3],
      ["a_endPointAndQuadIndices", 1, VariableType.Vec4],
    ]);
    const silhouette = new AttributeMapEntry([
      ["a_pos", 0, VariableType.Vec3],
      ["a_endPointAndQuadIndices", 1, VariableType.Vec4],
      ["a_normals", 2, VariableType.Vec4],
    ]);
    const pointCloud = new AttributeMapEntry([
      ["a_pos", 0, VariableType.Vec3],
      ["a_color", 1, VariableType.Vec3],
    ]);
    const terrainMesh = new AttributeMapEntry([
      ["a_pos", 0, VariableType.Vec3],
      ["a_norm", 1, VariableType.Vec2],
      ["a_uvParam", 2, VariableType.Vec2],
    ]);
    const screenPoints = new AttributeMapEntry([
      ["a_pos", 0, VariableType.Vec2],
    ]);

    this._attrMaps = new Map<TechniqueId | undefined, AttributeMapEntry>([
      [undefined, posOnly],
      [TechniqueId.SkySphereGradient, skySphere],
      [TechniqueId.SkySphereTexture, skySphere],
      [TechniqueId.Polyline, polyline],
      [TechniqueId.Edge, edge],
      [TechniqueId.SilhouetteEdge, silhouette],
      [TechniqueId.PointCloud, pointCloud],
      [TechniqueId.VolClassCopyZ, screenPoints],
      [TechniqueId.TerrainMesh, terrainMesh],
    ]);
  }

  public static findAttributeMap(techniqueId: TechniqueId | undefined, instanced: boolean): Map<string, AttributeDetails> {
    let entry = attributeMap._attrMaps.get(techniqueId);
    if (undefined === entry) {
      entry = attributeMap._attrMaps.get(undefined)!;
      attributeMap._attrMaps.set(techniqueId, entry);
    }

    return instanced ? entry.instanced : entry.uninstanced;
  }

  public static findAttribute(attributeName: string, techniqueId: TechniqueId | undefined, instanced: boolean): AttributeDetails | undefined {
    return AttributeMap.findAttributeMap(techniqueId, instanced).get(attributeName);
  }
}

const attributeMap = new AttributeMap();

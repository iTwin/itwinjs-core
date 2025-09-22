/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, Color, PointPrimitive, PointPrimitiveCollection } from "cesium";
import { IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";


/** Converts iTwin.js point decorations to Cesium PointPrimitives */
export class PointPrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType: 'pointstring' | 'pointstring2d';

  public constructor(primitiveType: 'pointstring' | 'pointstring2d' = 'pointstring') {
    super();
    this.primitiveType = primitiveType;
  }


  protected override getCollection(scene: CesiumScene): PointPrimitiveCollection {
    return scene.pointCollection;
  }

  protected override createPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    _index: number,
    collection: PointPrimitiveCollection,
    iModel?: IModelConnection,
    originalData?: unknown,
    type?: string
  ): PointPrimitive | null {
    return this.createPointPrimitiveFromGraphic(graphic, primitiveId, _index, collection, iModel, originalData, type);
  }

  protected override getPrimitiveTypeName(): string {
    return 'decoration';
  }

  protected override getDepthOptions(decorationType: string): Record<string, unknown> {
    const baseOptions = super.getDepthOptions(decorationType);
    
    const isOverlay = decorationType === 'worldOverlay' || decorationType === 'viewOverlay';
    if (isOverlay) {
      return {
        ...baseOptions,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      };
    }
    return baseOptions;
  }

  private createPointPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    pointId: string,
    _index: number,
    pointCollection: PointPrimitiveCollection,
    iModel?: IModelConnection,
    originalPointStrings?: unknown,
    type?: string
  ): PointPrimitive | null {
    if (!graphic)
      return null;

    if (graphic.geometries && graphic.geometryType)
      return this.createPointFromGeometry(graphic.geometries, graphic.geometryType, pointId, _index, pointCollection, iModel, originalPointStrings, type, graphic);

    return null;
  }

  private createPointFromGeometry(
    geometries: unknown[],
    geometryType: string,
    pointId: string,
    _index: number,
    pointCollection: PointPrimitiveCollection,
    iModel?: IModelConnection,
    originalPointStrings?: unknown,
    type?: string,
    graphic?: RenderGraphicWithCoordinates
  ): PointPrimitive | null {
    if (!geometries || !geometryType || !pointCollection)
      return null;

    let entityPosition: Cartesian3 | undefined;
    let realSpatialPoint: Point3d | null = null;

    if (this.primitiveType === 'pointstring2d') {
      const entry = this.findEntryByType(graphic, 'pointstring2d');
      const firstPoint = entry?.points[0];
      if (firstPoint)
        realSpatialPoint = Point3d.create(firstPoint.x, firstPoint.y, entry.zDepth);
    }

    if (!realSpatialPoint && Array.isArray(originalPointStrings) && originalPointStrings.length > 0) {
      const firstPointString = originalPointStrings[0] as Array<{ x: number; y: number; z?: number }>;
      if (firstPointString && firstPointString.length > 0) {
        const candidate = firstPointString[0];
        const z = typeof candidate.z === 'number' ? candidate.z : 0;
        realSpatialPoint = Point3d.create(candidate.x, candidate.y, z);
      }
    }

    if (!realSpatialPoint && geometries && geometries.length > 0) {
      const geometry = geometries[0];
      const firstCoord = (geometry as { coordinateData?: Array<{ x: number; y: number; z: number }> })?.coordinateData?.[0];
      if (firstCoord)
        realSpatialPoint = new Point3d(firstCoord.x, firstCoord.y, firstCoord.z);
    }

    if (realSpatialPoint) {
      const positions = this.convertPointsToCartesian3([realSpatialPoint], iModel);
      entityPosition = positions[0];
    }

    if (!entityPosition)
      return null;

    const color = this.extractLineColorFromGraphic(graphic, this.primitiveType);
    if (!color)
      return null;
    switch (geometryType) {
      case 'point-string':
      default:
        return pointCollection.add({
          id: pointId,
          position: entityPosition,
          pixelSize: 20,
          color,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
          ...this.getDepthOptions(type || 'world'),
        });
    }
  }
}

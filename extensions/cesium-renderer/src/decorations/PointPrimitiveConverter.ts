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
  protected readonly primitiveType = 'pointstring';


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
    return this.createPointPrimitiveFromGraphic(graphic, primitiveId, _index, collection, iModel, originalData as Point3d[][] | undefined, type);
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
    originalPointStrings?: Point3d[][],
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
    originalPointStrings?: Point3d[][],
    type?: string,
    graphic?: RenderGraphicWithCoordinates
  ): PointPrimitive | null {
    if (!geometries || !geometryType || !pointCollection)
      return null;

    let entityPosition: Cartesian3 | undefined;
    let realSpatialPoint: Point3d | null = null;

    if (originalPointStrings && originalPointStrings.length > 0) {
      const firstPointString = originalPointStrings[0];
      if (firstPointString && firstPointString.length > 0)
        realSpatialPoint = firstPointString[0];
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

    const color = this.extractLineColorFromGraphic(graphic, 'pointstring');
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

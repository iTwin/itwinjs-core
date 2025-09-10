/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, Color, PointPrimitive, PointPrimitiveCollection } from "cesium";
import { GraphicList, IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumScene } from "./Scene";
import { PrimitiveConverter } from "./PrimitiveConverter";

/** Converts iTwin.js point decorations to Cesium PointPrimitives */
export class PointPrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'pointstring';


  protected override getCollection(scene: CesiumScene): any {
    return scene.pointCollection;
  }


  protected override createPrimitiveFromGraphic(
    graphic: any, 
    primitiveId: string, 
    index: number, 
    collection: any, 
    iModel?: IModelConnection, 
    originalData?: Point3d[][], 
    type?: string
  ): any {
    return this.createPointPrimitiveFromGraphic(graphic, primitiveId, index, collection, iModel, originalData, type);
  }

  protected override getPrimitiveTypeName(): string {
    return 'decoration';
  }

  protected override getDepthOptions(decorationType: string): any {
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
    graphic: any,
    pointId: string,
    index: number,
    pointCollection: PointPrimitiveCollection,
    iModel?: IModelConnection,
    originalPointStrings?: Point3d[][],
    type?: string
  ): PointPrimitive | null {
    if (!graphic) {
      console.warn(`Null graphic for ${pointId}`);
      return null;
    }

    try {
      if (graphic.geometries && graphic.geometryType) {
        return this.createPointFromGeometry(graphic.geometries, graphic.geometryType, pointId, index, pointCollection, iModel, originalPointStrings, type);
      }

      // Fallback primitive
      const fallbackPosition = this.getFallbackPosition(index);
      
      return pointCollection.add({
        id: pointId,
        position: fallbackPosition,
        pixelSize: 15,
        color: Color.LIME,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        ...this.getDepthOptions(type || 'world'),
      });

    } catch (error) {
      console.error(`Error in createPointPrimitiveFromGraphic for ${pointId}:`, error);
      return null;
    }
  }

  private createPointFromGeometry(
    geometries: any[],
    geometryType: string,
    pointId: string,
    index: number,
    pointCollection: PointPrimitiveCollection,
    iModel?: IModelConnection,
    originalPointStrings?: Point3d[][],
    type?: string
  ): PointPrimitive | null {
    if (!geometries || !geometryType || !pointCollection) {
      return null;
    }

    try {
      let entityPosition: Cartesian3;
      let realSpatialPoint: Point3d | null = null;
      
      // Extract real Point3d coordinates
      if (originalPointStrings && originalPointStrings.length > 0) {
        const firstPointString = originalPointStrings[0];
        if (firstPointString && firstPointString.length > 0) {
          realSpatialPoint = firstPointString[0];
        }
      }
      
      if (!realSpatialPoint && geometries && geometries.length > 0) {
        const geometry = geometries[0];
        if (geometry && geometry.coordinateData) {
          const firstCoord = geometry.coordinateData[0];
          if (firstCoord) {
            realSpatialPoint = new Point3d(firstCoord.x, firstCoord.y, firstCoord.z);
          }
        }
      }

      // Convert coordinates to Cesium space
      if (realSpatialPoint) {
        const positions = this.convertPointsToCartesian3([realSpatialPoint], iModel);
        entityPosition = positions.length > 0 ? positions[0] : this.getFallbackPosition(index);
      } else {
        entityPosition = this.getFallbackPosition(index);
      }

      switch (geometryType) {
        case 'point-string':
        default:
          return pointCollection.add({
            id: pointId,
            position: entityPosition,
            pixelSize: 20,
            color: Color.BLUE,
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            ...this.getDepthOptions(type || 'world'),
          });
      }
    } catch (error) {
      console.error(`Error in createPointFromGeometry for ${pointId}:`, error);
      return null;
    }
  }

  private getFallbackPosition(index: number): Cartesian3 {
    const baseDistance = 2000000;
    const offset = index * 500000;
    
    switch (index % 3) {
      case 0: return new Cartesian3(baseDistance + offset, 0, 0);
      case 1: return new Cartesian3(0, baseDistance + offset, 0);  
      case 2: return new Cartesian3(0, 0, baseDistance + offset);
      default: return new Cartesian3(baseDistance, baseDistance, baseDistance);
    }
  }

}
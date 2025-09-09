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
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter";
import { CesiumScene } from "./Scene";
import { PrimitiveConverter } from "./PrimitiveConverter";

/** Converts iTwin.js point decorations to Cesium PointPrimitives */
export class PointPrimitiveConverter extends PrimitiveConverter {

  public convertDecorations(graphics: GraphicList, type: string, scene: CesiumScene, iModel?: IModelConnection): void {
    if (!graphics || graphics.length === 0) return;
    
    const pointCollection = scene.pointCollection;
    if (!pointCollection) return;

    graphics.forEach((graphic, index) => {
      try {
        const pointId = `${type}_decoration_${index}`;
        const originalPointStrings = (graphic as any)._originalPointStrings as Point3d[][] | undefined;
        
        this.createPointPrimitiveFromGraphic(graphic, pointId, index, pointCollection, iModel, originalPointStrings);
      } catch (error) {
        console.error(`Error creating ${type} point primitive:`, error);
      }
    });
  }

  public clearDecorations(scene: CesiumScene): void {
    const pointCollection = scene.pointCollection;
    if (!pointCollection) return;

    const pointsToRemove: PointPrimitive[] = [];
    const pointCount = pointCollection.length;

    for (let i = 0; i < pointCount; i++) {
      const point = pointCollection.get(i);
      if (point.id && typeof point.id === 'string' && this.isDecorationPoint(point.id)) {
        pointsToRemove.push(point);
      }
    }

    pointsToRemove.forEach(point => pointCollection.remove(point));
  }

  private isDecorationPoint(id: string): boolean {
    return id.startsWith('world_decoration_') ||
           id.startsWith('normal_decoration_') ||
           id.startsWith('worldOverlay_decoration_') ||
           id.startsWith('viewOverlay_decoration_');
  }

  private createPointPrimitiveFromGraphic(
    graphic: any,
    pointId: string,
    index: number,
    pointCollection: PointPrimitiveCollection,
    iModel?: IModelConnection,
    originalPointStrings?: Point3d[][]
  ): PointPrimitive | null {
    if (!graphic) {
      console.warn(`Null graphic for ${pointId}`);
      return null;
    }

    try {
      if (graphic.geometries && graphic.geometryType) {
        return this.createPointFromGeometry(graphic.geometries, graphic.geometryType, pointId, index, pointCollection, iModel, originalPointStrings);
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
    originalPointStrings?: Point3d[][]
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
      if (realSpatialPoint && iModel) {
        const converter = new CesiumCoordinateConverter(iModel);
        entityPosition = converter.spatialToCesiumCartesian3(realSpatialPoint);
      } else if (iModel) {
        const converter = new CesiumCoordinateConverter(iModel);
        const fallbackPoint = new Point3d(0, 0, 0);
        entityPosition = converter.spatialToCesiumCartesian3(fallbackPoint);
      } else {
        entityPosition = this.getFallbackPosition(index);
      }

      const entityColor = this.getColorForIndex(index);

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

  private getColorForIndex(index: number): Color {
    const colors = [Color.BLUE, Color.RED, Color.GREEN, Color.YELLOW, Color.PURPLE, Color.ORANGE];
    return colors[index % colors.length];
  }
}
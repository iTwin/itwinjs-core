/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, Color, PointPrimitive, PointPrimitiveCollection } from "cesium";
import { GraphicList, IModelConnection, GraphicPrimitive } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter";
import { CesiumScene } from "./Scene";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter";

/** Converts iTwin.js point decorations to Cesium PointPrimitives */
export class PointPrimitiveConverter extends PrimitiveConverter {

  public convertDecorations(graphics: GraphicList, type: string, scene: CesiumScene, iModel?: IModelConnection): void {
    if (!graphics || graphics.length === 0) return;
    
    const pointCollection = scene.pointCollection;
    if (!pointCollection) return;

    const pointStringGraphics = graphics.filter(graphic => {
      const graphicWithCoords = graphic as RenderGraphicWithCoordinates;
      const coordinateData = graphicWithCoords._coordinateData;
      const hasPointStringData = coordinateData && coordinateData.some((entry: GraphicPrimitive) => entry.type === 'pointstring');
      const geometryType = graphicWithCoords.geometryType;
      
      return hasPointStringData || geometryType === 'pointstring';
    });

    pointStringGraphics.forEach((graphic, index) => {
      try {
        const pointId = `${type}_decoration_${index}`;
        const graphicWithCoords = graphic as RenderGraphicWithCoordinates;
        const coordinateData = graphicWithCoords._coordinateData;
        const originalPointStrings = this.extractPointStringData(coordinateData);
        
        this.createPointPrimitiveFromGraphic(graphic, pointId, index, pointCollection, iModel, originalPointStrings, type);
      } catch (error) {
        console.error(`Error creating ${type} point primitive:`, error);
      }
    });
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
        disableDepthTestDistance: this.getDepthTestDistance(type || 'world'),
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
            disableDepthTestDistance: this.getDepthTestDistance(type || 'world'),
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

  private extractPointStringData(coordinateData: GraphicPrimitive[] | undefined): Point3d[][] | undefined {
    if (!coordinateData || !Array.isArray(coordinateData)) return undefined;
    
    const pointStringEntries = coordinateData.filter((entry: GraphicPrimitive) => entry.type === 'pointstring');
    return pointStringEntries.map((entry: any) => entry.points);
  }
}
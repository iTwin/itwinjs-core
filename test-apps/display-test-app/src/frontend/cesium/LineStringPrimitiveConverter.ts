/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, Color, Material, Polyline, PolylineCollection } from "cesium";
import { GraphicList, IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter";
import { CesiumScene } from "./Scene";
import { PrimitiveConverter } from "./PrimitiveConverter";

/** Converts iTwin.js LineString decorations to Cesium Polylines */
export class LineStringPrimitiveConverter extends PrimitiveConverter {

  public convertDecorations(graphics: GraphicList, type: string, scene: CesiumScene, iModel?: IModelConnection): void {
    if (!graphics || graphics.length === 0) return;
    
    const polylineCollection = scene.polylineCollection;
    if (!polylineCollection) return;
    
    // Filter graphics to only include those with line-string geometries
    const lineStringGraphics = graphics.filter(graphic => {
      const coordinateData = (graphic as any)._coordinateData;
      const hasLineStringData = coordinateData && coordinateData.some((entry: any) => entry.type === 'line-string');
      const geometryType = (graphic as any).geometryType;
      
      return hasLineStringData || geometryType === 'line-string';
    });

    if (lineStringGraphics.length === 0) {
      return;
    }
    
    lineStringGraphics.forEach((graphic, index) => {
      try {
        const lineId = `${type}_linestring_${index}`;
        const coordinateData = (graphic as any)._coordinateData;
        const originalLineStrings = this.extractLineStringData(coordinateData);
        
        this.createPolylineFromGraphic(graphic, lineId, index, polylineCollection, iModel, originalLineStrings, type);
      } catch (error) {
        console.error(`Error creating ${type} line primitive:`, error);
      }
    });
  }



  private createPolylineFromGraphic(
    graphic: any,
    lineId: string,
    index: number,
    polylineCollection: PolylineCollection,
    iModel?: IModelConnection,
    originalLineStrings?: Point3d[][],
    type?: string
  ): Polyline | null {
    if (!graphic) {
      console.warn(`Null graphic for ${lineId}`);
      return null;
    }

    try {
      if (graphic.geometries && graphic.geometryType) {
        return this.createPolylineFromGeometry(graphic.geometries, graphic.geometryType, lineId, index, polylineCollection, iModel, originalLineStrings, type, graphic);
      }

      return null; // No valid geometry found

    } catch (error) {
      console.error(`Error in createPolylineFromGraphic for ${lineId}:`, error);
      return null;
    }
  }

  private createPolylineFromGeometry(
    geometries: any[],
    geometryType: string,
    lineId: string,
    _index: number,
    polylineCollection: PolylineCollection,
    iModel?: IModelConnection,
    originalLineStrings?: Point3d[][],
    type?: string,
    _graphic?: any
  ): Polyline | null {
    if (!geometries || !geometryType || !polylineCollection) {
      return null;
    }

    try {
      let positions: Cartesian3[] = [];
      
      // Extract real Point3d coordinates and convert to Cartesian3
      if (originalLineStrings && originalLineStrings.length > 0) {
        const firstLineString = originalLineStrings[0];
        if (firstLineString && firstLineString.length > 0) {
          positions = this.convertPointsToCartesian3(firstLineString, iModel);
        }
      }
      
      if (positions.length === 0 && geometries && geometries.length > 0) {
        const geometry = geometries[0];
        if (geometry && geometry.coordinateData && geometry.coordinateData.length > 0) {
          const points = geometry.coordinateData.map((coord: any) => 
            new Point3d(coord.x, coord.y, coord.z)
          );
          positions = this.convertPointsToCartesian3(points, iModel);
        }
      }

      switch (geometryType) {
        case 'line-string':
        default:
          return polylineCollection.add({
            id: lineId,
            positions,
            width: 2,
            material: Material.fromType(Material.ColorType, { color: Color.PURPLE }),
            ...this.getPolylineDepthOptions(type || 'world'),
          });
      }
    } catch (error) {
      console.error(`Error in createPolylineFromGeometry for ${lineId}:`, error);
      return null;
    }
  }

  private convertPointsToCartesian3(points: Point3d[], iModel?: IModelConnection): Cartesian3[] {
    if (!points || points.length === 0) return [];

    if (iModel) {
      const converter = new CesiumCoordinateConverter(iModel);
      return points.map(point => converter.spatialToCesiumCartesian3(point));
    } else {
      // Fallback: convert directly to Cartesian3 (for testing)
      return points.map(point => new Cartesian3(point.x, point.y, point.z));
    }
  }


  private getPolylineDepthOptions(type: string): any {
    const depthTestDistance = this.getDepthTestDistance(type);
    
    // For overlay types
    if (depthTestDistance === Number.POSITIVE_INFINITY) {
      return {
        clampToGround: false,
        distanceDisplayCondition: undefined, // Always visible regardless of distance
      };
    }
    
    return {}; // Normal depth testing
  }


  private extractLineStringData(coordinateData: any): Point3d[][] | undefined {
    if (!coordinateData || !Array.isArray(coordinateData)) return undefined;
    
    const lineStringEntries = coordinateData.filter(entry => entry.type === 'line-string');
    return lineStringEntries.map(entry => entry.data);
  }
}
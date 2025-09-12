/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, Color, Material, Polyline, PolylineCollection } from "cesium";
import { IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumScene } from "./Scene";
import { PrimitiveConverter } from "./PrimitiveConverter";

/** Converts iTwin.js LineString decorations to Cesium Polylines */
export class LineStringPrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'linestring';


  protected override getCollection(scene: CesiumScene): any {
    return scene.polylineCollection;
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
    return this.createPolylineFromGraphic(graphic, primitiveId, index, collection, iModel, originalData, type);
  }

  protected override getPrimitiveTypeName(): string {
    return 'linestring';
  }

  protected override shouldSkipEmptyGraphics(): boolean {
    return true;
  }

  protected override getDepthOptions(decorationType: string): any {
    const baseOptions = super.getDepthOptions(decorationType);
    
    const isOverlay = decorationType === 'worldOverlay' || decorationType === 'viewOverlay';
    if (isOverlay) {
      return {
        ...baseOptions,
        clampToGround: false,
        distanceDisplayCondition: undefined,
      };
    }
    return baseOptions;
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
            ...this.getDepthOptions(type || 'world'),
          });
      }
    } catch (error) {
      console.error(`Error in createPolylineFromGeometry for ${lineId}:`, error);
      return null;
    }
  }

}
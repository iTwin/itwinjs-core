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
import { CesiumScene } from "./Scene";
import { PrimitiveConverter } from "./PrimitiveConverter";

export class ShapePrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'shape';


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
    return 'shape';
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
        heightReference: 0,
        extrudedHeightReference: 0,
      };
    }
    return baseOptions;
  }

  private createPolylineFromGraphic(
    graphic: any,
    shapeId: string,
    index: number,
    polylineCollection: any,
    iModel?: IModelConnection,
    originalShapes?: Point3d[][],
    type?: string
  ): Polyline | null {
    if (!graphic) {
      console.warn(`Null graphic for ${shapeId}`);
      return null;
    }

    try {
      if (graphic.geometries && graphic.geometryType) {
        return this.createPolylineFromGeometry(graphic.geometries, graphic.geometryType, shapeId, index, polylineCollection, iModel, originalShapes, type, graphic);
      }

      return null;

    } catch (error) {
      console.error(`Error in createPolylineFromGraphic for ${shapeId}:`, error);
      return null;
    }
  }

  private createPolylineFromGeometry(
    geometries: any[],
    geometryType: string,
    shapeId: string,
    _index: number,
    polylineCollection: any,
    iModel?: IModelConnection,
    originalShapes?: Point3d[][],
    type?: string,
    _graphic?: any
  ): Polyline | null {
    if (!geometries || !geometryType || !polylineCollection) {
      return null;
    }

    try {
      let positions: Cartesian3[] = [];
      
      if (originalShapes && originalShapes.length > 0) {
        const firstShape = originalShapes[0];
        if (firstShape && firstShape.length > 0) {
          positions = this.convertPointsToCartesian3(firstShape, iModel);
          // Ensure the shape is closed by adding the first point at the end if needed
          if (positions.length > 2) {
            const firstPos = positions[0];
            const lastPos = positions[positions.length - 1];
            if (!Cartesian3.equals(firstPos, lastPos)) {
              positions.push(firstPos);
            }
          }
        }
      }
      
      if (positions.length === 0 && geometries && geometries.length > 0) {
        const geometry = geometries[0];
        if (geometry && geometry.coordinateData && geometry.coordinateData.length > 0) {
          const points = geometry.coordinateData.map((coord: any) => 
            new Point3d(coord.x, coord.y, coord.z)
          );
          positions = this.convertPointsToCartesian3(points, iModel);
          // Ensure the shape is closed
          if (positions.length > 2) {
            const firstPos = positions[0];
            const lastPos = positions[positions.length - 1];
            if (!Cartesian3.equals(firstPos, lastPos)) {
              positions.push(firstPos);
            }
          }
        }
      }

      if (positions.length < 3) {
        console.warn(`Shape requires at least 3 points, got ${positions.length}`);
        return null;
      }

      switch (geometryType) {
        case 'shape':
        default:
          return polylineCollection.add({
            id: shapeId,
            positions,
            width: 3,
            material: Material.fromType(Material.ColorType, { color: Color.ORANGE }),
            ...this.getDepthOptions(type || 'world'),
          });
      }
    } catch (error) {
      console.error(`Error in createPolylineFromGeometry for ${shapeId}:`, error);
      return null;
    }
  }

}
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, Material, Polyline, PolylineCollection } from "cesium";
import { IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
 
/** Converts iTwin.js LineString decorations to Cesium Polylines */
export class LineStringPrimitiveConverter extends PrimitiveConverter {
  protected readonly primitiveType = 'linestring';


  protected override getCollection(scene: CesiumScene): PolylineCollection {
    return scene.polylineCollection;
  }

  protected override createPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    index: number,
    collection: PolylineCollection,
    iModel?: IModelConnection,
    originalData?: unknown,
    type?: string
  ): Polyline | null {
    return this.createPolylineFromGraphic(graphic, primitiveId, index, collection, iModel, originalData as Point3d[][] | undefined, type);
  }

  protected override getPrimitiveTypeName(): string {
    return 'linestring';
  }

  protected override shouldSkipEmptyGraphics(): boolean {
    return true;
  }

  protected override getDepthOptions(decorationType: string): Record<string, unknown> {
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
    graphic: RenderGraphicWithCoordinates,
    lineId: string,
    index: number,
    polylineCollection: PolylineCollection,
    iModel?: IModelConnection,
    originalLineStrings?: Point3d[][],
    type?: string
  ): Polyline | null {
    if (!graphic) {
      return null;
    }

    if (graphic.geometries && graphic.geometryType) {
      return this.createPolylineFromGeometry(graphic.geometries, graphic.geometryType, lineId, index, polylineCollection, iModel, originalLineStrings, type, graphic);
    }
    return null;
  }

  private createPolylineFromGeometry(
    geometries: unknown[],
    geometryType: string,
    lineId: string,
    _index: number,
    polylineCollection: PolylineCollection,
    iModel?: IModelConnection,
    originalLineStrings?: Point3d[][],
    type?: string,
    graphic?: RenderGraphicWithCoordinates
  ): Polyline | null {
    if (!geometries || !geometryType || !polylineCollection) {
      return null;
    }

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
        interface Coord { x: number; y: number; z: number }
        const hasCoords = (g: unknown): g is { coordinateData: Coord[] } =>
          typeof g === 'object' && g !== null && ('coordinateData' in g);
        if (hasCoords(geometry) && Array.isArray(geometry.coordinateData) && geometry.coordinateData.length > 0) {
          const points = geometry.coordinateData.map((coord) => new Point3d(coord.x, coord.y, coord.z));
          positions = this.convertPointsToCartesian3(points, iModel);
        }
      }

      const color = this.extractLineColorFromGraphic(graphic, 'linestring');
      if (!color)
        return null;
      switch (geometryType) {
        case 'line-string':
        default:
          return polylineCollection.add({
            id: lineId,
            positions,
            width: 2,
            material: Material.fromType(Material.ColorType, { color }),
            ...this.getDepthOptions(type || 'world'),
          });
      }
  }
}

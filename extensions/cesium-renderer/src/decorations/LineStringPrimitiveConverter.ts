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
  protected readonly primitiveType: 'linestring' | 'linestring2d';

  public constructor(primitiveType: 'linestring' | 'linestring2d' = 'linestring') {
    super();
    this.primitiveType = primitiveType;
  }


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
    return this.createPolylineFromGraphic(graphic, primitiveId, index, collection, iModel, originalData, type);
  }

  protected override getPrimitiveTypeName(): string {
    return this.primitiveType;
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
    originalLineStrings?: unknown,
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
    originalLineStrings?: unknown,
    type?: string,
    graphic?: RenderGraphicWithCoordinates
  ): Polyline | null {
    if (!geometries || !geometryType || !polylineCollection) {
      return null;
    }

    let positions: Cartesian3[] = [];

    if (this.primitiveType === 'linestring2d') {
      const entry = this.findEntryByType(graphic, 'linestring2d');
      if (entry && entry.points.length > 0) {
        const asPoints = entry.points.map((pt) => Point3d.create(pt.x, pt.y, entry.zDepth));
        positions = this.convertPointsToCartesian3(asPoints, iModel);
      }
    }

    if (positions.length === 0 && Array.isArray(originalLineStrings) && originalLineStrings.length > 0) {
      const firstLineString = originalLineStrings[0] as Array<{ x: number; y: number; z?: number }>;
      if (firstLineString && firstLineString.length > 0) {
        const pts = firstLineString.map((coord) => Point3d.create(coord.x, coord.y, typeof coord.z === 'number' ? coord.z : 0));
        positions = this.convertPointsToCartesian3(pts, iModel);
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

    const color = this.extractLineColorFromGraphic(graphic, this.primitiveType);
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

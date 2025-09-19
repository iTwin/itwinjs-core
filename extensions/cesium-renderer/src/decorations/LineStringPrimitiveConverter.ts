/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, Color, Material, Polyline, PolylineCollection } from "cesium";
import { ColorDef } from "@itwin/core-common";
import { IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
import { DecorationPrimitiveEntry } from "./DecorationTypes.js";

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

      const color = this.extractColorFromGraphic(graphic);
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

  private extractColorFromGraphic(graphic?: RenderGraphicWithCoordinates): Color | undefined {
    try {
      // Prefer symbology captured in coordinateData entry
      const coordData = graphic?._coordinateData;
      const isLine = (e: DecorationPrimitiveEntry): e is import('./DecorationTypes.js').LineStringEntry => e.type === 'linestring';
      const entry = coordData?.find((e): e is import('./DecorationTypes.js').LineStringEntry => isLine(e) && !!e.symbology?.lineColor);
      const colorDefFromEntry = entry?.symbology?.lineColor;
      if (colorDefFromEntry) {
        const c1 = colorDefFromEntry.colors;
        const alpha = 255 - (c1.t ?? 0);
        return Color.fromBytes(c1.r, c1.g, c1.b, alpha);
      }

      // Fallback to graphic.symbology if present
      interface HasSymbology { symbology?: { color?: ColorDef } }
      const hasSymbology = (g: unknown): g is HasSymbology => typeof g === 'object' && g !== null && ('symbology' in g);
      const symbology = hasSymbology(graphic) ? graphic.symbology : undefined;
      const colorDef = symbology?.color;
      if (colorDef) {
        const c = colorDef.colors;
        const alpha = 255 - (c.t ?? 0);
        return Color.fromBytes(c.r, c.g, c.b, alpha);
      }
    } catch {
      // ignore
    }
    return undefined;
  }

}

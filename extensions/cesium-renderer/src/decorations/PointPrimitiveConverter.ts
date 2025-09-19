/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Cartesian3, Color, PointPrimitive, PointPrimitiveCollection } from "cesium";
import { ColorDef } from "@itwin/core-common";
import { GraphicList, IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
import { DecorationPrimitiveEntry } from "./DecorationTypes.js";

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

    const color = this.extractColorFromGraphic(graphic);
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

  private extractColorFromGraphic(graphic?: RenderGraphicWithCoordinates): Color | undefined {
    // Prefer symbology captured in coordinateData entry
    const coordData = graphic?._coordinateData;
    const isPoint = (e: DecorationPrimitiveEntry): e is import('./DecorationTypes.js').PointStringEntry => e.type === 'pointstring';
    const entry = coordData?.find((e): e is import('./DecorationTypes.js').PointStringEntry => isPoint(e) && !!e.symbology?.lineColor);
    const colorDefFromEntry = entry?.symbology?.lineColor;
    if (colorDefFromEntry) {
      const c1 = colorDefFromEntry.colors;
      const alpha = 255 - (c1.t ?? 0);
      return Color.fromBytes(c1.r, c1.g, c1.b, alpha);
    }

    interface HasSymbology { symbology?: { color?: ColorDef } }
    const hasSymbology = (g: unknown): g is HasSymbology => typeof g === 'object' && g !== null && ('symbology' in g);
    const symbology = hasSymbology(graphic) ? graphic.symbology : undefined;
    const colorDef = symbology?.color;
    if (colorDef) {
      const c = colorDef.colors;
      const alpha = 255 - (c.t ?? 0);
      return Color.fromBytes(c.r, c.g, c.b, alpha);
    }

    return undefined;
  }

  // Removed fallback position helper per request

}

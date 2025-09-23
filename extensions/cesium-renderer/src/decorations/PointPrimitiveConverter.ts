/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartesian3, Color, PointPrimitive, PointPrimitiveCollection } from "cesium";
import { IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumScene } from "../CesiumScene.js";
import { PrimitiveConverter, RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";
import type { DecorationPrimitiveEntry, PointString2dEntry, PointStringEntry } from "./DecorationTypes.js";

interface PointStringCoordinate {
  x: number;
  y: number;
  z?: number;
}
type PointStringCoordinates = PointStringCoordinate[];

/** Converts iTwin.js point decorations to Cesium PointPrimitives */
export class PointPrimitiveConverter extends PrimitiveConverter<PointStringCoordinates[]> {
  protected readonly primitiveType: 'pointstring' | 'pointstring2d';

  public constructor(primitiveType: 'pointstring' | 'pointstring2d' = 'pointstring') {
    super();
    this.primitiveType = primitiveType;
  }

  protected override getCollection(scene: CesiumScene): PointPrimitiveCollection {
    return scene.pointCollection;
  }

  protected override extractPrimitiveData(
    coordinateData: DecorationPrimitiveEntry[] | undefined,
    primitiveType: string
  ): PointStringCoordinates[] | undefined {
    if (!coordinateData)
      return undefined;

    const matches = coordinateData.filter((entry): entry is PointStringEntry | PointString2dEntry => entry.type === primitiveType);
    if (matches.length === 0)
      return undefined;

    return matches.map(entry => {
      if (entry.type === 'pointstring') {
        return entry.points.map(pt => ({ x: pt.x, y: pt.y, z: pt.z }));
      }

      return entry.points.map(pt => ({ x: pt.x, y: pt.y, z: entry.zDepth }));
    });
  }

  protected override createPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    _index: number,
    collection: PointPrimitiveCollection,
    iModel?: IModelConnection,
    originalData?: PointStringCoordinates[],
    type?: string
  ): PointPrimitive | undefined {
    return this.createPointPrimitiveFromGraphic(graphic, primitiveId, _index, collection, iModel, originalData, type);
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
    originalPointStrings?: PointStringCoordinates[],
    type?: string
  ): PointPrimitive | undefined {
    if (!graphic?.geometries || !graphic.geometryType)
      return undefined;

    return this.createPointFromGeometry(graphic.geometries, graphic.geometryType, pointId, _index, pointCollection, iModel, originalPointStrings, type, graphic);
  }

  private createPointFromGeometry(
    geometries: unknown[],
    geometryType: string,
    pointId: string,
    _index: number,
    pointCollection: PointPrimitiveCollection,
    iModel?: IModelConnection,
    originalPointStrings?: PointStringCoordinates[],
    type?: string,
    graphic?: RenderGraphicWithCoordinates
  ): PointPrimitive | undefined {
    if (!geometries || !geometryType || !pointCollection)
      return undefined;

    let entityPosition: Cartesian3 | undefined;
    let realSpatialPoint: Point3d | undefined;

    if (this.primitiveType === 'pointstring2d') {
      const entry = this.findEntryByType(graphic, 'pointstring2d');
      const firstPoint = entry?.points[0];
      if (firstPoint)
        realSpatialPoint = Point3d.create(firstPoint.x, firstPoint.y, entry.zDepth);
    }

    if (!realSpatialPoint) {
      const firstPointString = originalPointStrings?.[0];
      if (firstPointString && firstPointString.length > 0) {
        const candidate = firstPointString[0];
        const z = typeof candidate.z === 'number' ? candidate.z : 0;
        realSpatialPoint = Point3d.create(candidate.x, candidate.y, z);
      }
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
      return undefined;

    const color = this.extractLineColorFromGraphic(graphic, this.primitiveType);
    if (!color)
      return undefined;

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

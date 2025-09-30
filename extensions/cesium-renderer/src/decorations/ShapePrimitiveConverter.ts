/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Cartesian3, ColorGeometryInstanceAttribute, GeometryInstance, PerInstanceColorAppearance, PolygonGeometry, PolygonHierarchy, Primitive, PrimitiveCollection } from "@cesium/engine";
import { IModelConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import type { DecorationPrimitiveEntry, Shape2dEntry, ShapeEntry } from "./DecorationTypes.js";
import { CesiumScene } from "../CesiumScene.js";
import { type DepthOptions, PrimitiveConverter, type RenderGraphicWithCoordinates } from "./PrimitiveConverter.js";

interface ShapeCoordinate {
  x: number;
  y: number;
  z?: number;
}
type ShapeCoordinates = Array<ShapeCoordinate | Point3d>;

export class ShapePrimitiveConverter extends PrimitiveConverter<ShapeCoordinates[]> {
  protected readonly primitiveType: 'shape' | 'shape2d';

  public constructor(primitiveType: 'shape' | 'shape2d' = 'shape') {
    super();
    this.primitiveType = primitiveType;
  }

  protected override getCollection(scene: CesiumScene): PrimitiveCollection {
    return scene.primitivesCollection;
  }

  protected override extractPrimitiveData(
    coordinateData: DecorationPrimitiveEntry[] | undefined,
    primitiveType: string
  ): ShapeCoordinates[] | undefined {
    if (!coordinateData)
      return undefined;

    const matches = coordinateData.filter((entry): entry is ShapeEntry | Shape2dEntry => entry.type === primitiveType);
    if (matches.length === 0)
      return undefined;

    return matches.map(entry => {
      if (entry.type === 'shape')
        return entry.points.map(pt => ({ x: pt.x, y: pt.y, z: pt.z }));

      return entry.points.map(pt => ({ x: pt.x, y: pt.y, z: entry.zDepth }));
    });
  }


  protected override createPrimitiveFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    primitiveId: string,
    index: number,
    collection: PrimitiveCollection,
    iModel?: IModelConnection,
    originalData?: ShapeCoordinates[],
    type?: string
  ): Primitive | undefined {
    return this.createPolygonFromGraphic(graphic, primitiveId, index, collection, iModel, originalData, type, graphic);
  }

  protected override getPrimitiveTypeName(): string {
    return this.primitiveType;
  }

  protected override shouldSkipEmptyGraphics(): boolean {
    return true;
  }

  protected override getDepthOptions(decorationType: string): DepthOptions {
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

  private createPolygonFromGraphic(
    graphic: RenderGraphicWithCoordinates,
    shapeId: string,
    index: number,
    primitivesCollection: PrimitiveCollection,
    iModel?: IModelConnection,
    originalShapes?: ShapeCoordinates[],
    type?: string,
    originalGraphic?: RenderGraphicWithCoordinates
  ): Primitive | undefined {
    if (!graphic?.geometries || !graphic.geometryType) {
      return undefined;
    }
    return this.createPolygonFromGeometry(graphic.geometries, graphic.geometryType, shapeId, index, primitivesCollection, iModel, originalShapes, type, originalGraphic ?? graphic);
  }

  private createPolygonFromGeometry(
    geometries: unknown[],
    geometryType: string,
    shapeId: string,
    _index: number,
    primitivesCollection: PrimitiveCollection,
    iModel?: IModelConnection,
    originalShapes?: ShapeCoordinates[],
    _type?: string,
    graphic?: RenderGraphicWithCoordinates
  ): Primitive | undefined {
    if (!geometries || !geometryType || !primitivesCollection) {
      return undefined;
    }

    let positions: Cartesian3[] = [];

    if (this.primitiveType === 'shape2d') {
      const entry = this.findEntryByType(graphic, 'shape2d');
      if (entry && entry.points.length > 0) {
        const pts = entry.points.map((pt) => Point3d.create(pt.x, pt.y, entry.zDepth));
        positions = this.convertPointsToCartesian3(pts, iModel);
      }
    }

    if (positions.length === 0) {
      const firstShape = originalShapes?.[0];
      if (firstShape && firstShape.length > 0) {
        const pts = firstShape.map((coord) => Point3d.create(coord.x, coord.y, typeof coord.z === 'number' ? coord.z : 0));
        positions = this.convertPointsToCartesian3(pts, iModel);
      }
    }

    if (positions.length === 0 && geometries && geometries.length > 0) {
      const geometry = geometries[0];
      interface Coord { x: number; y: number; z: number }
      const hasCoords = (g: unknown): g is { coordinateData: Coord[] } =>
        typeof g === 'object' && g !== null && ('coordinateData' in g);
      if (hasCoords(geometry) && geometry.coordinateData.length > 0) {
        const points = geometry.coordinateData.map((coord) => new Point3d(coord.x, coord.y, coord.z));
        positions = this.convertPointsToCartesian3(points, iModel);
      }
    }

    if (positions.length > 2) {
      const firstPos = positions[0];
      const lastPos = positions[positions.length - 1];
      if (!Cartesian3.equals(firstPos, lastPos)) {
        positions.push(firstPos);
      }
    }

    if (positions.length < 3) {
      return undefined;
    }

    switch (geometryType) {
      case 'shape':
      default:
        // Create filled polygon geometry
        const polygonGeometry = new PolygonGeometry({
          polygonHierarchy: new PolygonHierarchy(positions),
          extrudedHeight: 0, // Flat polygon, no extrusion
        });

        // Determine color: prefer symbology fill, fallback by type
        const color = this.extractFillOrLineColorFromGraphic(graphic, this.primitiveType === 'shape2d' ? 'shape2d' : 'shape');
        if (!color)
          return undefined;

        const geometryInstance = new GeometryInstance({
          geometry: polygonGeometry,
          id: shapeId,
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(color)
          }
        });

        const primitive = new Primitive({
          geometryInstances: geometryInstance,
          appearance: new PerInstanceColorAppearance({
            flat: true, // Use flat shading for better performance
            translucent: false
          })
        });

        primitivesCollection.add(primitive);
        return primitive;
    }
  }
}
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartesian3, Color, Entity } from "cesium";
import { GraphicList, IModelConnection, RenderGeometry } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { CesiumCoordinateConverter } from "./CesiumCoordinateConverter";

export class CesiumEntityHelpers {

  public static clearAllCesiumEntities(entityCollection: any): void {
    if (!entityCollection || !entityCollection.values) {
      return;
    }

    entityCollection.removeAll();
  }

  public static clearDecorationEntities(entityCollection: any): void {
    if (!entityCollection || !entityCollection.values) {
      return;
    }

    const entitiesToRemove: any[] = [];
    const allEntities = entityCollection.values;

    for (const entity of allEntities) {
      if (entity.id && (
        entity.id.startsWith('world_decoration_') ||
        entity.id.startsWith('normal_decoration_') ||
        entity.id.startsWith('worldOverlay_decoration_') ||
        entity.id.startsWith('viewOverlay_decoration_') ||
        entity.id.startsWith('mock_decoration_')
      )) {
        entitiesToRemove.push(entity);
      }
    }

    entitiesToRemove.forEach(entity => entityCollection.remove(entity));
  }

  public static convertDecorationsToCesiumEntities(
    graphics: GraphicList | undefined,
    type: string,
    entityCollection: any,
    iModel?: IModelConnection
  ): void {
    if (!graphics || graphics.length === 0) return;
    if (!entityCollection) {
      return;
    }

    graphics.forEach((graphic, index) => {
      try {
        const entityId = `${type}_decoration_${index}`;
        
        const originalPointStrings = (graphic as any)._originalPointStrings as Point3d[][] | undefined;
        
        const entity = this.createCesiumEntityFromGraphic(graphic, entityId, index, iModel, originalPointStrings);

        if (entity) {
          entityCollection.add(entity);
        }
      } catch (error) {
        console.error(`Error creating ${type} entity:`, error);
      }
    });
  }

  public static createCesiumEntityFromGraphic(graphic: any, entityId: string, index: number, iModel?: IModelConnection, originalPointStrings?: Point3d[][]): Entity | null {
    if (!graphic) {
      console.warn(`Null graphic for ${entityId}`);
      return null;
    }

    try {
      if (graphic.geometries && graphic.geometryType) {
        return this.createEntityFromGeometry(graphic.geometries, graphic.geometryType, entityId, index, iModel, originalPointStrings);
      }

      const fallbackPosition = this.getFallbackPosition(index);

      return new Entity({
        id: entityId,
        position: fallbackPosition,
        point: {
          pixelSize: 15,
          color: Color.LIME,
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: `iTwin→Cesium ${index}`,
          font: '10pt sans-serif',
          fillColor: Color.LIME,
          outlineColor: Color.BLACK,
          outlineWidth: 1,
          pixelOffset: new Cartesian3(0, -25, 0),
        },
      });

    } catch (error) {
      console.error(`Error analyzing RenderGraphic for ${entityId}:`, error);
      return null;
    }
  }

  private static createEntityFromGeometry(geometries: any[], geometryType: string, entityId: string, index: number, iModel?: IModelConnection, originalPointStrings?: Point3d[][]): Entity | null {
    try {
      let entityPosition: Cartesian3;
      let realSpatialPoint: Point3d | null = null;
      
      if (originalPointStrings && originalPointStrings.length > 0) {
        const firstPointString = originalPointStrings[0];
        if (firstPointString && firstPointString.length > 0) {
          realSpatialPoint = firstPointString[0];
        }
      }
      
      if (!realSpatialPoint && geometries && geometries.length > 0) {
        const geometry = geometries[0];
        
        if (geometry.points && geometry.points.length > 0) {
          const point = geometry.points[0];
          realSpatialPoint = new Point3d(point.x, point.y, point.z);
        } else if (geometry.vertices && geometry.vertices.length >= 3) {
          realSpatialPoint = new Point3d(geometry.vertices[0], geometry.vertices[1], geometry.vertices[2]);
        } else if (geometry.position) {
          realSpatialPoint = new Point3d(geometry.position.x, geometry.position.y, geometry.position.z);
        }
      }
      
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
          return new Entity({
            id: entityId,
            position: entityPosition,
            point: {
              pixelSize: 20,
              color: Color.BLUE,
              outlineColor: Color.WHITE,
              outlineWidth: 2,
            },
            label: {
              text: `Real Point ${index}`,
              font: '12pt sans-serif',
              fillColor: Color.BLUE,
              outlineColor: Color.WHITE,
              outlineWidth: 1,
              pixelOffset: new Cartesian3(0, -30, 0),
            },
          });

        case 'polyline':
          return new Entity({
            id: entityId,
            polyline: {
              positions: [
                entityPosition,
                Cartesian3.add(entityPosition, new Cartesian3(100000, 0, 0), new Cartesian3()),
                Cartesian3.add(entityPosition, new Cartesian3(100000, 100000, 0), new Cartesian3()),
              ],
              width: 3,
              material: entityColor,
            },
            label: {
              text: `Real Line ${index}`,
              font: '12pt sans-serif',
              fillColor: entityColor,
              outlineColor: Color.WHITE,
              outlineWidth: 1,
              pixelOffset: new Cartesian3(0, -30, 0),
              position: entityPosition,
            },
          });

        case 'mesh':
          return new Entity({
            id: entityId,
            polygon: {
              hierarchy: [
                Cartesian3.add(entityPosition, new Cartesian3(-50000, -50000, 0), new Cartesian3()),
                Cartesian3.add(entityPosition, new Cartesian3(50000, -50000, 0), new Cartesian3()),
                Cartesian3.add(entityPosition, new Cartesian3(50000, 50000, 0), new Cartesian3()),
                Cartesian3.add(entityPosition, new Cartesian3(-50000, 50000, 0), new Cartesian3()),
              ],
              material: entityColor.withAlpha(0.5),
              outline: true,
              outlineColor: entityColor,
            },
            label: {
              text: `Real Mesh ${index}`,
              font: '12pt sans-serif',
              fillColor: entityColor,
              outlineColor: Color.WHITE,
              outlineWidth: 1,
              pixelOffset: new Cartesian3(0, -30, 0),
              position: entityPosition,
            },
          });

        default:
          return new Entity({
            id: entityId,
            position: entityPosition,
            point: {
              pixelSize: 18,
              color: Color.ORANGE,
              outlineColor: Color.WHITE,
              outlineWidth: 2,
            },
            label: {
              text: `Real ${geometryType} ${index}`,
              font: '12pt sans-serif',
              fillColor: Color.ORANGE,
              outlineColor: Color.WHITE,
              outlineWidth: 1,
              pixelOffset: new Cartesian3(0, -30, 0),
            },
          });
      }

    } catch (error) {
      console.error(`Error creating entity from geometry:`, error);
      return null;
    }
  }

  public static createMockDecorations(entityCollection: any): void {
    const mockGraphics = [
      { type: 'mockPoint', id: 'mock_point_1', properties: ['mockProperty1', 'mockProperty2'] },
      { type: 'mockLine', id: 'mock_line_1', geometry: { start: [0, 0, 0], end: [100, 100, 100] } },
      { type: 'mockPolygon', id: 'mock_polygon_1', vertices: [[0, 0, 0], [100, 0, 0], [100, 100, 0]] }
    ];

    mockGraphics.forEach((mockGraphic, index) => {
      try {
        const entityId = `mock_decoration_${index}`;
        const entity = this.createCesiumEntityFromGraphic(mockGraphic, entityId, index);
        if (entity) {
          entityCollection.add(entity);
        }
      } catch (error) {
        console.error(`Error creating mock decoration ${index}:`, error);
      }
    });
  }

  private static getFallbackPosition(index: number): Cartesian3 {
    const longitude = (index % 10) * 36 - 180;
    const latitude = Math.floor(index / 10) * 20 - 40;
    const height = 100000 + (index * 10000);

    return Cartesian3.fromDegrees(longitude, latitude, height);
  }

  public static getColorForIndex(index: number): Color {
    const colors = [
      Color.RED,
      Color.GREEN,
      Color.BLUE,
      Color.YELLOW,
      Color.CYAN,
      Color.MAGENTA,
      Color.ORANGE,
      Color.PURPLE,
    ];
    return colors[index % colors.length];
  }
}
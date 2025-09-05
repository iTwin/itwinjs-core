/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Entity, Cartesian3, Color, JulianDate } from "cesium";
import { GraphicList } from "@itwin/core-frontend";

/** Helper utilities for managing CesiumJS entities and conversions from iTwin.js decorations */
export class CesiumEntityHelpers {
  
  /** Clear all Cesium entities (complete cleanup for iModel changes) */
  public static clearAllCesiumEntities(entityCollection: any): void {
    if (!entityCollection || !entityCollection.values) {
      return;
    }
    
    entityCollection.removeAll();
  }

  /** Clear only decoration entities, preserve test entities */
  public static clearDecorationEntities(entityCollection: any): void {
    if (!entityCollection || !entityCollection.values) {
      return;
    }
    
    const totalEntitiesBefore = entityCollection.values.length;
    const entitiesToRemove: any[] = [];
    const allEntities = entityCollection.values;
    
    for (let i = 0; i < allEntities.length; i++) {
      const entity = allEntities[i];
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

  /** Convert iTwin.js decorations to Cesium entities */
  public static convertDecorationsToCesiumEntities(
    graphics: GraphicList | undefined, 
    type: string, 
    entityCollection: any
  ): void {
    if (!graphics || graphics.length === 0) return;
    if (!entityCollection) {
      return;
    }
    
    graphics.forEach((graphic, index) => {
      try {
        const entityId = `${type}_decoration_${index}`;
        const entity = this.createCesiumEntityFromGraphic(graphic, entityId, index);
        
        if (entity) {
          entityCollection.add(entity);
        }
      } catch (error) {
        console.error(`Error creating ${type} entity:`, error);
      }
    });
  }

  /** Create a Cesium entity from an iTwin.js RenderGraphic */
  public static createCesiumEntityFromGraphic(graphic: any, entityId: string, index: number): Entity | null {
    if (!graphic) {
      console.warn(`Null graphic for ${entityId}`);
      return null;
    }

    try {
      // Check if this is our enhanced CesiumGraphic with geometry data
      if (graphic.geometries && graphic.geometryType) {
        // console.log(`Processing CesiumGraphic with ${graphic.geometries.length} ${graphic.geometryType} geometries`);
        return this.createEntityFromGeometry(graphic.geometries, graphic.geometryType, entityId, index);
      }
      
      // Fallback to property-based analysis for other graphics
      const properties = Object.getOwnPropertyNames(graphic);
      
      
      // Check for common properties that might indicate geometry type
      const hasGeometry = properties.some(prop => 
        prop.includes('geometry') || prop.includes('vertices') || prop.includes('points')
      );
      
      const hasMaterial = properties.some(prop => 
        prop.includes('material') || prop.includes('color') || prop.includes('symbology')
      );
      
      if (index < 3) {
        console.log(`Analysis: hasGeometry=${hasGeometry}, hasMaterial=${hasMaterial}`);
      }

      // Create a simple fallback entity
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

  /** Create a Cesium entity from real iTwin.js geometry data */
  private static createEntityFromGeometry(geometries: any[], geometryType: string, entityId: string, index: number): Entity | null {
    try {
      // Get base position for the entity
      const basePosition = this.getFallbackPosition(index);
      const entityColor = this.getColorForIndex(index);
      
      switch (geometryType) {
        case 'point-string':
          return new Entity({
            id: entityId,
            position: basePosition,
            point: {
              pixelSize: 20,
              color: Color.BLUE, // Different from mock decorations
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
          // For polylines, create a polyline entity
          // TODO: Extract actual polyline data from geometry
          return new Entity({
            id: entityId,
            polyline: {
              positions: [
                basePosition,
                Cartesian3.add(basePosition, new Cartesian3(100000, 0, 0), new Cartesian3()),
                Cartesian3.add(basePosition, new Cartesian3(100000, 100000, 0), new Cartesian3()),
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
              position: basePosition,
            },
          });
          
        case 'mesh':
          // For meshes, create a polygon or model entity
          // TODO: Extract actual mesh data from geometry  
          return new Entity({
            id: entityId,
            polygon: {
              hierarchy: [
                Cartesian3.add(basePosition, new Cartesian3(-50000, -50000, 0), new Cartesian3()),
                Cartesian3.add(basePosition, new Cartesian3(50000, -50000, 0), new Cartesian3()),
                Cartesian3.add(basePosition, new Cartesian3(50000, 50000, 0), new Cartesian3()),
                Cartesian3.add(basePosition, new Cartesian3(-50000, 50000, 0), new Cartesian3()),
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
              position: basePosition,
            },
          });
          
        default:
          console.log(`Unknown geometry type: ${geometryType}, creating default point entity`);
          return new Entity({
            id: entityId,
            position: basePosition,
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

  /** Create mock decorations for testing when no real decorations exist */
  public static createMockDecorations(entityCollection: any): void {
    const mockGraphics = [
      { type: 'mockPoint', id: 'mock_point_1', properties: ['mockProperty1', 'mockProperty2'] },
      { type: 'mockLine', id: 'mock_line_1', geometry: { start: [0, 0, 0], end: [100, 100, 100] } },
      { type: 'mockPolygon', id: 'mock_polygon_1', vertices: [[0, 0, 0], [100, 0, 0], [100, 100, 0]] }
    ];

    console.log(`Creating ${mockGraphics.length} mock decorations for testing...`);
    
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

  /** Get fallback position for entities */
  private static getFallbackPosition(index: number): Cartesian3 {
    const longitude = (index % 10) * 36 - 180;
    const latitude = Math.floor(index / 10) * 20 - 40;
    const height = 100000 + (index * 10000);
    
    return Cartesian3.fromDegrees(longitude, latitude, height);
  }

  /** Get color for entity index */
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
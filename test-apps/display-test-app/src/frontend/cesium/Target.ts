/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Id64String } from "@itwin/core-bentley";
import { System } from "./System";
import { CesiumScene } from "./Scene";
import { DecorateContext, Decorations, GraphicList, GraphicType, IModelApp, Pixel, RenderPlan, RenderTarget, Scene, ViewRect } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { ColorDef } from "@itwin/core-common";
import { Entity, Cartesian3, Color, PolylineGraphics, PolygonGraphics, LabelGraphics, BillboardGraphics, EllipseGraphics, JulianDate } from "cesium";

// import { RenderPlan } from "@itwin/core-frontend/src/internal/render/RenderPlan";
// // eslint-disable-next-line @itwin/import-within-package
// import { RenderPlan } from "../../../../../core/frontend/src/internal/render/RenderPlan";

/** A Target that renders to a canvas on the screen using Cesium.
 * @internal
 */
export class OnScreenTarget extends RenderTarget {
  private readonly _canvas: HTMLCanvasElement;
  private readonly _scene: CesiumScene;

  public get renderSystem(): System { return System.instance; }

  public get viewRect(): ViewRect {
    // ###TODO consider this a temporary solution until we have a proper ViewRect implementation for Cesium.
    const viewRect = new ViewRect();
    viewRect.init(0, 0, this._canvas.width, this._canvas.height);
    return viewRect;
  }

  public constructor(canvas: HTMLCanvasElement) {
    super();
    this._canvas = canvas;
    this._scene = new CesiumScene({
      canvas: this._canvas,
      sceneOptions: {
      }
    });
    
    // Disable test decorator for now due to vertex table issues
    // this.addTestDecorator();
    
    // Create multiple test entities directly to demonstrate different Cesium capabilities
    this.addTestEntities();
    
    // Add keyboard shortcuts for debugging
    this.setupKeyboardShortcuts();
  }
  
  private addTestEntities() {
    // Wait for scene to be ready before adding entities
    if (!this._scene?.cesiumScene) {
      console.log("Scene not ready, delaying entity creation...");
      setTimeout(() => this.addTestEntities(), 100);
      return;
    }
    
    // Create multiple test entities directly in CesiumJS to demonstrate our conversion capabilities
    const entityCollection = this._scene.entities;
    
    // Entity 1: Main test point with label - make it HUGE and at ground level
    const mainTestEntity = new Entity({
      id: 'main_test_entity',
      position: Cartesian3.fromDegrees(0, 0, 0), // At ground level
      point: {
        pixelSize: 100, // Much bigger
        color: Color.YELLOW,
        outlineColor: Color.RED,
        outlineWidth: 10,
        heightReference: undefined, // CLAMP_TO_GROUND equivalent
      },
      label: {
        text: '🎯 HUGE TEST POINT!',
        font: '30pt sans-serif',
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK,
        outlineWidth: 5,
        pixelOffset: new Cartesian3(0, -100, 0),
        scale: 2.0, // Make label bigger
      },
    });
    
    // Entity 2: Polyline demonstration
    const lineEntity = new Entity({
      id: 'test_line_entity',
      polyline: {
        positions: [
          Cartesian3.fromDegrees(-5, -5, 1000000),
          Cartesian3.fromDegrees(5, 5, 1000000),
        ],
        width: 8,
        material: Color.CYAN,
        clampToGround: false,
      },
      label: {
        text: 'Test Line',
        font: '12pt sans-serif',
        fillColor: Color.CYAN,
      },
    });
    
    // Entity 3: Polygon demonstration - make it MUCH bigger and brighter
    const polygonEntity = new Entity({
      id: 'test_polygon_entity',
      polygon: {
        hierarchy: [
          Cartesian3.fromDegrees(-5, -5, 0),
          Cartesian3.fromDegrees(5, -5, 0),
          Cartesian3.fromDegrees(5, 5, 0),
          Cartesian3.fromDegrees(-5, 5, 0),
        ],
        material: Color.ORANGE,  // Remove alpha for brighter color
        outline: true,
        outlineColor: Color.RED,
        outlineWidth: 5,
        extrudedHeight: 1000000, // 1000km tall!
      },
    });
    
    // Entity 4: Ellipse demonstration - make it bigger and brighter
    const ellipseEntity = new Entity({
      id: 'test_ellipse_entity',
      position: Cartesian3.fromDegrees(10, 10, 0),
      ellipse: {
        semiMajorAxis: 3000000, // 3000km
        semiMinorAxis: 1500000, // 1500km
        material: Color.PURPLE, // Remove alpha for brighter color
        outline: true,
        outlineColor: Color.WHITE,
        outlineWidth: 3,
      },
    });
    
    // Entity 5: Multiple points for demonstration
    for (let i = 0; i < 5; i++) {
      const pointEntity = new Entity({
        id: `demo_point_${i}`,
        position: Cartesian3.fromDegrees(i * 2, 0, i * 100000 + 500000),
        point: {
          pixelSize: 15 + i * 3,
          color: this.getColorForIndex(i),
          outlineColor: Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: `Point ${i}`,
          font: '10pt sans-serif',
          fillColor: Color.WHITE,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          pixelOffset: new Cartesian3(0, -30, 0),
        },
      });
      entityCollection.add(pointEntity);
    }
    
    // Add all main entities
    entityCollection.add(mainTestEntity);
    entityCollection.add(lineEntity);
    entityCollection.add(polygonEntity);
    entityCollection.add(ellipseEntity);
    
    // Make sure the camera can see our entities
    this.setupCameraView();
    
    // Now let's also manually trigger our decoration conversion system to test it
    this.testDecorationConversion();
  }
  
  private testDecorationConversion() {
    // Create mock decorations to test our conversion system
    const mockDecorations = {
      world: [
        { id: 'mock_world_1' },
        { id: 'mock_world_2' },
        { id: 'mock_world_3' },
      ],
      worldOverlay: [
        { id: 'mock_overlay_1' },
      ],
      normal: [
        { id: 'mock_normal_1' },
        { id: 'mock_normal_2' },
      ],
    };
    
    // Test our conversion methods
    this.convertDecorationsToCesiumEntities(mockDecorations.world as any, 'mock_world', this._scene.entities);
    this.convertDecorationsToCesiumEntities(mockDecorations.worldOverlay as any, 'mock_worldOverlay', this._scene.entities);
    this.convertDecorationsToCesiumEntities(mockDecorations.normal as any, 'mock_normal', this._scene.entities);
  }
  
  private setupCameraView() {
    try {
      const camera = this._scene.cesiumScene.camera;
      
      // Set camera to a good viewing position to see our test entities
      camera.setView({
        destination: Cartesian3.fromDegrees(0, 0, 3000000), // 3000km altitude to see everything
        orientation: {
          heading: 0.0,
          pitch: -Math.PI / 4, // Look down at 45 degrees
          roll: 0.0
        }
      });
      
      // Also try to fly to the main test entity after a short delay
      setTimeout(() => {
        try {
          const mainEntity = this._scene.entities.getById('main_test_entity');
          if (mainEntity && mainEntity.position) {
            const currentTime = JulianDate.now();
            const position = mainEntity.position.getValue(currentTime);
            if (position) {
              camera.flyTo({
                destination: position,
                orientation: {
                  heading: 0.0,
                  pitch: -Math.PI / 4,
                  roll: 0.0
                },
                duration: 3.0
              });
            }
          }
        } catch (error) {
          console.error("Error flying to entity:", error);
        }
      }, 1000);
      
    } catch (error) {
      console.error("Error setting up camera view:", error);
    }
  }
  
  private setupKeyboardShortcuts() {
    // Add keyboard shortcuts for debugging Cesium entities
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key === '1') {
        // Ctrl+1: Fly to main test entity
        event.preventDefault();
        this.flyToMainEntity();
      } else if (event.ctrlKey && event.key === '2') {
        // Ctrl+2: Home view to see all entities
        event.preventDefault();
        this.homeView();
      } else if (event.ctrlKey && event.key === '3') {
        // Ctrl+3: List all entities
        event.preventDefault();
        this.listAllEntities();
      } else if (event.ctrlKey && event.key === '4') {
        // Ctrl+4: Simple view to main entity
        event.preventDefault();
        this.simpleViewToMainEntity();
      }
    });
    
    // Keyboard shortcuts: Ctrl+1: fly to entity, Ctrl+2: home view, Ctrl+3: list entities
  }
  
  private flyToMainEntity() {
    try {
      const camera = this._scene.cesiumScene.camera;
      const mainEntity = this._scene.entities.getById('main_test_entity');
      if (mainEntity && mainEntity.position) {
        const currentTime = JulianDate.now();
        const position = mainEntity.position.getValue(currentTime);
        if (position) {
          // Calculate a position with offset
          const offset = Cartesian3.fromDegrees(0, 0, 500000); // 500km offset
          const destination = Cartesian3.add(position, offset, new Cartesian3());
          
          camera.flyTo({
            destination: destination,
            orientation: {
              heading: 0.0,
              pitch: -Math.PI / 4,
              roll: 0.0
            },
            duration: 2.0
          });
          console.log("Flying to main entity");
        } else {
          console.log("Main entity position not available");
        }
      } else {
        console.log("Main entity not found!");
      }
    } catch (error) {
      console.error("Error flying to main entity:", error);
    }
  }
  
  private homeView() {
    try {
      const camera = this._scene.cesiumScene.camera;
      camera.setView({
        destination: Cartesian3.fromDegrees(0, 0, 40000000), // 5000km altitude
        orientation: {
          heading: 0.0,
          pitch: -Math.PI / 6, // Look down at 30 degrees
          roll: 0.0
        }
      });
      // Camera set to home view
    } catch (error) {
      console.error("Error setting home view:", error);
    }
  }
  
  private simpleViewToMainEntity() {
    try {
      const camera = this._scene.cesiumScene.camera;
      // Set camera to a known position to see all our big entities
      camera.setView({
        destination: Cartesian3.fromDegrees(5, 5, 40000000), // 8000km high, offset to see both polygon and ellipse
        orientation: {
          heading: 0.0,
          pitch: -Math.PI / 2, // Look down at 60 degrees
          roll: 0.0
        }
      });
      console.log("Simple view set to see all big entities");
    } catch (error) {
      console.error("Error setting simple view:", error);
    }
  }
  
  private listAllEntities() {
    const entityCollection = this._scene.entities;
    const allEntities = entityCollection.values;
    console.log(`DEBUG: === ALL ENTITIES (${allEntities.length}) ===`);
    for (let i = 0; i < allEntities.length; i++) {
      const entity = allEntities[i];
      const hasPoint = !!entity.point;
      const hasPolyline = !!entity.polyline;
      const hasPolygon = !!entity.polygon;
      const hasEllipse = !!entity.ellipse;
      const hasLabel = !!entity.label;
      console.log(`${i}: ${entity.id} - Point:${hasPoint}, Line:${hasPolyline}, Polygon:${hasPolygon}, Ellipse:${hasEllipse}, Label:${hasLabel}`);
      if (entity.position) {
        console.log(`   Position: ${entity.position.toString()}`);
      }
    }
  }

  private addTestDecorator() {
    const testDecorator = {
      decorate: (context: DecorateContext) => {
        console.log("DEBUG: Test decorator decorate() called");
        try {
          // Create simple decorations using shapes instead of lines to avoid vertex table issues
          
          // 1. World decoration - a simple rectangular shape
          const worldBuilder = context.createGraphicBuilder(GraphicType.WorldDecoration);
          worldBuilder.setSymbology(ColorDef.red, ColorDef.red, 2);
          
          // Create a simple rectangle
          const rectPoints = [
            new Point3d(0, 0, 0),
            new Point3d(1000, 0, 0),
            new Point3d(1000, 1000, 0),
            new Point3d(0, 1000, 0),
            new Point3d(0, 0, 0), // Close the shape
          ];
          worldBuilder.addShape(rectPoints);
          context.addDecorationFromBuilder(worldBuilder);
          console.log("DEBUG: Test decorator created world decoration shape");
          
          // 2. Another world decoration - a triangle
          const triangleBuilder = context.createGraphicBuilder(GraphicType.WorldDecoration);
          triangleBuilder.setSymbology(ColorDef.blue, ColorDef.blue, 3);
          
          const trianglePoints = [
            new Point3d(2000, 0, 0),
            new Point3d(2500, 1000, 0),
            new Point3d(1500, 1000, 0),
            new Point3d(2000, 0, 0), // Close the triangle
          ];
          triangleBuilder.addShape(trianglePoints);
          context.addDecorationFromBuilder(triangleBuilder);
          console.log("DEBUG: Test decorator created world decoration triangle");
          
          // 3. World overlay decoration - another shape
          const overlayBuilder = context.createGraphicBuilder(GraphicType.WorldOverlay);
          overlayBuilder.setSymbology(ColorDef.green, ColorDef.green, 1);
          
          const overlayPoints = [
            new Point3d(-1000, -1000, 500),
            new Point3d(-500, -1000, 500),
            new Point3d(-500, -500, 500),
            new Point3d(-1000, -500, 500),
            new Point3d(-1000, -1000, 500), // Close the shape
          ];
          overlayBuilder.addShape(overlayPoints);
          context.addDecorationFromBuilder(overlayBuilder);
          console.log("DEBUG: Test decorator created world overlay decoration");
          
        } catch (error) {
          console.error("DEBUG: Error in test decorator:", error);
        }
      }
    };
    
    // Add the test decorator
    IModelApp.viewManager.addDecorator(testDecorator);
    console.log("DEBUG: Test decorator added to ViewManager");
  }

  // ###TODO getters and setters
  public get wantInvertBlackBackground() { return false; }
  public get analysisFraction() { return 0; }
  public set analysisFraction(_fraction: number) { /* no-op */ }
  public get screenSpaceEffects(): Iterable<string> { return []; }
  public set screenSpaceEffects(_effectNames: Iterable<string>) { /* no-op */ }

  public changeScene(_scene: Scene) {
    // ###TODO Implement scene change logic for Cesium
  }

  public changeDynamics(_foreground: GraphicList | undefined, _overlay: GraphicList | undefined) {
    // ###TODO Implement dynamics change logic for Cesium
  }

  public changeDecorations(decorations: Decorations) {
    // Check if scene is ready before proceeding  
    if (!this._scene?.cesiumScene) {
      console.log("Scene not ready for decorations, skipping...");
      return;
    }
    
    // Get access to the CesiumJS EntityCollection
    const entityCollection = this._scene.entities;
    
    // Only clear decoration entities, not test entities
    this.clearDecorationEntities(entityCollection);
    
    // Convert different types of decorations to CesiumJS entities
    this.convertDecorationsToCesiumEntities(decorations.world, 'world', entityCollection);
    this.convertDecorationsToCesiumEntities(decorations.normal, 'normal', entityCollection);
    this.convertDecorationsToCesiumEntities(decorations.worldOverlay, 'worldOverlay', entityCollection);
    this.convertDecorationsToCesiumEntities(decorations.viewOverlay, 'viewOverlay', entityCollection);
  }
  
  private clearDecorationEntities(entityCollection: any) {
    // Safety check - ensure entityCollection and values exist
    if (!entityCollection || !entityCollection.values) {
      console.log("EntityCollection not available for clearing");
      return;
    }
    
    // Remove only decoration entities, preserve test entities
    const entitiesToRemove: any[] = [];
    const allEntities = entityCollection.values;
    
    for (let i = 0; i < allEntities.length; i++) {
      const entity = allEntities[i];
      if (entity.id && (
        entity.id.startsWith('world_decoration_') ||
        entity.id.startsWith('normal_decoration_') ||
        entity.id.startsWith('worldOverlay_decoration_') ||
        entity.id.startsWith('viewOverlay_decoration_') ||
        entity.id.startsWith('mock_')
      )) {
        entitiesToRemove.push(entity);
      }
    }
    
    // Remove decoration entities
    entitiesToRemove.forEach(entity => entityCollection.remove(entity));
  }
  
  private convertDecorationsToCesiumEntities(graphics: GraphicList | undefined, type: string, entityCollection: any) {
    if (!graphics || graphics.length === 0) return;
    if (!entityCollection) {
      console.log(`EntityCollection not available for ${type} decorations`);
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
  
  private createCesiumEntityFromGraphic(_graphic: any, entityId: string, index: number): Entity | null {
    // For now, create different types of entities based on index to demonstrate various Cesium capabilities
    const entityType = index % 5;
    const basePosition = Cartesian3.fromDegrees(
      index * 0.001, // Slight longitude offset
      0,
      index * 200 + 50000 // Height offset for visibility
    );
    
    switch (entityType) {
      case 0: // Point entity
        return new Entity({
          id: entityId,
          position: basePosition,
          point: {
            pixelSize: 12 + (index % 10),
            color: this.getColorForIndex(index),
            outlineColor: Color.WHITE,
            outlineWidth: 2,
            heightReference: undefined, // CLAMP_TO_GROUND equivalent
          },
          label: {
            text: `Point ${index}`,
            font: '10pt sans-serif',
            fillColor: Color.WHITE,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            pixelOffset: new Cartesian3(0, -30, 0),
          },
        });
        
      case 1: // Polyline entity (simulating line decoration)
        const linePositions = [
          basePosition,
          Cartesian3.fromDegrees(
            index * 0.001 + 0.001,
            0.001,
            index * 200 + 50000
          ),
        ];
        return new Entity({
          id: entityId,
          polyline: {
            positions: linePositions,
            width: 3,
            material: this.getColorForIndex(index),
            clampToGround: false,
          },
        });
        
      case 2: // Polygon entity (simulating shape decoration)
        const polygonPositions = [
          Cartesian3.fromDegrees(index * 0.001, 0, 0),
          Cartesian3.fromDegrees(index * 0.001 + 0.0005, 0, 0),
          Cartesian3.fromDegrees(index * 0.001 + 0.0005, 0.0005, 0),
          Cartesian3.fromDegrees(index * 0.001, 0.0005, 0),
        ];
        return new Entity({
          id: entityId,
          polygon: {
            hierarchy: polygonPositions,
            material: this.getColorForIndex(index).withAlpha(0.7),
            outline: true,
            outlineColor: Color.WHITE,
            extrudedHeight: 1000 + (index * 100),
          },
        });
        
      case 3: // Billboard entity (simulating icon decoration)
        return new Entity({
          id: entityId,
          position: basePosition,
          billboard: {
            // Using a simple colored square as placeholder (in real app, you'd use actual images)
            color: this.getColorForIndex(index),
            width: 32,
            height: 32,
          },
          label: {
            text: `Billboard ${index}`,
            font: '8pt sans-serif',
            fillColor: Color.YELLOW,
            pixelOffset: new Cartesian3(0, 40, 0),
          },
        });
        
      case 4: // Ellipse entity (simulating circular decoration)
        return new Entity({
          id: entityId,
          position: Cartesian3.fromDegrees(index * 0.001, 0, 0),
          ellipse: {
            semiMajorAxis: 500 + (index * 50),
            semiMinorAxis: 500 + (index * 50),
            material: this.getColorForIndex(index).withAlpha(0.5),
            outline: true,
            outlineColor: this.getColorForIndex(index),
          },
        });
        
      default:
        return null;
    }
  }
  
  private getColorForIndex(index: number): Color {
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

  public changeRenderPlan(_plan: RenderPlan) {
    // ###TODO Implement render plan change logic for Cesium
  }

  public drawFrame(_sceneMilSecElapsed?: number) {
    // ###TODO Implement frame drawing logic for Cesium
  }

  public setViewRect(_rect: ViewRect, _temporary: boolean) {
    // ###TODO Implement view rectangle setting logic for Cesium
  }

  public updateViewRect() {// force a RenderTarget viewRect to resize if necessary since last draw
    return true; // ###TODO Implement view rectangle update logic for Cesium
  }

  public readPixels(_rect: ViewRect, _selector: Pixel.Selector, _receiver: Pixel.Receiver, _excludeNonLocatable: boolean, _excludedElements?: Iterable<Id64String>) {
    // ###TODO Implement pixel reading logic for Cesium
    // NB: `rect` is specified in *CSS* pixels.
  }
}

/** A Target that renders to an offscreen buffer using Cesium.
 * @internal
 */
export class OffScreenTarget extends RenderTarget {
  private readonly _rect: ViewRect

  public get renderSystem(): System { return System.instance; }

  public get viewRect(): ViewRect {
    return this._rect;
  }

  public constructor(rect: ViewRect) {
    super();
    this._rect = rect;
  }

  // ###TODO getters and setters
  public get wantInvertBlackBackground() { return false; }
  public get analysisFraction() { return 0; }
  public set analysisFraction(_fraction: number) { /* no-op */ }
  public get screenSpaceEffects(): Iterable<string> { return []; }
  public set screenSpaceEffects(_effectNames: Iterable<string>) { /* no-op */ }

  public changeScene(_scene: Scene) {
    // ###TODO Implement scene change logic for Cesium
  }

  public changeDynamics(_foreground: GraphicList | undefined, _overlay: GraphicList | undefined) {
    // ###TODO Implement dynamics change logic for Cesium
  }

  public changeDecorations(decorations: Decorations) {
    console.log("DEBUG: CesiumJS changeDecorations called!", decorations);
    
    // Log what types of decorations we received
    if (decorations.world && decorations.world.length > 0) {
      console.log("DEBUG: Received world decorations:", decorations.world.length);
    }
    if (decorations.normal && decorations.normal.length > 0) {
      console.log("DEBUG: Received normal decorations:", decorations.normal.length);
    }
    if (decorations.worldOverlay && decorations.worldOverlay.length > 0) {
      console.log("DEBUG: Received worldOverlay decorations:", decorations.worldOverlay.length);
    }
    if (decorations.viewOverlay && decorations.viewOverlay.length > 0) {
      console.log("DEBUG: Received viewOverlay decorations:", decorations.viewOverlay.length);
    }
    if (decorations.canvasDecorations && decorations.canvasDecorations.length > 0) {
      console.log("DEBUG: Received canvas decorations:", decorations.canvasDecorations.length);
    }
    
    // ###TODO: Convert decorations to CesiumJS entities/primitives
  }

  public changeRenderPlan(_plan: RenderPlan) {
    // ###TODO Implement render plan change logic for Cesium
  }

  public drawFrame(_sceneMilSecElapsed?: number) {
    // ###TODO Implement frame drawing logic for Cesium
  }

  public setViewRect(_rect: ViewRect, _temporary: boolean) {
    // ###TODO Implement view rectangle setting logic for Cesium
  }

  public updateViewRect() {// force a RenderTarget viewRect to resize if necessary since last draw
    return true; // ###TODO Implement view rectangle update logic for Cesium
  }

  public readPixels(_rect: ViewRect, _selector: Pixel.Selector, _receiver: Pixel.Receiver, _excludeNonLocatable: boolean, _excludedElements?: Iterable<Id64String>) {
    // ###TODO Implement pixel reading logic for Cesium
    // NB: `rect` is specified in *CSS* pixels.
  }
}

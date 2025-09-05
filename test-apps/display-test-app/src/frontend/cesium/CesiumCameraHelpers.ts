/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartesian3, JulianDate } from "cesium";
import { CesiumScene } from "./Scene";

/** Helper utilities for managing CesiumJS camera controls and view positioning */
export class CesiumCameraHelpers {
  
  /** Setup keyboard shortcuts for camera debugging */
  public static setupKeyboardShortcuts(scene: CesiumScene): void {
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key === '1') {
        event.preventDefault();
        this.flyToMainEntity(scene);
      } else if (event.ctrlKey && event.key === '2') {
        event.preventDefault();
        this.homeView(scene);
      } else if (event.ctrlKey && event.key === '3') {
        event.preventDefault();
        this.listAllEntities(scene);
      } else if (event.ctrlKey && event.key === '4') {
        event.preventDefault();
        this.simpleViewToMainEntity(scene);
      }
    });
  }

  /** Fly to main test entity */
  private static flyToMainEntity(scene: CesiumScene): void {
    try {
      const camera = scene.cesiumScene.camera;
      const mainEntity = scene.entities.getById('main_test_entity');
      if (mainEntity && mainEntity.position) {
        const currentTime = JulianDate.now();
        const position = mainEntity.position.getValue(currentTime);
        if (position) {
          const offset = Cartesian3.fromDegrees(0, 0, 500000);
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

  /** Set camera to home view */
  private static homeView(scene: CesiumScene): void {
    try {
      const camera = scene.cesiumScene.camera;
      camera.setView({
        destination: Cartesian3.fromDegrees(0, 0, 40000000),
        orientation: {
          heading: 0.0,
          pitch: -Math.PI / 6,
          roll: 0.0
        }
      });
    } catch (error) {
      console.error("Error setting home view:", error);
    }
  }

  /** Simple view to see all entities */
  private static simpleViewToMainEntity(scene: CesiumScene): void {
    try {
      const camera = scene.cesiumScene.camera;
      camera.setView({
        destination: Cartesian3.fromDegrees(5, 5, 40000000),
        orientation: {
          heading: 0.0,
          pitch: -Math.PI / 2,
          roll: 0.0
        }
      });
      console.log("Simple view set to see all big entities");
    } catch (error) {
      console.error("Error setting simple view:", error);
    }
  }

  /** List all entities for debugging */
  private static listAllEntities(scene: CesiumScene): void {
    const entityCollection = scene.entities;
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
}
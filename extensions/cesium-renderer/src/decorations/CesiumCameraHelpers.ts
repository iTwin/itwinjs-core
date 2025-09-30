import { Cartesian3 } from "@cesium/engine";
import { CesiumScene } from "../CesiumScene.js";

export class CesiumCameraHelpers {

  /**
   * Ctrl + Arrow keys: Move camera position
   * Ctrl + W/S: Move forward/backward
   * Ctrl + A/D: Rotate view left/right
   */
  public static setupKeyboardShortcuts(scene: CesiumScene): void {
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.key === 'ArrowUp') {
        event.preventDefault();
        this.panCameraDown(scene);
      } else if (event.ctrlKey && event.key === 'ArrowDown') {
        event.preventDefault();
        this.panCameraUp(scene);
      } else if (event.ctrlKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        this.panCameraLeft(scene);
      } else if (event.ctrlKey && event.key === 'ArrowRight') {
        event.preventDefault();
        this.panCameraRight(scene);
      } else if (event.ctrlKey && (event.key === 'w' || event.key === 'W')) {
        event.preventDefault();
        this.panCameraForward(scene);
      } else if (event.ctrlKey && (event.key === 's' || event.key === 'S')) {
        event.preventDefault();
        this.panCameraBackward(scene);
      } else if (event.ctrlKey && (event.key === 'a' || event.key === 'A')) {
        event.preventDefault();
        this.lookLeft(scene);
      } else if (event.ctrlKey && (event.key === 'd' || event.key === 'D')) {
        event.preventDefault();
        this.lookRight(scene);
      }
    });
  }

  private static homeView(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    camera.setView({
      destination: Cartesian3.fromDegrees(0, 0, 40000000),
      orientation: {
        heading: 0.0,
        pitch: -Math.PI / 6,
        roll: 0.0
      }
    });
  }

  private static simpleViewToMainEntity(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    camera.setView({
      destination: Cartesian3.fromDegrees(5, 5, 40000000),
      orientation: {
        heading: 0.0,
        pitch: -Math.PI / 2,
        roll: 0.0
      }
    });
  }

  private static rotateCameraUp(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    const amount = Math.PI / 24;
    camera.lookUp(amount);
  }

  private static rotateCameraLeft(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    const rotateAmount = Math.PI / 24;
    const currentPosition = camera.position.clone();
    const currentHeading = camera.heading;
    const currentPitch = camera.pitch;
    const currentRoll = camera.roll;

    let newHeading = currentHeading - rotateAmount;
    if (newHeading < -Math.PI) {
      newHeading += 2 * Math.PI;
    }

    camera.setView({
      destination: currentPosition,
      orientation: {
        heading: newHeading,
        pitch: currentPitch,
        roll: currentRoll
      }
    });
  }

  private static rotateCameraRight(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    const rotateAmount = Math.PI / 24;
    const currentPosition = camera.position.clone();
    const currentHeading = camera.heading;
    const currentPitch = camera.pitch;
    const currentRoll = camera.roll;

    let newHeading = currentHeading + rotateAmount;
    if (newHeading > Math.PI) {
      newHeading -= 2 * Math.PI;
    }

    camera.setView({
      destination: currentPosition,
      orientation: {
        heading: newHeading,
        pitch: currentPitch,
        roll: currentRoll
      }
    });
  }

  private static panCameraUp(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    const moveDistance = 100000;
    camera.moveUp(moveDistance);
  }

  private static panCameraDown(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    const moveDistance = 100000;
    camera.moveDown(moveDistance);
  }

  private static panCameraLeft(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    const moveDistance = 100000;
    camera.moveRight(moveDistance);
  }

  private static panCameraRight(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    const moveDistance = 100000;
    camera.moveLeft(moveDistance);
  }

  private static panCameraForward(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    const moveDistance = 100000;
    camera.moveForward(moveDistance);
  }

  private static panCameraBackward(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    const moveDistance = 100000;
    camera.moveBackward(moveDistance);
  }

  private static lookLeft(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    const rotateAmount = Math.PI / 24;
    const currentPosition = camera.position.clone();
    const currentHeading = camera.heading;
    const currentPitch = camera.pitch;
    const currentRoll = camera.roll;

    let newHeading = currentHeading - rotateAmount;
    if (newHeading < -Math.PI) {
      newHeading += 2 * Math.PI;
    }

    camera.setView({
      destination: currentPosition,
      orientation: {
        heading: newHeading,
        pitch: currentPitch,
        roll: currentRoll
      }
    });
  }

  private static lookRight(scene: CesiumScene): void {
    const camera = scene.cesiumScene.camera;
    const rotateAmount = Math.PI / 24;
    const currentPosition = camera.position.clone();
    const currentHeading = camera.heading;
    const currentPitch = camera.pitch;
    const currentRoll = camera.roll;

    let newHeading = currentHeading + rotateAmount;
    if (newHeading > Math.PI) {
      newHeading -= 2 * Math.PI;
    }

    camera.setView({
      destination: currentPosition,
      orientation: {
        heading: newHeading,
        pitch: currentPitch,
        roll: currentRoll
      }
    });
  }
}
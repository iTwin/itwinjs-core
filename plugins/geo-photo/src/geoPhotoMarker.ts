/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AngleSweep, Arc3d, Point2d, Point3d, XAndY, XYAndZ, Vector3d, Matrix3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { ColorByName, ColorDef } from "@bentley/imodeljs-common";
import {
  BeButton, BeButtonEvent, BeModifierKeys, Cluster, Decorator, DecorateContext, GraphicType, imageElementFromUrl,
  IModelApp, Marker, MarkerImage, MarkerSet,
} from "@bentley/imodeljs-frontend";
import { AngleUtils, PhotoFile, PhotoTraverseFunction } from "./PhotoTree";
import { GeoPhotos, GeoPhotoPlugin, GeoPhotoSettings } from "./geoPhoto";
import { PannellumModalFrontstage } from "./PannellumFrontStage";
import { FrontstageManager } from "@bentley/ui-framework";
import { PannellumHotSpot, PannellumViewerConfig, PannellumViewer, MarkerDisplaySettings } from "./pannellum/pannellumViewer";

// cSpell:ignore pano pnlm geotagged
interface Neighbor {
  file: PhotoFile;
  delta: Vector3d;
  distance: number;
  initialYaw: number;
}

interface ViewerData {
  photoFile: PhotoFile;
  panoBlob: Blob;
  config: PannellumViewerConfig;
}

/** Marker positioned where there is a geotagged photograph. */
class GeoPhotoMarker extends Marker {
  private static _size = Point2d.create(30, 30);
  private static _imageSize = Point2d.create(40, 40);
  private static _imageOffset = Point2d.create(-8, 22);
  private static _amber = new ColorDef(ColorByName.amber);
  private static _sweep360 = AngleSweep.create360();
  private static _tooCloseYaw: number = 3.0;
  private static _tooCloseDistance: number = 5.0;  // meters
  private _manager: GeoPhotoMarkerManager;
  private _color: ColorDef;
  public photoFile: PhotoFile;

  /** Create a new GeoPhotoMarker */
  constructor(location: XYAndZ, photoFile: PhotoFile, icon: HTMLImageElement, manager: GeoPhotoMarkerManager) {
    super(location, GeoPhotoMarker._size);
    this._color = GeoPhotoMarker._amber;
    this.setImage(icon); // save icon
    this.imageOffset = GeoPhotoMarker._imageOffset; // move icon up by 30 pixels
    this.imageSize = GeoPhotoMarker._imageSize; // 40x40
    this.photoFile = photoFile;
    // set the tooltip when promise resolves. We won't need it for a while anyway.
    this.photoFile.getToolTip().then((toolTip) => { this.title = toolTip; }).catch((_err) => { });
    this.setScaleFactor({ low: .2, high: 1.4 }); // make size 20% at back of frustum and 140% at front of frustum (if camera is on)
    this._manager = manager;

    // it would be better to use "this.label" here for a pure text string. We'll do it this way just to show that you can use HTML too
    this.htmlElement = document.createElement("div");
    this.htmlElement.innerHTML = photoFile.name; // put the name of the photoFile.
  }

  private async setMarkerVisited(visitedFile: PhotoFile) {
    visitedFile.visited = true;
    const visitedSvg = await this._manager.visitedSvg;
    if (visitedSvg) {
      for (const gpMarker of this._manager.markerSet!.markers) {
        if (gpMarker.photoFile === visitedFile) {
          gpMarker.setImage(visitedSvg);
          break;
        }
      }
    }
  }

  private async hotSpotClicked(clickedFile: PhotoFile, _event: MouseEvent, viewer: PannellumViewer) {
    await this.setMarkerVisited(clickedFile);

    try {
      const viewerData = await this.getViewerData(clickedFile);
      if (viewerData) {
        viewer.newPanorama(viewerData.panoBlob, viewerData.config);
      }
    } catch (_error) {
      // do nothing.
    }
  }

  private hotSpotTooltip(file: PhotoFile, topDiv: HTMLElement) {
    const photoToolTip = file.getToolTip();
    topDiv.classList.add("pnlm-tooltip");
    photoToolTip.then((ttSpan: HTMLElement | string | undefined) => {
      const span = ttSpan as HTMLSpanElement;
      topDiv.appendChild(span);
      span.style.width = span.scrollWidth + "px";
      span.style.marginLeft = "0px"; // -(span.scrollWidth - topDiv.offsetWidth) / 2 + "px";
      span.style.marginTop = "28px"; // -span.scrollHeight - 12 + "px";
    }).catch((_err: any) => { });
  }

  private hotSpotSetStyle(distance: number, hs: PannellumHotSpot) {
    let maxDistance = this._manager.plugin.settings.maxDistance;

    // put reasonable limits on maxDistance or it doesn't look right.
    if (maxDistance > 80)
      maxDistance = 80;
    if (maxDistance < 40)
      maxDistance = 40;
    const minDistance = maxDistance / 10;

    if (distance < minDistance)
      distance = minDistance;
    if (distance > maxDistance)
      distance = maxDistance;

    // hsSize can range from 80 to 20.
    let hsSize: number = 80 - (70 * (distance - minDistance) / (maxDistance - minDistance));
    hsSize = Math.floor(hsSize);
    if (hsSize < 20)
      hsSize = 20;
    hs.div!.style.backgroundSize = `${hsSize}px ${hsSize}px`;
    const sizeString = `${hsSize}px`;
    hs.div!.style.width = sizeString;
    hs.div!.style.height = sizeString;
  }

  private static escapeKey() {
    FrontstageManager.closeModalFrontstage();
    IModelApp.viewManager.invalidateDecorationsAllViews();
    IModelApp.requestNextAnimation();
  }

  // tslint:disable:no-console
  private saveCorrections(correctedFile: PhotoFile, correctionMatrix: Matrix3d | undefined) {
    if (undefined === correctionMatrix)
      return;
    const result = YawPitchRollAngles.createFromMatrix3d(correctionMatrix);
    if (result) {
      correctedFile.correctionYaw = result.yaw.degrees;
      correctedFile.correctionPitch = result.pitch.degrees;
      correctedFile.correctionRoll = result.roll.degrees;
      correctedFile.correctionDir = GeoPhotoMarker.getCameraDirection(correctedFile, this._manager.plugin);
      correctedFile.saveFileInfo().then(() => { }).catch((_err) => { console.log("Error saving correction "); });
    }
  }

  // gets camera direction from marker settings.
  public static getCameraDirection(file: PhotoFile, plugin: GeoPhotoPlugin): number {
    let direction = 0;
    if (plugin.settings.directionFromPath && file.pathOrientation) {
      direction = plugin.settings.reversed ? file.pathOrientation + 180.0 : file.pathOrientation;
    } else if (file.gpsTrack) {
      direction = plugin.settings.reversed ? file.gpsTrack + 180.0 : file.gpsTrack;
    }
    if (direction > 360.0)
      direction -= 360.0;
    return direction;
  }

  // this method compares the distance between the path of the camera to the crossDistance criteria.
  private closeEnoughToCameraPath(centerPoint: Point3d, nextPoint: Point3d | undefined, previousPoint: Point3d | undefined, thisPoint: Point3d): boolean {
    const nextCalc = PointLineDistanceCalculator.create(centerPoint, nextPoint);
    const previousCalc = PointLineDistanceCalculator.create(centerPoint, previousPoint);
    if (!nextCalc && !previousCalc) {
      return true;
    }
    const settings = this._manager.plugin.settings;
    const nextDistance = nextCalc ? nextCalc.pointDistanceSq(thisPoint) : settings.maxDistance * settings.maxDistance * 100;
    const previousDistance = previousCalc ? previousCalc.pointDistanceSq(thisPoint) : settings.maxDistance * settings.maxDistance * 100.0;

    if ((nextDistance === 0.0) || (previousDistance === 0.0))
      return true;

    const crossDistance = (nextDistance <= previousDistance) ? nextCalc!.crossDistance(thisPoint) : previousCalc!.crossDistance(thisPoint);
    return crossDistance < this._manager.plugin.settings.maxCrossDistance;
  }

  // do some preliminary calculations, eliminate any that are too far from the path of the camera, or too close in horizontal angle from the eyepoint.
  private chooseNeighborsToDisplay(centerFile: PhotoFile, closeFiles: PhotoFile[], nextFile: PhotoFile | undefined, previousFile: PhotoFile | undefined): Neighbor[] {
    let neighbors: Neighbor[] = [];
    // get the bearings to each file.
    for (const file of closeFiles) {
      if (this.closeEnoughToCameraPath(centerFile.spatial!, nextFile ? nextFile.spatial! : undefined, previousFile ? previousFile.spatial! : undefined, file.spatial!)) {
        const delta = centerFile.spatial!.vectorTo(file.spatial!);
        const distance = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
        const initialYaw = AngleUtils.deltaToCompassDegrees(delta);
        neighbors.push({ file, delta, distance, initialYaw });
        // console.log(`closeFile:  ${file.name}, dist: ${distance}, yaw: ${yaw}, pitch ${pitch}, x: ${file.spatial!.x}, y: ${file.spatial!.y}`);
      }
    }

    // eliminate any have closer neighbors within tooCloseYaw and tooClosePitch.
    for (let iFile = 1; iFile < neighbors.length;) {
      let iTest = 0;
      for (; iTest < iFile; ++iTest) {
        const angle1 = neighbors[iFile].initialYaw;
        const angle2 = neighbors[iTest].initialYaw;
        const angleDifference = AngleUtils.absAngleDifference(angle1, angle2);
        if ((angleDifference < GeoPhotoMarker._tooCloseYaw) && (Math.abs(neighbors[iFile].distance - neighbors[iTest].distance) < GeoPhotoMarker._tooCloseDistance))
          break;
      }
      if (iTest < iFile)
        neighbors.splice(iFile, 1);
      else
        ++iFile;
    }
    // sort by distance so the markers from closer panoramas are in front
    if (neighbors.length > 1)
      neighbors = neighbors.sort((a: Neighbor, b: Neighbor) => b.distance - a.distance);
    return neighbors;
  }

  // calculate the hot spots to be displayed in the pannellum viewer for this marker.
  private calculateHotSpotsFromMatrix(closeNeighbors: Neighbor[], cameraDirection: number, correctionMatrix: Matrix3d, hotSpots: PannellumHotSpot[] | undefined): PannellumHotSpot[] {
    let newHotSpots: boolean = false;
    if (undefined === hotSpots) {
      hotSpots = [];
      newHotSpots = true;
    }

    // The origin is the center of the photo.
    const eyeHeight = this._manager.plugin.settings.eyeHeight;

    for (let iHotSpot = 0; iHotSpot < closeNeighbors.length; ++iHotSpot) {
      const neighbor = closeNeighbors[iHotSpot];
      // get the vector from the file position to the origin.
      const posVector: Vector3d = neighbor.delta;
      // but set z to 0.
      posVector.z = 0.0;
      // rotate it by the rotation matrix.
      const rotatedVector: Vector3d = correctionMatrix.multiplyVector(posVector);
      let yaw = AngleUtils.deltaToCompassDegrees(rotatedVector) - cameraDirection;
      if (yaw < -180.0)
        yaw += 360.0;
      if (yaw > 180.0)
        yaw -= 360.0;
      const pitch = Math.atan2(eyeHeight + rotatedVector.z, neighbor.distance) * -180.0 / Math.PI;
      if (newHotSpots) {
        hotSpots.push({
          yaw,
          pitch,
          cssClassName: neighbor.file.visited ? "pnlm-visited-marker" : "pnlm-pin-marker",
          createTooltipFunc: this.hotSpotTooltip.bind(this, neighbor.file),
          clickHandlerFunc: this.hotSpotClicked.bind(this, neighbor.file),
          styleFunc: this.hotSpotSetStyle.bind(this, neighbor.distance),
        });
      } else {
        if (iHotSpot > hotSpots.length) {
          // tslint:disable-next-line:no-debugger
          debugger;
        }
        hotSpots[iHotSpot].yaw = yaw;
        hotSpots[iHotSpot].pitch = pitch;
      }
    }

    return hotSpots;
  }

  private calculateHotSpotChanges(panoFile: PhotoFile, closeNeighbors: Neighbor[], baseRotation: Matrix3d, existingHotSpots: PannellumHotSpot[], _centerYaw: number, yawChange: number, pitchChange: number): Matrix3d | undefined {
    const cameraDirection = GeoPhotoMarker.getCameraDirection(panoFile, this._manager.plugin);

    // from the existing normal and yawChange, pitchChange, calculate a new normal.
    const ypr = YawPitchRollAngles.createDegrees(yawChange, pitchChange, 0.0);
    const changeMatrix = ypr.toMatrix3d();
    if (undefined === changeMatrix)
      return undefined;
    const newMatrix = changeMatrix.multiplyMatrixMatrix(baseRotation);
    this.calculateHotSpotsFromMatrix(closeNeighbors, cameraDirection, newMatrix, existingHotSpots);
    return newMatrix;
  }

  private async openAdjacentPanorama(adjacentFile: PhotoFile, viewer: PannellumViewer) {
    await this.setMarkerVisited(adjacentFile);
    try {
      const viewerData = await this.getViewerData(adjacentFile);
      if (viewerData) {
        viewer.newPanorama(viewerData.panoBlob, viewerData.config);
      }
    } catch (_error) {
      // do nothing.
    }
  }

  private getMarkerDisplaySettings(_photoFile: PhotoFile): MarkerDisplaySettings {
    const settings: GeoPhotoSettings = this._manager.plugin.settings!;
    return { showMarkers: settings.showMarkers, fromTrack: !settings.directionFromPath, fromPath: settings.directionFromPath, reversed: settings.reversed };
  }

  private setMarkerDisplaySettings(_photoFile: PhotoFile, whichButton: number): boolean {
    const settings: GeoPhotoSettings = this._manager.plugin.settings;
    let change: boolean = false;
    switch (whichButton) {
      case 1:
        // show markers button
        // toggle it.
        settings.showMarkers = !settings.showMarkers;
        if (this._manager.plugin.uiProvider)
          this._manager.plugin.uiProvider.syncShowMarkers();
        break;
      case 2:
        // fromTrack button;
        // ignore if markers off.
        if (settings.showMarkers) {
          if (settings.directionFromPath) {
            settings.directionFromPath = false;
            change = true;
          }
        }
        break;
      case 3:
        // fromPath button
        if (settings.showMarkers) {
          if (!settings.directionFromPath) {
            settings.directionFromPath = true;
            change = true;
          }
        }
        break;
      case 4:
        // reverse button
        if (settings.showMarkers) {
          // toggle reversed.
          settings.reversed = !settings.reversed;
          change = true;
        }
        break;
    }
    return change;
  }

  private synchSettings(photoFile: PhotoFile) {
    const gpsTrack: number = (undefined === photoFile.gpsTrack) ? 0 : photoFile.gpsTrack;
    const pathOrientation: number = (undefined === photoFile.pathOrientation) ? gpsTrack : photoFile.pathOrientation;
    const settings = this._manager.plugin.settings;
    if (photoFile.correctionDir !== undefined) {
      const gpsTrackDelta: number = Math.abs(photoFile.correctionDir - gpsTrack);
      const pathDelta: number = Math.abs(photoFile.correctionDir - pathOrientation);
      if (gpsTrackDelta < 0.01) {
        settings.directionFromPath = false;
        settings.reversed = false;
      } else if (Math.abs(gpsTrackDelta - 180.0) < 0.01) {
        settings.directionFromPath = false;
        settings.reversed = true;
      } else if (pathDelta < 0.01) {
        settings.directionFromPath = true;
        settings.reversed = false;
      } else if (Math.abs(pathDelta - 180.0) < 0.01) {
        settings.directionFromPath = true;
        settings.reversed = true;
      }
    }
  }

  private async getViewerData(photoFile: PhotoFile): Promise<ViewerData | undefined> {
    const maxDistance = this._manager.plugin.settings.maxDistance;
    const title = photoFile.name;
    const config: PannellumViewerConfig = { title, escapeKeyFunc: GeoPhotoMarker.escapeKey };
    const fileContentsPromise: Promise<ArrayBuffer> = photoFile.getFileContents();
    const closestNeighborPromise: Promise<PhotoFile[]> = photoFile.getClosestNeighbors(true, maxDistance);
    const nextPanoramaPromise: Promise<PhotoFile | undefined> = photoFile.getNextPanorama(true);
    const previousPanoramaPromise: Promise<PhotoFile | undefined> = photoFile.getPreviousPanorama(true);
    const correctionYaw: number = (undefined === photoFile.correctionYaw) ? 0.0 : photoFile.correctionYaw;
    const correctionPitch: number = (undefined === photoFile.correctionPitch) ? 0.0 : photoFile.correctionPitch;
    const correctionRoll: number = (undefined === photoFile.correctionRoll) ? 0.0 : photoFile.correctionRoll;
    // console.log("correction yaw: ", correctionYaw, "pitch:", correctionPitch, "roll:", correctionRoll);
    const baseYPR = YawPitchRollAngles.createDegrees(correctionYaw, correctionPitch, correctionRoll);
    const baseRotation = baseYPR.toMatrix3d();
    try {
      const values: any[] = await Promise.all([fileContentsPromise, closestNeighborPromise, nextPanoramaPromise, previousPanoramaPromise]);
      const panoBlob: Blob = new Blob([values[0]], { type: "image/jpeg" });
      const nextPanorama: PhotoFile | undefined = values[2];
      const previousPanorama: PhotoFile | undefined = values[3];
      photoFile.getPathOrientation(nextPanorama, previousPanorama);
      this.synchSettings(photoFile);
      const closeFiles: PhotoFile[] = values[1];
      const closeNeighbors: Neighbor[] = this.chooseNeighborsToDisplay(photoFile, closeFiles, nextPanorama, previousPanorama);

      // console.log(`thisFile:  ${photoFile.name}, x: ${photoFile.spatial!.x}, y: ${photoFile.spatial!.y}`);

      if ((baseRotation !== undefined) && closeFiles.length > 0) {
        const cameraDirection = GeoPhotoMarker.getCameraDirection(photoFile, this._manager.plugin);
        const hotSpots: PannellumHotSpot[] = this.calculateHotSpotsFromMatrix(closeNeighbors, cameraDirection, baseRotation, undefined);
        if (hotSpots.length > 0) {
          config.hotSpots = hotSpots;
          config.saveCorrectionFunc = this.saveCorrections.bind(this, photoFile);
          config.hotSpotCalculationFunc = this.calculateHotSpotChanges.bind(this, photoFile, closeNeighbors);
          config.baseRotation = baseRotation;
          config.nextPanoramaFunc = nextPanorama ? this.openAdjacentPanorama.bind(this, nextPanorama) : undefined;
          config.nextPanoramaName = nextPanorama ? nextPanorama.name : undefined;
          config.previousPanoramaFunc = previousPanorama ? this.openAdjacentPanorama.bind(this, previousPanorama) : undefined;
          config.previousPanoramaName = previousPanorama ? previousPanorama.name : undefined;
          config.getMarkerDisplayFunc = this.getMarkerDisplaySettings.bind(this, photoFile);
          config.setMarkerFunc = this.setMarkerDisplaySettings.bind(this, photoFile);
          // config.hotSpotDebug = true;
        } else {
          config.hotSpots = [];
          config.saveCorrectionFunc = undefined;
          config.hotSpotCalculationFunc = undefined;
        }
      }
      return { panoBlob, photoFile, config };
    } catch (error) {
      return undefined;
    }
  }

  public onMouseButton(ev: BeButtonEvent): boolean {
    try {
      this.doMouseDown(ev); // tslint:disable-line: no-floating-promises
    } catch (err) { }
    return true;
  }

  private async doMouseDown(ev: BeButtonEvent) {
    if (ev.button === BeButton.Data) {
      if (ev.isDown) {
        if (this.photoFile.isPanorama) {
          this.photoFile.visited = true;
          const visitedSvg = await this._manager.visitedSvg!;
          if (visitedSvg)
            this.setImage(visitedSvg);
          if (0 !== (ev.keyModifiers & (BeModifierKeys.Shift | BeModifierKeys.Control))) {
            // this opens the pannellum viewer in a separate tab (on Chrome)
            const title = this.photoFile.name;
            const encodedURL = encodeURIComponent(this.photoFile.accessUrl);
            const pannellumURL = `http://cdn.pannellum.org/2.5/pannellum.htm#panorama=${encodedURL}&autoLoad=true&title=${title}`;
            window.open(pannellumURL);
          } else {
            try {
              // open the Pannellum frontstage.
              const viewerData = await this.getViewerData(this.photoFile);
              if (viewerData) {
                await PannellumModalFrontstage.open(viewerData.panoBlob, viewerData.photoFile, viewerData.config, this._manager.plugin);
              }
            } catch (error) {
              // tslint:disable-next-line:no-console
              console.log(`Error attempting to display photo file ${this.photoFile.name}: ${error}`);
            }
          }
        } else {
          try {
            const contents: ArrayBuffer = await this.photoFile.getFileContents();
            const blob: Blob = new Blob([contents], { type: "image/jpeg" });
            const url: string = URL.createObjectURL(blob);
            const newWindow = window.open(url);
            if (newWindow)
              newWindow.document.title = this.photoFile.name;
          } catch (error) {
            // tslint:disable-next-line:no-console
            console.log(`Error attempting to display photo file ${this.photoFile.name}: ${error}`);
          }
        }
      }
    }
  }

  public static get amber() { return GeoPhotoMarker._amber; }

  public addMarker(context: DecorateContext) {
    super.addMarker(context);
    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration);
    const ellipse = Arc3d.createScaledXYColumns(this.worldLocation, context.viewport.rotation.transpose(), .2, .2, GeoPhotoMarker._sweep360);
    builder.setSymbology(ColorDef.white, this._color, 1);
    builder.addArc(ellipse, false, false);
    builder.setBlankingFill(this._color);
    builder.addArc(ellipse, true, true);
    context.addDecorationFromBuilder(builder);
  }

  public pick(pt: XAndY): boolean {
    if (undefined === this.imageOffset)
      return super.pick(pt);
    // Adjust marker's view rect to account for image scale and offset...
    const imageRect = this.rect.clone();
    const offsetX = (undefined === this._scaleFactor ? this.imageOffset.x : this.imageOffset.x * this._scaleFactor.x);
    const offsetY = (undefined === this._scaleFactor ? this.imageOffset.y : this.imageOffset.y * this._scaleFactor.y);
    imageRect.top -= offsetY;
    imageRect.bottom -= offsetY;
    imageRect.left -= offsetX;
    imageRect.right -= offsetX;
    return imageRect.containsPoint(pt);
  }

}

/** A Marker used to show a cluster of GeoPhotos */
class GeoPhotoClusterMarker extends Marker {
  private _clusterColor: string;

  // draw the cluster marker as a white circle with an outline color based on what's in the cluster
  public drawFunc(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.strokeStyle = this._clusterColor;
    ctx.fillStyle = "white";
    ctx.lineWidth = 5;
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /** Create a new cluster marker with label and color based on the content of the cluster */
  constructor(location: XYAndZ, size: XAndY, cluster: Cluster<GeoPhotoMarker>, image: Promise<MarkerImage>) {
    super(location, size);

    this.imageOffset = new Point3d(0, 28);
    this.imageSize = new Point2d(30, 30);
    this.label = cluster.markers.length.toLocaleString();
    this.labelColor = "black";
    this.labelFont = "bold 14px san-serif";

    this.title = "test";
    this._clusterColor = GeoPhotoMarker.amber.toHexString();
    this.setImage(image);
  }
}

/** A MarkerSet to hold geotagged Photo markers. This class supplies the `getClusterMarker` method to create GeoPhotoClusterMarkers. */
class GeoPhotoMarkerSet extends MarkerSet<GeoPhotoMarker> {
  public minimumClusterSize = 3;

  constructor(private _markerManager: GeoPhotoMarkerManager) {
    super();
    this._markerManager.traverseTree(this.createMarkers.bind(this));
  }

  private async createMarkers(photoFile: PhotoFile) {
    if (undefined !== photoFile.spatial) {
      const icon = await this._markerManager.getMarkerImage(photoFile.visited, photoFile.isPanorama);
      this.markers.add(new GeoPhotoMarker(photoFile.spatial, photoFile, icon!, this._markerManager));
    }
  }

  protected getClusterMarker(cluster: Cluster<GeoPhotoMarker>): Marker {
    let numberVisited = 0;
    for (const marker of cluster.markers) {
      if (marker.photoFile.visited)
        numberVisited++;
    }

    const visited = (numberVisited * 3) > (cluster.markers.length * 2);
    return GeoPhotoClusterMarker.makeFrom(cluster.markers[0], cluster, this._markerManager.getMarkerImage(visited, true));
  }
}

// class that holds the markers from the GeoPhotos tree.
export class GeoPhotoMarkerManager implements Decorator {
  private _jpgSvg: Promise<HTMLImageElement | undefined>;
  private _panoSvg: Promise<HTMLImageElement | undefined>;
  public visitedSvg: Promise<HTMLImageElement | undefined>;
  public markerSet: GeoPhotoMarkerSet | undefined;
  private _decorating: boolean;

  constructor(public plugin: GeoPhotoPlugin, private _geoPhotos: GeoPhotos) {
    this._jpgSvg = imageElementFromUrl(this.plugin.resolveResourceUrl("jpeg_pin.svg"));
    this._panoSvg = imageElementFromUrl(this.plugin.resolveResourceUrl("pano_pin.svg"));
    this.visitedSvg = imageElementFromUrl(this.plugin.resolveResourceUrl("visited_pin.svg"));
    this.markerSet = undefined;
    this._decorating = false;
  }

  public traverseTree(traverseMethod: PhotoTraverseFunction) {
    this._geoPhotos.traverseTree(traverseMethod, true).catch((error) => {
      // tslint:disable-next-line:no-console
      console.log(`Error traversing PhotoFile tree: ${error}`);
    });
  }

  public async getMarkerImage(isVisited: boolean, isPanorama: boolean): Promise<HTMLImageElement | undefined> {
    if (isVisited)
      return this.visitedSvg;
    return isPanorama ? this._panoSvg : this._jpgSvg;
  }

  /** Creates and starts displaying the GeoPhoto markers */
  public async startDecorating() {
    // do not start making markers until the image is.
    await Promise.all([this._jpgSvg, this._panoSvg, this.visitedSvg]);
    if (undefined === this.markerSet) {
      this.markerSet = new GeoPhotoMarkerSet(this);
      IModelApp.viewManager.addDecorator(this);
      this._decorating = true;
    }
  }

  /** Stops drawing the GeoPhoto markers */
  public stopDecorating() {
    IModelApp.viewManager.dropDecorator(this);
    this._decorating = false;
  }

  /** Returns true if currently showing GeoPhoto markers */
  public nowDecorating(): boolean {
    return this._decorating;
  }

  /** This class is added as a ViewManager.decorator in the startDecorating method. This is the callback for drawing the decorations */
  public decorate(context: DecorateContext) {
    if (!context.viewport.view.isSpatialView())
      return;

    if (context.viewport.view.iModel !== this._geoPhotos.iModel)
      return;

    if (this.markerSet)
      this.markerSet.addDecoration(context);
  }
}

// class that calculates distances from a point to a line specified by two points. (see https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line)
class PointLineDistanceCalculator {
  private _p2: Point3d;
  private _distanceBetween: number;
  private _delta: Vector3d;
  private _factor: number;

  private constructor(p1: Point3d, p2: Point3d) {
    this._p2 = p2;
    this._delta = p1.vectorTo(p2);
    this._distanceBetween = Math.sqrt(this._delta.x * this._delta.x + this._delta.y * this._delta.y);
    this._factor = p2.x * p1.y - p2.y * p1.x;
  }

  // creates the PointLineDistanceCalculator, return undefined if either point is undefined.
  public static create(p1: Point3d | undefined, p2: Point3d | undefined): PointLineDistanceCalculator | undefined {
    if ((p1 === undefined) || (p2 === undefined))
      return undefined;
    return new PointLineDistanceCalculator(p1, p2);
  }

  // return distance to second point, squared.
  public pointDistanceSq(point: Point3d) {
    const delta = this._p2.vectorTo(point);
    return (delta.x * delta.x + delta.y * delta.y);
  }

  // returns the distance from point to the line p1, p2.
  public crossDistance(point: Point3d): number {
    return Math.abs(this._delta.y * point.x - this._delta.x * point.y + this._factor) / this._distanceBetween;
  }
}

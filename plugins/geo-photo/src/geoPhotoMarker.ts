/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AngleSweep, Arc3d, Point2d, Point3d, XAndY, XYAndZ } from "@bentley/geometry-core";
import { ColorByName, ColorDef } from "@bentley/imodeljs-common";
import {
  BeButton, BeButtonEvent, BeModifierKeys, Cluster, Decorator, DecorateContext, GraphicType, imageElementFromUrl,
  IModelApp, Marker, MarkerImage, MarkerSet,
} from "@bentley/imodeljs-frontend";
import { PhotoFile, PhotoTraverseFunction } from "./PhotoTree";
import { GeoPhotos, GeoPhotoPlugin } from "./geoPhoto";
import { PannellumModalFrontstage } from "./PannellumFrontStage";
import { PannellumHotSpot, PannellumViewerConfig, PannellumViewer } from "./pannellum/pannellumViewer";
import { FrontstageManager } from "@bentley/ui-framework";

// cSpell:ignore pano pnlm geotagged

interface Bearing {
  file: PhotoFile;
  distance: number;
  pitch: number;
  yaw: number;
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
  private static _tooClosePitch: number = 1.0;
  private _manager: GeoPhotoMarkerManager;
  private _color: ColorDef;
  public photoFile: PhotoFile;

  // tslint:disable:no-console
  private chooseNeighborsToDisplay(centerFile: PhotoFile, closeFiles: PhotoFile[]): Bearing[] {
    const eyeHeight = this._manager.plugin.settings.eyeHeight;
    const bearings: Bearing[] = [];
    // get the bearings to each file.
    for (const file of closeFiles) {
      const delta = centerFile.spatial!.vectorTo(file.spatial!);
      const yaw = Math.atan2(delta.x, delta.y) * 180.0 / Math.PI;
      const distance = Math.sqrt(delta.x * delta.x + delta.y * delta.y);
      const pitch = Math.atan2(eyeHeight, distance) * -180.0 / Math.PI;
      bearings.push({ file, distance, pitch, yaw });
      console.log(`closeFile:  ${file.name}, dist: ${distance}, yaw: ${yaw}, pitch ${pitch}, x: ${file.spatial!.x}, y: ${file.spatial!.y}`);
    }

    // eliminate any have closer neighbors within tooCloseYaw and tooClosePitch.
    for (let iFile = 1; iFile < bearings.length;) {
      let iTest = 0;
      for (; iTest < iFile; ++iTest) {
        let angle1 = bearings[iFile].yaw;
        let angle2 = bearings[iTest].yaw;
        if ((angle1 < 0) || (angle2 < 0)) {
          angle1 = angle1 + 180;
          angle2 = angle2 + 180;
        }
        if ((Math.abs(angle1 - angle2) < GeoPhotoMarker._tooCloseYaw) && (Math.abs(bearings[iFile].pitch - bearings[iTest].pitch) < GeoPhotoMarker._tooClosePitch))
          break;
      }
      if (iTest < iFile)
        bearings.splice(iFile, 1);
      else
        ++iFile;
    }
    return bearings;
  }

  private async hotSpotClicked(_event: MouseEvent, args: any[]) {
    const viewer: PannellumViewer = (args[0] as PannellumViewer);
    const photoFile: PhotoFile = (args[1] as Bearing).file;
    const manager: GeoPhotoMarkerManager = (args[2] as GeoPhotoMarkerManager);
    photoFile.visited = true;
    const visitedImage = await manager.visitedImage;
    if (visitedImage) {
      for (const gpMarker of manager.markerSet!.markers) {
        if (gpMarker.photoFile === photoFile) {
          gpMarker.setImage(visitedImage);
          break;
        }
      }
    }

    try {
      const viewerData = await this.getViewerData(photoFile, manager);
      if (viewerData) {
        viewer.newPanorama(viewerData.panoBlob, viewerData.config);
      }
    } catch (_error) {
      // do nothing.
    }
  }

  private static hotSpotTooltip(topDiv: HTMLElement, args: any[]) {
    const photoToolTip = (args[0] as Bearing).file.getToolTip();
    topDiv.classList.add("pnlm-tooltip");
    photoToolTip.then((ttSpan: HTMLElement | string | undefined) => {
      const span = ttSpan as HTMLSpanElement;
      topDiv.appendChild(span);
      span.style.width = span.scrollWidth + "px";
      span.style.marginLeft = "0px"; // -(span.scrollWidth - topDiv.offsetWidth) / 2 + "px";
      span.style.marginTop = "28px"; // -span.scrollHeight - 12 + "px";
    }).catch((_err) => { });
  }

  private hotSpotSetStyle(hs: PannellumHotSpot, args: any) {
    const minDistance = this._manager.plugin.settings.minDistance;
    const maxDistance = this._manager.plugin.settings.maxDistance;
    const hsBearing: Bearing = args[0] as Bearing;
    let distance = hsBearing.distance;
    if (distance < minDistance)
      distance = minDistance;
    let hsSize: number = 80 - (60 * (distance - minDistance) / (maxDistance - minDistance));
    hsSize = Math.floor(hsSize);
    hs.div!.style.backgroundSize = `${hsSize}px ${hsSize}px`;
    const sizeString = `${hsSize}px`;
    hs.div!.style.width = sizeString;
    hs.div!.style.height = sizeString;
  }

  private static escapeKey() {
    FrontstageManager.closeModalFrontstage();
  }

  private async getViewerData(photoFile: PhotoFile, manager: GeoPhotoMarkerManager): Promise<ViewerData | undefined> {
    const maxDistance = this._manager.plugin.settings.maxDistance;
    const title = photoFile.name;
    const config: PannellumViewerConfig = { title, escapeKeyFunc: GeoPhotoMarker.escapeKey };
    const fileContentsPromise: Promise<ArrayBuffer> = photoFile.getFileContents();
    const closestNeighborPromise: Promise<PhotoFile[]> = photoFile.getClosestNeighbors(true, maxDistance);
    const baseYaw = (undefined === photoFile.track) ? 0.0 : photoFile.track;
    try {
      const values: any[] = await Promise.all([fileContentsPromise, closestNeighborPromise]);
      const panoBlob: Blob = new Blob([values[0]], { type: "image/jpeg" });
      const closeFiles: PhotoFile[] = values[1];
      console.log(`thisFile:  ${photoFile.name}, x: ${photoFile.spatial!.x}, y: ${photoFile.spatial!.y}`);
      if (closeFiles.length > 0) {
        const displayedNeighbors: Bearing[] = this.chooseNeighborsToDisplay(photoFile, closeFiles);
        const hotSpots: PannellumHotSpot[] = [];
        for (const neighbor of displayedNeighbors) {
          const funcArgs = [neighbor, manager];
          // make sure yaw between -180 and +180.
          let yaw = neighbor.yaw - baseYaw;
          if (yaw < -180.0)
            yaw += 360.0;
          if (yaw > 180.0)
            yaw -= 360.0;
          const pitch = neighbor.pitch;
          hotSpots.push({
            yaw,
            pitch,
            cssClassName: neighbor.file.visited ? "pnlm-visited-marker" : "pnlm-pin-marker",
            createTooltipFunc: GeoPhotoMarker.hotSpotTooltip,
            createTooltipArgs: funcArgs,
            clickHandlerFunc: this.hotSpotClicked.bind(this),
            clickHandlerArgs: funcArgs,
            styleFunc: this.hotSpotSetStyle.bind(this),
            styleArgs: funcArgs,
          });
        }
        if (hotSpots.length > 0) {
          config.hotSpots = hotSpots;
          // config.hotSpotDebug = true;
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
          const newImage = await this._manager.visitedImage!;
          if (newImage)
            this.setImage(newImage);
          if (0 === (ev.keyModifiers & (BeModifierKeys.Shift | BeModifierKeys.Control))) {
            // this opens the pannellum viewer in a separate tab (on Chrome)
            const title = this.photoFile.name;
            const encodedURL = encodeURIComponent(this.photoFile.accessUrl);
            const pannellumURL = `http://cdn.pannellum.org/2.5/pannellum.htm#panorama=${encodedURL}&autoLoad=true&title=${title}`;
            window.open(pannellumURL);
          } else {
            try {
              // open the Pannellum frontstage.
              const viewerData = await this.getViewerData(this.photoFile, this._manager);
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
  private _jpgImage: Promise<HTMLImageElement | undefined>;
  private _panoImage: Promise<HTMLImageElement | undefined>;
  public visitedImage: Promise<HTMLImageElement | undefined>;
  public markerSet: GeoPhotoMarkerSet | undefined;
  private _decorating: boolean;

  constructor(public plugin: GeoPhotoPlugin, private _geoPhotos: GeoPhotos) {
    this._jpgImage = imageElementFromUrl(this.plugin.resolveResourceUrl("jpeg_pin.svg"));
    this._panoImage = imageElementFromUrl(this.plugin.resolveResourceUrl("pano_pin.svg"));
    this.visitedImage = imageElementFromUrl(this.plugin.resolveResourceUrl("visited_pin.svg"));
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
      return this.visitedImage;
    return isPanorama ? this._panoImage : this._jpgImage;
  }

  /** Creates and starts displaying the GeoPhoto markers */
  public async startDecorating() {
    // do not start making markers until the image is.
    await Promise.all([this._jpgImage, this._panoImage, this.visitedImage]);
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

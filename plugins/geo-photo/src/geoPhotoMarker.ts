/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AngleSweep, Arc3d, Point2d, Point3d, XAndY, XYAndZ } from "@bentley/geometry-core";
import { ColorByName, ColorDef } from "@bentley/imodeljs-common";
import {
  BeButton, BeButtonEvent, Cluster, Decorator, DecorateContext, GraphicType, imageElementFromUrl,
  IModelApp, Marker, MarkerImage, MarkerSet,
} from "@bentley/imodeljs-frontend";
import { PhotoFile, PhotoTraverseFunction } from "./PhotoTree";
import { GeoPhotos, GeoPhotoPlugin } from "./geoPhoto";
import { PannellumFrontstage } from "./PannellumFrontStage";

/** Marker positioned where there is a geotagged photograph. */
class GeoPhotoMarker extends Marker {
  private static _oldWay = true;
  private static _size = Point2d.create(30, 30);
  private static _imageSize = Point2d.create(40, 40);
  private static _imageOffset = Point2d.create(-8, 22);
  private static _amber = new ColorDef(ColorByName.amber);
  private static _sweep360 = AngleSweep.create360();
  private _plugin: GeoPhotoPlugin;
  private _color: ColorDef;
  private _photoFile: PhotoFile;

  public onMouseButton(ev: BeButtonEvent): boolean {
    if (ev.button === BeButton.Data) {
      if (ev.isDown) {
        if (this._photoFile.isPanorama) {
          if (GeoPhotoMarker._oldWay) {
            // this opens the pannellum viewer in a separate tab (on Chrome)
            const encodedURL = encodeURIComponent(this._photoFile.accessUrl);
            const title = this._photoFile.name;
            const pannellumURL = `http://cdn.pannellum.org/2.5/pannellum.htm#panorama=${encodedURL}&autoLoad=true&title=${title}`;
            window.open(pannellumURL);
          } else {
            // open the Pannellum frontstage.
            this._photoFile.getFileContents().then((contents: ArrayBuffer) => {
              const blob: Blob = new Blob([contents], { type: "image/jpeg" });
              PannellumFrontstage.open(blob, this._photoFile, this._plugin).then(() => { }).catch((_err) => { });
            }).catch((error) => {
              // tslint:disable-next-line:no-console
              console.log(`Error attempting to display photo file ${this._photoFile.name}: ${error}`);
            });
          }
        } else {
          this._photoFile.getFileContents().then((contents: ArrayBuffer) => {
            const blob: Blob = new Blob([contents], { type: "image/jpeg" });
            const url: string = URL.createObjectURL(blob);
            const newWindow = window.open(url);
            if (newWindow)
              newWindow.document.title = this._photoFile.name;
          }).catch((error) => {
            // tslint:disable-next-line:no-console
            console.log(`Error attempting to display photo file ${this._photoFile.name}: ${error}`);
          });
        }
      }
    }
    return true;
  }

  public static get amber() { return GeoPhotoMarker._amber; }

  /** Create a new GeoPhotoMarker */
  constructor(location: XYAndZ, photoFile: PhotoFile, icon: HTMLImageElement, plugin: GeoPhotoPlugin) {
    super(location, GeoPhotoMarker._size);
    this._color = GeoPhotoMarker._amber;
    this.setImage(icon); // save icon
    this.imageOffset = GeoPhotoMarker._imageOffset; // move icon up by 30 pixels
    this.imageSize = GeoPhotoMarker._imageSize; // 40x40
    this._photoFile = photoFile;
    // set the tooltip when promise resolves. We won't need it for a while anyway.
    this._photoFile.getToolTip().then((toolTip) => { this.title = toolTip; }).catch((_err) => { });
    this.setScaleFactor({ low: .2, high: 1.4 }); // make size 20% at back of frustum and 140% at front of frustum (if camera is on)
    this._plugin = plugin;

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
      const location = Point3d.fromJSON(photoFile.spatial);
      const icon = await this._markerManager.getMarkerImage(photoFile.isPanorama);
      this.markers.add(new GeoPhotoMarker(location, photoFile, icon!, this._markerManager.plugin));
    }
  }

  protected getClusterMarker(cluster: Cluster<GeoPhotoMarker>): Marker {
    return GeoPhotoClusterMarker.makeFrom(cluster.markers[0], cluster, this._markerManager.getMarkerImage(true));
  }
}

// class that holds the markers from the GeoPhotos tree.
export class GeoPhotoMarkerManager implements Decorator {
  private _jpgImage: Promise<HTMLImageElement | undefined>;
  private _panoImage: Promise<HTMLImageElement | undefined>;
  private _markerSet: GeoPhotoMarkerSet | undefined;
  private _decorating: boolean;

  constructor(public plugin: GeoPhotoPlugin, private _geoPhotos: GeoPhotos) {
    this._jpgImage = imageElementFromUrl(this.plugin.resolveResourceUrl("jpeg_pin.svg"));
    this._panoImage = imageElementFromUrl(this.plugin.resolveResourceUrl("pano_pin.svg"));
    this._markerSet = undefined;
    this._decorating = false;
  }

  public traverseTree(traverseMethod: PhotoTraverseFunction) {
    this._geoPhotos.traverseTree(traverseMethod, true).catch((error) => {
      // tslint:disable-next-line:no-console
      console.log(`Error traversing PhotoFile tree: ${error}`);
    });
  }

  public async getMarkerImage(isPanorama: boolean) {
    return isPanorama ? this._panoImage : this._jpgImage;
  }

  /** Creates and starts displaying the GeoPhoto markers */
  public async startDecorating() {
    // do not start making markers until the image is.
    await Promise.all([this._jpgImage, this._panoImage]);
    if (undefined === this._markerSet) {
      this._markerSet = new GeoPhotoMarkerSet(this);
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

    if (this._markerSet)
      this._markerSet.addDecoration(context);
  }
}

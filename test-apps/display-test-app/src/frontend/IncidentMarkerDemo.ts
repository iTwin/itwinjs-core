/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { AngleSweep, Arc3d, Point2d, Point3d, XAndY, XYAndZ } from "@bentley/geometry-core";
import { AxisAlignedBox3d, ColorByName, ColorDef } from "@bentley/imodeljs-common";
import {
  BeButton, BeButtonEvent, Cluster, DecorateContext, GraphicType, imageElementFromUrl,
  IModelApp, Marker, MarkerImage, MarkerSet, MessageBoxIconType, MessageBoxType,
} from "@bentley/imodeljs-frontend";

/** Example Marker to show an *incident*. Each incident has an *id*, a *severity*, and an *icon*. */
class IncidentMarker extends Marker {
  private static _size = Point2d.create(30, 30);
  private static _imageSize = Point2d.create(40, 40);
  private static _imageOffset = Point2d.create(0, 30);
  private static _amber = new ColorDef(ColorByName.amber);
  private static _sweep360 = AngleSweep.create360();
  private _color: ColorDef;

  /** This makes the icon only show when the cursor is over an incident marker. */
  // public get wantImage() { return this._isHilited; }

  /** Get a color based on severity by interpolating Green(0) -> Amber(15) -> Red(30)  */
  public static makeColor(severity: number): ColorDef {
    return (severity <= 16 ? ColorDef.green.lerp(this._amber, (severity - 1) / 15.) :
      this._amber.lerp(ColorDef.red, (severity - 16) / 14.));
  }

  public onMouseButton(ev: BeButtonEvent): boolean {
    if (ev.button === BeButton.Data) {
      if (ev.isDown) {
        IModelApp.notifications.openMessageBox(MessageBoxType.LargeOk, "severity = " + this.severity, MessageBoxIconType.Information); // tslint:disable-line:no-floating-promises
      }
    }
    return true;
  }

  /** Create a new IncidentMarker */
  constructor(location: XYAndZ, public severity: number, public id: number, icon: Promise<HTMLImageElement>) {
    super(location, IncidentMarker._size);
    this._color = IncidentMarker.makeColor(severity); // color interpolated from severity
    this.setImage(icon); // save icon
    this.imageOffset = IncidentMarker._imageOffset; // move icon up by 30 pixels
    this.imageSize = IncidentMarker._imageSize; // 40x40
    this.labelFont = "italic 14px san-serif"; // use italic so incidents look different than Clusters
    // this.label = severity.toLocaleString(); // label with severity
    this.title = "Severity: " + severity + "<br>Id: " + id; // tooltip
    this.setScaleFactor({ low: .2, high: 1.4 }); // make size 20% at back of frustum and 140% at front of frustum (if camera is on)
  }

  public addMarker(context: DecorateContext) {
    super.addMarker(context);
    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration);
    const ellipse = Arc3d.createScaledXYColumns(this.worldLocation, context.viewport.rotation.transpose(), .2, .2, IncidentMarker._sweep360);
    builder.setSymbology(ColorDef.white, this._color, 1);
    builder.addArc(ellipse, false, false);
    builder.setBlankingFill(this._color);
    builder.addArc(ellipse, true, true);
    context.addDecorationFromBuilder(builder);
  }
}

/** A Marker used to show a cluster of incidents */
class IncidentClusterMarker extends Marker {
  private _clusterColor: string;
  // public get wantImage() { return this._isHilited; }

  // draw the cluster as a white circle with an outline color based on what's in the cluster
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
  constructor(location: XYAndZ, size: XAndY, cluster: Cluster<IncidentMarker>, image: Promise<MarkerImage>) {
    super(location, size);

    // get the top 10 incidents by severity
    const sorted: IncidentMarker[] = [];
    const maxLen = 10;
    cluster.markers.forEach((marker) => {
      if (maxLen > sorted.length || marker.severity > sorted[sorted.length - 1].severity) {
        const index = sorted.findIndex((val) => val.severity < marker.severity);
        if (index === -1)
          sorted.push(marker);
        else
          sorted.splice(index, 0, marker);
        if (sorted.length > maxLen)
          sorted.length = maxLen;
      }
    });

    this.imageOffset = new Point3d(0, 28);
    this.imageSize = new Point2d(30, 30);
    this.label = cluster.markers.length.toLocaleString();
    this.labelColor = "black";
    this.labelFont = "bold 14px san-serif";

    let title = "";
    sorted.forEach((marker) => {
      if (title !== "")
        title += "<br>";
      title += "Severity: " + marker.severity + " Id: " + marker.id;
    });
    if (cluster.markers.length > maxLen)
      title += "<br>...";

    this.title = title;
    this._clusterColor = IncidentMarker.makeColor(sorted[0].severity).toHexString();
    this.setImage(image);
  }
}

/** A MarkerSet to hold incidents. This class supplies to `getClusterMarker` method to create IncidentClusterMarkers. */
class IncidentMarkerSet extends MarkerSet<IncidentMarker> {
  protected getClusterMarker(cluster: Cluster<IncidentMarker>): Marker {
    return IncidentClusterMarker.makeFrom(cluster.markers[0], cluster, IncidentMarkerDemo.warningSign);
  }
}

/** This demo shows how to use MarkerSets to cluster markers that overlap on the screen. It creates a set of 500
 * "incidents" at random locations within the ProjectExtents. For each incident, it creates an IncidentMarker with an Id and
 * with a random value between 1-30 for "severity", and one of 5 possible icons.
 */
export class IncidentMarkerDemo {
  public static warningSign?: HTMLImageElement;
  private _incidents = new IncidentMarkerSet();
  private static _decorator?: IncidentMarkerDemo; // static variable just so we can tell if the demo is active.

  private constructor(extents: AxisAlignedBox3d) {
    const markerIcons = [
      imageElementFromUrl("Hazard_biological.svg"),
      imageElementFromUrl("Hazard_electric.svg"),
      imageElementFromUrl("Hazard_flammable.svg"),
      imageElementFromUrl("Hazard_toxic.svg"),
      imageElementFromUrl("Hazard_tripping.svg"),
    ];

    if (undefined === IncidentMarkerDemo.warningSign)
      imageElementFromUrl("Warning_sign.svg").then((image) => IncidentMarkerDemo.warningSign = image); // tslint:disable-line:no-floating-promises

    const pos = new Point3d();
    for (let i = 0; i < 500; ++i) {
      pos.x = extents.low.x + (Math.random() * extents.xLength());
      pos.y = extents.low.y + (Math.random() * extents.yLength());
      pos.z = extents.low.z + (Math.random() * extents.zLength());
      this._incidents.markers.add(new IncidentMarker(pos, 1 + Math.round(Math.random() * 29), i, markerIcons[i % markerIcons.length]));
    }
  }

  /** We added this class as a ViewManager.decorator below. This method is called to ask for our decorations. We add the MarkerSet. */
  public decorate(context: DecorateContext) {
    if (context.viewport.view.isSpatialView())
      this._incidents.addDecoration(context);
  }

  /** Turn the markers on and off. Each time it runs it creates a new random set of incidents. */
  public static toggle(extents: AxisAlignedBox3d) {
    if (undefined === IncidentMarkerDemo._decorator) {
      // start the demo by creating the IncidentMarkerDemo object and adding it as a ViewManager decorator.
      IncidentMarkerDemo._decorator = new IncidentMarkerDemo(extents);
      IModelApp.viewManager.addDecorator(IncidentMarkerDemo._decorator);
    } else {
      // stop the demo
      IModelApp.viewManager.dropDecorator(IncidentMarkerDemo._decorator);
      IncidentMarkerDemo._decorator = undefined;
    }
  }
}

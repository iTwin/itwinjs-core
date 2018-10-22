/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { DecorateContext, HitDetail, IModelConnection, ImageUtil, IModelApp, MarkerSet, Marker, MarkerImage, Cluster } from "@bentley/imodeljs-frontend";
import { GraphicType } from "@bentley/imodeljs-frontend/lib/rendering";
import { ColorDef, NpcCenter, ColorByName } from "@bentley/imodeljs-common";
import { Point3d, XYAndZ, XAndY, Point2d } from "@bentley/geometry-core";

export class ExampleGraphicDecoration {
  // __PUBLISH_EXTRACT_START__ View_Graphic_Decoration
  /** Add a world decoration to display 3d graphics showing the project extents interspersed with the scene graphics. */
  public decorate(context: DecorateContext): void {
    // Check view type, project extents is only applicable to show in spatial views.
    const vp = context.viewport;
    if (!vp.view.isSpatialView())
      return;

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined);
    // Set edge color to white or black depending on current view background color and set line weight to 2.
    builder.setSymbology(vp.getContrastToBackgroundColor(), ColorDef.black, 2);
    // Add range box edge geometry to builder.
    builder.addRangeBox(vp.iModel.projectExtents);
    context.addDecorationFromBuilder(builder);
  }
  // __PUBLISH_EXTRACT_END__
}

export class ExamplePickableGraphicDecoration {
  // __PUBLISH_EXTRACT_START__ Pickable_View_Graphic_Decoration
  protected _decoId?: string;

  /** Add a pickable decoration that will display interspersed with the scene graphics. */
  public decorate(context: DecorateContext): void {
    const vp = context.viewport;
    if (!vp.view.isSpatialView())
      return;

    // Get next available Id to represent our decoration for it's life span.
    if (undefined === this._decoId)
      this._decoId = vp.iModel.transientIds.next;

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration, undefined, this._decoId);
    builder.setSymbology(vp.getContrastToBackgroundColor(), ColorDef.black, 2);
    builder.addRangeBox(vp.iModel.projectExtents);
    context.addDecorationFromBuilder(builder);
  }

  /** Return true if supplied Id represents a pickable decoration created by this decorator. */
  public testDecorationHit(id: string): boolean { return id === this._decoId; }

  /** Return localized tooltip message for the decoration identified by HitDetail.sourceId. */
  public async getDecorationToolTip(_hit: HitDetail): Promise<HTMLElement | string> { return "Project Extents"; }
  // __PUBLISH_EXTRACT_END__
}

export class ExampleCanvasDecoration {
  // __PUBLISH_EXTRACT_START__ Canvas_Decoration
  /** Add a canvas decoration using CanvasRenderingContext2D to show a plus symbol. */
  public decorate(context: DecorateContext): void {
    const vp = context.viewport;
    const size = Math.floor(vp.pixelsPerInch * 0.25) + 0.5;
    const sizeOutline = size + 1;
    const position = context.viewport.npcToView(NpcCenter); position.x = Math.floor(position.x) + 0.5; position.y = Math.floor(position.y) + 0.5;
    const drawDecoration = (ctx: CanvasRenderingContext2D) => {
      // Show black outline (with shadow) around white line for good visibility regardless of view background color.
      ctx.beginPath();
      ctx.strokeStyle = "rgba(0,0,0,.5)";
      ctx.lineWidth = 3;
      ctx.moveTo(-sizeOutline, 0);
      ctx.lineTo(sizeOutline, 0);
      ctx.moveTo(0, -sizeOutline);
      ctx.lineTo(0, sizeOutline);
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.shadowColor = "black";
      ctx.shadowBlur = 5;
      ctx.moveTo(-size, 0);
      ctx.lineTo(size, 0);
      ctx.moveTo(0, -size);
      ctx.lineTo(0, size);
      ctx.stroke();
    };
    context.addCanvasDecoration({ position, drawDecoration });
  }
  // __PUBLISH_EXTRACT_END__
}

// __PUBLISH_EXTRACT_START__ MarkerSet_Decoration
/** Example Marker to show an *incident*. Each incident has an *id*, a *severity*, and an *icon*. */
class IncidentMarker extends Marker {
  private static _size = Point2d.create(30, 30);
  private static _imageSize = Point2d.create(40, 40);
  private static _imageOffset = Point2d.create(0, 30);
  private static _amber = new ColorDef(ColorByName.amber);

  /** Get a color based on severity by interpolating Green(0) -> Amber(15) -> Red(30)  */
  public static makeColor(severity: number): ColorDef {
    return (severity <= 16 ? ColorDef.green.lerp(this._amber, (severity - 1) / 15.) :
      this._amber.lerp(ColorDef.red, (severity - 16) / 14.));
  }

  /** Create a new IncidentMarker */
  constructor(location: XYAndZ, public severity: number, public id: number, icon: Promise<HTMLImageElement>) {
    super(location, IncidentMarker._size);
    this.setImage(icon); // save icon
    this.imageOffset = IncidentMarker._imageOffset; // move icon up by 30 pixels
    this.imageSize = IncidentMarker._imageSize; // 40x40
    this.labelFont = "italic 14px san-serif"; // use italic so incidents look different than Clusters
    this.title = "Severity: " + severity + "<br>Id: " + id; // tooltip
    this.setScaleFactor({ low: .2, high: 1.4 }); // make size 20% at back of frustum and 140% at front of frustum (if camera is on)
  }
}

/** A Marker used to show a cluster of incidents */
class IncidentClusterMarker extends Marker {
  private _clusterColor: string;

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

  public constructor(iModel: IModelConnection) {
    const makerIcons = [
      ImageUtil.fromUrl("Hazard_biological.svg"),
      ImageUtil.fromUrl("Hazard_electric.svg"),
      ImageUtil.fromUrl("Hazard_flammable.svg"),
      ImageUtil.fromUrl("Hazard_toxic.svg"),
      ImageUtil.fromUrl("Hazard_tripping.svg"),
    ];

    if (undefined === IncidentMarkerDemo.warningSign)
      ImageUtil.fromUrl("Warning_sign.svg").then((image) => IncidentMarkerDemo.warningSign = image);

    const extents = iModel!.projectExtents;
    const pos = new Point3d();
    for (let i = 0; i < 500; ++i) {
      pos.x = extents.low.x + (Math.random() * extents.xLength());
      pos.y = extents.low.y + (Math.random() * extents.yLength());
      pos.z = extents.low.z + (Math.random() * extents.zLength());
      this._incidents.markers.add(new IncidentMarker(pos, 1 + Math.round(Math.random() * 29), i, makerIcons[i % makerIcons.length]));
    }
  }

  /** We added this class as a ViewManager.decorator below. This method is called to ask for our decorations. We add the MarkerSet. */
  public decorate(context: DecorateContext) {
    if (context.viewport.view.isSpatialView())
      this._incidents.addDecoration(context);
  }

  /** Turn the markers on and off. Each time it runs it creates a new random set of incidents. */
  public static toggle(iModel: IModelConnection) {
    if (undefined === IncidentMarkerDemo._decorator) {
      // start the demo by creating the demo object and adding it as a ViewManager decorator.
      IncidentMarkerDemo._decorator = new IncidentMarkerDemo(iModel);
      IModelApp.viewManager.addDecorator(IncidentMarkerDemo._decorator);
    } else {
      // stop the demo
      IModelApp.viewManager.dropDecorator(IncidentMarkerDemo._decorator);
      IncidentMarkerDemo._decorator = undefined;
    }
  }
}
// __PUBLISH_EXTRACT_END__

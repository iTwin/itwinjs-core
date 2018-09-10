/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point2d, Point3d, XAndY, XYAndZ, Range1d, Range1dProps, Geometry, Matrix4d } from "@bentley/geometry-core";
import { ImageUtil } from "./ImageUtil";
import { DecorateContext } from "./ViewContext";
import { Overlay2dDecoration } from "./render/System";
import { ViewRect, Viewport } from "./Viewport";
import { BeButtonEvent } from "./tools/Tool";
import { ColorDef } from "@bentley/imodeljs-common";
import { ToolTipOptions } from "./NotificationManager";

export type MarkerImage = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap;

/**
 * A Marker is a Overlay2dDecoration, drawn on the screen based on a fixed location in world space.
 *
 */
export class Marker implements Overlay2dDecoration {
  public visible = true;
  protected _isHilited = false;
  protected _hiliteColor?: ColorDef;
  public worldLocation: Point3d;
  /** The size of this Marker, in pixels. */
  public size: Point2d;
  /** The current position for the maker, in view coordinates. This value will be updated by calls to [[setPosition]]. */
  public position: Point3d;
  public readonly rect = new ViewRect();
  public image?: MarkerImage;
  public imageOffset?: XAndY;
  public imageSize?: XAndY;
  public label?: string;
  public labelOffset?: XAndY;
  public labelColor?: string;
  public labelAlign?: string;
  public labelBaseline?: string;
  public labelFont?: string;
  public title?: string;
  public scaleFactor?: Point2d;
  public tooltipOptions?: ToolTipOptions;
  protected _scaleFactorRange?: Range1d;

  public get wantImage() { return true; }
  public drawFunc?(ctx: CanvasRenderingContext2D): void;

  public onMouseEnter(ev: BeButtonEvent) { this._isHilited = true; this._hiliteColor = ev.viewport!.hilite.color; }
  public onMouseLeave() { this._isHilited = false; }
  public onMouseMove(ev: BeButtonEvent): void {
    if (this.title)
      ev.viewport!.openToolTip(this.title, ev.viewPoint, this.tooltipOptions);
  }

  public pick(pt: XAndY): boolean { return this.rect.containsPoint(pt); }
  public setScaleFactor(range: Range1dProps) {
    this._scaleFactorRange = Range1d.fromJSON(range);
    this.scaleFactor = Point2d.create(1, 1);
  }

  constructor(worldLocation: XYAndZ, size: XAndY) {
    this.worldLocation = Point3d.createFrom(worldLocation);
    this.size = Point2d.createFrom(size);
    this.position = new Point3d();
  }

  /**
   * Make a new Marker at the same position and size as this Marker.
   * Thew new Marker will share the world location and size objects, but will be otherwise blank.
   */
  public makeFrom(): Marker {
    const out = new (this.constructor as any)(this.worldLocation, this.size);
    out.rect.setFrom(this.rect);
    out.position.setFrom(this.position);
    if (this.scaleFactor)
      out.scaleFactor = Point2d.createFrom(this.scaleFactor);
    out._scaleFactorRange = this._scaleFactorRange;
    return out;
  }

  public drawDecoration(ctx: CanvasRenderingContext2D): void {

    if (this._isHilited) {
      // ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = 30;
      ctx.shadowColor = this._hiliteColor ? this._hiliteColor.toHexString() : "white";
      ctx.scale(1.25, 1.25);
    }

    if (this.scaleFactor !== undefined)
      ctx.scale(this.scaleFactor.x, this.scaleFactor.y);

    if (undefined !== this.drawFunc)
      this.drawFunc(ctx);

    if (this.wantImage && this.image !== undefined) {
      const size = this.imageSize ? this.imageSize : this.size;
      const offset = new Point2d(size.x / 2, size.y / 2);
      if (this.imageOffset)
        offset.plus(this.imageOffset, offset);
      ctx.drawImage(this.image, -offset.x, -offset.y, size.x, size.y);
    }

    if (this.label !== undefined) {
      ctx.textAlign = this.labelAlign ? this.labelAlign : "center";
      ctx.textBaseline = this.labelBaseline ? this.labelBaseline : "middle";
      ctx.font = this.labelFont ? this.labelFont : "14px san-serif";
      ctx.fillStyle = this.labelColor ? this.labelColor : "white";
      ctx.fillText(this.label, this.labelOffset ? -this.labelOffset.x : 0, this.labelOffset ? -this.labelOffset.y : 0);
    }
  }

  public setImage(image: MarkerImage | Promise<MarkerImage>) {
    if (image instanceof Promise)
      image.then((resolvedImage) => this.image = resolvedImage);
    else
      this.image = image;
  }

  public setImageUrl(url: string) { this.setImage(ImageUtil.fromUrl(url)); }

  public setPosition(vp: Viewport): boolean {
    if (!this.visible) // if we're turned off, skip
      return false;

    vp.worldToView(this.worldLocation, this.position);
    const origin = this.position;
    const sizeX = this.size.x / 2;
    const sizeY = this.size.y / 2;
    this.rect.init(origin.x - sizeX, origin.y - sizeY, origin.x + sizeX, origin.y + sizeY);

    if (this.scaleFactor && this._scaleFactorRange) {
      let scale = 1.0;
      if (vp.isCameraOn) {
        const range = this._scaleFactorRange;
        const w = Geometry.clamp(vp.worldToView4d(this.worldLocation).w, 0, 1.0);
        scale = Geometry.clamp(range.low + ((1 - w) * range.length()), .4, 2.0);
        this.rect.scaleAboutCenter(scale, scale);
      }
      this.scaleFactor.set(scale, scale);
    }

    return vp.viewRect.containsPoint(this.position);
  }

  public addDecoration(context: DecorateContext) {
    const vp = context.viewport;
    if (this.setPosition(vp))
      context.addOverlay2dDecoration(this);
  }
}

export class ClusterMarker<T extends Marker> {
  public readonly rect: ViewRect;
  public readonly markers: T[] = [];
  public markerForCluster?: Marker;

  public constructor(marker1: T, marker2: T) {
    this.rect = marker1.rect;
    this.markers.push(marker1);
    this.markers.push(marker2);
  }
}

/** A set of Markers that are logically related together such that they can be "clustered" when they overlap one another.  */
export abstract class MarkerSet<T extends Marker> {
  public minimumClusterSize = 1;
  public readonly markers = new Set<T>();
  public entries: Array<T | ClusterMarker<T>> = []; // this is an array that holds either Markers or a cluster of markers.
  public readonly worldToViewMap = Matrix4d.createZero();

  protected abstract getClusterMarker(cluster: ClusterMarker<T>): Marker;

  /**
   * This method should be called from [[Decorator.decorate]]. It will add this this MarkerSet to the supplied DecorateContext.
   * All Markers that overlap one other are turned into a ClusterMarker.
   * @param context The DecorateContext for the Markers
   */
  public addDecoration(context: DecorateContext) {
    const vp = context.viewport;
    const entries = this.entries;

    if (!this.worldToViewMap.isAlmostEqual(vp.worldToViewMap.transform0)) {
      this.worldToViewMap.setFrom(vp.worldToViewMap.transform0);
      entries.length = 0;
      for (const marker of this.markers) { // loop through all of the Markers in the MarkerSet.
        if (marker.setPosition(vp)) { // establish the screen position for this marker. If it's not in view, setPosition returns false
          let added = false;
          for (let i = 0; i < entries.length; ++i) { // loop through all of the currently visible makers/clusters
            const entry = entries[i];
            if (marker.rect.overlaps(entry.rect)) { // does new Marker overlap with this entry?
              added = true; // yes, we're going to save it as a Cluster
              if (entry instanceof ClusterMarker) { // is the entry already a Cluster?
                entry.markers.push(marker); // yes, just add this to the existing cluster
              } else {
                entries[i] = new ClusterMarker<T>(entry, marker); // no, make a new Cluster holding both
              }
              break; // this Marker has been handled, we can stop looking for overlaps
            }
          }
          if (!added)
            entries.push(marker); // there was no overlap, save this Marker to be drawn
        }
      }
    }

    // we now have an arry of Markers and Clusters, add them to context
    for (const entry of entries) {
      if (entry instanceof ClusterMarker) { // is this entry a Cluster?
        if (entry.markers.length <= this.minimumClusterSize) { // yes, does it have more than the minimum number of entries?
          entry.markers.forEach((marker) => context.addOverlay2dDecoration(marker)); // no, just draw all of its Markers
        } else {
          if (undefined === entry.markerForCluster)
            entry.markerForCluster = this.getClusterMarker(entry);
          context.addOverlay2dDecoration(entry.markerForCluster); // yes, get and draw the ClusterMarker for this Cluster
        }
      } else {
        context.addOverlay2dDecoration(entry); // entry is just a Marker, draw it.
      }
    }
  }
}

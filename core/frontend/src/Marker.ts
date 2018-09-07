/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point2d, Point3d, XAndY, XYAndZ } from "@bentley/geometry-core";
import { ImageUtil } from "./ImageUtil";
import { DecorateContext } from "./ViewContext";
import { Overlay2dDecoration } from "./render/System";
import { ViewRect, Viewport } from "./Viewport";

export type MarkerImage = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap;
export type MarkerDrawFunc = (ctx: CanvasRenderingContext2D, marker: Marker) => void;

export class Marker implements Overlay2dDecoration {
  public worldLocation: Point3d;
  /** The size of this Marker, in pixels. */
  public size: Point2d;
  public position: Point3d;
  public readonly rect = new ViewRect();
  public drawFunc?: MarkerDrawFunc;
  public image?: MarkerImage;
  public imageOffset?: XAndY;
  public imageSize?: XAndY;
  public label?: string;
  public labelOffset?: XAndY;
  public labelColor?: string;
  public labelAlign?: string;
  public labelBaseline?: string;
  public labelFont?: string;

  constructor(worldLocation: XYAndZ, size: XAndY) {
    this.worldLocation = Point3d.createFrom(worldLocation);
    this.size = Point2d.createFrom(size);
    this.position = new Point3d();
  }

  /** Make a new Marker at the same position and size as this Marker. */
  public makeFrom(): Marker {
    const out = new Marker(this.worldLocation, this.size);
    out.rect.setFrom(this.rect);
    out.position.setFrom(this.position);
    return out;
  }

  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    if (this.drawFunc !== undefined)
      this.drawFunc(ctx, this);

    if (this.image !== undefined) {
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
    vp.worldToView(this.worldLocation, this.position);
    const origin = this.position;
    const sizeX = this.size.x / 2;
    const sizeY = this.size.y / 2;
    this.rect.init(origin.x - sizeX, origin.y - sizeY, origin.x + sizeX, origin.y + sizeY);
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

  public constructor(marker1: T, marker2: T) {
    this.rect = marker1.rect;
    this.markers.push(marker1);
    this.markers.push(marker2);
  }
}

export abstract class MarkerSet<T extends Marker> {
  public minimumClusterSize = 1;
  public readonly markers = new Set<T>();

  /** Add all of the Markers in this MarkerSet to the decoration set. Any that overlap one other are turned into a ClusterMarker. */
  public addDecoration(context: DecorateContext) {
    const entries: Array<ClusterMarker<T> | T> = []; // this is an array that holds either Markers or a cluster of markers.
    const vp = context.viewport;
    for (const marker of this.markers) { // loop through all of the Markers in the MarkerSet.
      if (marker.setPosition(vp)) {     // establish the screen position for this marker. If it's not in view, setPosition returns false
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

    // we now have an arry of Markers and Clusters, add them to context
    for (const entry of entries) {
      if (entry instanceof ClusterMarker) {
        if (entry.markers.length <= this.minimumClusterSize) {
          entry.markers.forEach((marker) => context.addOverlay2dDecoration(marker));
        } else {
          context.addOverlay2dDecoration(this.getClusterMarker(entry));
        }
      } else {
        context.addOverlay2dDecoration(entry);
      }
    }
  }

  protected abstract getClusterMarker(cluster: ClusterMarker<T>): Marker;
}

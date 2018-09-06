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

  public clone(): Marker {
    const out = new Marker(this.worldLocation, this.size);
    out.rect.setFrom(this.rect);
    out.position.setFrom(this.position);
    out.drawFunc = this.drawFunc;
    out.image = this.image;
    out.imageOffset = this.imageOffset;
    out.imageSize = this.imageSize;
    out.label = this.label;
    out.labelOffset = this.labelOffset;
    out.labelColor = this.labelColor;
    out.labelAlign = this.labelAlign;
    out.labelBaseline = this.labelBaseline;
    out.labelFont = this.labelFont;
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

  public constructor(marker: T) {
    this.rect = marker.rect;
    this.markers.push(marker);
  }
}

export abstract class MarkerSet<T extends Marker> {
  public minimumClusterSize = 1;
  public readonly markers = new Set<T>();

  public addDecoration(context: DecorateContext) {
    const clusters: Array<ClusterMarker<T>> = [];

    const vp = context.viewport;
    for (const marker of this.markers) {
      if (marker.setPosition(vp)) {
        let added = false;
        for (const cluster of clusters) {
          if (marker.rect.overlaps(cluster.rect)) {
            cluster.markers.push(marker);
            added = true;
            break;
          }
        }
        if (!added)
          clusters.push(new ClusterMarker(marker));
      }
    }

    for (const cluster of clusters) {
      if (cluster.markers.length <= this.minimumClusterSize) {
        cluster.markers.forEach((marker) => context.addOverlay2dDecoration(marker));
      } else {
        context.addOverlay2dDecoration(this.getClusterMarker(cluster));
      }
    }
  }

  protected abstract getClusterMarker(cluster: ClusterMarker<T>): Marker;
}

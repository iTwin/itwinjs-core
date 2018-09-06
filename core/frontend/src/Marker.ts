/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Point2d, Point3d, XAndY, XYAndZ } from "@bentley/geometry-core";
import { ImageUtil } from "./ImageUtil";
import { DecorateContext } from "./ViewContext";
import { Overlay2dDecoration } from "./render/System";

export type MarkerImage = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap;

export class Marker implements Overlay2dDecoration {
  public readonly size: Point2d;
  public readonly worldLocation: Point3d;
  public readonly origin = new Point2d();

  public image?: MarkerImage;
  public readonly imageOrigin: Point2d;
  public readonly imageSize: Point2d;

  public label?: string;
  public labelOffset = new Point2d();
  public labelColor?: string;
  public labelAlign?: string;
  public labelBaseline?: string;
  public labelFont?: string;

  constructor(worldLocation: XYAndZ, size: XAndY) {
    this.worldLocation = Point3d.createFrom(worldLocation);
    this.size = Point2d.createFrom(size);
    this.imageSize = Point2d.createFrom(size);
    this.imageOrigin = new Point2d(this.imageSize.x / 2, this.imageSize.x / 2);
  }

  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    if (this.image !== undefined)
      ctx.drawImage(this.image, -this.imageOrigin.x, -this.imageOrigin.y, this.imageSize.x, this.imageSize.y);

    if (this.label !== undefined) {
      ctx.textAlign = this.labelAlign ? this.labelAlign : "center";
      ctx.textBaseline = this.labelBaseline ? this.labelBaseline : "middle";
      ctx.font = this.labelFont ? this.labelFont : "14px san-serif";
      ctx.fillStyle = this.labelColor ? this.labelColor : "white";
      ctx.fillText(this.label, -this.labelOffset.x, -this.labelOffset.y);
    }
  }

  public setImageUrl(url: string) { ImageUtil.fromUrl(url).then((image) => this.image = image); }

  public addDecoration(context: DecorateContext) {
    const vp = context.viewport;
    this.origin.setFrom(vp.worldToView(this.worldLocation));
    if (vp.viewRect.containsPoint(this.origin))
      context.addOverlay2dDecoration(this);
  }
}

export class MarkerCollection {
  public readonly markers: Marker[] = [];

  public addDecoration(context: DecorateContext) {
    this.markers.forEach((marker) => marker.addDecoration(context));
  }
}

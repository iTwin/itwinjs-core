/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Point2d, Point3d, XAndY, XYAndZ, Range1d, Range1dProps, Geometry, Matrix4d } from "@bentley/geometry-core";
import { ImageUtil } from "./ImageUtil";
import { DecorateContext } from "./ViewContext";
import { CanvasDecoration } from "./render/System";
import { ViewRect, Viewport } from "./Viewport";
import { BeButtonEvent } from "./tools/Tool";
import { ColorDef } from "@bentley/imodeljs-common";
import { ToolTipOptions } from "./NotificationManager";

/** The types that may be used  */
export type MarkerImage = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageBitmap;
export type MarkerFillStyle = string | CanvasGradient | CanvasPattern;
export type MarkerTextAlign = "left" | "right" | "center" | "start" | "end";
export type MarkerTextBaseline = "top" | "hanging" | "middle" | "alphabetic" | "ideographic" | "bottom";

/**
 * A Marker is a [[CanvasDecoration]], whose position follows a fixed location in world space.
 * Markers draw on top of all scene graphics, and show visual cues about locations of interest.
 * @see [Markers]($docs/learning/frontend/Markers)
 */
export class Marker implements CanvasDecoration {
  protected _scaleFactor?: Point2d;
  protected _scaleFactorRange?: Range1d;

  /** Whether this marker is currently enabled. If false, this Marker is not displayed. */
  public visible = true;
  /** Whether this marker is currently hilited or not. */
  protected _isHilited = false;
  /** The color for the shadowBlur when this Marker is hilited */
  protected _hiliteColor?: ColorDef;
  /** The location of this Marker in world coordinates. */
  public worldLocation: Point3d;
  /** The size of this Marker, in pixels. */
  public size: Point2d;
  /** The current position for the marker, in view coordinates (pixels). This value will be updated by calls to [[setPosition]]. */
  public position: Point3d;
  /** The current rectangle for the marker, in view coordinates (pixels). This value will be updated by calls to [[setPosition]]. */
  public readonly rect = new ViewRect();
  /** An image to draw for this Marker. If undefined, no image is shown. See https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage.  */
  public image?: MarkerImage;
  /** The offset for [[image]], in pixels, from the *center* of this Marker. If undefined, (0,0). */
  public imageOffset?: XAndY;
  /** The size of [[image]], in pixels. If undefined, use [[size]]. */
  public imageSize?: XAndY;
  /** A text Label for this Maker. If undefined, no label is displayed. */
  public label?: string;
  /** The offset for [[label]], in pixels, from the *center* of this Marker. If undefined, (0,0). */
  public labelOffset?: XAndY;
  /** The color for [[label]]. See  https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/fillStyle. If undefined, "white". */
  public labelColor?: MarkerFillStyle;
  /** The text alignment for [[label]]. See https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textAlign. If undefined, "center" */
  public labelAlign?: MarkerTextAlign;
  /** The text baseline for [[label]]. See https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline. If undefined, "middle" */
  public labelBaseline?: MarkerTextBaseline;
  /** The font for [[label]]. See https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/font. */
  public labelFont?: string;
  /** The title string to show in the ToolTip when the pointer is over this Marker. See [[NotificationManager.openToolTip]] */
  public title?: string;
  /** The ToolTipOptions to use for [[title]]. */
  public tooltipOptions?: ToolTipOptions;

  /** Return true to display [[image]], if present. */
  public get wantImage() { return true; }

  /** Implement this function to draw onto the CanvasRenderingContext2D when this Marker is displayed. The [0,0] point will be the center of the Marker. */
  public drawFunc?(ctx: CanvasRenderingContext2D): void;

  /** Called when the mouse pointer enters this Marker. */
  public onMouseEnter(ev: BeButtonEvent) { this._isHilited = true; this._hiliteColor = ev.viewport!.hilite.color; }

  /** Called when the mouse pointer leaves this Marker. */
  public onMouseLeave() { this._isHilited = false; }

  /** Called when the mouse pointer moves over this Marker */
  public onMouseMove(ev: BeButtonEvent): void {
    if (this.title)
      ev.viewport!.openToolTip(this.title, ev.viewPoint, this.tooltipOptions);
  }
  /** Called when a mouse button is pressed over this Marker. */
  public onMouseButton?(_ev: BeButtonEvent): boolean;

  /** Determine whether the point is within this Marker.  */
  public pick(pt: XAndY): boolean { return this.rect.containsPoint(pt); }

  /** Establish a range of scale factors to increases and decrease the size of this Marker based on its distance from the camera.
   * @param range The minimum and maximum scale factors to be applied to the size of this Marker based on its distance from the camera. `range.Low` is the scale factor
   * for Markers at the back of the view frustum and `range.high` is the scale factor at the front of the view frustum.
   * @note Marker size scaling is only applied in views with the camera enabled. It has no effect on orthographic views.
   */
  public setScaleFactor(range: Range1dProps) {
    this._scaleFactorRange = Range1d.fromJSON(range);
    this._scaleFactor = Point2d.create(1, 1);
  }

  /** Constructor for Marker
   * @param worldLocation The location of this Marker in world coordinates.
   * @param size The size of this Marker in pixels.
   */
  constructor(worldLocation: XYAndZ, size: XAndY) {
    this.worldLocation = Point3d.createFrom(worldLocation);
    this.size = Point2d.createFrom(size);
    this.position = new Point3d();
  }

  /**
   * Make a new Marker at the same position and size as this Marker.
   * Thew new Marker will share the world location and size objects, but will be otherwise blank.
   */
  public static makeFrom<T extends Marker>(other: Marker, ...args: any[]): T {
    const out = new (this as any)(other.worldLocation, other.size, ...args) as T;
    out.rect.setFrom(other.rect);
    out.position.setFrom(other.position);
    if (other._scaleFactor)
      out._scaleFactor = Point2d.createFrom(other._scaleFactor);
    out._scaleFactorRange = other._scaleFactorRange;
    return out;
  }

  /**
   * When a Marker is displayed in its hilited state, this method is called first. If it returns true, no further action is taken.
   * Otherwise the Marker's normal drawing operations are also called. By default, this method adds a shadowBlur effect and increases
   * the size of the Marker by 25%.
   * @return true to stop drawing this Marker
   */
  protected drawHilited(ctx: CanvasRenderingContext2D) {
    ctx.shadowBlur = 30;
    ctx.shadowColor = this._hiliteColor ? this._hiliteColor.toHexString() : "white";
    ctx.scale(1.25, 1.25);
    return false;
  }

  /** Called during frame rendering to display this Marker onto the supplied context. */
  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    if (this._isHilited && this.drawHilited(ctx))
      return;

    if (this._scaleFactor !== undefined)
      ctx.scale(this._scaleFactor.x, this._scaleFactor.y);

    // first call the "drawFunc" if defined. This means it will be below the image and label if they overlap
    if (undefined !== this.drawFunc)
      this.drawFunc(ctx);

    // next draw the image, if defined and desired
    if (this.wantImage && this.image !== undefined) {
      const size = this.imageSize ? this.imageSize : this.size;
      const offset = new Point2d(size.x / 2, size.y / 2);
      if (this.imageOffset)
        offset.plus(this.imageOffset, offset);
      ctx.drawImage(this.image, -offset.x, -offset.y, size.x, size.y);
    }

    // lastly, draw the label, if defined. This puts it on top of all other graphics for this Marker.
    if (this.label !== undefined) {
      ctx.textAlign = this.labelAlign ? this.labelAlign : "center";
      ctx.textBaseline = this.labelBaseline ? this.labelBaseline : "middle";
      ctx.font = this.labelFont ? this.labelFont : "14px san-serif";
      ctx.fillStyle = this.labelColor ? this.labelColor : "white";
      ctx.fillText(this.label, this.labelOffset ? -this.labelOffset.x : 0, this.labelOffset ? -this.labelOffset.y : 0);
    }
  }

  /** Set the [[image]] for this marker.
   * @param image Either a [[MarkerImage]] or a Promise for a [[MarkerImage]]. If a Promise is supplied, the [[image]] member is set
   * when the Promise resolves.
   */
  public setImage(image: MarkerImage | Promise<MarkerImage>) {
    if (image instanceof Promise)
      image.then((resolvedImage) => this.image = resolvedImage);
    else
      this.image = image;
  }

  /** Set the image for this Marker from a URL. */
  public setImageUrl(url: string) { this.setImage(ImageUtil.fromUrl(url)); }

  /** Set the position (in pixels) for this Marker in the supplied Viewport, based on its worldLocation.
   * @return true if the Marker is visible and its new position is inside the Viewport.
   */
  public setPosition(vp: Viewport): boolean {
    if (!this.visible) // if we're turned off, skip
      return false;

    const pt4 = vp.worldToView4d(this.worldLocation);
    if (pt4.w > 1.0 || pt4.w < 0) // outside of frustum.
      return false;

    pt4.realPoint(this.position);
    if (!vp.viewRect.containsPoint(this.position))
      return false; // outside this viewport rect

    const origin = this.position;
    const sizeX = this.size.x / 2;
    const sizeY = this.size.y / 2;
    this.rect.init(origin.x - sizeX, origin.y - sizeY, origin.x + sizeX, origin.y + sizeY);

    // if there's a scale factor active, calculate it now.
    if (this._scaleFactor && this._scaleFactorRange) {
      let scale = 1.0;
      if (vp.isCameraOn) {
        const range = this._scaleFactorRange;
        scale = Geometry.clamp(range.low + ((1 - pt4.w) * range.length()), .4, 2.0);
        this.rect.scaleAboutCenter(scale, scale);
      }
      this._scaleFactor.set(scale, scale);
    }

    return true;
  }

  /** Add this Marker to the supplied Decorate context. */
  public addMarker(context: DecorateContext) { context.addCanvasDecoration(this); }

  /** Set the position and ddd this Marker to the supplied DecorateContext, if it's visible.
   * This method should be called from your implementation of [[Decorator.decorate]]. It will set this Marker's position based the
   * Viewport from the context, and add this this Marker to the supplied DecorateContext.
   * @param context The DecorateContext for the Marker
   */
  public addDecoration(context: DecorateContext) {
    if (this.setPosition(context.viewport))
      this.addMarker(context);
  }
}

/**
 * A cluster of one or more Markers that overlap one another in the view. The cluster's screen position is taken from its first entry.
 * Clusters also have a Marker themselves, that represents the whole group. The cluster marker isn't created until all entries have been added.
 */
export class Cluster<T extends Marker> {
  public readonly rect: ViewRect;
  public clusterMarker?: Marker;

  public constructor(public readonly markers: T[]) {
    this.rect = markers[0].rect;
    this.markers = markers;
  }
}

/** A *set* of Markers that are logically related, such that they *cluster* when they overlap. In that case, a *cluster marker*
 * is drawn instead of the overlapping Markers.
 */
export abstract class MarkerSet<T extends Marker> {
  /** @hidden */
  protected _entries: Array<T | Cluster<T>> = []; // this is an array that holds either Markers or a cluster of markers.
  /** @hidden */
  protected readonly _worldToViewMap = Matrix4d.createZero();

  /** The minimum number of Markers that must overlap before they are clustered. Otherwise they are each drawn individually. Default is 1 (always create a cluster.) */
  public minimumClusterSize = 1;
  /** The set of Markers in this MarkerSet. Add your [[Marker]]s into this. */
  public readonly markers = new Set<T>();

  /**
   * Implement this method to create a new Marker that is shown as a *stand-in* for a Cluster of Markers that overlap one another.
   * @param cluster The [[Cluster]] that the new Marker will represent.
   * @returns The Marker that will be displayed to represent the Cluster.
   * @note You must create a new Marker each time this method is called.
   */
  protected abstract getClusterMarker(cluster: Cluster<T>): Marker;

  /**
   * This method should be called from [[Decorator.decorate]]. It will add this this MarkerSet to the supplied DecorateContext.
   * This method implements the logic that turns overlapping Markers into a Cluster.
   * @param context The DecorateContext for the Markers
   */
  public addDecoration(context: DecorateContext) {
    const vp = context.viewport;
    const entries = this._entries;

    // Don't recreate the entries array if the view hasn't changed. This is important for performance, but also necessary for hilite of
    // clusters (otherwise they're recreated continually and never hilited.) */
    if (!this._worldToViewMap.isAlmostEqual(vp.worldToViewMap.transform0)) {
      this._worldToViewMap.setFrom(vp.worldToViewMap.transform0);
      entries.length = 0;   // start over.
      // loop through all of the Markers in the MarkerSet.
      for (const marker of this.markers) {
        // establish the screen position for this marker. If it's not in view, setPosition returns false
        if (!marker.setPosition(vp))
          continue;

        let added = false;
        for (let i = 0; i < entries.length; ++i) { // loop through all of the currently visible markers/clusters
          const entry = entries[i];
          if (marker.rect.overlaps(entry.rect)) { // does new Marker overlap with this entry?
            added = true; // yes, we're going to save it as a Cluster
            if (entry instanceof Cluster) { // is the entry already a Cluster?
              entry.markers.push(marker); // yes, just add this to the existing cluster
            } else {
              entries[i] = new Cluster([entry, marker]); // no, make a new Cluster holding both
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
      if (entry instanceof Cluster) { // is this entry a Cluster?
        if (entry.markers.length <= this.minimumClusterSize) { // yes, does it have more than the minimum number of entries?
          entry.markers.forEach((marker) => marker.addMarker(context)); // no, just draw all of its Markers
        } else {
          // yes, get and draw the Marker for this Cluster
          if (undefined === entry.clusterMarker) // have we already created this cluster marker?
            entry.clusterMarker = this.getClusterMarker(entry); // no, get it now.
          entry.clusterMarker.addMarker(context);
        }
      } else {
        entry.addMarker(context); // entry is a non-overlapping Marker, draw it.
      }
    }
  }
}

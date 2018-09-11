/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { XYAndZ, Point2d, Point3d } from "@bentley/geometry-core";
import { ScreenViewport } from "./Viewport";
import { DecorateContext } from "./ViewContext";
import { Logger } from "@bentley/bentleyjs-core";
import { ImageSource, ImageSourceFormat } from "@bentley/imodeljs-common";
import { IModelConnection } from "./IModelConnection";
import { ImageUtil } from "./ImageUtil";
import { Overlay2dDecoration } from "./render/System";

/**
 * Sprites are small raster images that are drawn *on top* of Viewports by a ViewDecoration.
 * Their purpose is to draw the user's attention to something of importance.
 *
 * There are two classes in the Sprites subsystem: Sprite (a Sprite image) and SpriteLocation.
 * Sprite are the images that define the way a type of sprite looks and are generally
 * loaded one time and saved for the rest of a session. A SpriteLocation defines the current
 * position of a single Sprite in a Viewport.
 *
 * A SpriteLocation can be either active or inactive. It becomes active by specifying a location
 * (an x,y point) and a Sprite to draw at that point. A Sprite
 * can be used many times by many SpriteLocations and a single SpriteLocation can
 * change both position and which Sprite is shown at that position over time.
 *
 */
export class Sprite {
  /** The image for this Sprite. If undefined, the Spite is not valid. */
  public image?: HTMLImageElement;
  /** The size of this Sprite. If not loaded, value is not meaningful. */
  public readonly size = new Point2d();
  /** The offset to the middle of this Sprite. If not loaded, value is not meaningful. */
  public get offset(): Point2d { return new Point2d(Math.round(this.size.x) / 2, Math.round(this.size.y / 2)); }
  /** Whether this sprite has be successfully loaded. */
  public get isLoaded(): boolean { return undefined !== this.image; }

  /** Initialize this sprite from a .png file located in the imodeljs-native assets directory.
   * @param filePath The file path of the PNG file holding the sprite (relative to the assets directory.)
   * @param iModel An IModelConnection used to locate the backend server. Note that this method does not associate this Sprite with the iModel
   * in any way. It is merely necessary to route the request to the backend.
   * @note This method loads the .png file asynchronously. The [[image]] member will be undefined until the data is loaded.
   */
  public fromNativePng(filePath: string, iModel: IModelConnection): void {
    iModel.loadNativeAsset(filePath).then((val: Uint8Array) => this.fromImageSource(new ImageSource(val, ImageSourceFormat.Png))).catch(() => {
      Logger.logError("imodeljs-frontend.Sprites", "can't load sprite from asset file: " + filePath);
    });
  }

  private onLoaded(image: HTMLImageElement) { this.image = image; this.size.set(image.naturalWidth, image.naturalHeight); }

  /** Initialize this Sprite from an ImageSource.
   * @param src The ImageSource holding an image to create the texture for this Sprite.
   * @note This method creates the image from the ImageSource asynchronously.
   */
  public fromImageSource(src: ImageSource): void { ImageUtil.extractImage(src).then((image) => this.onLoaded(image)); }

  /** Initialize this Sprite from a URL
   * @param url The url of an image to load for this Sprite.
   */
  public fromUrl(url: string): void { ImageUtil.fromUrl(url).then((image) => this.onLoaded(image)); }
}

/** Icon sprites are loaded from .png files in the assets directory of imodeljs-native.
 * They are cached by name, and the cache is cleared when the ToolAdmin is shut down.
 */
export class IconSprites {
  private static readonly _sprites = new Map<string, Sprite>();

  /** Look up an IconSprite by name. If not loaded, create and load it.
   * @param spriteName The base name (without ".png") of a PNG file in the `decorators/dgncore` subdirectory of the `Assets` directory of the imodeljs-native package.
   * @param iModel The IModelConnection.
   */
  public static getSprite(spriteName: string, iModel: IModelConnection): Sprite {
    let sprite = this._sprites.get(spriteName);
    if (!sprite) {
      sprite = new Sprite();
      this._sprites.set(spriteName, sprite);
      sprite.fromNativePng("decorators/dgncore/" + spriteName + ".png", iModel); // note: asynchronous
    }
    return sprite;
  }
  /** Empty the cache, disposing all existing Sprites. */
  public static emptyAll() { this._sprites.clear(); }
}

/**
 * A Sprite location. Sprites generally move around on the screen and this object holds the current location
 * and current Sprite within a Viewport. SpriteLocations can be either inactive (not visible) or active.
 *
 * A SpriteLocation can also specify that a Sprite should be drawn partially transparent
 */
export class SpriteLocation implements Overlay2dDecoration {
  private _viewport?: ScreenViewport;
  private _sprite?: Sprite;
  private _alpha?: number;
  public readonly position = new Point3d();
  public get isActive(): boolean { return this._viewport !== undefined; }

  /**
   * Activate this SpriteLocation to show a Sprite at a location in a single Viewport.
   * This call does not display the Sprite in the Viewport. Rather, subsequent calls to
   * [[decorate]] from  will show the Sprite.
   * This SpriteLocation remains active until [[deactivate]] is called.
   * @param sprite  The Sprite to draw at this SpriteLocation
   * @param viewport The Viewport onto which the Sprite is drawn
   * @param locationWorld The position, in world coordinates
   * @param alpha Optional alpha for the Sprite. Must be a number between 0 (fully transparent) and 1 (fully opaque).
   */
  public activate(sprite: Sprite, viewport: ScreenViewport, locationWorld: XYAndZ, alpha?: number): void {
    if (!sprite.isLoaded)
      return;

    viewport.worldToView(locationWorld, this.position);
    this._sprite = sprite;
    this._alpha = alpha;
    this._viewport = viewport;
    viewport.invalidateDecorations();
  }

  /** Turn this SpriteLocation off so it will no longer show. */
  public deactivate() {
    if (!this.isActive)
      return;
    this._viewport!.invalidateDecorations();
    this._viewport = undefined;
  }

  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    const sprite = this._sprite!;
    if (undefined !== this._alpha)
      ctx.globalAlpha = this._alpha;

    ctx.drawImage(sprite.image!, -sprite.offset.x, -sprite.offset.y);
  }

  /** If this SpriteLocation is active and the supplied DecorateContext is for its Viewport, add the Sprite to decorations. */
  public decorate(context: DecorateContext) {
    if (context.viewport === this._viewport)
      context.addOverlay2dDecoration(this);
  }
}

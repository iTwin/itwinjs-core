/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Point2d, Point3d, Vector3d, XYAndZ } from "@bentley/geometry-core";
import { Viewport } from "./Viewport";
import { DecorateContext } from "./ViewContext";
import { IDisposable, dispose, Logger } from "@bentley/bentleyjs-core";
import { RenderTexture, ImageSource, ImageSourceFormat } from "@bentley/imodeljs-common";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { ImageUtil } from "./ImageUtil";

/**
 * Sprites are small raster images that are drawn *on top* of Viewports by a ViewDecoration.
 * Their purpose is to draw the user's attention to something of importance.
 *
 * There are two classes in the Sprites subsystem: Sprite (a Sprite Definition) and SpriteLocation.
 * Sprite Definitions are the images that define the way a type of sprite looks and are generally
 * loaded one time and saved for the rest of a session. A SpriteLocation defines the current
 * position of a single Sprite in a Viewport.
 *
 * A SpriteLocation can be either active or inactive. It becomes active by specifying a location
 * (an x,y point) and a Sprite Definition to draw at that point. It should be obvious that a single Sprite
 * Definition can be used many times by many Sprite Locations and that a single Sprite Location can
 * change both position and which Sprite Definition is shown at that position over time.
 *
 * Sprites can be of varying sizes and color depths and can have both opaque and transparent pixels.
 *
 * Element Manipulator handles and the AccuSnap indicators are examples of Sprites.
 * @note It is also possible to draw a Sprite onto a Viewport directly
 * without ever using a SpritLocation. SpriteLocations are merely provided as a convenience.
 */
export class Sprite implements IDisposable {
  /** The size of the sprite, in pixels */
  public readonly size = new Point2d();
  /** The texture for this Sprite. If undefined, the Spite is not valid. */
  public texture?: RenderTexture;

  /** Destroy of this Sprite. Disposes of texture, if present. */
  public destroy() { this.texture = dispose(this.texture); }

  /** @hidden NOTE: Sprites are shared, so they can't be disposed when they are used for decorations. They are freed by [[destroy]] */
  public dispose() { }

  /** Initialize this sprite from a .png file located in the imodeljs-native assets directory.
   * @param filePath The file path of the PNG file holding the sprite texture (relative to the assets directory.)
   * @param iModel An IModelConnection used to locate the backend server. Note that this method does not associate this Sprite with the iModel
   * in any way. It is merely necessary to route the request to the backend.
   * @note This method loads the .png file asynchronously. The [[texture]] member will be undefined until the data is loaded.
   */
  public fromNativePng(filePath: string, iModel: IModelConnection): void {
    iModel.loadNativeAsset(filePath).then((val: Uint8Array) => this.fromImageSource(new ImageSource(val, ImageSourceFormat.Png))).catch(() => {
      Logger.logError("imodeljs-frontend.Sprites", "can't load sprite from asset file: " + filePath);
    });
  }

  /** Initialize this Sprite from an ImageSource.
   * @param src The ImageSource holding an image to create the texture for this Sprite.
   * @note This method creates the texture from the ImageSource asynchronously. The texture will appear as a white square until it is fully loaded.
   */
  public fromImageSource(src: ImageSource): void {
    ImageUtil.extractImage(src).then((image) => {
      this.size.x = image.naturalWidth;
      this.size.y = image.naturalHeight;
      if (IModelApp.hasRenderSystem)
        this.texture = IModelApp.renderSystem.createTextureFromImage(image, true, undefined, new RenderTexture.Params(undefined, RenderTexture.Type.TileSection));
    });
  }
}

/** Icon sprites are loaded from .png files in the assets directory of imodeljs-native.
 * They are cached by name, and the cache is cleared when the ToolAdmin is shut down.
 */
export class IconSprites {
  private static readonly _sprites = new Map<string, Sprite>();

  /** Look up an IconSprite by name. If not loaded, create and load it.
   * @param spriteName The base name (without ".png") of a PNG file in the `decorators/dgncore` subdirectory of the `Assets` directory of the imodeljs-native package.
   * @param vp A Viewport used to find the IModelConnection
   */
  public static getSprite(spriteName: string, vp: Viewport): Sprite {
    let sprite = this._sprites.get(spriteName);
    if (!sprite) {
      sprite = new Sprite();
      this._sprites.set(spriteName, sprite);
      sprite.fromNativePng("decorators/dgncore/" + spriteName + ".png", vp.iModel); // note: asynchronous
    }
    return sprite;
  }
  /** Empty the cache, disposing all existing Sprites. */
  public static emptyAll() { this._sprites.forEach((sprite: Sprite) => sprite.destroy()); this._sprites.clear(); }
}

/**
 * A Sprite Location. Sprites generally move around on the screen and this object holds the current location
 * and current Sprite for an image of a sprite within a Viewport. SpriteLocations can be either
 * inactive (not visible) or active.
 *
 * A SpriteLocation can also specify that a Sprite should be drawn partially transparent so that
 * you can "see through" the Sprite.
 */
export class SpriteLocation {
  private _viewport?: Viewport;
  /** The Sprite shown by this SpriteLocation. */
  public sprite?: Sprite;
  /** The location of the sprite, in *view* coordinates. */
  private readonly _viewLocation = new Point3d();

  public get isActive(): boolean { return this._viewport !== undefined; }

  /** Change the location of this SpriteLocation from a point in *world* coordinates. */
  public setLocationWorld(location: XYAndZ) { this._viewport!.worldToView(location, this._viewLocation); }

  /**
   * Activate this SpriteLocation to show a Sprite at a location in a Viewport.
   * This call does not display the Sprite in the Viewport. Rather, subsequent calls to
   * [[decorate]] from  will show the Sprite.
   * This SpriteLocation remains active until [[deactivate]] is called.
   * @param sprite  The Sprite to draw at this SpriteLocation
   * @param viewport The Viewport onto which the Sprite is drawn
   * @param location The position, in world coordinates
   * @param transparency The transparency to draw the Sprite (0=opaque, 255=invisible)
   */
  public activate(sprite: Sprite, viewport: Viewport, location: XYAndZ, _transparency: number): void {
    viewport.invalidateDecorations();
    this._viewport = viewport;
    this.sprite = sprite;
    this.setLocationWorld(location);
  }

  /** Turn this SpriteLocation off so it will no longer show in its Viewport. */
  public deactivate() {
    if (!this.isActive)
      return;

    this._viewport!.invalidateDecorations();
    this._viewport = undefined;
    this.sprite = undefined;
  }

  /** If this SpriteLocation is active and the supplied DecorateContext is for its Viewport, add the Sprite to the context at the current location. */
  public decorate(context: DecorateContext) {
    if (context.viewport === this._viewport && this.sprite)
      context.addSprite(this.sprite, this._viewLocation, Vector3d.unitX());
  }
}

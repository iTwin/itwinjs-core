/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Point2d, Point3d, Vector3d, XYAndZ } from "@bentley/geometry-core";
import { Viewport } from "./Viewport";
import { DecorateContext } from "./ViewContext";
import { IDisposable } from "@bentley/bentleyjs-core/lib/Disposable";
import { RenderTexture } from "@bentley/imodeljs-common/lib/common";

/**
 * Sprites are small raster images that are drawn "on top" of Viewports by a ViewDecoration.
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
 * Element Manipulator handles and the AccuSnap indicators are examples of  use of Sprites.
 * @note It is also possible to draw a Sprite onto a Viewport directly
 * without ever using a SpritLocation. SpriteLocations are merely provided as a convenience.
 */
export class Sprite implements IDisposable {
  public readonly size = new Point2d();
  public texture?: RenderTexture;
  public dispose() { if (this.texture) this.texture.dispose(); }

}

/**
 * A Sprite Location. Sprites generally move around on the screen and this object holds the current location
 * and current Sprite Definition for an image of a sprite within a Viewport. SpriteLocations can be either
 * inactive (not visible) or active.
 *
 * A SpriteLocation can also specify that a Sprite Definition should be drawn partially transparent so that
 * you can "see through" the Sprite.
 */
export class SpriteLocation {
  public viewport?: Viewport;
  public readonly location = new Point3d();
  public transparency = 0;
  public sprite?: Sprite;

  public isActive(): boolean { return !!this.viewport; }

  /**
   * Activate this Sprite to show a specific Sprite Definition at a specific location in a Viewport.
   * This call does \em not display the Sprite Definition in the Viewport. Rather, subsequent calls to
   * #DecorateViewport from within an IViewDecoration \em will show the Sprite.
   * This Sprite Location remains active until #Deactivate is called.
   * @param sprite  The Sprite Definition to draw at this SpriteLocation
   * @param viewport The Viewport onto which the Sprite Definition is drawn
   * @param location The x,y position in View coordinates
   * @param transparency The transparency to draw the Sprite (0=opaque, 255=invisible)
   */
  public activate(sprite: Sprite, viewport: Viewport, location: XYAndZ, transparency: number): void {
    viewport.invalidateDecorations();
    this.viewport = viewport;
    this.sprite = sprite;
    this.transparency = transparency;
    this.location.setFrom(location);
    this.viewport.worldToNpc(this.location, this.location);
    this.location.z = 0.0;
    this.viewport.npcToWorld(this.location, this.location);
  }

  public deactivate(): void {
    if (!this.viewport)
      return;

    this.viewport.invalidateDecorations();
    this.viewport = undefined;
    this.sprite = undefined;
  }

  public decorate(context: DecorateContext): void {
    if (context.viewport === this.viewport && this.sprite) {
      const loc = this.viewport!.worldToView(this.location);
      loc.z = 0;
      context.addSprite(this.sprite, loc, Vector3d.unitX(), this.transparency);
    }
  }
}

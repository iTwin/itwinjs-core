/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point3d } from "@itwin/core-geometry";
import { CanvasDecoration } from "../render/CanvasDecoration";
import { DecorateContext } from "../ViewContext";
import { IModelApp } from "../IModelApp";
import { Decorator } from "../ViewManager";
import { IconSprites, Sprite } from "../Sprites";
import { RealityTile } from "../tile/internal";
import { ScreenViewport } from "../Viewport";

/** Layer types that can be added to the map.
 * @internal
 */
type GoogleMapsMapTypes =  "roadmap" | "satellite" | "terrain";

/** A simple decorator that shows the logo at a given screen position.
 * @internal
 */
export class LogoDecoration implements CanvasDecoration {
  private _sprite?: Sprite;

  /** The current position of the logo in view coordinates. */
  public readonly position = new Point3d();

  private _offset: Point3d | undefined;

  public set offset(offset: Point3d | undefined) {
    this._offset = offset;
  }

  /** The logo offset in view coordinates.*/
  public get offset() {
    return this._offset;
  }

  /** Move the logo to the lower left corner of the screen. */
  public moveToLowerLeftCorner(context: DecorateContext): boolean {
    if (!this._sprite || !this._sprite.isLoaded)
      return false;

    this.position.x = this._offset?.x ?? 0;
    this.position.y = context.viewport.parentDiv.clientHeight - this._sprite.size.y;
    if (this._offset?.y)
      this.position.y -= this._offset.y;
    return true;
  }

  /* TODO: Add other move methods as needed */

  /** Indicate if the logo is loaded and ready to be drawn. */
  public get isLoaded() { return this._sprite?.isLoaded ?? false; }

  public async activate(sprite: Sprite): Promise<boolean> {
    this._sprite = sprite;
    return new Promise<boolean>((resolve, _reject) => {
      sprite.loadPromise.then(() => {
        resolve(true);
      }).catch(() => {
        resolve (false);
      });
    });
  }

  /** Draw this sprite onto the supplied canvas.
   * @see [[CanvasDecoration.drawDecoration]]
   */
  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    if (this.isLoaded && this._sprite?.image !== undefined) {
      // Draw image with an origin at the top left corner
      ctx.drawImage(this._sprite.image, 0, 0);
    }
  }

  public decorate(context: DecorateContext) {
    context.addCanvasDecoration(this);
  }
}

/** A decorator that adds the Google Maps logo to the lower left corner of the screen.
 * @internal
 */
export class GoogleMapsDecorator implements Decorator {
  public readonly logo = new LogoDecoration();
  private _showCreditsOnScreen?: boolean;

  /** Create a new GoogleMapsDecorator.
   * @param showCreditsOnScreen If true, the data attributions/copyrights from the Google Photorealistic 3D Tiles will be displayed on screen. The Google Maps logo will always be displayed.
   */
  constructor(showCreditsOnScreen?: boolean) {
    this._showCreditsOnScreen = showCreditsOnScreen;
  }

  /** Activate the logo based on the given map type. */
  public async activate(mapType: GoogleMapsMapTypes): Promise<boolean> {
    // Pick the logo that is the most visible on the background map
    const imageName = mapType === "satellite" ?
    "GoogleMaps_Logo_WithDarkOutline" :
    "GoogleMaps_Logo_WithLightOutline";

    // We need to move the logo right after the 'i.js' button
    this.logo.offset = new Point3d(45, 10);

    return this.logo.activate(IconSprites.getSpriteFromUrl(`${IModelApp.publicPath}images/${imageName}.svg`));
  };

  /** Decorate implementation */
  public decorate = (context: DecorateContext) => {
    if (!this.logo.isLoaded)
      return;
    this.logo.moveToLowerLeftCorner(context);
    this.logo.decorate(context);

    if (!this._showCreditsOnScreen)
      return;

    // Get data attribution (copyright) text
    const copyrightMap = getCopyrights(context.viewport);
    // Order by most occurances to least
    // See https://developers.google.com/maps/documentation/tile/create-renderer#display-attributions
    const sortedCopyrights = [...copyrightMap.entries()].sort((a, b) => b[1] - a[1]);
    const copyrightText = sortedCopyrights.map(([key]) => ` • ${key}`).join("");

    // Create and add element, offset to leave space for i.js and Google logos
    const elem = document.createElement("div");
    elem.innerHTML = copyrightText;
    elem.style.color = "white";
    elem.style.fontSize = "11px";
    elem.style.textWrap = "wrap";
    elem.style.position = "absolute";
    elem.style.bottom = "14px";
    elem.style.left = "155px";

    context.addHtmlDecoration(elem);
  };
}

/** Get copyrights from tiles currently in the viewport.
 * @internal
 */
export function getCopyrights(vp: ScreenViewport): Map<string, number> {
  const tiles = IModelApp.tileAdmin.getTilesForUser(vp)?.selected;
  const copyrightMap = new Map<string, number>();
  if (tiles) {
    for (const tile of tiles as Set<RealityTile>) {
      if (tile.copyright) {
        for (const copyright of tile.copyright.split(";")) {
          const currentCount = copyrightMap.get(copyright);
          copyrightMap.set(copyright, currentCount ? currentCount + 1 : 1);
        }
      }
    }
  }
  return copyrightMap;
}
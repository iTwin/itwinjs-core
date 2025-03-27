import { CanvasDecoration, DecorateContext, Decorator, IconSprites, IModelApp, Sprite } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { GoogleMapsMapTypes } from "./GoogleMaps.js";


/** A simple decorator that show logo at the a given screen position.
 * @internal
 */
export class LogoDecoration implements CanvasDecoration {
  private _sprite?: Sprite;

  /** The current position of the logo in view coordinates. */
  public readonly position = new Point3d();

  private _offset: Point3d|undefined;

  public set offset(offset: Point3d|undefined) {
      this._offset = offset;
    }

  /** The logo offset in view coordinates.*/
  public get offset() {
    return this._offset;
  }

  /** Move the logo to the lower left corner of the screen. */
  public moveToLowerLeftCorner(context: DecorateContext) : boolean{
    if (!this._sprite || !this._sprite.isLoaded)
      return false;

    this.position.x = this._offset?.x ?? 0;
    this.position.y =  context.viewport.parentDiv.clientHeight - this._sprite.size.y;
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
    if (this.isLoaded) {
    // Draw image with an origin at the top left corner
    ctx.drawImage(this._sprite!.image!, 0, 0);
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

  /** Activate the logo based on the given map type. */
  public async activate(mapType: GoogleMapsMapTypes): Promise<boolean> {
    // Pick the logo that is the most visible on the background map
    const imageName = mapType === "roadmap" ?
    "google_on_white" :
    "google_on_non_white";

    // We need to move the logo right after the 'i.js' button
    this.logo.offset = new Point3d(45, 10);

    return this.logo.activate(IconSprites.getSpriteFromUrl(`${IModelApp.publicPath}images/${imageName}.png`));
  };

  /** Decorate implementation */
  public decorate = (context: DecorateContext) => {
    if (!this.logo.isLoaded)
      return;
    this.logo.moveToLowerLeftCorner(context);
    this.logo.decorate(context);
  };
}

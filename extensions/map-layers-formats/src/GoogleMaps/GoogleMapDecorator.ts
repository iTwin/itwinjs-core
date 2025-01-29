import { CanvasDecoration, DecorateContext, Decorator, IconSprites, IModelApp, ScreenViewport, Sprite } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { MapTypesType } from "./GoogleMaps";

// Similar to 'SprintLocation' but uses a viewport pixel position instead of world position
class ImagePixelLocationDecoration implements CanvasDecoration {
  private _viewport?: ScreenViewport;
  private _sprite?: Sprite;
  private _alpha?: number;
  public readonly position = new Point3d();
  // public get isActive(): boolean { return this._viewport !== undefined; }
  private _isSpriteLoaded = false;
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

  public deactivate() {

  }

  /** Draw this sprite onto the supplied canvas.
   * @see [[CanvasDecoration.drawDecoration]]
   */
  public drawDecoration(ctx: CanvasRenderingContext2D): void {
    const sprite = this._sprite!;
    if (undefined === sprite.image)
      return;

    if (undefined !== this._alpha)
      ctx.globalAlpha = this._alpha;

    ctx.drawImage(sprite.image, -sprite.offset.x, -sprite.offset.y);
  }

  /** If this SpriteLocation is active and the supplied DecorateContext is for its Viewport, add the Sprite to decorations. */
  public decorate(context: DecorateContext) {
    this._viewport = context.viewport;
    const vpHeight = context.viewport.parentDiv.clientHeight;
    this.position.setFrom({x: 120, y: vpHeight - 25, z: 0});
    context.addCanvasDecoration(this);
  }
}

export class GoogleMapsDecorator implements Decorator {
  public readonly logo = new ImagePixelLocationDecoration();
  private _sprite: Sprite|undefined;
  public constructor() {
  }

  public async activate(mapType: MapTypesType): Promise<boolean> {
    const imageName = mapType === "roadmap" ? "google_on_white_hdpi" : "google_on_non_white_hdpi";
    this._sprite = IconSprites.getSpriteFromUrl(`${IModelApp.publicPath}images/${imageName}.png`);
    return this.logo.activate(this._sprite);
  };

  public decorate = (context: DecorateContext) => {
    this.logo.decorate(context);
  };
}

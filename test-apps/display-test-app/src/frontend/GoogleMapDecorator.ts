import { CanvasDecoration, DecorateContext, Decorator, IconSprites, IModelApp, ScreenViewport, Sprite } from "@itwin/core-frontend";
import { Point3d, XYAndZ } from "@itwin/core-geometry";
import { GoogleMapsMapType } from "./GoogleMaps";

// Similar to 'SprintLocation' but uses a viewport pixel position instead of world position
class ImagePixelLocationDecoration implements CanvasDecoration {
  private _viewport?: ScreenViewport;
  private _sprite?: Sprite;
  private _alpha?: number;
  public readonly position = new Point3d();
  public get isActive(): boolean { return this._viewport !== undefined; }

  public activate(sprite: Sprite, viewport: ScreenViewport, position: XYAndZ): void {
    this._sprite = sprite;
    this._viewport = viewport;
    this.position.setFrom(position);
    sprite.loadPromise.then(() => {
      if (this._viewport === viewport) // was this deactivated while we were loading?
        viewport.invalidateDecorations();
    }).catch(() => this._viewport = undefined); // sprite was not loaded properly
  }

  public deactivate() {
    if (!this.isActive)
      return;
    this._viewport!.invalidateDecorations();
    this._viewport = undefined;
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
    if (context.viewport === this._viewport)
      context.addCanvasDecoration(this);
  }
}

export class GoogleMapsDecorator implements Decorator {
  public readonly logo = new ImagePixelLocationDecoration();
  private _sprite: Sprite|undefined;
  public constructor() {
  }

  public activate = (viewport: ScreenViewport, mapType: GoogleMapsMapType) => {
    const vpHeight = viewport.parentDiv.clientHeight;
    const imageName = mapType === "roadmap" ? "google_on_white" : "google_on_non_white";
    this._sprite = IconSprites.getSpriteFromUrl(`${IModelApp.publicPath}images/${imageName}.png`);
    this.logo.activate(this._sprite, viewport, {x: 100, y: vpHeight - 20, z: 0});
  };

  public decorate = (context: DecorateContext) => {
    this.logo.decorate(context);
  };
}

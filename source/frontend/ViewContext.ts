/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Viewport } from "./Viewport";
import { Sprite } from "./Sprites";
import { Point3d, Vector3d } from "@bentley/geometry-core/lib/PointVector";
import { HitDetail } from "./AccuSnap";

export class ViewContext {
  public viewport: Viewport;
}

export class NullContext extends ViewContext {
}

export class SnapContext extends ViewContext {
}

export class RenderContext extends ViewContext {
}

export class DecorateContext extends RenderContext {
  public addSprite(sprite: Sprite, location: Point3d, xVec: Vector3d, transparency: number) { }
  public drawSheetHit(hit: HitDetail): void { }
  public drawNormalHit(hit: HitDetail): void { }
  public drawHit(hit: HitDetail): void {
    const sheetVp = hit.m_sheetViewport;
    if (sheetVp && hit.m_viewport == this.viewport)
      return this.drawSheetHit(hit);

    return this.drawNormalHit(hit);
  }


}
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@bentley/imodeljs-common";
import { Point3d, Transform } from "@bentley/geometry-core";
import { IModelApp } from "../IModelApp";
import { DecorateContext } from "../ViewContext";
import { ScreenViewport } from "../Viewport";
import { GraphicType, PickableGraphicOptions } from "../render/GraphicBuilder";

/** A simple configurable box decorator for tests.
 * @internal
 */
export class BoxDecorator {
  public constructor(public readonly vp: ScreenViewport, public readonly color: ColorDef, public readonly pickable?: PickableGraphicOptions, public readonly placement?: Transform, private _shapePoints?: Point3d[]) {
    IModelApp.viewManager.addDecorator(this);
  }

  public decorate(context: DecorateContext): void {
    if (undefined === this._shapePoints) {
      const w = 0.5;
      const h = 0.5;
      this._shapePoints = [
        new Point3d(0, 0, 0),
        new Point3d(w, 0, 0),
        new Point3d(w, h, 0),
        new Point3d(0, h, 0),
        new Point3d(0, 0, 0),
      ];
      this.vp.npcToWorldArray(this._shapePoints);
    }

    const builder = context.createGraphic({
      placement: this.placement,
      type: GraphicType.Scene,
      pickable: this.pickable,
    });

    builder.setSymbology(this.color, this.color, 1);
    builder.addShape(this._shapePoints);
    context.addDecorationFromBuilder(builder);
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { Point3d, Sphere, Transform } from "@itwin/core-geometry";
import { IModelApp } from "../IModelApp";
import { DecorateContext } from "../ViewContext";
import { ScreenViewport } from "../Viewport";
import { GraphicType, PickableGraphicOptions } from "../render/GraphicBuilder";
import { GraphicBranch } from "../core-frontend";

/** A base class used strictly for `instanceof` checks in tests.
 * @internal
 */
export class TestDecorator {
  public static dropAll(): void {
    for (const decorator of IModelApp.viewManager.decorators.filter((x) => x instanceof TestDecorator))
      IModelApp.viewManager.dropDecorator(decorator);
  }
}

/** A simple configurable box decorator for tests.
 * @internal
 */
export class BoxDecorator extends TestDecorator {
  public viewport: ScreenViewport;
  public color: ColorDef;
  public pickable?: PickableGraphicOptions;
  public placement?: Transform;
  public points: Point3d[];
  public viewIndependentOrigin?: Point3d;
  public branchTransform?: Transform;
  public graphicType: GraphicType;

  public constructor(options: {
    viewport: ScreenViewport;
    color: ColorDef;
    pickable?: PickableGraphicOptions;
    placement?: Transform;
    points?: Point3d[];
    viewIndependentOrigin?: Point3d;
    branchTransform?: Transform;
    graphicType?: GraphicType;
  }) {
    super();
    this.viewport = options.viewport;
    this.color = options.color;
    this.pickable = options.pickable;
    this.placement = options.placement;
    this.viewIndependentOrigin = options.viewIndependentOrigin;
    this.branchTransform = options.branchTransform;
    this.graphicType = options.graphicType ?? GraphicType.Scene;

    if (options.points) {
      this.points = options.points;
    } else {
      const w = 0.5;
      const h = 0.5;
      this.points = [
        new Point3d(0, 0, 0),
        new Point3d(w, 0, 0),
        new Point3d(w, h, 0),
        new Point3d(0, h, 0),
        new Point3d(0, 0, 0),
      ];

      this.viewport.npcToWorldArray(this.points);
    }

    IModelApp.viewManager.addDecorator(this);
  }

  public drop() {
    IModelApp.viewManager.dropDecorator(this);
  }

  public decorate(context: DecorateContext): void {
    const builder = context.createGraphic({
      placement: this.placement,
      type: this.graphicType,
      pickable: this.pickable,
      viewIndependentOrigin: this.viewIndependentOrigin,
    });

    builder.setSymbology(this.color, this.color, 1);
    builder.addShape(this.points);

    let graphic = builder.finish();
    if (this.branchTransform) {
      const branch = new GraphicBranch();
      branch.add(graphic);
      graphic = context.createBranch(branch, this.branchTransform);
    }

    context.addDecoration(this.graphicType, graphic);
  }
}

/** A simple configurable sphere decorator for tests.
 * @internal
 */
export class SphereDecorator extends TestDecorator {
  public constructor(public readonly vp: ScreenViewport, public readonly color: ColorDef, public readonly pickable?: PickableGraphicOptions, public readonly placement?: Transform, private _center: Point3d = new Point3d(), private _radius: number = 1) {
    super();
    IModelApp.viewManager.addDecorator(this);
  }

  public drop() {
    IModelApp.viewManager.dropDecorator(this);
  }

  public decorate(context: DecorateContext): void {
    const builder = context.createGraphic({
      placement: this.placement,
      type: GraphicType.Scene,
      pickable: this.pickable,
    });

    builder.setSymbology(this.color, this.color, 1);
    const sphere = Sphere.createCenterRadius(this._center, this._radius);
    builder.addSolidPrimitive(sphere);
    context.addDecorationFromBuilder(builder);
  }
}

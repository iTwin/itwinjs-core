/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Matrix3d, Point3d, Transform, YawPitchRollAngles } from "@bentley/geometry-core";
import { IModelApp, Tool } from "@bentley/imodeljs-frontend";
import { parseArgs } from "@bentley/frontend-devtools";

class TransformProvider {
  public constructor(private readonly _models: Set<string>, private readonly _transform: Transform) { }

  public getModelDisplayTransform(modelId: string, baseTransform: Transform): Transform {
    if (!this._models.has(modelId))
      return baseTransform;

    return baseTransform.multiplyTransformTransform(this._transform);
  }
}

/** Apply a display transform to all currently displayed models. */
export class ApplyModelTransformTool extends Tool {
  public static toolId = "ApplyModelTransform";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 5; }

  public run(origin?: Point3d, scale?: Point3d, ypr?: YawPitchRollAngles): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    if (!origin || origin.isAlmostZero)
      if (!ypr || ypr.isIdentity())
        if (!scale || scale.isAlmostEqual(Point3d.create(1.0, 1.0, 1.0)))
          return false;

    const models = new Set<string>();
    vp.view.forEachModel((model) => models.add(model.id));

    let scl;
    if (undefined !== scale && (scale.x !== 1.0 || scale.y !== 1.0 || scale.z !== 1.0))
      scl = Matrix3d.createScale(scale.x, scale.y, scale.z);
    else
      scl = Matrix3d.createIdentity();
    const mat = ypr ? ypr.toMatrix3d() : Matrix3d.createIdentity();
    const tf = Transform.createRefs(origin, scl.multiplyMatrixMatrix(mat));
    vp.setModelDisplayTransformProvider(new TransformProvider(models, tf));
    return true;
  }

  public parseAndRun(...input: string[]): boolean {
    const args = parseArgs(input);
    const origin = new Point3d(args.getFloat("x") ?? 0.0, args.getFloat("y") ?? 0.0, args.getFloat("z") ?? 0.0);
    const scale = new Point3d(args.getFloat("sx") ?? 1.0, args.getFloat("sy") ?? 1.0, args.getFloat("sz") ?? 1.0);
    const ypr = YawPitchRollAngles.createDegrees(0, args.getFloat("p") ?? 0, args.getFloat("r") ?? 0);
    return this.run(origin, scale, ypr);
  }
}

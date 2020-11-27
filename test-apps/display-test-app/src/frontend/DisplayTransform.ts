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
  public static get minArgs(): number { return 0; }
  public static get maxArgs(): number { return 5; }

  public run(origin?: Point3d, ypr?: YawPitchRollAngles): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    if (!origin || origin.isAlmostZero)
      if (!ypr || ypr.isIdentity())
        return false;

    const models = new Set<string>();
    vp.view.forEachModel((model) => models.add(model.id));

    const mat = ypr ? ypr.toMatrix3d() : Matrix3d.createIdentity();
    const tf = Transform.createRefs(origin, mat);
    vp.setModelDisplayTransformProvider(new TransformProvider(models, tf));
    return true;
  }

  public parseAndRun(...input: string[]): boolean {
    const args = parseArgs(input);
    const origin = new Point3d(args.getInteger("x") ?? 0, args.getInteger("y") ?? 0, args.getInteger("z") ?? 0);
    const ypr = YawPitchRollAngles.createDegrees(0, args.getFloat("p") ?? 0, args.getFloat("r") ?? 0);
    return this.run(origin, ypr);
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Matrix3d, Point3d, Transform, YawPitchRollAngles } from "@itwin/core-geometry";
import { IModelApp, ModelDisplayTransform, Tool } from "@itwin/core-frontend";
import { parseArgs } from "@itwin/frontend-devtools";

class TransformProvider {
  public constructor(private readonly _models: Set<string>, private readonly _transform: ModelDisplayTransform) { }

  public getModelDisplayTransform(modelId: string): ModelDisplayTransform | undefined{
    return this._models.has(modelId) ? this._transform : undefined;
  }
}

/** Apply a display transform to all currently displayed models. */
export class ApplyModelTransformTool extends Tool {
  public static override toolId = "ApplyModelTransform";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 7; }

  public override async run(origin?: Point3d, ypr?: YawPitchRollAngles, scale?: number, premultiply?: boolean): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    if (!origin || origin.isAlmostZero)
      if (!ypr || ypr.isIdentity())
        if (!scale)
          return false;

    const models = new Set<string>();
    vp.view.forEachModel((model) => models.add(model.id));

    const mat = ypr ? ypr.toMatrix3d() : Matrix3d.createIdentity();
    if (scale)
      mat.scale(scale, mat);

    const transform = Transform.createRefs(origin, mat);
    vp.setModelDisplayTransformProvider(new TransformProvider(models, { transform, premultiply }));
    return true;
  }

  public override async parseAndRun(...input: string[]): Promise<boolean> {
    const args = parseArgs(input);
    const origin = new Point3d(args.getInteger("x") ?? 0, args.getInteger("y") ?? 0, args.getInteger("z") ?? 0);
    const ypr = YawPitchRollAngles.createDegrees(0, args.getFloat("p") ?? 0, args.getFloat("r") ?? 0);
    const scale = args.getFloat("s");
    const before = args.getBoolean("b");
    return this.run(origin, ypr, scale, before);
  }
}

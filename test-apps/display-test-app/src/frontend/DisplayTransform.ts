/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64Set, Id64String } from "@itwin/core-bentley";
import { Matrix3d, Point3d, Transform, TransformProps, YawPitchRollAngles } from "@itwin/core-geometry";
import { IModelApp, ModelDisplayTransform, ModelDisplayTransformProvider, Tool, Viewport } from "@itwin/core-frontend";
import { parseArgs } from "@itwin/frontend-devtools";

export interface DisplayTransformProps {
  modelId: Id64String;
  transform: TransformProps;
  premultiply?: boolean;
}

export type DisplayTransformProviderProps = DisplayTransformProps[];

export class DisplayTransformProvider implements ModelDisplayTransformProvider {
  private readonly _transforms = new Map<Id64String, ModelDisplayTransform>();

  private constructor() { }

  public static get(vp: Viewport): DisplayTransformProvider | undefined {
    return vp.view.modelDisplayTransformProvider instanceof DisplayTransformProvider ? vp.view.modelDisplayTransformProvider : undefined;
  }

  public static obtain(vp: Viewport): DisplayTransformProvider {
    let provider = this.get(vp);
    if (!provider) {
      vp.setModelDisplayTransformProvider(provider = new DisplayTransformProvider());
    }

    return provider;
  }

  public getModelDisplayTransform(modelId: string): ModelDisplayTransform | undefined{
    return this._transforms.get(modelId);
  }

  public set(modelIds: Id64Set | Id64String, transform: ModelDisplayTransform | undefined): void {
    for (const modelId of modelIds)
      this._set(modelId, transform);
  }

  private _set(modelId: Id64String, transform: ModelDisplayTransform | undefined): void {
    if (transform)
      this._transforms.set(modelId, transform);
    else
      this._transforms.delete(modelId);
  }

  public static disable(vp: Viewport): void {
    const provider = this.get(vp);
    if (provider)
      vp.view.modelDisplayTransformProvider = undefined;
  }

  public toJSON(): DisplayTransformProviderProps {
    const props: DisplayTransformProviderProps = [];
    for (const [modelId, transform] of this._transforms) {
      props.push({
        modelId,
        transform: transform.transform.toJSON(),
        premultiply: transform.premultiply,
      });
    }

    return props;
  }

  public static fromJSON(props: DisplayTransformProviderProps): DisplayTransformProvider {
    const provider = new DisplayTransformProvider();
    for (const prop of props) {
      provider._set(prop.modelId, { transform: Transform.fromJSON(prop.transform), premultiply: prop.premultiply });
    }

    return provider;
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
    DisplayTransformProvider.obtain(vp).set(models, { transform, premultiply });
    vp.invalidateScene();
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

export class ClearModelTransformsTool extends Tool {
  public static override toolId = "ClearModelTransforms";

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    const provider = vp ? DisplayTransformProvider.get(vp) : undefined;
    if (!provider || !vp)
      return false;

    const models = new Set<string>();
    vp.view.forEachModel((model) => models.add(model.id));
    provider.set(models, undefined);
    vp.invalidateScene();

    return true;
  }
}

export class DisableModelTransformsTool extends Tool {
  public static override toolId = "DisableModelTransforms";

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    DisplayTransformProvider.disable(vp);
    return true;
  }
}

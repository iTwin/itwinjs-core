/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry, Matrix3d, Point3d, Range3d, Transform } from "@bentley/geometry-core";
import { IModelApp, Tool } from "@bentley/imodeljs-frontend";
import { parseArgs } from "@bentley/frontend-devtools";
import { Npc } from "@bentley/imodeljs-common";
import { System } from "@bentley/imodeljs-frontend/lib/render/webgl/System";

class DisplayScaleTransformProvider {
  public constructor(private readonly _models: Set<string>, private readonly _scaleTransform: Transform) { }

  public getModelDisplayTransform(modelId: string, baseTransform: Transform): Transform {
    if (!this._models.has(modelId))
      return baseTransform;

    // Apply scale as last part of model to world transform.
    return this._scaleTransform.multiplyTransformTransform(baseTransform);
  }
}

/** Apply a display transform to all currently displayed models. */
export class ApplyModelDisplayScaleTool extends Tool {
  public static toolId = "ApplyModelDisplayScale";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 3; }

  public run(scale: Point3d): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    const newScaleIsUniform = Math.abs(scale.x - scale.y) < Geometry.smallMetricDistance && Math.abs(scale.x - scale.z) < Geometry.smallMetricDistance;
    console.log(`ApplyModelDisplayScaleTool     new scale (${scale.x}, ${scale.y}, ${scale.z})  newScaleIsUniform ${newScaleIsUniform}`);
    let oldScaleIsUniform = true;
    if (!System.instance.capabilities.isWebGL2) {
      // Check to see if any non-uniform scale was being used by the old transform provider.
      if (undefined !== vp.view.modelDisplayTransformProvider) {
        vp.view.forEachModel((model) => {
          const tf = vp.view.getModelDisplayTransform(model.id, Transform.createIdentity());
          const sx = tf.matrix.getColumn(0).magnitudeSquared();
          const sy = tf.matrix.getColumn(1).magnitudeSquared();
          const sz = tf.matrix.getColumn(2).magnitudeSquared();
          if (Math.abs(sx - sy) > Geometry.smallMetricDistance || Math.abs(sx - sz) > Geometry.smallMetricDistance)
            oldScaleIsUniform = false;
          console.log(`ApplyModelDisplayScaleTool     old scale (${sx}, ${sy}, ${sz})  oldScaleIsUniform ${oldScaleIsUniform}`);
        });
      }
    }

    if (scale.isAlmostEqual(Point3d.create(1.0, 1.0, 1.0))) {
      if (undefined !== vp.view.modelDisplayTransformProvider) {
        vp.view.modelDisplayTransformProvider = undefined;
        console.log(`ApplyModelDisplayScaleTool A   isWebGL2 ${System.instance.capabilities.isWebGL2}   change in scale uniforimty ${newScaleIsUniform !== oldScaleIsUniform}`);
        if (!System.instance.capabilities.isWebGL2 && newScaleIsUniform !== oldScaleIsUniform) {
          vp.invalidateScene();
          vp.requestRedraw();
        }
        return true;
      } else {
        return false;
      }
    }

    const models = new Set<string>();
    vp.view.forEachModel((model) => models.add(model.id));

    let scl;
    if (undefined !== scale && (scale.x !== 1.0 || scale.y !== 1.0 || scale.z !== 1.0))
      scl = Matrix3d.createScale(scale.x, scale.y, scale.z);
    else
      scl = Matrix3d.createIdentity();
    const sclTf = Transform.createRefs(Point3d.createZero(), scl);
    const tp = new DisplayScaleTransformProvider(models, sclTf);
    vp.setModelDisplayTransformProvider(tp);

    // Scale frustum.
    const f = vp.getWorldFrustum();
    // f.multiply(sclTf);
    // vp.setupViewFromFrustum(f);
    const points = [];
    points.push(Point3d.createAdd2Scaled(f.points[Npc.LeftBottomFront], 0.5, f.points[Npc.LeftBottomRear], 0.5));
    points.push(Point3d.createAdd2Scaled(f.points[Npc.LeftTopFront], 0.5, f.points[Npc.LeftTopRear], 0.5));
    points.push(Point3d.createAdd2Scaled(f.points[Npc.RightBottomFront], 0.5, f.points[Npc.RightBottomRear], 0.5));
    points.push(Point3d.createAdd2Scaled(f.points[Npc.RightTopFront], 0.5, f.points[Npc.RightTopRear], 0.5));
    vp.zoomToVolume(Range3d.createArray(points));

    console.log(`ApplyModelDisplayScaleTool B   isWebGL2 ${System.instance.capabilities.isWebGL2}   change in scale uniforimty ${newScaleIsUniform !== oldScaleIsUniform}`);
    if (!System.instance.capabilities.isWebGL2 && newScaleIsUniform !== oldScaleIsUniform) {
      vp.invalidateScene();
      vp.requestRedraw();
    }

    return true;
  }

  public parseAndRun(...input: string[]): boolean {
    const args = parseArgs(input);
    const scale = new Point3d(args.getFloat("x") ?? 1.0, args.getFloat("y") ?? 1.0, args.getFloat("z") ?? 1.0);
    return this.run(scale);
  }
}

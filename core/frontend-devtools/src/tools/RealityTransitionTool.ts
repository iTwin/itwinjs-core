/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  Tool,
  RenderScheduleState,
} from "@bentley/imodeljs-frontend";

import { RenderSchedule } from "@bentley/imodeljs-common";
import { Vector3d } from "@bentley/geometry-core";

enum FadeMode { X, Y, Z, Transparent }
export class RealityTransitionTool extends Tool {
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }
  public static toolId = "RealityTransition";
  public run(fadeMode: FadeMode = FadeMode.X): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    const displayStyle = vp.displayStyle;
    const view = vp.view;
    const script = new RenderScheduleState.Script(displayStyle.id, displayStyle.iModel);
    const timeNow = Date.now(), timeEnd = timeNow + 1000.0 * 60.0 * 60.0;
    const range = vp.iModel.projectExtents;
    const directions = [Vector3d.create(1, 0, 0), Vector3d.create(0, 1, 0), Vector3d.create(0, 0, 1)];
    const modelInTimeline: RenderSchedule.ModelTimelineProps = { modelId: "", elementTimelines: [] };
    const modelOutTimeline: RenderSchedule.ModelTimelineProps = { modelId: "", elementTimelines: [] };

    switch (fadeMode) {
      case FadeMode.Transparent: {
        const fadeInTimeline = new Array<RenderSchedule.VisibilityEntryProps>();
        fadeInTimeline.push({ time: timeNow, interpolation: 2, value: 100.0 });
        fadeInTimeline.push({ time: timeEnd, interpolation: 2, value: 0.0 });
        const fadeOutTimeline = new Array<RenderSchedule.VisibilityEntryProps>();
        fadeOutTimeline.push({ time: timeNow, interpolation: 2, value: 0.0 });
        fadeOutTimeline.push({ time: timeEnd, interpolation: 2, value: 100.0 });
        modelInTimeline.visibilityTimeline = fadeInTimeline;
        modelOutTimeline.visibilityTimeline = fadeOutTimeline;
        break;
      }

      default: {
        const direction = directions[fadeMode - FadeMode.X];
        const clipInTimeline = new Array<RenderSchedule.CuttingPlaneEntryProps>();
        clipInTimeline.push({ time: timeNow, interpolation: 2, value: { position: [range.low.x, range.low.y, range.low.z], direction: [direction.x, direction.y, direction.z] } });
        clipInTimeline.push({ time: timeEnd, interpolation: 2, value: { position: [range.high.x, range.high.y, range.high.z], direction: [direction.x, direction.y, direction.z] } });
        const clipOutTimeline = new Array<RenderSchedule.CuttingPlaneEntryProps>();
        clipOutTimeline.push({ time: timeNow, interpolation: 2, value: { position: [range.low.x, range.low.y, range.low.z], direction: [-direction.x, -direction.y, -direction.z] } });
        clipOutTimeline.push({ time: timeEnd, interpolation: 2, value: { position: [range.high.x, range.high.y, range.high.z], direction: [-direction.x, -direction.y, -direction.z] } });
        modelInTimeline.cuttingPlaneTimeline = clipInTimeline;
        modelOutTimeline.cuttingPlaneTimeline = clipOutTimeline;
        break;
      }
    }

    view.forEachModel((model) => {
      modelInTimeline.modelId = modelOutTimeline.modelId = model.id;
      script.modelTimelines.push(RenderScheduleState.ModelTimeline.fromJSON(model.jsonProperties.tilesetUrl === undefined ? modelInTimeline : modelOutTimeline));
    });

    modelOutTimeline.modelId = "";
    displayStyle.forEachRealityModel((model) => {
      modelOutTimeline.realityModelUrl = model.url;
      script.modelTimelines.push(RenderScheduleState.ModelTimeline.fromJSON(modelOutTimeline, displayStyle));

    });

    displayStyle.scheduleScript = script;
    vp.animationFraction = 0.0;
    return true;
  }
  public parseAndRun(...args: string[]): boolean {
    const transitionNames = [
      "x",
      "y",
      "z",
      "transparent",
    ];
    let fade = FadeMode.X;
    if (0 !== args.length) {
      const arg = args[0].toLowerCase();
      for (let i = 0; i < transitionNames.length; i++) {
        if (arg === transitionNames[i]) {
          fade = i;
          break;
        }
      }
    }

    return this.run(fade);
  }
}

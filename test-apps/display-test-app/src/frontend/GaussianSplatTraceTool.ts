/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Frustum } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { gaussianSplatValidationHtml, GaussianSplatValidationRecorder, GaussianSplatValidationTrace, IModelApp, Tool } from "@itwin/core-frontend";
import { DtaRpcInterface } from "../common/DtaRpcInterface";

interface Recording {
  recorder: GaussianSplatValidationRecorder;
  prefix: string;
  timer: number;
  saving: boolean;
}

let recording: Recording | undefined;
let cancelReplay: (() => void) | undefined;

/** Record the selected native viewport using DTA's existing key-in and file transport. */
export class GaussianSplatTraceTool extends Tool {
  public static override toolId = "GaussianSplatTrace";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return 3; }

  public override async run(mode: "visual" | "timing" | "stop" | "replay", prefix?: string, cache: "cold" | "warm" | "unknown" = "unknown"): Promise<boolean> {
    if (mode === "replay")
      return prefix ? this.replay(prefix) : false;
    if (mode === "stop") {
      const wasReplaying = !!cancelReplay;
      cancelReplay?.();
      const active = recording;
      if (!active || active.saving)
        return wasReplaying;
      clearTimeout(active.timer);
      active.recorder.stop();
      const trace = active.recorder.trace();
      const client = DtaRpcInterface.getClient();
      active.saving = true;
      try {
        await client.writeExternalFile(`${active.prefix}.json`, JSON.stringify(trace, undefined, 2));
        await client.writeExternalFile(`${active.prefix}.html`, gaussianSplatValidationHtml(trace));
        recording = undefined;
      } finally {
        // Preserve the stopped recorder if either write fails so the same stop command can retry.
        active.saving = false;
      }
      IModelApp.notifications.outputPrompt(`Gaussian ${trace.configuration.mode} trace saved: ${active.prefix}.json and .html (${trace.summary.nativeFrames} native frames)`);
      return true;
    }
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || recording)
      return false;
    const output = prefix ?? `lib/gaussian-validation-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    const recorder = new GaussianSplatValidationRecorder(vp, `DTA native viewport · ${cache} cache`, mode, cache);
    // Live pixel/occlusion changes require inspection; the deterministic fixture supplies the hard continuity oracle.
    const timer = window.setTimeout(() => {
      void this.run("stop").catch((error) => IModelApp.notifications.outputPrompt(`Gaussian trace could not be saved; retry dta gaussian trace stop: ${String(error)}`));
    }, 60_000);
    recording = { recorder, prefix: output, timer, saving: false };
    IModelApp.notifications.outputPrompt(`Recording Gaussian ${mode} evidence for up to 60 seconds; use dta gaussian trace stop to save`);
    return true;
  }

  private async replay(filename: string): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || vp.isDisposed || cancelReplay)
      return false;
    let animation = 0, canceled = false;
    const removeDisposed = vp.onDisposed.addListener(() => cancelReplay?.());
    const cancel = () => {
      if (canceled)
        return;
      canceled = true;
      cancelAnimationFrame(animation);
      removeDisposed();
      if (cancelReplay === cancel)
        cancelReplay = undefined;
    };
    // Reserve before the asynchronous file read so stop/dispose and duplicate commands are handled throughout loading.
    cancelReplay = cancel;
    try {
      const text = await DtaRpcInterface.getClient().readExternalFile(filename);
      if (canceled || vp.isDisposed) {
        cancel();
        return false;
      }
      const trace = JSON.parse(text) as GaussianSplatValidationTrace | null;
      const frames = trace?.frames;
      const validPoint = (point: unknown) => {
        const xyz = Array.isArray(point) ? point : point && typeof point === "object"
          ? [(point as { x?: unknown }).x, (point as { y?: unknown }).y, (point as { z?: unknown }).z] : [];
        return xyz.length === 3 && xyz.every((value) => typeof value === "number" && Number.isFinite(value));
      };
      if (trace?.version !== 1 || !Array.isArray(frames) || !frames.length || frames.length > 3600
        || frames.some((frame, i) => !frame || !Number.isFinite(frame.time) || (i > 0 && frame.time < frames[i-1].time)
          || !Array.isArray(frame.camera) || frame.camera.length !== 8 || !frame.camera.every(validPoint))
        || frames[frames.length-1].time - frames[0].time > 180_000) {
        cancel();
        return false;
      }
      if (recording)
        recording.recorder.trace().configuration.route = "recorded-camera-poses";
      let next = 0;
      const start = performance.now();
      const tick = (time: number) => {
        let current = -1;
        while (next < frames.length && frames[next].time - frames[0].time <= time - start)
          current = next++;
        if (current >= 0) {
          const frustum = new Frustum();
          frustum.setFromCorners(frames[current].camera.map((point) => Point3d.fromJSON(point)));
          if (!vp.setupViewFromFrustum(frustum)) {
            cancel();
            IModelApp.notifications.outputPrompt("Recorded camera pose could not be applied");
            return;
          }
        }
        if (next === frames.length) {
          cancel();
          IModelApp.notifications.outputPrompt("Recorded camera route complete; this is a programmatic pose replay, not an input latency run");
        } else {
          animation = requestAnimationFrame(tick);
        }
      };
      animation = requestAnimationFrame(tick);
      return true;
    } catch {
      cancel();
      IModelApp.notifications.outputPrompt("Gaussian replay file could not be read or parsed");
      return false;
    }
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const mode = args[0].toLowerCase();
    if (mode !== "visual" && mode !== "timing" && mode !== "stop" && mode !== "replay")
      return false;
    if (args[2] && args[2] !== "cold" && args[2] !== "warm" && args[2] !== "unknown")
      return false;
    return this.run(mode, args[1], args[2] as "cold" | "warm" | "unknown" | undefined);
  }
}

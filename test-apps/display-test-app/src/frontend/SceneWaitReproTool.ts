/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeDuration } from "@itwin/core-bentley";
import {
  IModelApp, NotifyMessageDetails, OffScreenViewport, OutputMessagePriority, Tool, ViewRect, ViewState,
} from "@itwin/core-frontend";
import { parseArgs } from "@itwin/frontend-devtools";

/** One pause of the tile-wait loop: how long it lasted and what ended it. */
interface Pause {
  ms: number;
  endedBy: "timer" | "tile load";
}

interface CaptureResult {
  totalMs: number;
  pauses: Pause[];
  visibility: DocumentVisibilityState;
  imageHash: string;
}

interface SceneWaitOptions {
  fix: boolean;
  count: number;
  delaySeconds: number;
}

function hashBytes(data: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of data)
    hash = Math.imul(hash ^ byte, 0x01000193);

  return (hash >>> 0).toString(16);
}

/** Resolves after `ms`, or as soon as any tile, tile tree, or tile's children finish loading. */
async function waitForTileLoadOrTimeout(ms: number): Promise<Pause> {
  const start = performance.now();
  return new Promise((resolve) => {
    const end = (endedBy: Pause["endedBy"]) => {
      clearTimeout(timer);
      removeListener();
      resolve({ ms: performance.now() - start, endedBy });
    };

    const timer = setTimeout(() => end("timer"), ms);
    const removeListener = IModelApp.tileAdmin.addLoadListener(() => end("tile load"));
  });
}

class SceneWaitViewport extends OffScreenViewport {
  /** The proposed fix: waitForSceneCompletion, but each pause ends when a tile loads,
   * and there is no pause after the scene is complete.
   */
  public async waitForSceneCompletionOnTileLoads(pauses: Pause[]): Promise<void> {
    const system = this.target.renderSystem;
    for (;;) {
      this.invalidateScene();
      this.renderFrame();

      const haveExternalTexRequests = system.hasExternalTextureRequests;
      const haveNewTiles = !this.areAllTileTreesLoaded || this._hasMissingTiles || this.hasAdditionalTiles();
      if ((!haveNewTiles && !haveExternalTexRequests) || this.isDisposed)
        return;

      if (haveNewTiles)
        IModelApp.tileAdmin.process();

      pauses.push(await waitForTileLoadOrTimeout(100));
    }
  }
}

/** Times one 640x480 OffScreenViewport capture of `view`, starting with no tiles loaded. */
async function capture(view: ViewState, fix: boolean): Promise<CaptureResult> {
  view.iModel.tiles.reset();

  const vp = SceneWaitViewport.create({ view: view.clone(), viewRect: new ViewRect(0, 0, 640, 480) });
  const visibility = document.visibilityState;
  const pauses: Pause[] = [];

  // Record how long each of waitForSceneCompletion's 100 ms pauses really lasts.
  const wait = BeDuration.wait.bind(BeDuration);
  BeDuration.wait = async (ms: number) => {
    const pauseStart = performance.now();
    await wait(ms);
    pauses.push({ ms: performance.now() - pauseStart, endedBy: "timer" });
  };

  let imageHash = "none";
  const start = performance.now();
  try {
    if (fix && vp instanceof SceneWaitViewport)
      await vp.waitForSceneCompletionOnTileLoads(pauses);
    else
      await vp.waitForSceneCompletion();

    const image = vp.readImageBuffer();
    if (image)
      imageHash = hashBytes(image.data);
  } finally {
    BeDuration.wait = wait;
  }

  const totalMs = performance.now() - start;
  vp[Symbol.dispose]();
  return { totalMs, pauses, visibility, imageHash };
}

function formatResult(index: number, fix: boolean, result: CaptureResult): string {
  const pauses = result.pauses
    .map((pause) => `${Math.round(pause.ms)}${pause.endedBy === "tile load" ? "t" : ""}`)
    .join(" ");

  return [
    `capture ${index}`,
    fix ? "fix" : "base",
    `page=${result.visibility}`,
    `total=${Math.round(result.totalMs)}ms`,
    `pauses=${result.pauses.length} [${pauses}]`,
    `image=${result.imageHash}`,
  ].join(" ");
}

/** Reproduces slow OffScreenViewport captures: Viewport.waitForSceneCompletion pauses 100 ms between
 * passes, and Chromium stretches each pause to ~1 s while the window is hidden.
 *
 * Captures the selected view `count` times, `delay` seconds apart, and logs each capture to the console.
 * Cover, minimize, or hide the window between captures to compare. `fix=1` uses the proposed fix.
 * Pause times ending in "t" ended early because a tile loaded.
 *
 * The on-screen view is detached while the tool runs, so that it does not load tiles for the captures.
 *
 * Usage: dta repro scene wait [fix=0|1] [count=10] [delay=5]
 */
export class SceneWaitReproTool extends Tool {
  public static override toolId = "ReproSceneWait";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 3; }

  public override async run(opts?: SceneWaitOptions): Promise<boolean> {
    const screenVp = IModelApp.viewManager.selectedView;
    if (!screenVp)
      return false;

    const { fix = false, count = 10, delaySeconds = 5 } = opts ?? {};
    const view = screenVp.view.clone();
    IModelApp.viewManager.dropViewport(screenVp, false);

    try {
      for (let index = 1; index <= count; index++) {
        const result = await capture(view, fix);
        console.log(formatResult(index, fix, result)); // eslint-disable-line no-console

        if (index < count)
          await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    } finally {
      IModelApp.viewManager.addViewport(screenVp);
    }

    const message = `Scene wait repro: ${count} captures logged to the console.`;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, message));
    return true;
  }

  public override async parseAndRun(...input: string[]): Promise<boolean> {
    const args = parseArgs(input);
    return this.run({
      fix: args.getBoolean("fix") ?? false,
      count: args.getInteger("count") ?? 10,
      delaySeconds: args.getFloat("delay") ?? 5,
    });
  }
}

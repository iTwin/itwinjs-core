/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ProcessDetector } from "@itwin/core-bentley";
import { Point2d } from "@itwin/core-geometry";
import { imageBufferToPngDataUrl, IModelApp, openImageDataUrlInNewWindow, ReadImageToCanvasOptions, Tool } from "@itwin/core-frontend";
import { parseArgs, parseToggle } from "@itwin/frontend-devtools";

interface SaveImageOptions {
  copyToClipboard?: boolean;
  width?: number;
  height?: number;
}

export class SaveImageTool extends Tool {
  public static override toolId = "SaveImage";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 3; }

  public override async run(opts?: SaveImageOptions): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    const width = opts?.width ?? vp.viewRect.width;
    const height = opts?.height ?? vp.viewRect.height;
    if (width <= 0 || height <= 0) {
      alert("Invalid image dimensions");
      return true;
    }

    const copy = opts?.copyToClipboard ?? false;

    await vp.waitForSceneCompletion();
    const buffer = vp.readImageBuffer({ size: new Point2d(width, height) });
    if (!buffer) {
      alert("Failed to read image");
      return true;
    }

    const url = imageBufferToPngDataUrl(buffer, false);
    if (!url) {
      alert("Failed to produce PNG");
      return true;
    }

    if (!copy) {
      openImageDataUrlInNewWindow(url, "Saved View");
      return true;
    }

    try {
      const getBlob = async () => {
        const png = await fetch(url);
        return png.blob();
      };

      // ClipboardItem currently unsupported in Firefox. Chrome expects a resolved promise; safari (and typescript type definitions) an unresolved promise.
      // Tested only in chrome+electron.
      const blob = ProcessDetector.isChromium ? (await getBlob()) as unknown as Promise<string | Blob> : getBlob();
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": blob,
        }),
      ]);
    } catch {
      alert("Failed to copy to clipboard");
    }

    return true;
  }

  public override async parseAndRun(...input: string[]): Promise<boolean> {
    const args = parseArgs(input);
    const opts: SaveImageOptions = {
      copyToClipboard: args.getBoolean("c"),
    };

    const dimension = args.getInteger("d");
    if (undefined !== dimension) {
      opts.width = opts.height = dimension;
    } else {
      opts.width = args.getInteger("w");
      opts.height = args.getInteger("h");
    }

    return this.run(opts);
  }
}

export class SaveImageWithCanvasDecorationsTool extends Tool {
  public static override toolId = "SaveImageWithCanvasDecorations";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async run(showDecorations: boolean): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp)
      return false;

    const width = vp.viewRect.width;
    const height = vp.viewRect.height;

    await vp.waitForSceneCompletion();
    const buffer = vp.readImageBuffer({ size: new Point2d(width, height) });
    if (!buffer) {
      alert("Failed to read image");
      return true;
    }

    const options: ReadImageToCanvasOptions = {
      includeCanvasDecorations: showDecorations,
    }

    const canvas = vp.readImageToCanvas(options);
    const url = canvas.toDataURL();

    if (!url) {
      alert("Failed to produce PNG");
      return true;
    }

    openImageDataUrlInNewWindow(url, "Saved View");
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    let showDecorations;
    if (!args[0])
      showDecorations = true;
    else
      showDecorations = !!parseToggle(args[0]);
    return this.run(showDecorations);
  }
}

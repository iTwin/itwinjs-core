/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { compareBooleans, Dictionary } from "@itwin/core-bentley";
import { ContourHit, DecorateContext, Decorator, IModelApp, Pixel, Tool, Viewport } from "@itwin/core-frontend";
import { Range2d, XAndY } from "@itwin/core-geometry";

function compareContours(lhs: ContourHit, rhs: ContourHit): number {
  return lhs.elevation - rhs.elevation || compareBooleans(lhs.isMajor, rhs.isMajor) || lhs.group.compare(rhs.group);
}

function getNeighborIndices(origin: XAndY, pixels: XAndY[]): number[] {
  const neighbors = [];
  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i];
    if (pixel !== origin && Math.abs(pixel.x - origin.x) <= 1 && Math.abs(pixel.y - origin.y) <= 1) {
      neighbors.push(i);
    }
  }

  return neighbors;
}

class ContourLine {
  public readonly contour: ContourHit;
  public readonly range: Range2d = new Range2d();
  public readonly points: XAndY[] = [];

  public constructor(contour: ContourHit) {
    this.contour = contour;
  }

  public add(point: XAndY): void {
    this.points.push(point);
    this.range.extendXY(point.x, point.y);
  }
}

function populateLine(line: ContourLine, originIndex: number, pixels: XAndY[]): void {
  if (pixels.length === 0) {
    return;
  }

  const origin = pixels.splice(originIndex)[0];
  line.add(origin);
  const neighbors = getNeighborIndices(origin, pixels);
  for (const neighbor of neighbors) {
    populateLine(line, neighbor, pixels);
  }
}

function bucketLines(lines: ContourLine[], contour: ContourHit, pixels: XAndY[], minLineLength: number): void {
  while(pixels.length > 0) {
    const line = new ContourLine(contour);
    populateLine(line, 0, pixels);
    if (line.points.length >= minLineLength) {
      lines.push(line);
    }
  }
}

function bucketContours(pixels: Pixel.Buffer, width: number, height: number): Dictionary<ContourHit, XAndY[]> {
  const buckets = new Dictionary<ContourHit, XAndY[]>((lhs, rhs) => compareContours(lhs, rhs));
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const px = pixels.getPixel(x, y);
      if (px.contour) {
        let bucket = buckets.get(px.contour);
        if (!bucket) {
          buckets.set(px.contour, bucket = []);
        }

        bucket.push({ x, y });
      }
    }
  }

  return buckets;
}

function readContours(viewport: Viewport, minLineLength = 2): ContourLine[] {
  const lines: ContourLine[] = [];
  const rect = viewport.viewRect;
  viewport.readPixels(rect, Pixel.Selector.Contours, (pixels) => {
    if (!pixels) {
      return;
    }

    const buckets = bucketContours(pixels, rect.width, rect.height);
    for (const entry of buckets) {
      bucketLines(lines, entry.key, entry.value, minLineLength);
    }
  });

  return lines;
}

class ContourElevationDecorator implements Decorator {
  public decorate(context: DecorateContext): void {
    const vp = context.viewport;
    if (!vp.view.isSpatialView() || !vp.view.displayStyle.settings.contours) {
      return;
    }

    const lines = readContours(vp);
    console.log(JSON.stringify(lines));
  }
}

let decorator: ContourElevationDecorator | undefined;

export class ContourElevationDecoratorTool extends Tool {
  public static override toolId = "ToggleContourElevationDecorator";

  public override async run(): Promise<boolean> {
    if (decorator) {
      IModelApp.viewManager.dropDecorator(decorator);
      decorator = undefined;
    } else {
      IModelApp.viewManager.addDecorator(decorator = new ContourElevationDecorator());
    }

    return true;
  }
}

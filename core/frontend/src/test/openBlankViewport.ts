/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64String, SortedArray } from "@itwin/core-bentley";
import { ColorDef, Feature, GeometryClass } from "@itwin/core-common";
import { BlankConnection } from "../IModelConnection";
import { ScreenViewport, Viewport } from "../Viewport";
import { ViewRect } from "../common/ViewRect";
import { SpatialViewState } from "../SpatialViewState";
import { Pixel } from "../render/Pixel";
import { createBlankConnection } from "./createBlankConnection";

/** Options for openBlankViewport.
 * @internal
 */
export interface BlankViewportOptions {
  /** Height in pixels. Default 100. */
  height?: number;
  /** Width in pixels. Default 100. */
  width?: number;
  /** iModel. If undefined, a new blank connection will be created. */
  iModel?: BlankConnection;
  /** The position of the containing div. */
  position?: "absolute";
}

/** Open a viewport for a blank spatial view.
 * @internal
 */
export function openBlankViewport(options?: BlankViewportOptions): ScreenViewport {
  const height = options?.height ?? 100;
  const width = options?.width ?? 100;
  const iModel = options?.iModel ?? createBlankConnection();

  const parentDiv = document.createElement("div");
  const hPx = `${height}px`;
  const wPx = `${width}px`;

  parentDiv.setAttribute("height", hPx);
  parentDiv.setAttribute("width", wPx);
  parentDiv.style.height = hPx;
  parentDiv.style.width = wPx;

  if (options?.position)
    parentDiv.style.position = options.position;

  document.body.appendChild(parentDiv);

  const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });

  class BlankViewport extends ScreenViewport {
    public ownedIModel?: BlankConnection;

    public override dispose(): void {
      document.body.removeChild(this.parentDiv);
      super.dispose();
      this.ownedIModel?.closeSync();
    }
  }

  const viewport = BlankViewport.create(parentDiv, view) as BlankViewport;
  if (undefined === options?.iModel)
    viewport.ownedIModel = iModel;

  return viewport;
}

export type TestBlankViewportOptions = BlankViewportOptions & { test: (vp: ScreenViewport) => void };

/** Open a viewport for a blank spatial view, invoke a test function, then dispose of the viewport and remove it from the DOM.
 * @internal
 */
export function testBlankViewport(args: TestBlankViewportOptions | ((vp: ScreenViewport) => void)): void {
  const vp = openBlankViewport(typeof args === "function" ? undefined : args);
  try {
    if (typeof args === "function")
      args(vp);
    else
      args.test(vp);
  } finally {
    vp.dispose();
  }
}

/** Open a viewport for a blank spatial view, invoke a test function, then dispose of the viewport and remove it from the DOM.
 * @internal
 */
export async function testBlankViewportAsync(args: ((vp: ScreenViewport) => Promise<void>)): Promise<void> {
  const vp = openBlankViewport(typeof args === "function" ? undefined : args);
  try {
    await args(vp);
  } finally {
    vp.dispose();
  }
}

function compareFeatures(lhs?: Feature, rhs?: Feature): number {
  if (undefined === lhs && undefined === rhs)
    return 0;
  else if (undefined === lhs)
    return -1;
  else if (undefined === rhs)
    return 1;
  else
    return lhs.compare(rhs);
}

function comparePixelData(lhs: Pixel.Data, rhs: Pixel.Data): number {
  let diff = lhs.distanceFraction - rhs.distanceFraction;
  if (0 === diff) {
    diff = lhs.type - rhs.type;
    if (0 === diff) {
      diff = lhs.planarity - rhs.planarity;
      if (0 === diff) {
        diff = compareFeatures(lhs.feature, rhs.feature);
      }
    }
  }

  return diff;
}

/** A set of distinct pixel values - see readUniquePixelData.
 * @internal
 */
export class PixelDataSet extends SortedArray<Pixel.Data> {
  public constructor() {
    super((lhs: Pixel.Data, rhs: Pixel.Data) => comparePixelData(lhs, rhs));
  }

  public get array(): Pixel.Data[] { return this._array; }

  public containsFeature(elemId?: Id64String, subcatId?: Id64String, geomClass?: GeometryClass) {
    return this.containsWhere((pxl) =>
      (undefined === elemId || pxl.elementId === elemId) &&
      (undefined === subcatId || pxl.subCategoryId === subcatId) &&
      (undefined === geomClass || pxl.geometryClass === geomClass));
  }
  public containsElement(id: Id64String) { return this.containsWhere((pxl) => pxl.elementId === id); }
  public containsPlanarity(planarity: Pixel.Planarity) { return this.containsWhere((pxl) => pxl.planarity === planarity); }
  public containsGeometryType(type: Pixel.GeometryType) { return this.containsWhere((pxl) => pxl.type === type); }
  public containsGeometry(type: Pixel.GeometryType, planarity: Pixel.Planarity) { return this.containsWhere((pxl) => pxl.type === type && pxl.planarity === planarity); }
  public containsWhere(criterion: (pxl: Pixel.Data) => boolean) {
    for (const pixel of this.array)
      if (criterion(pixel))
        return true;

    return false;
  }
}

/** A color value read from a viewport - see readColor.
 * @internal
 */
export class Color {
  public readonly v: number;
  public readonly r: number;
  public readonly g: number;
  public readonly b: number;
  public readonly a: number;

  // val is uint32 repr as AABBGGRR
  public constructor(val: number) {
    this.v = val;

    // ">>> 0" required to force unsigned because javascript is a brilliantly-designed language.
    this.r = ((val & 0x000000ff) >>> 0x00) >>> 0;
    this.g = ((val & 0x0000ff00) >>> 0x08) >>> 0;
    this.b = ((val & 0x00ff0000) >>> 0x10) >>> 0;
    this.a = ((val & 0xff000000) >>> 0x18) >>> 0;
  }

  public static from(val: number) { return new Color(val); }
  public static fromRgba(r: number, g: number, b: number, a: number) {
    const v = (r | (g << 0x08) | (b << 0x10) | (a << 0x18)) >>> 0;
    return Color.from(v);
  }

  public static fromColorDef(def: ColorDef): Color {
    const colors = def.colors;
    return Color.fromRgba(colors.r, colors.g, colors.b, 0xff - colors.t);
  }

  public compare(rhs: Color): number {
    return this.v - rhs.v;
  }

  public equalsColorDef(def: ColorDef): boolean {
    const colors = def.colors;
    return colors.r === this.r && colors.g === this.g && colors.b === this.b && colors.t === 0xff - this.a;
  }
}

/** A set of unique color values read from a viewport - see readUniqueColors.
 * @internal
 */
export class ColorSet extends SortedArray<Color> {
  public constructor() { super((lhs: Color, rhs: Color) => lhs.compare(rhs)); }
  public get array(): Color[] { return this._array; }
}

/** Read depth, geometry type, and feature for each pixel. Return only the unique ones.
 * Omit `readRect` to read the contents of the entire viewport.
 * @internal
 */
export function readUniquePixelData(vp: Viewport, readRect?: ViewRect, excludeNonLocatable = false): PixelDataSet {
  const rect = undefined !== readRect ? readRect : vp.viewRect;
  const set = new PixelDataSet();
  vp.readPixels(rect, Pixel.Selector.All, (pixels: Pixel.Buffer | undefined) => {
    if (undefined === pixels)
      return;

    const sRect = rect.clone();
    sRect.left = vp.cssPixelsToDevicePixels(sRect.left);
    sRect.right = vp.cssPixelsToDevicePixels(sRect.right);
    sRect.bottom = vp.cssPixelsToDevicePixels(sRect.bottom);
    sRect.top = vp.cssPixelsToDevicePixels(sRect.top);

    for (let x = sRect.left; x < sRect.right; x++)
      for (let y = sRect.top; y < sRect.bottom; y++)
        set.insert(pixels.getPixel(x, y));
  }, excludeNonLocatable);

  return set;
}

/** Read a specific pixel. @internal */
export function readPixel(vp: Viewport, x: number, y: number, excludeNonLocatable?: boolean): Pixel.Data {
  const pixels = readUniquePixelData(vp, new ViewRect(x, y, x + 1, y + 1), excludeNonLocatable);
  expect(pixels.length).to.equal(1);
  return pixels.array[0];
}

/** Read colors for each pixel; return the unique ones.
 * Omit `readRect` to read the contents of the entire viewport.
 * @internal
 */
export function readUniqueColors(vp: Viewport, readRect?: ViewRect): ColorSet {
  const rect = undefined !== readRect ? readRect : vp.viewRect;
  const buffer = vp.readImageBuffer({ rect })!;
  expect(buffer).not.to.be.undefined;
  const u32 = new Uint32Array(buffer.data.buffer);
  const colors = new ColorSet();
  for (const rgba of u32)
    colors.insert(Color.from(rgba));

  return colors;
}

/** Read the color of a specific pixel. @internal */
export function readColor(vp: Viewport, x: number, y: number): Color {
  const colors = readUniqueColors(vp, new ViewRect(x, y, x + 1, y + 1));
  expect(colors.length).to.equal(1);
  return colors.array[0];
}

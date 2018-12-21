/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64String, SortedArray } from "@bentley/bentleyjs-core";
import { Pixel } from "@bentley/imodeljs-frontend/lib/rendering";
import {
  IModelConnection,
  Viewport,
  ScreenViewport,
  OffScreenViewport,
  ViewRect,
  IModelApp,
} from "@bentley/imodeljs-frontend";
import { Feature, GeometryClass } from "@bentley/imodeljs-common";

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

export function comparePixelData(lhs: Pixel.Data, rhs: Pixel.Data): number {
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

  public compare(rhs: Color): number {
    return this.v - rhs.v;
  }
}

export class ColorSet extends SortedArray<Color> {
  public constructor() { super((lhs: Color, rhs: Color) => lhs.compare(rhs)); }

  public get array(): Color[] { return this._array; }
}

  // Read depth, geometry type, and feature for each pixel. Return only the unique ones.
function readUniquePixelData(vp: Viewport, readRect?: ViewRect): PixelDataSet {
  const rect = undefined !== readRect ? readRect : vp.viewRect;
  const set = new PixelDataSet();
  vp.readPixels(rect, Pixel.Selector.All, (pixels: Pixel.Buffer | undefined) => {
    if (undefined === pixels)
      return;

    for (let x = rect.left; x < rect.right; x++)
      for (let y = rect.top; y < rect.bottom; y++)
        set.insert(pixels.getPixel(x, y));
  });

  return set;
}

  // Read colors for each pixel; return the unique ones.
function readUniqueColors(vp: Viewport, readRect?: ViewRect): ColorSet {
  const rect = undefined !== readRect ? readRect : vp.viewRect;
  const buffer = vp.readImage(rect)!;
  expect(buffer).not.to.be.undefined;
  const u32 = new Uint32Array(buffer.data.buffer);
  const colors = new ColorSet();
  for (const rgba of u32)
    colors.insert(Color.from(rgba));

  return colors;
}

function readPixel(vp: Viewport, x: number, y: number): Pixel.Data {
  let pixel = new Pixel.Data();
  vp.readPixels(new ViewRect(x, y, x + 1, y + 1), Pixel.Selector.All, (pixels: Pixel.Buffer | undefined) => {
    if (undefined !== pixels)
      pixel = pixels.getPixel(x, y);
  });

  return pixel;
}

function readColor(vp: Viewport, x: number, y: number): Color {
  const colors = readUniqueColors(vp, new ViewRect(x, y, x + 1, y + 1));
  expect(colors.length).to.equal(1);
  return colors.array[0];
}

function areAllTilesLoaded(vp: Viewport): boolean {
  return vp.view.areAllTileTreesLoaded && vp.numRequestedTiles === 0;
}

export class OffScreenTestViewport extends OffScreenViewport {
  public readUniquePixelData(readRect?: ViewRect): PixelDataSet { return readUniquePixelData(this, readRect); }
  public readUniqueColors(readRect?: ViewRect): ColorSet { return readUniqueColors(this, readRect); }
  public readPixel(x: number, y: number): Pixel.Data { return readPixel(this, x, y); }
  public readColor(x: number, y: number): Color { return readColor(this, x, y); }
  public get areAllTilesLoaded(): boolean { return areAllTilesLoaded(this); }

  public async waitForAllTilesToRender(): Promise<void> {
    this.renderFrame();

    // NB: ToolAdmin loop is not turned on, and this vieport is not tracked by ViewManager - must manually pump tile request scheduler.
    IModelApp.tileRequests.process();

    if (this.areAllTilesLoaded)
      return Promise.resolve();

    await new Promise<void>((resolve: any) => setTimeout(resolve, 100));

    // This viewport isn't added to ViewManager, so it won't be notified (and have its scene invalidated) when new tiles become loaded.
    this.sync.invalidateScene();
    return this.waitForAllTilesToRender();
  }

  public static async createTestViewport(viewId: Id64String, imodel: IModelConnection, rect: ViewRect): Promise<OffScreenTestViewport> {
    const view = await imodel.views.load(viewId);
    const vp = this.create(view, rect) as OffScreenTestViewport;
    expect(vp).instanceof(OffScreenTestViewport);
    return vp;
  }
}

export class ScreenTestViewport extends ScreenViewport {
  public readUniquePixelData(readRect?: ViewRect): PixelDataSet { return readUniquePixelData(this, readRect); }
  public readUniqueColors(readRect?: ViewRect): ColorSet { return readUniqueColors(this, readRect); }
  public readPixel(x: number, y: number): Pixel.Data { return readPixel(this, x, y); }
  public readColor(x: number, y: number): Color { return readColor(this, x, y); }
  public get areAllTilesLoaded(): boolean { return areAllTilesLoaded(this); }

  public async waitForAllTilesToRender(): Promise<void> {
    // NB: This viewport is registered with ViewManager, so render loop and tile request scheduler are pumping.
    this.renderFrame();
    if (this.areAllTilesLoaded)
      return Promise.resolve();

    await new Promise<void>((resolve: any) => setTimeout(resolve, 100));
    return this.waitForAllTilesToRender();
  }

  public dispose(): void {
    super.dispose();
    document.body.removeChild(this.parentDiv);
  }

  public static async createTestViewport(viewId: Id64String, imodel: IModelConnection, width: number, height: number): Promise<ScreenTestViewport> {
    const div = document.createElement("div")! as HTMLDivElement;
    div.style.width = width + "px";
    div.style.height = height + "px";
    document.body.appendChild(div);

    const view = await imodel.views.load(viewId);
    const vp = this.create(div, view) as ScreenTestViewport;
    expect(vp).instanceof(ScreenTestViewport);
    return vp;
  }
}

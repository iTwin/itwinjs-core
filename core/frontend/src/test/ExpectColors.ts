/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorDef } from "@itwin/core-common";
import { ScreenViewport } from "../Viewport";
import { ViewRect } from "../common/ViewRect";

/** A viewport-color-checking function for tests. Tests for the presence of a list of expected colors in the entire viewport or specified ViewRect.
 * @internal
 */
export function expectColors(viewport: ScreenViewport, expected: ColorDef[], rect?: ViewRect): void {
  viewport.renderFrame();
  const buf = viewport.readImageBuffer({ rect })!;
  expect(buf).not.to.be.undefined;

  const u32 = new Uint32Array(buf.data.buffer);
  const actualColors = new Set<ColorDef>();
  for (const rgba of u32) {
    const r = ((rgba & 0x000000ff) >>> 0x00) >>> 0;
    const g = ((rgba & 0x0000ff00) >>> 0x08) >>> 0;
    const b = ((rgba & 0x00ff0000) >>> 0x10) >>> 0;
    const a = ((rgba & 0xff000000) >>> 0x18) >>> 0;
    actualColors.add(ColorDef.from(r, g, b, 0xff - a));
  }

  const expectedTbgr = expected.map((x) => x.tbgr.toString(16)).sort();
  const actualTbgr = Array.from(actualColors).map((x) => x.tbgr.toString(16)).sort();
  expect(actualTbgr).to.deep.equal(expectedTbgr);
}

/** A viewport-color-checking function for tests. Tests for the presence of a list of any unexpected colors in the entire viewport or specified ViewRect. If any of the colors are found, this function expects them not to be found and will fail the test.
 * @internal
 */
export function expectNotTheseColors(viewport: ScreenViewport, expected: ColorDef[], rect?: ViewRect): void {
  viewport.renderFrame();
  const buf = viewport.readImageBuffer({ rect })!;
  expect(buf).not.to.be.undefined;

  const u32 = new Uint32Array(buf.data.buffer);
  const values = new Set<number>();
  for (const rgba of u32)
    values.add(rgba);

  expect(values.size).to.equal(expected.length);

  for (const rgba of values) {
    const r = ((rgba & 0x000000ff) >>> 0x00) >>> 0;
    const g = ((rgba & 0x0000ff00) >>> 0x08) >>> 0;
    const b = ((rgba & 0x00ff0000) >>> 0x10) >>> 0;
    const a = ((rgba & 0xff000000) >>> 0x18) >>> 0;
    const actualColor = ColorDef.from(r, g, b, 0xff - a);
    expect(expected.findIndex((x) => x.tbgr === actualColor.tbgr)).to.equal(-1);
  }
}

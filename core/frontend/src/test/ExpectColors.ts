/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorDef } from "@itwin/core-common";
import { ScreenViewport } from "../Viewport";
import { ViewRect } from "../ViewRect";

/** A viewport-color-checking function for tests. Tests for the presence of a list of expected colors in the entire viewport or specified ViewRect.
 * @internal
 */
export function expectColors(viewport: ScreenViewport, expected: ColorDef[], viewRect?: ViewRect): void {
  viewport.renderFrame();
  const buf = viewport.readImage(viewRect !== undefined ? viewRect : viewport.viewRect)!;
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
    expect(expected.findIndex((x) => x.tbgr === actualColor.tbgr)).least(0);
  }
}

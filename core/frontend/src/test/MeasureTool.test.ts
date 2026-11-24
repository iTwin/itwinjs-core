/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { IModelApp } from "../IModelApp";
import { MeasureLocationTool } from "../tools/MeasureTool";

class TestLocationTool extends MeasureLocationTool {
  public async getTooltip(point: Point3d) { return this.getMarkerToolTip(point); }
}

beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
afterAll(async () => IModelApp.shutdown());

it("displays formatted coordinates literally without changing the tooltip layout", async () => {
  const formatted = "1 <unit> &amp; m";
  const format = vi.spyOn(IModelApp.quantityFormatter, "formatQuantity").mockReturnValue(formatted);
  try {
    const tip = await new TestLocationTool().getTooltip(Point3d.createZero());
    expect(tip.childNodes[1]?.textContent).toBe(` ${formatted}, ${formatted}, ${formatted}`);
    expect(Array.from(tip.children, (element) => element.tagName)).toEqual(["B", "BR"]);
  } finally {
    format.mockRestore();
  }
});

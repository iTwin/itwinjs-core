/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RenderSchedule } from "@itwin/core-common";
import { BlankConnection } from "../../IModelConnection";
import { PhysicalModelState } from "../../ModelState";
import { SpatialViewState } from "../../SpatialViewState";
import { MockRender } from "../../internal/render/MockRender";
import { createPrimaryTileTreeReference } from "../../internal/tile/PrimaryTileTree";
import { createBlankConnection } from "../createBlankConnection";

describe("Primary tile tree frontend schedules", () => {
  let iModel: BlankConnection;

  beforeEach(async () => {
    await MockRender.App.startup({ tileAdmin: { enableFrontendScheduleScripts: true } });
    iModel = createBlankConnection();
  });

  afterEach(async () => {
    iModel.closeSync();
    await MockRender.App.shutdown();
  });

  it("updates the tree owner when an element timeline is attached, replaced, or removed", () => {
    const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const model = new PhysicalModelState({ id: "0x40", classFullName: "BisCore:PhysicalModel", modeledElement: { id: "0x40" } }, iModel);
    const ref = createPrimaryTileTreeReference(view.iModelRefs.primary, model);
    const originalOwner = ref.treeOwner;
    const createScript = (elementId: string) => RenderSchedule.Script.fromJSON([{
      modelId: model.id,
      elementTimelines: [{
        batchId: 1,
        elementIds: [elementId],
        colorTimeline: [{ time: 100, value: { red: 255, green: 0, blue: 0 } }, { time: 160, value: { red: 0, green: 255, blue: 0 } }],
      }],
    }]);

    view.displayStyle.scheduleScript = createScript("0x4a9");
    const animatedOwner = ref.treeOwner;
    expect(animatedOwner).not.toBe(originalOwner);
    expect(ref.treeOwner).toBe(animatedOwner);

    view.displayStyle.scheduleScript = createScript("0x4d7");
    const replacementOwner = ref.treeOwner;
    expect(replacementOwner).not.toBe(animatedOwner);
    expect(ref.treeOwner).toBe(replacementOwner);

    view.displayStyle.scheduleScript = undefined;
    expect(ref.treeOwner).toBe(originalOwner);
  });
});

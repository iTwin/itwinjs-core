/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BackstageItemUtilities } from "../../ui-framework/backstage/BackstageItemUtilities";

describe("BackstageItemUtilities", () => {
  it("createStageLauncher should create a valid launcher", () => {
    const launcher = BackstageItemUtilities.createStageLauncher("Test1", 100, 10, "label", undefined, "icon-placeholder", { isEnabled: false });
    expect(launcher.groupPriority).to.eq(100);
    expect(launcher.itemPriority).to.eq(10);
    expect(launcher.label).to.eq("label");
    expect(launcher.icon).to.eq("icon-placeholder");
    expect(launcher.isEnabled).to.be.false;
  });

  it("createStageLauncher should create a valid launcher", () => {
    const actionItem = BackstageItemUtilities.createActionItem("id", 200, 30, () => { }, "label", undefined, "icon-placeholder", { isEnabled: false });
    expect(actionItem.id).to.eq("id");
    expect(actionItem.groupPriority).to.eq(200);
    expect(actionItem.itemPriority).to.eq(30);
    expect(actionItem.label).to.eq("label");
    expect(actionItem.icon).to.eq("icon-placeholder");
    expect(actionItem.isEnabled).to.be.false;
  });
});

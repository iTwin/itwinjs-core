/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ConditionalBooleanValue } from "@itwin/appui-abstract";
import { BackstageItemUtilities } from "../../appui-react/backstage/BackstageItemUtilities";

describe("BackstageItemUtilities", () => {
  it("createStageLauncher should create a valid launcher", () => {
    const launcher = BackstageItemUtilities.createStageLauncher("Test1", 100, 10, "label", undefined, "icon-placeholder", { isDisabled: true }); // eslint-disable-line deprecation/deprecation
    expect(launcher.groupPriority).to.eq(100);
    expect(launcher.itemPriority).to.eq(10);
    expect(launcher.label).to.eq("label");
    expect(launcher.icon).to.eq("icon-placeholder");
    expect(ConditionalBooleanValue.getValue(launcher.isDisabled)).to.be.true;
  });

  it("createStageLauncher should create a valid launcher", () => {
    const actionItem = BackstageItemUtilities.createActionItem("id", 200, 30, () => { }, "label", undefined, "icon-placeholder", { isDisabled: true }); // eslint-disable-line deprecation/deprecation
    expect(actionItem.id).to.eq("id");
    expect(actionItem.groupPriority).to.eq(200);
    expect(actionItem.itemPriority).to.eq(30);
    expect(actionItem.label).to.eq("label");
    expect(actionItem.icon).to.eq("icon-placeholder");
    expect(ConditionalBooleanValue.getValue(actionItem.isDisabled)).to.be.true;
  });
});

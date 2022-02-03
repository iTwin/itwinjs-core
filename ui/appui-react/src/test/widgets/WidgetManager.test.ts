/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import type { AbstractWidgetProps, UiItemsProvider} from "@itwin/appui-abstract";
import { AbstractZoneLocation, StagePanelLocation, StagePanelSection, StageUsage, UiItemsManager, WidgetState } from "@itwin/appui-abstract";
import { WidgetDef, WidgetManager, ZoneLocation } from "../../appui-react";
import { TestUtils } from "../TestUtils";

class TestUiProvider implements UiItemsProvider {
  public readonly id = "TestUiProvider-Widget";

  public provideWidgets(stageId: string, _stageUsage: string, location: StagePanelLocation, _section?: StagePanelSection, zoneLocation?: AbstractZoneLocation): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (stageId === "TestStage" && location === StagePanelLocation.Right) {
      widgets.push({
        id: "test2",
        getWidgetContent: () => "Hello World!",
        saveTransientState: () => { },
        restoreTransientState: () => false,
      });
    } else if (stageId === "TestStage" && zoneLocation === AbstractZoneLocation.BottomRight) {
      widgets.push({
        id: "test3",
        getWidgetContent: () => "Hello World!",
        saveTransientState: () => { },
        restoreTransientState: () => false,
      });
    } else if (stageId === "TestStageWithFloatingWidgets" && location === StagePanelLocation.Right) {
      widgets.push({
        id: "test-floating-1",
        getWidgetContent: () => "Hello World!",
        saveTransientState: () => { },
        restoreTransientState: () => false,
        defaultState: WidgetState.Floating,
        defaultFloatingPosition: { x: 100, y: 200 },
        floatingContainerId: "my-floating-container",
        isFloatingStateSupported: true,
        isFloatingStateWindowResizable: false,
        priority: 0,
      });
      widgets.push({
        id: "test-floating-2",
        getWidgetContent: () => "Hello World 2!",
        saveTransientState: () => { },
        restoreTransientState: () => false,
        defaultState: WidgetState.Floating,
        isFloatingStateSupported: true,
        priority: 100,
      });

    }
    return widgets;
  }
}

describe("WidgetManager", () => {
  let widgetManager: WidgetManager;

  beforeEach(() => {
    widgetManager = new WidgetManager();
  });

  it("addWidgetDef should log error when no stageId or stageUsage is provided", () => {
    const spyMethod = sinon.spy(Logger, "logError");
    const widgetDef = new WidgetDef({ id: "test" });
    widgetManager.addWidgetDef(widgetDef, undefined, undefined, ZoneLocation.BottomRight);
    spyMethod.calledOnce.should.true;
  });

  it("addWidgetDef should add a WidgetDef targeting a stageId", () => {
    const widgetDef = new WidgetDef({ id: "test" });
    widgetManager.addWidgetDef(widgetDef, "TestStage", undefined, ZoneLocation.BottomRight);
    expect(widgetManager.widgets.length).to.eq(1);
  });

  it("addWidgetDef should add a WidgetDef targeting a stageUsage", () => {
    const widgetDef = new WidgetDef({ id: "test" });
    widgetManager.addWidgetDef(widgetDef, undefined, "TestUsage", ZoneLocation.BottomRight);
    expect(widgetManager.widgetCount).to.eq(1);
  });

  it("addWidgetDef should add another WidgetDef", () => {
    const widgetDef = new WidgetDef({ id: "test1" });
    widgetManager.addWidgetDef(widgetDef, undefined, "TestUsage", ZoneLocation.BottomRight);
    expect(widgetManager.widgetCount).to.eq(1);

    const widgetDef2 = new WidgetDef({ id: "test2" });
    widgetManager.addWidgetDef(widgetDef2, "TestStage", undefined, ZoneLocation.BottomRight);
    expect(widgetManager.widgetCount).to.eq(2);
  });

  it("addWidgetDef should not add a duplicate WidgetDef", () => {
    const widgetDef = new WidgetDef({ id: "test1" });
    widgetManager.addWidgetDef(widgetDef, undefined, "TestUsage", ZoneLocation.BottomRight);
    expect(widgetManager.widgetCount).to.eq(1);
    widgetManager.addWidgetDef(widgetDef, undefined, "TestUsage", ZoneLocation.BottomRight);
    expect(widgetManager.widgetCount).to.eq(1);
  });

  it("getWidgetDefs should find a WidgetDef targeting a stageId", () => {
    const widgetDef = new WidgetDef({ id: "test" });
    widgetManager.addWidgetDef(widgetDef, "TestStage", undefined, ZoneLocation.BottomRight);
    expect(widgetManager.widgetCount).to.eq(1);

    const widgetDefs = widgetManager.getWidgetDefs("TestStage", StageUsage.General, ZoneLocation.BottomRight);
    expect(widgetDefs).to.not.be.undefined;
    if (widgetDefs)
      expect(widgetDefs.length).to.eq(1);
  });

  it("getWidgetDefs should find a WidgetDef targeting a stageUsage", () => {
    const widgetDef = new WidgetDef({ id: "test" });
    widgetManager.addWidgetDef(widgetDef, undefined, "TestUsage", ZoneLocation.BottomRight);
    expect(widgetManager.widgetCount).to.eq(1);

    const widgetDefs = widgetManager.getWidgetDefs("TestStage", "TestUsage", ZoneLocation.BottomRight);
    expect(widgetDefs).to.not.be.undefined;
    if (widgetDefs)
      expect(widgetDefs.length).to.eq(1);
  });

  it("getWidgetDefs should find a WidgetDef with location & section", () => {
    const widgetDef = new WidgetDef({ id: "test" });
    widgetManager.addWidgetDef(widgetDef, "TestStage", "TestUsage", ZoneLocation.BottomRight, StagePanelSection.Start);
    expect(widgetManager.widgetCount).to.eq(1);

    const widgetDefs = widgetManager.getWidgetDefs("TestStage", "TestUsage", ZoneLocation.BottomRight, StagePanelSection.Start);
    expect(widgetDefs).to.not.be.undefined;
    if (widgetDefs)
      expect(widgetDefs.length).to.eq(1);
  });

  it("getWidgetDefs should get a WidgetDef from an 'addon' UiItemsProvider", async () => {
    const widgetDef = new WidgetDef({ id: "test" });
    widgetManager.addWidgetDef(widgetDef, "TestStage", undefined, StagePanelLocation.Right);
    expect(widgetManager.widgetCount).to.eq(1);

    const testUiProvider = new TestUiProvider();
    UiItemsManager.register(testUiProvider);
    await TestUtils.flushAsyncOperations();

    const widgetDefs = widgetManager.getWidgetDefs("TestStage", StageUsage.General, StagePanelLocation.Right);
    expect(widgetDefs).to.not.be.undefined;
    if (widgetDefs)
      expect(widgetDefs.length).to.eq(2);

    const zoneWidgetDefs = widgetManager.getWidgetDefs("TestStage", StageUsage.General, ZoneLocation.BottomRight);
    expect(zoneWidgetDefs).to.not.be.undefined;
    if (zoneWidgetDefs)
      expect(zoneWidgetDefs.length).to.eq(1);

    UiItemsManager.unregister(testUiProvider.id);
  });

  it("getWidgetDefs should get a WidgetDef with default floating stage from an 'addon' UiItemsProvider", async () => {
    const testUiProvider = new TestUiProvider();
    UiItemsManager.register(testUiProvider);
    await TestUtils.flushAsyncOperations();

    const widgetDefs = widgetManager.getWidgetDefs("TestStageWithFloatingWidgets", StageUsage.General, StagePanelLocation.Right);
    expect(widgetDefs).to.not.be.undefined;
    expect(widgetDefs?.length).to.eq(2);
    expect(widgetDefs?.[0].floatingContainerId).to.eq("my-floating-container");
    expect(widgetDefs?.[0].defaultFloatingPosition).to.eql({ x: 100, y: 200 });
    UiItemsManager.unregister(testUiProvider.id);
  });

  it("getWidgetDefs should not find a WidgetDef if no match", () => {
    const widgetDef = new WidgetDef({ id: "test" });
    widgetManager.addWidgetDef(widgetDef, "TestStage", "TestUsage", ZoneLocation.BottomRight);
    expect(widgetManager.widgetCount).to.eq(1);

    const widgetDefs = widgetManager.getWidgetDefs("NotUsage", "NotStage", ZoneLocation.BottomRight, StagePanelSection.Start);
    expect(widgetDefs).to.be.undefined;
  });

  it("removeWidgetDef should remove a WidgetDef", () => {
    const widgetDef = new WidgetDef({ id: "test" });
    widgetManager.addWidgetDef(widgetDef, "TestStage", "TestUsage", ZoneLocation.BottomRight);
    expect(widgetManager.widgetCount).to.eq(1);

    const result = widgetManager.removeWidgetDef("test");
    expect(result).to.be.true;
    expect(widgetManager.widgetCount).to.eq(0);
  });

  it("removeWidgetDef should not remove a WidgetDef if not found", () => {
    const widgetDef = new WidgetDef({ id: "test" });
    widgetManager.addWidgetDef(widgetDef, "TestStage", "TestUsage", ZoneLocation.BottomRight);
    expect(widgetManager.widgetCount).to.eq(1);

    const result = widgetManager.removeWidgetDef("test2");
    expect(result).to.be.false;
    expect(widgetManager.widgetCount).to.eq(1);
  });

});

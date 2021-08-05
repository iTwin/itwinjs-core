/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@bentley/bentleyjs-core";
import { AbstractWidgetProps, AbstractZoneLocation, StagePanelLocation, StagePanelSection, StageUsage, UiItemsManager, UiItemsProvider } from "@bentley/ui-abstract";
import { WidgetDef, WidgetManager, WidgetProvider, ZoneLocation } from "../../ui-framework";
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

  it("addWidgetProvider should add a provider", () => {
    const provider: WidgetProvider = {
      id: "test",
      getWidgetDefs: (_stageId: string, _stageUsage: string, _location: ZoneLocation | StagePanelLocation, _section?: StagePanelSection | undefined): ReadonlyArray<WidgetDef> | undefined => {
        return undefined;
      },
    };
    widgetManager.addWidgetProvider(provider);
    expect(widgetManager.providers.length).to.eq(1);
  });

  it("addWidgetProvider should not add a duplicate provider", () => {
    const provider: WidgetProvider = {
      id: "test",
      getWidgetDefs: (_stageId: string, _stageUsage: string, _location: ZoneLocation | StagePanelLocation, _section?: StagePanelSection | undefined): ReadonlyArray<WidgetDef> | undefined => {
        return undefined;
      },
    };
    widgetManager.addWidgetProvider(provider);
    expect(widgetManager.providers.length).to.eq(1);
    widgetManager.addWidgetProvider(provider);
    expect(widgetManager.providers.length).to.eq(1);
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

  it("getWidgetDefs should get a WidgetDef from a provider", () => {
    const widgetDef = new WidgetDef({ id: "test" });
    widgetManager.addWidgetDef(widgetDef, "TestStage", undefined, ZoneLocation.BottomRight);
    expect(widgetManager.widgetCount).to.eq(1);

    const provider: WidgetProvider = {
      id: "test",
      getWidgetDefs: (stageId: string, _stageUsage: string, location: ZoneLocation | StagePanelLocation, _section?: StagePanelSection | undefined): ReadonlyArray<WidgetDef> | undefined => {
        if (stageId === "TestStage" && location === ZoneLocation.BottomRight)
          return [new WidgetDef({ id: "test2" })];
        return undefined;
      },
    };
    widgetManager.addWidgetProvider(provider);
    expect(widgetManager.providers.length).to.eq(1);

    const widgetDefs = widgetManager.getWidgetDefs("TestStage", StageUsage.General, ZoneLocation.BottomRight);
    expect(widgetDefs).to.not.be.undefined;
    if (widgetDefs)
      expect(widgetDefs.length).to.eq(2);
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

  it("removeWidgetProvider should remove a WidgetProvider", () => {
    const provider: WidgetProvider = {
      id: "test",
      getWidgetDefs: (_stageId: string, _stageUsage: string, _location: ZoneLocation | StagePanelLocation, _section?: StagePanelSection | undefined): ReadonlyArray<WidgetDef> | undefined => {
        return undefined;
      },
    };
    widgetManager.addWidgetProvider(provider);
    expect(widgetManager.providers.length).to.eq(1);

    const result = widgetManager.removeWidgetProvider("test");
    expect(result).to.be.true;
    expect(widgetManager.providers.length).to.eq(0);
  });

  it("removeWidgetProvider should not remove a WidgetProvider if not found", () => {
    const provider: WidgetProvider = {
      id: "test",
      getWidgetDefs: (_stageId: string, _stageUsage: string, _location: ZoneLocation | StagePanelLocation, _section?: StagePanelSection | undefined): ReadonlyArray<WidgetDef> | undefined => {
        return undefined;
      },
    };
    widgetManager.addWidgetProvider(provider);
    expect(widgetManager.providers.length).to.eq(1);

    const result = widgetManager.removeWidgetProvider("test2");
    expect(result).to.be.false;
    expect(widgetManager.providers.length).to.eq(1);
  });

});

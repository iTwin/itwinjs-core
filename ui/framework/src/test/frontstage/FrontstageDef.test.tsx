/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { MockRender } from "@bentley/imodeljs-frontend";
import { ContentLayoutDef, CoreTools, Frontstage, FrontstageDef, FrontstageManager, FrontstageProps, FrontstageProvider, StagePanelDef, WidgetDef, WidgetState } from "../../ui-framework";
import TestUtils from "../TestUtils";
import { AbstractWidgetProps, StagePanelLocation, StagePanelSection, UiItemsManager, UiItemsProvider } from "@bentley/ui-abstract";

describe("FrontstageDef", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  class BadLayoutFrontstage extends FrontstageProvider {

    public get frontstage(): React.ReactElement<FrontstageProps> {

      return (
        <Frontstage
          id="BadLayout"
          defaultTool={CoreTools.selectElementCommand}
          defaultLayout="abc"
          contentGroup="def"
        />
      );
    }
  }

  class BadGroupFrontstage extends FrontstageProvider {
    public get frontstage(): React.ReactElement<FrontstageProps> {

      const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(
        {
          id: "SingleContent",
          descriptionKey: "App:ContentLayoutDef.SingleContent",
          priority: 100,
        },
      );

      return (
        <Frontstage
          id="BadGroup"
          defaultTool={CoreTools.selectElementCommand}
          defaultLayout={contentLayoutDef}
          contentGroup="def"
        />
      );
    }
  }

  it("setActiveFrontstage should throw Error on invalid content layout", () => {
    const frontstageProvider = new BadLayoutFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    expect(FrontstageManager.setActiveFrontstage("BadLayout")).to.be.rejectedWith(Error); // eslint-disable-line @typescript-eslint/no-floating-promises
  });

  it("setActiveFrontstage should throw Error on invalid content group", () => {
    const frontstageProvider = new BadGroupFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    expect(FrontstageManager.setActiveFrontstage("BadGroup")).to.be.rejectedWith(Error); // eslint-disable-line @typescript-eslint/no-floating-promises
  });

  describe("restoreLayout", () => {
    it("should emit onFrontstageRestoreLayoutEvent", () => {
      const spy = sinon.spy(FrontstageManager.onFrontstageRestoreLayoutEvent, "emit");
      const frontstageDef = new FrontstageDef();
      frontstageDef.restoreLayout();
      spy.calledOnceWithExactly(sinon.match({
        frontstageDef,
      })).should.true;
    });

    it("should restore panel widget to default state", () => {
      const frontstageDef = new FrontstageDef();
      const rightPanel = new StagePanelDef();
      const w1 = new WidgetDef({
        defaultState: WidgetState.Open,
      });
      sinon.stub(rightPanel, "widgetDefs").get(() => [w1]);
      sinon.stub(frontstageDef, "rightPanel").get(() => rightPanel);
      const spy = sinon.spy(w1, "setWidgetState");

      frontstageDef.restoreLayout();
      sinon.assert.calledOnceWithExactly(spy, WidgetState.Open);
    });

    it("should restore panel size to default size", () => {
      const frontstageDef = new FrontstageDef();
      const rightPanel = new StagePanelDef();
      sinon.stub(rightPanel, "defaultSize").get(() => 300);
      sinon.stub(frontstageDef, "rightPanel").get(() => rightPanel);
      const spy = sinon.spy(rightPanel, "size", ["set"]);

      frontstageDef.restoreLayout();
      sinon.assert.calledOnceWithExactly(spy.set, 300);
    });
  });

  describe("dynamic widgets", () => {
    class WidgetsProvider implements UiItemsProvider {
      public readonly id = "WidgetsProvider";

      public provideWidgets(_stageId: string, _stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) {
        const widgets: Array<AbstractWidgetProps> = [];
        widgets.push({ // This should be added to Left stage panel, Start location.
          id: "WidgetsProviderW1",
          label: "WidgetsProvider W1",
          getWidgetContent: () => "",
        });
        if (location === StagePanelLocation.Right)
          widgets.push({ // This should be added to Right stage panel, Start location.
            id: "WidgetsProviderR1",
            label: "WidgetsProvider R1",
            getWidgetContent: () => "",
          });
        if (location === StagePanelLocation.Right && section === StagePanelSection.Middle)
          widgets.push({
            id: "WidgetsProviderRM1",
            label: "WidgetsProvider RM1",
            getWidgetContent: () => "",
          });
        return widgets;
      }
    }

    class EmptyFrontstageProvider extends FrontstageProvider {
      public get frontstage() {
        return (
          <Frontstage
            id="TestFrontstageUi2"
            defaultTool={CoreTools.selectElementCommand}
            defaultLayout="SingleContent"
            contentGroup="TestContentGroup1"
            defaultContentId="defaultContentId"
            isInFooterMode={false}
            applicationData={{ key: "value" }}
          />
        );
      }
    }

    beforeEach(() => {
      UiItemsManager.register(new WidgetsProvider());
    });

    afterEach(() => {
      UiItemsManager.unregister("WidgetsProvider");
    });

    it("should add extension widgets to stage panel zones", async () => {
      const frontstageProvider = new EmptyFrontstageProvider();
      FrontstageManager.addFrontstageProvider(frontstageProvider);
      await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
      const sut = FrontstageManager.activeFrontstageDef!;
      sut.rightPanel!.panelZones.start.widgetDefs.map((w) => w.id).should.eql(["WidgetsProviderR1"]);
      sut.rightPanel!.panelZones.middle.widgetDefs.map((w) => w.id).should.eql(["WidgetsProviderRM1"]);
      sut.leftPanel!.panelZones.start.widgetDefs.map((w) => w.id).should.eql(["WidgetsProviderW1"]);
    });
  });
});

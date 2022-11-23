/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import produce from "immer";
import { MockRender } from "@itwin/core-frontend";
import { ContentGroup, ContentGroupProvider, CoreTools, Frontstage, FrontstageConfig, FrontstageDef, FrontstageManager, FrontstageProps, FrontstageProvider, StagePanelDef, UiFramework, WidgetDef } from "../../appui-react";
import TestUtils, { storageMock } from "../TestUtils";
import { AbstractWidgetProps, StagePanelLocation, StagePanelSection, UiItemsManager, UiItemsProvider, WidgetState } from "@itwin/appui-abstract";
import { addFloatingWidget, addPanelWidget, addPopoutWidget, addTab, createNineZoneState } from "@itwin/appui-layout-react";
import { ProcessDetector } from "@itwin/core-bentley";
import { StagePanelState } from "../../appui-react/stagepanels/StagePanelDef";

describe("FrontstageDef", () => {
  const localStorageToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  const localStorageMock = storageMock();

  before(async () => {
    Object.defineProperty(window, "localStorage", { get: () => localStorageMock });
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
    Object.defineProperty(window, "localStorage", localStorageToRestore);
  });

  class BadLayoutFrontstage extends FrontstageProvider {
    public static stageId = "BadLayout";
    public get id(): string {
      return BadLayoutFrontstage.stageId;
    }

    public get frontstage(): React.ReactElement<FrontstageProps> {

      return (
        <Frontstage
          id={this.id}
          defaultTool={CoreTools.selectElementCommand}
          contentGroup={TestUtils.TestContentGroup1}
        />
      );
    }
  }

  class BadGroupFrontstage extends FrontstageProvider {
    public static stageId = "BadGroup";
    public get id(): string {
      return BadGroupFrontstage.stageId;
    }

    public get frontstage(): React.ReactElement<FrontstageProps> {

      // const contentLayoutDef: ContentLayoutDef = new ContentLayoutDef(
      //   {
      //     id: "SingleContent",
      //     description: "App:ContentLayoutDef.SingleContent",
      //   },
      // );

      return (
        <Frontstage
          id={this.id}
          defaultTool={CoreTools.selectElementCommand}
          contentGroup={TestUtils.TestContentGroup1}
        />
      );
    }
  }

  class ConfigContentGroupProvider extends ContentGroupProvider {
    public override async provideContentGroup(_props: FrontstageProps): Promise<ContentGroup> { // eslint-disable-line deprecation/deprecation
      throw new Error("Not implemented.");
    }

    public override async contentGroup(_config: FrontstageConfig): Promise<ContentGroup> {
      return TestUtils.TestContentGroup1;
    }
  }

  class ConfigFrontstageProvider extends FrontstageProvider {
    public constructor(private _contentGroup?: FrontstageConfig["contentGroup"]) {
      super();
    }

    public override get id() {
      return "config";
    }

    public override get frontstage(): React.ReactElement<FrontstageProps> {
      throw new Error("Not implemented.");
    }

    public override frontstageConfig(): FrontstageConfig {
      return {
        id: this.id,
        version: 1,
        contentGroup: this._contentGroup ? this._contentGroup : TestUtils.TestContentGroup1,
        leftPanel: {
          defaultState: StagePanelState.Minimized,
          sections: {
            start: [
              {
                id: "w1",
              },
            ],
          },
        },
        bottomPanel: {
          size: 400,
          sections: {
            end: [
              {
                id: "w2",
              },
              {
                id: "w3",
              },
            ],
          },
        },
      };
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
        if (location === StagePanelLocation.Right)
          widgets.push({ // This should be added to Right stage panel, Start location.
            id: "WidgetsProviderR1",
            label: "WidgetsProvider R1",
            getWidgetContent: () => "",
          });

        return widgets;
      }
    }

    class EmptyFrontstageProvider extends FrontstageProvider {
      public static stageId = "TestFrontstageUi2";
      public get id(): string {
        return EmptyFrontstageProvider.stageId;
      }

      public get frontstage() {
        return (
          <Frontstage
            id={this.id}
            defaultTool={CoreTools.selectElementCommand}
            contentGroup={TestUtils.TestContentGroup1}
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
      const frontstageDef = await FrontstageManager.getFrontstageDef(EmptyFrontstageProvider.stageId);
      expect(!!frontstageDef?.isReady).to.be.false;
      await FrontstageManager.setActiveFrontstageDef(frontstageDef);
      const sut = FrontstageManager.activeFrontstageDef!;
      sut.rightPanel!.panelZones.start.widgetDefs.map((w) => w.id).should.eql(["WidgetsProviderR1"]);
      sut.rightPanel!.panelZones.end.widgetDefs.map((w) => w.id).should.eql(["WidgetsProviderRM1"]);
      sut.leftPanel!.panelZones.start.widgetDefs.map((w) => w.id).should.eql(["WidgetsProviderW1"]);
    });
  });

  it("should be able to determine if widget is visible", async () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    state = addTab(state, "t4");
    state = addPopoutWidget(state, "fw1", ["t1"]);
    state = addPanelWidget(state, "right", "rightMiddle", ["t2"]);
    state = addPanelWidget(state, "right", "rightEnd", ["t3"]);
    state = addFloatingWidget(state, "fw2", ["t4"]);

    const frontstageDef = new FrontstageDef();
    frontstageDef.nineZoneState = state;
    const fw1Visible = frontstageDef.isWidgetDisplayed("t1");
    expect(fw1Visible).to.be.true;

    const t2 = new WidgetDef({
      id: "t2",
      defaultState: WidgetState.Open,
    });

    const t3 = new WidgetDef({
      id: "t3",
      defaultState: WidgetState.Hidden,
    });
    const t4 = new WidgetDef({
      id: "t4",
      defaultState: WidgetState.Floating,
    });

    const findWidgetDefGetter = sinon.stub(frontstageDef, "findWidgetDef");
    findWidgetDefGetter
      .onFirstCall().returns(t2);
    findWidgetDefGetter.returns(t3);

    const rightMiddleVisible = frontstageDef.isWidgetDisplayed("t2");
    expect(rightMiddleVisible).to.be.true;
    const rightEndVisible = frontstageDef.isWidgetDisplayed("t3");
    expect(rightEndVisible).to.be.false;
    const floatingWidgetVisible = frontstageDef.isWidgetDisplayed("t4");
    expect(floatingWidgetVisible).to.be.true;
    expect(frontstageDef.getWidgetCurrentState(t4)).to.eql(WidgetState.Floating);
  });

  it("should save size and position", async () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    state = addPopoutWidget(state, "pw1", ["t1"]);
    state = addPanelWidget(state, "right", "rightMiddle", ["t2"]);
    state = addPanelWidget(state, "right", "rightEnd", ["t3"]);

    const frontstageDef = new FrontstageDef();
    sinon.stub(frontstageDef, "findWidgetDef").withArgs("t1").returns(new WidgetDef({ id: "t1"}));
    sinon.stub(frontstageDef, "nineZoneState").get(() => state);
    sinon.stub(frontstageDef, "id").get(() => "testFrontstage");
    sinon.stub(frontstageDef, "version").get(() => 11);

    sinon.stub(window, "screenX").get(() => 99);
    sinon.stub(window, "screenY").get(() => 99);
    sinon.stub(window, "innerWidth").get(() => 999);
    sinon.stub(window, "innerHeight").get(() => 999);

    frontstageDef.saveChildWindowSizeAndPosition("pw1", window);

    const widgetDef = frontstageDef.findWidgetDef("t1");
    expect(widgetDef?.popoutBounds).to.eql({
      left: 99,
      top: 99,
      right: 99 + 999,
      bottom: 99 + 999,
    });
  });

  it("should save size and position in Electron", async () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    state = addPopoutWidget(state, "pw1", ["t1"]);
    state = addPanelWidget(state, "right", "rightMiddle", ["t2"]);
    state = addPanelWidget(state, "right", "rightEnd", ["t3"]);

    const frontstageDef = new FrontstageDef();
    sinon.stub(frontstageDef, "findWidgetDef").withArgs("t1").returns(new WidgetDef({ id: "t1"}));
    sinon.stub(frontstageDef, "nineZoneState").get(() => state);
    sinon.stub(frontstageDef, "id").get(() => "testFrontstage");
    sinon.stub(frontstageDef, "version").get(() => 11);

    sinon.stub(window, "screenX").get(() => 99);
    sinon.stub(window, "screenY").get(() => 99);
    sinon.stub(window, "innerWidth").get(() => 999);
    sinon.stub(window, "innerHeight").get(() => 999);

    sinon.stub(ProcessDetector, "isElectronAppFrontend").get(() => true);
    frontstageDef.saveChildWindowSizeAndPosition("pw1", window);
    sinon.stub(ProcessDetector, "isElectronAppFrontend").get(() => false);

    const widgetDef = frontstageDef.findWidgetDef("t1");
    expect(widgetDef?.popoutBounds).to.eql({
      left: 99,
      top: 99,
      right: 99 + 999 + 16,
      bottom: 99 + 999 + 39,
    });
  });

  describe("FrontstageConfig", () => {
    it("should initialize a frontstage", async () => {
      const provider = new ConfigFrontstageProvider();
      const frontstageDef = await FrontstageDef.create(provider);
      const w1 = frontstageDef.findWidgetDef("w1");
      expect(w1).to.exist;

      const leftPanel = frontstageDef.leftPanel;
      expect(leftPanel).to.exist;
      expect(leftPanel?.panelState).to.eq(StagePanelState.Minimized);

      const bottomPanel = frontstageDef.bottomPanel;
      expect(bottomPanel).to.exist;
      expect(bottomPanel?.size).to.eq(400);
    });

    it("should use ContentGroupProvider.contentGroup", async () => {
      const contentGroupProvider = new ConfigContentGroupProvider();
      const spy = sinon.spy(contentGroupProvider, "contentGroup");
      const provider = new ConfigFrontstageProvider(contentGroupProvider);
      FrontstageManager.addFrontstageProvider(provider);
      await FrontstageManager.setActiveFrontstage(provider.id);
      sinon.assert.calledOnceWithExactly(spy, sinon.match({ id: provider.id }));
      const config = spy.firstCall.args[0];

      expect(config.leftPanel?.sections?.start).to.eql([{ id: "w1" }]);
      expect(config.bottomPanel?.sections?.end).to.eql([{ id: "w2" }, { id: "w3" }]);
    });
  });
});

describe("float and dock widget", () => {
  it("panel widget should float", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    state = addPanelWidget(state, "right", "rightStart", ["t1"], { minimized: true });
    state = addPanelWidget(state, "right", "rightEnd", ["t3"]);

    const frontstageDef = new FrontstageDef();
    const nineZoneStateSetter = sinon.spy();

    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(frontstageDef, "nineZoneState").get(() => state).set(nineZoneStateSetter);
    frontstageDef.floatWidget("t1", { x: 55, y: 105 });
    nineZoneStateSetter.calledOnce.should.true;

    frontstageDef.floatWidget("ta");
    nineZoneStateSetter.calledOnce.should.true;
  });

  it("panel widget should popout", async () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    state = addTab(state, "t4");
    state = addPanelWidget(state, "left", "leftStart", ["t1"], { minimized: true });
    state = addPanelWidget(state, "right", "rightMiddle", ["t2", "t4"], { activeTabId: "t2" });
    state = addPanelWidget(state, "right", "rightEnd", ["t3"]);
    state = produce(state, (draft) => {
      draft.panels.right.size = 300;
    });

    const frontstageDef = new FrontstageDef();
    const nineZoneStateSetter = sinon.spy();
    sinon.stub(frontstageDef, "nineZoneState").get(() => state).set(nineZoneStateSetter);

    const t1 = new WidgetDef({
      id: "t1",
      defaultState: WidgetState.Open,
    });

    const t2 = new WidgetDef({
      id: "t2",
      defaultState: WidgetState.Open,
    });

    const t4 = new WidgetDef({
      id: "t4",
      defaultState: WidgetState.Closed,
    });

    const findWidgetDefGetter = sinon.stub(frontstageDef, "findWidgetDef");
    findWidgetDefGetter
      .onFirstCall().returns(t1);
    findWidgetDefGetter.returns(t2);

    expect(frontstageDef.getWidgetCurrentState(t1)).to.eql(WidgetState.Closed);
    expect(frontstageDef.getWidgetCurrentState(t2)).to.eql(WidgetState.Open);
    expect(frontstageDef.getWidgetCurrentState(t4)).to.eql(WidgetState.Closed);

    const openStub = sinon.stub();
    sinon.stub(window, "open").callsFake(openStub);
    frontstageDef.popoutWidget("t1", { x: 55, y: 105 }, { height: 300, width: 200 });
    nineZoneStateSetter.calledOnce.should.true;
    await new Promise((r) => { setTimeout(r, 100); }); // wait for open processing
    openStub.calledOnce.should.be.true;

    openStub.resetHistory();
    frontstageDef.popoutWidget("t2");
    await new Promise((r) => { setTimeout(r, 100); }); // wait for open processing
    openStub.calledOnce.should.true;
  });

  it("reopen popout window", async () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    state = addPopoutWidget(state, "fw1", ["t1"]);
    state = addPopoutWidget(state, "fw2", ["t2"]);
    state = addPanelWidget(state, "right", "rightEnd", ["t3"]);

    const frontstageDef = new FrontstageDef();

    const t1 = new WidgetDef({
      id: "t1",
      defaultState: WidgetState.Open,
    });

    const t2 = new WidgetDef({
      id: "t2",
      defaultState: WidgetState.Open,
    });

    const findWidgetDefGetter = sinon.stub(frontstageDef, "findWidgetDef");
    findWidgetDefGetter
      .onFirstCall().returns(t1);
    findWidgetDefGetter.returns(t2);

    const nineZoneStateSetter = sinon.spy();
    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(frontstageDef, "nineZoneState").get(() => state).set(nineZoneStateSetter);

    // should not trigger setter because it is already in a popout state
    frontstageDef.popoutWidget("t1");
    nineZoneStateSetter.calledOnce.should.be.false;

    const openStub = sinon.stub();
    sinon.stub(window, "open").callsFake(openStub);

    frontstageDef.openPopoutWidgetContainer(state, "fw1");
    await new Promise((r) => { setTimeout(r, 100); }); // wait for open processing
    openStub.calledOnce.should.be.true;

    openStub.resetHistory();
    frontstageDef.openPopoutWidgetContainer(state, "fw2");
    await new Promise((r) => { setTimeout(r, 100); }); // wait for open processing
    openStub.calledOnce.should.be.true;
  });

  it("floating widget should dock", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    state = addFloatingWidget(state, "fw1", ["t1"]);
    state = addPanelWidget(state, "right", "rightMiddle", ["t2"]);
    state = addPanelWidget(state, "right", "rightEnd", ["t3"]);

    const frontstageDef = new FrontstageDef();
    const nineZoneStateSetter = sinon.spy();

    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(frontstageDef, "nineZoneState").get(() => state).set(nineZoneStateSetter);

    expect(frontstageDef.isFloatingWidget("t1")).to.be.true;
    expect(frontstageDef.isFloatingWidget("bad")).to.be.false;
    frontstageDef.dockWidgetContainer("t1");
    nineZoneStateSetter.calledOnce.should.true;

    frontstageDef.dockWidgetContainer("ta");
    nineZoneStateSetter.calledOnce.should.true;
  });

  it("popout widget should dock", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    state = addPopoutWidget(state, "fw1", ["t1"]);
    state = addPanelWidget(state, "right", "rightMiddle", ["t2"]);
    state = addPanelWidget(state, "right", "rightEnd", ["t3"]);

    const frontstageDef = new FrontstageDef();
    const nineZoneStateSetter = sinon.spy();

    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(frontstageDef, "nineZoneState").get(() => state).set(nineZoneStateSetter);

    expect(frontstageDef.isPopoutWidget("t1")).to.be.true;
    expect(frontstageDef.isPopoutWidget("bad")).to.be.false;
    frontstageDef.dockWidgetContainer("t1");
    nineZoneStateSetter.calledOnce.should.true;

    frontstageDef.dockWidgetContainer("ta");
    nineZoneStateSetter.calledOnce.should.true;
  });

  it("dock popout widget container given widget Id", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    state = addPopoutWidget(state, "fw1", ["t1"]);
    state = addPanelWidget(state, "right", "rightMiddle", ["t2"]);
    state = addPanelWidget(state, "right", "rightEnd", ["t3"]);

    const frontstageDef = new FrontstageDef();
    const nineZoneStateSetter = sinon.spy();

    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(frontstageDef, "nineZoneState").get(() => state).set(nineZoneStateSetter);

    expect(frontstageDef.isPopoutWidget("t1")).to.be.true;
    expect(frontstageDef.isPopoutWidget("bad")).to.be.false;
    frontstageDef.dockWidgetContainer("t1");
    nineZoneStateSetter.calledOnce.should.true;

    frontstageDef.dockWidgetContainer("ta");
    nineZoneStateSetter.calledOnce.should.true;
  });

  it("dock popout widget container given container Id", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    state = addPopoutWidget(state, "fw1", ["t1"]);
    state = addPanelWidget(state, "right", "rightMiddle", ["t2"]);
    state = addPanelWidget(state, "right", "rightEnd", ["t3"]);

    const frontstageDef = new FrontstageDef();
    const nineZoneStateSetter = sinon.spy();

    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(frontstageDef, "nineZoneState").get(() => state).set(nineZoneStateSetter);

    expect(frontstageDef.isPopoutWidget("t1")).to.be.true;
    expect(frontstageDef.isPopoutWidget("bad")).to.be.false;
    frontstageDef.dockPopoutWidgetContainer("fw1");
    nineZoneStateSetter.calledOnce.should.true;
  });

  it("popout widget should float", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addTab(state, "t2");
    state = addTab(state, "t3");
    state = addPopoutWidget(state, "fw1", ["t1"]);
    state = addPanelWidget(state, "right", "rightMiddle", ["t2"]);
    state = addPanelWidget(state, "right", "rightEnd", ["t3"]);

    const frontstageDef = new FrontstageDef();
    const nineZoneStateSetter = sinon.spy();

    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(frontstageDef, "nineZoneState").get(() => state).set(nineZoneStateSetter);
    sinon.stub(frontstageDef, "nineZoneState").get(() => state);
    frontstageDef.floatWidget("t1", { x: 55, y: 105 });
    nineZoneStateSetter.calledOnce.should.true;

    frontstageDef.floatWidget("ta");
    nineZoneStateSetter.calledOnce.should.true;
  });

  it("set floating widget bounds", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addFloatingWidget(state, "fw1", ["t1"]);

    const frontstageDef = new FrontstageDef();
    const nineZoneStateSetter = sinon.spy();

    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(frontstageDef, "nineZoneState").get(() => state).set(nineZoneStateSetter);
    expect(frontstageDef.setFloatingWidgetContainerBounds("fw1", { top: 55, left: 105, bottom: 155, right: 255 })).to.be.true;
    expect(frontstageDef.setFloatingWidgetContainerBounds("bad", { top: 55, left: 105, bottom: 155, right: 255 })).to.be.false;
    frontstageDef.setFloatingWidgetBoundsInternal("fw1", { top: 55, left: 105, bottom: 155, right: 255 }, true); // should not trigger setter
    nineZoneStateSetter.calledOnce.should.true;
  });

  it("get floating containers 1 available", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1");
    state = addFloatingWidget(state, "fw1", ["t1"], { bounds: { top: 55, left: 105, bottom: 155, right: 255 } });
    const frontstageDef = new FrontstageDef();
    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(frontstageDef, "nineZoneState").get(() => state);
    expect(frontstageDef.getFloatingWidgetContainerIds().length).to.eql(1);
    expect(frontstageDef.getFloatingWidgetContainerIdByWidgetId("t1")).to.eql("fw1");
    expect(frontstageDef.getFloatingWidgetContainerBounds("fw1")).to.eql({
      left: 105,
      top: 55,
      bottom: 155,
      right: 255,
    });

  });

  it("get floating containers 0 available", () => {
    const frontstageDef = new FrontstageDef();
    sinon.stub(UiFramework, "uiVersion").get(() => "2");
    sinon.stub(frontstageDef, "nineZoneState").get(() => undefined);
    expect(frontstageDef.getFloatingWidgetContainerIds().length).to.eql(0);
    expect(frontstageDef.getFloatingWidgetContainerIdByWidgetId("t1")).to.be.undefined;
    expect(frontstageDef.getFloatingWidgetContainerBounds("t1")).to.be.undefined;
    expect(frontstageDef.getFloatingWidgetContainerBounds(undefined)).to.be.undefined;
  });

});

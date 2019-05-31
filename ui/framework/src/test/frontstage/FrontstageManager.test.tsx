/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon = require("sinon");
import * as moq from "typemoq";

import { Logger } from "@bentley/bentleyjs-core";
import { MockRender, SpatialViewState, ScreenViewport, IModelApp } from "@bentley/imodeljs-frontend";

import {
  FrontstageManager,
  WidgetState,
  CoreTools,
} from "../../ui-framework";
import { TestFrontstage } from "./FrontstageTestUtils";
import TestUtils from "../TestUtils";

describe("FrontstageManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

    MockRender.App.startup();

    FrontstageManager.initialize();
    FrontstageManager.clearFrontstageDefs();
  });

  after(() => {
    MockRender.App.shutdown();
  });

  it("findWidget should return undefined when no active frontstage", async () => {
    await FrontstageManager.setActiveFrontstageDef(undefined); // tslint:disable-line:no-floating-promises
    expect(FrontstageManager.findWidget("xyz")).to.be.undefined;
  });

  it("setActiveFrontstage should set active frontstage", async () => {
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    expect(frontstageProvider.frontstageDef).to.not.be.undefined;
    const frontstageDef = frontstageProvider.frontstageDef;
    if (frontstageDef) {
      await FrontstageManager.setActiveFrontstage(frontstageDef.id);
      expect(FrontstageManager.activeFrontstageId).to.eq(frontstageDef.id);
    }
  });

  it("setActiveFrontstage should log Error on invalid id", async () => {
    const spyMethod = sinon.spy(Logger, "logError");
    await FrontstageManager.setActiveFrontstage("xyz");
    spyMethod.calledOnce.should.true;
    (Logger.logError as any).restore();
  });

  it("setWidgetState should find and set widget state", async () => {
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);

    const widgetDef = FrontstageManager.findWidget("widget1");
    expect(widgetDef).to.not.be.undefined;

    if (widgetDef) {
      expect(widgetDef.isVisible).to.eq(true);
      expect(FrontstageManager.setWidgetState("widget1", WidgetState.Hidden)).to.be.true;
      expect(widgetDef.isVisible).to.eq(false);
    }
  });

  it("setWidgetState returns false on invalid id", () => {
    expect(FrontstageManager.setWidgetState("xyz", WidgetState.Closed)).to.be.false;
  });

  it("findWidget returns undefined on invalid id", () => {
    expect(FrontstageManager.findWidget("xyz")).to.be.undefined;
  });

  describe("Executing a tool should set activeToolId", () => {
    const viewportMock = moq.Mock.ofType<ScreenViewport>();

    before(() => {
      const spatialViewStateMock = moq.Mock.ofType<SpatialViewState>();
      spatialViewStateMock.setup((view) => view.is3d()).returns(() => true);
      spatialViewStateMock.setup((view) => view.classFullName).returns(() => "BisCore:SpatialViewDefinition");
      viewportMock.reset();
      viewportMock.setup((viewport) => viewport.view).returns(() => spatialViewStateMock.object);

      FrontstageManager.initialize();
      IModelApp.viewManager.setSelectedView(viewportMock.object);
    });

    it("CoreTools.selectElementCommand", () => {
      const item = CoreTools.selectElementCommand;
      item.execute();
      expect(FrontstageManager.activeToolId).to.eq(item.toolId);
    });

  });

});

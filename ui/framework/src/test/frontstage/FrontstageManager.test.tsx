/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import sinon = require("sinon");

import { Logger } from "@bentley/bentleyjs-core";

import {
  FrontstageManager,
  WidgetState,
} from "../../ui-framework";
import { TestFrontstage } from "./FrontstageTestUtils";
import TestUtils from "../TestUtils";

describe("FrontstageManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    FrontstageManager.clearFrontstageDefs();
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

});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import * as sinon from "sinon";
import { expect } from "chai";

import TestUtils from "../TestUtils";
import {
  Frontstage,
  FrontstageManager,
  WidgetState,
  FrontstageComposer,
} from "../../ui-framework";
import { TestFrontstage } from "./FrontstageTestUtils";

describe("Frontstage", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    FrontstageManager.clearFrontstageDefs();
  });

  it("should render", () => {
    mount(<Frontstage id="test1" defaultToolId="Select" defaultLayout="defaultLayout1" contentGroup="contentGroup1" />);
  });

  it("renders correctly", () => {
    shallow(<Frontstage id="test1" defaultToolId="Select" defaultLayout="defaultLayout1" contentGroup="contentGroup1" />).should.matchSnapshot();
  });

  it("FrontstageProvider supplies valid Frontstage", async () => {
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    await FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef);
    const widgetDef = FrontstageManager.findWidget("widget1");
    expect(widgetDef).to.not.be.undefined;

    if (widgetDef) {
      widgetDef.setWidgetState(WidgetState.Open);
      expect(widgetDef.isActive).to.eq(true);
      expect(widgetDef.isVisible).to.eq(true);

      FrontstageManager.setWidgetState("widget1", WidgetState.Hidden);
      expect(widgetDef.isVisible).to.eq(false);
    }
  });

  it("FrontstageProvider supplies Frontstage to FrontstageComposer", () => {
    const wrapper = mount(<FrontstageComposer />);

    const spyMethod = sinon.spy();
    const frontstageProvider = new TestFrontstage();
    FrontstageManager.addFrontstageProvider(frontstageProvider);
    FrontstageManager.setActiveFrontstageDef(frontstageProvider.frontstageDef).then(() => { // tslint:disable-line:no-floating-promises
      spyMethod();
    });
    setTimeout(() => {
      spyMethod.calledOnce.should.true;

      const widgetDef2 = FrontstageManager.findWidget("widget2");
      expect(widgetDef2).to.not.be.undefined;
      if (widgetDef2) {
        expect(widgetDef2.isVisible).to.eq(false);
        expect(widgetDef2.isActive).to.eq(false);

        widgetDef2.setWidgetState(WidgetState.Open);
        wrapper.update();
        expect(widgetDef2.isVisible).to.eq(true);
        expect(widgetDef2.isActive).to.eq(true);

        FrontstageManager.setWidgetState("widget2", WidgetState.Hidden);
        wrapper.update();
        expect(widgetDef2.isVisible).to.eq(false);
      }

      wrapper.unmount();
    }, 500);
  });

});

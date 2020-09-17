/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import {
  FrontstageDef, FrontstageManager, getBadgeClassName, WidgetPanelsTab,
} from "../../ui-framework";
import { BadgeType } from "@bentley/ui-abstract";
import { WidgetDef } from "../../ui-framework/widgets/WidgetDef";

describe("WidgetPanelsTab", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    const wrapper = shallow(<WidgetPanelsTab />);
    wrapper.should.matchSnapshot();
  });

  it("should render with badge", () => {
    const frontstageDef = new FrontstageDef();
    sandbox.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    const widgetDef = new WidgetDef({ badgeType: BadgeType.New });
    sandbox.stub(frontstageDef, "findWidgetDef").returns(widgetDef);
    const wrapper = shallow(<WidgetPanelsTab />);
    wrapper.should.matchSnapshot();
  });
});

describe("getBadgeClassName", () => {
  it("should return class name for BadgeType.New", () => {
    "uifw-badge-new".should.eq(getBadgeClassName(BadgeType.New));
  });

  it("should return class name for BadgeType.TechnicalPreview", () => {
    "uifw-badge-tp".should.eq(getBadgeClassName(BadgeType.TechnicalPreview));
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { BadgeType } from "@itwin/appui-abstract";
import {
  FrontstageDef, FrontstageManager, getBadgeClassName, WidgetDef, WidgetPanelsTab,
} from "../../appui-react";

describe("WidgetPanelsTab", () => {
  it("should render", () => {
    const wrapper = shallow(<WidgetPanelsTab />);
    wrapper.should.matchSnapshot();
  });

  it("should render with badge", () => {
    const frontstageDef = new FrontstageDef();
    sinon.stub(FrontstageManager, "activeFrontstageDef").get(() => frontstageDef);
    const widgetDef = new WidgetDef({ badgeType: BadgeType.New });
    sinon.stub(frontstageDef, "findWidgetDef").returns(widgetDef);
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

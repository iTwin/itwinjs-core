/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { WidgetState } from "@itwin/appui-abstract";
import { UiFramework, Zone } from "../../appui-react";
import { WidgetDef } from "../../appui-react/widgets/WidgetDef";
import { ZoneRuntimeProps } from "../../appui-react/zones/Zone";
import TestUtils, { mount } from "../TestUtils";

describe("Zone", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    UiFramework.setUiVersion("1");
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", () => {
    mount(<Zone />);
  });

  it("renders correctly", () => {
    shallow(<Zone />).should.matchSnapshot();
  });

  it("should maintain active tab index when preceding tab is removed", () => {
    const spy = sinon.stub<ZoneRuntimeProps["widgetChangeHandler"]["handleTabClick"]>();
    const runtimeProps: ZoneRuntimeProps = {
      activeTabIndex: 2,
      widgetChangeHandler: {
        handleTabClick: spy,
      },
      zone: {
        widgets: [9],
      },
      zoneDef: {
        widgetDefs: [
          new WidgetDef({}),
          new WidgetDef({}),
          new WidgetDef({}),
        ],
      },
      openWidgetId: 9,
      zoneDefProvider: {
        getZoneDef: () => runtimeProps.zoneDef,
      },
    } as any;
    mount(<Zone
      runtimeProps={runtimeProps}
    />);

    runtimeProps.zoneDef.widgetDefs[1].setWidgetState(WidgetState.Hidden);

    expect(spy.calledOnceWithExactly(9, 1)).to.be.true;
  });
});

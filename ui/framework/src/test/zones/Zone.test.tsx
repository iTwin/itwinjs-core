/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import enzyme from "enzyme"; const { shallow } = enzyme;
import * as React from "react";
import sinon from "sinon";
import { WidgetState } from "@bentley/ui-abstract";
import { Zone } from "../../ui-framework.js";
import { WidgetDef } from "../../ui-framework/widgets/WidgetDef.js";
import { ZoneRuntimeProps } from "../../ui-framework/zones/Zone.js";
import TestUtils, { mount } from "../TestUtils.js";

describe("Zone", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
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

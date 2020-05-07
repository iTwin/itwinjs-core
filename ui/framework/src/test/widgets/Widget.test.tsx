/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount } from "enzyme";
import * as React from "react";
import { WidgetState } from "@bentley/ui-abstract";
import { Widget } from "../../ui-framework";
import TestUtils from "../TestUtils";

describe("Widget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", () => {
    const wrapper = mount(<Widget id="widget" defaultState={WidgetState.Open} applicationData={{ key: "value" }} />);
    wrapper.unmount();
  });

});

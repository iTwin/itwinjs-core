/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";

import { WidgetState } from "@bentley/ui-abstract";

import TestUtils from "../TestUtils";
import { Widget } from "../../ui-framework";

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

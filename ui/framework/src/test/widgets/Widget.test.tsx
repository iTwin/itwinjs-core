/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { WidgetState } from "@bentley/ui-abstract";
import { Widget } from "../../ui-framework.js";
import TestUtils, { mount } from "../TestUtils.js";

describe("Widget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should render", () => {
    mount(<Widget id="widget" defaultState={WidgetState.Open} applicationData={{ key: "value" }} />);
  });

});

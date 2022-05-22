/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { WidgetState } from "@itwin/appui-abstract";
import { Widget } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

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

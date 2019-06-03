/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as enzyme from "enzyme";

import { MockRender } from "@bentley/imodeljs-frontend";

import TestUtils from "../TestUtils";
import { TileLoadingIndicator } from "../../ui-framework";

describe("TileLoadingIndicator", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    MockRender.App.startup();
  });

  after(() => {
    MockRender.App.shutdown();
  });

  it("should render correctly", () => {
    enzyme.shallow(
      <TileLoadingIndicator />,
    ).should.matchSnapshot();
  });

  it("should unmount correctly", () => {
    const sut = enzyme.mount(<TileLoadingIndicator />);
    sut.unmount();
  });
});

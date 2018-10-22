/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Provider } from "react-redux";
import { mount, shallow } from "enzyme";

import { ConfigurableUiContent } from "../../src/index";
import TestUtils from "../TestUtils";

describe("ConfigurableUiContent", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("ConfigurableUiContent should render", () => {
    const wrapper = mount(
      <Provider store={TestUtils.store} >
        <ConfigurableUiContent />
      </Provider>);

    wrapper.unmount();
  });

  it("ConfigurableUiContent renders correctly", () => {
    shallow(
      <Provider store={TestUtils.store} >
        <ConfigurableUiContent />
      </Provider>).should.matchSnapshot();
  });

});

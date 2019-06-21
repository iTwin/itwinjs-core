/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Provider } from "react-redux";
import { mount, shallow } from "enzyme";

import { ConfigurableUiContent } from "../../ui-framework";
import TestUtils from "../TestUtils";
import { render } from "@testing-library/react";

describe("ConfigurableUiContent", () => {
  before(async () => {
    await TestUtils.initializeUiFramework(true);
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

  it("key presses should be handled", () => {
    const component = render(
      <Provider store={TestUtils.store} >
        <ConfigurableUiContent />
      </Provider>);

    const divContainer = component.getByTestId("uifw-configurableui-wrapper");
    divContainer.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "a" }));
    divContainer.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, view: window, key: "Escape" }));
  });

  it("mouse moves should be handled", () => {
    const wrapper = mount(
      <Provider store={TestUtils.store} >
        <ConfigurableUiContent />
      </Provider>);

    wrapper.simulate("mouseMove", { buttons: 1 });

    wrapper.unmount();
  });

  after(() => {
    // clear out the framework key
    TestUtils.terminateUiFramework();
  });
});

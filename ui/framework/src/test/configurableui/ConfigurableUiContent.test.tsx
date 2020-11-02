/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { shallow } from "enzyme";
import * as React from "react";
import { Provider } from "react-redux";
import { render } from "@testing-library/react";
import { ConfigurableUiContent } from "../../ui-framework";
import TestUtils, { mount } from "../TestUtils";

describe("ConfigurableUiContent", () => {
  before(async () => {
    await TestUtils.initializeUiFramework(true);
  });

  it("ConfigurableUiContent should render", () => {
    mount(
      <Provider store={TestUtils.store} >
        <ConfigurableUiContent />
      </Provider>);
  });

  it("ConfigurableUiContent renders correctly", () => {
    shallow(
      <Provider store={TestUtils.store} >
        <ConfigurableUiContent />
      </Provider>).should.matchSnapshot();
  });

  it("key presses should be handled", () => {
    render(<Provider store={TestUtils.store} >
      <ConfigurableUiContent />
    </Provider>);

    const divContainer = document.getElementById("uifw-configurableui-wrapper")!;
    divContainer.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, view: window, key: "a" }));
    divContainer.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true, view: window, key: "Escape" }));
  });

  it("mouse moves should be handled", () => {
    const wrapper = mount(
      <Provider store={TestUtils.store} >
        <ConfigurableUiContent />
      </Provider>);

    wrapper.simulate("mouseMove", { buttons: 1 });
  });

  after(() => {
    // clear out the framework key
    TestUtils.terminateUiFramework();
  });
});

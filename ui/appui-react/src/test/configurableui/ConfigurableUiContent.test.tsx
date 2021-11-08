/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { shallow } from "enzyme";
import { expect } from "chai";
import * as React from "react";
import { Provider } from "react-redux";
import { render } from "@testing-library/react";
import { SpecialKey } from "@itwin/appui-abstract";
import TestUtils, { mount } from "../TestUtils";
import { ConfigurableUiContent } from "../../appui-react/configurableui/ConfigurableUiContent";
import { KeyboardShortcutManager } from "../../appui-react/keyboardshortcut/KeyboardShortcut";
import { FrameworkToolAdmin } from "../../appui-react/tools/FrameworkToolAdmin";

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

  it("key presses should be handled", async () => {
    render(<Provider store={TestUtils.store} >
      <ConfigurableUiContent />
    </Provider>);
    expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;

    const toolAdmin = new FrameworkToolAdmin();
    let keyEvent = new KeyboardEvent("keydown", { key: "a" });
    expect(await toolAdmin.processShortcutKey(keyEvent, true)).to.be.true;
    keyEvent = new KeyboardEvent("keyup", { key: "a" });
    expect(await toolAdmin.processShortcutKey(keyEvent, false)).to.be.false;
    keyEvent = new KeyboardEvent("keydown", { key: SpecialKey.Escape });
    expect(await toolAdmin.processShortcutKey(keyEvent, true)).to.be.false;
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

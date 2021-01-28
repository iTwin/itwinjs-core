/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { shallow } from "enzyme";
import { expect } from "chai";
import * as React from "react";
import { Provider } from "react-redux";
import { render } from "@testing-library/react";
import { SpecialKey } from "@bentley/ui-abstract";
import TestUtils, { mount } from "../TestUtils";
import { UiFramework } from "../../ui-framework/UiFramework";
import { ConfigurableUiContent } from "../../ui-framework/configurableui/ConfigurableUiContent";
import { KeyboardShortcutManager } from "../../ui-framework/keyboardshortcut/KeyboardShortcut";
import { FrameworkToolAdmin } from "../../ui-framework/tools/FrameworkToolAdmin";

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
    expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;

    const toolAdmin = new FrameworkToolAdmin();
    let keyEvent = new KeyboardEvent("keydown", { key: "a" });
    expect(toolAdmin.processShortcutKey(keyEvent, true)).to.be.true;
    keyEvent = new KeyboardEvent("keyup", { key: "a" });
    expect(toolAdmin.processShortcutKey(keyEvent, false)).to.be.false;
    keyEvent = new KeyboardEvent("keydown", { key: SpecialKey.Escape });
    expect(toolAdmin.processShortcutKey(keyEvent, true)).to.be.false;
  });

  it("Escape key should set focus to home when UiFramework.escapeToHome", () => {
    render(<Provider store={TestUtils.store} >
      <ConfigurableUiContent />
    </Provider>);
    expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;

    const buttonElement = document.createElement("button");
    document.body.appendChild(buttonElement);
    buttonElement.focus();
    expect(KeyboardShortcutManager.isFocusOnHome).to.be.false;

    UiFramework.escapeToHome = true;

    const toolAdmin = new FrameworkToolAdmin();
    const keyEvent = new KeyboardEvent("keydown", { key: SpecialKey.Escape });
    expect(toolAdmin.processShortcutKey(keyEvent, true)).to.be.true;

    expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;
    document.body.removeChild(buttonElement);
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

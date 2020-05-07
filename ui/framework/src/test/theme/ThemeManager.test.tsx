/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import { Provider } from "react-redux";
import { UiFramework } from "../../ui-framework";
import { ColorTheme, ThemeManager } from "../../ui-framework/theme/ThemeManager";
import TestUtils from "../TestUtils";

describe("ThemeManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render", () => {
    const wrapper = mount(<Provider store={TestUtils.store}><ThemeManager><div>Hello World!</div></ThemeManager></Provider>);
    expect(wrapper).not.to.be.undefined;
    wrapper.unmount();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should change the theme", () => {
    const wrapper = mount(<Provider store={TestUtils.store}><ThemeManager><div>Hello World!</div></ThemeManager></Provider>);

    UiFramework.setColorTheme(ColorTheme.Dark);
    expect(UiFramework.getColorTheme()).to.eq(ColorTheme.Dark);

    wrapper.unmount();
  });

  it("should change the widget opacity", () => {
    const wrapper = mount(<Provider store={TestUtils.store}><ThemeManager><div>Hello World!</div></ThemeManager></Provider>);

    const testValue = 0.50;
    UiFramework.setWidgetOpacity(testValue);
    expect(UiFramework.getWidgetOpacity()).to.eq(testValue);

    wrapper.unmount();
  });

});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";
import { Provider } from "react-redux";
import TestUtils from "../TestUtils";
import { ThemeManager, ColorTheme } from "../../ui-framework/theme/ThemeManager";
import { UiFramework } from "../../ui-framework";

describe("ThemeManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("should render", () => {
    const wrapper = mount(<Provider store={TestUtils.store}><ThemeManager><div>Hello World!</div></ThemeManager></Provider>);
    expect(wrapper).not.to.be.undefined;
    wrapper.unmount();
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

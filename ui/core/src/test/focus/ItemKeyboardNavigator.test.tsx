/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ItemKeyboardNavigator, Orientation } from "../../ui-core";

describe("ItemKeyboardNavigator", () => {
  it("itemCount property should be set properly", () => {
    const nav = new ItemKeyboardNavigator(() => { }, () => { });
    expect(nav.itemCount).to.eq(0);
    nav.itemCount = 100;
    expect(nav.itemCount).to.eq(100);
  });

  it("orientation property should be set properly", () => {
    const nav = new ItemKeyboardNavigator(() => { }, () => { });
    expect(nav.orientation).to.eq(Orientation.Horizontal);
    nav.orientation = Orientation.Vertical;
    expect(nav.orientation).to.eq(Orientation.Vertical);
  });

  it("allowWrap property should be set properly", () => {
    const nav = new ItemKeyboardNavigator(() => { }, () => { });
    expect(nav.allowWrap).to.eq(true);
    nav.allowWrap = false;
    expect(nav.allowWrap).to.eq(false);
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Tray, { DefaultHistoryManager } from "../../../../../src/toolbar/item/expandable/history/Tray";

describe("<Tray />", () => {
  it("should render", () => {
    mount(<Tray />);
  });

  it("renders correctly", () => {
    shallow(<Tray />).should.matchSnapshot();
  });

  it("renders extended", () => {
    shallow(<Tray isExtended />).should.matchSnapshot();
  });

  it("renders items", () => {
    shallow(<Tray items={<><br /><br /></>}></Tray>).should.matchSnapshot();
  });

  it("Max item count of default history manager should eq 4", () => {
    DefaultHistoryManager.maxItemCount.should.eq(4);
  });

  it("addItem should add history entry", () => {
    const sut = DefaultHistoryManager.addItem("key1", {}, []);
    sut.length.should.eq(1);
  });

  it("addItem should add 4 items most", () => {
    let sut = DefaultHistoryManager.addItem("key1", {}, []);
    sut = DefaultHistoryManager.addItem("key2", {}, sut);
    sut = DefaultHistoryManager.addItem("key3", {}, sut);
    sut = DefaultHistoryManager.addItem("key4", {}, sut);
    sut = DefaultHistoryManager.addItem("key5", {}, sut);
    sut.length.should.eq(4);
  });

  it("addItem should re-add item with same key", () => {
    let sut = DefaultHistoryManager.addItem("key1", {}, []);
    sut = DefaultHistoryManager.addItem("key2", {}, sut);
    sut = DefaultHistoryManager.addItem("key1", {}, sut);
    sut.length.should.eq(2);
  });

  it("addItem should work as FIFO structure", () => {
    let sut = DefaultHistoryManager.addItem("key1", {}, []);
    sut = DefaultHistoryManager.addItem("key2", {}, sut);
    sut[1].key.should.eq("key1");
    sut[0].key.should.eq("key2");
  });
});

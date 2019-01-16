/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { HistoryTray, DefaultHistoryManager } from "../../../../../ui-ninezone";

describe("<HistoryTray />", () => {
  it("should render", () => {
    mount(<HistoryTray />);
  });

  it("renders correctly", () => {
    shallow(<HistoryTray />).should.matchSnapshot();
  });

  it("renders extended", () => {
    shallow(<HistoryTray isExtended />).should.matchSnapshot();
  });

  it("renders items", () => {
    shallow(<HistoryTray items={<><br /><br /></>}></HistoryTray>).should.matchSnapshot();
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

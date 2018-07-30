/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Tray, { MAX_ITEM_CNT, addItem } from "@src/toolbar/item/expandable/history/Tray";

describe("<Tray />", () => {
  it("should render", () => {
    mount(<Tray />);
  });

  it("renders correctly", () => {
    shallow(<Tray />).should.matchSnapshot();
  });

  it("renders expanded", () => {
    shallow(<Tray isExpanded />).should.matchSnapshot();
  });

  it("renders tabs", () => {
    shallow(<Tray><br /><br /></Tray>).should.matchSnapshot();
  });

  it("MAX_ITEM_CNT should eq 4", () => {
    MAX_ITEM_CNT.should.eq(4);
  });

  it("addItem should add history entry", () => {
    const sut = addItem("key1", {}, []);
    sut.length.should.eq(1);
  });

  it("addItem should add 4 items most", () => {
    let sut = addItem("key1", {}, []);
    sut = addItem("key2", {}, sut);
    sut = addItem("key3", {}, sut);
    sut = addItem("key4", {}, sut);
    sut = addItem("key5", {}, sut);
    sut.length.should.eq(4);
  });

  it("addItem should re-add item with same key", () => {
    let sut = addItem("key1", {}, []);
    sut = addItem("key2", {}, sut);
    sut = addItem("key1", {}, sut);
    sut.length.should.eq(2);
  });

  it("addItem should work as FIFO structure", () => {
    let sut = addItem("key1", {}, []);
    sut = addItem("key2", {}, sut);
    sut[1].key.should.eq("key1");
    sut[0].key.should.eq("key2");
  });
});

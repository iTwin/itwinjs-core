/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";

import { HistoryItem } from "../../../../../ui-ninezone";

describe("<HistoryItem />", () => {
  it("should render", () => {
    mount(<HistoryItem />);
  });

  it("renders correctly", () => {
    shallow(<HistoryItem />).should.matchSnapshot();
  });

  it("renders active", () => {
    shallow(<HistoryItem isActive />).should.matchSnapshot();
  });

  it("renders disabled", () => {
    shallow(<HistoryItem isDisabled />).should.matchSnapshot();
  });

  it("should invoke onClick handler", () => {
    const spy = sinon.spy();
    const sut = shallow(<HistoryItem onClick={spy} />);
    sut.simulate("click");
    spy.calledOnce.should.true;
  });

  it("should not invoke onClick if disabled", () => {
    const spy = sinon.spy();
    const sut = shallow(<HistoryItem isDisabled onClick={spy} />);
    sut.simulate("click");
    spy.notCalled.should.true;
  });
});

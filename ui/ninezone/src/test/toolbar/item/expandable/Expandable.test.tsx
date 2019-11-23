/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";

import { ExpandableItem } from "../../../../ui-ninezone";

describe("<ExpandableItem />", () => {
  it("should render", () => {
    mount(<ExpandableItem />);
  });

  it("renders correctly", () => {
    shallow(<ExpandableItem />).should.matchSnapshot();
  });

  it("renders active correctly", () => {
    shallow(<ExpandableItem isActive />).dive().should.matchSnapshot();
  });

  it("renders disabled correctly", () => {
    shallow(<ExpandableItem isDisabled />).dive().should.matchSnapshot();
  });

  it("renders w/o indicator correctly", () => {
    shallow(<ExpandableItem hideIndicator />).dive().should.matchSnapshot();
  });

  it("should invoke onIsHistoryExtendedChange when mouse enters", () => {
    const spy = sinon.spy();
    const sut = mount(<ExpandableItem onIsHistoryExtendedChange={spy} />);
    sut.simulate("mouseEnter");
    spy.calledOnceWithExactly(true).should.true;
  });

  it("should invoke onIsHistoryExtendedChange when mouse leaves", () => {
    const spy = sinon.spy();
    const sut = mount(<ExpandableItem onIsHistoryExtendedChange={spy} />);
    sut.simulate("mouseLeave");
    spy.calledOnceWithExactly(false).should.true;
  });

  it("should not invoke if onIsHistoryExtendedChange is not provided", () => {
    const sut = mount(<ExpandableItem />);
    sut.simulate("mouseEnter");
    sut.simulate("mouseLeave");
  });
});

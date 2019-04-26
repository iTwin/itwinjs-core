/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { offsetAndContainInContainer, SizeProps, Tooltip } from "../../ui-ninezone";
import { createRect } from "../Utils";

describe("<Tooltip />", () => {
  it("should render", () => {
    mount(<Tooltip />);
  });

  it("renders correctly", () => {
    shallow(<Tooltip />).should.matchSnapshot();
  });

  it("renders with icon", () => {
    shallow(<Tooltip icon={<i />} />).should.matchSnapshot();
  });

  it("should notify about size change", () => {
    const spy = sinon.spy();
    const sut = mount<Tooltip>(
      <Tooltip
        onSizeChanged={spy}
      />,
    );
    const element = sut.getDOMNode() as HTMLElement;
    sinon.stub(element, "getBoundingClientRect").returns(createRect(10, 1, 50, 22));

    sut.setProps({
      position: {
        x: 0,
        y: 0,
      },
    });

    const size: SizeProps = {
      height: 21,
      width: 40,
    };
    spy.calledOnceWithExactly(sinon.match(size));
  });

  it("should offset", () => {
    const sut = offsetAndContainInContainer(
      {
        bottom: 22,
        left: 0,
        right: 10,
        top: 11,
      }, {
        height: 200,
        width: 100,
      },
    );
    sut.x.should.eq(20);
    sut.y.should.eq(31);
  });

  it("should offset and contain in container", () => {
    const sut = offsetAndContainInContainer(
      {
        bottom: 22,
        left: 90,
        right: 110,
        top: 12,
      }, {
        height: 50,
        width: 100,
      }, {
        x: 0,
        y: 0,
      },
    );
    sut.x.should.eq(80);
    sut.y.should.eq(12);
  });
});

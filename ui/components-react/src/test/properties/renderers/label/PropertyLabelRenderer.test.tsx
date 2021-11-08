/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import sinon from "sinon";
import { NonPrimitivePropertyLabelRenderer, PrimitivePropertyLabelRenderer } from "../../../../components-react";

describe("PrimitivePropertyLabelRenderer ", () => {
  it("renders correctly when offset is not provided", () => {
    const rendererMount = mount(<PrimitivePropertyLabelRenderer>Title</PrimitivePropertyLabelRenderer>);

    expect(rendererMount.childAt(0).prop("style")).to.have.property("paddingLeft", 0);
    expect(rendererMount.find(".components-property-label-renderer").text()).to.be.eq("Title");
  });

  it("renders correctly when offset is provided", () => {
    const rendererMount = mount(<PrimitivePropertyLabelRenderer className="test-class" offset={50}>Title</PrimitivePropertyLabelRenderer>);

    expect(rendererMount.childAt(0).prop("style")).to.have.property("paddingLeft", 50);
    expect(rendererMount.find(".test-class").exists()).to.be.true;
  });

});

describe("NonPrimitivePropertyLabelRenderer  ", () => {
  it("renders correctly", () => {
    const rendererMount = mount(
      <NonPrimitivePropertyLabelRenderer
        className="test-class-name"
        isExpanded={false}
        onCollapse={() => { }}
        onExpand={() => { }}
      >
        Title
      </NonPrimitivePropertyLabelRenderer>);

    expect(rendererMount.html().indexOf("Title")).to.be.greaterThan(-1);
    expect(rendererMount.find("i").hasClass("icon")).to.be.true;
    expect(rendererMount.find(".components-expanded").exists()).to.be.false;
    expect(rendererMount.find(".test-class-name").exists()).to.be.true;
  });

  it("manipulates expand icon correctly when expanded", () => {
    const rendererMount = mount(
      <NonPrimitivePropertyLabelRenderer
        isExpanded={true}
        onCollapse={() => { }}
        onExpand={() => { }}
      >
        Title
      </NonPrimitivePropertyLabelRenderer>);

    expect(rendererMount.find("i").hasClass("icon")).to.be.true;
    expect(rendererMount.find(".components-expanded").exists()).to.be.true;
  });

  it("calls onExpand when label gets clicked while collapsed", () => {
    const onExpand = sinon.spy();

    const rendererMount = mount(
      <NonPrimitivePropertyLabelRenderer
        isExpanded={false}
        onCollapse={() => { }}
        onExpand={onExpand}
      >
        Title
      </NonPrimitivePropertyLabelRenderer>);

    rendererMount.find("i").simulate("click");

    expect(onExpand.calledOnce).to.be.true;
  });

  it("calls onCollapse when label gets clicked while expanded", () => {
    const onCollapse = sinon.spy();

    const rendererMount = mount(
      <NonPrimitivePropertyLabelRenderer
        isExpanded={true}
        onCollapse={onCollapse}
        onExpand={() => { }}
      >
        Title
      </NonPrimitivePropertyLabelRenderer>);

    rendererMount.find("i").simulate("click");

    expect(onCollapse.calledOnce).to.be.true;
  });
});

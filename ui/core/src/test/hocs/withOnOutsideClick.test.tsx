/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { withOnOutsideClick } from "../../core-react";

describe("WithOnOutsideClick", () => {

  const WithOnOutsideClickDiv = withOnOutsideClick((props) => (<div {...props} />), undefined, true, false); // eslint-disable-line @typescript-eslint/naming-convention

  const defaultOnClose = sinon.spy();
  const WithOnOutsideClickAndDefaultDiv = withOnOutsideClick((props) => (<div {...props} />), defaultOnClose, true, false); // eslint-disable-line @typescript-eslint/naming-convention

  const WithOnOutsidePointerDiv = withOnOutsideClick((props) => (<div {...props} />), undefined, true); // eslint-disable-line @typescript-eslint/naming-convention

  const WithOnOutsidePointerAndDefaultDiv = withOnOutsideClick((props) => (<div {...props} />), defaultOnClose, true, true); // eslint-disable-line @typescript-eslint/naming-convention

  it("should render", () => {
    const wrapper = mount(<WithOnOutsideClickDiv />);
    wrapper.unmount();
  });

  it("renders correctly", () => {
    shallow(<WithOnOutsideClickDiv />).should.matchSnapshot();
  });

  it("should handle document click", () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyOnClose = sinon.spy();
    const wrapper = mount(<WithOnOutsideClickDiv onOutsideClick={spyOnClose} />, { attachTo: outerNode });

    outerNode.dispatchEvent(new MouseEvent("click"));
    expect(spyOnClose.calledOnce).to.be.true;

    document.body.removeChild(outerNode);
    wrapper.unmount();
  });

  it("should handle document click in default", () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    defaultOnClose.resetHistory();
    const wrapper = mount(<WithOnOutsideClickAndDefaultDiv />, { attachTo: outerNode });

    outerNode.dispatchEvent(new MouseEvent("click"));
    expect(defaultOnClose.calledOnce).to.be.true;

    document.body.removeChild(outerNode);
    wrapper.unmount();
  });

  it("should handle document pointer events", () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyOnClose = sinon.spy();
    const wrapper = mount(<WithOnOutsidePointerDiv onOutsideClick={spyOnClose} />, { attachTo: outerNode });

    outerNode.dispatchEvent(new MouseEvent("pointerdown"));
    outerNode.dispatchEvent(new MouseEvent("pointerup"));
    expect(spyOnClose.calledOnce).to.be.true;

    document.body.removeChild(outerNode);
    wrapper.unmount();
  });

  it("should handle document pointer events in default", () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    defaultOnClose.resetHistory();
    const wrapper = mount(<WithOnOutsidePointerAndDefaultDiv />, { attachTo: outerNode });

    outerNode.dispatchEvent(new MouseEvent("pointerdown"));
    outerNode.dispatchEvent(new MouseEvent("pointerup"));
    expect(defaultOnClose.calledOnce).to.be.true;

    document.body.removeChild(outerNode);
    wrapper.unmount();
  });

  it("should dispatch close processing if clicking on a popup", () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const popupNode = document.createElement("div");
    popupNode.setAttribute("class", "core-popup");
    document.body.appendChild(popupNode);

    defaultOnClose.resetHistory();
    const wrapper = mount(<WithOnOutsidePointerAndDefaultDiv closeOnNestedPopupOutsideClick />, { attachTo: outerNode });

    popupNode.dispatchEvent(new MouseEvent("pointerdown"));
    popupNode.dispatchEvent(new MouseEvent("pointerup"));
    expect(defaultOnClose.calledOnce).to.be.true;

    document.body.removeChild(outerNode);
    document.body.removeChild(popupNode);
    wrapper.unmount();
  });

  it("should not dispatch close processing if clicking on a popup", () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    // build an hierarchy that will test all recursion in code
    const popupNode = document.createElement("div");
    popupNode.setAttribute("class", "core-popup");
    const popupChild = document.createElement("div");
    popupNode.appendChild(popupChild);
    const popupGrandChild = document.createElement("div");
    popupChild.appendChild(popupGrandChild);
    const popupGrandChildElement = document.createElement("p");
    popupGrandChild.appendChild(popupGrandChildElement);
    document.body.appendChild(popupNode);

    defaultOnClose.resetHistory();
    const wrapper = mount(<WithOnOutsidePointerAndDefaultDiv />, { attachTo: outerNode });

    popupGrandChildElement.dispatchEvent(new MouseEvent("pointerdown"));
    popupGrandChildElement.dispatchEvent(new MouseEvent("pointerup"));
    expect(defaultOnClose.calledOnce).to.be.false;

    outerNode.dispatchEvent(new MouseEvent("pointerdown"));
    outerNode.dispatchEvent(new MouseEvent("pointerup"));
    expect(defaultOnClose.calledOnce).to.be.true;

    document.body.removeChild(outerNode);
    document.body.removeChild(popupNode);
    wrapper.unmount();
  });

});

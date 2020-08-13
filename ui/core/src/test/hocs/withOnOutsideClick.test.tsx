/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { withOnOutsideClick } from "../../ui-core";

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
    mount(<WithOnOutsideClickDiv onOutsideClick={spyOnClose} />, { attachTo: outerNode });

    outerNode.dispatchEvent(new MouseEvent("click"));
    expect(spyOnClose.calledOnce).to.be.true;

    document.body.removeChild(outerNode);
  });

  it("should handle document click in default", () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    defaultOnClose.resetHistory();
    mount(<WithOnOutsideClickAndDefaultDiv />, { attachTo: outerNode });

    outerNode.dispatchEvent(new MouseEvent("click"));
    expect(defaultOnClose.calledOnce).to.be.true;

    document.body.removeChild(outerNode);
  });

  it("should handle document pointer events", () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    const spyOnClose = sinon.spy();
    mount(<WithOnOutsidePointerDiv onOutsideClick={spyOnClose} />, { attachTo: outerNode });

    outerNode.dispatchEvent(new MouseEvent("pointerdown"));
    outerNode.dispatchEvent(new MouseEvent("pointerup"));
    expect(spyOnClose.calledOnce).to.be.true;

    document.body.removeChild(outerNode);
  });

  it("should handle document pointer events in default", () => {
    const outerNode = document.createElement("div");
    document.body.appendChild(outerNode);

    defaultOnClose.resetHistory();
    mount(<WithOnOutsidePointerAndDefaultDiv />, { attachTo: outerNode });

    outerNode.dispatchEvent(new MouseEvent("pointerdown"));
    outerNode.dispatchEvent(new MouseEvent("pointerup"));
    expect(defaultOnClose.calledOnce).to.be.true;

    document.body.removeChild(outerNode);
  });

});

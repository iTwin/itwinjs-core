/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";

import { withOnOutsideClick } from "../../ui-core";

describe("WithOnOutsideClick", () => {

  const WithOnOutsideClickDiv = withOnOutsideClick((props) => (<div {...props} />), undefined, true, false); // tslint:disable-line:variable-name

  const defaultOnClose = sinon.spy();
  const WithOnOutsideClickAndDefaultDiv = withOnOutsideClick((props) => (<div {...props} />), defaultOnClose, true, false); // tslint:disable-line:variable-name

  const WithOnOutsidePointerDiv = withOnOutsideClick((props) => (<div {...props} />), undefined, true); // tslint:disable-line:variable-name

  const WithOnOutsidePointerAndDefaultDiv = withOnOutsideClick((props) => (<div {...props} />), defaultOnClose, true, true); // tslint:disable-line:variable-name

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

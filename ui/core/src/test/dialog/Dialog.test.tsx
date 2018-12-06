/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { expect } from "chai";

import { Dialog, ButtonType } from "../../ui-core";
import TestUtils from "../TestUtils";

describe("Dialog", () => {

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  describe("renders", () => {
    it("should render", () => {
      const wrapper = mount(<Dialog opened={true} />);
      wrapper.unmount();
    });

    it("renders correctly", () => {
      shallow(<Dialog opened={true} />).should.matchSnapshot();
    });
  });

  describe("buttons", () => {
    it("OK & Cancel", () => {
      mount(<Dialog opened={true}
        buttonCluster={[
          { type: ButtonType.OK, onClick: () => { } },
          { type: ButtonType.Cancel, onClick: () => { } },
        ]} />);
    });

    it("Yes, No & Retry", () => {
      mount(<Dialog opened={true}
        buttonCluster={[
          { type: ButtonType.Yes, onClick: () => { } },
          { type: ButtonType.No, onClick: () => { } },
          { type: ButtonType.Retry, onClick: () => { } },
        ]} />);
    });
  });

  describe("movable & resizable", () => {
    it("movable", () => {
      const wrapper = mount(<Dialog opened={true} movable={true} />);

      // TODO: simulate move

      wrapper.unmount();
    });

    it("resizable", () => {
      const wrapper = mount(<Dialog opened={true} resizable={true} />);

      // TODO: simulate resize

      wrapper.unmount();
    });
  });

  describe("keyboard support", () => {
    it("should close on Esc key", () => {
      const outerNode = document.createElement("div");
      document.body.appendChild(outerNode);

      const spyOnEscape = sinon.spy();
      mount(<Dialog opened={true} onEscape={spyOnEscape} />, { attachTo: outerNode });

      outerNode.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape" }));
      expect(spyOnEscape.calledOnce).to.be.true;

      document.body.removeChild(outerNode);
    });
  });

});

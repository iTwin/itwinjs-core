/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import Tree from "../../src/tree/Tree";
import { expect } from "chai";

describe("<Tree />", () => {
  it("should render", () => {
    mount(<Tree />);
  });

  it("renders correctly", () => {
    shallow(<Tree />).should.matchSnapshot();
  });

  it("renders children correctly", () => {
    const wrapper = shallow(<Tree><div id="unique" /></Tree>);
    wrapper.find("#unique").should.have.lengthOf(1);
  });

  describe("scrollToElement", () => {
    const scrollToFunction = Element.prototype.scrollTo;
    let scrollToGivenParams: { x: number, y: number } | undefined;

    before(() => {
      Element.prototype.scrollTo = ((x: number, y: number) => { scrollToGivenParams = { x, y }; }) as any;
    });

    after(() => {
      Element.prototype.scrollTo = scrollToFunction;
    });

    it("scrolls correct amount", () => {
      scrollToGivenParams = undefined;
      const wrapper = mount(<Tree />);

      const tree = wrapper.instance() as Tree;

      const clientRect: ClientRect = { // ClientRect and DomRect are undefined in enzyme, so can't use new
        left: 0,
        top: 50,
        right: 30,
        bottom: 70,
        width: 30,
        height: 20,
      };

      tree.scrollToElement(clientRect);

      expect(scrollToGivenParams).to.not.be.undefined;
      expect(scrollToGivenParams!.x).to.be.eq(clientRect.width + 30);
      expect(scrollToGivenParams!.y).to.be.eq(clientRect.top);
    });

    it("returns if Tree hasn't mounted properly", () => {
      scrollToGivenParams = undefined;

      const tree = new Tree({});

      const clientRect: ClientRect = { // ClientRect and DomRect are undefined in enzyme, so can't use new
        left: 0,
        top: 50,
        right: 30,
        bottom: 70,
        width: 30,
        height: 20,
      };

      tree.scrollToElement(clientRect);

      expect(scrollToGivenParams).to.be.undefined;
    });
  });
});

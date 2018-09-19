/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import Backstage from "../../src/backstage/Backstage";

describe("<Backstage />", () => {
  it("should render", () => {
    mount(<Backstage />);
  });

  it("renders correctly", () => {
    shallow(<Backstage />).should.matchSnapshot();
  });

  it("should set is-open class", () => {
    shallow(<Backstage isOpen />).should.matchSnapshot();
  });

  it("should handle overlay click events", () => {
    const handler = sinon.spy();
    const component = mount(<Backstage onClose={handler} />);

    component.simulate("click");

    handler.calledOnce.should.true;
  });

  it("should not fire overlay click event when items are clicked", () => {
    const handler = sinon.spy();
    const component = mount(<Backstage onClose={handler} />);
    const items = component.find(".nz-items");
    items.should.exist;
  });
});

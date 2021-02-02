/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { LEVEL_OFFSET } from "../../ui-core/tree/Node";
import { TreeNodePlaceholder } from "../../ui-core";

describe("<Placeholder />", () => {

  it("should render", () => {
    mount(<TreeNodePlaceholder level={0} />);
  });

  it("should set left padding based on level", () => {
    const wrapper = shallow(<TreeNodePlaceholder level={9} />);
    const style: CSSStyleDeclaration = wrapper.prop("style");
    const padding = parseInt(style.paddingLeft.match(/(\d+)\s*(px)?/)![1], 10);
    padding.should.eq(9 * LEVEL_OFFSET);
  });

  it("should set width between minWidth and maxWidth", () => {
    let repeats = 100;
    while (repeats--) {
      const wrapper = shallow(<TreeNodePlaceholder data-testid="ph" level={0} minWidth={10} maxWidth={100} />);
      const style: CSSStyleDeclaration = wrapper.find({ className: "contents" }).prop("style");
      const width = parseInt(style.width.match(/(\d+)\s*px/)![1], 10);
      width.should.be.gte(10).and.lte(100);
    }
  });

});

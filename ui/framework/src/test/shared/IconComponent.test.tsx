/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { shallow, mount } from "enzyme";
import { IconSpecUtilities } from "@bentley/ui-abstract";
import { Icon } from "../../ui-framework/shared/IconComponent";

describe("IconComponent", () => {

  it("should render with ReactNode", () => {
    // tslint:disable-next-line: deprecation
    mount(<Icon iconSpec={<span>Test</span>} />);
  });

  it("should render correctly with ReactNode", () => {
    // tslint:disable-next-line: deprecation
    shallow(<Icon iconSpec={<span>Test</span>} />).should.matchSnapshot();
  });

  it("should render correctly with icon svg string", () => {
    const iconSpec = IconSpecUtilities.createSvgIconSpec("test.svg");
    // tslint:disable-next-line: deprecation
    shallow(<Icon iconSpec={iconSpec} />).should.matchSnapshot();
  });

  it("should render correctly with icon class string", () => {
    // tslint:disable-next-line: deprecation
    shallow(<Icon iconSpec="icon-developer" />).should.matchSnapshot();
  });

});

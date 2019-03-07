/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { shallow, mount } from "enzyme";
import { Icon } from "../../ui-framework/shared/IconComponent";

describe("IconComponent", () => {

  it("should render with ReactNode", () => {
    mount(<Icon iconSpec={<span>Test</span>} />);
  });

  it("should render correctly with ReactNode", () => {
    shallow(<Icon iconSpec={<span>Test</span>} />).should.matchSnapshot();
  });

});

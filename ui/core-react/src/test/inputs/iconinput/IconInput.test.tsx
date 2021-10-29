/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { IconInput, WebFontIcon } from "../../../core-react";

describe("IconInput", () => {
  it("should render", () => {
    mount(<IconInput icon={<WebFontIcon iconName="icon-placeholder" />} />);
  });

  it("renders correctly", () => {
    shallow(<IconInput icon={<WebFontIcon iconName="icon-placeholder" />} />).should.matchSnapshot();
  });
});

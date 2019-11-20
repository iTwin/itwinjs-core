/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import { IconInput, WebFontIcon } from "../../../ui-core";

describe("IconInput", () => {
  it("should render", () => {
    mount(<IconInput icon={<WebFontIcon iconName="icon-placeholder" />} />);
  });

  it("renders correctly", () => {
    shallow(<IconInput icon={<WebFontIcon iconName="icon-placeholder" />} />).should.matchSnapshot();
  });
});

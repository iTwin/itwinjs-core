/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { Tab, TabMode } from "../../../../ui-ninezone";
import { HorizontalAnchor } from "../../../../ui-ninezone";

describe("<Tab />", () => {
  it("should render", () => {
    mount(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
    />);
  });

  it("renders correctly", () => {
    shallow(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
    />).should.matchSnapshot();
  });
});

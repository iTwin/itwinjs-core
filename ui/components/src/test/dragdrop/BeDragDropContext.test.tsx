/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import { BeDragDropContext } from "../../ui-components";

describe("BeDragDropContext", () => {

  it("should render", () => {
    mount(<BeDragDropContext />);
  });

  it("should render correctly", () => {
    shallow(<BeDragDropContext />).should.matchSnapshot();
  });

});

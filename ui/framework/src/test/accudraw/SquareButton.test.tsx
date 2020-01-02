/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { SquareButton } from "../../ui-framework/accudraw/SquareButton";

describe("SquareButton", () => {
  it("should render", () => {
    mount(<SquareButton>xyz</SquareButton>);
  });

  it("renders correctly", () => {
    shallow(<SquareButton>xyz</SquareButton >).should.matchSnapshot();
  });
});

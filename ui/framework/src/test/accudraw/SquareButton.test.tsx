/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { SquareButton } from "../../appui-react/accudraw/SquareButton";
import { mount } from "../TestUtils";

describe("SquareButton", () => {
  it("should render", () => {
    mount(<SquareButton>xyz</SquareButton>);
  });

  it("renders correctly", () => {
    shallow(<SquareButton>xyz</SquareButton >).should.matchSnapshot();
  });
});

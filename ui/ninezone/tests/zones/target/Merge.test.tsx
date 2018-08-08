/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";

import Merge from "@src/zones/target/Merge";

describe("<Merge />", () => {
  it("should render", () => {
    mount(<Merge columns={1} rows={1} cells={[]} />);
  });

  it("renders correctly", () => {
    shallow(<Merge columns={1} rows={1} cells={[]} />).should.matchSnapshot();
  });
});

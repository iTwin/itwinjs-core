/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { MessageBox, MessageSeverity, ButtonType, ButtonStyle } from "@src/index";
import TestUtils from "../TestUtils";

describe("MessageBox", () => {

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  const buttonCluster = [
    { type: ButtonType.Close, buttonStyle: ButtonStyle.Primary, onClick: () => { } },
  ];

  describe("<MessageBox />", () => {
    it("should render", () => {
      mount(<MessageBox opened={true} severity={MessageSeverity.Information} buttonCluster={buttonCluster} />);
    });

    it("renders correctly", () => {
      shallow(<MessageBox opened={true} severity={MessageSeverity.Information} buttonCluster={buttonCluster} />).should.matchSnapshot();
    });
  });
});

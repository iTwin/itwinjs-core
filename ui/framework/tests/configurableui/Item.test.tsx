/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import { ToolButton, GroupButton, CommandButton } from "@src/index";
import TestUtils from "../TestUtils";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

describe("ToolButton", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<ToolButton />", () => {
    it("should render", () => {
      mount(<ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="UiFramework:tests.label" />);
    });

    it("renders correctly", () => {
      shallow(<ToolButton toolId="tool1" iconClass="icon-placeholder" labelKey="UiFramework:tests.label" />).should.matchSnapshot();
    });
  });
});

describe("GroupButton", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<GroupButton />", () => {
    it("should render", () => {
      mount(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconClass="icon-placeholder"
          items={["test1", "tool2", "tool3", "tool4"]}
          direction={Direction.Bottom}
          itemsInColumn={4}
        />,
      );
    });

    it("renders correctly", () => {
      shallow(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconClass="icon-placeholder"
          items={["test1", "tool2", "tool3", "tool4"]}
          direction={Direction.Bottom}
          itemsInColumn={4}
        />,
      ).should.matchSnapshot();
    });
  });
});

describe("CommandButton", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  const commandHandler1 = {
    messageId: "", parameters: null,
    execute: () => {
    },
  };

  describe("<CommandButton />", () => {
    it("should render", () => {
      mount(<CommandButton commandId="addMessage" iconClass="icon-placeholder" commandHandler={commandHandler1} />);
    });

    it("renders correctly", () => {
      shallow(<CommandButton commandId="addMessage" iconClass="icon-placeholder" commandHandler={commandHandler1} />).should.matchSnapshot();
    });
  });
});

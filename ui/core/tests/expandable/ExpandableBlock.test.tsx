/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ExpandableBlock } from "../../src/index";
import TestUtils from "../TestUtils";

describe("ExpandableBlock", () => {

  before(async () => {
    await TestUtils.initializeUiCore();
  });

  describe("<ExpandableBlock />", () => {
    it("should render collapsed", () => {
      mount(
        <ExpandableBlock title="Test" isExpanded={false} onClick={sinon.spy()}>
          <div>Hello</div>
        </ExpandableBlock>);
    });

    it("should render expanded", () => {
      mount(
        <ExpandableBlock title="Test" isExpanded={true} onClick={sinon.spy()}>
          <div>Hello</div>
        </ExpandableBlock>);
    });

    it("renders correctly collapsed", () => {
      shallow(
        <ExpandableBlock title="Test" isExpanded={false} onClick={sinon.spy()}>
          <div>Hello</div>
        </ExpandableBlock>).should.matchSnapshot();
    });

    it("renders correctly expanded", () => {
      shallow(
        <ExpandableBlock title="Test" isExpanded={true} onClick={sinon.spy()}>
          <div>Hello</div>
        </ExpandableBlock>).should.matchSnapshot();
    });
  });
});

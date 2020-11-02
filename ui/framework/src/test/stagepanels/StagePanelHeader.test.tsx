/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { StagePanelLocation } from "@bentley/ui-abstract";
import { FrontstageManager, StagePanelDef, StagePanelHeader, StagePanelState } from "../../ui-framework";
import { mount } from "../TestUtils";

describe("StagePanelHeader", () => {
  it("should mount", () => {
    mount(<StagePanelHeader
      location={StagePanelLocation.Left}
    />);
  });

  it("should render", () => {
    shallow(<StagePanelHeader
      location={StagePanelLocation.Left}
    />).should.matchSnapshot();
  });

  it("should render with collapse button", () => {
    shallow(<StagePanelHeader
      collapseButton
      location={StagePanelLocation.Left}
    />).should.matchSnapshot();
  });

  it("should minimize stage panel on collapse button click", () => {
    const spy = sinon.spy();
    const sut = mount<StagePanelHeader>(<StagePanelHeader
      collapseButton
      location={StagePanelLocation.Left}
    />);
    const collapseButton = sut.find(".uifw-collapse");

    const stagePanel = new StagePanelDef();
    const getStagePanelDef = sinon.stub(FrontstageManager.activeFrontstageDef!, "getStagePanelDef").returns(stagePanel);
    sinon.stub(stagePanel, "panelState").set(spy);

    collapseButton.simulate("click");
    expect(spy.calledOnceWithExactly(StagePanelState.Minimized)).to.be.true;

    getStagePanelDef.reset();
  });
});

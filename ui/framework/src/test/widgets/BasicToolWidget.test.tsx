/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { ToolbarHelper } from "../../appui-react";
import { CommandItemDef } from "../../appui-react/shared/CommandItemDef";
import { BasicToolWidget } from "../../appui-react/widgets/BasicToolWidget";
import TestUtils, { mount } from "../TestUtils";

describe("BasicToolWidget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("BasicToolWidget should render", () => {
    mount(<BasicToolWidget />);
  });

  it("BasicToolWidget should render correctly", () => {
    shallow(<BasicToolWidget />).should.matchSnapshot();
  });

  it("BasicToolWidget with bentley B should render", () => {
    shallow(<BasicToolWidget showCategoryAndModelsContextTools={true} icon={"icon-bentley-systems"} />).should.matchSnapshot();
  });

  it("BasicToolWidget with Categories and Models should render", () => {
    mount(<BasicToolWidget showCategoryAndModelsContextTools={true} />);
  });

  const testH1Def = new CommandItemDef({
    commandId: "test-h1-tool",
    execute: (): void => { },
    iconSpec: "icon-developer",
    label: "test-h1-tool",
  });

  const testV1Def = new CommandItemDef({
    commandId: "test-v1-tool",
    execute: (): void => { },
    iconSpec: "icon-developer",
    label: "test-v1-tool",
  });

  const testV2Def = new CommandItemDef({
    commandId: "test-v2-tool",
    execute: (): void => { },
    iconSpec: "icon-developer",
    label: "test-v2-tool",
  });

  const testH2Def = new CommandItemDef({
    commandId: "test-h2-tool",
    execute: (): void => { },
    iconSpec: "icon-developer",
    label: "test-h2-tool",
  });

  it("BasicToolWidget with suffix and prefix items should render correctly", () => {
    shallow(<BasicToolWidget additionalVerticalItems={ToolbarHelper.createToolbarItemsFromItemDefs([testV1Def, testV2Def])}
      additionalHorizontalItems={ToolbarHelper.createToolbarItemsFromItemDefs([testH1Def, testH2Def])} />).should.matchSnapshot();
  });

  it("BasicToolWidget should refresh when props change", () => {
    const wrapper = mount(<BasicToolWidget additionalVerticalItems={ToolbarHelper.createToolbarItemsFromItemDefs([testV1Def, testV2Def])}
      additionalHorizontalItems={ToolbarHelper.createToolbarItemsFromItemDefs([testH1Def, testH2Def])} />);
    wrapper.setProps({ additionalHorizontalItems: undefined, additionalVerticalItems: undefined });
  });

});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import TestUtils from "../TestUtils";

import { DefaultNavigationWidget } from "../../ui-framework/widgets/DefaultNavigationWidget";
import { ItemList } from "../../ui-framework/shared/ItemMap";
import { CommandItemDef } from "../../ui-framework/shared/CommandItemDef";

describe("DefaultNavigationWidget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("DefaultNavigationWidget should render", () => {
    const wrapper = mount(<DefaultNavigationWidget />);
    wrapper.unmount();
  });

  it("DefaultNavigationWidget should render correctly", () => {
    shallow(<DefaultNavigationWidget />).should.matchSnapshot();
  });

  it("DefaultNavigationWidget with suffix and prefix items should render correctly", () => {
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
      commandId: "test-v1-tool",
      execute: (): void => { },
      iconSpec: "icon-developer",
      label: "test-v1-tool",
    });

    const testH2Def = new CommandItemDef({
      commandId: "test-h2-tool",
      execute: (): void => { },
      iconSpec: "icon-developer",
      label: "test-h2-tool",
    });

    shallow(<DefaultNavigationWidget prefixVerticalItems={new ItemList([testV1Def])} suffixVerticalItems={new ItemList([testV2Def])}
      prefixHorizontalItems={new ItemList([testH1Def])} suffixHorizontalItems={new ItemList([testH2Def])} />).should.matchSnapshot();
  });

});

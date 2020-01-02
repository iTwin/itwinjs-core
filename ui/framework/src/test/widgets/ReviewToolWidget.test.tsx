/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount, shallow } from "enzyme";
import TestUtils from "../TestUtils";

import { ReviewToolWidget } from "../../ui-framework/widgets/ReviewToolWidget";
import { ItemList } from "../../ui-framework/shared/ItemMap";
import { CommandItemDef } from "../../ui-framework/shared/CommandItemDef";

describe("ReviewToolWidget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("ReviewToolWidget should render", () => {
    const wrapper = mount(<ReviewToolWidget />);
    wrapper.unmount();
  });

  it("ReviewToolWidget should render correctly", () => {
    shallow(<ReviewToolWidget />).should.matchSnapshot();
  });

  it("ReviewToolWidget with bentley B should render", () => {
    shallow(<ReviewToolWidget showCategoryAndModelsContextTools={true} iconSpec={"icon-bentley-systems"} />).should.matchSnapshot();
  });

  it("ReviewToolWidget with Categories and Models should render", () => {
    const wrapper = mount(<ReviewToolWidget showCategoryAndModelsContextTools={true} />);
    wrapper.unmount();
  });

  it("ReviewToolWidget with suffix and prefix items should render correctly", () => {
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

    shallow(<ReviewToolWidget prefixVerticalItems={new ItemList([testV1Def])} suffixVerticalItems={new ItemList([testV2Def])}
      prefixHorizontalItems={new ItemList([testH1Def])} suffixHorizontalItems={new ItemList([testH2Def])} />).should.matchSnapshot();
  });

});

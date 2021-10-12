/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import { CommandItemDef } from "../../appui-react/shared/CommandItemDef";
import { ItemList } from "../../appui-react/shared/ItemMap";
import { ReviewToolWidget } from "../../appui-react/widgets/ReviewToolWidget";
import TestUtils, { mount } from "../TestUtils";

describe("ReviewToolWidget", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("ReviewToolWidget should render", () => {
    mount(<ReviewToolWidget />);
  });

  it("ReviewToolWidget should render correctly", () => {
    shallow(<ReviewToolWidget />).should.matchSnapshot();
  });

  it("ReviewToolWidget with bentley B should render", () => {
    shallow(<ReviewToolWidget showCategoryAndModelsContextTools={true} iconSpec={"icon-bentley-systems"} />).should.matchSnapshot();
  });

  it("ReviewToolWidget with Categories and Models should render", () => {
    mount(<ReviewToolWidget showCategoryAndModelsContextTools={true} />);
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

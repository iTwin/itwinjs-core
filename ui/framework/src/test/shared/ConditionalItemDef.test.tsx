/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { expect } from "chai";
import TestUtils from "../TestUtils";
import { ConditionalItemDef } from "../../ui-framework/shared/ConditionalItemDef";
import { CommandItemDef } from "../../ui-framework/shared/CommandItemDef";
import { BaseItemState } from "../../ui-framework/shared/ItemDefBase";
import { SyncUiEventDispatcher } from "../../ui-framework/syncui/SyncUiEventDispatcher";
import { render } from "react-testing-library";
import { Toolbar } from "../../ui-framework/toolbar/Toolbar";
import { Orientation } from "@bentley/ui-core";
import { ItemList } from "../../ui-framework/shared/ItemMap";

describe("ConditionalItemDef", () => {

  const tool1 = new CommandItemDef({
    commandId: "tool1",
    label: "Tool 1",
    iconSpec: "icon-placeholder",
    isEnabled: false,
    isVisible: false,
  });

  const tool2 = new CommandItemDef({
    commandId: "tool2",
    label: "Tool 2",
    iconSpec: "icon-placeholder",
    isEnabled: true,
    isVisible: true,
  });

  const testItemEventId = "test-event";
  const testItemStateFunc = (currentState: Readonly<BaseItemState>): BaseItemState => {
    const returnState: BaseItemState = { ...currentState };
    returnState.isEnabled = true;
    returnState.isVisible = true;
    return returnState;
  };

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("ConditionalItemDef with no commandId should get generated id", () => {
    const item = new ConditionalItemDef({
      items: [tool1, tool2],
      stateSyncIds: [testItemEventId],
      stateFunc: testItemStateFunc,
    });

    expect(item.id.substr(0, ConditionalItemDef.conditionalIdPrefix.length)).to.eq(ConditionalItemDef.conditionalIdPrefix);
  });

  it("ConditionalItemDef with commandId should use it", () => {
    const testId = "Test";
    const item = new ConditionalItemDef({
      conditionalId: testId,
      items: [tool1, tool2],
      stateSyncIds: [testItemEventId],
      stateFunc: testItemStateFunc,
    });

    expect(item.id).to.eq(testId);
  });

  it("ConditionalItemDef should alter child items based on stateFunc", () => {
    const conditionalItem = new ConditionalItemDef({
      items: [tool1, tool2],
      isEnabled: false,
      isVisible: false,
      stateSyncIds: [testItemEventId],
      stateFunc: testItemStateFunc,
    });

    const renderedComponent = render(
      <Toolbar
        orientation={Orientation.Horizontal}
        items={
          new ItemList([
            conditionalItem,
          ])
        }
      />);
    expect(renderedComponent).not.to.be.undefined;

    expect(conditionalItem.isEnabled).to.be.false;
    expect(conditionalItem.isVisible).to.be.false;
    expect(tool1.isEnabled).to.be.false;
    expect(tool1.isVisible).to.be.false;
    expect(tool2.isEnabled).to.be.true;
    expect(tool2.isVisible).to.be.true;

    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testItemEventId);

    expect(conditionalItem.isEnabled).to.be.true;
    expect(conditionalItem.isVisible).to.be.true;
    expect(tool1.isEnabled).to.be.true;
    expect(tool1.isVisible).to.be.true;
    expect(tool2.isEnabled).to.be.true;
    expect(tool2.isVisible).to.be.true;

    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testItemEventId);

    expect(conditionalItem.isEnabled).to.be.true;
    expect(conditionalItem.isVisible).to.be.true;
  });

});

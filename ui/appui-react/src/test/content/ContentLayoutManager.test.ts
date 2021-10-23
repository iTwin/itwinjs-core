/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { StandardContentLayouts } from "@itwin/appui-abstract";
import { getUniqueId } from "@itwin/appui-layout-react";
import { expect } from "chai";
import * as sinon from "sinon";
import { ContentGroup, ContentGroupProps, ContentProps } from "../../appui-react/content/ContentGroup";
import { ContentLayoutManager } from "../../appui-react/content/ContentLayoutManager";
import { FrontstageManager } from "../../appui-react/frontstage/FrontstageManager";

describe("ContentLayoutManager", () => {
  before(async () => {
    await FrontstageManager.setActiveFrontstageDef(undefined);
  });

  it("activeLayout should return undefined if no active frontstage", () => {
    expect(ContentLayoutManager.activeLayout).to.be.undefined;
  });

  it("activeContentGroup should return undefined if no active frontstage", () => {
    expect(ContentLayoutManager.activeContentGroup).to.be.undefined;
  });

  it("refreshActiveLayout should do nothing if no active frontstage", () => {
    ContentLayoutManager.refreshActiveLayout();
  });

  it("should getLayoutForGroup", () => {
    const uniqueGroupId = getUniqueId();
    const contentProps: ContentProps[] = [{ id: "myContent", classId: "TestContentControl" }, { id: "myContent2", classId: "TestContentControl" }];
    const key = ContentLayoutManager.getLayoutKey({ contentGroupId: uniqueGroupId, layoutId: StandardContentLayouts.twoHorizontalSplit.id });

    const groupProps: ContentGroupProps = {
      id: uniqueGroupId,
      layout: StandardContentLayouts.twoHorizontalSplit,
      contents: contentProps,
    };

    const layoutDef = ContentLayoutManager.getLayoutForGroup(groupProps);
    const foundLayoutDef = ContentLayoutManager.findLayout(key);
    expect(foundLayoutDef?.id).to.be.eq(layoutDef.id);
  });

  it("should getLayoutForGroup with overridden layout", () => {
    const uniqueGroupId = getUniqueId();
    const contentProps: ContentProps[] = [{ id: "myContent", classId: "TestContentControl" }, { id: "myContent2", classId: "TestContentControl" }];
    const overrideKey = ContentLayoutManager.getLayoutKey({ contentGroupId: uniqueGroupId, layoutId: StandardContentLayouts.twoVerticalSplit.id });

    const groupProps: ContentGroupProps = {
      id: uniqueGroupId,
      layout: StandardContentLayouts.twoHorizontalSplit,
      contents: contentProps,
    };

    const layoutDef = ContentLayoutManager.getLayoutForGroup(groupProps, StandardContentLayouts.twoVerticalSplit);
    const foundLayoutDef = ContentLayoutManager.findLayout(overrideKey);
    expect(foundLayoutDef?.id).to.be.eq(layoutDef.id);
  });

  it("should call  FrontstageManager.setActiveContentGroup", async () => {
    const uniqueGroupId = getUniqueId();
    const contentProps: ContentProps[] = [{ id: "myContent", classId: "TestContentControl" }, { id: "myContent2", classId: "TestContentControl" }];
    const groupProps: ContentGroupProps = {
      id: uniqueGroupId,
      layout: StandardContentLayouts.twoHorizontalSplit,
      contents: contentProps,
    };

    const contentGroup = new ContentGroup(groupProps);
    const spy = sinon.stub(FrontstageManager as any, "setActiveContentGroup").returns(Promise.resolve());
    await ContentLayoutManager.setActiveContentGroup(contentGroup);
    expect(spy).to.have.been.called;
  });
});

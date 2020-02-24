/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IconHelper } from "../../ui-framework/shared/IconHelper";
import { expect } from "chai";
import { ConditionalStringValue } from "@bentley/ui-abstract";

describe("IconHelper", () => {

  it("should get string icon data", () => {
    const iconSpec = IconHelper.getIconData("cat");
    expect(iconSpec).to.be.equal("cat");

    const iconNode = IconHelper.getIconReactNode(iconSpec);
    expect(iconNode).not.to.be.undefined;
    expect((iconNode as JSX.Element).props.iconSpec).to.eq("cat");
  });

  it("should get conditionalString icon data", () => {
    const iconSpec = IconHelper.getIconData(new ConditionalStringValue(() => "dog", ["dummy"]));
    expect((iconSpec as ConditionalStringValue).value).to.be.equal("dog");

    const iconNode = IconHelper.getIconReactNode(iconSpec);
    expect(iconNode).not.to.be.undefined;
    expect((iconNode as JSX.Element).props.iconSpec).to.eq("dog");
  });

  it("should get react icon data", () => {
    const internalData = new Map<string, any>();  // used to store ReactNode if iconSpec hold a ReactNode
    const iconSpec = IconHelper.getIconData(<span>Test</span>, internalData);
    expect(iconSpec).to.be.equal(IconHelper.reactIconKey);

    const iconNode = IconHelper.getIconReactNode(iconSpec, internalData);
    expect(iconNode).not.to.be.undefined;
    expect((iconNode as JSX.Element).props.iconSpec.props.children).to.eq("Test");
  });

});

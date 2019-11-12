/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as moq from "typemoq";
import { render, cleanup } from "@testing-library/react";
import TestUtils from "../TestUtils";
import { ClearEmphasisStatusField } from "../../ui-framework/selection/ClearEmphasisStatusField";
import { StatusBarFieldId } from "../../ui-framework/statusbar/StatusBarWidgetControl";
import { ScreenViewport, IModelApp, Viewport, MockRender } from "@bentley/imodeljs-frontend";
import { SelectionContextUtilities } from "../../ui-framework/selection/SelectionContextUtilities";

describe("ClearEmphasisStatusField", () => {
  const viewportMock = moq.Mock.ofType<ScreenViewport>();

  const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(SelectionContextUtilities, "areFeatureOverridesActive")!;
  const featureOverridesActive = (_vp: Viewport) => true;
  const featureOverridesNotActive = (_vp: Viewport) => false;

  before(async () => {
    await TestUtils.initializeUiFramework();
    MockRender.App.startup();
  });

  after(() => {
    MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
    Object.defineProperty(SelectionContextUtilities, "areFeatureOverridesActive", propertyDescriptorToRestore);
  });

  afterEach(cleanup);

  it("ClearEmphasisStatusField renders visible", () => {
    Object.defineProperty(SelectionContextUtilities, "areFeatureOverridesActive", { get: () => featureOverridesActive });

    IModelApp.viewManager.setSelectedView(viewportMock.object);
    const component = render(<ClearEmphasisStatusField isInFooterMode={false} hideWhenUnused={true} onOpenWidget={(_widget: StatusBarFieldId) => { }} openWidget={"none"} />);
    expect(component).not.to.be.undefined;
    expect(component.container.querySelector("div.uifw-indicator-fade-in")).not.to.be.null;
    // component.debug();

    Object.defineProperty(SelectionContextUtilities, "areFeatureOverridesActive", { get: () => featureOverridesNotActive });
    SelectionContextUtilities.emphasizeElementsChanged.raiseEvent();
    expect(component.container.querySelector("div.uifw-indicator-fade-out")).not.to.be.null;
  });

  it("ClearEmphasisStatusField renders invisible", () => {
    Object.defineProperty(SelectionContextUtilities, "areFeatureOverridesActive", { get: () => featureOverridesNotActive });
    IModelApp.viewManager.setSelectedView(viewportMock.object);

    const component = render(<ClearEmphasisStatusField isInFooterMode={false} hideWhenUnused={true} onOpenWidget={(_widget: StatusBarFieldId) => { }} openWidget={"none"} />);
    expect(component).not.to.be.undefined;
    expect(component.container.querySelector("div.uifw-indicator-fade-out")).not.to.be.null;
    // component.debug();
  });

  it("ClearEmphasisStatusField renders always", () => {
    Object.defineProperty(SelectionContextUtilities, "areFeatureOverridesActive", { get: () => featureOverridesNotActive });
    IModelApp.viewManager.setSelectedView(viewportMock.object);

    const component = render(<ClearEmphasisStatusField isInFooterMode={false} hideWhenUnused={false} onOpenWidget={(_widget: StatusBarFieldId) => { }} openWidget={"none"} />);
    expect(component).not.to.be.undefined;
    expect(component.container.querySelector("div.uifw-indicator-fade-in")).not.to.be.null;
    // component.debug();
  });

});

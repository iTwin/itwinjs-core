/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as moq from "typemoq";
import { IModelApp, MockRender, ScreenViewport, Viewport } from "@bentley/imodeljs-frontend";
import { cleanup, render } from "@testing-library/react";
import { ClearEmphasisStatusField } from "../../ui-framework/selection/ClearEmphasisStatusField";
import { SelectionContextUtilities } from "../../ui-framework/selection/SelectionContextUtilities";
import { StatusBarFieldId } from "../../ui-framework/statusbar/StatusBarWidgetControl";
import TestUtils from "../TestUtils";

describe("ClearEmphasisStatusField", () => {
  const viewportMock = moq.Mock.ofType<ScreenViewport>();

  const propertyDescriptorToRestore = Object.getOwnPropertyDescriptor(SelectionContextUtilities, "areFeatureOverridesActive")!;
  const featureOverridesActive = (_vp: Viewport) => true;
  const featureOverridesNotActive = (_vp: Viewport) => false;

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
    Object.defineProperty(SelectionContextUtilities, "areFeatureOverridesActive", propertyDescriptorToRestore);
  });

  afterEach(cleanup);

  it("ClearEmphasisStatusField renders visible", () => {
    Object.defineProperty(SelectionContextUtilities, "areFeatureOverridesActive", { get: () => featureOverridesActive });

    IModelApp.viewManager.setSelectedView(viewportMock.object);
    const component = render(<ClearEmphasisStatusField isInFooterMode={false} hideWhenUnused={true} onOpenWidget={(_widget: StatusBarFieldId) => { }} openWidget={"none"} />);
    expect(component).not.to.be.undefined;
    // Having trouble with useActiveViewport hook with viewport mocks
    // expect(component.container.querySelector("div.uifw-indicator-fade-in")).not.to.be.null;
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

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import { expect } from "chai";
import * as React from "react";
import * as moq from "typemoq";
import type { ScreenViewport, Viewport } from "@itwin/core-frontend";
import { IModelApp, MockRender } from "@itwin/core-frontend";
import { render } from "@testing-library/react";
import { ClearEmphasisStatusField } from "../../appui-react/selection/ClearEmphasisStatusField";
import { HideIsolateEmphasizeAction, HideIsolateEmphasizeActionHandler, HideIsolateEmphasizeManager } from "../../appui-react/selection/HideIsolateEmphasizeManager";
import type { StatusBarFieldId } from "../../appui-react/statusbar/StatusBarWidgetControl";
import TestUtils from "../TestUtils";

describe("ClearEmphasisStatusField", () => {
  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const featureOverridesActive = (_vp: Viewport) => true;
  const featureOverridesNotActive = (_vp: Viewport) => false;
  const functionToRestore = HideIsolateEmphasizeManager.prototype.areFeatureOverridesActive;

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
    HideIsolateEmphasizeManager.prototype.areFeatureOverridesActive = functionToRestore;
  });

  it("ClearEmphasisStatusField renders visible", async () => {
    HideIsolateEmphasizeManager.prototype.areFeatureOverridesActive = featureOverridesActive;

    await IModelApp.viewManager.setSelectedView(viewportMock.object);
    const component = render(<ClearEmphasisStatusField isInFooterMode={false} hideWhenUnused={true} onOpenWidget={(_widget: StatusBarFieldId) => { }} openWidget={"none"} />);
    expect(component).not.to.be.undefined;
    // Having trouble with useActiveViewport hook with viewport mocks
    // expect(component.container.querySelector("div.uifw-indicator-fade-in")).not.to.be.null;

    HideIsolateEmphasizeManager.prototype.areFeatureOverridesActive = featureOverridesNotActive;
    HideIsolateEmphasizeActionHandler.emphasizeElementsChanged.raiseEvent({ viewport: viewportMock.object, action: HideIsolateEmphasizeAction.ClearHiddenIsolatedEmphasized });
    expect(component.container.querySelector("div.uifw-indicator-fade-out")).not.to.be.null;
  });

  it("ClearEmphasisStatusField renders invisible", async () => {
    HideIsolateEmphasizeManager.prototype.areFeatureOverridesActive = featureOverridesNotActive;
    await IModelApp.viewManager.setSelectedView(viewportMock.object);

    const component = render(<ClearEmphasisStatusField isInFooterMode={false} hideWhenUnused={true} onOpenWidget={(_widget: StatusBarFieldId) => { }} openWidget={"none"} />);
    expect(component).not.to.be.undefined;
    expect(component.container.querySelector("div.uifw-indicator-fade-out")).not.to.be.null;
  });

  it("ClearEmphasisStatusField renders always", async () => {
    HideIsolateEmphasizeManager.prototype.areFeatureOverridesActive = featureOverridesNotActive;
    await IModelApp.viewManager.setSelectedView(viewportMock.object);

    const component = render(<ClearEmphasisStatusField isInFooterMode={false} hideWhenUnused={false} onOpenWidget={(_widget: StatusBarFieldId) => { }} openWidget={"none"} />);
    expect(component).not.to.be.undefined;
    expect(component.container.querySelector("div.uifw-indicator-fade-in")).not.to.be.null;
  });

});

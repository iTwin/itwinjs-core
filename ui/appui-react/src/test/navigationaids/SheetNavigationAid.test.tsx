/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as moq from "typemoq";
import { IModelConnection, MockRender } from "@itwin/core-frontend";
import { AnyWidgetProps, CardContainer, ConfigurableUiManager, NavigationWidgetDef, SheetNavigationAid, SheetNavigationAidControl } from "../../appui-react";
import TestUtils, { childStructure } from "../TestUtils";
import { render } from "@testing-library/react";

describe("SheetNavigationAid", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

    if (!ConfigurableUiManager.isControlRegistered("SheetNavigationAid"))
      ConfigurableUiManager.registerControl("SheetNavigationAid", SheetNavigationAidControl);

    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  const connection = moq.Mock.ofType<IModelConnection>();
  afterEach(() => {
    connection.reset();
  });

  describe("<SheetNavigationAid />", () => {
    it("renders in progress correctly", () => {
      const {container} = render(<SheetNavigationAid iModelConnection={connection.object} />);

      expect(container).to.satisfy(childStructure(".uifw-sheet-navigation .iui-progress-indicator-radial"));
    });

    it("listen on CardContainer.cardSelectedEvent", () => {
      const {container} = render(<SheetNavigationAid iModelConnection={connection.object} />);
      CardContainer.onCardSelectedEvent.emit({id: 5, index: 5});
      expect(container).to.satisfy(childStructure(".uifw-sheet-navigation .iui-progress-indicator-radial"));
    });

    it("handles slow iModel Connection", () => {
      // Take control of an async operation that mounting the component triggers...
      let resolver: (value: IModelConnection.ViewSpec[] | PromiseLike<IModelConnection.ViewSpec[]>) => void = () => {};
      const promise = new Promise<IModelConnection.ViewSpec[]>((resolve) => {
        resolver = resolve;
      });
      connection.setup((x) => x.views).returns(() => ({getViewList: async ()=> promise} as any));

      // Mount and unmount the component
      const {unmount} = render(<SheetNavigationAid iModelConnection={connection.object} />);
      unmount();
      // ... resolve the async operation after component is unmounted.
      expect(() => resolver([])).to.not.throw();
    });
  });

  describe("SheetNavigationAidControl", () => {

    const widgetProps: AnyWidgetProps = { // eslint-disable-line deprecation/deprecation
      classId: "NavigationWidget",
      isFreeform: true,
      navigationAidId: "SheetNavigationAid",
    };

    it("SheetNavigationAidControl creates SheetNavigationAid", () => {

      const widgetDef = new NavigationWidgetDef(widgetProps); // eslint-disable-line deprecation/deprecation
      expect(widgetDef).to.be.instanceof(NavigationWidgetDef); // eslint-disable-line deprecation/deprecation

      const navigationWidgetDef = widgetDef;

      const reactNode = navigationWidgetDef.reactNode;
      expect(reactNode).to.not.be.undefined;

      const cornerNode = navigationWidgetDef.renderCornerItem();
      expect(cornerNode).to.not.be.undefined;
    });

  });
});

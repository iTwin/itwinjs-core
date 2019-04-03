/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { Vector3d } from "@bentley/geometry-core";
import { render, cleanup } from "react-testing-library";
import * as moq from "typemoq";
import {
  ConfigurableUiManager,
  DrawingNavigationAid,
  DrawingNavigationAidControl,
} from "../../ui-framework";
import TestUtils from "../TestUtils";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { MapMode } from "../../ui-framework/navigationaids/DrawingNavigationAid";

describe("CubeNavigationAid", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

    if (!ConfigurableUiManager.isControlRegistered("CubeNavigationAid"))
      ConfigurableUiManager.registerControl("CubeNavigationAid", DrawingNavigationAidControl);
  });

  const connection = moq.Mock.ofType<IModelConnection>();

  afterEach(cleanup);

  describe("<CubeNavigationAid />", () => {
    it("should render", () => {
      render(<DrawingNavigationAid iModelConnection={connection.object} />);
    });
    it("should exist", async () => {
      const animationEnd = sinon.spy();
      const component = render(<DrawingNavigationAid iModelConnection={connection.object} onAnimationEnd={animationEnd} />);
      const navAid = component.getByTestId("drawing-navigation-aid");
      expect(navAid).to.exist;
    });
    it("should have expected closed dimensions", () => {
      const size = Vector3d.create(96, 96);
      const component = render(<DrawingNavigationAid iModelConnection={connection.object} closeSize={size} />);
      const navAid = component.getByTestId("drawing-navigation-aid");
      expect(navAid.style.width).to.equal("96px");
      expect(navAid.style.height).to.equal("96px");
    });
    it("should have expected opened dimensions", () => {
      const size = Vector3d.create(350, 300);
      const component = render(<DrawingNavigationAid iModelConnection={connection.object} openSize={size} initialMapMode={MapMode.Opened} />);
      const navAid = component.getByTestId("drawing-navigation-aid");
      expect(navAid.style.width).to.equal("350px");
      expect(navAid.style.height).to.equal("300px");
    });
    it("should animate from closed to opened", async () => {
      const animationEndSpy = sinon.spy();
      const closedSize = Vector3d.create(96, 96);
      const openedSize = Vector3d.create(350, 300);
      const component = render(
        <div>
          <DrawingNavigationAid iModelConnection={connection.object} closeSize={closedSize} openSize={openedSize} onAnimationEnd={animationEndSpy} animationTime={0} />
          <div id="drawing-portal" data-testid="drawing-portal"> </div>
        </div>);

      const navAid = component.getByTestId("drawing-navigation-aid");
      const drawingContainer = component.getByTestId("drawing-container");

      expect(navAid.style.width).to.equal("96px");
      expect(navAid.style.height).to.equal("96px");
      drawingContainer.dispatchEvent(new MouseEvent("mousedown", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: 4,
        clientY: 4,
      }));
      drawingContainer.dispatchEvent(new MouseEvent("mouseup", {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: 4,
        clientY: 4,
      }));

      const navAid2 = component.queryByTestId("drawing-navigation-aid");
      expect(navAid2).to.exist;
      expect(navAid2!.style.width).to.equal("350px");
      expect(navAid2!.style.height).to.equal("300px");
    });
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorDef, LightSettings } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { BlankConnection } from "../IModelConnection";
import { ViewCreator3d, ViewCreator3dOptions } from "../ViewCreator3d";
import { ViewState2d, ViewState3d } from "../ViewState";
import { createBlankConnection } from "./createBlankConnection";
import { ViewCreator2d, ViewCreator2dOptions } from "../ViewCreator2d";

describe("ViewCreator", () => {
  let iModel: BlankConnection;

  before(async () => {
    await IModelApp.startup();
    iModel = createBlankConnection();
  });
  after(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  describe("3d option", () => {
    let creator: ViewCreator3d;

    async function test3dOption(options: ViewCreator3dOptions, returnTrueOnOptionEffect: (view: ViewState3d) => boolean) {
      let view = await creator.createDefaultView();
      expect(returnTrueOnOptionEffect(view as ViewState3d), "Unexpected effect of option found.").to.be.false;

      view = await creator.createDefaultView(options);
      expect(returnTrueOnOptionEffect(view as ViewState3d), "Expected option's effect, but was not found.").to.be.true;
    }

    before(() => creator = new ViewCreator3d(iModel));

    it("'cameraOn' should control when the camera is enabled in the created view.", async () => {
      const test = (view: ViewState3d): boolean => view.isCameraOn;
      const options: ViewCreator3dOptions = { cameraOn: true };
      await test3dOption(options, test);
    });
    it("'skyboxOn' should control when the skybox is on in the created view.", async () => {
      const test = (view: ViewState3d): boolean => view.displayStyle.environment.displaySky;
      const options: ViewCreator3dOptions = { skyboxOn: true };
      await test3dOption(options, test);
    });
    it("'useDefaultLighting' should control if the lighting is overriden in the created view.", async () => {
      const test = (view: ViewState3d): boolean => {
        // Test if the lighting is equivalent to the core default lighting.
        const defaultLighting = LightSettings.fromJSON();
        const viewLighting = view.displayStyle.lights;
        return viewLighting.equals(defaultLighting);
      };
      const options: ViewCreator3dOptions = { useDefaultLighting: true };
      await test3dOption(options, test);
    });
  });
  describe("2d options", () => {
    let creator: ViewCreator2d;

    async function test2dOption(options: ViewCreator2dOptions, returnTrueOnOptionEffect: (view: ViewState2d) => boolean) {
      let view = await creator.createViewForModel("");
      expect(returnTrueOnOptionEffect(view as ViewState2d), "Unexpected effect of option found.").to.be.false;

      view = await creator.createViewForModel("", options);
      expect(returnTrueOnOptionEffect(view as ViewState2d), "Expected option's effect, but was not found.").to.be.true;
    }

    before(() => creator = new ViewCreator2d(iModel));

    it("'bgColor' should control the background color in the created view.", async () => {
      const bgColor = ColorDef.red;
      const test = (view: ViewState2d): boolean => view.backgroundColor.equals(bgColor);
      const options: ViewCreator2dOptions = { bgColor };
      await test2dOption(options, test);
    });
  });
});

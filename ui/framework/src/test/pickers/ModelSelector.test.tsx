/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import { render, cleanup } from "react-testing-library";

import { HierarchyBuilder, initialize, terminate } from "@bentley/presentation-testing";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Ruleset } from "@bentley/presentation-common";
import { Presentation } from "@bentley/presentation-frontend";

import TestUtils from "../TestUtils";
import { ModelSelectorWidget, ModelSelectorWidgetControl, WidgetProps, WidgetDef, ConfigurableUiControlType } from "../../ui-framework";
import { ModelSelectorDataProvider } from "../../ui-framework/pickers/ModelSelector/ModelSelectorDefinitions";

describe("ModelSelector", () => {

  const testIModelPath = "src/test/test-data/Properties_60InstancesWithUrl2.ibim";
  let imodel: IModelConnection;
  let hierarchyBuilder: HierarchyBuilder;

  before(async () => {
    await TestUtils.initializeUiFramework();
    initialize();
  });

  after(() => {
    terminate();
    TestUtils.terminateUiFramework();
  });

  beforeEach(async () => {
    imodel = await IModelConnection.openSnapshot(testIModelPath);
    hierarchyBuilder = new HierarchyBuilder(imodel);
  });

  afterEach(async () => {
    await imodel.closeSnapshot();
  });

  describe("Model", () => {

    let ruleset: Ruleset;

    beforeEach(() => {
      ruleset = require("../../../rulesets/Models");
    });

    it("generates correct models' hierarchy", async () => {
      const builder = new HierarchyBuilder(imodel);
      const hierarchy = await builder.createHierarchy(ruleset);
      expect(hierarchy).to.matchSnapshot();
    });

  });

  describe("Category", () => {

    let ruleset: Ruleset;

    beforeEach(() => {
      ruleset = require("../../../rulesets/Categories");
    });

    it("generates empty hierarchy when 'ViewType' ruleset variable is not set", async () => {
      const hierarchy = await hierarchyBuilder.createHierarchy(ruleset);
      expect(hierarchy.length).to.eq(0);
    });

    it("generates correct spatial categories' hierarchy", async () => {
      await Presentation.presentation.vars(ruleset.id).setString("ViewType", "3d");
      const hierarchy = await hierarchyBuilder.createHierarchy(ruleset);
      expect(hierarchy).to.matchSnapshot();
    });

    it("generates correct drawing categories' hierarchy", async () => {
      await Presentation.presentation.vars(ruleset.id).setString("ViewType", "2d");
      const hierarchy = await hierarchyBuilder.createHierarchy(ruleset);
      expect(hierarchy).to.matchSnapshot();
    });

  });

  describe("ModelSelectorWidget", () => {
    afterEach(cleanup);

    it("should render", async () => {
      const component = render(<ModelSelectorWidget iModelConnection={imodel} />);
      const widget = component.getByTestId("model-selector-widget");
      expect(widget).to.exist;
    });
  });

  describe("ModelSelectorWidgetControl", () => {
    const widgetProps: WidgetProps = {
      id: "test-widget",
      classId: ModelSelectorWidgetControl,
      applicationData: { iModelConnection: imodel },
    };

    it("widgetDef and getWidgetControl", () => {
      const widgetDef: WidgetDef = new WidgetDef(widgetProps);
      const widgetControl = widgetDef.getWidgetControl(ConfigurableUiControlType.Widget);
      expect(widgetControl).to.not.be.undefined;
    });
  });

  describe("ModelSelectorDataProvider", () => {
    it("API should return correct values", async () => {
      const rulesetId = "Models";
      const dataProvider = new ModelSelectorDataProvider(imodel, rulesetId);
      expect(dataProvider.rulesetId).to.eq(rulesetId);
      expect(dataProvider.imodel).to.eq(imodel);

      // const paths =
      await dataProvider.getFilteredNodePaths("");
      // console.log("Paths: " + paths); // tslint:disable-line: no-console
      // console.log("======="); // tslint:disable-line: no-console

      // const nodes =
      await dataProvider.getNodes();
      // console.log("Nodes: " + nodes); // tslint:disable-line: no-console
    });
  });

});

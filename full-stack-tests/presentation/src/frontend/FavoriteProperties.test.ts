/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { DefaultContentDisplayTypes, Descriptor, KeySet, Ruleset } from "@itwin/presentation-common";
import { TestIModelConnection } from "../IModelSetupUtils.js";
import { initialize, terminate } from "../IntegrationTests.js";
import { IModelConnection } from "@itwin/core-frontend";
import { FavoritePropertiesScope, Presentation } from "@itwin/presentation-frontend";
import { getFieldByLabel } from "../Utils.js";

describe("Favorite properties", () => {
  const ruleset: Ruleset = {
    id: "ruleset",
    rules: [
      {
        ruleType: "Content",
        specifications: [{ specType: "SelectedNodeInstances" }],
      },
    ],
  };

  let imodel: IModelConnection;
  function openIModel() {
    imodel = TestIModelConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
    expect(imodel).to.not.be.null;
  }

  before(async () => {
    await initialize();
    openIModel();
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("favoriting different types of properties", () => {
    beforeEach(async () => {
      // note: Presentation is initialized without client services, so favorite properties are stored locally - clearing
      // them doesn't affect what's stored in user settings service
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.Global);
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.ITwin);
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.IModel);
    });

    it("favorites direct property", async () => {
      const descriptor = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]),
      });
      const field = getFieldByLabel(descriptor!.fields, "Country");
      expect(await Presentation.favoriteProperties.hasAsync(field, imodel, FavoritePropertiesScope.Global)).to.be.false;

      await Presentation.favoriteProperties.add(field, imodel, FavoritePropertiesScope.Global);
      expect(await Presentation.favoriteProperties.hasAsync(field, imodel, FavoritePropertiesScope.Global)).to.be.true;
    });

    it("favorites nested content field", async () => {
      const descriptor = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]),
      });
      const field = getFieldByLabel(descriptor!.fields, "area");
      expect(await Presentation.favoriteProperties.hasAsync(field, imodel, FavoritePropertiesScope.Global)).to.be.false;

      await Presentation.favoriteProperties.add(field, imodel, FavoritePropertiesScope.Global);
      expect(await Presentation.favoriteProperties.hasAsync(field, imodel, FavoritePropertiesScope.Global)).to.be.true;
    });

    it("favorites common properties of different element types", async () => {
      const descriptor1 = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet([{ className: "Generic:PhysicalObject", id: "0x74" }]),
      });
      const field1 = getFieldByLabel(descriptor1!.fields, "Model");
      await Presentation.favoriteProperties.add(field1, imodel, FavoritePropertiesScope.Global);
      expect(await Presentation.favoriteProperties.hasAsync(field1, imodel, FavoritePropertiesScope.Global)).to.be.true;

      // verify the same property is now in favorites group when requesting content for another type of element
      const descriptor2 = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x38" }]),
      });
      const field2 = getFieldByLabel(descriptor2!.fields, "Model");
      expect(await Presentation.favoriteProperties.hasAsync(field2, imodel, FavoritePropertiesScope.Global)).to.be.true;
    });
  });

  describe("ordering", () => {
    beforeEach(async () => {
      // note: Presentation is initialized without client services, so favorite properties are stored locally - clearing
      // them doesn't affect what's stored in user settings service
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.Global);
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.ITwin);
      await Presentation.favoriteProperties.clear(imodel, FavoritePropertiesScope.IModel);
    });

    const makeFieldFavorite = async (descriptor: Descriptor, fieldLabel: string) => {
      const field = getFieldByLabel(descriptor.fields, fieldLabel);
      await Presentation.favoriteProperties.add(field, imodel, FavoritePropertiesScope.Global);
      return field;
    };

    it("moves a field to the top", async () => {
      const descriptor = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet([{ className: "PCJ_TestSchema:TestClass", id: "0x65" }]),
      });
      const fields = await Promise.all([
        makeFieldFavorite(descriptor!, "Model"),
        makeFieldFavorite(descriptor!, "Category"),
      ]);
      expect((await Presentation.favoriteProperties.sortFieldsAsync(imodel, fields)).map((f) => f.label)).to.deep.equal(["Model", "Category"]);

      await Presentation.favoriteProperties.changeFieldPriority(
        imodel,
        fields[1],
        undefined,
        fields,
      );
      expect((await Presentation.favoriteProperties.sortFieldsAsync(imodel, fields)).map((f) => f.label)).to.deep.equal(["Category", "Model"]);
    });

    it("keeps the logical order of non-visible fields when there are relevant fields", async () => {
      const multiElementDescriptor = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet([
          { className: "PCJ_TestSchema:TestClass", id: "0x65" },
          { className: "Generic:PhysicalObject", id: "0x74" },
        ]),
      });
      const multiElementFields = await Promise.all([
        makeFieldFavorite(multiElementDescriptor!, "Code"),
        makeFieldFavorite(multiElementDescriptor!, "area"),
        makeFieldFavorite(multiElementDescriptor!, "Model"), // `Model` is relevant for property `area`
      ]);
      expect((await Presentation.favoriteProperties.sortFieldsAsync(imodel, multiElementFields)).map((f) => f.label)).to.deep.equal(["Code", "area", "Model"]);

      const singleElementDescriptor = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet([
          { className: "PCJ_TestSchema:TestClass", id: "0x65" }, // element without `area` property
        ]),
      });
      const singleElementFields = await Promise.all([
        makeFieldFavorite(singleElementDescriptor!, "Code"),
        makeFieldFavorite(singleElementDescriptor!, "Model"),
      ]);
      await Presentation.favoriteProperties.changeFieldPriority(
        imodel,
        singleElementFields[0],
        singleElementFields[1],
        singleElementFields,
      );
      expect((await Presentation.favoriteProperties.sortFieldsAsync(imodel, multiElementFields)).map((f) => f.label)).to.deep.equal(["area", "Model", "Code"]);
    });

    it("keeps the logical order of non-visible fields when there are no relevant fields", async () => {
      const multiElementDescriptor = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet([
          { className: "PCJ_TestSchema:TestClass", id: "0x65" },
          { className: "Generic:PhysicalObject", id: "0x74" },
        ]),
      });
      const multiElementFields = await Promise.all([
        makeFieldFavorite(multiElementDescriptor!, "Code"),
        makeFieldFavorite(multiElementDescriptor!, "area"),
        makeFieldFavorite(multiElementDescriptor!, "Country"), // `Country` is irrelevant for property `area`
      ]);
      expect((await Presentation.favoriteProperties.sortFieldsAsync(imodel, multiElementFields)).map((f) => f.label)).to.deep.equal(["Code", "area", "Country"]);

      const singleElementDescriptor = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: ruleset,
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet([
          { className: "PCJ_TestSchema:TestClass", id: "0x65" }, // element without `area` property
        ]),
      });
      const singleElementFields = await Promise.all([
        makeFieldFavorite(singleElementDescriptor!, "Code"),
        makeFieldFavorite(singleElementDescriptor!, "Country"),
      ]);

      await Presentation.favoriteProperties.changeFieldPriority(
        imodel,
        singleElementFields[0],
        singleElementFields[1],
        singleElementFields,
      );
      expect((await Presentation.favoriteProperties.sortFieldsAsync(imodel, multiElementFields)).map((f) => f.label)).to.deep.equal(["Country", "Code", "area"]);
    });
  });
});

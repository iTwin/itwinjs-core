/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "@bentley/presentation-frontend/lib/test/_helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as faker from "faker";
import * as path from "path";
import * as sinon from "sinon";
import { BeEvent, Guid } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { I18N } from "@bentley/imodeljs-i18n";
import {
  ArrayTypeDescription, CategoryDescription, Content, ContentFlags, Descriptor, Field, Item, NestedContentField, NestedContentValue,
  PresentationError, PropertiesField, Property, PropertyValueFormat, RegisteredRuleset, StructTypeDescription, ValuesDictionary,
} from "@bentley/presentation-common";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import {
  createRandomCategory, createRandomDescriptor, createRandomECClassInfo, createRandomECInstanceKey, createRandomNestedContentField,
  createRandomPrimitiveField, createRandomPrimitiveTypeDescription, createRandomPropertiesField, createRandomRelationshipPath,
} from "@bentley/presentation-common/lib/test/_helpers/random";
import {
  FavoritePropertiesManager, FavoritePropertiesScope, Presentation, PresentationManager, RulesetManager,
} from "@bentley/presentation-frontend";
import { PropertyRecord } from "@bentley/ui-abstract";
import { CacheInvalidationProps } from "../../presentation-components/common/ContentDataProvider";
import { initializeLocalization } from "../../presentation-components/common/Utils";
import { PresentationPropertyDataProvider } from "../../presentation-components/propertygrid/DataProvider";
import { mockPresentationManager } from "../_helpers/UiComponents";

const favoritesCategoryName = "Favorite";
/**
 * This is just a helper class to provide public access to
 * protected methods of TableDataProvider
 */
class Provider extends PresentationPropertyDataProvider {
  public invalidateCache(props: CacheInvalidationProps) { super.invalidateCache(props); }
  public shouldConfigureContentDescriptor() { return super.shouldConfigureContentDescriptor(); }
  public isFieldHidden(field: Field) { return super.isFieldHidden(field); }
  public getDescriptorOverrides() { return super.getDescriptorOverrides(); }
  public sortCategories(categories: CategoryDescription[]) { return super.sortCategories(categories); }
  public isFieldFavorite!: (field: Field) => boolean;
  public sortFields!: (category: CategoryDescription, fields: Field[]) => void;
}

describe("PropertyDataProvider", () => {

  let rulesetId: string;
  let provider: Provider;
  let rulesetsManagerMock: moq.IMock<RulesetManager>;
  let presentationManagerMock: moq.IMock<PresentationManager>;
  let favoritePropertiesManagerMock: moq.IMock<FavoritePropertiesManager>;
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  before(() => {
    rulesetId = faker.random.word();
  });

  beforeEach(async () => {
    const mocks = mockPresentationManager();
    rulesetsManagerMock = mocks.rulesetsManager;
    presentationManagerMock = mocks.presentationManager;
    Presentation.setPresentationManager(presentationManagerMock.object);

    favoritePropertiesManagerMock = moq.Mock.ofType<FavoritePropertiesManager>();
    favoritePropertiesManagerMock.setup((x) => x.onFavoritesChanged).returns(() => moq.Mock.ofType<BeEvent<() => void>>().object);

    Presentation.setPresentationManager(presentationManagerMock.object);
    Presentation.setFavoritePropertiesManager(favoritePropertiesManagerMock.object);
    Presentation.setI18nManager(new I18N("", {
      urlTemplate: `file://${path.resolve("public/locales")}/{{lng}}/{{ns}}.json`,
    }));
    await initializeLocalization();

    provider = new Provider({ imodel: imodelMock.object, ruleset: rulesetId });
  });

  afterEach(() => {
    Presentation.terminate();
  });

  describe("constructor", () => {

    it("sets `includeFieldsWithNoValues` to true", () => {
      expect(provider.includeFieldsWithNoValues).to.be.true;
    });

    it("sets `includeFieldsWithCompositeValues` to true", () => {
      expect(provider.includeFieldsWithCompositeValues).to.be.true;
    });

    it("subscribes to `Presentation.favoriteProperties.onFavoritesChanged` to invalidate cache", () => {
      const onFavoritesChanged = new BeEvent<() => void>();
      favoritePropertiesManagerMock.setup((x) => x.onFavoritesChanged).returns(() => onFavoritesChanged);
      provider = new Provider({ imodel: imodelMock.object, ruleset: rulesetId });

      const s = sinon.spy(provider, "invalidateCache");
      onFavoritesChanged.raiseEvent();
      expect(s).to.be.calledOnce;
    });

  });

  describe("dispose", () => {

    it("unsubscribes from `Presentation.favoriteProperties.onFavoritesChanged` event", () => {
      const onFavoritesChanged = new BeEvent<() => void>();
      favoritePropertiesManagerMock.setup((x) => x.onFavoritesChanged).returns(() => onFavoritesChanged);
      provider = new Provider({ imodel: imodelMock.object, ruleset: rulesetId });

      expect(onFavoritesChanged.numberOfListeners).to.eq(1);
      provider.dispose();
      expect(onFavoritesChanged.numberOfListeners).to.eq(0);
    });

  });

  describe("invalidateCache", () => {

    it("raises onDataChanged event", () => {
      const s = sinon.spy(provider.onDataChanged, "raiseEvent");
      provider.invalidateCache({});
      expect(s).to.be.calledOnce;
    });

  });

  describe("shouldConfigureContentDescriptor", () => {

    it("return false", () => {
      expect(provider.shouldConfigureContentDescriptor()).to.be.false;
    });

  });

  describe("getDescriptorOverrides", () => {

    it("should have `ShowLabels` and `MergeResults` flags", () => {
      const flags = provider.getDescriptorOverrides().contentFlags!;
      expect(flags & (ContentFlags.MergeResults | ContentFlags.ShowLabels)).to.not.eq(0);
    });

  });

  describe("includeFieldsWithNoValues", () => {

    it("invalidates cache when setting to different value", () => {
      const invalidateCacheMock = moq.Mock.ofInstance(provider.invalidateCache);
      provider.invalidateCache = invalidateCacheMock.object;
      provider.includeFieldsWithNoValues = !provider.includeFieldsWithNoValues;
      invalidateCacheMock.verify((x) => x({ content: true }), moq.Times.once());
    });

    it("doesn't invalidate cache when setting to same value", () => {
      const invalidateCacheMock = moq.Mock.ofInstance(provider.invalidateCache);
      provider.invalidateCache = invalidateCacheMock.object;
      provider.includeFieldsWithNoValues = provider.includeFieldsWithNoValues;
      invalidateCacheMock.verify((x) => x({ content: true }), moq.Times.never());
    });

  });

  describe("includeFieldsWithCompositeValues", () => {

    it("invalidates cache when setting to different value", () => {
      const invalidateCacheMock = moq.Mock.ofInstance(provider.invalidateCache);
      provider.invalidateCache = invalidateCacheMock.object;
      provider.includeFieldsWithCompositeValues = !provider.includeFieldsWithCompositeValues;
      invalidateCacheMock.verify((x) => x({ content: true }), moq.Times.once());
    });

    it("doesn't invalidate cache when setting to same value", () => {
      const invalidateCacheMock = moq.Mock.ofInstance(provider.invalidateCache);
      provider.invalidateCache = invalidateCacheMock.object;
      provider.includeFieldsWithCompositeValues = provider.includeFieldsWithCompositeValues;
      invalidateCacheMock.verify((x) => x({ content: true }), moq.Times.never());
    });

  });

  describe("isFieldFavorite", () => {

    let projectId: string;
    let imodelId: string;

    before(() => {
      projectId = "project-id";
      imodelId = "imodel-id";
      imodelMock.setup((x) => x.iModelId).returns(() => imodelId);
      imodelMock.setup((x) => x.contextId).returns(() => projectId);

      favoritePropertiesManagerMock.setup((x) => x.has(moq.It.isAny(), imodelMock.object, moq.It.isAny())).returns(() => false);
    });

    it("calls FavoritePropertiesManager", () => {
      provider = new Provider({ imodel: imodelMock.object, ruleset: rulesetId });

      const field = createRandomPropertiesField();
      provider.isFieldFavorite(field);
      favoritePropertiesManagerMock.verify((x) => x.has(field, imodelMock.object, FavoritePropertiesScope.IModel), moq.Times.once());
    });

  });

  describe("sortCategories", () => {

    it("sorts categories by priority", () => {
      const categories = [0, 1, 2].map(() => createRandomCategory());
      categories[0].priority = 2;
      categories[1].priority = 3;
      categories[2].priority = 1;
      provider.sortCategories(categories);
      expect(categories[0].priority).to.eq(3);
      expect(categories[1].priority).to.eq(2);
      expect(categories[2].priority).to.eq(1);
    });

  });

  describe("sortFields", () => {

    it("sorts fields by priority", () => {
      const fields = [0, 1, 2].map(() => createRandomPrimitiveField());
      fields[0].priority = 2;
      fields[1].priority = 3;
      fields[2].priority = 1;
      provider.sortFields(createRandomCategory(), fields);
      expect(fields[0].priority).to.eq(3);
      expect(fields[1].priority).to.eq(2);
      expect(fields[2].priority).to.eq(1);
    });

  });

  describe("getData", () => {

    const createPrimitiveField = createRandomPrimitiveField;

    const createArrayField = () => {
      const property: Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const typeDescription: ArrayTypeDescription = {
        valueFormat: PropertyValueFormat.Array,
        typeName: faker.random.word(),
        memberType: createRandomPrimitiveTypeDescription(),
      };
      return new PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), typeDescription, faker.random.boolean(),
        faker.random.number(), [property]);
    };

    const createStructField = () => {
      const property: Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const typeDescription: StructTypeDescription = {
        valueFormat: PropertyValueFormat.Struct,
        typeName: faker.random.word(),
        members: [{
          name: faker.random.word(),
          label: faker.random.words(),
          type: createRandomPrimitiveTypeDescription(),
        }],
      };
      return new PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), typeDescription, faker.random.boolean(),
        faker.random.number(), [property]);
    };

    it("registers default ruleset once if `rulesetId` not specified when creating the provider", async () => {
      provider = new Provider({ imodel: imodelMock.object });
      rulesetsManagerMock.setup(async (x) => x.add(moq.It.isAny())).returns(async (x) => new RegisteredRuleset(x, Guid.createValue(), () => { }));

      // verify ruleset is registered on first call
      await provider.getData();
      rulesetsManagerMock.verify(async (x) => x.add(moq.It.isAny()), moq.Times.once());

      // verify ruleset is not registered on subsequent calls on the same provider
      await provider.getData();
      rulesetsManagerMock.verify(async (x) => x.add(moq.It.isAny()), moq.Times.once());

      // verify ruleset is not registered on subsequent calls on different providers
      const provider2 = new Provider({ imodel: imodelMock.object });
      await provider2.getData();
      rulesetsManagerMock.verify(async (x) => x.add(moq.It.isAny()), moq.Times.once());
    });

    it("returns empty data object when receives undefined content", async () => {
      (provider as any).getContent = async () => undefined;
      expect(await provider.getData()).to.deep.eq({
        label: PropertyRecord.fromString("", "label"),
        categories: [],
        records: {},
      });
    });

    it("returns empty data object when receives content with no values", async () => {
      (provider as any).getContent = async () => new Content(createRandomDescriptor(), []);
      expect(await provider.getData()).to.deep.eq({
        label: PropertyRecord.fromString("", "label"),
        categories: [],
        records: {},
      });
    });

    function runAllTestCases(name: string, setup: () => void) {
      describe(name, () => {

        beforeEach(() => {
          setup();
        });

        it("handles records with no values", async () => {
          const descriptor = createRandomDescriptor(undefined, [createPrimitiveField()]);
          const values: ValuesDictionary<any> = {};
          const displayValues: ValuesDictionary<any> = {};
          const record = new Item([createRandomECInstanceKey()],
            faker.random.words(), faker.random.word(), createRandomECClassInfo(), values, displayValues, []);
          (provider as any).getContent = async () => new Content(descriptor, [record]);
          expect(await provider.getData()).to.matchSnapshot();
        });

        it("returns primitive property data", async () => {
          const descriptor = createRandomDescriptor(undefined, [createPrimitiveField()]);
          const values: ValuesDictionary<any> = {};
          const displayValues: ValuesDictionary<any> = {};
          descriptor.fields.forEach((field) => {
            values[field.name] = faker.random.word();
            displayValues[field.name] = faker.random.words();
          });
          const record = new Item([createRandomECInstanceKey()],
            faker.random.words(), faker.random.word(), createRandomECClassInfo(), values, displayValues, []);
          (provider as any).getContent = async () => new Content(descriptor, [record]);
          expect(await provider.getData()).to.matchSnapshot();
        });

        it("returns array property data", async () => {
          const field = createArrayField();
          const descriptor = createRandomDescriptor(undefined, [field]);
          const values = {
            [field.name]: ["some value 1", "some value 2"],
          };
          const displayValues = {
            [field.name]: ["some display value 1", "some display value 2"],
          };
          const record = new Item([createRandomECInstanceKey()],
            faker.random.words(), faker.random.word(), createRandomECClassInfo(), values, displayValues, []);
          (provider as any).getContent = async () => new Content(descriptor, [record]);
          expect(await provider.getData()).to.matchSnapshot();
        });

        it("returns struct property data", async () => {
          const field = createStructField();
          const descriptor = createRandomDescriptor(undefined, [field]);
          const values = {
            [field.name]: {
              [(field.type as StructTypeDescription).members[0].name]: "some value",
            },
          };
          const displayValues = {
            [field.name]: {
              [(field.type as StructTypeDescription).members[0].name]: "some display value",
            },
          };
          const record = new Item([createRandomECInstanceKey()],
            faker.random.words(), faker.random.word(), createRandomECClassInfo(), values, displayValues, []);
          (provider as any).getContent = async () => new Content(descriptor, [record]);
          expect(await provider.getData()).to.matchSnapshot();
        });

        describe("nested content handling", () => {

          let descriptor: Descriptor;
          let categories: CategoryDescription[];
          let field1: NestedContentField;
          let field2: Field;
          beforeEach(() => {
            categories = [createRandomCategory("top-1"), createRandomCategory("top-2"), createRandomCategory("nested-1-1")];
            categories[2].parent = categories[0];

            const nestedFields = [
              createRandomPrimitiveField(categories[0], "nested 1"),
              createRandomPrimitiveField(categories[0], "nested 2"),
              createRandomPrimitiveField(categories[2], "nested 3"),
            ];

            field1 = new NestedContentField(categories[0], "nested content field",
              "Nested Content", createRandomPrimitiveTypeDescription(), faker.random.boolean(),
              faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1),
              nestedFields, undefined, faker.random.boolean());
            field1.rebuildParentship();
            field2 = createRandomPrimitiveField(categories[0], "primitive");

            descriptor = createRandomDescriptor(undefined, [field1, field2], categories);
          });

          it("returns nested content with multiple nested records", async () => {
            const values = {
              [field1.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }, {
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }] as NestedContentValue[],
              [field2.name]: faker.random.word(),
            };
            const displayValues = {
              [field1.name]: undefined,
              [field2.name]: faker.random.words(),
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

          it("returns nested content with multiple nested records when there's only one record in category", async () => {
            descriptor = createRandomDescriptor(undefined, [field1]);
            const values = {
              [field1.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }, {
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }] as NestedContentValue[],
            };
            const displayValues = {
              [field1.name]: undefined,
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

          it("returns nested content with single nested record", async () => {
            const values = {
              [field1.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }] as NestedContentValue[],
              [field2.name]: faker.random.word(),
            };
            const displayValues = {
              [field1.name]: undefined,
              [field2.name]: faker.random.words(),
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

          it("returns nested content with single nested record when there's only one record in category", async () => {
            descriptor = createRandomDescriptor(undefined, [field1]);
            const values = {
              [field1.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }] as NestedContentValue[],
            };
            const displayValues = {
              [field1.name]: undefined,
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

          it("returns nested content with single nested record as a list of struct member records when there's only one record in category", async () => {
            descriptor = createRandomDescriptor(undefined, [field1]);
            const values = {
              [field1.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }] as NestedContentValue[],
            };
            const displayValues = {
              [field1.name]: undefined,
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

          it("returns empty nested content for nested content with no values", async () => {
            // set up descriptor
            categories = [createRandomCategory("category")];
            const rootField = new NestedContentField(categories[0], "root",
              "root", createRandomPrimitiveTypeDescription(), faker.random.boolean(),
              faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1),
              [
                createRandomPrimitiveField(categories[0], "nested primitive"),
              ], undefined, faker.random.boolean());
            rootField.rebuildParentship();
            descriptor = createRandomDescriptor(undefined, [rootField], categories);

            // set up the content item
            const values = {
              [rootField.name]: [],
            };
            const displayValues = {
              [rootField.name]: undefined,
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);

            // act
            const data = await provider.getData();

            // verify
            expect(data.categories.length).to.eq(0);
            expect(data.records.hasOwnProperty("category")).to.be.false;
          });

          it("returns nothing for nested content with no values when there's only one record in category", async () => {
            descriptor = createRandomDescriptor(undefined, [field1]);
            const values = {
              [field1.name]: [] as NestedContentValue[],
            };
            const displayValues = {
              [field1.name]: undefined,
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

          it("returns nested content in a separate category when it's categorized", async () => {
            field1.nestedFields[0].category = createRandomCategory("custom");
            const values = {
              [field1.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }] as NestedContentValue[],
              [field2.name]: faker.random.word(),
            };
            const displayValues = {
              [field1.name]: undefined,
              [field2.name]: faker.random.words(),
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

          it("returns favorite nested content in a separate category when it's categorized", async () => {
            field1.nestedFields[0].category = createRandomCategory("custom");
            // eslint-disable-next-line deprecation/deprecation
            favoritePropertiesManagerMock.setup((x) => x.has(moq.It.isObjectWith<Field>({ name: field1.nestedFields[0].name }), moq.It.isAny(), moq.It.isAny())).returns(() => true);
            const values = {
              [field1.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }] as NestedContentValue[],
              [field2.name]: faker.random.word(),
            };
            const displayValues = {
              [field1.name]: undefined,
              [field2.name]: faker.random.words(),
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

          it("removes nested content record from category when the only nested field is moved into a separate category and there are other records in nested content record category", async () => {
            field1.nestedFields[0].category = createRandomCategory("custom");
            field1.nestedFields.splice(1);
            const values = {
              [field1.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }] as NestedContentValue[],
              [field2.name]: faker.random.word(),
            };
            const displayValues = {
              [field1.name]: undefined,
              [field2.name]: faker.random.words(),
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

          it("removes nested content record from category when the only nested field is moved into a separate category and nested content record is the only record in category", async () => {
            field1.nestedFields[0].category = createRandomCategory("custom");
            field1.nestedFields.splice(1);
            descriptor = createRandomDescriptor(undefined, [field1]);
            const values = {
              [field1.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }] as NestedContentValue[],
            };
            const displayValues = {
              [field1.name]: undefined,
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

          it("removes nested content record from struct record when the only nested field is moved into a separate category and nested content record is the only record in struct", async () => {
            // set up descriptor
            categories = [createRandomCategory("top"), createRandomCategory("nested")];
            categories[1].parent = categories[0];
            const rootField = new NestedContentField(categories[0], "root",
              "root", createRandomPrimitiveTypeDescription(), faker.random.boolean(),
              faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1),
              [
                createRandomPrimitiveField(categories[0], "nested primitive"),
                new NestedContentField(categories[0], "deeply nested",
                  "deeply nested", createRandomPrimitiveTypeDescription(), faker.random.boolean(),
                  faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1),
                  [
                    createRandomPrimitiveField(categories[1], "deeply nested primitive"),
                  ], undefined, faker.random.boolean()),
              ], undefined, faker.random.boolean());
            rootField.rebuildParentship();
            descriptor = createRandomDescriptor(undefined, [rootField], categories);

            // set up the content item
            const values = {
              [rootField.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [rootField.nestedFields[0].name]: "p1",
                  [rootField.nestedFields[1].name]: [{
                    primaryKeys: [createRandomECInstanceKey()],
                    values: {
                      [(rootField.nestedFields[1] as NestedContentField).nestedFields[0].name]: "p2",
                    },
                    displayValues: {
                      [(rootField.nestedFields[1] as NestedContentField).nestedFields[0].name]: "p2",
                    },
                    mergedFieldNames: [],
                  }],
                },
                displayValues: {
                  [rootField.nestedFields[0].name]: "p1",
                  [rootField.nestedFields[1].name]: [{
                    displayValues: {
                      [(rootField.nestedFields[1] as NestedContentField).nestedFields[0].name]: "p2",
                    },
                  }],
                },
                mergedFieldNames: [],
              }],
            };
            const displayValues = {
              [rootField.name]: undefined,
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);

            // act
            const data = await provider.getData();

            // verify
            if (provider.isNestedPropertyCategoryGroupingEnabled) {
              expect(data.categories.length).to.eq(1);
              expect(data.categories).to.containSubset([{ name: "top", childCategories: [{ name: "nested" }] }]);
            } else {
              expect(data.categories.length).to.eq(2);
              expect(data.categories).to.containSubset([{ name: "top" }, { name: "nested" }]);
            }
            expect(data.records.top.length).to.eq(1);
            expect(data.records.top).to.containSubset([{
              property: { displayLabel: rootField.nestedFields[0].label },
              value: { value: "p1" },
            }]);
            expect(data.records.nested.length).to.eq(1);
            expect(data.records.nested).to.containSubset([{
              property: { displayLabel: (rootField.nestedFields[1] as NestedContentField).nestedFields[0].label },
              value: { value: "p2" },
            }]);
          });

          it("removes nested content record when the nested field is categorized but there's no content", async () => {
            field1.nestedFields[0].category = createRandomCategory("custom");
            descriptor = createRandomDescriptor(undefined, [field1]);
            const values = {
              [field1.name]: [] as NestedContentValue[],
            };
            const displayValues = {
              [field1.name]: undefined,
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

          it("returns nested content with multiple nested categorized records", async () => {
            field1.nestedFields[0].category = createRandomCategory("custom");
            descriptor = createRandomDescriptor(undefined, [field1]);
            const values = {
              [field1.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                  [field1.nestedFields[1].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                  [field1.nestedFields[1].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }, {
                primaryKeys: [createRandomECInstanceKey()],
                values: {
                  [field1.nestedFields[0].name]: faker.random.word(),
                  [field1.nestedFields[1].name]: faker.random.word(),
                },
                displayValues: {
                  [field1.nestedFields[0].name]: faker.random.words(),
                  [field1.nestedFields[1].name]: faker.random.words(),
                },
                mergedFieldNames: [],
              }] as NestedContentValue[],
            };
            const displayValues = {
              [field1.name]: undefined,
            };
            const record = new Item([createRandomECInstanceKey()], faker.random.words(),
              faker.random.uuid(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            expect(await provider.getData()).to.matchSnapshot();
          });

        });

        describe("includeFieldsWithNoValues handling", () => {

          beforeEach(() => {
            provider.includeFieldsWithNoValues = false;
          });

          it("doesn't include primitive fields with no values when set", async () => {
            const descriptor = createRandomDescriptor();
            const values: ValuesDictionary<any> = { [descriptor.fields[0].name]: faker.random.word() };
            const displayValues: ValuesDictionary<any> = { [descriptor.fields[0].name]: faker.random.words() };
            const record = new Item([createRandomECInstanceKey()],
              faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            const data = await provider.getData();
            expect(data.categories.length).to.eq(1);
            expect(data.records[data.categories[0].name].length).to.eq(1);
            expect(data.records[data.categories[0].name][0].property.name).to.eq(descriptor.fields[0].name);
          });

          it("doesn't include array fields with no values when set", async () => {
            const fields = [1, 2].map(() => createArrayField());
            const descriptor = createRandomDescriptor(undefined, fields);
            const values: ValuesDictionary<any> = {
              [fields[0].name]: [faker.random.word()],
              [fields[1].name]: [],
            };
            const displayValues: ValuesDictionary<any> = {
              [fields[0].name]: [faker.random.words()],
              [fields[1].name]: [],
            };
            const record = new Item([createRandomECInstanceKey()],
              faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            const data = await provider.getData();
            expect(data.categories.length).to.eq(1);
            expect(data.records[data.categories[0].name].length).to.eq(1);
            expect(data.records[data.categories[0].name][0].property.name).to.eq(descriptor.fields[0].name);
          });

          it("doesn't include struct fields with no values when set", async () => {
            const fields = [1, 2].map(() => createStructField());
            (fields[1].type as StructTypeDescription).members = [];
            const descriptor = createRandomDescriptor(undefined, fields);
            const values: ValuesDictionary<any> = {};
            const displayValues: ValuesDictionary<any> = {};
            fields.forEach((field) => {
              values[field.name] = {};
              displayValues[field.name] = {};
            });
            const record = new Item([createRandomECInstanceKey()],
              faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);
            const data = await provider.getData();
            expect(data.categories.length).to.eq(1);
            expect(data.records[data.categories[0].name].length).to.eq(1);
            expect(data.records[data.categories[0].name][0].property.name).to.eq(descriptor.fields[0].name);
          });

        });

        describe("includeFieldsWithCompositeValues handling", () => {

          beforeEach(() => {
            provider.includeFieldsWithCompositeValues = false;
          });

          it("doesn't include composite fields when set", async () => {
            const primitiveField = createPrimitiveField();
            const arrayField = createArrayField();
            const structField = createStructField();
            const descriptor = createRandomDescriptor(undefined, [primitiveField, arrayField, structField]);
            const values = {
              [primitiveField.name]: faker.random.word(),
              [arrayField.name]: ["some value 1", "some value 2"],
              [(structField.type as StructTypeDescription).members[0].name]: "some value",
            };
            const displayValues = {
              [primitiveField.name]: faker.random.word(),
              [arrayField.name]: ["some display value 1", "some display value 2"],
              [(structField.type as StructTypeDescription).members[0].name]: "some display value",
            };
            const record = new Item([createRandomECInstanceKey()],
              faker.random.words(), faker.random.word(), createRandomECClassInfo(), values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);

            const data = await provider.getData();
            expect(data.categories.length).to.eq(1);
            expect(data.records[data.categories[0].name].length).to.eq(1);
            expect(data.records[data.categories[0].name][0].property.name).to.eq(primitiveField.name);
          });

        });

        describe("favorite properties handling", () => {

          it("makes records favorite according to isFieldFavorite callback", async () => {
            provider.isFieldFavorite = (_field: Field) => true;
            const descriptor = createRandomDescriptor();
            descriptor.fields.forEach((field, index) => {
              field.category = { ...field.category, name: `category_${index}` };
            });
            const values: ValuesDictionary<any> = {};
            const displayValues: ValuesDictionary<any> = {};
            const record = new Item([createRandomECInstanceKey()],
              faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
            (provider as any).getContent = async () => new Content(descriptor, [record]);

            const data = await provider.getData();
            expect(data.categories.length).to.eq(4);
            if (provider.isNestedPropertyCategoryGroupingEnabled) {
              const favoritesCategory = data.categories.find((c) => c.name === favoritesCategoryName)!;
              expect(data.records[favoritesCategory.name]).to.be.undefined;
              expect(favoritesCategory.childCategories?.length).to.eq(3);
              favoritesCategory.childCategories!.forEach((c) => {
                expect(data.records[c.name].length).to.eq(1);
              });
            } else {
              expect(data.records[favoritesCategoryName].length).to.eq(3);
            }
          });

          describe("with nested content", () => {

            it("puts non-struct records of struct fields into favorite category", async () => {
              const categories = [createRandomCategory("primitive"), createRandomCategory("nested")];
              categories[0].parent = categories[1];
              const propertiesField = createRandomPropertiesField(categories[0]);
              const nestedContentField = createRandomNestedContentField([propertiesField], categories[1]);
              nestedContentField.rebuildParentship();
              const descriptor = createRandomDescriptor(undefined, [nestedContentField], categories);

              // eslint-disable-next-line deprecation/deprecation
              favoritePropertiesManagerMock.setup((x) => x.has(moq.It.isObjectWith<Field>({ name: propertiesField.name }), moq.It.isAny(), moq.It.isAny())).returns(() => true);

              const propertyValue: string = faker.random.words(2);
              const nestedContentValue: NestedContentValue[] = [{
                primaryKeys: [],
                values: { [propertiesField.name]: propertyValue },
                displayValues: {},
                mergedFieldNames: [],
              }];

              const values: ValuesDictionary<any> = { [nestedContentField.name]: nestedContentValue };
              const displayValues: ValuesDictionary<any> = {};
              const record = new Item([createRandomECInstanceKey()],
                faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
              (provider as any).getContent = async () => new Content(descriptor, [record]);

              const data = await provider.getData();
              expect(data.categories.length).to.eq(2);
              const favoritesCategory = data.categories.find((c) => c.name === favoritesCategoryName)!;

              if (provider.isNestedPropertyCategoryGroupingEnabled) {
                expect(favoritesCategory.childCategories!.length).to.eq(1);
                expect(favoritesCategory.childCategories![0].label).to.eq("nested");
                expect(favoritesCategory.childCategories![0].childCategories!.length).to.eq(1);
                expect(favoritesCategory.childCategories![0].childCategories![0].label).to.eq("primitive");
                expect(data.records[favoritesCategory.childCategories![0].childCategories![0].name].length).to.eq(1);
                expect(data.records[favoritesCategory.childCategories![0].childCategories![0].name][0].property.displayLabel).to.eq(propertiesField.label);
              } else {
                expect(data.records[favoritesCategory.name].length).to.eq(1);
                expect(data.records[favoritesCategory.name][0].property.displayLabel).to.eq(propertiesField.label);
              }
            });

            it("puts properties field parent record into favorites category if property is merged", async () => {
              const categories = [createRandomCategory("primitive"), createRandomCategory("nested")];
              categories[0].parent = categories[1];
              const propertiesField = createRandomPropertiesField(categories[0]);
              const nestedContentField = createRandomNestedContentField([propertiesField], categories[1]);
              nestedContentField.rebuildParentship();
              const descriptor = createRandomDescriptor(undefined, [nestedContentField], categories);

              // eslint-disable-next-line deprecation/deprecation
              favoritePropertiesManagerMock.setup((x) => x.has(moq.It.isObjectWith<Field>({ name: propertiesField.name }), moq.It.isAny(), moq.It.isAny())).returns(() => true);

              const values: ValuesDictionary<any> = { [nestedContentField.name]: undefined };
              const displayValues: ValuesDictionary<any> = { [nestedContentField.name]: "*** Varies ***" };
              const record = new Item([createRandomECInstanceKey()],
                faker.random.words(), faker.random.word(), undefined, values, displayValues, [nestedContentField.name]);
              (provider as any).getContent = async () => new Content(descriptor, [record]);

              const data = await provider.getData();
              expect(data.categories.length).to.eq(2);
              const favoritesCategory = data.categories.find((c) => c.name === favoritesCategoryName)!;

              if (provider.isNestedPropertyCategoryGroupingEnabled) {
                expect(favoritesCategory.childCategories!.length).to.eq(1);
                expect(favoritesCategory.childCategories![0].label).to.eq("nested");
                expect(data.records[favoritesCategory.childCategories![0].name].length).to.eq(1);
                expect(data.records[favoritesCategory.childCategories![0].name][0].property.displayLabel).to.eq(nestedContentField.label);
              } else {
                expect(data.records[favoritesCategory.name].length).to.eq(1);
                expect(data.records[favoritesCategory.name][0].property.displayLabel).to.be.eq(nestedContentField.label);
              }
            });

            it("doesn't put duplicate records for merged nested content fields that have multiple favorite properties", async () => {
              const categories = [createRandomCategory("primitive"), createRandomCategory("nested")];
              categories[0].parent = categories[1];
              const propertiesField1 = createRandomPropertiesField(categories[0]);
              const propertiesField2 = createRandomPropertiesField(categories[0]);
              const nestedContentField = createRandomNestedContentField([propertiesField1, propertiesField2], categories[1]);
              nestedContentField.rebuildParentship();
              const descriptor = createRandomDescriptor(undefined, [nestedContentField], categories);

              // eslint-disable-next-line deprecation/deprecation
              favoritePropertiesManagerMock.setup((x) => x.has(moq.It.isObjectWith<Field>({ name: propertiesField1.name }), moq.It.isAny(), moq.It.isAny())).returns(() => true);
              // eslint-disable-next-line deprecation/deprecation
              favoritePropertiesManagerMock.setup((x) => x.has(moq.It.isObjectWith<Field>({ name: propertiesField2.name }), moq.It.isAny(), moq.It.isAny())).returns(() => true);

              const values: ValuesDictionary<any> = { [nestedContentField.name]: undefined };
              const displayValues: ValuesDictionary<any> = { [nestedContentField.name]: "*** Varies ***" };
              const record = new Item([createRandomECInstanceKey()],
                faker.random.words(), faker.random.word(), undefined, values, displayValues, [nestedContentField.name]);
              (provider as any).getContent = async () => new Content(descriptor, [record]);

              const data = await provider.getData();
              expect(data.categories.length).to.eq(2);
              const favoritesCategory = data.categories.find((c) => c.name === favoritesCategoryName)!;

              if (provider.isNestedPropertyCategoryGroupingEnabled) {
                expect(favoritesCategory.childCategories!.length).to.eq(1);
                expect(favoritesCategory.childCategories![0].label).to.eq("nested");
                expect(data.records[favoritesCategory.childCategories![0].name].length).to.eq(1);
                expect(data.records[favoritesCategory.childCategories![0].name][0].property.displayLabel).to.eq(nestedContentField.label);
              } else {
                expect(data.records[favoritesCategory.name].length).to.eq(1);
                expect(data.records[favoritesCategory.name][0].property.displayLabel).to.be.eq(nestedContentField.label);
              }
            });

            it("throws if nested field values are not nested content", async () => {
              const category = createRandomCategory();
              const propertiesField1 = createRandomPropertiesField(category);
              const propertiesField2 = createRandomPropertiesField(category);
              const nestedContentField = createRandomNestedContentField([propertiesField1, propertiesField2], category);
              const descriptor = createRandomDescriptor(undefined, [nestedContentField], [category]);

              // eslint-disable-next-line deprecation/deprecation
              favoritePropertiesManagerMock.setup((x) => x.has(moq.It.isObjectWith<Field>({ name: nestedContentField.nestedFields[0].name }), moq.It.isAny(), moq.It.isAny())).returns(() => true);

              const values = {
                [nestedContentField.name]: [{ primaryKeys: [createRandomECInstanceKey()] }],
              };
              const displayValues = {
                [nestedContentField.name]: faker.random.words(),
              };

              const record = new Item([createRandomECInstanceKey()], faker.random.words(),
                faker.random.uuid(), undefined, values, displayValues, []);
              (provider as any).getContent = async () => new Content(descriptor, [record]);
              await expect(provider.getData()).to.eventually.be.rejectedWith(PresentationError, "value should be nested content");
            });

          });

        });

        it("sorts categories according to sortCategories callback", async () => {
          provider.sortCategories = (cats: CategoryDescription[]) => {
            cats.sort((lhs: CategoryDescription, rhs: CategoryDescription): number => {
              if (lhs.label < rhs.label)
                return -1;
              if (lhs.label > rhs.label)
                return 1;
              return 0;
            });
          };
          const descriptor = createRandomDescriptor();
          descriptor.fields[0].category = {
            ...createRandomCategory(),
            priority: 1,
            label: "b",
            parent: {
              ...createRandomCategory(),
              priority: 1,
              label: "bb",
            },
          };
          descriptor.fields[1].category = {
            ...createRandomCategory(),
            priority: 2,
            label: "c",
            parent: {
              ...createRandomCategory(),
              priority: 1,
              label: "aa",
            },
          };
          descriptor.fields[2].category = {
            ...createRandomCategory(),
            priority: 3,
            label: "a",
            parent: descriptor.fields[1].category.parent,
          };

          const values: ValuesDictionary<any> = {};
          const displayValues: ValuesDictionary<any> = {};
          const record = new Item([createRandomECInstanceKey()],
            faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
          (provider as any).getContent = async () => new Content(descriptor, [record]);

          const data = await provider.getData();
          if (provider.isNestedPropertyCategoryGroupingEnabled) {
            expect(data.categories[0].label).to.eq("aa");
            expect(data.categories[0].childCategories![0].label).to.eq("a");
            expect(data.categories[0].childCategories![1].label).to.eq("c");
            expect(data.categories[1].label).to.eq("bb");
            expect(data.categories[1].childCategories![0].label).to.eq("b");
          } else {
            expect(data.categories[0].label).to.eq("a");
            expect(data.categories[1].label).to.eq("b");
            expect(data.categories[2].label).to.eq("c");
          }
        });

        it("sorts records according to sortFields callback", async () => {
          provider.sortFields = (_cat: CategoryDescription, fields: Field[]) => {
            fields.sort((lhs: Field, rhs: Field): number => {
              if (lhs.label < rhs.label)
                return -1;
              if (lhs.label > rhs.label)
                return 1;
              return 0;
            });
          };
          const descriptor = createRandomDescriptor();
          descriptor.fields[0].priority = 1;
          descriptor.fields[0].label = "b";
          descriptor.fields[1].priority = 2;
          descriptor.fields[1].label = "c";
          descriptor.fields[1].category = descriptor.fields[0].category;
          descriptor.fields[2].priority = 3;
          descriptor.fields[2].label = "a";
          descriptor.fields[2].category = descriptor.fields[0].category;

          const values: ValuesDictionary<any> = {};
          const displayValues: ValuesDictionary<any> = {};
          const record = new Item([createRandomECInstanceKey()],
            faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
          (provider as any).getContent = async () => new Content(descriptor, [record]);

          const data = await provider.getData();
          const records = new Array<PropertyRecord>();
          data.categories.forEach((cat) => {
            data.records[cat.name].forEach((rec) => records.push(rec));
          });

          expect(records[0].property.displayLabel).to.eq("a");
          expect(records[1].property.displayLabel).to.eq("b");
          expect(records[2].property.displayLabel).to.eq("c");
        });

        it("hides records according to isFieldHidden callback", async () => {
          provider.isFieldHidden = (_field: Field) => true;
          const descriptor = createRandomDescriptor();
          const values: ValuesDictionary<any> = {};
          const displayValues: ValuesDictionary<any> = {};
          const record = new Item([createRandomECInstanceKey()],
            faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
          (provider as any).getContent = async () => new Content(descriptor, [record]);

          const data = await provider.getData();
          expect(data.categories.length).to.eq(0);
        });

      });
    }

    runAllTestCases("with flat categories", () => provider.isNestedPropertyCategoryGroupingEnabled = false);
    runAllTestCases("with nested categories", () => provider.isNestedPropertyCategoryGroupingEnabled = true);

  });

});

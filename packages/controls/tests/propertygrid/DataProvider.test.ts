/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import * as path from "path";
import { expect, spy } from "chai";
import * as moq from "@helpers/Mocks";
import * as faker from "faker";
import { I18N } from "@bentley/imodeljs-i18n";
import { PropertyRecord } from "@bentley/ui-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ValuesDictionary } from "@bentley/ecpresentation-common";
import * as content from "@bentley/ecpresentation-common/lib/content";
import { ECPresentation } from "@bentley/ecpresentation-frontend";
import ECPresentationManager from "@bentley/ecpresentation-frontend/lib/ECPresentationManager";
import ECPresentationPropertyDataProvider from "@src/propertygrid/DataProvider";
import { CacheInvalidationProps } from "@src/common/ContentDataProvider";
import {
  createRandomDescriptor, createRandomPrimitiveField, createRandomCategory, createRandomPrimitiveTypeDescription,
  createRandomECInstanceKey, createRandomECClassInfo, createRandomRelationshipPath,
} from "@helpers/random";

const favoritesCategoryName = "Favorite";

/**
 * This is just a helper class to provide public access to
 * protected methods of TableDataProvider
 */
class Provider extends ECPresentationPropertyDataProvider {
  public invalidateCache(props: CacheInvalidationProps) { super.invalidateCache(props); }
  public configureContentDescriptor(descriptor: content.Descriptor) { return super.configureContentDescriptor(descriptor); }
  public shouldExcludeFromDescriptor(field: content.Field) { return super.shouldExcludeFromDescriptor(field); }
  public isFieldHidden(field: content.Field) { return super.isFieldHidden(field); }
  public isFieldFavorite(field: content.Field) { return super.isFieldFavorite(field); }
  public sortCategories(categories: content.CategoryDescription[]) { return super.sortCategories(categories); }
  public sortFields(category: content.CategoryDescription, fields: content.Field[]) { return super.sortFields(category, fields); }
}

interface MemoizedCacheSpies {
  getData: any;
}

describe("PropertyDataProvider", () => {

  let rulesetId: string;
  let provider: Provider;
  let memoizedCacheSpies: MemoizedCacheSpies;
  const presentationManagerMock = moq.Mock.ofType<ECPresentationManager>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  before(() => {
    rulesetId = faker.random.word();
    ECPresentation.presentation = presentationManagerMock.object;
    ECPresentation.i18n = new I18N([], "", {
      urlTemplate: `file://${path.resolve("public/locales")}/{{lng}}/{{ns}}.json`,
    });
  });
  beforeEach(() => {
    presentationManagerMock.reset();
    provider = new Provider(imodelMock.object, rulesetId);
    resetMemoizedCacheSpies();
  });

  const resetMemoizedCacheSpies = () => {
    memoizedCacheSpies = {
      getData: spy.on(provider.getData.cache, "clear"),
    };
  };

  describe("constructor", () => {

    it("sets `includeFieldsWithNoValues` to true", () => {
      expect(provider.includeFieldsWithNoValues).to.be.true;
    });

  });

  describe("invalidateCache", () => {

    it("resets memoized data", () => {
      provider.invalidateCache({});
      expect(memoizedCacheSpies.getData).to.be.called();
    });

    it("raises onDataChanged event", () => {
      const s = spy.on(provider.onDataChanged, provider.onDataChanged.raiseEvent.name);
      provider.invalidateCache({});
      expect(s).to.be.called();
    });

  });

  describe("configureContentDescriptor", () => {

    it("adds `showLabels` content flag", () => {
      const source = createRandomDescriptor();
      source.contentFlags = content.ContentFlags.DistinctValues;
      const descriptor = provider.configureContentDescriptor(source);
      expect(descriptor.contentFlags).to.eq(content.ContentFlags.DistinctValues | content.ContentFlags.ShowLabels);
    });

  });

  describe("shouldExcludeFromDescriptor", () => {

    it("returns false if field is not hidden and not favorite", () => {
      provider.isFieldHidden = () => false;
      provider.isFieldFavorite = () => false;
      const field = createRandomPrimitiveField();
      expect(provider.shouldExcludeFromDescriptor(field)).to.be.false;
    });

    it("returns false if field is hidden and favorite", () => {
      provider.isFieldHidden = () => true;
      provider.isFieldFavorite = () => true;
      const field = createRandomPrimitiveField();
      expect(provider.shouldExcludeFromDescriptor(field)).to.be.false;
    });

    it("returns false if field is not hidden and favorite", () => {
      provider.isFieldHidden = () => false;
      provider.isFieldFavorite = () => true;
      const field = createRandomPrimitiveField();
      expect(provider.shouldExcludeFromDescriptor(field)).to.be.false;
    });

    it("returns true if field is hidden and not favorite", () => {
      provider.isFieldHidden = () => true;
      provider.isFieldFavorite = () => false;
      const field = createRandomPrimitiveField();
      expect(provider.shouldExcludeFromDescriptor(field)).to.be.true;
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

  describe("isFieldFavorite", () => {

    it("returns false", () => {
      const field = createRandomPrimitiveField();
      expect(provider.isFieldFavorite(field)).to.be.false;
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
      const property: content.Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const typeDescription: content.ArrayTypeDescription = {
        valueFormat: content.PropertyValueFormat.Array,
        typeName: faker.random.word(),
        memberType: createRandomPrimitiveTypeDescription(),
      };
      return new content.PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), typeDescription, faker.random.boolean(),
        faker.random.number(), [property]);
    };

    const createStructField = () => {
      const property: content.Property = {
        property: {
          classInfo: createRandomECClassInfo(),
          name: faker.random.word(),
          type: faker.database.type(),
        },
        relatedClassPath: [],
      };
      const typeDescription: content.StructTypeDescription = {
        valueFormat: content.PropertyValueFormat.Struct,
        typeName: faker.random.word(),
        members: [{
          name: faker.random.word(),
          label: faker.random.words(),
          type: createRandomPrimitiveTypeDescription(),
        }],
      };
      return new content.PropertiesField(createRandomCategory(), faker.random.word(),
        faker.random.words(), typeDescription, faker.random.boolean(),
        faker.random.number(), [property]);
    };

    it("returns empty data object when receives undefined content", async () => {
      (provider as any).getContent = async () => undefined;
      expect(await provider.getData()).to.deep.eq({
        label: "",
        categories: [],
        records: {},
      });
    });

    it("returns empty data object when receives content with no values", async () => {
      const c: content.Content = {
        descriptor: createRandomDescriptor(),
        contentSet: [],
      };
      (provider as any).getContent = async () => c;
      expect(await provider.getData()).to.deep.eq({
        label: "",
        categories: [],
        records: {},
      });
    });

    it("handles records with no values", async () => {
      const descriptor = createRandomDescriptor();
      descriptor.fields = [createPrimitiveField()];
      const values: ValuesDictionary<any> = {};
      const displayValues: ValuesDictionary<any> = {};
      const record = new content.Item([createRandomECInstanceKey()],
        faker.random.words(), faker.random.word(), createRandomECClassInfo(), values, displayValues, []);
      const c: content.Content = {
        descriptor,
        contentSet: [record],
      };
      (provider as any).getContent = async () => c;
      expect(await provider.getData()).to.matchSnapshot();
    });

    it("returns primitive property data", async () => {
      const descriptor = createRandomDescriptor();
      descriptor.fields = [createPrimitiveField()];
      const values: ValuesDictionary<any> = {};
      const displayValues: ValuesDictionary<any> = {};
      descriptor.fields.forEach((field) => {
        values[field.name] = faker.random.word();
        displayValues[field.name] = faker.random.words();
      });
      const record = new content.Item([createRandomECInstanceKey()],
        faker.random.words(), faker.random.word(), createRandomECClassInfo(), values, displayValues, []);
      const c: content.Content = {
        descriptor,
        contentSet: [record],
      };
      (provider as any).getContent = async () => c;
      expect(await provider.getData()).to.matchSnapshot();
    });

    it("returns array property data", async () => {
      const field = createArrayField();
      const descriptor = createRandomDescriptor();
      descriptor.fields = [field];
      const values = {
        [field.name]: ["some value 1", "some value 2"],
      };
      const displayValues = {
        [field.name]: ["some display value 1", "some display value 2"],
      };
      const record = new content.Item([createRandomECInstanceKey()],
        faker.random.words(), faker.random.word(), createRandomECClassInfo(), values, displayValues, []);
      const c: content.Content = {
        descriptor,
        contentSet: [record],
      };
      (provider as any).getContent = async () => c;
      expect(await provider.getData()).to.matchSnapshot();
    });

    it("returns struct property data", async () => {
      const field = createStructField();
      const descriptor = createRandomDescriptor();
      descriptor.fields = [field];
      const values = {
        [field.name]: {
          [(field.type as content.StructTypeDescription).members[0].name]: "some value",
        },
      };
      const displayValues = {
        [field.name]: {
          [(field.type as content.StructTypeDescription).members[0].name]: "some display value",
        },
      };
      const record = new content.Item([createRandomECInstanceKey()],
        faker.random.words(), faker.random.word(), createRandomECClassInfo(), values, displayValues, []);
      const c: content.Content = {
        descriptor,
        contentSet: [record],
      };
      (provider as any).getContent = async () => c;
      expect(await provider.getData()).to.matchSnapshot();
    });

    describe("nested content handling", () => {

      let descriptor: content.Descriptor;
      let field1: content.NestedContentField;
      let field2: content.Field;
      beforeEach(() => {
        descriptor = createRandomDescriptor();
        field1 = new content.NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1),
          [createRandomPrimitiveField(), createRandomPrimitiveField()]);
        field2 = createRandomPrimitiveField();
        field1.category = field2.category = createRandomCategory();
        descriptor.fields = [field1, field2];
        descriptor.rebuildParentship();
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
          }] as content.NestedContent[],
          [field2.name]: faker.random.word(),
        };
        const displayValues = {
          [field1.name]: undefined,
          [field2.name]: faker.random.words(),
        };
        const record = new content.Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const c: content.Content = {
          descriptor,
          contentSet: [record],
        };
        (provider as any).getContent = async () => c;
        expect(await provider.getData()).to.matchSnapshot();
      });

      it("returns nested content with multiple nested records when there's only one record in caregory", async () => {
        descriptor.fields = [field1];
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
          }] as content.NestedContent[],
          [field2.name]: faker.random.word(),
        };
        const displayValues = {
          [field1.name]: undefined,
          [field2.name]: faker.random.words(),
        };
        const record = new content.Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const c: content.Content = {
          descriptor,
          contentSet: [record],
        };
        (provider as any).getContent = async () => c;
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
          }] as content.NestedContent[],
          [field2.name]: faker.random.word(),
        };
        const displayValues = {
          [field1.name]: undefined,
          [field2.name]: faker.random.words(),
        };
        const record = new content.Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const c: content.Content = {
          descriptor,
          contentSet: [record],
        };
        (provider as any).getContent = async () => c;
        expect(await provider.getData()).to.matchSnapshot();
      });

      it("returns nested content with single nested record when there's only one record in category", async () => {
        descriptor.fields = [field1];
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
          }] as content.NestedContent[],
        };
        const displayValues = {
          [field1.name]: undefined,
        };
        const record = new content.Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const c: content.Content = {
          descriptor,
          contentSet: [record],
        };
        (provider as any).getContent = async () => c;
        expect(await provider.getData()).to.matchSnapshot();
      });

      it("returns nested content with single nested record as a list of struct member records when there's only one record in category", async () => {
        descriptor.fields = [field1];
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
          }] as content.NestedContent[],
        };
        const displayValues = {
          [field1.name]: undefined,
        };
        const record = new content.Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const c: content.Content = {
          descriptor,
          contentSet: [record],
        };
        (provider as any).getContent = async () => c;
        expect(await provider.getData()).to.matchSnapshot();
      });

      it("returns empty nested content for nested content with no values", async () => {
        const values = {
          [field1.name]: [] as content.NestedContent[],
          [field2.name]: faker.random.word(),
        };
        const displayValues = {
          [field1.name]: undefined,
          [field2.name]: faker.random.words(),
        };
        const record = new content.Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const c: content.Content = {
          descriptor,
          contentSet: [record],
        };
        (provider as any).getContent = async () => c;
        expect(await provider.getData()).to.matchSnapshot();
      });

      it("returns nothing for nested content with no values when there's only one record in category", async () => {
        descriptor.fields = [field1];
        const values = {
          [field1.name]: [] as content.NestedContent[],
        };
        const displayValues = {
          [field1.name]: undefined,
        };
        const record = new content.Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const c: content.Content = {
          descriptor,
          contentSet: [record],
        };
        (provider as any).getContent = async () => c;
        expect(await provider.getData()).to.matchSnapshot();
      });

      it("favorites nested content records", async () => {
        const field111 = createPrimitiveField();
        const field112 = createPrimitiveField();
        const field11 = new content.NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1),
          [field111, field112]);
        const field12 = createPrimitiveField();
        field1 = new content.NestedContentField(createRandomCategory(), faker.random.word(),
          faker.random.words(), createRandomPrimitiveTypeDescription(), faker.random.boolean(),
          faker.random.number(), createRandomECClassInfo(), createRandomRelationshipPath(1),
          [field11, field12]);
        field2 = createPrimitiveField();
        field2.category = field1.category;
        descriptor.fields = [field1, field2];
        descriptor.rebuildParentship();

        const values = {
          [field1.name]: [{
            primaryKeys: [createRandomECInstanceKey()],
            values: {
              [field11.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                mergedFieldNames: [],
                values: {
                  [field111.name]: faker.random.word(),
                  [field112.name]: faker.random.word(),
                },
                displayValues: {
                  [field111.name]: faker.random.words(),
                  [field112.name]: faker.random.words(),
                },
              }] as content.NestedContent[],
              [field12.name]: faker.random.word(),
            },
            displayValues: {
              [field11.name]: undefined,
              [field12.name]: faker.random.words(),
            },
            mergedFieldNames: [],
          }, {
            primaryKeys: [createRandomECInstanceKey()],
            values: {
              [field11.name]: [{
                primaryKeys: [createRandomECInstanceKey()],
                mergedFieldNames: [],
                values: {
                  [field111.name]: faker.random.word(),
                  [field112.name]: faker.random.word(),
                },
                displayValues: {
                  [field111.name]: faker.random.words(),
                  [field112.name]: faker.random.words(),
                },
              }] as content.NestedContent[],
              [field12.name]: faker.random.word(),
            },
            displayValues: {
              [field11.name]: undefined,
              [field12.name]: faker.random.words(),
            },
            mergedFieldNames: [],
          }] as content.NestedContent[],
          [field2.name]: faker.random.word(),
        };
        const displayValues = {
          [field1.name]: undefined,
          [field2.name]: faker.random.words(),
        };
        const record = new content.Item([createRandomECInstanceKey()], faker.random.words(),
          faker.random.uuid(), undefined, values, displayValues, []);
        const c: content.Content = {
          descriptor,
          contentSet: [record],
        };
        (provider as any).getContent = async () => c;
        provider.isFieldFavorite = (field) => (field === field111);

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
        const record = new content.Item([createRandomECInstanceKey()],
          faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
        const c: content.Content = {
          descriptor,
          contentSet: [record],
        };
        (provider as any).getContent = async () => c;
        const data = await provider.getData();
        expect(data.categories.length).to.eq(1);
        expect(data.records[data.categories[0].name].length).to.eq(1);
        expect(data.records[data.categories[0].name][0].property.name).to.eq(descriptor.fields[0].name);
      });

      it("doesn't include array fields with no values when set", async () => {
        const fields = [1, 2].map(() => createArrayField());
        const descriptor = createRandomDescriptor();
        descriptor.fields = fields;
        const values: ValuesDictionary<any> = {
          [fields[0].name]: [faker.random.word()],
          [fields[1].name]: [],
        };
        const displayValues: ValuesDictionary<any> = {
          [fields[0].name]: [faker.random.words()],
          [fields[1].name]: [],
        };
        const record = new content.Item([createRandomECInstanceKey()],
          faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
        const c: content.Content = {
          descriptor,
          contentSet: [record],
        };
        (provider as any).getContent = async () => c;
        const data = await provider.getData();
        expect(data.categories.length).to.eq(1);
        expect(data.records[data.categories[0].name].length).to.eq(1);
        expect(data.records[data.categories[0].name][0].property.name).to.eq(descriptor.fields[0].name);
      });

      it("doesn't include struct fields with no values when set", async () => {
        const fields = [1, 2].map(() => createStructField());
        (fields[1].type as content.StructTypeDescription).members = [];
        const descriptor = createRandomDescriptor();
        descriptor.fields = fields;
        const values: ValuesDictionary<any> = {};
        const displayValues: ValuesDictionary<any> = {};
        fields.forEach((field) => {
          values[field.name] = { };
          displayValues[field.name] = { };
        });
        const record = new content.Item([createRandomECInstanceKey()],
          faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
        const c: content.Content = {
          descriptor,
          contentSet: [record],
        };
        (provider as any).getContent = async () => c;
        const data = await provider.getData();
        expect(data.categories.length).to.eq(1);
        expect(data.records[data.categories[0].name].length).to.eq(1);
        expect(data.records[data.categories[0].name][0].property.name).to.eq(descriptor.fields[0].name);
      });

    });

    it("sorts categories according to sortCategories callback", async () => {
      provider.sortCategories = (cats: content.CategoryDescription[]) => {
        cats.sort((lhs: content.CategoryDescription, rhs: content.CategoryDescription): number => {
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
      };
      descriptor.fields[1].category = {
        ...createRandomCategory(),
        priority: 2,
        label: "c",
      };
      descriptor.fields[2].category = {
        ...createRandomCategory(),
        priority: 3,
        label: "a",
      };

      const values: ValuesDictionary<any> = {};
      const displayValues: ValuesDictionary<any> = {};
      const record = new content.Item([createRandomECInstanceKey()],
        faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
      const c: content.Content = {
        descriptor,
        contentSet: [record],
      };
      (provider as any).getContent = async () => c;

      const data = await provider.getData();
      expect(data.categories[0].label).to.eq("a");
      expect(data.categories[1].label).to.eq("b");
      expect(data.categories[2].label).to.eq("c");
    });

    it("sorts records according to sortFields callback", async () => {
      provider.sortFields = (_cat: content.CategoryDescription, fields: content.Field[]) => {
        fields.sort((lhs: content.Field, rhs: content.Field): number => {
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
      const record = new content.Item([createRandomECInstanceKey()],
        faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
      const c: content.Content = {
        descriptor,
        contentSet: [record],
      };
      (provider as any).getContent = async () => c;

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
      provider.isFieldHidden = (_field: content.Field) => true;
      const descriptor = createRandomDescriptor();
      const values: ValuesDictionary<any> = {};
      const displayValues: ValuesDictionary<any> = {};
      const record = new content.Item([createRandomECInstanceKey()],
        faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
      const c: content.Content = {
        descriptor,
        contentSet: [record],
      };
      (provider as any).getContent = async () => c;

      const data = await provider.getData();
      expect(data.categories.length).to.eq(0);
    });

    it("makes records favorite according to isFieldFavorite callback", async () => {
      provider.isFieldFavorite = (_field: content.Field) => true;
      const descriptor = createRandomDescriptor();
      descriptor.fields.forEach((field, index) => {
        field.category = { ...field.category, name: `category_${index}` };
      });
      const values: ValuesDictionary<any> = {};
      const displayValues: ValuesDictionary<any> = {};
      const record = new content.Item([createRandomECInstanceKey()],
        faker.random.words(), faker.random.word(), undefined, values, displayValues, []);
      const c: content.Content = {
        descriptor,
        contentSet: [record],
      };
      (provider as any).getContent = async () => c;

      const data = await provider.getData();
      expect(data.categories.length).to.eq(4);
      expect(data.records[favoritesCategoryName].length).to.eq(descriptor.fields.length);
    });

  });

});

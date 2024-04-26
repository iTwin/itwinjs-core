/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import { DrawingGraphic, ECSqlStatement, ECSqlValue, Element, IModelDb, IModelHost } from "@itwin/core-backend";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { ElementProps, EntityMetaData, GeometricElement2dProps, IModelError, ModelProps } from "@itwin/core-common";
import { InstanceKey } from "@itwin/presentation-common";
import { createRandomECInstanceKey, createRandomId } from "@itwin/presentation-common/lib/cjs/test";
import { SelectionScopesHelper } from "../presentation-backend/SelectionScopesHelper";
import { join } from "path";

describe("SelectionScopesHelper", () => {
  before(async () => {
    await IModelHost.startup({ cacheDir: join(__dirname, ".cache") });
  });

  after(async () => {
    await IModelHost.shutdown();
  });

  describe("getSelectionScopes", () => {
    it("returns expected selection scopes", async () => {
      const result = SelectionScopesHelper.getSelectionScopes();
      expect(result.map((s) => s.id)).to.deep.eq(["element", "assembly", "top-assembly" /* , "category", "model" */]);
    });
  });

  describe("computeSelection", () => {
    const imodelMock = moq.Mock.ofType<IModelDb>();
    const elementsMock = moq.Mock.ofType<IModelDb.Elements>();
    const modelsMock = moq.Mock.ofType<IModelDb.Models>();

    const setupIModelForElementKey = (key: InstanceKey) => {
      // this mock simulates the element key query returning a single row with results for the given key (`getElementKey` in Utils.ts)
      imodelMock
        .setup((x) =>
          x.withPreparedStatement(
            moq.It.is((q) => typeof q === "string" && q.includes("SELECT ECClassId FROM")),
            moq.It.isAny(),
          ),
        )
        .callback((_q, cb) => {
          const valueMock = moq.Mock.ofType<ECSqlValue>();
          valueMock.setup((x) => x.getClassNameForClassId()).returns(() => key.className);
          const stmtMock = moq.Mock.ofType<ECSqlStatement>();
          stmtMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_ROW);
          stmtMock.setup((x) => x.getValue(0)).returns(() => valueMock.object);
          cb(stmtMock.object);
        });
    };

    const setupIModelForInvalidId = () => {
      // this mock simulates trying to bind an invalid id to the element key query (`getElementKey` in Utils.ts)
      imodelMock
        .setup((x) =>
          x.withPreparedStatement(
            moq.It.is((q) => typeof q === "string" && q.includes("SELECT ECClassId FROM")),
            moq.It.isAny(),
          ),
        )
        .callback((_q, cb) => {
          const stmtMock = moq.Mock.ofType<ECSqlStatement>();
          stmtMock.setup((x) => x.bindId(moq.It.isAnyNumber(), moq.It.isAny())).throws(new IModelError(DbResult.BE_SQLITE_ERROR, "Error binding Id"));
          stmtMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_ERROR);
          cb(stmtMock.object);
        });
    };

    const setupIModelForNoResultStatement = () => {
      // this mock simulates any kind of query returning no results
      imodelMock
        .setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny()))
        .callback((_q, cb) => {
          const stmtMock = moq.Mock.ofType<ECSqlStatement>();
          stmtMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE);
          cb(stmtMock.object);
        });
    };

    const createRandomModelProps = (): ModelProps => {
      const id = createRandomId();
      const props: ModelProps = {
        classFullName: faker.random.words(),
        modeledElement: { relClassName: faker.random.word(), id },
        id,
      };
      return props;
    };

    const createRandomTopmostElementProps = (): ElementProps => {
      const props: ElementProps = {
        classFullName: faker.random.words(),
        code: {
          scope: faker.random.word(),
          spec: faker.random.word(),
        },
        model: createRandomId(),
        id: createRandomId(),
      };
      return props;
    };

    const createRandomElementProps = (parentId?: Id64String): ElementProps => {
      if (!parentId) {
        parentId = createRandomId();
      }
      return {
        ...createRandomTopmostElementProps(),
        parent: { relClassName: faker.random.word(), id: parentId },
      };
    };

    const createTransientElementId = () => Id64.fromLocalAndBriefcaseIds(faker.random.number(), 0xffffff);

    const setupIModelForFunctionalKeyQuery = (props: { graphicalElementKey: InstanceKey; stepResult?: DbResult; functionalElementKey?: InstanceKey }) => {
      const functionalKeyQueryIdentifier = "SELECT funcSchemaDef.Name || '.' || funcClassDef.Name funcElClassName, fe.ECInstanceId funcElId";
      imodelMock
        .setup((x) =>
          x.withPreparedStatement(
            moq.It.is((q) => typeof q === "string" && q.includes(functionalKeyQueryIdentifier)),
            moq.It.isAny(),
          ),
        )
        .returns((_q, cb) => {
          const stmtMock = moq.Mock.ofType<ECSqlStatement>();
          stmtMock.setup((x) => x.step()).returns(() => props.stepResult ?? DbResult.BE_SQLITE_ROW);
          stmtMock
            .setup((x) => x.getRow())
            .returns(() => ({
              funcElClassName: props.functionalElementKey?.className,
              funcElId: props.functionalElementKey?.id,
            }));
          return cb(stmtMock.object);
        });
    };

    const setupIModelForElementProps = (props?: { key?: InstanceKey; parentKey?: InstanceKey; isRemoved?: boolean }) => {
      const key = props?.key ?? createRandomECInstanceKey();
      const elementProps = props?.isRemoved ? undefined : props?.parentKey ? createRandomElementProps(props.parentKey.id) : createRandomTopmostElementProps();
      elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => elementProps);
      return { key, props: elementProps };
    };

    const setupIModelDerivesFromClassQuery = (doesDeriveFromSuppliedClass: boolean) => {
      const classDerivesFromQueryIdentifier = "SELECT 1";
      imodelMock
        .setup((x) =>
          x.withPreparedStatement(
            moq.It.is((q) => typeof q === "string" && q.includes(classDerivesFromQueryIdentifier)),
            moq.It.isAny(),
          ),
        )
        .returns((_q, cb) => {
          const stmtMock = moq.Mock.ofType<ECSqlStatement>();
          stmtMock.setup((x) => x.step()).returns(() => (doesDeriveFromSuppliedClass ? DbResult.BE_SQLITE_ROW : DbResult.BE_SQLITE_DONE));
          return cb(stmtMock.object);
        });
    };

    beforeEach(() => {
      elementsMock.reset();
      modelsMock.reset();
      imodelMock.reset();
      imodelMock.setup((x) => x.elements).returns(() => elementsMock.object);
      imodelMock.setup((x) => x.models).returns(() => modelsMock.object);
      imodelMock
        .setup((x) => x.getMetaData(moq.It.isAnyString()))
        .returns(
          (className: string) =>
            new EntityMetaData({
              baseClasses: [],
              properties: {},
              ecclass: className,
            }),
        );
    });

    it("throws on invalid scopeId", async () => {
      await expect(SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [], "invalid")).to.eventually.be.rejected;
    });

    describe("scope: 'element'", () => {
      it("returns element keys", async () => {
        const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
        keys.forEach((key) => setupIModelForElementKey(key));

        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          keys.map((k) => k.id),
          "element",
        );
        expect(result.size).to.eq(2);
        keys.forEach((key) => expect(result.has(key)));
      });

      it("skips non-existing element ids", async () => {
        const keys = [createRandomECInstanceKey()];
        setupIModelForNoResultStatement();

        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          keys.map((k) => k.id),
          "element",
        );
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const keys = [createRandomECInstanceKey(), { className: "any:class", id: createTransientElementId() }];
        setupIModelForElementKey(keys[0]);

        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          keys.map((k) => k.id),
          "element",
        );
        expect(result.size).to.eq(1);
        expect(result.has(keys[0])).to.be.true;
      });

      it("handles invalid id", async () => {
        const validKeys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
        setupIModelForElementKey(validKeys[0]);
        setupIModelForInvalidId();
        setupIModelForElementKey(validKeys[1]);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [validKeys[0].id, "not an id", validKeys[1].id], "element");
        expect(result.size).to.eq(2);
        validKeys.forEach((key) => expect(result.has(key)));
      });

      it("returns nth parent key", async () => {
        const parent3 = setupIModelForElementProps({ key: createRandomECInstanceKey() });
        const parent2 = setupIModelForElementProps({ key: createRandomECInstanceKey(), parentKey: parent3.key });
        const parent1 = setupIModelForElementProps({ key: createRandomECInstanceKey(), parentKey: parent2.key });
        const element = setupIModelForElementProps({ key: createRandomECInstanceKey(), parentKey: parent1.key });
        setupIModelForElementKey(parent2.key);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [element.key.id],
          scope: { id: "element", ancestorLevel: 2 },
        });
        expect(result.size).to.eq(1);
        expect(result.has(parent2.key)).to.be.true;
      });
    });

    describe("scope: 'assembly'", () => {
      it("returns parent keys", async () => {
        const parentKeys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
        parentKeys.forEach((key) => setupIModelForElementKey(key));
        const elementProps = parentKeys.map((pk) => createRandomElementProps(pk.id));
        elementProps.forEach((p) => {
          elementsMock.setup((x) => x.tryGetElementProps(p.id!)).returns(() => p);
        });
        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          elementProps.map((p) => p.id!),
          "assembly",
        );
        expect(result.size).to.eq(2);
        parentKeys.forEach((key) => expect(result.has(key)).to.be.true);
      });

      it("does not duplicate keys", async () => {
        const parentKey = createRandomECInstanceKey();
        setupIModelForElementKey(parentKey);
        const elementProps = [createRandomElementProps(parentKey.id), createRandomElementProps(parentKey.id)];
        elementProps.forEach((p) => {
          elementsMock.setup((x) => x.tryGetElementProps(p.id!)).returns(() => p);
        });
        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          elementProps.map((p) => p.id!),
          "assembly",
        );
        expect(result.size).to.eq(1);
        expect(result.has(parentKey)).to.be.true;
      });

      it("returns element key if it has no parent", async () => {
        const key = createRandomECInstanceKey();
        setupIModelForElementKey(key);
        const elementProps = createRandomTopmostElementProps();
        elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => elementProps);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [key.id], "assembly");
        expect(result.size).to.eq(1);
        expect(result.has(key)).to.be.true;
      });

      it("skips removed elements", async () => {
        // set up one existing element with parent
        const parentKey = createRandomECInstanceKey();
        setupIModelForElementKey(parentKey);
        const existingElementProps = createRandomElementProps(parentKey.id);
        elementsMock.setup((x) => x.tryGetElementProps(existingElementProps.id!)).returns(() => existingElementProps);
        // set up removed element props
        const removedElementProps = createRandomElementProps();
        elementsMock.setup((x) => x.tryGetElementProps(removedElementProps.id!)).returns(() => undefined);
        setupIModelForNoResultStatement();
        // request
        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          [existingElementProps.id!, removedElementProps.id!],
          "assembly",
        );
        expect(result.size).to.eq(1);
        expect(result.has(parentKey)).to.be.true;
      });

      it("skips non-existing element ids", async () => {
        const key = createRandomECInstanceKey();
        setupIModelForNoResultStatement();
        const elementProps = createRandomTopmostElementProps();
        elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => elementProps);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [key.id], "assembly");
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const parentKeys = [createRandomECInstanceKey()];
        setupIModelForElementKey(parentKeys[0]);
        const elementProps = [createRandomElementProps(parentKeys[0].id)];
        elementsMock.setup((x) => x.tryGetElementProps(elementProps[0].id!)).returns(() => elementProps[0]);
        const ids = [elementProps[0].id!, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, ids, "assembly");
        expect(result.size).to.eq(1);
        parentKeys.forEach((key) => expect(result.has(key)).to.be.true);
      });
    });

    describe("scope: 'top-assembly'", () => {
      it("returns topmost parent key", async () => {
        const grandparent = createRandomTopmostElementProps();
        const grandparentKey = createRandomECInstanceKey();
        setupIModelForElementKey(grandparentKey);
        elementsMock.setup((x) => x.tryGetElementProps(grandparentKey.id)).returns(() => grandparent);
        const parent = createRandomElementProps(grandparentKey.id);
        const parentKey = createRandomECInstanceKey();
        elementsMock.setup((x) => x.tryGetElementProps(parentKey.id)).returns(() => parent);
        const element = createRandomElementProps(parentKey.id);
        elementsMock.setup((x) => x.tryGetElementProps(element.id!)).returns(() => element);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [element.id!], "top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(grandparentKey)).to.be.true;
      });

      it("returns element key if it has no parent", async () => {
        const key = createRandomECInstanceKey();
        setupIModelForElementKey(key);
        const elementProps = createRandomTopmostElementProps();
        elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => elementProps);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [key.id], "top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(key)).to.be.true;
      });

      it("skips non-existing element ids", async () => {
        const key = createRandomECInstanceKey();
        setupIModelForNoResultStatement();
        const elementProps = createRandomTopmostElementProps();
        elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => elementProps);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [key.id], "top-assembly");
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const parent = createRandomTopmostElementProps();
        const parentKey = createRandomECInstanceKey();
        setupIModelForElementKey(parentKey);
        elementsMock.setup((x) => x.tryGetElementProps(parentKey.id)).returns(() => parent);
        const elementProps = createRandomElementProps(parentKey.id);
        elementsMock.setup((x) => x.tryGetElementProps(elementProps.id!)).returns(() => elementProps);
        const ids = [elementProps.id!, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, ids, "top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(parentKey)).to.be.true;
      });
    });

    class TestDrawingGraphic extends DrawingGraphic {
      public constructor(props: GeometricElement2dProps, iModel: IModelDb) {
        super(props, iModel);
      }
    }

    describe("scope: 'category'", () => {
      it("returns category key", async () => {
        const category = createRandomElementProps();
        const elementId = createRandomId();
        const element = new TestDrawingGraphic(
          {
            id: elementId,
            classFullName: faker.random.word(),
            model: createRandomId(),
            category: category.id!,
            code: { scope: faker.random.word(), spec: faker.random.word() },
          },
          imodelMock.object,
        );
        elementsMock.setup((x) => x.tryGetElement(elementId)).returns(() => element);
        elementsMock.setup((x) => x.tryGetElementProps(category.id!)).returns(() => category);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [elementId], "category");
        expect(result.size).to.eq(1);
        expect(result.has({ className: category.classFullName, id: element.category })).to.be.true;
      });

      it("skips categories of removed elements", async () => {
        const elementId = createRandomId();
        elementsMock.setup((x) => x.tryGetElement(elementId)).returns(() => undefined);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [elementId], "category");
        expect(result.isEmpty).to.be.true;
      });

      it("skips removed categories", async () => {
        const categoryId = createRandomId();
        const elementId = createRandomId();
        const element = new TestDrawingGraphic(
          {
            id: elementId,
            classFullName: faker.random.word(),
            model: createRandomId(),
            category: categoryId,
            code: { scope: faker.random.word(), spec: faker.random.word() },
          },
          imodelMock.object,
        );
        elementsMock.setup((x) => x.tryGetElement(elementId)).returns(() => element);
        elementsMock.setup((x) => x.tryGetElementProps(categoryId)).returns(() => undefined);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [elementId], "category");
        expect(result.isEmpty).to.be.true;
      });

      it("skips non-geometric elementProps", async () => {
        const elementId = createRandomId();
        const element = moq.Mock.ofType<Element>();
        elementsMock.setup((x) => x.tryGetElement(elementId)).returns(() => element.object);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [elementId], "category");
        expect(result.isEmpty).to.be.true;
      });

      it("skips transient element ids", async () => {
        const category = createRandomElementProps();
        const elementId = createRandomId();
        const element = new TestDrawingGraphic(
          {
            id: elementId,
            classFullName: faker.random.word(),
            model: createRandomId(),
            category: category.id!,
            code: { scope: faker.random.word(), spec: faker.random.word() },
          },
          imodelMock.object,
        );
        elementsMock.setup((x) => x.tryGetElement(elementId)).returns(() => element);
        elementsMock.setup((x) => x.tryGetElementProps(category.id!)).returns(() => category);

        const ids = [elementId, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, ids, "category");
        expect(result.size).to.eq(1);
        expect(result.has({ className: category.classFullName, id: element.category })).to.be.true;
      });
    });

    describe("scope: 'model'", () => {
      it("returns model key", async () => {
        const model = createRandomModelProps();
        const elementId = createRandomId();
        const element = new TestDrawingGraphic(
          {
            id: elementId,
            classFullName: faker.random.word(),
            model: model.id!,
            category: createRandomId(),
            code: { scope: faker.random.word(), spec: faker.random.word() },
          },
          imodelMock.object,
        ).toJSON();
        elementsMock.setup((x) => x.tryGetElementProps(elementId)).returns(() => element);
        modelsMock.setup((x) => x.tryGetModelProps(model.id!)).returns(() => model);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [elementId], "model");
        expect(result.size).to.eq(1);
        expect(result.has({ className: model.classFullName, id: model.id! })).to.be.true;
      });

      it("skips models of removed elements", async () => {
        const elementId = createRandomId();
        elementsMock.setup((x) => x.tryGetElementProps(elementId)).returns(() => undefined);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [elementId], "model");
        expect(result.isEmpty).to.be.true;
      });

      it("skips removed models", async () => {
        const modelId = createRandomId();
        const elementId = createRandomId();
        const element = new TestDrawingGraphic(
          {
            id: elementId,
            classFullName: faker.random.word(),
            model: modelId,
            category: createRandomId(),
            code: { scope: faker.random.word(), spec: faker.random.word() },
          },
          imodelMock.object,
        ).toJSON();
        elementsMock.setup((x) => x.tryGetElementProps(elementId)).returns(() => element);
        modelsMock.setup((x) => x.tryGetModelProps(modelId)).returns(() => undefined);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [elementId], "model");
        expect(result.isEmpty).to.be.true;
      });

      it("skips transient element ids", async () => {
        const model = createRandomModelProps();
        const elementId = createRandomId();
        const element = new TestDrawingGraphic(
          {
            id: elementId,
            classFullName: faker.random.word(),
            model: model.id!,
            category: createRandomId(),
            code: { scope: faker.random.word(), spec: faker.random.word() },
          },
          imodelMock.object,
        ).toJSON();
        elementsMock.setup((x) => x.tryGetElementProps(elementId)).returns(() => element);
        modelsMock.setup((x) => x.tryGetModelProps(model.id!)).returns(() => model);

        const ids = [elementId, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, ids, "model");
        expect(result.size).to.eq(1);
        expect(result.has({ className: model.classFullName, id: model.id! })).to.be.true;
      });
    });

    describe("scope: 'functional-element'", () => {
      it("returns GeometricElement3d key if it doesn't have an associated functional element or parent", async () => {
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns functional element key if GeometricElement3d has an associated functional element", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey, functionalElementKey });

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-element");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it has parents but none of them have related functional elements", async () => {
        const graphicalGrandParentElementKey = createRandomECInstanceKey();
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalGrandParentElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-element");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns functional element key if GeometricElement2d has an associated functional element", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey, functionalElementKey });

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-element");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns functional element key of the first GeometricElement2d parent that has related functional element", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const graphicalGrandParentElementKey = createRandomECInstanceKey();
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-element");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("skips transient element ids", async () => {
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          [graphicalElementKey.id, createTransientElementId()],
          "functional-element",
        );
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("skips removed GeometricElement2d parents when looking for closest functional element", async () => {
        setupIModelDerivesFromClassQuery(false);

        // set up one element with existing parent that has a related functional element
        const functionalElement = setupIModelForElementProps({ key: createRandomECInstanceKey() });
        const existingParent = setupIModelForElementProps({ key: createRandomECInstanceKey() });
        const existingElement = setupIModelForElementProps({ key: createRandomECInstanceKey(), parentKey: existingParent.key });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: existingElement.key });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: existingParent.key, functionalElementKey: functionalElement.key });

        // set up one element with removed parent
        const removedParent = setupIModelForElementProps({ key: createRandomECInstanceKey(), isRemoved: true });
        const elementWithRemovedParent = setupIModelForElementProps({ key: createRandomECInstanceKey(), parentKey: removedParent.key });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: elementWithRemovedParent.key });
        setupIModelForElementKey(elementWithRemovedParent.key);

        // request
        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          [existingElement.key.id, elementWithRemovedParent.key.id],
          "functional-element",
        );
        expect(result.size).to.eq(2);
        expect(result.has(functionalElement.key)).to.be.true;
        expect(result.has(elementWithRemovedParent.key)).to.be.true;
      });
    });

    describe("scope: 'functional-assembly'", () => {
      it("returns GeometricElement3d key if it doesn't have a parent", async () => {
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns GeometricElement3d parent key if it doesn't have a related functional element", async () => {
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForElementKey(graphicalParentElementKey);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalParentElementKey)).to.be.true;
      });

      it("returns functional element key of GeometricElement3d parent", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const graphicalGrandParentElementKey = createRandomECInstanceKey();
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForElementKey(graphicalParentElementKey);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns first GeometricElement2d parent key if none of the parents have an associated functional element", async () => {
        const graphicalGrandParentElementKey = createRandomECInstanceKey();
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForElementKey(graphicalParentElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalParentElementKey)).to.be.true;
      });

      it("returns functional element key of the first GeometricElement2d parent that has a related functional element and the functional element has no parent", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const graphicalGrandParentElementKey = createRandomECInstanceKey();
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });
        setupIModelForElementProps({ key: functionalElementKey });
        setupIModelForElementKey(functionalElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns functional parent element key of the first GeometricElement2d parent that has a related functional element", async () => {
        const functionalParentElementKey = createRandomECInstanceKey();
        const functionalElementKey = createRandomECInstanceKey();
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey, functionalElementKey });
        setupIModelForElementProps({ key: functionalElementKey, parentKey: functionalParentElementKey });
        setupIModelForElementKey(functionalParentElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(functionalParentElementKey)).to.be.true;
      });
    });

    describe("scope: 'functional-top-assembly'", () => {
      it("returns GeometricElement3d key if it doesn't have a parent", async () => {
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns topmost GeometricElement3d parent key if it doesn't have a related functional element", async () => {
        const graphicalGrandParentElementKey = createRandomECInstanceKey();
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalGrandParentElementKey });
        setupIModelForElementKey(graphicalGrandParentElementKey);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalGrandParentElementKey)).to.be.true;
      });

      it("returns functional element key of the topmost GeometricElement3d parent", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const graphicalGrandParentElementKey = createRandomECInstanceKey();
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalGrandParentElementKey });
        setupIModelForElementKey(graphicalGrandParentElementKey);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns topmost GeometricElement2d parent key if none of the parents have an associated functional element", async () => {
        const graphicalGrandParentElementKey = createRandomECInstanceKey();
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalGrandParentElementKey }); // done looking for functionals
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalGrandParentElementKey });
        setupIModelForElementKey(graphicalGrandParentElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalGrandParentElementKey)).to.be.true;
      });

      it("returns functional element key of the first GeometricElement2d parent that has a related functional element and the functional element has no parent", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const graphicalGrandParentElementKey = createRandomECInstanceKey();
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey }); // done looking for functionals
        setupIModelForElementProps({ key: functionalElementKey });
        setupIModelForElementKey(functionalElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns functional topmost parent element key of the first GeometricElement2d parent that has a related functional element", async () => {
        const functionalGrandParentElementKey = createRandomECInstanceKey();
        const functionalParentElementKey = createRandomECInstanceKey();
        const functionalElementKey = createRandomECInstanceKey();
        const graphicalGrandParentElementKey = createRandomECInstanceKey();
        const graphicalParentElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey }); // done looking for functionals
        setupIModelForElementProps({ key: functionalElementKey, parentKey: functionalParentElementKey });
        setupIModelForElementProps({ key: functionalParentElementKey, parentKey: functionalGrandParentElementKey });
        setupIModelForElementProps({ key: functionalGrandParentElementKey });
        setupIModelForElementKey(functionalGrandParentElementKey);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(functionalGrandParentElementKey)).to.be.true;
      });
    });
  });
});

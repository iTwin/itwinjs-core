/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { DrawingGraphic, ECSqlStatement, ECSqlValue, Element, IModelDb } from "@itwin/core-backend";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { CodeProps, ElementProps, EntityMetaData, GeometricElement2dProps, IModelError, ModelProps } from "@itwin/core-common";
import { InstanceKey } from "@itwin/presentation-common";
import { createTestECInstanceKey } from "@itwin/presentation-common/test-utils";
import { SelectionScopesHelper } from "../presentation-backend/SelectionScopesHelper.js";

describe("SelectionScopesHelper", () => {
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

    const createTestModelProps = (props?: Partial<ModelProps>): ModelProps => ({
      classFullName: "TestSchema:TestClass",
      id: "0x111",
      modeledElement: { relClassName: "TestSchema:TestRelationship", id: props?.id ?? "0x111" },
      ...props,
    });

    const createTestTopmostElementProps = (props?: Partial<ElementProps>): ElementProps => ({
      classFullName: "TestSchema:TestClass",
      code: createTestCode(),
      model: "0x222",
      id: "0x333",
      ...props,
    });

    const createTestElementProps = (parentId?: Id64String): ElementProps => {
      if (!parentId) {
        parentId = "0x444";
      }
      return {
        ...createTestTopmostElementProps(),
        parent: { relClassName: "TestSchema:TestRelationship", id: parentId },
      };
    };

    const createTransientElementId = () => Id64.fromLocalAndBriefcaseIds(159, 0xffffff);

    const createTestCode = (props?: Partial<CodeProps>): CodeProps => ({
      scope: "TestScope",
      spec: "ScopeSpec",
      ...props,
    });

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
      const key = props?.key ?? createTestECInstanceKey();
      const elementProps = props?.isRemoved ? undefined : props?.parentKey ? createTestElementProps(props.parentKey.id) : createTestTopmostElementProps();
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
              classId: "0x123",
              baseClasses: [],
              properties: {},
              ecclass: className,
            }),
        );
    });

    it("throws on invalid scopeId", async () => {
      await expect(SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [], scope: { id: "invalid" } })).to.eventually.be.rejected;
    });

    describe("scope: 'element'", () => {
      it("returns element keys", async () => {
        const keys = [createTestECInstanceKey({ id: "0x111" }), createTestECInstanceKey({ id: "0x222" })];
        keys.forEach((key) => setupIModelForElementKey(key));

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: keys.map((k) => k.id), scope: { id: "element" } });
        expect(result.size).to.eq(2);
        keys.forEach((key) => expect(result.has(key)));
      });

      it("skips non-existing element ids", async () => {
        const keys = [createTestECInstanceKey()];
        setupIModelForNoResultStatement();

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: keys.map((k) => k.id), scope: { id: "element" } });
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const keys = [createTestECInstanceKey(), { className: "any:class", id: createTransientElementId() }];
        setupIModelForElementKey(keys[0]);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: keys.map((k) => k.id), scope: { id: "element" } });
        expect(result.size).to.eq(1);
        expect(result.has(keys[0])).to.be.true;
      });

      it("handles invalid id", async () => {
        const validKeys = [createTestECInstanceKey({ id: "0x111" }), createTestECInstanceKey({ id: "0x222" })];
        setupIModelForElementKey(validKeys[0]);
        setupIModelForInvalidId();
        setupIModelForElementKey(validKeys[1]);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [validKeys[0].id, "not an id", validKeys[1].id],
          scope: { id: "element" },
        });
        expect(result.size).to.eq(2);
        validKeys.forEach((key) => expect(result.has(key)));
      });

      it("returns nth parent key", async () => {
        const parent3 = setupIModelForElementProps({ key: createTestECInstanceKey() });
        const parent2 = setupIModelForElementProps({ key: createTestECInstanceKey(), parentKey: parent3.key });
        const parent1 = setupIModelForElementProps({ key: createTestECInstanceKey(), parentKey: parent2.key });
        const element = setupIModelForElementProps({ key: createTestECInstanceKey(), parentKey: parent1.key });
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
        const parentKeys = [createTestECInstanceKey({ id: "0x111" }), createTestECInstanceKey({ id: "0x222" })];
        parentKeys.forEach((key) => setupIModelForElementKey(key));
        const elementProps = parentKeys.map((pk) => createTestElementProps(pk.id));
        elementProps.forEach((p) => {
          elementsMock.setup((x) => x.tryGetElementProps(p.id!)).returns(() => p);
        });
        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: elementProps.map((p) => p.id!),
          scope: { id: "assembly" },
        });
        expect(result.size).to.eq(2);
        parentKeys.forEach((key) => expect(result.has(key)).to.be.true);
      });

      it("does not duplicate keys", async () => {
        const parentKey = createTestECInstanceKey();
        setupIModelForElementKey(parentKey);
        const elementProps = [createTestElementProps(parentKey.id), createTestElementProps(parentKey.id)];
        elementProps.forEach((p) => {
          elementsMock.setup((x) => x.tryGetElementProps(p.id!)).returns(() => p);
        });
        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: elementProps.map((p) => p.id!),
          scope: { id: "assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(parentKey)).to.be.true;
      });

      it("returns element key if it has no parent", async () => {
        const key = createTestECInstanceKey();
        setupIModelForElementKey(key);
        const elementProps = createTestTopmostElementProps();
        elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => elementProps);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [key.id], scope: { id: "assembly" } });
        expect(result.size).to.eq(1);
        expect(result.has(key)).to.be.true;
      });

      it("skips removed elements", async () => {
        // set up one existing element with parent
        const parentKey = createTestECInstanceKey();
        setupIModelForElementKey(parentKey);
        const existingElementProps = createTestElementProps(parentKey.id);
        elementsMock.setup((x) => x.tryGetElementProps(existingElementProps.id!)).returns(() => existingElementProps);
        // set up removed element props
        const removedElementProps = createTestElementProps();
        elementsMock.setup((x) => x.tryGetElementProps(removedElementProps.id!)).returns(() => undefined);
        setupIModelForNoResultStatement();
        // request
        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [existingElementProps.id!, removedElementProps.id!],
          scope: { id: "assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(parentKey)).to.be.true;
      });

      it("skips non-existing element ids", async () => {
        const key = createTestECInstanceKey();
        setupIModelForNoResultStatement();
        const elementProps = createTestTopmostElementProps();
        elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => elementProps);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [key.id], scope: { id: "assembly" } });
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const parentKeys = [createTestECInstanceKey()];
        setupIModelForElementKey(parentKeys[0]);
        const elementProps = [createTestElementProps(parentKeys[0].id)];
        elementsMock.setup((x) => x.tryGetElementProps(elementProps[0].id!)).returns(() => elementProps[0]);
        const ids = [elementProps[0].id!, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: ids, scope: { id: "assembly" } });
        expect(result.size).to.eq(1);
        parentKeys.forEach((key) => expect(result.has(key)).to.be.true);
      });
    });

    describe("scope: 'top-assembly'", () => {
      it("returns topmost parent key", async () => {
        const grandparent = createTestTopmostElementProps();
        const grandparentKey = createTestECInstanceKey();
        setupIModelForElementKey(grandparentKey);
        elementsMock.setup((x) => x.tryGetElementProps(grandparentKey.id)).returns(() => grandparent);
        const parent = createTestElementProps(grandparentKey.id);
        const parentKey = createTestECInstanceKey();
        elementsMock.setup((x) => x.tryGetElementProps(parentKey.id)).returns(() => parent);
        const element = createTestElementProps(parentKey.id);
        elementsMock.setup((x) => x.tryGetElementProps(element.id!)).returns(() => element);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [element.id!], scope: { id: "top-assembly" } });
        expect(result.size).to.eq(1);
        expect(result.has(grandparentKey)).to.be.true;
      });

      it("returns element key if it has no parent", async () => {
        const key = createTestECInstanceKey();
        setupIModelForElementKey(key);
        const elementProps = createTestTopmostElementProps();
        elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => elementProps);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [key.id], scope: { id: "top-assembly" } });
        expect(result.size).to.eq(1);
        expect(result.has(key)).to.be.true;
      });

      it("skips non-existing element ids", async () => {
        const key = createTestECInstanceKey();
        setupIModelForNoResultStatement();
        const elementProps = createTestTopmostElementProps();
        elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => elementProps);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [key.id], scope: { id: "top-assembly" } });
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const parent = createTestTopmostElementProps();
        const parentKey = createTestECInstanceKey();
        setupIModelForElementKey(parentKey);
        elementsMock.setup((x) => x.tryGetElementProps(parentKey.id)).returns(() => parent);
        const elementProps = createTestElementProps(parentKey.id);
        elementsMock.setup((x) => x.tryGetElementProps(elementProps.id!)).returns(() => elementProps);
        const ids = [elementProps.id!, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: ids, scope: { id: "top-assembly" } });
        expect(result.size).to.eq(1);
        expect(result.has(parentKey)).to.be.true;
      });
    });

    describe("scope: 'category'", () => {
      it("returns category key", async () => {
        const category = createTestElementProps();
        const elementId = "0x123";
        const element = {
          id: elementId,
          classFullName: "TestSchema:TestClass",
          model: "0x123",
          category: category.id!,
          code: createTestCode(),
        } as DrawingGraphic;
        elementsMock.setup((x) => x.tryGetElement(elementId)).returns(() => element);
        elementsMock.setup((x) => x.tryGetElementProps(category.id!)).returns(() => category);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [elementId], scope: { id: "category" } });
        expect(result.size).to.eq(1);
        expect(result.has({ className: category.classFullName, id: element.category })).to.be.true;
      });

      it("skips categories of removed elements", async () => {
        const elementId = "0x123";
        elementsMock.setup((x) => x.tryGetElement(elementId)).returns(() => undefined);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [elementId], scope: { id: "category" } });
        expect(result.isEmpty).to.be.true;
      });

      it("skips removed categories", async () => {
        const categoryId = "0x123";
        const elementId = "0x123";
        const element = {
          id: elementId,
          classFullName: "TestSchema:TestClass",
          model: "0x123",
          category: categoryId,
          code: createTestCode(),
        } as DrawingGraphic;
        elementsMock.setup((x) => x.tryGetElement(elementId)).returns(() => element);
        elementsMock.setup((x) => x.tryGetElementProps(categoryId)).returns(() => undefined);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [elementId], scope: { id: "category" } });
        expect(result.isEmpty).to.be.true;
      });

      it("skips non-geometric elementProps", async () => {
        const elementId = "0x123";
        const element = moq.Mock.ofType<Element>();
        elementsMock.setup((x) => x.tryGetElement(elementId)).returns(() => element.object);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [elementId], scope: { id: "category" } });
        expect(result.isEmpty).to.be.true;
      });

      it("skips transient element ids", async () => {
        const category = createTestElementProps();
        const elementId = "0x123";
        const element = {
          id: elementId,
          classFullName: "TestSchema:TestClass",
          model: "0x123",
          category: category.id!,
          code: createTestCode(),
        } as DrawingGraphic;
        elementsMock.setup((x) => x.tryGetElement(elementId)).returns(() => element);
        elementsMock.setup((x) => x.tryGetElementProps(category.id!)).returns(() => category);

        const ids = [elementId, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: ids, scope: { id: "category" } });
        expect(result.size).to.eq(1);
        expect(result.has({ className: category.classFullName, id: element.category })).to.be.true;
      });
    });

    describe("scope: 'model'", () => {
      it("returns model key", async () => {
        const model = createTestModelProps();
        const elementId = "0x123";
        const element = {
          id: elementId,
          classFullName: "TestSchema:TestClass",
          model: model.id!,
          category: "0x123",
          code: createTestCode(),
        } as GeometricElement2dProps;
        elementsMock.setup((x) => x.tryGetElementProps(elementId)).returns(() => element);
        modelsMock.setup((x) => x.tryGetModelProps(model.id!)).returns(() => model);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [elementId], scope: { id: "model" } });
        expect(result.size).to.eq(1);
        expect(result.has({ className: model.classFullName, id: model.id! })).to.be.true;
      });

      it("skips models of removed elements", async () => {
        const elementId = "0x123";
        elementsMock.setup((x) => x.tryGetElementProps(elementId)).returns(() => undefined);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [elementId], scope: { id: "model" } });
        expect(result.isEmpty).to.be.true;
      });

      it("skips removed models", async () => {
        const modelId = "0x123";
        const elementId = "0x123";
        const element = {
          id: elementId,
          classFullName: "TestSchema:TestClass",
          model: modelId,
          category: "0x123",
          code: createTestCode(),
        } as GeometricElement2dProps;
        elementsMock.setup((x) => x.tryGetElementProps(elementId)).returns(() => element);
        modelsMock.setup((x) => x.tryGetModelProps(modelId)).returns(() => undefined);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: [elementId], scope: { id: "model" } });
        expect(result.isEmpty).to.be.true;
      });

      it("skips transient element ids", async () => {
        const model = createTestModelProps();
        const elementId = "0x123";
        const element = {
          id: elementId,
          classFullName: "TestSchema:TestClass",
          model: model.id!,
          category: "0x123",
          code: createTestCode(),
        } as GeometricElement2dProps;
        elementsMock.setup((x) => x.tryGetElementProps(elementId)).returns(() => element);
        modelsMock.setup((x) => x.tryGetModelProps(model.id!)).returns(() => model);

        const ids = [elementId, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object, elementIds: ids, scope: { id: "model" } });
        expect(result.size).to.eq(1);
        expect(result.has({ className: model.classFullName, id: model.id! })).to.be.true;
      });
    });

    describe("scope: 'functional-element'", () => {
      it("returns GeometricElement3d key if it doesn't have an associated functional element or parent", async () => {
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns functional element key if GeometricElement3d has an associated functional element", async () => {
        const functionalElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey, functionalElementKey });

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-element" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it has parents but none of them have related functional elements", async () => {
        const graphicalGrandParentElementKey = createTestECInstanceKey();
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalGrandParentElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-element" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns functional element key if GeometricElement2d has an associated functional element", async () => {
        const functionalElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey, functionalElementKey });

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-element" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns functional element key of the first GeometricElement2d parent that has related functional element", async () => {
        const functionalElementKey = createTestECInstanceKey();
        const graphicalGrandParentElementKey = createTestECInstanceKey();
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-element" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("skips transient element ids", async () => {
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id, createTransientElementId()],
          scope: { id: "functional-element" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("skips removed GeometricElement2d parents when looking for closest functional element", async () => {
        setupIModelDerivesFromClassQuery(false);

        // set up one element with existing parent that has a related functional element
        const functionalElement = setupIModelForElementProps({ key: createTestECInstanceKey({ id: "0x111" }) });
        const existingParent = setupIModelForElementProps({ key: createTestECInstanceKey({ id: "0x222" }) });
        const existingElement = setupIModelForElementProps({ key: createTestECInstanceKey({ id: "0x333" }), parentKey: existingParent.key });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: existingElement.key });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: existingParent.key, functionalElementKey: functionalElement.key });

        // set up one element with removed parent
        const removedParent = setupIModelForElementProps({ key: createTestECInstanceKey({ id: "0x555" }), isRemoved: true });
        const elementWithRemovedParent = setupIModelForElementProps({ key: createTestECInstanceKey({ id: "0x666" }), parentKey: removedParent.key });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: elementWithRemovedParent.key });
        setupIModelForElementKey(elementWithRemovedParent.key);

        // request
        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [existingElement.key.id, elementWithRemovedParent.key.id],
          scope: { id: "functional-element" },
        });
        expect(result.size).to.eq(2);
        expect(result.has(functionalElement.key)).to.be.true;
        expect(result.has(elementWithRemovedParent.key)).to.be.true;
      });
    });

    describe("scope: 'functional-assembly'", () => {
      it("returns GeometricElement3d key if it doesn't have a parent", async () => {
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns GeometricElement3d parent key if it doesn't have a related functional element", async () => {
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForElementKey(graphicalParentElementKey);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalParentElementKey)).to.be.true;
      });

      it("returns functional element key of GeometricElement3d parent", async () => {
        const functionalElementKey = createTestECInstanceKey();
        const graphicalGrandParentElementKey = createTestECInstanceKey();
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForElementKey(graphicalParentElementKey);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns first GeometricElement2d parent key if none of the parents have an associated functional element", async () => {
        const graphicalGrandParentElementKey = createTestECInstanceKey();
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForElementKey(graphicalParentElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalParentElementKey)).to.be.true;
      });

      it("returns functional element key of the first GeometricElement2d parent that has a related functional element and the functional element has no parent", async () => {
        const functionalElementKey = createTestECInstanceKey();
        const graphicalGrandParentElementKey = createTestECInstanceKey();
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });
        setupIModelForElementProps({ key: functionalElementKey });
        setupIModelForElementKey(functionalElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns functional parent element key of the first GeometricElement2d parent that has a related functional element", async () => {
        const functionalParentElementKey = createTestECInstanceKey();
        const functionalElementKey = createTestECInstanceKey();
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey, functionalElementKey });
        setupIModelForElementProps({ key: functionalElementKey, parentKey: functionalParentElementKey });
        setupIModelForElementKey(functionalParentElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalParentElementKey)).to.be.true;
      });
    });

    describe("scope: 'functional-top-assembly'", () => {
      it("returns GeometricElement3d key if it doesn't have a parent", async () => {
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns topmost GeometricElement3d parent key if it doesn't have a related functional element", async () => {
        const graphicalGrandParentElementKey = createTestECInstanceKey();
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalGrandParentElementKey });
        setupIModelForElementKey(graphicalGrandParentElementKey);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalGrandParentElementKey)).to.be.true;
      });

      it("returns functional element key of the topmost GeometricElement3d parent", async () => {
        const functionalElementKey = createTestECInstanceKey();
        const graphicalGrandParentElementKey = createTestECInstanceKey();
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(true);
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForElementProps({ key: graphicalGrandParentElementKey });
        setupIModelForElementKey(graphicalGrandParentElementKey);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey });
        setupIModelForElementKey(graphicalElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns topmost GeometricElement2d parent key if none of the parents have an associated functional element", async () => {
        const graphicalGrandParentElementKey = createTestECInstanceKey();
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
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

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalGrandParentElementKey)).to.be.true;
      });

      it("returns functional element key of the first GeometricElement2d parent that has a related functional element and the functional element has no parent", async () => {
        const functionalElementKey = createTestECInstanceKey();
        const graphicalGrandParentElementKey = createTestECInstanceKey();
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
        setupIModelDerivesFromClassQuery(false);
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForElementProps({ key: graphicalElementKey, parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForElementProps({ key: graphicalParentElementKey, parentKey: graphicalGrandParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey }); // done looking for functionals
        setupIModelForElementProps({ key: functionalElementKey });
        setupIModelForElementKey(functionalElementKey);

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns functional topmost parent element key of the first GeometricElement2d parent that has a related functional element", async () => {
        const functionalGrandParentElementKey = createTestECInstanceKey();
        const functionalParentElementKey = createTestECInstanceKey();
        const functionalElementKey = createTestECInstanceKey();
        const graphicalGrandParentElementKey = createTestECInstanceKey();
        const graphicalParentElementKey = createTestECInstanceKey();
        const graphicalElementKey = createTestECInstanceKey();
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

        const result = await SelectionScopesHelper.computeSelection({
          imodel: imodelMock.object,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalGrandParentElementKey)).to.be.true;
      });
    });
  });
});

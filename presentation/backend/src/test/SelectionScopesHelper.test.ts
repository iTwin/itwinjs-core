/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { DrawingGraphic, Element, IModelDb } from "@itwin/core-backend";
import { Id64, Id64String } from "@itwin/core-bentley";
import { CodeProps, ElementProps, GeometricElement2dProps, ModelProps } from "@itwin/core-common";
import { InstanceKey } from "@itwin/presentation-common";
import { createTestECInstanceKey } from "@itwin/presentation-common/test-utils";
import { SelectionScopesHelper } from "../presentation-backend/SelectionScopesHelper.js";
import { stubECSqlReader } from "./Helpers.js";

describe("SelectionScopesHelper", () => {
  describe("getSelectionScopes", () => {
    it("returns expected selection scopes", async () => {
      const result = SelectionScopesHelper.getSelectionScopes();
      expect(result.map((s) => s.id)).to.deep.eq(["element", "assembly", "top-assembly" /* , "category", "model" */]);
    });
  });

  describe("computeSelection", () => {
    let elementIdCounter = 1;
    let imodelMock: ReturnType<typeof stubIModel>;
    let imodel: IModelDb;

    function stubIModel() {
      const elements = {
        tryGetElementProps: sinon.stub(),
        tryGetElement: sinon.stub(),
      };
      const models = {
        tryGetModelProps: sinon.stub(),
      };
      return {
        elements,
        models,
        createQueryReader: sinon.stub(),
      };
    }

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

    const setupIModelForFunctionalKeyQuery = (props: { graphicalElementKey: InstanceKey; functionalElementKey?: InstanceKey }) => {
      const functionalKeyQueryIdentifier = "SELECT funcSchemaDef.Name || '.' || funcClassDef.Name funcElClassName, fe.ECInstanceId funcElId";
      imodelMock.createQueryReader
        .withArgs(
          sinon.match((q) => typeof q === "string" && q.includes(functionalKeyQueryIdentifier)),
          sinon.match.any,
        )
        .returns(
          stubECSqlReader([
            {
              funcElClassName: props.functionalElementKey?.className,
              funcElId: props.functionalElementKey?.id,
            },
          ]),
        );
    };

    const setupIModelForElementProps = (props?: { key?: InstanceKey; parentKey?: InstanceKey }) => {
      const key = props?.key ?? createTestECInstanceKey({ id: Id64.fromUint32Pair(elementIdCounter++, 999) });
      const elementProps = {
        ...(props?.parentKey ? createTestElementProps(props.parentKey.id) : createTestTopmostElementProps()),
        classFullName: key.className,
        id: key.id,
      };
      imodelMock.elements.tryGetElementProps.withArgs(key.id).returns(elementProps);
      return { key, props: elementProps };
    };

    const setupIModelDerivesFromClassQuery = (doesDeriveFromSuppliedClass: boolean) => {
      const classDerivesFromQueryIdentifier = "SELECT 1";
      imodelMock.createQueryReader
        .withArgs(
          sinon.match((q) => typeof q === "string" && q.includes(classDerivesFromQueryIdentifier)),
          sinon.match.any,
        )
        .returns(stubECSqlReader(doesDeriveFromSuppliedClass ? [{}] : []));
    };

    beforeEach(() => {
      imodelMock = stubIModel();
      imodel = imodelMock as unknown as IModelDb;
    });

    afterEach(() => {
      elementIdCounter = 1;
      sinon.restore();
    });

    it("throws on invalid scopeId", async () => {
      await expect(SelectionScopesHelper.computeSelection({ imodel, elementIds: [], scope: { id: "invalid" } })).to.eventually.be.rejected;
    });

    describe("scope: 'element'", () => {
      it("returns element keys", async () => {
        const keys = [createTestECInstanceKey({ id: "0x111" }), createTestECInstanceKey({ id: "0x222" })];
        keys.forEach((key) => setupIModelForElementProps({ key }));

        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: keys.map((k) => k.id), scope: { id: "element" } });
        expect(result.size).to.eq(2);
        keys.forEach((key) => expect(result.has(key)));
      });

      it("skips non-existing element ids", async () => {
        const keys = [createTestECInstanceKey()];
        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: keys.map((k) => k.id), scope: { id: "element" } });
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const keys = [createTestECInstanceKey(), { className: "any:class", id: createTransientElementId() }];
        setupIModelForElementProps({ key: keys[0] });

        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: keys.map((k) => k.id), scope: { id: "element" } });
        expect(result.size).to.eq(1);
        expect(result.has(keys[0])).to.be.true;
      });

      it("handles invalid id", async () => {
        const validKeys = [createTestECInstanceKey({ id: "0x111" }), createTestECInstanceKey({ id: "0x222" })];
        setupIModelForElementProps({ key: validKeys[0] });
        setupIModelForElementProps({ key: validKeys[1] });

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
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
        setupIModelForElementProps({ key: parent2.key });

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
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
        parentKeys.forEach((key) => setupIModelForElementProps({ key }));
        const elementKeys = parentKeys.map((pk) => setupIModelForElementProps({ parentKey: pk }).key);
        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: elementKeys.map(({ id }) => id),
          scope: { id: "assembly" },
        });
        expect(result.size).to.eq(2);
        parentKeys.forEach((key) => expect(result.has(key)).to.be.true);
      });

      it("does not duplicate keys", async () => {
        const { key: parentKey } = setupIModelForElementProps();
        const elementKeys = [setupIModelForElementProps({ parentKey }).key, setupIModelForElementProps({ parentKey }).key];
        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: elementKeys.map(({ id }) => id),
          scope: { id: "assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(parentKey)).to.be.true;
      });

      it("returns element key if it has no parent", async () => {
        const key = createTestECInstanceKey();
        setupIModelForElementProps({ key });
        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [key.id], scope: { id: "assembly" } });
        expect(result.size).to.eq(1);
        expect(result.has(key)).to.be.true;
      });

      it("skips non-existing element ids", async () => {
        const key = createTestECInstanceKey();
        imodelMock.elements.tryGetElementProps.withArgs(key.id).returns(undefined);
        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [key.id], scope: { id: "assembly" } });
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const { key: parentKey } = setupIModelForElementProps();
        const { key: elementKey } = setupIModelForElementProps({ parentKey });
        const ids = [elementKey.id, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: ids, scope: { id: "assembly" } });
        expect(result.size).to.eq(1);
        expect(result.has(parentKey)).to.be.true;
      });
    });

    describe("scope: 'top-assembly'", () => {
      it("returns topmost parent key", async () => {
        const { key: grandparentKey } = setupIModelForElementProps();
        const { key: parentKey } = setupIModelForElementProps({ parentKey: grandparentKey });
        const { key: elementKey } = setupIModelForElementProps({ parentKey });

        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [elementKey.id], scope: { id: "top-assembly" } });
        expect(result.size).to.eq(1);
        expect(result.has(grandparentKey)).to.be.true;
      });

      it("returns element key if it has no parent", async () => {
        const { key } = setupIModelForElementProps();
        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [key.id], scope: { id: "top-assembly" } });
        expect(result.size).to.eq(1);
        expect(result.has(key)).to.be.true;
      });

      it("skips non-existing element ids", async () => {
        const key = createTestECInstanceKey();
        imodelMock.elements.tryGetElementProps.withArgs(key.id).returns(undefined);
        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [key.id], scope: { id: "top-assembly" } });
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const { key: parentKey } = setupIModelForElementProps();
        const { key: elementKey } = setupIModelForElementProps({ parentKey });
        const ids = [elementKey.id, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: ids, scope: { id: "top-assembly" } });
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
        imodelMock.elements.tryGetElement.withArgs(elementId).returns(element);
        imodelMock.elements.tryGetElementProps.withArgs(category.id!).returns(category);

        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [elementId], scope: { id: "category" } });
        expect(result.size).to.eq(1);
        expect(result.has({ className: category.classFullName, id: element.category })).to.be.true;
      });

      it("skips categories of removed elements", async () => {
        const elementId = "0x123";
        imodelMock.elements.tryGetElement.withArgs(elementId).returns(undefined);
        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [elementId], scope: { id: "category" } });
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
        imodelMock.elements.tryGetElement.withArgs(elementId).returns(element);
        imodelMock.elements.tryGetElementProps.withArgs(categoryId).returns(undefined);

        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [elementId], scope: { id: "category" } });
        expect(result.isEmpty).to.be.true;
      });

      it("skips non-geometric elementProps", async () => {
        const elementId = "0x123";
        const element = {} as Element;
        imodelMock.elements.tryGetElement.withArgs(elementId).returns(element);

        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [elementId], scope: { id: "category" } });
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
        imodelMock.elements.tryGetElement.withArgs(elementId).returns(element);
        imodelMock.elements.tryGetElementProps.withArgs(category.id!).returns(category);

        const ids = [elementId, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: ids, scope: { id: "category" } });
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
        imodelMock.elements.tryGetElementProps.withArgs(elementId).returns(element);
        imodelMock.models.tryGetModelProps.withArgs(model.id!).returns(model);

        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [elementId], scope: { id: "model" } });
        expect(result.size).to.eq(1);
        expect(result.has({ className: model.classFullName, id: model.id! })).to.be.true;
      });

      it("skips models of removed elements", async () => {
        const elementId = "0x123";
        imodelMock.elements.tryGetElementProps.withArgs(elementId).returns(undefined);
        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [elementId], scope: { id: "model" } });
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
        imodelMock.elements.tryGetElementProps.withArgs(elementId).returns(element);
        imodelMock.models.tryGetModelProps.withArgs(modelId).returns(undefined);

        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: [elementId], scope: { id: "model" } });
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
        imodelMock.elements.tryGetElementProps.withArgs(elementId).returns(element);
        imodelMock.models.tryGetModelProps.withArgs(model.id!).returns(model);

        const ids = [elementId, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel, elementIds: ids, scope: { id: "model" } });
        expect(result.size).to.eq(1);
        expect(result.has({ className: model.classFullName, id: model.id! })).to.be.true;
      });
    });

    describe("scope: 'functional-element'", () => {
      it("returns GeometricElement3d key if it doesn't have an associated functional element or parent", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns functional element key if GeometricElement3d has an associated functional element", async () => {
        const functionalElementKey = createTestECInstanceKey({ id: "0x111" });
        const graphicalElementKey = createTestECInstanceKey({ id: "0x222" });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-element" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it has parents but none of them have related functional elements", async () => {
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-element" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns functional element key if GeometricElement2d has an associated functional element", async () => {
        const functionalElementKey = createTestECInstanceKey({ id: "0x111" });
        const graphicalElementKey = createTestECInstanceKey({ id: "0x222" });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-element" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns functional element key of the first GeometricElement2d parent that has related functional element", async () => {
        const functionalElementKey = createTestECInstanceKey();
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-element" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("skips transient element ids", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id, createTransientElementId()],
          scope: { id: "functional-element" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });
    });

    describe("scope: 'functional-assembly'", () => {
      it("returns GeometricElement3d key if it doesn't have a parent", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns GeometricElement3d parent key if it doesn't have a related functional element", async () => {
        const { key: graphicalParentElementKey } = setupIModelForElementProps();
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalParentElementKey)).to.be.true;
      });

      it("returns functional element key of GeometricElement3d parent", async () => {
        const functionalElementKey = createTestECInstanceKey();
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns first GeometricElement2d parent key if none of the parents have an associated functional element", async () => {
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalParentElementKey)).to.be.true;
      });

      it("returns functional element key of the first GeometricElement2d parent that has a related functional element and the functional element has no parent", async () => {
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        const { key: functionalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns functional parent element key of the first GeometricElement2d parent that has a related functional element", async () => {
        const { key: graphicalParentElementKey } = setupIModelForElementProps();
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        const { key: functionalParentElementKey } = setupIModelForElementProps();
        const { key: functionalElementKey } = setupIModelForElementProps({ parentKey: functionalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalParentElementKey)).to.be.true;
      });
    });

    describe("scope: 'functional-top-assembly'", () => {
      it("returns GeometricElement3d key if it doesn't have a parent", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns topmost GeometricElement3d parent key if it doesn't have a related functional element", async () => {
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalGrandParentElementKey)).to.be.true;
      });

      it("returns functional element key of the topmost GeometricElement3d parent", async () => {
        const functionalElementKey = createTestECInstanceKey();
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns topmost GeometricElement2d parent key if none of the parents have an associated functional element", async () => {
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(graphicalGrandParentElementKey)).to.be.true;
      });

      it("returns functional element key of the first GeometricElement2d parent that has a related functional element and the functional element has no parent", async () => {
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        const { key: functionalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns functional topmost parent element key of the first GeometricElement2d parent that has a related functional element", async () => {
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        const { key: functionalGrandParentElementKey } = setupIModelForElementProps();
        const { key: functionalParentElementKey } = setupIModelForElementProps({ parentKey: functionalGrandParentElementKey });
        const { key: functionalElementKey } = setupIModelForElementProps({ parentKey: functionalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({
          imodel,
          elementIds: [graphicalElementKey.id],
          scope: { id: "functional-top-assembly" },
        });
        expect(result.size).to.eq(1);
        expect(result.has(functionalGrandParentElementKey)).to.be.true;
      });
    });
  });
});

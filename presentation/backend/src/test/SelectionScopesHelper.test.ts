/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import * as moq from "typemoq";
import { DrawingGraphic, Element, IModelDb } from "@itwin/core-backend";
import { Id64, Id64String } from "@itwin/core-bentley";
import { ElementProps, EntityMetaData, GeometricElement2dProps, ModelProps } from "@itwin/core-common";
import { InstanceKey } from "@itwin/presentation-common";
import { createRandomECInstanceKey, createRandomId } from "@itwin/presentation-common/lib/cjs/test";
import { SelectionScopesHelper } from "../presentation-backend/SelectionScopesHelper";
import { stubECSqlReader } from "./Helpers";

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

    const setupIModelForFunctionalKeyQuery = (props: { graphicalElementKey: InstanceKey; functionalElementKey?: InstanceKey }) => {
      const functionalKeyQueryIdentifier = "SELECT funcSchemaDef.Name || '.' || funcClassDef.Name funcElClassName, fe.ECInstanceId funcElId";
      imodelMock
        .setup((x) =>
          x.createQueryReader(
            moq.It.is((q) => typeof q === "string" && q.includes(functionalKeyQueryIdentifier)),
            moq.It.isAny(),
          ),
        )
        .returns(() =>
          stubECSqlReader([
            {
              funcElClassName: props.functionalElementKey?.className,
              funcElId: props.functionalElementKey?.id,
            },
          ]),
        );
    };

    const setupIModelForElementProps = (props?: { key?: InstanceKey; parentKey?: InstanceKey }) => {
      const key = props?.key ?? createRandomECInstanceKey();
      const elementProps = {
        ...(props?.parentKey ? createRandomElementProps(props.parentKey.id) : createRandomTopmostElementProps()),
        classFullName: key.className,
        id: key.id,
      };
      elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => elementProps);
      return { key, props: elementProps };
    };

    const setupIModelDerivesFromClassQuery = (doesDeriveFromSuppliedClass: boolean) => {
      const classDerivesFromQueryIdentifier = "SELECT 1";
      imodelMock
        .setup((x) =>
          x.createQueryReader(
            moq.It.is((q) => typeof q === "string" && q.includes(classDerivesFromQueryIdentifier)),
            moq.It.isAny(),
          ),
        )
        .returns(() => stubECSqlReader(doesDeriveFromSuppliedClass ? [{}] : []));
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
      await expect(SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [], "invalid")).to.eventually.be.rejected;
    });

    describe("scope: 'element'", () => {
      it("returns element keys", async () => {
        const keys = [createRandomECInstanceKey(), createRandomECInstanceKey()];
        keys.forEach((key) => setupIModelForElementProps({ key }));

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
        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          keys.map((k) => k.id),
          "element",
        );
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const keys = [createRandomECInstanceKey(), { className: "any:class", id: createTransientElementId() }];
        setupIModelForElementProps({ key: keys[0] });

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
        setupIModelForElementProps({ key: validKeys[0] });
        setupIModelForElementProps({ key: validKeys[1] });

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [validKeys[0].id, "not an id", validKeys[1].id], "element");
        expect(result.size).to.eq(2);
        validKeys.forEach((key) => expect(result.has(key)));
      });

      it("returns nth parent key", async () => {
        const parent3 = setupIModelForElementProps({ key: createRandomECInstanceKey() });
        const parent2 = setupIModelForElementProps({ key: createRandomECInstanceKey(), parentKey: parent3.key });
        const parent1 = setupIModelForElementProps({ key: createRandomECInstanceKey(), parentKey: parent2.key });
        const element = setupIModelForElementProps({ key: createRandomECInstanceKey(), parentKey: parent1.key });
        setupIModelForElementProps({ key: parent2.key });

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
        parentKeys.forEach((key) => setupIModelForElementProps({ key }));
        const elementKeys = parentKeys.map((pk) => setupIModelForElementProps({ parentKey: pk }).key);
        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          elementKeys.map(({ id }) => id),
          "assembly",
        );
        expect(result.size).to.eq(2);
        parentKeys.forEach((key) => expect(result.has(key)).to.be.true);
      });

      it("does not duplicate keys", async () => {
        const { key: parentKey } = setupIModelForElementProps();
        const elementKeys = [setupIModelForElementProps({ parentKey }).key, setupIModelForElementProps({ parentKey }).key];
        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          elementKeys.map(({ id }) => id),
          "assembly",
        );
        expect(result.size).to.eq(1);
        expect(result.has(parentKey)).to.be.true;
      });

      it("returns element key if it has no parent", async () => {
        const key = createRandomECInstanceKey();
        setupIModelForElementProps({ key });
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [key.id], "assembly");
        expect(result.size).to.eq(1);
        expect(result.has(key)).to.be.true;
      });

      it("skips non-existing element ids", async () => {
        const key = createRandomECInstanceKey();
        elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => undefined);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [key.id], "assembly");
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const { key: parentKey } = setupIModelForElementProps();
        const { key: elementKey } = setupIModelForElementProps({ parentKey });
        const ids = [elementKey.id, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, ids, "assembly");
        expect(result.size).to.eq(1);
        expect(result.has(parentKey)).to.be.true;
      });
    });

    describe("scope: 'top-assembly'", () => {
      it("returns topmost parent key", async () => {
        const { key: grandparentKey } = setupIModelForElementProps();
        const { key: parentKey } = setupIModelForElementProps({ parentKey: grandparentKey });
        const { key: elementKey } = setupIModelForElementProps({ parentKey });
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [elementKey.id], "top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(grandparentKey)).to.be.true;
      });

      it("returns element key if it has no parent", async () => {
        const { key } = setupIModelForElementProps();
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [key.id], "top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(key)).to.be.true;
      });

      it("skips non-existing element ids", async () => {
        const key = createRandomECInstanceKey();
        elementsMock.setup((x) => x.tryGetElementProps(key.id)).returns(() => undefined);
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [key.id], "top-assembly");
        expect(result.size).to.eq(0);
      });

      it("skips transient element ids", async () => {
        const { key: parentKey } = setupIModelForElementProps();
        const { key: elementKey } = setupIModelForElementProps({ parentKey });
        const ids = [elementKey.id, createTransientElementId()];
        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, ids, "top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(parentKey)).to.be.true;
      });
    });

    describe("scope: 'category'", () => {
      it("returns category key", async () => {
        const category = createRandomElementProps();
        const elementId = createRandomId();
        const element = {
          id: elementId,
          classFullName: faker.random.word(),
          model: createRandomId(),
          category: category.id!,
          code: { scope: faker.random.word(), spec: faker.random.word() },
        } as DrawingGraphic;
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
        const element = {
          id: elementId,
          classFullName: faker.random.word(),
          model: createRandomId(),
          category: categoryId,
          code: { scope: faker.random.word(), spec: faker.random.word() },
        } as DrawingGraphic;
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
        const element = {
          id: elementId,
          classFullName: faker.random.word(),
          model: createRandomId(),
          category: category.id!,
          code: { scope: faker.random.word(), spec: faker.random.word() },
        } as DrawingGraphic;
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
        const element = {
          id: elementId,
          classFullName: faker.random.word(),
          model: model.id!,
          category: createRandomId(),
          code: { scope: faker.random.word(), spec: faker.random.word() },
        } as GeometricElement2dProps;
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
        const element = {
          id: elementId,
          classFullName: faker.random.word(),
          model: modelId,
          category: createRandomId(),
          code: { scope: faker.random.word(), spec: faker.random.word() },
        } as GeometricElement2dProps;
        elementsMock.setup((x) => x.tryGetElementProps(elementId)).returns(() => element);
        modelsMock.setup((x) => x.tryGetModelProps(modelId)).returns(() => undefined);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [elementId], "model");
        expect(result.isEmpty).to.be.true;
      });

      it("skips transient element ids", async () => {
        const model = createRandomModelProps();
        const elementId = createRandomId();
        const element = {
          id: elementId,
          classFullName: faker.random.word(),
          model: model.id!,
          category: createRandomId(),
          code: { scope: faker.random.word(), spec: faker.random.word() },
        } as GeometricElement2dProps;
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
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns functional element key if GeometricElement3d has an associated functional element", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-element");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional");
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

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-element");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns functional element key if GeometricElement2d has an associated functional element", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const graphicalElementKey = createRandomECInstanceKey();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-element");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns functional element key of the first GeometricElement2d parent that has related functional element", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-element");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("skips transient element ids", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection(
          { imodel: imodelMock.object },
          [graphicalElementKey.id, createTransientElementId()],
          "functional-element",
        );
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });
    });

    describe("scope: 'functional-assembly'", () => {
      it("returns GeometricElement3d key if it doesn't have a parent", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns GeometricElement3d parent key if it doesn't have a related functional element", async () => {
        const { key: graphicalParentElementKey } = setupIModelForElementProps();
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalParentElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalParentElementKey)).to.be.true;
      });

      it("returns functional element key of GeometricElement3d parent", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
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

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
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

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
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

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(functionalParentElementKey)).to.be.true;
      });
    });

    describe("scope: 'functional-top-assembly'", () => {
      it("returns GeometricElement3d key if it doesn't have a parent", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalElementKey)).to.be.true;
      });

      it("returns topmost GeometricElement3d parent key if it doesn't have a related functional element", async () => {
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(graphicalGrandParentElementKey)).to.be.true;
      });

      it("returns functional element key of the topmost GeometricElement3d parent", async () => {
        const functionalElementKey = createRandomECInstanceKey();
        const { key: graphicalGrandParentElementKey } = setupIModelForElementProps();
        const { key: graphicalParentElementKey } = setupIModelForElementProps({ parentKey: graphicalGrandParentElementKey });
        const { key: graphicalElementKey } = setupIModelForElementProps({ parentKey: graphicalParentElementKey });
        setupIModelForFunctionalKeyQuery({ graphicalElementKey: graphicalGrandParentElementKey, functionalElementKey });
        setupIModelDerivesFromClassQuery(true);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(functionalElementKey)).to.be.true;
      });

      it("returns GeometricElement2d key if it doesn't have an associated functional element or parent", async () => {
        const { key: graphicalElementKey } = setupIModelForElementProps();
        setupIModelForFunctionalKeyQuery({ graphicalElementKey });
        setupIModelDerivesFromClassQuery(false);

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
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

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
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

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
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

        const result = await SelectionScopesHelper.computeSelection({ imodel: imodelMock.object }, [graphicalElementKey.id], "functional-top-assembly");
        expect(result.size).to.eq(1);
        expect(result.has(functionalGrandParentElementKey)).to.be.true;
      });
    });
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { firstValueFrom, toArray } from "rxjs";
import * as sinon from "sinon";
import { IModelDb } from "@itwin/core-backend";
import { QueryBinder } from "@itwin/core-common";
import { Field, PresentationError } from "@itwin/presentation-common";
import {
  createTestContentDescriptor,
  createTestECClassInfo,
  createTestNestedContentField,
  createTestRelatedClassInfo,
  createTestSimpleContentField,
} from "@itwin/presentation-common/test-utils";
import {
  getContentItemsObservableFromClassNames,
  getContentItemsObservableFromElementIds,
  getElementsCount,
} from "../presentation-backend/ElementPropertiesHelper.js";
import { stubECSqlReader } from "./Helpers.js";

describe("getElementsCount", () => {
  let imodelMock: ReturnType<typeof stubIModel>;
  let imodel: IModelDb;

  beforeEach(() => {
    imodelMock = stubIModel();
    imodel = imodelMock as unknown as IModelDb;
  });

  function stubIModel() {
    return {
      createQueryReader: sinon.stub(),
    };
  }

  it("returns 0 when statement has no rows", async () => {
    imodelMock.createQueryReader.withArgs(sinon.match.string).returns(stubECSqlReader([]));
    expect(await getElementsCount(imodel, [])).to.be.eq(0);
  });

  it("returns count when statement has row", async () => {
    const elementCount = 3;
    imodelMock.createQueryReader.withArgs(sinon.match.string).returns(stubECSqlReader([{ elementCount }]));
    expect(await getElementsCount(imodel, [])).to.be.eq(elementCount);
  });

  it("adds WHERE clause when class list is defined and not empty", async () => {
    imodelMock.createQueryReader.withArgs(sinon.match((query: string) => query.includes("WHERE"))).returns(stubECSqlReader([]));
    await getElementsCount(imodel, ["TestSchema:TestClass"]);
    expect(imodelMock.createQueryReader).to.be.calledOnce;
  });

  it("throws if class list contains invalid class name", async () => {
    await expect(getElementsCount(imodel, ["'TestSchema:TestClass'"])).to.eventually.be.rejectedWith(PresentationError);
    await expect(getElementsCount(imodel, ["%TestSchema:TestClass%"])).to.eventually.be.rejectedWith(PresentationError);
    await expect(getElementsCount(imodel, ["TestSchema:TestClass  "])).to.eventually.be.rejectedWith(PresentationError);
  });
});

describe("content item batching", () => {
  const descriptor = createTestContentDescriptor({ fields: [] });
  const contentDescriptorGetter = sinon.stub().resolves(descriptor);
  const contentSetGetter = sinon.stub().resolves([]);

  beforeEach(() => {
    contentDescriptorGetter.resetHistory();
    contentSetGetter.resetHistory();
  });

  it("uses request-local ranges when loading supplied element IDs", async () => {
    const imodel = {
      createQueryReader: sinon.stub().returns(stubECSqlReader([{ className: "TestSchema:TestClass", ids: "0x1,0x2,0x3" }])),
    } as unknown as IModelDb;

    await firstValueFrom(
      getContentItemsObservableFromElementIds(imodel, contentDescriptorGetter, contentSetGetter, ["0x1", "0x2", "0x3"], 1, 1, 2).itemBatches.pipe(toArray()),
    );

    expect(contentSetGetter).to.have.been.calledTwice;
    expect(contentSetGetter.firstCall.args[0].descriptor.instanceFilter).to.deep.equal({
      selectClassName: "TestSchema:TestClass",
      expression: "this.ECInstanceId >= 0x1 AND this.ECInstanceId <= 0x2",
    });
    expect(contentSetGetter.secondCall.args[0].descriptor.instanceFilter.expression).to.equal("this.ECInstanceId = 0x3");
  });

  for (const { ids, expression } of [
    { ids: ["0x3"], expression: "this.ECInstanceId = 0x3" },
    { ids: ["0x1", "0x3", "0x5"], expression: "this.ECInstanceId = 0x1 OR this.ECInstanceId = 0x3 OR this.ECInstanceId = 0x5" },
    {
      ids: ["0x1", "0x2", "0x5", "0x6"],
      expression: "this.ECInstanceId >= 0x1 AND this.ECInstanceId <= 0x2 OR this.ECInstanceId >= 0x5 AND this.ECInstanceId <= 0x6",
    },
    { ids: ["0x10", "0x2", "0x1"], expression: "this.ECInstanceId >= 0x1 AND this.ECInstanceId <= 0x2 OR this.ECInstanceId = 0x10" },
    { ids: ["0x10000000001", "0x20000000002"], expression: "this.ECInstanceId = 0x10000000001 OR this.ECInstanceId = 0x20000000002" },
    { ids: ["0x20000000000001", "0x20000000000002"], expression: "this.ECInstanceId >= 0x20000000000001 AND this.ECInstanceId <= 0x20000000000002" },
  ]) {
    it(`creates exact ID ranges for ${ids.join(",")}`, async () => {
      const imodel = {
        createQueryReader: sinon.stub().returns(stubECSqlReader([{ className: "TestSchema:TestClass", ids: ids.join(",") }])),
      } as unknown as IModelDb;
      await firstValueFrom(
        getContentItemsObservableFromElementIds(imodel, contentDescriptorGetter, contentSetGetter, ids, 1, 1, 10).itemBatches.pipe(toArray()),
      );
      expect(contentSetGetter).to.have.been.calledOnce;
      expect(contentSetGetter.firstCall.args[0].descriptor.instanceFilter.expression).to.equal(expression);
    });
  }

  it("does not request content for an empty ID list", async () => {
    const imodel = { createQueryReader: sinon.stub() } as unknown as IModelDb;
    const batches = await firstValueFrom(
      getContentItemsObservableFromElementIds(imodel, contentDescriptorGetter, contentSetGetter, [], 1, 1, 2).itemBatches.pipe(toArray()),
    );
    expect(batches).to.be.empty;
    expect(contentDescriptorGetter).not.to.have.been.called;
    expect(contentSetGetter).not.to.have.been.called;
  });
});

describe("batch aspect field selection", () => {
  const elementClass = createTestECClassInfo({ id: "0xe", name: "TestSchema:TestClass" });
  function aspectField(id: string, childCount = 1, unique = false) {
    const contentClassInfo = createTestECClassInfo({ id, name: `TestSchema:Aspect${id}` });
    return createTestNestedContentField({
      name: `aspect-${id}`,
      contentClassInfo,
      pathToPrimaryClass: [
        createTestRelatedClassInfo({
          sourceClassInfo: contentClassInfo,
          targetClassInfo: elementClass,
          relationshipInfo: createTestECClassInfo({ name: unique ? "BisCore:ElementOwnsUniqueAspect" : "BisCore:ElementOwnsMultiAspects" }),
          isForwardRelationship: false,
        }),
      ],
      nestedFields: Array.from({ length: childCount }, (_, index) => createTestSimpleContentField({ name: `${id}-property-${index}` })),
    });
  }

  function setup(fields: Field[], memberships: string[][] = [[], []], mode: "classNames" | "elementIds" = "classNames", ids = ["0x1", "0x2", "0x3"]) {
    const descriptor = createTestContentDescriptor({ fields });
    const descriptorGetter = sinon.stub().resolves(descriptor);
    const contentGetter = sinon.stub().resolves([]);
    const membershipReader = sinon.stub().callsFake(() => stubECSqlReader((memberships[membershipReader.callCount - 1] ?? []).map((classId) => ({ classId }))));
    const reader = sinon.stub().callsFake((query: string, binder?: QueryBinder) => {
      if (query.includes("WITH aspectClasses")) {
        return membershipReader(query, binder);
      }
      if (query.includes("COUNT(e.ECInstanceId)")) {
        return stubECSqlReader([{ elementCount: ids.length }]);
      }
      if (query.includes("ec_classname")) {
        return stubECSqlReader([{ className: elementClass.name, ids: ids.join(",") }]);
      }
      if (query.includes("FROM ONLY [TestSchema].[TestClass]")) {
        return stubECSqlReader(ids.map((id) => ({ id })));
      }
      throw new Error(`Unexpected query: ${query}`);
    });
    const imodel = { createQueryReader: reader } as unknown as IModelDb;
    const getContentItems = async () => {
      const response = mode === "elementIds"
        ? getContentItemsObservableFromElementIds(imodel, descriptorGetter, contentGetter, ids, 1, 2, 2)
        : getContentItemsObservableFromClassNames(imodel, descriptorGetter, contentGetter, [elementClass.name], 1, 2, 2);
      return firstValueFrom(response.itemBatches.pipe(toArray()));
    };
    return { descriptor, descriptorGetter, contentGetter, membershipReader, reader, getContentItems };
  }

  for (const mode of ["classNames", "elementIds"] as const) {
    it(`uses independent batch selectors when requesting ${mode === "elementIds" ? "element IDs" : "class names"}`, async () => {
      const a = aspectField("0xa", 1000);
      const b = aspectField("0xb", 1, true);
      const base = createTestSimpleContentField();
      const test = setup([base, a, b], [["0xa"], ["0xb"]], mode);
      const batches = await test.getContentItems();
      expect(test.descriptorGetter).to.have.been.calledOnce;
      expect(test.membershipReader).to.have.been.calledTwice;
      expect(test.membershipReader.firstCall.args[1]).to.deep.equal(QueryBinder.from({ elementIds: ["0x1", "0x2"] }));
      expect(test.membershipReader.secondCall.args[1]).to.deep.equal(QueryBinder.from({ elementIds: ["0x3"] }));
      expect(test.membershipReader.firstCall.args[0]).to.include("meta.ClassHasAllBaseClasses");
      expect(test.membershipReader.firstCall.args[0]).to.include("bis.ElementMultiAspect");
      expect(test.membershipReader.firstCall.args[0]).to.include("bis.ElementUniqueAspect");
      for (let index = 0; index < 2; ++index) {
        const request = test.contentGetter.getCall(index).args[0];
        expect(request.rulesetOrId).to.equal(test.descriptorGetter.firstCall.args[0].rulesetOrId);
        expect(request.descriptor).to.equal(batches[index].descriptor);
        expect(request.descriptor).not.to.equal(test.descriptor);
        expect(request.descriptor.instanceFilter).to.deep.equal({
          selectClassName: elementClass.name,
          expression: index === 0 ? "this.ECInstanceId >= 0x1 AND this.ECInstanceId <= 0x2" : "this.ECInstanceId = 0x3",
        });
        expect(request.descriptor.selectedFields.map((field: Field) => field.name)).to.deep.equal([base.name, index === 0 ? a.name : b.name]);
      }
      expect(test.descriptor.fieldsSelector).to.be.undefined;
      expect(test.descriptor.instanceFilter).to.be.undefined;
      expect(test.descriptor.selectedFields).to.deep.equal([base, a, b]);
    });
  }

  it("uses one ordered interval per class-name batch, including gaps", async () => {
    const test = setup([], undefined, "classNames", ["0x1", "0x3", "0x9"]);
    await test.getContentItems();
    expect(test.reader).to.have.been.calledWith("SELECT IdToHex(ECInstanceId) id FROM ONLY [TestSchema].[TestClass] ORDER BY ECInstanceId");
    expect(test.contentGetter.firstCall.args[0].descriptor.instanceFilter.expression).to.equal("this.ECInstanceId >= 0x1 AND this.ECInstanceId <= 0x3");
    expect(test.contentGetter.secondCall.args[0].descriptor.instanceFilter.expression).to.equal("this.ECInstanceId = 0x9");
  });

  it("retains the union of aspect classes and inherited fields for a mixed batch", async () => {
    const a = aspectField("0xa", 1000);
    const b = aspectField("0xb");
    const test = setup([a, b], [["0xa1", "0xa", "0xb"], []]);
    const batches = await test.getContentItems();
    expect(batches.find((batch) => !batch.descriptor.fieldsSelector)?.descriptor.selectedFields).to.deep.equal(test.descriptor.fields);
    expect(batches.find((batch) => batch.descriptor.fieldsSelector)?.descriptor.selectedFields).to.be.empty;
  });

  it("does not query membership at the recursive 1000-field threshold", async () => {
    const test = setup([aspectField("0xa", 999)]);
    const batches = await test.getContentItems();
    expect(test.membershipReader).not.to.have.been.called;
    for (const batch of batches) {
      expect(batch.descriptor.selectedFields).to.deep.equal(test.descriptor.fields);
    }
  });

  it("preserves unrelated and ambiguous relationship paths", async () => {
    const eligible = aspectField("0xa", 1000);
    const unrelated = aspectField("0xb");
    unrelated.pathToPrimaryClass[0].relationshipInfo = createTestECClassInfo({ name: "TestSchema:OtherRelationship" });
    const forward = aspectField("0xc");
    forward.pathToPrimaryClass[0].isForwardRelationship = true;
    const multipleSteps = aspectField("0xd");
    multipleSteps.pathToPrimaryClass.push(createTestRelatedClassInfo());
    const otherOwner = aspectField("0xe");
    otherOwner.pathToPrimaryClass[0].targetClassInfo = createTestECClassInfo({ name: "TestSchema:OtherClass" });
    const differentSource = aspectField("0xf");
    differentSource.pathToPrimaryClass[0].sourceClassInfo = createTestECClassInfo({ id: "0x10" });
    const preserved = [unrelated, forward, multipleSteps, otherOwner, differentSource];
    const test = setup([eligible, ...preserved]);
    const batches = await test.getContentItems();
    expect(batches[0].descriptor.selectedFields.map((field) => field.name)).to.deep.equal(preserved.map((field) => field.name));
  });

  it("does not query membership when no fields can be safely pruned", async () => {
    const field = aspectField("0xa", 1000);
    field.pathToPrimaryClass = [];
    const test = setup([field]);
    await test.getContentItems();
    expect(test.membershipReader).not.to.have.been.called;
  });

  for (const type of ["include", "exclude"] as const) {
    it(`preserves caller ${type} field selection`, async () => {
      const field = aspectField("0xa", 1000);
      const test = setup([field]);
      test.descriptor.fieldsSelector = { type, fields: [field.getFieldDescriptor()] };
      const batches = await test.getContentItems();
      expect(test.membershipReader).not.to.have.been.called;
      for (const batch of batches) {
        expect(batch.descriptor.fieldsSelector).to.deep.equal(test.descriptor.fieldsSelector);
        expect(batch.descriptor.selectedFields).to.deep.equal(test.descriptor.selectedFields);
      }
      expect(test.descriptor.fieldsSelector).to.deep.equal({ type, fields: [field.getFieldDescriptor()] });
    });
  }

  it("propagates membership query failures without loading unfiltered values", async () => {
    const test = setup([aspectField("0xa", 1000)]);
    test.membershipReader.throws(new Error("membership query failed"));
    await expect(test.getContentItems()).to.eventually.be.rejectedWith("membership query failed");
    expect(test.contentGetter).not.to.have.been.called;
  });

  it("reports missing class descriptor", async () => {
    const test = setup([]);
    test.descriptorGetter.resolves(undefined);
    await expect(test.getContentItems()).to.eventually.be.rejectedWith(PresentationError, "Failed to get descriptor");
    expect(test.contentGetter).not.to.have.been.called;
  });
});

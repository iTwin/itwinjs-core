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

  /**
   * Creates a row, as returned by the element classes query, for given requested IDs. Each ID is paired with the ID
   * of the previous instance of the same class. IDs are kept in given order to simulate `GROUP_CONCAT` output.
   */
  function createClassRow(ids: string[], classInstanceIds: string[], className = "TestSchema:TestClass") {
    return {
      className,
      ids: ids
        .map((id) => {
          const index = classInstanceIds.indexOf(id);
          return `${id}:${index > 0 ? classInstanceIds[index - 1] : ""}`;
        })
        .join(","),
    };
  }

  function stubIModelForElementIds(ids: string[], classInstanceIds: string[]) {
    const createQueryReader = sinon.stub().returns(stubECSqlReader([createClassRow(ids, classInstanceIds)]));
    return { imodel: { createQueryReader } as unknown as IModelDb, createQueryReader };
  }

  /** Creates an async iterable of rows that resolves after given delay, to control order of query results. */
  function delayedReader<TRow>(rows: TRow[], delayMs: number): AsyncIterable<TRow> {
    return {
      async *[Symbol.asyncIterator]() {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        yield* rows;
      },
    };
  }

  it("uses request-local ranges when loading supplied element IDs", async () => {
    const { imodel } = stubIModelForElementIds(["0x1", "0x2", "0x3"], ["0x1", "0x2", "0x3"]);

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

  it("queries element classes and previous class instance IDs for sorted chunks of element IDs", async () => {
    const createQueryReader = sinon.stub().returns(stubECSqlReader([]));
    const imodel = { createQueryReader } as unknown as IModelDb;
    const ids = Array.from({ length: 5001 }, (_, i) => `0x${(5001 - i).toString(16)}`);
    await firstValueFrom(
      getContentItemsObservableFromElementIds(imodel, contentDescriptorGetter, contentSetGetter, ids, 1, 1, 10).itemBatches.pipe(toArray()),
    );
    expect(createQueryReader).to.have.been.calledTwice;
    expect(createQueryReader.firstCall.args[0]).to.include("WHERE p.ECClassId = e.ECClassId AND p.ECInstanceId < e.ECInstanceId");
    expect(createQueryReader.firstCall.args[0]).to.include("GROUP BY e.ECClassId");
    const sortedIds = [...ids].reverse();
    expect(createQueryReader.firstCall.args[1]).to.deep.equal(new QueryBinder().bindIdSet("elementIds", sortedIds.slice(0, 5000)));
    expect(createQueryReader.secondCall.args[1]).to.deep.equal(new QueryBinder().bindIdSet("elementIds", sortedIds.slice(5000)));
  });

  it("combines element IDs of the same class from multiple chunks in ID order, regardless of chunk results order", async () => {
    const ids = Array.from({ length: 10001 }, (_, i) => `0x${(i + 1).toString(16)}`);
    const createQueryReader = sinon.stub();
    // first chunk resolves last
    createQueryReader.onCall(0).returns(delayedReader([createClassRow(["0x2", "0x1"], ["0x1", "0x2"])], 20));
    // second chunk has no elements of the class
    createQueryReader.onCall(1).returns(stubECSqlReader([createClassRow(["0x2000"], ["0x2000"], "TestSchema:Other")]));
    createQueryReader.onCall(2).returns(stubECSqlReader([createClassRow(["0x2711"], ["0x1", "0x2", "0x2711"])]));
    const imodel = { createQueryReader } as unknown as IModelDb;
    await firstValueFrom(
      getContentItemsObservableFromElementIds(imodel, contentDescriptorGetter, contentSetGetter, ids, 1, 1, 10).itemBatches.pipe(toArray()),
    );
    expect(createQueryReader).to.have.been.calledThrice;
    const testClassRequest = contentSetGetter.getCalls().find((call) => call.args[0].descriptor.instanceFilter.selectClassName === "TestSchema:TestClass");
    expect(testClassRequest!.args[0].descriptor.instanceFilter.expression).to.equal("this.ECInstanceId >= 0x1 AND this.ECInstanceId <= 0x2711");
  });

  for (const { ids, classInstanceIds, expression } of [
    { ids: ["0x3"], classInstanceIds: ["0x1", "0x3"], expression: "this.ECInstanceId = 0x3" },
    {
      ids: ["0x1", "0x3", "0x5"],
      classInstanceIds: ["0x1", "0x2", "0x3", "0x4", "0x5"],
      expression: "this.ECInstanceId = 0x1 OR this.ECInstanceId = 0x3 OR this.ECInstanceId = 0x5",
    },
    {
      ids: ["0x1", "0x2", "0x5", "0x6"],
      classInstanceIds: ["0x1", "0x2", "0x3", "0x5", "0x6"],
      expression: "this.ECInstanceId >= 0x1 AND this.ECInstanceId <= 0x2 OR this.ECInstanceId >= 0x5 AND this.ECInstanceId <= 0x6",
    },
    {
      ids: ["0x10", "0x2", "0x1"],
      classInstanceIds: ["0x1", "0x2", "0x3", "0x10"],
      expression: "this.ECInstanceId >= 0x1 AND this.ECInstanceId <= 0x2 OR this.ECInstanceId = 0x10",
    },
    {
      ids: ["0x10000000001", "0x20000000002"],
      classInstanceIds: ["0x10000000001", "0x10000000002", "0x20000000002"],
      expression: "this.ECInstanceId = 0x10000000001 OR this.ECInstanceId = 0x20000000002",
    },
    {
      ids: ["0x20000000000001", "0x20000000000002"],
      classInstanceIds: ["0x20000000000001", "0x20000000000002"],
      expression: "this.ECInstanceId >= 0x20000000000001 AND this.ECInstanceId <= 0x20000000000002",
    },
    {
      ids: ["0x1", "0x3", "0x5"],
      classInstanceIds: ["0x1", "0x3", "0x5"],
      expression: "this.ECInstanceId >= 0x1 AND this.ECInstanceId <= 0x5",
    },
    {
      ids: ["0x1", "0x3", "0x5", "0x7"],
      classInstanceIds: ["0x1", "0x3", "0x4", "0x5", "0x7"],
      expression: "this.ECInstanceId >= 0x1 AND this.ECInstanceId <= 0x3 OR this.ECInstanceId >= 0x5 AND this.ECInstanceId <= 0x7",
    },
    {
      ids: ["0x10000000001", "0x20000000002"],
      classInstanceIds: ["0x10000000001", "0x20000000002"],
      expression: "this.ECInstanceId >= 0x10000000001 AND this.ECInstanceId <= 0x20000000002",
    },
  ]) {
    it(`creates exact ID ranges for ${ids.join(",")} when class instances are ${classInstanceIds.join(",")}`, async () => {
      const { imodel } = stubIModelForElementIds(ids, classInstanceIds);
      await firstValueFrom(
        getContentItemsObservableFromElementIds(imodel, contentDescriptorGetter, contentSetGetter, ids, 1, 1, 10).itemBatches.pipe(toArray()),
      );
      expect(contentSetGetter).to.have.been.calledOnce;
      expect(contentSetGetter.firstCall.args[0].descriptor.instanceFilter.expression).to.equal(expression);
    });
  }

  it("requests content separately for every class", async () => {
    const createQueryReader = sinon
      .stub()
      .returns(
        stubECSqlReader([createClassRow(["0x1", "0x3"], ["0x1", "0x3"], "TestSchema:A"), createClassRow(["0x2", "0x4"], ["0x2", "0x4"], "TestSchema:B")]),
      );
    const imodel = { createQueryReader } as unknown as IModelDb;
    await firstValueFrom(
      getContentItemsObservableFromElementIds(imodel, contentDescriptorGetter, contentSetGetter, ["0x1", "0x2", "0x3", "0x4"], 1, 1, 10).itemBatches.pipe(
        toArray(),
      ),
    );
    expect(contentSetGetter).to.have.been.calledTwice;
    expect(contentSetGetter.firstCall.args[0].descriptor.instanceFilter).to.deep.equal({
      selectClassName: "TestSchema:A",
      expression: "this.ECInstanceId >= 0x1 AND this.ECInstanceId <= 0x3",
    });
    expect(contentSetGetter.secondCall.args[0].descriptor.instanceFilter).to.deep.equal({
      selectClassName: "TestSchema:B",
      expression: "this.ECInstanceId >= 0x2 AND this.ECInstanceId <= 0x4",
    });
  });

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
      if (query.includes("IdSet(:elementIds)")) {
        return stubECSqlReader([{ className: elementClass.name, ids: ids.map((id, i) => `${id}:${i > 0 ? ids[i - 1] : ""}`).join(",") }]);
      }
      if (query.includes("ec_classname")) {
        return stubECSqlReader([{ className: elementClass.name }]);
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

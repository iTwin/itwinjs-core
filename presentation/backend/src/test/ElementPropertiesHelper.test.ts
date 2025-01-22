/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { firstValueFrom, toArray } from "rxjs";
import * as moq from "typemoq";
import { ECSqlStatement, ECSqlValue, IModelDb } from "@itwin/core-backend";
import { DbResult } from "@itwin/core-bentley";
import { PresentationError } from "@itwin/presentation-common";
import { createIdBatches, getBatchedClassElementIds, getElementsCount } from "../presentation-backend/ElementPropertiesHelper";
import { stubECSqlReader } from "./Helpers";

describe("getElementsCount", () => {
  const imodelMock = moq.Mock.ofType<IModelDb>();
  beforeEach(() => {
    imodelMock.reset();
  });

  it("returns 0 when statement has no rows", () => {
    imodelMock
      .setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny()))
      .returns((_q, cb) => {
        const statementMock = moq.Mock.ofType<ECSqlStatement>();
        statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_DONE);
        return cb(statementMock.object);
      });
    expect(getElementsCount(imodelMock.object, [])).to.be.eq(0);
  });

  it("returns count when statement has row", () => {
    const elementCount = 3;
    imodelMock
      .setup((x) => x.withPreparedStatement(moq.It.isAnyString(), moq.It.isAny()))
      .returns((_q, cb) => {
        const valueMock = moq.Mock.ofType<ECSqlValue>();
        valueMock.setup((x) => x.getInteger()).returns(() => elementCount);
        const statementMock = moq.Mock.ofType<ECSqlStatement>();
        statementMock.setup((x) => x.step()).returns(() => DbResult.BE_SQLITE_ROW);
        statementMock.setup((x) => x.getValue(0)).returns(() => valueMock.object);
        return cb(statementMock.object);
      });
    expect(getElementsCount(imodelMock.object, [])).to.be.eq(elementCount);
  });

  it("adds WHERE clause when class list is defined and not empty", () => {
    imodelMock
      .setup((x) =>
        x.withPreparedStatement(
          moq.It.is((query) => query.includes("WHERE")),
          moq.It.isAny(),
        ),
      )
      .returns(() => 0)
      .verifiable();
    getElementsCount(imodelMock.object, ["TestSchema:TestClass"]);
    imodelMock.verifyAll();
  });

  it("throws if class list contains invalid class name", () => {
    expect(() => getElementsCount(imodelMock.object, ["'TestSchema:TestClass'"])).to.throw(PresentationError);
    expect(() => getElementsCount(imodelMock.object, ["%TestSchema:TestClass%"])).to.throw(PresentationError);
    expect(() => getElementsCount(imodelMock.object, ["TestSchema:TestClass  "])).to.throw(PresentationError);
  });
});

describe("createIdBatches", () => {
  it("returns empty list when given no ids", async () => {
    expect(await firstValueFrom(createIdBatches([], 2).pipe(toArray()))).to.be.deep.eq([]);
  });

  it("creates a batch from one element id", async () => {
    expect(await firstValueFrom(createIdBatches(["0x3"], 10).pipe(toArray()))).to.be.deep.eq([[{ from: "0x3", to: "0x3" }]]);
  });

  it("creates a batch from sequential element ids, when `batchSize` is larger than the number of ids", async () => {
    expect(await firstValueFrom(createIdBatches(["0x1", "0x2", "0x3", "0x4", "0x5"], 10).pipe(toArray()))).to.be.deep.eq([[{ from: "0x1", to: "0x5" }]]);
  });

  it("creates a batch of non-sequential element ids, when `batchSize` is larger than the number of ids", async () => {
    expect(await firstValueFrom(createIdBatches(["0x1", "0x3", "0x5", "0x7", "0x9"], 10).pipe(toArray()))).to.be.deep.eq([
      [
        { from: "0x1", to: "0x1" },
        { from: "0x3", to: "0x3" },
        { from: "0x5", to: "0x5" },
        { from: "0x7", to: "0x7" },
        { from: "0x9", to: "0x9" },
      ],
    ]);
  });

  it("creates a batch with last sequence consisting of more than 1 element", async () => {
    expect(await firstValueFrom(createIdBatches(["0x1", "0x2", "0x3", "0x5", "0x6"], 10).pipe(toArray()))).to.be.deep.eq([
      [
        { from: "0x1", to: "0x3" },
        { from: "0x5", to: "0x6" },
      ],
    ]);
  });

  it("creates a batch with last sequence consisting of 1 element", async () => {
    expect(await firstValueFrom(createIdBatches(["0x1", "0x2", "0x9"], 10).pipe(toArray()))).to.be.deep.eq([
      [
        { from: "0x1", to: "0x2" },
        { from: "0x9", to: "0x9" },
      ],
    ]);
  });

  it("creates multiple batches", async () => {
    expect(await firstValueFrom(createIdBatches(["0x1", "0x2", "0x3", "0x4", "0x5"], 2).pipe(toArray()))).to.be.deep.eq([
      [{ from: "0x1", to: "0x2" }],
      [{ from: "0x3", to: "0x4" }],
      [{ from: "0x5", to: "0x5" }],
    ]);
  });
});

describe("getBatchedClassElementIds", () => {
  const imodelMock = moq.Mock.ofType<IModelDb>();
  beforeEach(() => {
    imodelMock.reset();
  });

  it("returns empty list when statement has no rows", async () => {
    imodelMock.setup((x) => x.createQueryReader(moq.It.isAnyString())).returns(() => stubECSqlReader([]));
    expect(await firstValueFrom(getBatchedClassElementIds(imodelMock.object, "x.y", 2).pipe(toArray()))).to.be.deep.eq([]);
  });

  it("returns batches", async () => {
    const elements = [{ id: "0x1" }, { id: "0x2" }, { id: "0x3" }, { id: "0x4" }, { id: "0x5" }];
    imodelMock.setup((x) => x.createQueryReader(moq.It.isAnyString())).returns(() => stubECSqlReader(elements));
    expect(await firstValueFrom(getBatchedClassElementIds(imodelMock.object, "x.y", 2).pipe(toArray()))).to.be.deep.eq([
      [{ from: "0x1", to: "0x2" }],
      [{ from: "0x3", to: "0x4" }],
      [{ from: "0x5", to: "0x5" }],
    ]);
  });
});

/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { ECSqlStatement, ECSqlValue, IModelDb } from "@itwin/core-backend";
import { DbResult } from "@itwin/core-bentley";
import { PresentationError } from "@itwin/presentation-common";
import { getBatchedClassElementIds, getClassesWithInstances, getElementsCount } from "../presentation-backend/ElementPropertiesHelper";
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
    expect(getElementsCount(imodelMock.object)).to.be.eq(0);
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
    expect(getElementsCount(imodelMock.object)).to.be.eq(elementCount);
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

describe("getBatchedClassElementIds", () => {
  const imodelMock = moq.Mock.ofType<IModelDb>();
  beforeEach(() => {
    imodelMock.reset();
  });

  it("returns empty list when statement has no rows", async () => {
    imodelMock.setup((x) => x.createQueryReader(moq.It.isAnyString())).returns(() => stubECSqlReader([]));
    expect(await getBatchedClassElementIds(imodelMock.object, "x.y", 2)).to.be.deep.eq([]);
  });

  it("returns batches", async () => {
    const elements = [{ id: "0x1" }, { id: "0x2" }, { id: "0x3" }, { id: "0x4" }, { id: "0x5" }];
    imodelMock.setup((x) => x.createQueryReader(moq.It.isAnyString())).returns(() => stubECSqlReader(elements));
    expect(await getBatchedClassElementIds(imodelMock.object, "x.y", 2)).to.be.deep.eq([
      { from: "0x1", to: "0x2" },
      { from: "0x3", to: "0x4" },
      { from: "0x5", to: "0x5" },
    ]);
  });
});

describe("getClassesWithInstances", () => {
  const imodelMock = moq.Mock.ofType<IModelDb>();
  beforeEach(() => {
    imodelMock.reset();
  });

  it("returns unique class names by running a query", async () => {
    imodelMock
      .setup((x) => x.createQueryReader(moq.It.isAnyString()))
      .returns(() =>
        stubECSqlReader([
          ["schema", "classA"],
          ["schema", "classB"],
          ["schema", "classA"],
          ["schema", "classB"],
        ]),
      );
    const result = new Array<string>();
    await getClassesWithInstances(imodelMock.object, ["x"]).forEach((value) => result.push(value));
    expect(result).to.deep.eq(["schema.classA", "schema.classB"]);
  });
});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { EntityQueryParams } from "@itwin/core-common";
import { IModelDb, SnapshotDb } from "../../core-backend";
import { preloadEntities, queryEntityIdsAsync } from "../../internal/EntityQueries";
import { TestUtils } from "../TestUtils";
import { closeIfOpen, openReadonlySeedCopy } from "./IModelTestFixtures";

describe("EntityQueries", () => {
  let iModel: SnapshotDb;

  before(async () => {
    await TestUtils.startBackend();
    iModel = await openReadonlySeedCopy("EntityQueries.bim", "CompatibilityTestSeed.bim");
  });

  after(() => closeIfOpen(iModel));

  it("queryEntityIdsAsync returns the same ids, in the same order, as queryEntityIds", async () => {
    const someCodeValue = iModel.elements.getElement(iModel.queryEntityIds({ from: "bis.Element", where: "CodeValue IS NOT NULL", limit: 1 }).values().next().value!).code.value;
    const params: EntityQueryParams[] = [
      { from: "bis.Element" },
      { from: "bis.Model" },
      { from: "bis.InformationPartitionElement", only: false },
      { from: "bis.Element", only: true },
      { from: "bis.Element", orderBy: "ECInstanceId DESC" },
      { from: "bis.Element", orderBy: "ECInstanceId", limit: 5, offset: 3 },
      { from: "generic.PhysicalObject", where: "CodeValue IS NULL", bindings: { parent: undefined } },
      { from: "bis.Element", where: "CodeValue=:cv", bindings: { cv: someCodeValue, parent: null } },
      { from: "bis.Element", where: "CodeValue=?", bindings: [someCodeValue, undefined] },
      { from: "bis.Element", where: "CodeValue='no such code value'" },
    ];

    for (const p of params) {
      const expected = [...iModel.queryEntityIds(p)];
      const actual = [...await queryEntityIdsAsync(iModel, p, IModelDb.maxLimit)];
      expect(actual, JSON.stringify(p)).to.deep.equal(expected);
    }

    expect(iModel.queryEntityIds(params[0]).size).to.be.greaterThan(10);
  });

  it("queryEntityIdsAsync enforces maxLimit", async () => {
    await expect(queryEntityIdsAsync(iModel, { from: "bis.Element" }, 10)).to.be.rejectedWith("Max LIMIT exceeded");
  });

  it("queryEntityIdsAsync rejects invalid ECSQL", async () => {
    await expect(queryEntityIdsAsync(iModel, { from: "bis.NoSuchClass" }, IModelDb.maxLimit)).to.be.rejected;
  });

  it("preloadEntities does not change subsequent reads and ignores errors", async () => {
    const elementIds = [...iModel.queryEntityIds({ from: "bis.Element" })];
    const modelIds = [...iModel.queryEntityIds({ from: "bis.Model" })];
    iModel.clearCaches();
    const elementsBefore = elementIds.map((id) => iModel.elements.getElementProps({ id }));
    const modelsBefore = modelIds.map((id) => iModel.models.getModelProps(id));

    iModel.clearCaches();
    await preloadEntities(iModel, [], "BisCore.Element");
    await preloadEntities(iModel, [...elementIds, "0xffffff", "not an id"], "BisCore.Element");
    await preloadEntities(iModel, modelIds, "BisCore.Model");
    await preloadEntities(iModel, modelIds, "BisCore.Element");
    await preloadEntities(iModel, elementIds, "BisCore.NoSuchClass");

    expect(elementIds.map((id) => iModel.elements.getElementProps({ id }))).to.deep.equal(elementsBefore);
    expect(modelIds.map((id) => iModel.models.getModelProps(id))).to.deep.equal(modelsBefore);
  });
});

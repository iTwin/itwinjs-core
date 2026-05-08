import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ElementState, IModelApp, IModelConnection, ModelState } from "@itwin/core-frontend";
import { IModelError } from "@itwin/core-common";
import { IModelStatus } from "@itwin/core-bentley";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("IModelConnection.findClassFor", () => {

  let iModel: IModelConnection;

  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, true);
    iModel = await TestSnapshotConnection.openFile("test.bim");
  });

  afterAll(async () => {
    await iModel.close();
    await TestUtility.shutdownFrontend();
  });

  it("should return class for given class name", async () => {
    const stateClass = (await iModel.findClassFor("BisCore:Model", undefined));
    expect(stateClass?.name).to.be.equal(ModelState.name);
  });

  it("should return closes base class if given class name does not have class associated", async () => {
    const fullClassName = "BisCore:GeometricElement3d";
    const stateClass = await iModel.findClassFor(fullClassName, undefined);
    expect(stateClass?.name).to.be.equal(ElementState.name);
    expect(IModelApp.lookupEntityClass(fullClassName)?.name).to.be.equal(ElementState.name);
  });

  it("should fallback to provided default class if no class is registered for any of the class names", async () => {
    const stateClass = await iModel.findClassFor("BisCore:CodeSpec", ModelState);
    expect(stateClass?.name).to.be.equal(ModelState.name);
  });

  it("should throw an error if class does not exist", async () => {
    try {
      await iModel.findClassFor("BisCore:NonExistentClass", undefined);
      expect.fail("Expected an error to be thrown");
    } catch (error: unknown) {
      expect(error).to.be.instanceOf(IModelError);
      expect((error as IModelError).errorNumber).to.equal(IModelStatus.NotFound);
    }
  });
});

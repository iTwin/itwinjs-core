/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import TestUtils from "../TestUtils";
import { Task } from "../../src";

describe("Task", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  it("toolbarReactNode should return null", () => {
    const task = new Task({
      id: "Task1",
      primaryStageId: "Test1",
      iconClass: "icon-placeholder",
      labelKey: "SampleApp:backstage.task1",
    });

    expect(task.toolbarReactNode(0)).to.be.null;

    task.execute(); // simply for coverage - no-op
  });

});

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64String } from "@itwin/core-bentley";
import { StandaloneDb } from "../../IModelDb";
import { DrawingMonitor } from "../../DrawingMonitor";

describe.only("DrawingMonitor", () => {
  let db: StandaloneDb;
  let definitionModelId: Id64String;
  let spatialCategoryId: Id64String;
  let altSpatialCategoryId: Id64String;
  let spatial1: { element: string, model: string }; // viewed by spatialView1 and spatialView2
  let spatial2: { element: string, model: string }; // viewed by spatialView2
  let spatial3: { element: string, model: string }; // not viewed by anyone
  let spatialView1: Id64String;
  let spatialView2: Id64String;
  let drawing1: Id64String;
  let drawing2: Id64String;

  it("updates drawings when the geometry of a viewed spatial model is modified", async () => {
    // change geometry of a model viewed by two views
    // same but only one view
  });

  it("updates drawings when a viewed spatial model is deleted", async () => {
    // delete model viewed by one view
    // delete model viewed by two views
  });

  it("waits a specified delay before updating drawings", async () => {

  });

  it("only returns the most up-to-date results if multiple changes occur while delayed", async () => {

  });

  it("cancels delay if updates are requested while delayed", async () => {

  });

  it("updates drawings if their provenance is out of date or missing at initialization", async () => {

  });

  it("only updates drawings affected by a particular set of changes", async () => {

  });

  it("throws when attempting to access updates after termination", async () => {

  });
});

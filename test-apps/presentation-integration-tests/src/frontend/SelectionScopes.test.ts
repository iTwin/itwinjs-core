/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { initialize, terminate } from "../IntegrationTests";
import { Id64 } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { Presentation } from "@bentley/presentation-frontend";

describe("Selection Scopes", () => {

  let imodel: IModelConnection;

  before(async () => {
    initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await IModelConnection.openSnapshot(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.closeSnapshot();
    terminate();
  });

  beforeEach(() => {
    Presentation.selection.clearSelection("", imodel);
  });

  it("returns hard-coded selection scopes from the backend", async () => {
    const scopes = await Presentation.selection.scopes.getSelectionScopes(imodel);
    expect(scopes).to.matchSnapshot();
  });

  it("sets correct selection with 'element' selection scope", async () => {
    const elementProps = await imodel.elements.getProps(Id64.fromUint32Pair(116, 0));
    await Presentation.selection.addToSelectionWithScope("", imodel, elementProps[0].id!, "element");
    const selection = Presentation.selection.getSelection(imodel);
    expect(selection.size).to.eq(1);
    expect(selection.has({ className: elementProps[0].classFullName, id: elementProps[0].id! }));
  });

  it("sets correct selection with 'assembly' selection scope", async () => {
    const elementProps = await imodel.elements.getProps(Id64.fromUint32Pair(28, 0));
    await Presentation.selection.addToSelectionWithScope("", imodel, elementProps[0].id!, "assembly");
    const selection = Presentation.selection.getSelection(imodel);
    expect(selection.size).to.eq(1);
    expect(selection.has({ className: "BisCore:Subject", id: Id64.fromUint32Pair(27, 0) }));
  });

  it("sets correct selection with 'top-assembly' selection scope", async () => {
    const elementProps = await imodel.elements.getProps(Id64.fromUint32Pair(28, 0));
    await Presentation.selection.addToSelectionWithScope("", imodel, elementProps[0].id!, "top-assembly");
    const selection = Presentation.selection.getSelection(imodel);
    expect(selection.size).to.eq(1);
    expect(selection.has({ className: "BisCore:Subject", id: Id64.fromUint32Pair(1, 0) }));
  });

  it("sets correct selection with 'category' selection scope", async () => {
    const elementProps = await imodel.elements.getProps(Id64.fromUint32Pair(116, 0));
    await Presentation.selection.addToSelectionWithScope("", imodel, elementProps[0].id!, "element");
    const selection = Presentation.selection.getSelection(imodel);
    expect(selection.size).to.eq(1);
    expect(selection.has({ className: "BisCore:Category", id: Id64.fromUint32Pair(23, 0) }));
  });

  it("sets correct selection with 'model' selection scope", async () => {
    const elementProps = await imodel.elements.getProps(Id64.fromUint32Pair(116, 0));
    await Presentation.selection.addToSelectionWithScope("", imodel, elementProps[0].id!, "element");
    const selection = Presentation.selection.getSelection(imodel);
    expect(selection.size).to.eq(1);
    expect(selection.has({ className: "BisCore:Model", id: Id64.fromUint32Pair(28, 0) }));
  });

});

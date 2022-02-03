/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import type { IModelConnection} from "@itwin/core-frontend";
import { IModelApp, SnapshotConnection, StandardViewId, StandardViewTool, WindowAreaTool } from "@itwin/core-frontend";
import { EditTextTool, LineTool, MarkupApp, SelectTool } from "@itwin/core-markup";
import type { Element, G, LinkedHTMLElement } from "@svgdotjs/svg.js";
import { TestUtility } from "../TestUtility";
import type { ScreenTestViewport } from "../TestViewport";
import { createOnScreenTestViewport } from "../TestViewport";

describe("Markup tests", async () => {
  let imodel: IModelConnection;
  let vp: ScreenTestViewport;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
    await MarkupApp.initialize();
    vp = await createOnScreenTestViewport("0x24", imodel, 500, 500);
    await MarkupApp.start(vp);
  });

  after(async () => {
    vp.dispose();
    if (imodel) await imodel.close();
    await TestUtility.shutdownFrontend();
  });

  const makeRect = (g: G) => g.rect(10, 10).move(3, 3).css(MarkupApp.props.active.element);

  it("should initialize Markup", async () => {
    const tools = IModelApp.tools;
    const markup = MarkupApp.markup!;
    const toolAdmin = IModelApp.toolAdmin;

    assert.isDefined(tools.find(SelectTool.toolId), "select tool registered");
    assert.isDefined(tools.find(LineTool.toolId), "line tool registered");
    assert.isDefined(tools.find(EditTextTool.toolId), "edit text tool registered");
    assert.isDefined(markup, "markup created");
    assert.equal(toolAdmin.markupView, vp, "set markup view");
    assert.equal(markup.vp, vp, "markup vp");
    assert.equal(markup.markupDiv.parentElement, vp.vpDiv, "markup div child of vpDiv");
    assert.isDefined(markup.svgContainer, "svgContainer defined");
    assert.isDefined(markup.svgMarkup, "svgMarkup defined");
    assert.isDefined(markup.svgDecorations, "svgDecorations defined");
    assert.isDefined(markup.svgDynamics, "svgDynamics defined");
    assert.isTrue(markup.selected.isEmpty, "markup selected should be empty");
    assert.equal(toolAdmin.defaultToolId, SelectTool.toolId, "Select tool is default tool");
    assert.equal(toolAdmin.activeTool!.toolId, SelectTool.toolId, "Select tool is active");
  });

  it("viewing tools should fail when Markup active", async () => {
    const tools = IModelApp.tools;
    assert.isFalse(await tools.run(StandardViewTool.toolId, vp, StandardViewId.Back), "standard view");
    assert.isFalse(await tools.run(WindowAreaTool.toolId, vp), "standard view");
  });

  it("Markup Undo/Redo", () => {
    const markup = MarkupApp.markup!;
    const undo = markup.undo;
    const svgMarkup = markup.svgMarkup!;
    const children = svgMarkup.node.children;

    svgMarkup.clear();
    assert.equal(undo.size, 0, "undo starts out empty");
    assert.equal(children.length, 0, "svgMarkup starts empty");

    const rect = makeRect(svgMarkup);
    assert.equal(children.length, 1, "one child");
    undo.performOperation("one", () => undo.onAdded(rect));
    assert.isTrue(undo.undoPossible);
    assert.equal(undo.undoString, "one");
    undo.doUndo();
    assert.equal(undo.redoString, "one");
    assert.isFalse(undo.undoPossible);
    assert.isTrue(undo.redoPossible);
    assert.equal(children.length, 0, "add undone");
    undo.doRedo();
    assert.isFalse(undo.redoPossible);
    assert.isTrue(undo.undoPossible);
    assert.isUndefined(undo.redoString);
    assert.equal(undo.undoString, "one");
    assert.equal(children.length, 1, "add redone");

    undo.performOperation("two", () => { undo.onDelete(rect); rect.remove(); });
    assert.equal(children.length, 0, "deleted rect");
    assert.isTrue(undo.undoPossible);
    assert.equal(undo.undoString, "two");
    undo.doUndo();
    assert.equal(undo.undoString, "one");
    assert.equal(undo.redoString, "two");
    assert.isTrue(undo.undoPossible);
    assert.isTrue(undo.redoPossible);
    assert.equal(children.length, 1, "delete undone");
    undo.doRedo();
    assert.equal(children.length, 0, "redo delete");
    undo.doUndo();
    assert.equal(children.length, 1, "delete undone again");

    const clone = rect.cloneMarkup();
    clone.css({ stroke: "white" });
    rect.replace(clone);

    undo.performOperation("three", () => { undo.onModified(clone, rect); });
    assert.equal((children[0] as LinkedHTMLElement).instance.css("stroke"), "white", "element is now white");
    undo.doUndo();
    assert.equal((children[0] as LinkedHTMLElement).instance.css("stroke"), "red", "element is now red");

    const group = svgMarkup.group();
    undo.performOperation("four", () => {
      const oldParent = rect.parent();
      const oldPos = rect.position();
      undo.onRepositioned(rect.addTo(group), oldPos, oldParent as Element);
      undo.onAdded(group);
    });

    assert.equal(children.length, 1, "grouped");
    assert.equal((children[0] as LinkedHTMLElement).instance, group, "grouped");
    assert.equal(rect.parent(), group, "rect in group");
    undo.doUndo();
    assert.equal(children.length, 1, "grouped undone");
    assert.equal((children[0] as LinkedHTMLElement).instance, rect, "undo group");
    assert.equal(rect.parent(), svgMarkup, "rect in root");
    undo.doRedo();
    assert.equal((children[0] as LinkedHTMLElement).instance, group, "group redone");
    assert.equal(rect.parent(), group, "redo rect in group");
  });
});

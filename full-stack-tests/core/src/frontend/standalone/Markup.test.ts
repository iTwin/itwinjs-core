/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { IModelApp, IModelConnection, StandardViewId, StandardViewTool, WindowAreaTool } from "@itwin/core-frontend";
import { EditTextTool, LineTool, MarkupApp, SelectTool } from "@itwin/core-markup";
import { Element, G, LinkedHTMLElement } from "@svgdotjs/svg.js";
import { TestUtility } from "../TestUtility";
import { createOnScreenTestViewport, ScreenTestViewport } from "../TestViewport";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("Markup tests", async () => {
  let imodel: IModelConnection;
  let vp: ScreenTestViewport;

  beforeAll(async () => {
    await TestUtility.startFrontend();
    imodel = await TestSnapshotConnection.openFile("mirukuru.ibim"); // relative path resolved by BackendTestAssetResolver
    await MarkupApp.initialize();
    vp = await createOnScreenTestViewport("0x24", imodel, 500, 500);
    await MarkupApp.start(vp);
  });

  afterAll(async () => {
    vp[Symbol.dispose]();
    await imodel?.close();
    await TestUtility.shutdownFrontend();
  });

  const makeRect = (g: G) => g.rect(10, 10).move(3, 3).css(MarkupApp.props.active.element);

  it("should initialize Markup", async () => {
    const tools = IModelApp.tools;
    const markup = MarkupApp.markup!;
    const toolAdmin = IModelApp.toolAdmin;

    expect(tools.find(SelectTool.toolId)).toBeDefined();
    expect(tools.find(LineTool.toolId)).toBeDefined();
    expect(tools.find(EditTextTool.toolId)).toBeDefined();
    expect(markup).toBeDefined();
    expect(toolAdmin.markupView, "set markup view").toBe(vp);
    expect(markup.vp, "markup vp").toBe(vp);
    expect(markup.markupDiv.parentElement, "markup div child of vpDiv").toBe(vp.vpDiv);
    expect(markup.svgContainer).toBeDefined();
    expect(markup.svgMarkup).toBeDefined();
    expect(markup.svgDecorations).toBeDefined();
    expect(markup.svgDynamics).toBeDefined();
    expect(markup.selected.isEmpty).toBe(true);
    expect(toolAdmin.defaultToolId, "Select tool is default tool").toBe(SelectTool.toolId);
    expect(toolAdmin.activeTool!.toolId, "Select tool is active").toBe(SelectTool.toolId);
  });

  it("viewing tools should fail when Markup active", async () => {
    const tools = IModelApp.tools;
    expect(await tools.run(StandardViewTool.toolId, vp, StandardViewId.Back)).toBe(false);
    expect(await tools.run(WindowAreaTool.toolId, vp)).toBe(false);
  });

  it("Markup Undo/Redo", () => {
    const markup = MarkupApp.markup!;
    const undo = markup.undo;
    const svgMarkup = markup.svgMarkup!;
    const children = svgMarkup.node.children;

    svgMarkup.clear();
    expect(undo.size, "undo starts out empty").toBe(0);
    expect(children.length, "svgMarkup starts empty").toBe(0);

    const rect = makeRect(svgMarkup);
    expect(children.length, "one child").toBe(1);
    undo.performOperation("one", () => undo.onAdded(rect));
    expect(undo.undoPossible).toBe(true);
    expect(undo.undoString).toBe("one");
    undo.doUndo();
    expect(undo.redoString).toBe("one");
    expect(undo.undoPossible).toBe(false);
    expect(undo.redoPossible).toBe(true);
    expect(children.length, "add undone").toBe(0);
    undo.doRedo();
    expect(undo.redoPossible).toBe(false);
    expect(undo.undoPossible).toBe(true);
    expect(undo.redoString).toBeUndefined();
    expect(undo.undoString).toBe("one");
    expect(children.length, "add redone").toBe(1);

    undo.performOperation("two", () => {
      undo.onDelete(rect);
      rect.remove();
    });
    expect(children.length, "deleted rect").toBe(0);
    expect(undo.undoPossible).toBe(true);
    expect(undo.undoString).toBe("two");
    undo.doUndo();
    expect(undo.undoString).toBe("one");
    expect(undo.redoString).toBe("two");
    expect(undo.undoPossible).toBe(true);
    expect(undo.redoPossible).toBe(true);
    expect(children.length, "delete undone").toBe(1);
    undo.doRedo();
    expect(children.length, "redo delete").toBe(0);
    undo.doUndo();
    expect(children.length, "delete undone again").toBe(1);

    const clone = rect.cloneMarkup();
    clone.css({ stroke: "white" });
    rect.replace(clone);

    undo.performOperation("three", () => undo.onModified(clone, rect));
    expect((children[0] as LinkedHTMLElement).instance.css("stroke"), "element is now white").toBe("white");
    undo.doUndo();
    expect((children[0] as LinkedHTMLElement).instance.css("stroke"), "element is now red").toBe("red");

    const group = svgMarkup.group();
    undo.performOperation("four", () => {
      const oldParent = rect.parent();
      const oldPos = rect.position();
      undo.onRepositioned(rect.addTo(group), oldPos, oldParent as Element);
      undo.onAdded(group);
    });

    expect(children.length, "grouped").toBe(1);
    expect((children[0] as LinkedHTMLElement).instance, "grouped").toBe(group);
    expect(rect.parent(), "rect in group").toBe(group);
    undo.doUndo();
    expect(children.length, "grouped undone").toBe(1);
    expect((children[0] as LinkedHTMLElement).instance, "undo group").toBe(rect);
    expect(rect.parent(), "rect in root").toBe(svgMarkup);
    undo.doRedo();
    expect((children[0] as LinkedHTMLElement).instance, "group redone").toBe(group);
    expect(rect.parent(), "redo rect in group").toBe(group);
  });
});

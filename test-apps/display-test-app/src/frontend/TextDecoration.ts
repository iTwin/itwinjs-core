/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Placement2dProps, TextAnnotation, TextAnnotationAnchor, TextAnnotationProps } from "@itwin/core-common";
import { DecorateContext, Decorator, GraphicType, IModelApp, IModelConnection, NotifyMessageDetails, OutputMessagePriority, readElementGraphics, RenderGraphicOwner, Tool } from "@itwin/core-frontend";
import { FormatSet } from "@itwin/ecschema-metadata";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { assert, Id64, Id64String } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { dtaIpc } from "./App";

/** Renders a [TextAnnotation]($common) loaded from a JSON fixture as a decoration graphic.
 *
 * The annotation is authored offline and loaded whole rather than assembled command by command:
 * a fixture round-trips exactly, can be checked in next to the test it supports, and does not
 * need a keyin for every property the annotation schema grows.
 */
class TextEditor implements Decorator {
  private _iModel?: IModelConnection;
  private _entityId: Id64String = Id64.invalid;
  private _graphic?: RenderGraphicOwner;

  public categoryId: Id64String = Id64.invalid;
  public modelId: Id64String = Id64.invalid;
  public defaultTextStyleId: Id64String = Id64.invalid;
  public origin: Point3d = new Point3d(0, 0, 0);
  public debugAnchorPointAndRange = false;

  /** The anchor DTA assumes when an imported annotation does not specify one.
   *
   * Core defaults to top-left, which would hang the text down and to the right of the origin
   * `init` picked. Centering on the anchor point instead puts the text where the view is
   * actually looking, which is what makes `init` and `center` land it on screen.
   */
  private static readonly _defaultAnchor: TextAnnotationAnchor = { horizontal: "center", vertical: "middle" };

  public annotation: TextAnnotation = TextAnnotation.fromJSON({ anchor: TextEditor._defaultAnchor });

  public get annotationProps(): TextAnnotationProps {
    return this.annotation.toJSON();
  }

  public get placementProps(): Placement2dProps {
    return { origin: this.origin, angle: 0 };
  }

  public init(iModel: IModelConnection, category: Id64String): void {
    this.clear();

    this._iModel = iModel;
    this._entityId = iModel.transientIds.getNext();
    this.categoryId = category;

    IModelApp.viewManager.addDecorator(this);
  }

  public clear(): void {
    IModelApp.viewManager.dropDecorator(this);

    this._iModel = undefined;
    this._graphic?.disposeGraphic();
    this._graphic = undefined;

    this.annotation = TextAnnotation.fromJSON({ anchor: TextEditor._defaultAnchor });
    this.defaultTextStyleId = Id64.invalid;
    this.origin.setZero();
    this.debugAnchorPointAndRange = false;
  }

  public setAnnotation(props: TextAnnotationProps): void {
    // A fixture that says nothing about anchoring gets DTA's centered default rather than
    // Core's top-left, so an imported annotation lands where `init` centered the editor. A
    // fixture that does specify an anchor is honored exactly as written.
    this.annotation = TextAnnotation.fromJSON({ anchor: TextEditor._defaultAnchor, ...props });
  }

  /**
   * Draws the graphics for the decoration. Text annotation graphics require a call to the backend to generate the geometry.
   * In this case, we're using the `TextAnnotationGeometry` RPC endpoint that calls [[IModelDb.generateElementGraphics]]
   * with the values from [[appendTextAnnotationGeometry]].
   * These graphics can be added to the [[RenderSystem]] via [[readElementGraphics]] and [[RenderSystem.createGraphicOwner]]
   * or via an [[ElementGeometryGraphicsProvider]]. In this case, we're using the former.
   */
  public async update(): Promise<void> {
    if (!this._iModel) {
      throw new Error("Invoke `dta text init` first");
    }

    if (this.annotation.textBlock.isEmpty || this.annotation.textBlock.isWhitespace) {
      return;
    }

    const rpcProps = this._iModel.getRpcProps();

    try {
      const gfx = await DtaRpcInterface.getClient().generateTextAnnotationGeometry(
        rpcProps,
        this.annotationProps,
        Id64.isValid(this.defaultTextStyleId) ? this.defaultTextStyleId : Id64.invalid,
        this.categoryId,
        this.modelId,
        this.placementProps,
        this.debugAnchorPointAndRange,
        { annotation: 100, annotationLabels: 110 }
      );

      const graphic = undefined !== gfx ? await readElementGraphics(gfx, this._iModel, this._entityId, false) : undefined;
      this._graphic = graphic ? IModelApp.renderSystem.createGraphicOwner(graphic) : undefined;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error generating text annotation graphics:", err, "\nAnnotation props:", this.annotationProps, "\nPlacement props:", this.placementProps, "\nCategory ID:", this.categoryId, "\nModel ID:", this.modelId);
      throw err;
    }

    IModelApp.viewManager.invalidateCachedDecorationsAllViews(this);
  }

  public get useCachedDecorations(): true { return true; }
  public decorate(context: DecorateContext): void {
    if (this._graphic) {
      context.addDecoration(GraphicType.Scene, this._graphic);
    }
  }
}

const editor = new TextEditor();

export class TextDecorationTool extends Tool {
  public static override toolId = "AddTextDecoration";
  public static override get minArgs() { return 1; }
  public static override get maxArgs() { return undefined; }

  private static readonly _helpEntries: ReadonlyArray<readonly [string, string]> = [
    ["help", "Print this help message."],
    ["init [category] [defaultTextStyleId]", "Initialize the editor. Uses the first category in the view if omitted. **REQUIRED** before any other commands. Text will be centered in the view."],
    ["clear", "Reset the editor and remove the decoration."],
    ["center", "Move the annotation to the center of the current view. `init` does this once; re-run after panning or zooming."],
    ["import annotation <path>", "Load TextAnnotationProps from a JSON file and display it."],
    ["import formatset <path> [id]", "Load a FormatSet from a JSON file and register it for the current iModel. Adopted by default, or addressable under [id]."],
    ["import formatset off", "Unregister every FormatSet previously imported for the current iModel."],
    ["export annotation <path> [force]", "Write the current TextAnnotationProps to <path>. Refuses to overwrite an existing file unless 'force' is passed."],
    ["insert", "Insert the current annotation into the iModel (2d views only)."],
    ["update <annotationId>", "Update the given annotation element with the current annotation."],
    ["delete <annotationId>", "Delete the given annotation element."],
    ["debug", "Toggle drawing of the anchor point and range."],
  ];

  private static printHelp(): void {
    const width = TextDecorationTool._helpEntries.reduce((max, [usage]) => Math.max(max, usage.length), 0);
    const lines = TextDecorationTool._helpEntries.map(([usage, desc]) => `  ${usage.padEnd(width)}  ${desc}`);
    const message = `dta text <command> [args]\n\nCommands:\n${lines.join("\n")}`;
    // eslint-disable-next-line no-console
    console.log(message);
    // Throw an error to display the message in viewer.
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "See console for details"));
  }

  public override async parseAndRun(...inArgs: string[]): Promise<boolean> {
    const cmd = inArgs[0].toLowerCase();

    if (cmd === "help") {
      TextDecorationTool.printHelp();
      return true;
    }

    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      return false;
    }

    if (vp.view.is2d()) {
      editor.modelId = vp.view.baseModelId;
    }

    const arg = inArgs[1];

    switch (cmd) {
      case "clear":
        editor.clear();
        return true;
      case "init": {
        // Use the first category if the user doesn't specify one. This is just a convenience.
        const category = inArgs[1] ?? vp.view.categorySelector.categories.values().next().value;
        if (undefined === category || category === "") {
          throw new Error("No category provided.");
        }

        editor.init(vp.iModel, category);
        // Centered so the annotation is on screen the moment it is created. `dta text center`
        // repeats this, since the annotation keeps its world origin when the view moves.
        editor.origin = vp.view.getCenter();
        const defaultStyleId = inArgs[2];
        if (defaultStyleId) {
          editor.defaultTextStyleId = defaultStyleId;
        }
        break;
      }
      case "center":
        editor.origin = vp.view.getCenter();
        break;
      case "debug":
        editor.debugAnchorPointAndRange = !editor.debugAnchorPointAndRange;
        break;
      case "import": {
        const what = arg?.toLowerCase();
        const path = inArgs[2];

        if (what === "annotation") {
          if (!path) {
            throw new Error("Expected a file path to a JSON file containing TextAnnotationProps");
          }
          editor.setAnnotation(JSON.parse(await dtaIpc.readTextFile(path)) as TextAnnotationProps);
          break;
        }

        if (what === "formatset") {
          if (path === "off") {
            await dtaIpc.registerFieldFormattingProvider(vp.iModel.key);
            // eslint-disable-next-line no-console
            console.log(`Unregistered all FormatSets for iModel ${vp.iModel.key}`);
            return true;
          }

          if (!path) {
            throw new Error("Expected a file path to a JSON file containing a FormatSet, or 'off'");
          }

          const formatSet = JSON.parse(await dtaIpc.readTextFile(path)) as FormatSet;
          const id = inArgs[3];
          // An id makes the set addressable by a FieldRun's `formatSet` option; without one it
          // is adopted as the iModel's default. Importing twice with different ids builds up the
          // set of addressable FormatSets, which is what exercises per-field routing.
          await dtaIpc.registerFieldFormattingProvider(vp.iModel.key, id ? undefined : formatSet, id ? [{ id, formatSet }] : undefined);
          // eslint-disable-next-line no-console
          console.log(`Registered FormatSet '${formatSet.name}'${id ? ` as '${id}'` : " (adopted)"} for iModel ${vp.iModel.key}`);
          return true;
        }

        throw new Error("Expected 'annotation' or 'formatset'");
      }
      case "export": {
        if (arg?.toLowerCase() !== "annotation") {
          throw new Error("Expected 'annotation'");
        }

        const path = inArgs[2];
        if (!path) {
          throw new Error("Expected a file path to write the current TextAnnotationProps to");
        }

        await dtaIpc.writeTextFile(path, `${JSON.stringify(editor.annotationProps, undefined, 2)}\n`, inArgs[3] === "force");
        // eslint-disable-next-line no-console
        console.log(`Wrote annotation to ${path}`);
        return true;
      }
      case "insert": {
        assert(vp.view.is2d() === true, "View is not 2d");
        const id = await dtaIpc.insertText(
          vp.iModel.key,
          editor.categoryId,
          editor.modelId,
          editor.placementProps,
          editor.defaultTextStyleId,
          editor.annotationProps
        );

        // eslint-disable-next-line no-console
        console.log(`Inserted text annotation with id ${id}`);

        return true;
      }
      case "update": {
        if (!arg) {
          throw new Error("Expected annotation ID");
        }

        await dtaIpc.updateText(
          vp.iModel.key,
          arg,
          editor.categoryId,
          editor.placementProps,
          editor.defaultTextStyleId,
          editor.annotationProps
        );

        return true;
      }
      case "delete": {
        if (!arg) {
          throw new Error("Expected annotation ID");
        }

        await dtaIpc.deleteText(vp.iModel.key, arg);
        return true;
      }
      default:
        throw new Error(`unrecognized command ${cmd}`);
    }

    await editor.update();
    return true;
  }
}

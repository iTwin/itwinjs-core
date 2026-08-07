/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  BaselineShift,
  ColorDef,
  FieldFormatOptions,
  FieldRun,
  FractionRun,
  LeaderTextPointOptions,
  LineBreakRun,
  List,
  ListMarker,
  ListMarkerEnumerator,
  Paragraph,
  Placement2dProps,
  Run,
  TabRun,
  TerminatorShape,
  TextAnnotation,
  TextAnnotationAnchor,
  TextAnnotationFrameShape,
  TextAnnotationLeader,
  TextAnnotationProps,
  TextBlock,
  TextBlockMargins,
  TextBlockProps,
  TextFrameStyleProps,
  TextJustification,
  TextLeaderStyleProps,
  TextRun,
  TextStyleSettingsProps,
} from "@itwin/core-common";
import { DecorateContext, Decorator, EmphasizeElements, GraphicType, IModelApp, IModelConnection, NotifyMessageDetails, OutputMessagePriority,  readElementGraphics, RenderGraphicOwner, Tool } from "@itwin/core-frontend";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { assert, Id64, Id64String } from "@itwin/core-bentley";
import { Angle, Point3d, Vector3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { dtaIpc } from "./App";

// Ignoring the spelling of the keyins. They're case insensitive, so we check against lowercase.
// cspell:ignore superscript, subscript, widthfactor, fractionscale, fractiontype, textpoint, subscriptscale, superscriptscale, insertstyle, updatestyle, deletestyle, applystyle, docheight, textheight, formatmode

class TextEditor implements Decorator {
  // Geometry properties
  private _iModel?: IModelConnection;
  private _entityId: Id64String = Id64.invalid;
  private _graphic?: RenderGraphicOwner;
  public categoryId: Id64String = Id64.invalid;
  public modelId: Id64String = Id64.invalid;
  public defaultTextStyleId: Id64String = Id64.invalid;
  public emphasizeElements = new EmphasizeElements();

  // TextAnnotation properties
  public origin: Point3d = new Point3d(0, 0, 0);
  public rotation = 0;
  public offset = { x: 0, y: 0 };
  public anchor: TextAnnotationAnchor = { horizontal: "left", vertical: "top" };
  public leaders: TextAnnotationLeader[] = [];
  public debugAnchorPointAndRange = false;

  // Properties applied to the entire document
  public get documentStyle(): Pick<
    TextStyleSettingsProps,
    "textHeight" |
    "widthFactor" |
    "lineSpacingFactor" |
    "margins" |
    "frame" |
    "leader" |
    "justification"> {
    return this.textBlock.styleOverrides;
  }

  public get annotationProps(): TextAnnotationProps {
    const annotation = TextAnnotation.fromJSON({
      textBlock: this.textBlock.toJSON(),
      anchor: this.anchor,
      orientation: YawPitchRollAngles.createDegrees(this.rotation, 0, 0).toJSON(),
      offset: this.offset,
      leaders: this.leaders
    });

    return annotation.toJSON();
  }

  public get placementProps(): Placement2dProps {
    return {
      origin: this.origin,
      angle: 0,
    };
  }

  private pathToLastChild(): (Run | Paragraph | List)[] {
    const pathToChild: (Run | Paragraph | List)[] = [];
    let current: Run | Paragraph | List | undefined = this.textBlock.children[this.textBlock.children.length - 1];
    while (current) {
      pathToChild.push(current);

      current = (current.type === "paragraph" || current.type === "list") && current.children.length !== 0 ? current.children[current.children.length - 1] : undefined;
    }
    return pathToChild;
  }

  private appendRunToLastChild(run: Run) {
    if (this.textBlock.children.length === 0) {
      this.textBlock.appendParagraph();
    }

    const pathToChild: (Paragraph | List)[] = this.pathToLastChild().filter((component) => component.type === "paragraph" || component.type === "list");
    const last = pathToChild[pathToChild.length - 1];

    if (last.type === "paragraph") {
      last.children.push(run);
    } else {
      last.children.push(Paragraph.create({ styleOverrides: { font: { name: this.runStyle.font?.name ?? "Arial" } } }));
      last.children[last.children.length - 1].children.push(run);
    }
    return last;
  }

  // Properties to be applied to the next run
  public runStyle: Omit<TextStyleSettingsProps, "widthFactor" | "lineSpacingFactor"> = { font: { name: "Arial" } };
  public baselineShift: BaselineShift = "none";

  public textBlock = TextBlock.create();

  public init(iModel: IModelConnection, category: Id64String): void {
    this.clear();

    this._iModel = iModel;
    this._entityId = iModel.transientIds.getNext();
    this.categoryId = category;

    IModelApp.viewManager.addDecorator(this);
  }

  public clear(): void {
    IModelApp.viewManager.dropDecorator(this);

    const vp = IModelApp.viewManager.selectedView;
    if (vp) this.emphasizeElements.clearHiddenElements(vp);

    this._iModel = undefined;
    this._graphic?.disposeGraphic();
    this._graphic = undefined;
    this.textBlock = TextBlock.create();
    this.defaultTextStyleId = Id64.invalid;
    this.origin.setZero();
    this.rotation = 0;
    this.offset.x = this.offset.y = 0;
    this.anchor = { horizontal: "center", vertical: "middle" };
    this.debugAnchorPointAndRange = false;
    this.runStyle = { font: { name: "Arial" } };
    this.baselineShift = "none";
    this.leaders = [];
  }

  public appendText(content: string, overrides?: TextStyleSettingsProps): void {
    this.appendRunToLastChild(TextRun.create({
      styleOverrides: { ...this.runStyle, ...overrides },
      content,
      baselineShift: this.baselineShift,
    }));
  }

  public appendFraction(numerator: string, denominator: string): void {
    this.appendRunToLastChild(FractionRun.create({
      styleOverrides: this.runStyle,
      numerator,
      denominator,
    }));
  }

  public appendField(args: {
    elementId: string,
    schemaName: string,
    className: string,
    propertyName: string,
    formatOptions?: FieldFormatOptions,
  }): void {
    const { elementId, schemaName, className, propertyName, formatOptions } = args;
    this.appendRunToLastChild(FieldRun.create({
      propertyHost: { elementId, schemaName, className },
      propertyPath: { propertyName },
      formatOptions,
      styleOverrides: { ...this.runStyle },
    }));
  }

  public appendTab(spaces?: number): void {
    this.appendRunToLastChild(
      TabRun.create({
        styleOverrides: { tabInterval: spaces },
      }),
    );
  }

  public appendBreak(): void {
    this.appendRunToLastChild(LineBreakRun.create({
      styleOverrides: this.runStyle,
    }));
  }

  public appendList(index: number = 0, listMarker?: ListMarker): void {
    const list = List.create({ styleOverrides: { font: { name: this.runStyle.font?.name ?? "Arial" }, ...this.runStyle, listMarker } });

    const path = this.pathToLastChild().filter(component => component.type === "paragraph");
    const child = path[index];
    child?.children.push(list);
  }

  public appendListItem(index: number = 0): void {
    const lists = this.pathToLastChild().filter(component => component.type === "list");
    const list = lists[index];
    const item = Paragraph.create({ styleOverrides: { font: { name: this.runStyle.font?.name ?? "Arial" }, ...this.runStyle } });
    list?.children.push(item);
  }

  public appendParagraph(): void {
    this.textBlock.appendParagraph({ styleOverrides: this.runStyle });
  }

  public setIndentation(indentation: number): void {
    const currentParagraph = this.textBlock.children[this.textBlock.children.length - 1];

    if (!currentParagraph) return;
    currentParagraph.styleOverrides = {
      ...currentParagraph.styleOverrides,
      indentation,
    };

    this.runStyle.indentation = indentation;
  }

  public setDocumentWidth(width: number): void {
    this.textBlock.width = width;
  }

  public justify(justification: TextJustification): void {
    this.documentStyle.justification = justification;
  }

  public setMargins(margins: TextBlockMargins): void {
    this.documentStyle.margins = {
      left: margins.left ?? 0,
      right: margins.right ?? 0,
      top: margins.top ?? 0,
      bottom: margins.bottom ?? 0,
    };
  }

  public setLeaderProps() {
    this.leaders.push({ startPoint: Point3d.createZero().plusScaled(Vector3d.unitX().negate(), 20), attachment: { mode: "Nearest" } });
  }

  public setLeaderStartPoint(leader: TextAnnotationLeader, angle: number) {
    const point = Point3d.createZero();
    const distance = 10;
    const angleRadians = Angle.createDegrees(angle);
    const directionVector = Vector3d.createPolar(distance, angleRadians);
    leader.startPoint = point.plus(directionVector);
  }

  public setLeaderKeyPoint(leader: TextAnnotationLeader, curveIndex: number, fraction: number) {
    leader.attachment = { mode: "KeyPoint", curveIndex, fraction };
  }
  public setLeaderTextPoint(leader: TextAnnotationLeader, arg: LeaderTextPointOptions) {
    leader.attachment = { mode: "TextPoint", position: arg };
  }
  public setLeaderNearest(leader: TextAnnotationLeader) {
    leader.attachment = { mode: "Nearest" };
  }

  public setTextBlock(props: TextBlockProps) {
    this.textBlock = TextBlock.create(props);
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

    if (this.textBlock.isEmpty || this.textBlock.isWhitespace) {
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
    ["clear", "Reset the editor and remove the decoration."],
    ["init [category]", "Initialize the editor. Uses the first category in the view if omitted."],
    ["center", "Set the annotation origin to the view center."],
    ["rotation <deg>", "Set annotation rotation in degrees."],
    ["offset <x> <y>", "Set annotation offset."],
    ["anchor <left|center|right|top|middle|bottom>", "Set the horizontal or vertical anchor."],
    ["font <name>", "Set the font for subsequent runs."],
    ["text <content>", "Append a text run."],
    ["fraction <numerator> <denominator>", "Append a stacked fraction run."],
    ["field <fieldPropsJson>", "Append a field run. JSON with elementId, schemaName, className, propertyName, and optional formatOptions. Use single quotes instead of double quotes in the JSON."],
    ["break", "Append a line break."],
    ["tab [spaces]", "Append a tab run with an optional tab interval."],
    ["paragraph", "Append a new paragraph."],
    ["list <enumerator> <terminator> <case> [index]", "Append a list to the paragraph at [index]. Use \"none\" to omit a value."],
    ["list-item [index]", "Append an item to the list at [index]."],
    ["color <colorString>", "Set run color (e.g. red, #ff0000)."],
    ["docheight <n>", "Set document text height."],
    ["textheight <n>", "Set text height for subsequent runs."],
    ["widthfactor <n>", "Set document width factor."],
    ["width <n>", "Set the document width (for word wrap)."],
    ["justify <left|center|right>", "Set document justification."],
    ["indent <n>", "Set indentation of the current paragraph."],
    ["spacing <n>", "Set document line spacing factor."],
    ["bold", "Toggle bold for subsequent runs."],
    ["italic", "Toggle italic for subsequent runs."],
    ["underline", "Toggle underline for subsequent runs."],
    ["fractionscale <n>", "Set stacked-fraction scale."],
    ["fractiontype <horizontal|diagonal>", "Set stacked-fraction type."],
    ["subscriptscale <n>", "Set subscript scale."],
    ["superscriptscale <n>", "Set superscript scale."],
    ["shift <none|superscript|subscript>", "Set baseline shift for subsequent runs."],
    ["margin <left|right|top|bottom|all|horizontal|vertical> <n>", "Set document margins."],
    ["frame <shape|fillColor|borderColor|borderWeight> <value>", "Configure the frame style."],
    ["leader new", "Append a new leader."],
    ["leader start <angleDeg>", "Set the start point of the latest leader."],
    ["leader keypoint <curveIndex> <fraction>", "Attach the latest leader to a curve key point."],
    ["leader nearest", "Attach the latest leader to the nearest point."],
    ["leader textpoint <position>", "Attach the latest leader to a text point."],
    ["leader terminatorShape <shape>", "Set the leader terminator shape."],
    ["debug", "Toggle drawing of the anchor point and range."],
    ["log", "Log the current annotation to the console."],
    ["json [propsJson]", "Set the text block from JSON, or log the current text block if omitted."],
    ["insertstyle <name>", "Insert a new text style using the current run/document style."],
    ["updatestyle <name>", "Update an existing text style using the current run/document style."],
    ["deletestyle <name>", "Delete a text style by name."],
    ["applystyle <styleId>", "Apply the given default text style id and clear overrides."],
    ["load <annotationId>", "Load an existing text annotation element into the editor."],
    ["insert", "Insert the current annotation into the iModel (2d views only)."],
    ["update <annotationId>", "Update the given annotation element with the current state."],
    ["delete <annotationId>", "Delete the given annotation element."],
    ["scale <factor>", "Set the annotation scale factor for the current model."],
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

   // TODO: Remove before merging, just for convenience while testing.
  private async testText() {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      return;
    }

    const tabSize = 0.025;

    // Setup
    await this.parseAndRun("init", "0x20000000398");
    await this.parseAndRun("applystyle", "0x50000000001");
    await this.parseAndRun("font", "Arimo");
    await this.parseAndRun("center");

    const expectField = (title: string, expected: string, formatOptions?: FieldFormatOptions, note?: string) => {
      const expectedColor = ColorDef.fromString("#ff5959").toJSON();
      const actualColor = ColorDef.fromString("#156715").toJSON();
      const defaultColor = ColorDef.fromString("black").toJSON();

      // Label
      editor.appendBreak();
      editor.runStyle.color = defaultColor;
      editor.runStyle.isBold = true;
      editor.appendText(title);
      editor.runStyle.isBold = false;
      editor.appendBreak();

      // Expected value
      editor.appendText("Expected: ");
      editor.runStyle.color = expectedColor;
      editor.appendTab(tabSize);
      editor.appendText(expected);
      editor.runStyle.color = defaultColor;

      // Actual field
      const fieldProps = {
        elementId: "0x20000001f05",
        schemaName: "BuildingSpatial",
        className: "Building",
        propertyName: "Origin",
        formatOptions,
      };
      editor.appendBreak();
      editor.appendText("Actual: ");
      editor.runStyle.color = actualColor;
      editor.appendTab(tabSize);
      editor.appendField(fieldProps);
      editor.runStyle.color = defaultColor;

      // Comment
      if (note) {
        editor.appendBreak();
        editor.runStyle.color = ColorDef.fromString("#888888").toJSON();
        editor.runStyle.isItalic = true;
        editor.appendText(note);
        editor.runStyle.isItalic = false;
        editor.runStyle.color = defaultColor;
      }

      editor.appendBreak();
      editor.appendText(JSON.stringify({ formatOptions: formatOptions ?? null }));

      editor.appendBreak();
      editor.appendText(" ");
    };

    // Raw (persistence) coordinate values for ParkingRow.Origin used as a reference below:
    //   x = 30707.1467 m, y = 58893.3153 m, z = 0 m
    // Actual displayed values depend on whether the demo FormattingSpecProvider (see
    // `FieldFormattingDemo.ts`) is registered against the current iModel:
    //   * demo provider NOT registered  -> raw JS toString fallback (see "Raw" below).
    //   * demo provider registered      -> uses the property's own KoQ + `SchemaFormatsProvider`
    //                                      for lookups.
    //
    // The "Expected" strings that describe deterministic conversions via seed-supplied FormatProps
    // are exact; the ones that depend on the property's KoQ are annotated because their exact
    // form depends on how ParkingRow.Origin's KoQ resolves in the FormatsProvider.

    editor.appendBreak();
    editor.runStyle.isBold = true;
    editor.appendText("Quantity formatting cases — exercised by both the txn callback path and evaluateFields/evaluateFieldsAsync");
    editor.runStyle.isBold = false;
    editor.appendBreak();
    editor.runStyle.color = ColorDef.fromString("#888888").toJSON();
    editor.runStyle.isItalic = true;
    editor.appendText("Sync path (formatFieldValueWithSpecResolver):");
    editor.appendBreak();
    editor.appendText("  • ElementDrivesTextAnnotation.evaluateFields — the public sync API.");
    editor.appendBreak();
    editor.appendText("  • TxnManager callback — fires when a source element changes or is deleted.");
    editor.appendBreak();
    editor.appendText("  • Both consult the per-iModel FormattingSpecProvider registered via `FieldFormattingDemo.enableFieldFormattingDemo` (see backend).");
    editor.appendBreak();
    editor.appendText("Async path (formatFieldValueAsync):");
    editor.appendBreak();
    editor.appendText("  • ElementDrivesTextAnnotation.evaluateFieldsAsync — how DTA populates the fields shown here.");
    editor.appendBreak();
    editor.appendText("When a provider is registered, both paths produce identical output; without one, the sync path falls back to toString().");
    editor.runStyle.isItalic = false;
    editor.runStyle.color = ColorDef.fromString("black").toJSON();
    editor.appendBreak();

    const persistenceUnit = "Units.M";
    // const persistenceUnit = undefined;

    // No formatOptions at all — cleanest test of the demo provider on both paths.
    expectField(
      "No overrides",
      "(30707.1467 m, 58893.3153 m, 0 m)",
      undefined,
      "No formatOptions. Property KoQ can't be resolved, so falls through to defaultCoordinateFormatProps (precision 4 metres). Trailing zeros dropped (no `trailZeros` trait).",
    );

    // Only persistence unit
    expectField(
      "Only persistence unit",
      "(30707.1467 m, 58893.3153 m, 0 m)",
      { quantity: { persistenceUnit } },
      "persistenceUnit alone doesn't select a format; falls through to defaultCoordinateFormatProps.",
    );

    // kindOfQuantity chooses which KoQ the FormatsProvider resolves.
    expectField(
      "KoQ override (LENGTH_SHORT)",
      "(30707146.7 [*]mm, 58893315.3 [*]mm, 0 [*]mm)",
      { quantity: { kindOfQuantity: "AecUnits.LENGTH_SHORT", persistenceUnit } },
      "kindOfQuantity= overrides the property's own KoQ. DEMO_SEED_FORMATS supplies an [*]mm-marked stand-in so this works even without the AecUnits schema loaded.",
    );

    // Post-format wrappers — no quantity override, so wraps whatever the active pathway produces.
    expectField(
      "Prefix/suffix wrappers",
      "L=(30707.1467 m, 58893.3153 m, 0 m) (m)",
      { prefix: "L=", suffix: " (m)", quantity: { persistenceUnit } },
      "prefix/suffix wrap the ENTIRE formatted coordinate string (not each magnitude).",
    );

    // Post-format upper-case transform — no quantity override.
    expectField(
      "Case upper",
      "(30707.1467 M, 58893.3153 M, 0 M)",
      { case: "upper", quantity: { persistenceUnit } },
      "case=upper is applied after formatting.",
    );

    // Seed-backed kindOfQuantity: no schema KoQ required. The demo provider's DEMO_SEED_FORMATS
    // table supplies the FormatProps directly, so these work on the sync path even when the
    // property's own KoQ is unresolvable.
    expectField(
      "Seed Demo.LENGTH_M",
      "(30707.1467 [#]m, 58893.3153 [#]m, 0 [#]m)",
      { quantity: { kindOfQuantity: "Demo.LENGTH_M", persistenceUnit } },
      "Uses DEMO_SEED_FORMATS['Demo.LENGTH_M'] — decimal metres, 4 dp. [#] marker confirms the demo seed applied.",
    );

    expectField(
      "Seed Demo.LENGTH_MM",
      "(30707146.7 [*]mm, 58893315.3 [*]mm, 0 [*]mm)",
      { quantity: { kindOfQuantity: "Demo.LENGTH_MM", persistenceUnit } },
      "Uses DEMO_SEED_FORMATS['Demo.LENGTH_MM'] — decimal mm, 3 dp. Trailing digits reflect actual m->mm conversion. [*] marker confirms the demo seed applied.",
    );

    expectField(
      "Seed Demo.LENGTH_FT",
      "(100745.232 [~]ft, 193219.5384 [~]ft, 0 [~]ft)",
      { quantity: { kindOfQuantity: "Demo.LENGTH_FT", persistenceUnit } },
      "Uses DEMO_SEED_FORMATS['Demo.LENGTH_FT'] — decimal ft, 4 dp. Trailing digits reflect actual m->ft conversion. [~] marker confirms the demo seed applied.",
    );

    await editor.update();
  }

  // TODO: Remove before merging, just for convenience while testing.
  // Tests scalar quantity field formatting against Building.footprintArea.
  private async testFootprintArea() {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp) {
      return;
    }

    const tabSize = 0.025;

    // Setup
    await this.parseAndRun("init", "0x20000000398");
    await this.parseAndRun("applystyle", "0x50000000001");
    await this.parseAndRun("font", "Arimo");
    await this.parseAndRun("center");

    const expectField = (title: string, expected: string, formatOptions?: FieldFormatOptions, note?: string) => {
      const expectedColor = ColorDef.fromString("#ff5959").toJSON();
      const actualColor = ColorDef.fromString("#156715").toJSON();
      const defaultColor = ColorDef.fromString("black").toJSON();

      // Label
      editor.appendBreak();
      editor.runStyle.color = defaultColor;
      editor.runStyle.isBold = true;
      editor.appendText(title);
      editor.runStyle.isBold = false;
      editor.appendBreak();

      // Expected value
      editor.appendText("Expected: ");
      editor.runStyle.color = expectedColor;
      editor.appendTab(tabSize);
      editor.appendText(expected);
      editor.runStyle.color = defaultColor;

      // Actual field
      const fieldProps = {
        elementId: "0x20000001f05",
        schemaName: "BuildingSpatial",
        className: "Building",
        propertyName: "FootprintArea",
        formatOptions,
      };
      editor.appendBreak();
      editor.appendText("Actual: ");
      editor.runStyle.color = actualColor;
      editor.appendTab(tabSize);
      editor.appendField(fieldProps);
      editor.runStyle.color = defaultColor;

      // Comment
      if (note) {
        editor.appendBreak();
        editor.runStyle.color = ColorDef.fromString("#888888").toJSON();
        editor.runStyle.isItalic = true;
        editor.appendText(note);
        editor.runStyle.isItalic = false;
        editor.runStyle.color = defaultColor;
      }

      editor.appendBreak();
      editor.appendText(JSON.stringify({ formatOptions: formatOptions ?? null }));

      editor.appendBreak();
      editor.appendText(" ");
    };

    // Raw (persistence) value for Building.footprintArea used as reference below:
    //   6395.894993427551 m²  (persistence unit: Units.SQ_M)
    // Conversions:
    //   m²  -> mm² : x 1,000,000  ->  6,395,894,993.427551
    //   m²  -> ft² : / 0.09290304 ->  68,844.84074393637
    // Notes:
    //   * FootprintArea is a scalar quantity field, so the output is a single formatted
    //     magnitude (no parenthesised coordinate tuple like the Origin test).
    //   * DEMO_SEED_FORMATS now contains `Demo.AREA_*` seeds (see FieldFormattingDemo.ts)
    //     which are preloaded against `Units.SQ_M`, so `kindOfQuantity: "Demo.AREA_*"`
    //     resolves on the sync path even without any schema KoQ. The sync no-format
    //     fallback for a scalar quantity with no resolvable KoQ is still a raw
    //     `.toString()` (no length-style coordinate fallback applies).

    editor.appendBreak();
    editor.runStyle.isBold = true;
    editor.appendText("Quantity formatting cases — exercised by both the txn callback path and evaluateFields/evaluateFieldsAsync");
    editor.runStyle.isBold = false;
    editor.appendBreak();
    editor.runStyle.color = ColorDef.fromString("#888888").toJSON();
    editor.runStyle.isItalic = true;
    editor.appendText("Sync path (formatFieldValueWithSpecResolver):");
    editor.appendBreak();
    editor.appendText("  • ElementDrivesTextAnnotation.evaluateFields — the public sync API.");
    editor.appendBreak();
    editor.appendText("  • TxnManager callback — fires when a source element changes or is deleted.");
    editor.appendBreak();
    editor.appendText("  • Both consult the per-iModel FormattingSpecProvider registered via `FieldFormattingDemo.enableFieldFormattingDemo` (see backend).");
    editor.appendBreak();
    editor.appendText("Async path (formatFieldValueAsync):");
    editor.appendBreak();
    editor.appendText("  • ElementDrivesTextAnnotation.evaluateFieldsAsync — how DTA populates the fields shown here.");
    editor.appendBreak();
    editor.appendText("When a provider is registered, both paths produce identical output; without one, the sync path falls back to toString().");
    editor.runStyle.isItalic = false;
    editor.runStyle.color = ColorDef.fromString("black").toJSON();
    editor.appendBreak();

    // const persistenceUnit = "Units.SQ_M";
    const persistenceUnit = undefined;

    // No formatOptions at all — no coordinate fallback for scalar quantity, so falls
    // through to the raw `.toString()` formatter.
    expectField(
      "No overrides",
      "6395.895 m²",
      undefined,
      "No formatOptions. Property KoQ can't be resolved and there is no scalar-quantity fallback format, so the raw JS toString is emitted (no unit label).",
    );

    // Only persistence unit — persistenceUnit alone doesn't select a format.
    expectField(
      "Only persistence unit",
      "6395.895 m²",
      { quantity: { persistenceUnit } },
      "persistenceUnit alone doesn't select a format; no scalar-quantity fallback, so raw toString is emitted.",
    );

    // Post-format wrappers — no quantity override, wraps whatever the sync path produced.
    expectField(
      "Prefix/suffix wrappers",
      "A=6395.895 (m²)",
      { prefix: "A=", suffix: " (m²)", quantity: { persistenceUnit } },
      "prefix/suffix wrap the ENTIRE formatted string — here just the raw toString value.",
    );

    // Post-format upper-case transform. Upper-casing pure digits/dot is a no-op.
    expectField(
      "Case upper",
      "6395.895 M²",
      { case: "upper", quantity: { persistenceUnit } },
      "case=upper applied after formatting; digits are unaffected.",
    );

    // Seed-backed kindOfQuantity: no schema KoQ required. The demo provider's DEMO_SEED_FORMATS
    // table supplies the FormatProps directly, so these work on the sync path even when the
    // property's own KoQ is unresolvable.
    expectField(
      "Seed Demo.AREA_M2",
      "6395.895 [$]m²",
      { quantity: { kindOfQuantity: "Demo.AREA_M2", persistenceUnit } },
      "Uses DEMO_SEED_FORMATS['Demo.AREA_M2'] — decimal m², 4 dp. Trailing zero dropped (6395.8950 -> 6395.895). [$] marker confirms the demo seed applied.",
    );

    expectField(
      "Seed Demo.AREA_MM2",
      "6395894993.43 [%]mm²",
      { quantity: { kindOfQuantity: "Demo.AREA_MM2", persistenceUnit } },
      "Uses DEMO_SEED_FORMATS['Demo.AREA_MM2'] — decimal mm², 2 dp. Verifies m² -> mm² conversion (x 1,000,000). [%] marker confirms the demo seed applied.",
    );

    expectField(
      "Seed Demo.AREA_FT2",
      "68844.8407 [&]ft²",
      { quantity: { kindOfQuantity: "Demo.AREA_FT2", persistenceUnit } },
      "Uses DEMO_SEED_FORMATS['Demo.AREA_FT2'] — decimal ft², 4 dp. Verifies m² -> ft² conversion (/ 0.09290304). [&] marker confirms the demo seed applied.",
    );

    await editor.update();
  }

  // TODO: Remove before merging, just for convenience while testing.
  private async testTextFromJson(json: string) {
    await this.parseAndRun("init", "0x20000000398");
    await this.parseAndRun("applystyle", "0x50000000001");
    await this.parseAndRun("font", "Arimo");
    await this.parseAndRun("center");
    await this.parseAndRun("json", json);
  }

  public override async parseAndRun(...inArgs: string[]): Promise<boolean> {
    const cmd = inArgs[0].toLowerCase();

    // TODO: Remove before merging, just for convenience while testing.
    if (cmd === "test") {
      await this.testText();
      return true;
    }

    // TODO: Remove before merging, just for convenience while testing.
    if (cmd === "testarea") {
      await this.testFootprintArea();
      return true;
    }

    // TODO: Remove before merging, just for convenience while testing.
    if (cmd === "testjson") {
      await this.testTextFromJson(inArgs[1]);
      return true;
    }

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
        const category = arg ?? vp.view.categorySelector.categories.values().next().value;
        if (undefined === category || category === "") {
          throw new Error("No category provided.");
        }

        editor.init(vp.iModel, category);
        break;
      }
      case "center":
        editor.origin = vp.view.getCenter();
        break;
      case "rotation":
        editor.rotation = Number(arg);
        break;
      case "offset":
        if (inArgs.length !== 3) {
          throw new Error("Expected x and y");
        }

        editor.offset.x = Number(arg);
        editor.offset.y = Number(inArgs[2]);
        break;
      case "font":
        editor.runStyle.font = { name: arg };
        break;
      case "text":
        editor.appendText(arg);
        break;
      case "fraction":
        if (inArgs.length !== 3) {
          throw new Error("Expected numerator and denominator");
        }
        editor.appendFraction(inArgs[1], inArgs[2]);
        break;
      case "field": {
        if (!arg) {
          throw new Error("Expected JSON blob with elementId, schemaName, className, propertyName, and optional formatOptions");
        }
        const fieldProps = JSON.parse(arg.replaceAll("'", "\"")) as {
          elementId: string,
          schemaName: string,
          className: string,
          propertyName: string,
          formatOptions?: FieldFormatOptions,
        };
        editor.appendField(fieldProps);
        break;
      }
      case "break":
        editor.appendBreak();
        break;
      case "tab": {
        const spaces = inArgs[1] ? parseFloat(inArgs[1]) : undefined;
        editor.appendTab(spaces);
        break;
      }
      case "paragraph":
        editor.appendParagraph();
        break;
      case "color":
        editor.runStyle.color = ColorDef.fromString(arg).toJSON();
        break;
      case "docheight":
        editor.documentStyle.textHeight = Number.parseFloat(arg);
        break;
      case "textheight":
        editor.runStyle.textHeight = Number.parseFloat(arg);
        break;
      case "widthfactor":
        editor.documentStyle.widthFactor = Number.parseFloat(arg);
        break;
      case "width":
        editor.setDocumentWidth(Number.parseFloat(arg));
        break;
      case "justify": {
        const just = arg.toLowerCase();
        switch (just) {
          case "left":
          case "center":
          case "right":
            editor.justify(just);
            break;
          default:
            throw new Error("Expected left, right, or center");
        }
        break;
      }
      case "indent": {
        const indentation = Number.parseFloat(arg);
        editor.setIndentation(indentation);
        break;
      }
      case "spacing":
        editor.documentStyle.lineSpacingFactor = Number.parseFloat(arg);
        break;
      case "bold":
        editor.runStyle.isBold = !editor.runStyle.isBold;
        break;
      case "italic":
        editor.runStyle.isItalic = !editor.runStyle.isItalic;
        break;
      case "underline":
        editor.runStyle.isUnderlined = !editor.runStyle.isUnderlined;
        break;
      case "fractionscale":
        editor.runStyle.stackedFractionScale = Number.parseFloat(arg);
        break;
      case "fractiontype": {
        const type = arg.toLowerCase();
        switch (type) {
          case "horizontal":
          case "diagonal":
            editor.runStyle.stackedFractionType = type;
            break;
          default:
            throw new Error("Expected horizontal or diagonal");
        }
        break;
      }
      case "subscriptscale": {
        const subScale = Number.parseFloat(arg);
        if (isNaN(subScale)) {
          throw new Error("Expected a number for subscript scale");
        }
        editor.runStyle.subScriptScale = subScale;
        break;
      }
      case "superscriptscale": {
        const superScale = Number.parseFloat(arg);
        if (isNaN(superScale)) {
          throw new Error("Expected a number for superscript scale");
        }
        editor.runStyle.superScriptScale = superScale;
        break;
      }
      case "shift": {
        const shift = arg.toLowerCase();
        switch (shift) {
          case "none":
          case "superscript":
          case "subscript":
            editor.baselineShift = shift;
            break;
          default:
            throw new Error("Expected none, superscript, or subscript");
        }
        break;
      }
      case "anchor": {
        const val = arg.toLowerCase();
        switch (val) {
          case "left":
          case "center":
          case "right":
            editor.anchor.horizontal = val;
            break;
          case "top":
          case "middle":
          case "bottom":
            editor.anchor.vertical = val;
            break;
          default:
            throw new Error("Expected top, middle, bottom, left, center, or right");
        }
        break;
      }
      case "margin": {
        const marginLocation = inArgs[1].toLowerCase();
        const val = Number(inArgs[2]);
        if (isNaN(val)) {
          throw new Error("Expected margin location followed by a number. Margin location can be left, right, top, bottom, all, horizontal, or vertical");
        }

        switch (marginLocation) {
          case "left":
          case "right":
          case "top":
          case "bottom":
            editor.setMargins({ [marginLocation]: val });
            break;
          case "all":
            editor.setMargins({ left: val, right: val, top: val, bottom: val });
            break;
          case "horizontal":
            editor.setMargins({ left: val, right: val });
            break;
          case "vertical":
            editor.setMargins({ top: val, bottom: val });
            break;
          default:
            throw new Error("Expected left, right, top, bottom, all, horizontal, or vertical");
        }
        break;
      }
      case "debug": {
        editor.debugAnchorPointAndRange = !editor.debugAnchorPointAndRange;
        break;
      }
      case "log": {
        // Log the current text block to the console
        const anno = TextAnnotation.fromJSON(editor.annotationProps);
        // eslint-disable-next-line no-console
        console.log(anno.textBlock.stringify({ paragraphBreak: "\n", lineBreak: "\n" }));
        // eslint-disable-next-line no-console
        console.log("Object > ", anno);
        // eslint-disable-next-line no-console
        console.log("Props > ", editor.annotationProps);
        break;
      }
      case "frame": {
        const key = inArgs[1];
        const val = inArgs[2];
        const frame: TextFrameStyleProps = editor.documentStyle.frame ?? { shape: "none" };
        if (key === "fillColor") frame.fillColor = (val === "background" || val === "subcategory") ? val : val ? ColorDef.fromString(val).toJSON() : undefined;
        else if (key === "borderColor") frame.borderColor = val ? ColorDef.fromString(val).toJSON() : undefined;
        else if (key === "borderWeight") frame.borderWeight = Number(val);
        else if (key === "shape") frame.shape = val as TextAnnotationFrameShape;
        else throw new Error("Expected shape, fillColor, borderColor, borderWeight");
        editor.documentStyle.frame = frame;

        break;
      }
      case "insertstyle": {
        if (!arg) {
          throw new Error("Expected style name");
        }
        const style: TextStyleSettingsProps = { ...editor.documentStyle, ...editor.runStyle };
        const styleId = await dtaIpc.insertTextStyle(
          vp.iModel.key,
          arg,
          style,
        );

        // eslint-disable-next-line no-console
        console.log(`Inserted text style with id ${styleId} and name ${arg}`);

        return true;
      }
      case "updatestyle": {
        if (!arg) {
          throw new Error("Expected style name");
        }
        const style: TextStyleSettingsProps = { ...editor.documentStyle, ...editor.runStyle };
        await dtaIpc.updateTextStyle(
          vp.iModel.key,
          arg,
          style,
        );
        return true;
      }
      case "deletestyle": {
        if (!arg) {
          throw new Error("Expected style name");
        }
        await dtaIpc.deleteTextStyle(
          vp.iModel.key,
          arg,
        );
        return true;
      }
      case "applystyle": {
        editor.defaultTextStyleId = arg;
        editor.textBlock.clearStyleOverrides();
        break;
      }
      case "load": {
        if (!arg) {
          throw new Error("Expected annotation ID");
        }

        const result = await dtaIpc.getText(vp.iModel.key, arg);

        if (!result) {
          throw new Error(`No text annotation found with id ${arg}`);
        }

        const anno = TextAnnotation.fromJSON(result.annotationProps);
        editor.textBlock = anno.textBlock;
        editor.anchor = anno.anchor;
        editor.rotation = YawPitchRollAngles.fromJSON(anno.orientation).yaw.degrees;
        editor.offset = anno.offset;
        editor.leaders = anno.leaders ?? [];
        editor.categoryId = result.categoryId;
        editor.modelId = result.modelId;
        editor.defaultTextStyleId = result.defaultTextStyleId;
        editor.origin = Point3d.fromJSON(result.placement.origin);

        editor.emphasizeElements.hideElements(arg, vp);
        break;
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

        await dtaIpc.deleteText(
          vp.iModel.key,
          arg
        );

        return true;
      }
      case "scale": {
        if (!arg) {
          throw new Error("Expected scale factor");
        }

        const scaleFactor = Number(arg);
        if (isNaN(scaleFactor)) {
          throw new Error("Expected a number for scale factor");
        }

        await dtaIpc.setScaleFactor(
          vp.iModel.key,
          editor.modelId,
          scaleFactor
        );

        break;
      }
      case "list": { // args are enumerator, terminator, case, index

        let enumerator = inArgs[1];
        if (enumerator !== "none" && enumerator in ListMarkerEnumerator) enumerator = (ListMarkerEnumerator as any)[enumerator];

        const terminator = inArgs[2] === "none" ? undefined : inArgs[2] as "period" | "parenthesis";
        const listCase = inArgs[3] === "none" ? undefined : inArgs[3] as "lower" | "upper";

        const index = inArgs[4] !== undefined ? parseInt(inArgs[4], 10) : undefined;
        editor.appendList(index, { enumerator, terminator, case: listCase });
        break;
      }
      case "list-item": {
        const index = inArgs[1] !== undefined ? parseInt(inArgs[1], 10) : undefined;
        editor.appendListItem(index);
        break;
      }
      case "leader": {
        const command = inArgs[1];
        if (command === "new") {
          editor.setLeaderProps();
          break;
        }

        if (editor.leaders.length === 0) {
          throw new Error("No leaders created. Use dta text leader new.");
        }

        const latestLeader = editor.leaders[editor.leaders.length - 1];
        switch (command) {
          case "start":
            editor.setLeaderStartPoint(latestLeader, Number(inArgs[2]));
            break;
          case "keypoint":
            editor.setLeaderKeyPoint(latestLeader, Number(inArgs[2]), Number(inArgs[3]));
            break;
          case "nearest":
            editor.setLeaderNearest(latestLeader);
            break;
          case "textpoint":
            editor.setLeaderTextPoint(latestLeader, inArgs[2] as LeaderTextPointOptions);
            break;
          case "terminatorShape": {
            const leaderStyle: TextLeaderStyleProps = editor.documentStyle.leader ?? {};
            leaderStyle.terminatorShape = inArgs[2] as TerminatorShape;
            editor.documentStyle.leader = leaderStyle;
            break;
          }
          default:
            throw new Error("Expected start, keypoint, nearest, textpoint");
        }
        break;
      }

      case "json": {
        const props = inArgs[1] && (JSON.parse(inArgs[1].replaceAll("'", "\"")) as TextBlockProps);

        if (props) {
          editor.setTextBlock(props);
        } else {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify(editor.annotationProps.textBlock).replaceAll("\"", "'"));
        }

        break;
      }
      default:
        throw new Error(`unrecognized command ${cmd}`);
    }

    await editor.update();
    return true;
  }

  public override async run(): Promise<boolean> {
    throw new Error("handled in parseAndRun");
  }
}

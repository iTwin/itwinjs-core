/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { assert, Id64String } from "@itwin/core-bentley";
import { TextStyleSettings, TextStyleSettingsProps } from "./TextStyle";

/** Options supplied to [[TextBlockComponent.clearStyleOverrides]] to control how the style overrides are cleared on the component and its child components.
 * @beta
 */
export interface ClearTextStyleOptions {
  /** Controls whether the styleOverrides of any child components are retained.
   * By default, all overrides are cleared.
   */
  preserveChildrenOverrides?: boolean;
}

/** The JSON representation of a [[TextBlockComponent]].
 * @beta
 */
export interface TextBlockComponentProps {
  /** Deviations from the base [[TextStyleSettings]] defined by the [AnnotationTextStyle]($backend) applied to this component.
   * This permits you to, e.g., create a [[TextBlock]] using "Arial" font and override one of its [[TextRun]]s to use "Comic Sans" instead.
   */
  styleOverrides?: TextStyleSettingsProps;
}

/** Options supplied to [[TextBlockComponent.stringify]] to control how the content is formatted.
 * @beta
 */
export interface TextBlockStringifyOptions {
  /** A string to insert in between each [[Paragraph]].
   * Default: " " - a single space.
   */
  paragraphBreak?: string;
  /** A string to insert for each [[LineBreakRun]].
   * Default: " " - a single space.
   */
  lineBreak?: string;
  /** A string to insert between the numerator and denominator of each [[FractionRun]].
   * Default: "/"
   */
  fractionSeparator?: string;
  /** The number of spaces to use for tabs. If not provided, tabs will be represented by a tab character: "\t".
   * Default: "undefined" - use "\t".
   */
  tabsAsSpaces?: number;
}

/** Abstract representation of any of the building blocks that make up a [[TextBlock]] document - namely [[Run]]s, [[Paragraph]]s, and [[TextBlock]] itself.
 * The [[TextBlock]] can specify an [AnnotationTextStyle]($backend) that formats its contents. Each component can specify an optional [[styleOverrides]] to customize that formatting.
 * @beta
 */
export abstract class TextBlockComponent {
  private _styleOverrides: TextStyleSettingsProps;
  private _parent?: TextBlockComponent;
  private _children?: TextBlockComponent[];

  /** @internal */
  protected constructor(props?: TextBlockComponentProps) {
    this._styleOverrides = TextStyleSettings.cloneProps(props?.styleOverrides ?? {});
  }

  public get root(): TextBlockComponent {
    let current: TextBlockComponent | undefined = this.parent;

    if (!current) return this;

    while (current.parent) {
      current = current.parent;
    }
    return current;
  }

  public get parent(): TextBlockComponent | undefined {
    return this._parent;
  }

  public set parent(parent: TextBlockComponent | undefined) {
    this._parent = parent;
  }

  public get children(): TextBlockComponent[] | undefined {
    return this._children;
  }

  public set children(children: TextBlockComponent[] | undefined) {
    children?.forEach((child) => { child.parent = this; }); // Ensure each child has its parent set
    this._children = children;
  }

  public get last(): TextBlockComponent | undefined {
    return this._children?.[this._children.length - 1];
  }

  public get previousSibling(): TextBlockComponent | undefined {
    if (!this.parent) return undefined;
    const siblings = this.parent.children;
    assert(siblings !== undefined, "TextBlockComponent must have a parent with children");
    const index = siblings?.indexOf(this);
    return index !== undefined && index > 0 ? siblings[index - 1] : undefined;
  }

  public get nextSibling(): TextBlockComponent | undefined {
    if (!this.parent) return undefined;
    const siblings = this.parent.children;
    assert(siblings !== undefined, "TextBlockComponent must have a parent with children");
    const index = siblings?.indexOf(this);
    return index !== undefined && index < siblings.length - 1 ? siblings[index + 1] : undefined;
  }

  /** Deviations in individual properties of the [[TextStyle]] specified by [[styleName]].
   * For example, if the style uses the "Arial" font, you can override that by settings `styleOverrides.fontName` to "Comic Sans".
   * @see [[clearStyleOverrides]] to reset this to an empty object.
   */
  public get styleOverrides(): TextStyleSettingsProps {
    return this._styleOverrides;
  }

  public set styleOverrides(overrides: TextStyleSettingsProps) {
    this._styleOverrides = TextStyleSettings.cloneProps(overrides);
  }

  /** Reset any [[styleOverrides]] applied to this component. */
  public clearStyleOverrides(_options?: ClearTextStyleOptions): void {
    this.styleOverrides = { };
  }

  /** Returns true if [[styleOverrides]] specifies any deviations from the [[TextBlock]]'s [AnnotationTextStyle]($backend). */
  public get overridesStyle(): boolean {
    return Object.keys(this.styleOverrides).length > 0;
  }

  /** Create a deep copy of this component. */
  public abstract clone(): TextBlockComponent;

  /** Compute a string representation of the contents of this component and all of its sub-components. */
  public abstract stringify(options?: TextBlockStringifyOptions): string;

  /**
  * Returns true if this component has no children.
  */
  public get isEmpty(): boolean {
    return this._children?.length === 0;
  };

  /**
  * Returns true if the string representation of this component consists only of whitespace characters.
  * Useful for checking if the component is visually empty (producing no graphics) or contains only spaces, tabs, or line breaks.
  */
  public get isWhitespace(): boolean {
    return /^\s*$/g.test(this.stringify());
  };

  /** Convert this component to its JSON representation. */
  public toJSON(): TextBlockComponentProps {
    return {
      styleOverrides: TextStyleSettings.cloneProps(this.styleOverrides),
    };
  }

  /** Returns true if `this` is equivalent to `other`. */
  public equals(other: TextBlockComponent): boolean {
    const myKeys = Object.keys(this.styleOverrides);
    const yrKeys = Object.keys(other._styleOverrides);
    if (myKeys.length !== yrKeys.length) {
      return false;
    }

    for (const name of myKeys) {
      const key = name as keyof TextStyleSettingsProps;
      if (this.styleOverrides[key] !== other.styleOverrides[key]) {
        return false;
      }
    }

    return true;
  }
}

/**
 * @beta
 */
export type Run = TextRun | FractionRun | TabRun | LineBreakRun;

/** The JSON representation of a [[Run]].
 * Use the `type` field to discriminate between the different kinds of runs.
 * @beta
 */
export type RunProps = TextRunProps | FractionRunProps | TabRunProps | LineBreakRunProps;

/** A sequence of characters within a [[Paragraph]] that share a single style. Runs are the leaf nodes of a [[TextBlock]] document. When laid out for display, a single run may span
 * multiple lines, but it will never contain different styling.
 * Use the `type` field to discriminate between the different kinds of runs.
 * @beta
 */
export namespace Run { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Create a run from its JSON representation.
   * @see [[TextRun.create]], [[FractionRun.create]], and [[LineBreakRun.create]] to create a run directly.
   */
  export function fromJSON(props: RunProps): Run {
    switch (props.type) {
      case "text": return TextRun.create(props);
      case "fraction": return FractionRun.create(props);
      case "tab": return TabRun.create(props);
      case "linebreak": return LineBreakRun.create(props);
    }
  }
}

/** Describes whether the characters of a [[TextRun]] should be displayed normally, in subscript, or in superscript.
 * [[TextStyleSettings.superScriptScale]], [[TextStyleSettings.subScriptScale]], [[TextStyleSettings.superScriptOffsetFactor]], and [[TextStyleSettings.subScriptOffsetFactor]]
 * affect how the content is rendered.
 * @beta
 */
export type BaselineShift = "subscript" | "superscript" | "none";

/** JSON representation of a [[TextRun]].
 * @beta
 */
export interface TextRunProps extends TextBlockComponentProps {
  /** Discriminator field for the [[RunProps]] union. */
  readonly type: "text";
  /** The characters displayed by the run.
   * Default: an empty string.
   */
  content?: string;
  /** Whether to display [[content]] as a subscript, superscript, or normally.
   * Default: "none"
   */
  baselineShift?: BaselineShift;
}

/** The most common type of [[Run]], containing a sequence of characters to be displayed using a single style.
 * @beta
 */
export class TextRun extends TextBlockComponent {
  /** Discriminator field for the [[Run]] union. */
  public readonly type = "text";
  /** The sequence of characters to be displayed by the run. */
  public content: string;
  /** Whether to display [[content]] as a subscript, superscript, or normally. */
  public baselineShift: BaselineShift;

  private constructor(props?: Omit<TextRunProps, "type">) {
    super(props);
    this.content = props?.content ?? "";
    this.baselineShift = props?.baselineShift ?? "none";
  }

  public override clone(): TextRun {
    return new TextRun(this.toJSON());
  }

  public override toJSON(): TextRunProps {
    return {
      ...super.toJSON(),
      type: "text",
      content: this.content,
      baselineShift: this.baselineShift,
    };
  }

  public static create(props?: Omit<TextRunProps, "type">): TextRun {
    return new TextRun(props);
  }

  /** Simply returns [[content]]. */
  public override stringify(): string {
    return this.content;
  }

  public override equals(other: TextBlockComponent): boolean {
    return other instanceof TextRun && this.content === other.content && this.baselineShift === other.baselineShift && super.equals(other);
  }
}

/** JSON representation of a [[FractionRun]].
 * @beta
 */
export interface FractionRunProps extends TextBlockComponentProps {
  /** Discriminator field for the [[RunProps]] union. */
  readonly type: "fraction";
  /** The text displayed before or above the fraction separator, depending on [[TextStyleSettings.stackedFractionType]]. Default: an empty string. */
  numerator?: string;
  /** The text displayed after or below the fraction separator, depending on [[TextStyleSettings.stackedFractionType]]. Default: an empty string. */
  denominator?: string;
}

/** A [[Run]] containing a numeric ratio to be displayed as a numerator and denominator separated by a horizontal or diagonal bar.
 * @note The [[numerator]] and [[denominator]] are stored as strings. They are not technically required to contain a numeric representation.
 * @beta
 */
export class FractionRun extends TextBlockComponent {
  /** Discriminator field for the [[Run]] union. */
  public readonly type = "fraction";
  /** The fraction's numerator. */
  public numerator: string;
  /** The fraction's denominator. */
  public denominator: string;

  private constructor(props?: Omit<FractionRunProps, "type">) {
    super(props);
    this.numerator = props?.numerator ?? "";
    this.denominator = props?.denominator ?? "";
  }

  public override toJSON(): FractionRunProps {
    return {
      ...super.toJSON(),
      type: "fraction",
      numerator: this.numerator,
      denominator: this.denominator,
    };
  }

  public override clone(): FractionRun {
    return new FractionRun(this.toJSON());
  }

  public static create(props?: Omit<FractionRunProps, "type">): FractionRun {
    return new FractionRun(props);
  }

  /** Formats the fraction as a string with the [[numerator]] and [[denominator]] separated by [[TextBlockStringifyOptions.fractionSeparator]]. */
  public override stringify(options?: TextBlockStringifyOptions): string {
    const sep = options?.fractionSeparator ?? "/";
    return `${this.numerator}${sep}${this.denominator}`;
  }

  public override equals(other: TextBlockComponent): boolean {
    return other instanceof FractionRun && this.numerator === other.numerator && this.denominator === other.denominator && super.equals(other);
  }
}

/** JSON representation of a [[LineBreakRun]].
 * @beta
 */
export interface LineBreakRunProps extends TextBlockComponentProps {
  /** Discriminator field for the [[RunProps]] union. */
  readonly type: "linebreak";
}

/** A [[Run]] that represents the end of a line of text within a [[Paragraph]]. It contains no content of its own - it simply causes subsequent content to display on a new line.
 * @beta
 */
export class LineBreakRun extends TextBlockComponent {
  /** Discriminator field for the [[Run]] union. */
  public readonly type = "linebreak";

  private constructor(props?: TextBlockComponentProps) {
    super(props);
  }

  public override toJSON(): LineBreakRunProps {
    return {
      ...super.toJSON(),
      type: "linebreak",
    };
  }

  public static create(props?: TextBlockComponentProps) {
    return new LineBreakRun(props);
  }

  public override clone(): LineBreakRun {
    return new LineBreakRun(this.toJSON());
  }

  /** Simply returns [[TextBlockStringifyOptions.lineBreak]]. */
  public override stringify(options?: TextBlockStringifyOptions): string {
    return options?.lineBreak ?? " ";
  }

  public override equals(other: TextBlockComponent): boolean {
    return other instanceof LineBreakRun && super.equals(other);
  }
}

/** JSON representation of a [[TabRun]].
 * @beta
 */
export interface TabRunProps extends TextBlockComponentProps {
  /** Discriminator field for the [[RunProps]] union. */
  readonly type: "tab";
}

/** A [[TabRun]] is used to shift the next tab stop.
 * @note Only left-justified tabs are supported at this tab.
 * @beta
 */
export class TabRun extends TextBlockComponent {
  /** Discriminator field for the [[Run]] union. */
  public readonly type = "tab";

  public override toJSON(): TabRunProps {
    return {
      ...super.toJSON(),
      type: "tab",
    };
  }

  public override clone(): TabRun {
    return new TabRun(this.toJSON());
  }

  public static create(props?: Omit<TabRunProps, "type">): TabRun {
    return new TabRun(props);
  }

    /**
   * Converts a [[TabRun]] to its string representation.
   * If the `tabsAsSpaces` option is provided, returns a string of spaces of the specified length.
   * Otherwise, returns a tab character ("\t").
   */
  public override stringify(options?: TextBlockStringifyOptions): string {
    if (options?.tabsAsSpaces) {
      return " ".repeat(options.tabsAsSpaces);
    }

    return "\t";
  }

  public override equals(other: TextBlockComponent): boolean {
    return other instanceof TabRun && super.equals(other);
  }
}

/** JSON representation of a [[Paragraph]].
 * @beta
 */
export interface ParagraphProps extends TextBlockComponentProps {
  /** The collection of [[Run]]s within the paragraph.
   * Default: an empty array.
   */
  runs?: RunProps[];
}

/** A collection of [[Run]]s within a [[TextBlock]]. Each paragraph within a text block is laid out on a separate line.
 * @beta
 */
export class Paragraph extends TextBlockComponent {
  /** The runs within the paragraph. You can modify the contents of this array to change the content of the paragraph. */
  public readonly runs: Run[];

  protected constructor(props: ParagraphProps) {
    super(props);
    this.runs = props?.runs?.map((run) => Run.fromJSON(run)) ?? [];

    this.runs.forEach(run => run.parent = this); // Set the parent of each run to this paragraph
    this.children = this.runs; // Ensure the runs are also added to the children of this paragraph for consistency with TextBlockComponent
  }

  public override toJSON(): ParagraphProps {
    return {
      ...super.toJSON(),
      runs: this.runs.map((run) => run.toJSON()),
    };
  }

  /** Create a paragraph from its JSON representation. */
  public static create(props: ParagraphProps): Paragraph {
    return new Paragraph(props);
  }

  public override clone(): Paragraph {
    return new Paragraph(this.toJSON());
  }

  public override get isEmpty(): boolean {
    return this.runs.length === 0;
  }

  /**
   * Clears any [[styleOverrides]] applied to this Paragraph.
   * Will also clear [[styleOverrides]] from all child components unless [[ClearTextStyleOptions.preserveChildrenOverrides]] is `true`.
   */
  public override clearStyleOverrides(options?: ClearTextStyleOptions): void {
    super.clearStyleOverrides();
    if (options?.preserveChildrenOverrides)
      return;

    for (const run of this.runs) {
      run.clearStyleOverrides();
    }
  }

  /** Compute a string representation of this paragraph by concatenating the string representations of all of its [[runs]]. */
  public override stringify(options?: TextBlockStringifyOptions): string {
    return this.runs.map((x) => x.stringify(options)).join("");
  }

  public override equals(other: TextBlockComponent): boolean {
    if (!(other instanceof Paragraph)) {
      return false;
    }

    if (this.runs.length !== other.runs.length || !super.equals(other)) {
      return false;
    }

    return this.runs.every((run, index) => run.equals(other.runs[index]));
  }

  public appendRun(run: Run): void {
    run.parent = this; // Set the parent to the paragraph

    if (!this.children) {
      this.children = [];
    }

    // Ensure the run is also added to the children of this paragraph for consistency with TextBlock
    this.children.push(run);
  }
}

/** Describes the relative alignment of the content of a [[TextBlock]].
 * @beta
 */
export type TextBlockJustification = "left" | "center" | "right";

/** Describes the margins around the content inside a [[TextBlock]]. It's measured in meters.
 * @beta
 */
export interface TextBlockMargins {
  /** The left margin measured in meters. Must be a positive number >= 0. Negative values are disregarded */
  left: number;
  /** The right margin measured in meters. Must be a positive number >= 0. Negative values are disregarded */
  right: number;
  /** The top margin measured in meters. Must be a positive number >= 0. Negative values are disregarded */
  top: number;
  /** The bottom margin measured in meters. Must be a positive number >= 0. Negative values are disregarded */
  bottom: number;
};

/** JSON representation of a [[TextBlock]].
 * @beta
 */
export interface TextBlockProps extends TextBlockComponentProps {
  /** The ID of an [AnnotationTextStyle]($backend) stored in the iModel from which the base [[TextStyleSettings]] applied to the [[TextBlock]] originates. */
  styleId: Id64String;
  /** The width of the document in meters. Lines that would exceed this width are instead wrapped around to the next line if possible.
   * A value less than or equal to zero indicates no wrapping is to be applied.
   * Default: 0
   */
  width?: number;
  /** The alignment of the document content. Default: "left". */
  justification?: TextBlockJustification;
  /** The margins to surround the document content. Default: 0 margins on all sides */
  margins?: Partial<TextBlockMargins>;
  /** The paragraphs within the text block. Default: an empty array. */
  paragraphs?: ParagraphProps[];
}

/** Represents a formatted text document consisting of a series of [[Paragraph]]s, each laid out on a separate line and containing their own content in the form of [[Run]]s.
 * You can change the content of the document by directly modifying the contents of its [[paragraphs]], or via [[appendParagraph]] and [[appendRun]].
 * No word-wrapping is applied to the document unless a [[width]] greater than zero is specified.
 * @see [[TextAnnotation]] to position a text block as an annotation in 2d or 3d space.
 * @beta
 */
export class TextBlock extends TextBlockComponent {
  /** The ID of the [AnnotationTextStyle]($backend) that provides the base formatting for the contents of this TextBlock.
   * @note Assigning to this property retains all style overrides on the TextBlock and its child components.
   * Call [[clearStyleOverrides]] to clear the TextBlock's and optionally all children's style overrides.
   */
  public styleId: Id64String;
  /** The width of the document in meters. Lines that would exceed this width are instead wrapped around to the next line if possible.
   * A value less than or equal to zero indicates no wrapping is to be applied.
   * Default: 0
   */
  public width: number;
  /** The alignment of the document's content. */
  public justification: TextBlockJustification;
  /** The margins of the document. */
  public margins: TextBlockMargins;
  /** The ordered list of paragraphs within the document. */
  public readonly paragraphs: Paragraph[];

  private constructor(props: TextBlockProps) {
    super(props);
    this.styleId = props.styleId;
    this.width = props.width ?? 0;
    this.justification = props.justification ?? "left";

    // Assign default margins if not provided
    this.margins = {
      left: props.margins?.left ?? 0,
      right: props.margins?.right ?? 0,
      top: props.margins?.top ?? 0,
      bottom: props.margins?.bottom ?? 0,
    };

    this.paragraphs = [];
    props.paragraphs?.forEach((x) => this.appendParagraph(x));
  }

  public override toJSON(): TextBlockProps {
    return {
      ...super.toJSON(),
      styleId: this.styleId,
      width: this.width,
      justification: this.justification,
      margins: this.margins,
      paragraphs: this.paragraphs.map((x) => x.toJSON()),
    };
  }

  /** Create a text block from its JSON representation. */
  public static create(props: TextBlockProps): TextBlock {
    return new TextBlock(props);
  }

  /** Create an empty text block containing no [[paragraphs]] and an empty [[styleId]]. */
  public static createEmpty(): TextBlock {
    return TextBlock.create({ styleId: "" });
  }

  /** Returns true if every paragraph in this text block is empty. */
  public override get isEmpty(): boolean {
    return this.paragraphs.every((p) => p.isEmpty);
  }

  public override clone(): TextBlock {
    return new TextBlock(this.toJSON());
  }

  /**
   * Clears any [[styleOverrides]] applied to this TextBlock.
   * Will also clear [[styleOverrides]] from all child components unless [[ClearTextStyleOptions.preserveChildrenOverrides]] is `true`.
   */
  public override clearStyleOverrides(options?: ClearTextStyleOptions): void {
    super.clearStyleOverrides();
    if (options?.preserveChildrenOverrides)
      return;

    for (const paragraph of this.paragraphs) {
      paragraph.clearStyleOverrides();
    }
  }

  /** Compute a string representation of the document's contents by concatenating the string representations of each of its [[paragraphs]], separated by [[TextBlockStringifyOptions.paragraphBreak]]. */
  public stringify(options?: TextBlockStringifyOptions): string {
    return this.paragraphs.map((x) => x.stringify(options)).join(options?.paragraphBreak ?? " ");
  }

  /** Add and return a new paragraph.
   * By default, the paragraph will be created with no [[styleOverrides]], so that it inherits the style of this block.
   * @param seedFromLast If true and [[paragraphs]] is not empty, the new paragraph will inherit the style overrides of the last [[Paragraph]] in this block.
   */
  public appendParagraph(props?: ParagraphProps, seedFromLast: boolean = false): Paragraph {
    let styleOverrides: TextStyleSettingsProps = {};

    if (seedFromLast && this.paragraphs.length > 0) {
      const seed = this.paragraphs[this.paragraphs.length - 1];
      styleOverrides = { ...seed.styleOverrides };
    }

    const paragraphProps = props ?? {
      styleOverrides
    };
    const paragraph = Paragraph.create(paragraphProps);

    paragraph.parent = this; // Set the parent to this block
    this.paragraphs.push(paragraph);
    if (!this.children) {
      this.children = [];
    }
    this.children.push(paragraph); // Ensure the paragraph is also added to the children of this block for consistency
    return paragraph;
  }

  /** Append a run to the last [[Paragraph]] in this block.
   * If the block contains no [[paragraphs]], a new one will first be created using [[appendParagraph]].
   */
  public appendRun(run: Run): void {
    const paragraph = this.last instanceof Paragraph ? this.last : this.appendParagraph();
    paragraph.appendRun(run);
  }

  public override equals(other: TextBlockComponent): boolean {
    if (!(other instanceof TextBlock)) {
      return false;
    }

    if (this.styleId !== other.styleId || !super.equals(other)) {
      return false;
    }

    if (this.width !== other.width || this.justification !== other.justification || this.paragraphs.length !== other.paragraphs.length) {
      return false;
    }

    const marginsAreEqual = Object.entries(this.margins).every(([key, value]) =>
      value === (other.margins as any)[key]
    );

    if (!marginsAreEqual) return false;

    return this.paragraphs.every((paragraph, index) => paragraph.equals(other.paragraphs[index]));
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { TextStyleSettingsProps } from "./TextStyle";

/** Options supplied to [[TextBlockComponent.applyStyle]] to control how the style is applied to the component and its child components.
 * @beta
 * @preview
 * @extensions
 */
export interface ApplyTextStyleOptions {
  /** Controls whether any deviations from the style's settings stored in [[TextBlockComponent.styleOverrides]] are retained.
   * By default, all overrides are cleared.
   */
  preserveOverrides?: boolean;
  /** Controls whether the style should be recursively applied to the [[Paragraph]]s belonging to a [[TextBlock]] and the [[Run]]s belonging to a [[Paragraph]].
   * By default, the style change propagates to child components.
   */
  preventPropagation?: boolean;
}

/** The JSON representation of a [[TextBlockComponent]].
 * @beta
 * @preview
 * @extensions
 */
export interface TextBlockComponentProps {
  /** The name of a [[TextStyle]] stored in a [Worksapce]($backend) from which the base [[TextStyleSettings]] applied to the component originates. */
  styleName: string;
  /** Deviations from the base [[TextStyleSettings]] defined by the [[TextStyle]] applied to this component.
   * This permits you to, e.g., create a [[TextRun]] using "Arial" font and override it to use "Comic Sans" instead.
   */
  styleOverrides?: TextStyleSettingsProps;
}

/** Options supplied to [[TextBlockComponent.stringify]] to control how the content is formatted.
 * @beta
 * @preview
 * @extensions
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
}

/** Abstract representation of any of the building blocks that make up a [[TextBlock]] document - namely [[Run]]s, [[Paragraph]]s, and [[TextBlock]] itself.
 * Each component can specify a [[TextStyle]] that formats its contents and optional [[styleOverrides]] to customize that formatting.
 * @beta
 * @preview
 * @extensions
 */
export abstract class TextBlockComponent {
  private _styleName: string;
  private _styleOverrides: TextStyleSettingsProps;

  /** @internal */
  protected constructor(props: TextBlockComponentProps) {
    this._styleName = props.styleName;
    this._styleOverrides = { ...props.styleOverrides };
  }

  /** The name of the [[TextStyle]] that provides the base formatting for the contents of this component.
   * @note Assigning to this property is equivalent to calling [[applyStyle]] with default [[TextStyleApplyOptions]], which propagates the style change to all of
   * the components sub-components and clears any [[styleOverrides]].
   */
  public get styleName(): string {
    return this._styleName;
  }

  public set styleName(styleName: string) {
    this.applyStyle(styleName);
  }

  /** Deviations in individual properties of the [[TextStyle]] specified by [[styleName]].
   * For example, if the style uses the "Arial" font, you can override that by settings `styleOverrides.fontName` to "Comic Sans".
   * @see [[clearStyleOverrides]] to reset this to an empty object.
   */
  public get styleOverrides(): TextStyleSettingsProps {
    return this._styleOverrides;
  }

  public set styleOverrides(overrides: TextStyleSettingsProps) {
    this._styleOverrides = { ...overrides };
  }

  /** Reset any [[styleOverrides]] applied to this component's [[TextStyle]]. */
  public clearStyleOverrides(): void {
    this.styleOverrides = { };
  }

  /** Apply the [[TextStyle]] specified by `styleName` to this component, optionally preserving [[styleOverrides]] and/or preventing propagation to sub-components. */
  public applyStyle(styleName: string, options?: ApplyTextStyleOptions): void {
    this._styleName = styleName;

    if (!(options?.preserveOverrides)) {
      this.clearStyleOverrides();
    }
  }

  /** Returns true if [[styleOverrides]] specifies any deviations from this component's base [[TextStyle]]. */
  public get overridesStyle(): boolean {
    return Object.keys(this.styleOverrides).length > 0;
  }

  /** Create a deep copy of this component. */
  public abstract clone(): TextBlockComponent;

  /** Compute a string representation of the contents of this component and all of its sub-components.
   * ###TODO link to TextBlockLayout for doing actual layout, once that's available.
   */
  public abstract stringify(options?: TextBlockStringifyOptions): string;

  /** Convert this component to its JSON representation. */
  public toJSON(): TextBlockComponentProps {
    return {
      styleName: this.styleName,
      styleOverrides: { ...this.styleOverrides },
    };
  }

  /** Returns true if `this` is equivalent to `other`. */
  public equals(other: TextBlockComponent): boolean {
    const myKeys = Object.keys(this.styleOverrides);
    const yrKeys = Object.keys(other._styleOverrides);
    if (this.styleName !== other.styleName || myKeys.length !== yrKeys.length) {
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
 * @preview
 * @extensions
 */
export type Run = TextRun | FractionRun | LineBreakRun;

/** The JSON representation of a [[Run]].
 * Use the `type` field to discriminate between the different kinds of runs.
 * @beta
 * @preview
 * @extensions
 */
export type RunProps = TextRunProps | FractionRunProps | LineBreakRunProps;

/** A sequence of characters within a [[Paragraph]] that share a single style. Runs are the leaf nodes of a [[TextBlock]] document. When laid out for display, a single run may span
 * multiple lines, but it will never contain different styling.
 * Use the `type` field to discriminate between the different kinds of runs.
 * @beta
 * @preview
 * @extensions
 */
export namespace Run { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Create a run from its JSON representation.
   * @see [[TextRun.create]], [[FractionRun.create]], and [[LineBreakRun.create]] to create a run directly.
   */
  export function fromJSON(props: RunProps): Run {
    switch (props.type) {
      case "text": return TextRun.create(props);
      case "fraction": return FractionRun.create(props);
      case "linebreak": return LineBreakRun.create(props);
    }
  }
}

/** Describes whether the characters of a [[TextRun]] should be displayed normally, in subscript, or in superscript.
 * [[TextStyleSettings.superScriptScale]], [[TextStyleSettings.subScriptScale]], [[TextStyleSettings.superScriptOffsetFactor]], and [[TextStyleSettings.subScriptOffsetFactor]]
 * affect how the content is rendered.
 * @beta
 * @preview
 * @extensions
 */
export type BaselineShift = "subscript" | "superscript" | "none";

/** JSON representation of a [[TextRun]].
 * @beta
 * @preview
 * @extensions
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
 * @preview
 * @extensions
 */
export class TextRun extends TextBlockComponent {
  /** Discriminator field for the [[Run]] union. */
  public readonly type = "text";
  /** The sequence of characters to be displayed by the run. */
  public content: string;
  /** Whether to display [[content]] as a subscript, superscript, or normally. */
  public baselineShift: BaselineShift;

  private constructor(props: Omit<TextRunProps, "type">) {
    super(props);
    this.content = props.content ?? "";
    this.baselineShift = props.baselineShift ?? "none";
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

  public static create(props: Omit<TextRunProps, "type">): TextRun {
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
 * @preview
 * @extensions
 */
export interface FractionRunProps extends TextBlockComponentProps {
  /** Discriminator field for the [[RunProps]] union. */
  readonly type: "fraction";
  /** The text displayed before or above the fraction separator, depending on [[TextStyle.stackedFractionType]]. Default: an empty string. */
  numerator?: string;
  /** The text displayed after or below the fraction separator, depending on [[TextStyle.stackedFractionType]]. Default: an empty string. */
  denominator?: string;
}

/** A [[Run]] containing a numeric ratio to be displayed as a numerator and denominator separated by a horizontal or diagonal bar.
 * @note The [[numerator]] and [[denominator]] are stored as strings. They are not technically required to contain a numeric representation.
 * @beta
 * @preview
 * @extensions
 */
export class FractionRun extends TextBlockComponent {
  /** Discriminator field for the [[Run]] union. */
  public readonly type = "fraction";
  /** The fraction's numerator. */
  public numerator: string;
  /** The fraction's denominator. */
  public denominator: string;

  private constructor(props: Omit<FractionRunProps, "type">) {
    super(props);
    this.numerator = props.numerator ?? "";
    this.denominator = props.denominator ?? "";
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

  public static create(props: Omit<FractionRunProps, "type">): FractionRun {
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
 * @preview
 * @extensions
 */
export interface LineBreakRunProps extends TextBlockComponentProps {
  /** Discriminator field for the [[RunProps]] union. */
  readonly type: "linebreak";
}

/** A [[Run]] that represents the end of a line of text within a [[Paragraph]]. It contains no content of its own - it simply causes subsequent content to display on a new line.
 * @beta
 * @preview
 * @extensions
 */
export class LineBreakRun extends TextBlockComponent {
  /** Discriminator field for the [[Run]] union. */
  public readonly type = "linebreak";

  private constructor(props: TextBlockComponentProps) {
    super(props);
  }

  public override toJSON(): LineBreakRunProps {
    return {
      ...super.toJSON(),
      type: "linebreak",
    };
  }

  public static create(props: TextBlockComponentProps) {
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

/** JSON representation of a [[Paragraph]].
 * @beta
 * @preview
 * @extensions
 */
export interface ParagraphProps extends TextBlockComponentProps {
  /** The collection of [[Run]]s within the paragraph.
   * Default: an empty array.
   */
  runs?: RunProps[];
}

/** A collection of [[Run]]s within a [[TextBlock]]. Each paragraph within a text block is laid out on a separate line.
 * @beta
 * @preview
 * @extensions
 */
export class Paragraph extends TextBlockComponent {
  /** The runs within the paragraph. You can modify the contents of this array to change the content of the paragraph. */
  public readonly runs: Run[];

  private constructor(props: ParagraphProps) {
    super(props);
    this.runs = props.runs?.map((run) => Run.fromJSON(run)) ?? [];
  }

  public override toJSON(): ParagraphProps {
    return {
      ...super.toJSON(),
      runs: this.runs.map((run) => run.toJSON()),
    };
  }

  public static create(props: ParagraphProps): Paragraph {
    return new Paragraph(props);
  }

  public override clone(): Paragraph {
    return new Paragraph(this.toJSON());
  }

  /** Apply the specified style to this [[Paragraph]], and - unless [[ApplyTextStyleOptions.preventPropagation]] is `true` - to all of its [[runs]]. */
  public override applyStyle(styleName: string, options?: ApplyTextStyleOptions): void {
    super.applyStyle(styleName, options);
    if (!(options?.preventPropagation)) {
      for (const run of this.runs) {
        run.applyStyle(styleName, options);
      }
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
}

/** Describes the relative alignment of the content of a [[TextBlock]].
 * @beta
 * @preview
 * @extensions
 */
export type TextBlockJustification = "left" | "center" | "right";

/** JSON representation of a [[TextBlock]].
 * @beta
 * @preview
 * @extensions
 */
export interface TextBlockProps extends TextBlockComponentProps {
  /** The width of the document in meters. Lines that would exceed this width are instead wrapped around to the next line.
   * A value less than or equal to zero indicates no wrapping is to be applied.
   * Default: 0
   */
  width?: number;
  /** The alignment of the document content. Default: "left". */
  justification?: TextBlockJustification;
  /** The paragraphs within the text block. Default: an empty array. */
  paragraphs?: ParagraphProps[];
}

/** Represents a formatted text document consisting of a series of [[Paragraph]]s, each laid out on a separate line and containing their own content in the form of [[Run]]s.
 * You can change the content of the document by directly modifying the contents of its [[paragraphs]], or via [[appendParagraph]] and [[appendRun]].
 * No word-wrapping is applied to the document unless a [[width]] greater than zero is specified.
 * ###TODO link to layout and persistence APIs once they become available.
 * @beta
 * @preview
 * @extensions
 */
export class TextBlock extends TextBlockComponent {
  /** The width of the document in meters. Lines that would exceed this width are instead wrapped around to the next line.
   * A value less than or equal to zero indicates no wrapping is to be applied.
   * Default: 0
   */
  public width: number;
  /** The alignment of the document's content. */
  public justification: TextBlockJustification;
  /** The ordered list of paragraphs within the document. */
  public readonly paragraphs: Paragraph[];

  private constructor(props: TextBlockProps) {
    super(props);
    this.width = props.width ?? 0;
    this.justification = props.justification ?? "left";
    this.paragraphs = props.paragraphs?.map((x) => Paragraph.create(x)) ?? [];
  }

  public override toJSON(): TextBlockProps {
    return {
      ...super.toJSON(),
      width: this.width,
      justification: this.justification,
      paragraphs: this.paragraphs.map((x) => x.toJSON()),
    };
  }

  public static create(props: TextBlockProps): TextBlock {
    return new TextBlock(props);
  }

  public static createEmpty(): TextBlock {
    return TextBlock.create({ styleName: "" });
  }

  public get isEmpty(): boolean {
    return this.paragraphs.every((p) => p.runs.length === 0);
  }

  public override clone(): TextBlock {
    return new TextBlock(this.toJSON());
  }

  /** Apply the specified style to this block and - unless [[ApplyTextStyleOptions.preventPropagation]] is `true` - to all of its [[paragraphs]]. */
  public override applyStyle(styleName: string, options?: ApplyTextStyleOptions): void {
    super.applyStyle(styleName, options);
    if (!(options?.preventPropagation)) {
      for (const paragraph of this.paragraphs) {
        paragraph.applyStyle(styleName, options);
      }
    }
  }

  /** Compute a string representation of the document's contents by concatenating the string representations of each of its [[paragraphs]], separated by [[TextBlockStringifyOptions.paragraphBreak]]. */
  public stringify(options?: TextBlockStringifyOptions): string {
    return this.paragraphs.map((x) => x.stringify(options)).join(options?.paragraphBreak ?? " ");
  }

  /** Add and return a new paragraph.
   * If [[paragraphs]] is not empty, the style and overrides of the last [[Paragraph]] in the block will be applied to the new paragraph; otherwise,
   * the paragraph will inherit this block's style with no overrides.
   */
  public appendParagraph(): Paragraph {
    const seed = this.paragraphs[0];
    const paragraph = Paragraph.create({
      styleName: seed?.styleName ?? this.styleName,
      styleOverrides: seed?.styleOverrides ?? undefined,
    });

    this.paragraphs.push(paragraph);
    return paragraph;
  }

  /** Append a run to the last [[Paragraph]] in this block.
   * If the block contains no [[paragraphs]], a new one will first be created using [[appendParagraph]].
   */
  public appendRun(run: Run): void {
    const paragraph = this.paragraphs[this.paragraphs.length - 1] ?? this.appendParagraph();
    paragraph.runs.push(run);
  }

  public override equals(other: TextBlockComponent): boolean {
    if (!(other instanceof TextBlock)) {
      return false;
    }

    if (this.width !== other.width || this.justification !== other.justification || this.paragraphs.length !== other.paragraphs.length) {
      return false;
    }

    return this.paragraphs.every((paragraph, index) => paragraph.equals(other.paragraphs[index]));
  }
}

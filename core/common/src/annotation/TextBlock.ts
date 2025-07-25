/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { Id64String } from "@itwin/core-bentley";
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

  /** @internal */
  protected constructor(props?: TextBlockComponentProps) {
    this._styleOverrides = TextStyleSettings.cloneProps(props?.styleOverrides ?? {});
  }

  /** Deviations in individual properties of the [[TextStyleSettings]] in the [AnnotationTextStyle]($backend) specified by `styleId` on the [[TextBlock]].
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
    this.styleOverrides = {};
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

/** [[TextBlockComponent]]s contained within a [[Paragraph]].
 * @beta
 */
export type Run = TextRun | FractionRun | TabRun | LineBreakRun | FieldRun;

/** The JSON representation of a [[Run]].
 * Use the `type` field to discriminate between the different kinds of runs.
 * @beta
 */
export type RunProps = TextRunProps | FractionRunProps | TabRunProps | LineBreakRunProps | FieldRunProps;

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
      case "field": return FieldRun.create(props);
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

/** A chain of property accesses that resolves to a primitive value that forms the basis of the displayed content
 * of a [[FieldRun]].
   * The simplest property paths consist of a [[propertyName]] and nothing else, where `propertyName` identifies
   * a primitive property.
   * If `propertyName` identifies a struct or array property, then additional [[accessors]] are required to identify the specific value.
   * If `propertyName` (including any [[accessors]]) resolves to a JSON property, then additional [[jsonAccessors]] are required to identify a specific value within the JSON.
   * Some examples:
   * ```
   * | Access String | propertyName | accessors | jsonAccessors |
   * | ------------- | ------------ | --------- | ------------- |
   * | name          | "name"       | undefined | undefined     |
   * | spouse.name   | "spouse"     | [name]    | undefined     |
   * | colors[2]     | "colors"     | [2]       | undefined     |
   * | spouse.favoriteRestaurants[1].address | "spouse" | ["favoriteRestaurants", 1, "address"] | undefined |
   * | jsonProperties.contactInfo.email | "jsonProperties" | undefined | ["contactInfo", "email"] |
   * | spouse.jsonPropertes.contactInfo.phoneNumbers[0].areaCode | "spouse" | ["jsonProperties"] | ["contactInfo", "phoneNumbers", 0, "areaCode"] |
   * ```
 * @beta
 */
export interface FieldPropertyPath {
  /** The name of the BIS property of the [[FieldPropertyHost]] that serves as the root of the path. */
  propertyName: string;
  /** Property names and/or array indices describing the path from [[propertyName]] to the ultimate BIS property. */
  accessors?: Array<string | number>;
  /** If [[propertyName]] and [[accessors]] (if defined) resolve to a BIS property of extended type `Json`, property names and/or
   * array indices for selecting a primitive value within the JSON.
   */
  jsonAccessors?: Array<string | number>;
}

/** Describes the source of the property value against which a [[FieldPropertyPath]] is evaluated.
 * A field property is always hosted by an [Element]($backend). It may be a property of the element's BIS class itself,
 * or that of one of its [ElementAspect]($backend)s.
 * The [[schemaName]] and [[className]] should always identify the exact class that contains [[FieldPropertyPath.propertyName]] - not a subclass thereof.
 * @beta
 */
export interface FieldPropertyHost {
  /** The Id of the [Element]($backend) that hosts the property. */
  elementId: Id64String;
  /** The name of the schema containing the class identified by [[className]]. */
  schemaName: string;
  /** The name of the exact class (not a subclass) containing the property identified by [[FieldPropertyPath.propertyName]]. */
  className: string;
}

/** Placeholder type for a description of how to format the raw property value resolved by a [[FieldPropertyPath]] into a [[FieldRun]]'s display string.
 * *** COMING SOON ***
 * @beta
 */
export interface FieldFormatter { [k: string]: any }

/** JSON representation of a [[FieldRun]].
 * @beta
 */
export interface FieldRunProps extends TextBlockComponentProps {
  /** Discriminator field for the [[RunProps]] union. */
  readonly type: "field";
  /** The element and BIS class containing the property described by [[propertyPath]]. */
  propertyHost: FieldPropertyHost;
  /** Describes how to obtain the property value from [[propertyHost]]. */
  propertyPath: FieldPropertyPath;
  /** Specifies how to format the property value obtained from [[propertyPath]] into a string to be stored in [[cachedContent]]. */
  formatter?: FieldFormatter;
  /** The field's most recently evaluated display string. */
  cachedContent?: string;
}

/** A [[Run]] that displays the formatted value of a property of some [Element]($backend).
 * When a [[TextBlock]] containing a [[FieldRun]] is written into the iModel as an [ITextAnnotation]($backend) element,
 * a dependency is established between the two elements via the [ElementDrivesTextAnnotation]($backend) relationship such that
 * whenever the source element specified by [[propertyHost]] is modified, the field(s) in the `ITextAnnotation` element are automatically
 * recalculated, causing their [[cachedContent]] to update. If the field's display string cannot be evaluated (for example, because the specified element or
 * property does not exist), then its cached content is set to [[FieldRun.invalidContentIndicator]].
 * A [[FieldRun]] displays its [[cachedContent]] in the same way that [[TextRun]]s display their `content`, including word wrapping where appropriate.
 * @beta
 */
export class FieldRun extends TextBlockComponent {
  /** Display string used to signal an error in computing the field's value. */
  public static invalidContentIndicator = "####";

  /** Discriminator field for the [[Run]] union. */
  public readonly type = "field";
  /** The element and BIS class containing the property described by [[propertyPath]]. */
  public readonly propertyHost: Readonly<FieldPropertyHost>;
  /** Describes how to obtain the property value from [[propertyHost]]. */
  public readonly propertyPath: Readonly<FieldPropertyPath>;
  /** Specifies how to format the property value obtained from [[propertyPath]] into a string to be stored in [[cachedContent]]. */
  public readonly formatter?: FieldFormatter;
  private _cachedContent: string;

  /** The field's most recently evaluated display string. */
  public get cachedContent(): string {
    return this._cachedContent;
  }

  /** @internal Used by core-backend when re-evaluating field content. */
  public setCachedContent(content: string | undefined): void {
    this._cachedContent = content ?? FieldRun.invalidContentIndicator;
  }

  private constructor(props: Omit<FieldRunProps, "type">) {
    super(props);

    this._cachedContent = props.cachedContent ?? FieldRun.invalidContentIndicator;
    this.propertyHost = props.propertyHost
    this.propertyPath = props.propertyPath;
    this.formatter = props.formatter;
  }

  /** Create a FieldRun from its JSON representation. */
  public static create(props: Omit<FieldRunProps, "type">): FieldRun {
    return new FieldRun({
      ...props,
      propertyHost: { ...props.propertyHost },
      propertyPath: structuredClone(props.propertyPath),
      formatter: structuredClone(props.formatter),
    });
  }

  /** Convert the FieldRun to its JSON representation. */
  public override toJSON(): FieldRunProps {
    const json: FieldRunProps = {
      ...super.toJSON(),
      type: "field",
      propertyHost: { ...this.propertyHost },
      propertyPath: structuredClone(this.propertyPath),
    };

    if (this.cachedContent !== FieldRun.invalidContentIndicator) {
      json.cachedContent = this.cachedContent;
    }

    if (this.formatter) {
      json.formatter = structuredClone(this.formatter);
    }

    return json;
  }

  /** Create a deep copy of this FieldRun. */
  public override clone(): FieldRun {
    return new FieldRun(this.toJSON());
  }

  /** Convert this FieldRun to a simple string representation. */
  public override stringify(): string {
    return this.cachedContent;
  }

  /** Returns true if `this` is equivalent to `other`. */
  public override equals(other: TextBlockComponent): boolean {
    if (!(other instanceof FieldRun)) {
      return false;
    }

    if (
      this.propertyHost.elementId !== other.propertyHost.elementId ||
      this.propertyHost.className !== other.propertyHost.className ||
      this.propertyHost.schemaName !== other.propertyHost.schemaName
    ) {
      return false;
    }

    if (this.propertyPath.propertyName !== other.propertyPath.propertyName) {
      return false;
    }

    const thisAccessors = this.propertyPath.accessors ?? [];
    const otherAccessors = other.propertyPath.accessors ?? [];
    const thisJsonAccessors = this.propertyPath.jsonAccessors ?? [];
    const otherJsonAccessors = other.propertyPath.jsonAccessors ?? [];

    if (thisAccessors.length !== otherAccessors.length || thisJsonAccessors.length !== otherJsonAccessors.length) {
      return false;
    }

    if (!thisAccessors.every((value, index) => value === otherAccessors[index])) {
      return false;
    }

    if (!thisJsonAccessors.every((value, index) => value === otherJsonAccessors[index])) {
      return false;
    }

    if (this.formatter && other.formatter) {
      // ###TODO better comparison of formatter objects.
      if (JSON.stringify(this.formatter) !== JSON.stringify(other.formatter)) {
        return false;
      }
    } else if (this.formatter || other.formatter) {
      return false;
    }

    return true;
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

  private constructor(props?: ParagraphProps) {
    super(props);
    this.runs = props?.runs?.map((run) => Run.fromJSON(run)) ?? [];
  }

  public override toJSON(): ParagraphProps {
    return {
      ...super.toJSON(),
      runs: this.runs.map((run) => run.toJSON()),
    };
  }

  /** Create a paragraph from its JSON representation. */
  public static create(props?: ParagraphProps): Paragraph {
    return new Paragraph(props);
  }

  public override clone(): Paragraph {
    return new Paragraph(this.toJSON());
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

    this.paragraphs = props.paragraphs?.map((x) => Paragraph.create(x)) ?? [];
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
  public get isEmpty(): boolean {
    return this.paragraphs.every((p) => p.runs.length === 0);
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
  public appendParagraph(seedFromLast: boolean = false): Paragraph {
    let styleOverrides: TextStyleSettingsProps = {};

    if (seedFromLast && this.paragraphs.length > 0) {
      const seed = this.paragraphs[this.paragraphs.length - 1];
      styleOverrides = { ...seed.styleOverrides };
    }

    const paragraph = Paragraph.create({
      styleOverrides
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

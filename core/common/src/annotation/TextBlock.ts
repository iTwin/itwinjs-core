/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { ListMarker, ListMarkerEnumerator, TextStyleSettings, TextStyleSettingsProps } from "./TextStyle";
import { FieldFormatOptions, FieldPropertyHost, FieldPropertyPath } from "./TextField";

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
  /** A string to insert in between the list marker and the list item.
   * Default: " " - a single space.
   */
  listMarkerBreak?: string;
}

/**
 * Context information that may be useful when converting a [[TextBlock]] to a string.
 * @beta
 */
export interface TextBlockStringifyContext {
  /** The current depth of the text block in the document structure. */
  depth: number;
}

function clearStyleOverrides(component: StructuralTextBlockComponent, options?: ClearTextStyleOptions): void {
  component.styleOverrides = {};
  if (!options?.preserveChildrenOverrides) {
    for (const child of component.children) {
      child.clearStyleOverrides(options);
    }
  }
}

/**
 * Abstract representation of any of the building blocks that make up a [[TextBlock]] document - namely [[Run]]s and [[StructuralTextBlockComponent]]s.
 * The [[TextBlock]] can specify an [AnnotationTextStyle]($backend) that formats its contents.
 * Each component can specify an optional [[styleOverrides]] to customize that formatting.
 * @beta
 */
export abstract class TextBlockComponent {
  private _styleOverrides: TextStyleSettingsProps;

  /** @internal */
  protected constructor(props?: TextBlockComponentProps) {
    this._styleOverrides = structuredClone(props?.styleOverrides ?? {});
  }

  /** Deviations in individual properties of the [[TextStyleSettings]] in the [AnnotationTextStyle]($backend).
   * For example, if the style uses the "Arial" font, you can override that by settings `styleOverrides.font.name` to "Comic Sans".
   * @see [[clearStyleOverrides]] to reset this to an empty object.
   */
  public get styleOverrides(): TextStyleSettingsProps {
    return this._styleOverrides;
  }

  public set styleOverrides(overrides: TextStyleSettingsProps) {
    this._styleOverrides = structuredClone(overrides);
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
  public abstract stringify(options?: TextBlockStringifyOptions, context?: TextBlockStringifyContext): string;

  /** Returns true if this component has no content or children. */
  public abstract get isEmpty(): boolean;

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
      styleOverrides: structuredClone(this.styleOverrides),
    };
  }

  /** Returns true if `this` is equivalent to `other`. */
  public equals(other: TextBlockComponent): boolean {
    const mySettings = TextStyleSettings.fromJSON(this.styleOverrides);
    const otherSettings = TextStyleSettings.fromJSON(other.styleOverrides);
    return mySettings.equals(otherSettings);
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
   * @see [[TextRun.create]], [[FractionRun.create]], [[FieldRun.create]], [[TabRun.create]], and [[LineBreakRun.create]] to create a run directly.
   */
  export function fromJSON(props: RunProps): Run {
    switch (props.type) {
      case "field": return FieldRun.create(props);
      case "fraction": return FractionRun.create(props);
      case "linebreak": return LineBreakRun.create(props);
      case "tab": return TabRun.create(props);
      case "text": return TextRun.create(props);
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

  private constructor(props: TextRunProps) {
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
    return new TextRun({ ...props, type: "text" });
  }

  public override get isEmpty(): boolean {
    return this.stringify().length === 0;
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

  private constructor(props: FractionRunProps) {
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
    return new FractionRun({ ...props, type: "fraction" });
  }

  public override get isEmpty(): boolean {
    return this.stringify().length === 0;
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

  private constructor(props: LineBreakRunProps) {
    super(props);
  }

  public override toJSON(): LineBreakRunProps {
    return {
      ...super.toJSON(),
      type: "linebreak",
    };
  }

  public static create(props?: Omit<LineBreakRunProps, "type">) {
    return new LineBreakRun({ ...props, type: "linebreak" });
  }

  public override clone(): LineBreakRun {
    return new LineBreakRun(this.toJSON());
  }

  public override get isEmpty(): boolean {
    return this.stringify().length === 0;
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

  public override get isEmpty(): boolean {
    return this.stringify().length === 0;
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
  /** Specifies how to format the property value obtained from [[propertyPath]] into a string to be stored in [[cachedContent]].
   * The specific options used depend upon the field's [[propertyType]].
   */
  formatOptions?: FieldFormatOptions;
  /** The field's most recently evaluated display string.
   * @note It is unnecessary to specify this when creating a field as part of an element like a [[TextAnnotation2d]], because
   * all of the element's fields will be re-evaluated when inserting or updating the element in the iModel.
   */
  cachedContent?: string;
}

/** A [[Run]] that displays the formatted value of a property of some [Element]($backend).
 * When a [[TextBlock]] containing a [[FieldRun]] is written into the iModel as an [ITextAnnotation]($backend) element,
 * a dependency is established between the two elements via the [ElementDrivesTextAnnotation]($backend) relationship such that
 * whenever the source element specified by [[propertyHost]] is modified or the `ITextAnnotation` element is inserted or updated in the iModel,
 * the field(s) in the `ITextAnnotation` element are automatically
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
  public propertyHost: FieldPropertyHost;
  /** Describes how to obtain the property value from [[propertyHost]]. */
  public propertyPath: FieldPropertyPath;
  /** Specifies how to format the property value obtained from [[propertyPath]] into a string to be stored in [[cachedContent]].
   * The specific options used depend upon the [[FieldPropertyType]].
   */
  public formatOptions?: FieldFormatOptions;
  private _cachedContent: string;

  /** The field's most recently evaluated display string. */
  public get cachedContent(): string {
    return this._cachedContent;
  }

  /** @internal Used by core-backend when re-evaluating field content. */
  public setCachedContent(content: string | undefined): void {
    this._cachedContent = content ?? FieldRun.invalidContentIndicator;
  }

  private constructor(props: FieldRunProps) {
    super(props);

    this._cachedContent = props.cachedContent ?? FieldRun.invalidContentIndicator;
    this.propertyHost = props.propertyHost
    this.propertyPath = props.propertyPath;
    this.formatOptions = props.formatOptions;
  }

  /** Create a FieldRun from its JSON representation. */
  public static create(props: Omit<FieldRunProps, "type">): FieldRun {
    return new FieldRun({
      ...props,
      propertyHost: { ...props.propertyHost },
      propertyPath: structuredClone(props.propertyPath),
      formatOptions: structuredClone(props.formatOptions),
      type: "field",
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

    if (this.formatOptions) {
      json.formatOptions = structuredClone(this.formatOptions);
    }

    return json;
  }

  /** Create a deep copy of this FieldRun. */
  public override clone(): FieldRun {
    return new FieldRun(this.toJSON());
  }

  public override get isEmpty(): boolean {
    return this.stringify().length === 0;
  }

  /** Convert this FieldRun to a simple string representation. */
  public override stringify(): string {
    return this.cachedContent;
  }

  /** Returns true if `this` is equivalent to `other`. */
  public override equals(other: TextBlockComponent): boolean {
    if (!(other instanceof FieldRun) || !super.equals(other)) {
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

    if (thisAccessors.length !== otherAccessors.length) {
      return false;
    }

    if (!thisAccessors.every((value, index) => value === otherAccessors[index])) {
      return false;
    }

    if (this.formatOptions && other.formatOptions) {
      // We anticipate new formatting options being added in the future.
      // So to account for properties we don't know about, just compare the string representations.
      if (JSON.stringify(this.formatOptions) !== JSON.stringify(other.formatOptions)) {
        return false;
      }
    } else if (this.formatOptions || other.formatOptions) {
      return false;
    }

    return true;
  }
}

/** JSON representation of a [[Paragraph]].
 * @beta
 */
export interface ParagraphProps extends TextBlockComponentProps {
  children?: Array<ListProps | RunProps>;
}

/** A collection of [[Run]]s and [[List]]s. Paragraphs can be appended to [[List]]s and [[TextBlock]]s.
 * Each paragraph is laid out on a separate line. If included in a [[List]], the paragraph will be treated as a list item.
 * @beta
 */
export class Paragraph extends TextBlockComponent {
  public readonly type = "paragraph";
  public readonly children: Array<List | Run>;

  private constructor(props?: ParagraphProps) {
    super(props);

    this.children = props?.children?.map((child) =>
      child.type === "list" ? List.create(child) : Run.fromJSON(child)
    ) ?? [];
  }

  /** Create a paragraph from its JSON representation. */
  public static create(props?: Omit<ParagraphProps, "type">): Paragraph {
    return new Paragraph(props);
  }

  public override clearStyleOverrides(options?: ClearTextStyleOptions): void {
    clearStyleOverrides(this, options);
  }

  public override get isEmpty() {
    return this.children.length === 0;
  }

  public override clone(): Paragraph {
    return new Paragraph(this.toJSON());
  }

  public override toJSON(): ParagraphProps {
    return {
      ...super.toJSON(),
      children: this.children.map((child) => child.toJSON()),
    };
  }

  /** Compute a string representation of this paragraph by concatenating the string representations of all of its children. */
  public override stringify(options?: TextBlockStringifyOptions, context?: TextBlockStringifyContext): string {
    return this.children.map((x, index) => (index > 0 && x.type === "list") ? `${options?.paragraphBreak ?? " "}${x.stringify(options, context)}` : x.stringify(options, context)).join("") ?? "";
  }

  public override equals(other: TextBlockComponent): boolean {
    return (other instanceof Paragraph) && super.equals(other);
  }
}

/** JSON representation of a [[List]].
 * @beta
 */
export interface ListProps extends TextBlockComponentProps {
  readonly type: "list";
  children?: ParagraphProps[];
}

/** A collection of list items ([[Paragraph]]s). Lists can be appended to [[Paragraph]]s.
 * Lists will be laid out on a new line. Each item in a list is laid out on a separate line.
 * @beta
 */
export class List extends TextBlockComponent {
  public readonly type = "list";
  public readonly children: Paragraph[];

  protected constructor(props?: ListProps) {
    super(props);

    this.children = props?.children?.map((child) => Paragraph.create(child)) ?? [];
  }

  /** Create a list from its JSON representation. */
  public static create(props?: Omit<ListProps, "type">): List {
    return new List({ ...props, type: "list" });
  }

  public override clearStyleOverrides(options?: ClearTextStyleOptions): void {
    clearStyleOverrides(this, options);
  }

  public override get isEmpty() {
    return this.children.length === 0;
  }

  public override clone(): List {
    return new List(this.toJSON());
  }

  public override toJSON(): ListProps {
    return {
      ...super.toJSON(),
      type: "list",
      children: this.children.map((run) => run.toJSON()),
    };
  }

  /** Compute a string representation of this list by concatenating the string representations of all of its [[children]]. */
  public override stringify(options?: TextBlockStringifyOptions, context?: TextBlockStringifyContext): string {
    const children = this.children.map((x, index) => {
      const depth = context?.depth ?? 0;
      const marker = getMarkerText(this.styleOverrides.listMarker ?? TextStyleSettings.defaultProps.listMarker, index + 1);
      const tab = (options?.tabsAsSpaces ? " ".repeat(options.tabsAsSpaces) : "\t").repeat(depth);
      return `${tab}${marker}${options?.listMarkerBreak ?? " "}${x.stringify(options, { depth: depth + 1 })}`;
    });
    return children.join(options?.paragraphBreak ?? " ") ?? "";
  }

  public override equals(other: TextBlockComponent): boolean {
    return (other instanceof List) && super.equals(other);
  }
}

/** JSON representation of a [[TextBlock]].
 * @beta
 */
export interface TextBlockProps extends TextBlockComponentProps {
  /** The width of the document in meters. Lines that would exceed this width are instead wrapped around to the next line if possible.
   * A value less than or equal to zero indicates no wrapping is to be applied.
   * Default: 0
   */
  width?: number;
  children?: ParagraphProps[];
}

/** Represents a formatted text document consisting of a series of [[Paragraph]]s, each laid out on a separate line and containing their own content.
 * No word-wrapping is applied to the document unless a [[width]] greater than zero is specified.
 * @see [[TextAnnotation]] to position a text block as an annotation in 2d or 3d space.
 * @beta
 */
export class TextBlock extends TextBlockComponent {
  public readonly children: Paragraph[];

  /** The width of the document in meters. Lines that would exceed this width are instead wrapped around to the next line if possible.
   * A value less than or equal to zero indicates no wrapping is to be applied.
   * Default: 0
   */
  public width: number;

  private constructor(props: TextBlockProps) {
    super(props);
    this.width = props.width ?? 0;

    this.children = props?.children?.map((para) => Paragraph.create(para)) ?? [];
  }

  public override clearStyleOverrides(options?: ClearTextStyleOptions): void {
    clearStyleOverrides(this, options);
  }

  public override toJSON(): TextBlockProps {
    return {
      ...super.toJSON(),
      width: this.width,
      children: this.children.map((x) => x.toJSON()),
    };
  }

  /** Create a text block from its JSON representation. */
  public static create(props?: Omit<TextBlockProps, "type">): TextBlock {
    return new TextBlock(props ?? {});
  }

  /** Returns true if every paragraph in this text block is empty. */
  public override get isEmpty(): boolean {
    return !this.children || this.children.every((child) => child.isEmpty);
  }

  public override clone(): TextBlock {
    return new TextBlock(this.toJSON());
  }

  /** Compute a string representation of the document's contents by concatenating the string representations of each of its [[children]], separated by [[TextBlockStringifyOptions.paragraphBreak]]. */
  public stringify(options?: TextBlockStringifyOptions): string {
    return this.children.map((x) => x.stringify(options)).join(options?.paragraphBreak ?? " ") || "";
  }

  /** Add and return a new paragraph.
   * By default, the paragraph will be created with no [[styleOverrides]], so that it inherits the style of this block.
   * @param seedFromLast If true and [[children]] is not empty, the new paragraph will inherit the style overrides of the last child in this block.
   * @note Be sure you pass in [[ParagraphProps]] and not [[Paragraph]] or style overrides will be ignored.
   */
  public appendParagraph(props?: ParagraphProps, seedFromLast = false): Paragraph {
    const seed = seedFromLast ? this.children[this.children.length - 1] : undefined;
    const styleOverrides = { ...seed?.styleOverrides, ...props?.styleOverrides };
    const paragraph = Paragraph.create({ ...props, styleOverrides });
    this.children.push(paragraph);
    return paragraph;
  }

  /** Append a run to the last [[Paragraph]] in this block.
   * If the block contains no [[children]], a new [[Paragraph]] will first be created using [[appendParagraph]].
   */
  public appendRun(run: Run): void {
    const paragraph = this.children[this.children.length - 1] ?? this.appendParagraph();
    paragraph.children.push(run);
  }

  public override equals(other: TextBlockComponent): boolean {
    if (!(other instanceof TextBlock)) {
      return false;
    }

    if (!super.equals(other)) {
      return false;
    }

    if (this.width !== other.width) {
      return false;
    }

    if (this.children && other.children) {
      if (this.children.length !== other.children.length) {
        return false;
      }

      return this.children.every((child, index) => other.children && child.equals(other.children[index]));
    }

    return true;
  }
}

/**
 * A union of all the [[TextBlockComponent]]s that can contain other components.
 * @beta
 */
export type StructuralTextBlockComponent = List | Paragraph | TextBlock;

/**
 * Recursively traverses a [[StructuralTextBlockComponent]] tree, yielding each child component along with its parent container.
 * This generator enables depth-first iteration over all components in a text block structure, including paragraphs, lists, and runs.
 *
 * @param parent The root container whose children should be traversed.
 * @returns An IterableIterator yielding objects with the child component and its parent container.
 * @beta
 */
export function* traverseTextBlockComponent(parent: StructuralTextBlockComponent): IterableIterator<{ parent: StructuralTextBlockComponent, child: List | Paragraph | Run }> {
  for (const child of parent.children) {
    yield { parent, child };
    if (child.type === "list" || child.type === "paragraph") {
      yield* traverseTextBlockComponent(child);
    }
  }
}

/**
 * Returns the formatted marker text for a list item based on the marker type and item number.
 * Supports ordered and unordered list markers, including alphabetic, Roman numeral, and numeric formats.
 * @param marker The type of list marker to use.
 * @param num The item number in the list.
 * @returns The formatted marker string for the list item.
 * @beta
 */
export function getMarkerText(marker: ListMarker, num: number): string {
  let markerString = "";

  switch (marker.enumerator) {
    case undefined:
    case ListMarkerEnumerator.Number:
      markerString = `${num}`;
      break;
    case ListMarkerEnumerator.Letter:
      markerString = integerToAlpha(num);
      break;
    case ListMarkerEnumerator.RomanNumeral:
      markerString = integerToRoman(num);
      break;
    default:
      markerString = marker.enumerator;
      break;
  }

  if (marker.case) {
    markerString = marker.case === "upper" ? markerString.toUpperCase() : markerString.toLowerCase();
  }

  const terminator = marker.terminator === "period" ? "." : marker.terminator === "parenthesis" ? ")" : "";

  return `${markerString}${terminator}`;
}

/**
 * Converts an integer to its Roman numeral representation.
 * Supports numbers from 1 and above.
 * @param num The integer to convert.
 * @returns The Roman numeral string.
 */
function integerToRoman(num: number): string {
  const values =
    [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const symbols =
    ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let roman = '';
  for (let i = 0; i < values.length; i++) {
    while (num >= values[i]) {
      roman += symbols[i];
      num -= values[i];
    }
  }

  return roman;
}

/**
 * Converts an integer to its alphabetic representation (A-Z, AA-ZZ, etc.).
 * Used for ordered list markers with alphabetic styles.
 * @param num The integer to convert (1-based).
 * @returns The alphabetic string for the given number.
 */
function integerToAlpha(num: number): string {
  const letterOffset = (num - 1) % 26;
  const letter = String.fromCharCode(65 + letterOffset);
  const depth = Math.ceil(num / 26);
  return letter.repeat(depth);
}

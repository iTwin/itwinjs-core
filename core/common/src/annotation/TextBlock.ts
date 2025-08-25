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

/** The different types of [[TextBlockComponent]].
 * @beta
 */
export enum RunComponentType {
  Text = "text",
  Field = "field",
  Fraction = "fraction",
  LineBreak = "linebreak",
  Tab = "tab",
}

export enum ContainerComponentType {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Paragraph = "paragraph",
  // eslint-disable-next-line @typescript-eslint/no-shadow
  List = "list",
  // eslint-disable-next-line @typescript-eslint/no-shadow
  TextBlock = "textBlock",
}
/** The JSON representation of a [[TextBlockComponent]].
 * @beta
 */
export interface TextBlockComponentProps {
  /** Deviations from the base [[TextStyleSettings]] defined by the [AnnotationTextStyle]($backend) applied to this component.
   * This permits you to, e.g., create a [[TextBlock]] using "Arial" font and override one of its [[TextRun]]s to use "Comic Sans" instead.
   */
  styleOverrides?: TextStyleSettingsProps;
  type?: RunComponentType | ContainerComponentType; // Discriminator field for the type of [[TextBlockComponent]].
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
  private _index: number = 0;

  public readonly abstract type: RunComponentType | ContainerComponentType;

  /** @internal */
  protected constructor(props?: TextBlockComponentProps) {
    this._styleOverrides = TextStyleSettings.cloneProps(props?.styleOverrides ?? {});
  }

  public get index(): number {
    return this._index;
  }

  public set index(value: number) {
    this._index = value;
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

  /**
   * Clears any [[styleOverrides]] applied to this Paragraph.
   * Will also clear [[styleOverrides]] from all child components unless [[ClearTextStyleOptions.preserveChildrenOverrides]] is `true`.
   */
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
  * Returns true if this component has no children.
  */
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
      styleOverrides: TextStyleSettings.cloneProps(this.styleOverrides),
      type: ContainerComponentType.TextBlock,
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

/** The JSON representation of a [[TextBlockComponent]].
 * @beta
 */
export interface ContainerComponentProps extends TextBlockComponentProps {
  /** TODO */
  children?: TextBlockComponentProps[];
  type?: ContainerComponentType; // Discriminator field for the type of [[TextBlockComponent]].
}


/** Abstract representation of any of the building blocks that make up a [[TextBlock]] document - namely [[Run]]s, [[Paragraph]]s, and [[TextBlock]] itself.
 * The [[TextBlock]] can specify an [AnnotationTextStyle]($backend) that formats its contents. Each component can specify an optional [[styleOverrides]] to customize that formatting.
 * @beta
 */
export abstract class ContainerComponent<T extends TextBlockComponent = TextBlockComponent> extends TextBlockComponent {
  private readonly _children: T[] = [];
  public abstract override readonly type: ContainerComponentType;

  public get children(): T[] {
    return this._children;
  }

  public get last(): T | undefined {
    return this._children[this._children.length - 1];
  }

  /**
   * Clears any [[styleOverrides]] applied to this Paragraph.
   * Will also clear [[styleOverrides]] from all child components unless [[ClearTextStyleOptions.preserveChildrenOverrides]] is `true`.
   */
  public override clearStyleOverrides(options?: ClearTextStyleOptions): void {
    super.clearStyleOverrides(options);

    if (options?.preserveChildrenOverrides || !this.children)
      return;

    for (const child of this.children) {
      child.clearStyleOverrides();
    }
  }

  /**
  * Returns true if this component has no children.
  */
  public get isEmpty(): boolean {
    return this._children.length === 0;
  };


  /** Convert this component to its JSON representation. */
  public override toJSON(): ContainerComponentProps {
    return {
      ...super.toJSON(),
      children: this.children.map((child) => child.toJSON()) ?? [],
      type: ContainerComponentType.TextBlock,
    };
  }

  /** Returns true if `this` is equivalent to `other`. */
  public override equals(other: TextBlockComponent): boolean {
    if (!(other instanceof ContainerComponent)) return false;

    return super.equals(other)
      && this.children.length === other.children.length
      && this.children.every((child, index) => child.equals(other.children[index])) === true;
  }

  public appendChild(child: T): void {
    this.children.push(child);
    child.index = this.children.length - 1; // Update the index of the new child
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
      case RunComponentType.Field: return FieldRun.create(props);
      case RunComponentType.Fraction: return FractionRun.create(props);
      case RunComponentType.LineBreak: return LineBreakRun.create(props);
      case RunComponentType.Tab: return TabRun.create(props);
      case RunComponentType.Text: return TextRun.create(props);
    }
  }

  function isKindOf(type: RunComponentType | ContainerComponentType): type is RunComponentType {
    return (
      type === RunComponentType.Field ||
      type === RunComponentType.Fraction ||
      type === RunComponentType.LineBreak ||
      type === RunComponentType.Tab ||
      type === RunComponentType.Text
    );
  }

  export function isRun(component: TextBlockComponent): component is Run {
    return isKindOf(component.type);
  }

  export function isRunProps(component: TextBlockComponentProps): component is RunProps {
    if (!component.type) return false;
    return isKindOf(component.type);
  }
}


/** [[TextBlockComponent]]s contained within a [[Paragraph]].
 * @beta
 */
export type Container = Paragraph | List;

/** The JSON representation of a [[Run]].
 * Use the `type` field to discriminate between the different kinds of runs.
 * @beta
 */
export type ContainerProps = ParagraphProps | ListProps;


/** A container for [[Run]] elements.
 * @beta
 */
export namespace Container { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Create a run from its JSON representation.
   * @see [[TextRun.create]], [[FractionRun.create]], and [[LineBreakRun.create]] to create a run directly.
   */
  export function fromJSON(props: ContainerProps): Container {
    switch (props.type) {
      case ContainerComponentType.List: return List.create(props);
      case ContainerComponentType.Paragraph: return Paragraph.create(props);
    }
  }

  function isKindOf(type: RunComponentType | ContainerComponentType): type is ContainerComponentType {
    return (
      type === ContainerComponentType.List ||
      type === ContainerComponentType.Paragraph
    );
  }

  export function isContainer(component: TextBlockComponent): component is Container {
    return isKindOf(component.type);
  }

  export function isContainerProps(component: TextBlockComponentProps): component is ContainerProps {
    if (!component.type) return false;
    return isKindOf(component.type);
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
  readonly type: RunComponentType.Text;
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
  public readonly type = RunComponentType.Text;
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
      type: RunComponentType.Text,
      content: this.content,
      baselineShift: this.baselineShift,
    };
  }

  public static create(props?: Omit<TextRunProps, "type">): TextRun {
    return new TextRun(props);
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
  readonly type: RunComponentType.Fraction;
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
  public readonly type = RunComponentType.Fraction;
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
      type: RunComponentType.Fraction,
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
  readonly type: RunComponentType.LineBreak;
}

/** A [[Run]] that represents the end of a line of text within a [[Paragraph]]. It contains no content of its own - it simply causes subsequent content to display on a new line.
 * @beta
 */
export class LineBreakRun extends TextBlockComponent {
  /** Discriminator field for the [[Run]] union. */
  public readonly type = RunComponentType.LineBreak;

  private constructor(props?: Omit<TextBlockComponentProps, "type">) {
    super(props);
  }

  public override toJSON(): LineBreakRunProps {
    return {
      ...super.toJSON(),
      type: RunComponentType.LineBreak,
    };
  }

  public static create(props?: Omit<TextBlockComponentProps, "type">) {
    return new LineBreakRun(props);
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
  readonly type: RunComponentType.Tab;
}

/** A [[TabRun]] is used to shift the next tab stop.
 * @note Only left-justified tabs are supported at this tab.
 * @beta
 */
export class TabRun extends TextBlockComponent {
  /** Discriminator field for the [[Run]] union. */
  public readonly type = RunComponentType.Tab;

  public override toJSON(): TabRunProps {
    return {
      ...super.toJSON(),
      type: RunComponentType.Tab,
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
   * | spouse.jsonProperties.contactInfo.phoneNumbers[0].areaCode | "spouse" | ["jsonProperties"] | ["contactInfo", "phoneNumbers", 0, "areaCode"] |
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
  readonly type: RunComponentType.Field;
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
  public readonly type = RunComponentType.Field;
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
      type: RunComponentType.Field,
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
export interface ParagraphProps extends ContainerComponentProps {
  type: ContainerComponentType.Paragraph; // Discriminator field for the type of [[TextBlockComponent]].
  children?: (ContainerProps | RunProps)[]; // The runs within the paragraph
}

/** A collection of [[Run]]s within a [[TextBlock]]. Each paragraph within a text block is laid out on a separate line.
 * @beta
 */
export class Paragraph extends ContainerComponent<Container | Run> {
  public readonly type = ContainerComponentType.Paragraph;

  protected constructor(props?: Omit<ParagraphProps, "type">) {
    super(props);

    props?.children?.forEach((run) => {
      const child = Container.isContainerProps(run)
        ? Container.fromJSON(run)
        : Run.isRunProps(run)
          ? Run.fromJSON(run)
          : undefined;

      if (child) {
        this.appendChild(child);
      }
    });
  }

  /** Create a paragraph from its JSON representation. */
  public static create(props?: Omit<ParagraphProps, "type">): Paragraph {
    return new Paragraph(props);
  }

  public override clone(): Paragraph {
    return new Paragraph(this.toJSON());
  }

  public override toJSON(): ParagraphProps {
    return {
      ...super.toJSON(),
      type: ContainerComponentType.Paragraph,
      children: this.children.map((run) => run.toJSON()),
    };
  }

  /** Compute a string representation of this paragraph by concatenating the string representations of all of its [[runs]]. */
  public override stringify(options?: TextBlockStringifyOptions): string {
    return this.children.map((x) => x.stringify(options)).join("") ?? "";
  }

  public override equals(other: TextBlockComponent): boolean {
    return (other instanceof Paragraph) && super.equals(other);
  }
}

/** JSON representation of a [[List]].
 * @beta
 */
export interface ListProps extends ContainerComponentProps {
  type: ContainerComponentType.List; // Discriminator field for the type of [[TextBlockComponent]].
  children?: ParagraphProps[]; // The runs within the list
}

/** A collection of [[Run]]s within a [[TextBlock]]. Each list item within a text block is laid out on a separate line.
 * @beta
 */
export class List extends ContainerComponent<Paragraph> {
  public readonly type = ContainerComponentType.List;

  protected constructor(props?: Omit<ListProps, "type">) {
    super(props);

    props?.children?.forEach((run) => {
      this.appendChild(Paragraph.create(run));
    });
  }

  /** Create a list from its JSON representation. */
  public static create(props?: Omit<ListProps, "type">): List {
    return new List(props);
  }

  public override clone(): List {
    return new List(this.toJSON());
  }

  public override toJSON(): ListProps {
    return {
      ...super.toJSON(),
      type: ContainerComponentType.List,
      children: this.children.map((run) => run.toJSON()),
    };
  }

  /** Compute a string representation of this paragraph by concatenating the string representations of all of its [[runs]]. */
  public override stringify(options?: TextBlockStringifyOptions): string {
    return this.children.map((x) => x.stringify(options)).join("") ?? "";
  }

  public override equals(other: TextBlockComponent): boolean {
    return (other instanceof List) && super.equals(other);
  }

  public appendToListItem(run: Run, itemIndex?: number): void {
    if (!this.children || this.children.length === 0) this.appendChild(Paragraph.create());
    const listItem = this.children[itemIndex ?? this.children.length - 1];
    listItem.appendChild(run);
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
export interface TextBlockProps extends ContainerComponentProps {
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
}

/** Represents a formatted text document consisting of a series of [[Paragraph]]s, each laid out on a separate line and containing their own content in the form of [[Run]]s.
 * You can change the content of the document by directly modifying the contents of its [[paragraphs]], or via [[appendParagraph]] and [[appendRun]].
 * No word-wrapping is applied to the document unless a [[width]] greater than zero is specified.
 * @see [[TextAnnotation]] to position a text block as an annotation in 2d or 3d space.
 * @beta
 */
export class TextBlock extends ContainerComponent<ContainerComponent> {
  public readonly type = ContainerComponentType.TextBlock;

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

    props.children?.forEach((x) => { if (Container.isContainerProps(x)) this.appendContainer(x) });
  }

  public override toJSON(): TextBlockProps {
    return {
      ...super.toJSON(),
      type: ContainerComponentType.TextBlock,
      styleId: this.styleId,
      width: this.width,
      justification: this.justification,
      margins: this.margins,
      children: this.children.map((x) => x.toJSON()),
    };
  }

  /** Create a text block from its JSON representation. */
  public static create(props: Omit<TextBlockProps, "type">): TextBlock {
    return new TextBlock(props);
  }

  /** Create an empty text block containing no [[paragraphs]] and an empty [[styleId]]. */
  public static createEmpty(): TextBlock {
    return TextBlock.create({ styleId: "" });
  }

  /** Returns true if every paragraph in this text block is empty. */
  public override get isEmpty(): boolean {
    return !this.children || this.children.every((child) => child.isEmpty);
  }

  public override clone(): TextBlock {
    return new TextBlock(this.toJSON());
  }

  /** Compute a string representation of the document's contents by concatenating the string representations of each of its [[paragraphs]], separated by [[TextBlockStringifyOptions.paragraphBreak]]. */
  public stringify(options?: TextBlockStringifyOptions): string {
    return this.children.map((x) => x.stringify(options)).join(options?.paragraphBreak ?? " ") || "";
  }

  /** Add and return a new paragraph.
   * By default, the paragraph will be created with no [[styleOverrides]], so that it inherits the style of this block.
   * @param seedFromLast If true and [[paragraphs]] is not empty, the new paragraph will inherit the style overrides of the last [[Paragraph]] in this block.
   */
  public appendContainer(props?: ContainerProps, seedFromLast: boolean = false): Paragraph | List {
    let styleOverrides: TextStyleSettingsProps = {};

    if (seedFromLast && this.children.length > 0) {
      const seed = this.children[this.children.length - 1];
      styleOverrides = { ...seed.styleOverrides };
    }

    const containerProps = props ?? {
      type: "paragraph",
      styleOverrides
    };
    const container = containerProps.type === ContainerComponentType.List
      ? List.create(containerProps)
      : Paragraph.create(containerProps);
    this.appendChild(container);
    return container;
  }

  /** Add and return a new paragraph.
   * By default, the paragraph will be created with no [[styleOverrides]], so that it inherits the style of this block.
   * @param seedFromLast If true and [[paragraphs]] is not empty, the new paragraph will inherit the style overrides of the last [[Paragraph]] in this block.
   */
  public appendParagraph(props?: ParagraphProps, seedFromLast: boolean = false): Paragraph {
    const container = this.appendContainer(props, seedFromLast);
    return container as Paragraph;
  }


  /** Add and return a new paragraph.
   * By default, the paragraph will be created with no [[styleOverrides]], so that it inherits the style of this block.
   * @param seedFromLast If true and [[paragraphs]] is not empty, the new paragraph will inherit the style overrides of the last [[Paragraph]] in this block.
   */
  public appendList(props?: ListProps, seedFromLast: boolean = false): List {
    const container = this.appendContainer(props, seedFromLast);
    return container as List;
  }

  /** Add and return a new paragraph.
   * By default, the paragraph will be created with no [[styleOverrides]], so that it inherits the style of this block.
   * @param seedFromLast If true and [[paragraphs]] is not empty, the new paragraph will inherit the style overrides of the last [[Paragraph]] in this block.
   */
  public appendListItem(props?: Omit<ParagraphProps, "type">, seedFromLast: boolean = false): Paragraph | undefined {
    const last = this.last;

    const overrides = seedFromLast && last ? { ...last?.styleOverrides } : {};
    if (last instanceof List) {
      const listItem = Paragraph.create({ ...overrides, ...props });
      last.appendChild(listItem);
      return listItem;
    }

    return;
  }

  /** Append a run to the last [[Paragraph]] in this block.
   * If the block contains no [[paragraphs]], a new one will first be created using [[appendParagraph]].
   */
  public appendRun(run: Run): void {
    if (this.last instanceof Paragraph) {
      const paragraph = this.last;
      paragraph.appendChild(run);
    } else if (this.last instanceof List) {
      const listItem = this.last.last ?? this.appendListItem();
      listItem?.appendChild(run);
    } else {
      const paragraph = this.appendParagraph();
      paragraph.appendChild(run);
    }
  }

  public override equals(other: TextBlockComponent): boolean {
    if (!(other instanceof TextBlock)) {
      return false;
    }

    if (this.styleId !== other.styleId || !super.equals(other)) {
      return false;
    }

    if (this.width !== other.width || this.justification !== other.justification) {
      return false;
    }

    const marginsAreEqual = Object.entries(this.margins).every(([key, value]) =>
      value === (other.margins as any)[key]
    );

    if (!marginsAreEqual) return false;

    if (this.children && other.children) {
      if (this.children.length !== other.children.length) {
        return false;
      }

      return this.children.every((child, index) => other.children && child.equals(other.children[index]));
    }

    return true;
  }
}
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { TextStyle, TextStyleSettings, TextStyleSettingsProps } from "./TextStyle";

/** Options supplied to [[TextBlockComponent.applyStyle]] to control how the style is applied to the component and its child components.
 * @beta
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
  dontPropagate?: boolean;
}

/** The JSON representation of a [[TextBlockComponent]].
 * @beta
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

export abstract class TextBlockComponent {
  private _styleName: string;
  private _styleOverrides: TextStyleSettingsProps;

  /** @internal */
  protected constructor(props: TextBlockComponentProps) {
    this._styleName = props.styleName;
    this._styleOverrides = { ...props.styleOverrides };
  }

  public get styleName(): string {
    return this._styleName;
  }

  public set styleName(styleName: string) {
    this.applyStyle(styleName);
  }

  public get styleOverrides(): TextStyleSettingsProps {
    return this._styleOverrides;
  }

  public set styleOverrides(overrides: TextStyleSettingsProps) {
    this._styleOverrides = { ...overrides };
  }

  public clearStyleOverrides(): void {
    this.styleOverrides = { };
  }

  public applyStyle(styleName: string, options?: ApplyTextStyleOptions): void {
    this._styleName = styleName;

    if (!(options?.preserveOverrides)) {
      this.clearStyleOverrides();
    }
  }

  public get overridesStyle(): boolean {
    return Object.keys(this.styleOverrides).length > 0;
  }

  public createEffectiveSettings(baseSettings: TextStyleSettings): TextStyleSettings {
    return this.overridesStyle ? baseSettings.clone(this.styleOverrides) : baseSettings;
  }

  public abstract clone(): TextBlockComponent;

  public abstract stringify(options?: TextBlockStringifyOptions): string;
  
  public toJSON(): TextBlockComponentProps {
    return {
      styleName: this.styleName,
      styleOverrides: { ...this.styleOverrides },
    }
  }
}
  
export type Run = TextRun | FractionRun | LineBreakRun;
export type RunProps = TextRunProps | FractionRunProps | LineBreakRunProps;

export namespace Run {
  export function fromJSON(props: RunProps): Run {
    switch (props.type) {
      case "text": return TextRun.create(props);
      case "fraction": return FractionRun.create(props);
      case "linebreak": return LineBreakRun.create(props);
    }
  }
}

export type BaselineShift = "subscript" | "superscript" | "none";

export interface TextRunProps extends TextBlockComponentProps {
  readonly type: "text";
  content?: string;
  shiftMode?: BaselineShift;
}

export class TextRun extends TextBlockComponent {
  public readonly type = "text";
  public content: string;
  public shiftMode: BaselineShift;

  private constructor(props: Omit<TextRunProps, "type">) {
    super(props);
    this.content = props.content ?? "";
    this.shiftMode = props.shiftMode ?? "none";
  }

  public override clone(): TextRun {
    return new TextRun(this.toJSON());
  }

  public override toJSON(): TextRunProps {
    return {
      ...super.toJSON(),
      type: "text",
      content: this.content,
      shiftMode: this.shiftMode,
    }
  }

  public static create(props: Omit<TextRunProps, "type">): TextRun {
    return new TextRun(props);
  }

  public override stringify(): string {
    return this.content;
  }
}

export interface FractionRunProps extends TextBlockComponentProps {
  readonly type: "fraction";
  numerator?: string;
  denominator?: string;
}

export class FractionRun extends TextBlockComponent {
  public readonly type = "fraction";
  public numerator: string;
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
    }
  }

  public override clone(): FractionRun {
    return new FractionRun(this.toJSON());
  }

  public static create(props: Omit<FractionRunProps, "type">): FractionRun {
    return new FractionRun(props);
  }

  public override stringify(options?: TextBlockStringifyOptions): string {
    const sep = options?.fractionSeparator ?? "/";
    return `${this.numerator}${sep}${this.denominator}`;
  }
}

export interface LineBreakRunProps extends TextBlockComponentProps {
  readonly type: "linebreak";
}

export class LineBreakRun extends TextBlockComponent {
  public readonly type = "linebreak";

  private constructor(props: TextBlockComponentProps) {
    super(props);
  }

  public override toJSON(): LineBreakRunProps {
    return {
      ...super.toJSON(),
      type: "linebreak",
    }
  }

  public static create(props: TextBlockComponentProps) {
    return new LineBreakRun(props);
  }

  public override clone(): LineBreakRun {
    return new LineBreakRun(this.toJSON());
  }

  public override stringify(options?: TextBlockStringifyOptions): string {
    return options?.lineBreak ?? " ";
  }
}

export interface ParagraphProps extends TextBlockComponentProps {
  readonly type: "paragraph";
  runs?: RunProps[];
}

export class Paragraph extends TextBlockComponent {
  public readonly runs: Run[];

  private constructor(props: Omit<ParagraphProps, "type">) {
    super(props);
    this.runs = props.runs?.map((run) => Run.fromJSON(run)) ?? [];
  }

  public override toJSON(): ParagraphProps {
    return {
      ...super.toJSON(),
      type: "paragraph",
      runs: this.runs.map((run) => run.toJSON()),
    };
  }

  public static create(props: Omit<ParagraphProps, "type">): Paragraph {
    return new Paragraph(props);
  }

  public override clone(): Paragraph {
    return new Paragraph(this.toJSON());
  }

  public override applyStyle(styleName: string, options?: ApplyTextStyleOptions): void {
    super.applyStyle(styleName, options);
    if (!(options?.dontPropagate)) {
      for (const run of this.runs) {
        run.applyStyle(styleName, options);
      }
    }
  }

  public override stringify(options?: TextBlockStringifyOptions): string {
    return this.runs.map((x) => x.stringify(options)).join("");
  }
}

export type TextBlockJustification = "left" | "center" | "right";

export interface TextBlockProps extends TextBlockComponentProps {
  readonly type: "block";
  /** Default: 0 */
  width?: number;
  /** Default: "left" */
  justification?: TextBlockJustification;
  paragraphs?: ParagraphProps[];
}

export class TextBlock extends TextBlockComponent {
  public width: number;
  public justification: TextBlockJustification;
  public readonly paragraphs: Paragraph[];

  private constructor(props: Omit<TextBlockProps, "type">) {
    super(props);
    this.width = props.width ?? 0;
    this.justification = props.justification ?? "left";
    this.paragraphs = props.paragraphs?.map((x) => Paragraph.create(x)) ?? [];
  }

  public override toJSON(): TextBlockProps {
    return {
      ...super.toJSON(),
      type: "block",
      width: this.width,
      justification: this.justification,
      paragraphs: this.paragraphs.map((x) => x.toJSON()),
    };
  }

  public static create(props: Omit<TextBlockProps, "type">): TextBlock {
    return new TextBlock(props);
  }

  public override clone(): TextBlock {
    return new TextBlock(this.toJSON());
  }

  public override applyStyle(styleName: string, options?: ApplyTextStyleOptions): void {
    super.applyStyle(styleName, options);
    if (!(options?.dontPropagate)) {
      for (const paragraph of this.paragraphs) {
        paragraph.applyStyle(styleName, options);
      }
    }
  }
  
  public stringify(options?: TextBlockStringifyOptions): string {
    return this.paragraphs.map((x) => x.stringify(options)).join(options?.paragraphBreak ?? " ");
  }

  public appendParagraph(): Paragraph {
    const seed = this.paragraphs[0];
    const paragraph = Paragraph.create({
      styleName: seed?.styleName ?? this.styleName,
      styleOverrides: seed?.styleOverrides ?? undefined,
    });

    this.paragraphs.push(paragraph);
    return paragraph;
  }

  public appendRun(run: Run): void {
    const paragraph = this.paragraphs[this.paragraphs.length - 1] ?? this.appendParagraph();
    paragraph.runs.push(run);
  }
}

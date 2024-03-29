/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Annotation
 */

import { TextStyle, TextStyleSettingsProps } from "./TextStyle";

export interface ApplyTextStyleOptions {
  preserveOverrides?: boolean;
  dontPropagate?: boolean;
}

export interface TextBlockComponentProps {
  styleName: string;
  styleOverrides?: TextStyleSettingsProps;
}

export interface TextBlockStringifyOptions {
  /** Default: " " */
  paragraphBreak?: string;
  /** Default: " " */
  lineBreak?: string;
  /** Default: "/" */
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

  public createEffectiveStyle(baseStyle: TextStyle): TextStyle {
    return this.overridesStyle ? baseStyle.clone(this.styleOverrides) : baseStyle;
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

export type TextRunShiftMode = "subscript" | "superscript" | "baseline";

export interface TextRunProps extends TextBlockComponentProps {
  readonly type: "text";
  content?: string;
  shiftMode?: TextRunShiftMode;
}

export class TextRun extends TextBlockComponent {
  public readonly type = "text";
  public content: string;
  public shiftMode: TextRunShiftMode;

  private constructor(props: Omit<TextRunProps, "type">) {
    super(props);
    this.content = props.content ?? "";
    this.shiftMode = props.shiftMode ?? "baseline";
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

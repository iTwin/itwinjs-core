import { DefinitionElement } from "./Element";

export interface AnnotationTextStyle extends DefinitionElement {
  textStyleId: number;
  name: string;
  colorType: number;
  colorValue: number;
  fontId: number;
  height: number;
  lineSpacingFactor: number;
  isBold: boolean;
  isItalic: boolean;
  isUnderlined: boolean;
  widthFactor: number;
  description: string;
}

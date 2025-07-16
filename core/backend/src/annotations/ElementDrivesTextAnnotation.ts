/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Elements
 */

import { RelationshipProps, TextBlock } from "@itwin/core-common";
import { ElementDrivesElement } from "../Relationship";
import { IModelDb } from "../IModelDb";
import { updateElementFields } from "../internal/annotations/fields";

export interface TextBlockAndId {
  readonly textBlock: TextBlock;
  readonly id: unknown;
}

/** Interface implemented by [[GeometricElement]] subclasses whose schemas declare them to implement the mix-in `BisCore:ITextAnnotation`.
 * @beta
 */
export interface ITextAnnotation {
  getTextBlocks(): Iterable<TextBlockAndId>;
  updateTextBlocks(textBlocks: TextBlockAndId[]): void;
}

export class ElementDrivesTextAnnotation extends ElementDrivesElement {
  public static override get className(): string { return "ElementDrivesTextAnnotation"; }
  
  public static override onRootChanged(props: RelationshipProps, iModel: IModelDb): void {
    updateElementFields(props, iModel, false);
  }

  public static override onDeletedDependency(props: RelationshipProps, iModel: IModelDb): void {
    updateElementFields(props, iModel, true);
  }
}

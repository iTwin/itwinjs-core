/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { MarkupElement, Markup } from "./Markup";
import { PrimitiveTool } from "@bentley/imodeljs-frontend";

export abstract class MarkupTool extends PrimitiveTool {
  constructor(public markup: Markup) { super(); }
  public onPostInstall(): void { this.markup.tool = this; }
  public exitTool(): void { }
  public requireWriteableTarget(): boolean { return false; }
  public onMouseEnter(_ev: MouseEvent, _el: MarkupElement) { }
  public onMouseLeave(_ev: MouseEvent, _el: MarkupElement) { }
  public async undoPreviousStep(): Promise<boolean> { this.markup.undo.doUndo(); return true; }
  public async redoPreviousStep(): Promise<boolean> { this.markup.undo.doRedo(); return true; }
}

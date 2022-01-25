
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import { IModelApp } from "../IModelApp";
import { CoreTools } from "./Tool";

/** Tool Assistance known images
 * @public
 */
export enum ToolAssistanceImage {
  /** When Keyboard is specified, ToolAssistanceInstruction.keyboardInfo should be set. */
  Keyboard,
  /** Plus sign */
  AcceptPoint,
  /** Cursor image with click symbol */
  CursorClick,
  /** Mouse image with darkened left button */
  LeftClick,
  /** Mouse image with darkened right button */
  RightClick,
  /** Mouse image with darkened scroll wheel */
  MouseWheel,
  /** Mouse image with darkened left button and left/right arrows */
  LeftClickDrag,
  /** Mouse image with darkened right button and left/right arrows */
  RightClickDrag,
  /** Mouse image with darkened scroll wheel and left/right arrows */
  MouseWheelClickDrag,
  /** Touch image with single finger tapping once */
  OneTouchTap,
  /** Touch image with single finger tapping twice */
  OneTouchDoubleTap,
  /** Touch image with single finger dragging */
  OneTouchDrag,
  /** Touch image with two fingers tapping once */
  TwoTouchTap,
  /** Touch image with two fingers dragging */
  TwoTouchDrag,
  /** Touch image with two fingers pinching */
  TwoTouchPinch,
  /** Touch cursor image with single finger tapping once */
  TouchCursorTap,
  /** Touch cursor image with single finger dragging */
  TouchCursorDrag,
}

/** Input Method for Tool Assistance instruction
 * @public
 */
export enum ToolAssistanceInputMethod {
  /** Instruction applies to both touch & mouse input methods */
  Both,
  /** Instruction applies to only mouse input method */
  Mouse,
  /** Instruction applies to only touch input method */
  Touch,
}

/** Tool Assistance image keyboard keys
 * @public
 */
export interface ToolAssistanceKeyboardInfo {
  /** Text for keys to display */
  keys: string[];
  /** If two rows of keys should be displayed, text for the bottom row of keys */
  bottomKeys?: string[];
}

/** Interface used to describe a Tool Assistance instruction.
 * @public
 */
export interface ToolAssistanceInstruction {
  /** Name of icon WebFont entry, or if specifying an SVG symbol, use "svg:" prefix to imported symbol Id.
   *  ToolAssistanceImage enum also supported. If ToolAssistanceImage.Keyboard specified, also provide keyboardInfo.
   */
  image: string | ToolAssistanceImage;
  /** Text for the instruction. */
  text: string;
  /** When ToolAssistanceImage.Keyboard is specified for image, information about the Keyboard keys in the image. */
  keyboardInfo?: ToolAssistanceKeyboardInfo;
  /** Indicates whether this instruction is new. Defaults to false. */
  isNew?: boolean;
  /** Input Method to which the instruction applies */
  inputMethod?: ToolAssistanceInputMethod;
}

/** Interface used to describe a Tool Assistance section with a label and a set of instructions.
 * @public
 */
export interface ToolAssistanceSection {
  /** Instructions in the section. */
  instructions: ToolAssistanceInstruction[];
  /** Label for the section. */
  label?: string;
}

/** Interface used to describe Tool Assistance for a tool's state.
 * @public
 */
export interface ToolAssistanceInstructions {
  /** The main instruction. */
  mainInstruction: ToolAssistanceInstruction;
  /** Sections of instructions. */
  sections?: ToolAssistanceSection[];
}

/** Tool Assistance helper methods.
 * @public
 */
export class ToolAssistance {

  /** Up key symbol. */
  public static readonly upSymbol: string = "\u2bc5";
  /** Down key symbol. */
  public static readonly downSymbol: string = "\u2bc6";
  /** Left key symbol. */
  public static readonly leftSymbol: string = "\u2bc7";
  /** Right key symbol. */
  public static readonly rightSymbol: string = "\u2bc8";

  /** Keyboard info for Arrow keys. */
  public static readonly arrowKeyboardInfo: ToolAssistanceKeyboardInfo = {
    keys: [ToolAssistance.upSymbol],
    bottomKeys: [ToolAssistance.leftSymbol, ToolAssistance.downSymbol, ToolAssistance.rightSymbol],
  };

  private static translateKey(key: string) { return IModelApp.localization.getLocalizedString(`${CoreTools.namespace}:toolAssistance.${key}`); }
  private static translateTouch(cursor: string) { return IModelApp.localization.getLocalizedString(`${CoreTools.namespace}:touchCursor.${cursor}`); }

  /** Alt key text. */
  public static get altKey(): string {
    return this.translateKey("altKey");
  }

  /** Ctrl key text. */
  public static get ctrlKey(): string {
    return this.translateKey("ctrlKey");
  }

  /** Shift key text. */
  public static get shiftKey(): string {
    return this.translateKey("shiftKey");
  }

  /** Inputs text. */
  public static get inputsLabel(): string {
    return this.translateKey("inputs");
  }

  /** Keyboard info for Alt key. */
  public static get altKeyboardInfo(): ToolAssistanceKeyboardInfo {
    return { keys: [ToolAssistance.altKey] };
  }

  /** Keyboard info for Ctrl key. */
  public static get ctrlKeyboardInfo(): ToolAssistanceKeyboardInfo {
    return { keys: [ToolAssistance.ctrlKey] };
  }

  /** Shift key symbol. */
  public static readonly shiftSymbol: string = "\u21e7";

  /** Keyboard info for Shift key with symbol. */
  public static get shiftKeyboardInfo(): ToolAssistanceKeyboardInfo {
    return { keys: [`${ToolAssistance.shiftSymbol} ${ToolAssistance.shiftKey}`] };
  }

  /** Keyboard info for Shift key without symbol. */
  public static get shiftKeyboardInfoNoSymbol(): ToolAssistanceKeyboardInfo {
    return { keys: [ToolAssistance.shiftKey] };
  }

  /** Keyboard info for Shift key symbol. */
  public static get shiftSymbolKeyboardInfo(): ToolAssistanceKeyboardInfo {
    return { keys: [` ${ToolAssistance.shiftKey} `] };
  }

  /** Ctrl key symbol. */
  public static readonly ctrlSymbol: string = "\u2038";

  /** Keyboard info for Ctrl key symbol. */
  public static get ctrlSymbolKeyboardInfo(): ToolAssistanceKeyboardInfo {
    return { keys: [ToolAssistance.ctrlSymbol] };
  }

  /** Alt key symbol. */
  public static readonly altSymbol: string = "\u2387";

  /** Keyboard info for Alt key symbol. */
  public static get altSymbolKeyboardInfo(): ToolAssistanceKeyboardInfo {
    return { keys: [ToolAssistance.altSymbol] };
  }

  /** Creates a [[ToolAssistanceInstruction]].
   */
  public static createInstruction(image: string | ToolAssistanceImage, text: string, isNew?: boolean, inputMethod?: ToolAssistanceInputMethod, keyboardInfo?: ToolAssistanceKeyboardInfo): ToolAssistanceInstruction {
    if (inputMethod === undefined)
      inputMethod = ToolAssistanceInputMethod.Both;

    const instruction: ToolAssistanceInstruction = {
      image,
      text,
      keyboardInfo,
      isNew,
      inputMethod,
    };
    return instruction;
  }

  /** Creates a [[ToolAssistanceInstruction]] with a [[ToolAssistanceKeyboardInfo]].
   */
  public static createKeyboardInstruction(keyboardInfo: ToolAssistanceKeyboardInfo, text: string, isNew?: boolean, inputMethod?: ToolAssistanceInputMethod): ToolAssistanceInstruction {
    if (inputMethod === undefined)
      inputMethod = ToolAssistanceInputMethod.Mouse;

    const instruction: ToolAssistanceInstruction = {
      image: ToolAssistanceImage.Keyboard,
      text,
      keyboardInfo,
      isNew,
      inputMethod,
    };
    return instruction;
  }

  /** Creates a [[ToolAssistanceInstruction]] with a modifier key and an image.
   */
  public static createModifierKeyInstruction(modifierKey: string, image: string | ToolAssistanceImage, text: string, isNew?: boolean, inputMethod?: ToolAssistanceInputMethod): ToolAssistanceInstruction {
    if (inputMethod === undefined)
      inputMethod = ToolAssistanceInputMethod.Both;

    const keyboardInfo = { keys: [modifierKey] };

    const instruction: ToolAssistanceInstruction = {
      image,
      text,
      keyboardInfo,
      isNew,
      inputMethod,
    };

    return instruction;
  }

  /** Creates a [[ToolAssistanceKeyboardInfo]].
   */
  public static createKeyboardInfo(keys: string[], bottomKeys?: string[]): ToolAssistanceKeyboardInfo {
    const keyboardInfo: ToolAssistanceKeyboardInfo = {
      keys,
      bottomKeys,
    };
    return keyboardInfo;
  }

  /** Creates instructions for interaction with the touch cursor that are appended to the supplied [[ToolAssistanceInstruction]] array.
   */
  public static createTouchCursorInstructions(instructions: ToolAssistanceInstruction[]): boolean {
    const accuSnap = IModelApp.accuSnap;
    if (undefined === accuSnap.touchCursor && accuSnap.wantVirtualCursor) {
      instructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.OneTouchTap, this.translateTouch("Activate"), false, ToolAssistanceInputMethod.Touch));
      return true;
    } else if (undefined !== accuSnap.touchCursor) {
      instructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TouchCursorDrag, this.translateTouch("IdentifyPoint"), false, ToolAssistanceInputMethod.Touch));
      instructions.push(ToolAssistance.createInstruction(ToolAssistanceImage.TouchCursorTap, this.translateTouch("AcceptPoint"), false, ToolAssistanceInputMethod.Touch));
      return true;
    }
    return false;
  }

  /** Creates a [[ToolAssistanceSection]].
   */
  public static createSection(instructions: ToolAssistanceInstruction[], label?: string): ToolAssistanceSection {
    const section: ToolAssistanceSection = {
      instructions,
      label,
    };
    return section;
  }

  /** Creates a [[ToolAssistanceInstructions]].
   */
  public static createInstructions(mainInstruction: ToolAssistanceInstruction, sections?: ToolAssistanceSection[]): ToolAssistanceInstructions {
    const instructions: ToolAssistanceInstructions = {
      mainInstruction,
      sections,
    };
    return instructions;
  }
}

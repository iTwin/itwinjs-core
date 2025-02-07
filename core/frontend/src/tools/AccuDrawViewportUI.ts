/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module AccuDraw
 */
import { FormatType, Parser } from "@itwin/core-quantity";
import { AccuDraw, CompassMode, ItemField } from "../AccuDraw";
import { ViewRect } from "../common/ViewRect";
import { IModelApp } from "../IModelApp";
import { AccuDrawShortcuts } from "./AccuDrawTool";
import { BeButtonEvent } from "./Tool";
import { ScreenViewport } from "../Viewport";

interface AccuDrawControls {
  overlay: HTMLDivElement; // Viewport overlay...
  div: HTMLDivElement; // Child of overlay used to position controls...
  itemFields: HTMLInputElement[]; // Text fields indexed by ItemField...
  itemLocks: HTMLButtonElement[]; // Lock toggles indexed by ItemField...
}

/** Provides an in viewport user interface for AccuDraw that can optionally follow the cursor or remain at a fixed location.
 * @beta
 */
export class AccuDrawViewportUI extends AccuDraw {
  private _focusItem: ItemField;
  private _controls?: AccuDrawControls;
  private _toolTipsSuspended?: true;
  private _expression?: { item: ItemField, operator: string };

  /** Settings to control the behavior and visual appearance of the viewport controls.
   * @note Colors were chosen for visibility against viewport background and contents.
   */
  public static controlProps = {
    /** Suspend locate tooltip when controls are shown, may wish to disable when using fixed location. */
    suspendLocateToolTip: true,
    /** Show controls at a fixed location in the view (currently bottom middle) instead of following the cursor. */
    fixedLocation: false,
    /** Layout controls in a single row horizontally instead of in columns vertically as an option when using fixed location. */
    horizontalArrangement: false,
    /** When controls follow the cursor, the X and Y offsets applied to the current point to position the top left (values in inches based on screen DPI) */
    cursorOffset: { x: .4, y: .1 },
    /** Replace "^", ";", and ".." with "°" or ":" for easier input. */
    simplifiedInput: true,
    /** Enable simple math operations not supported by quantity parser. */
    mathOperations: true,
    /** Number of visible characters to show in text input fields. */
    fieldSize: 12,
    /** Row spacing of text input fields for vertical arrangement. */
    rowSpacingFactor: 1.2,
    /** Column spacing of text input fields and buttons for horizontal arrangement. */
    columnSpacingFactor: 1.1,
    /** Corner radius of text input fields and locks buttons. */
    borderRadius: "0.5em",
    /** Background color of unfocused text input fields and unlocked buttons. */
    backgroundColor: "rgba(150, 150, 150, 0.5)",

    /** Settings specific to text input fields and lock button labels. */
    text: {
      /** Font family to use for text input field values and button labels. */
      fontFamily: "sans-serif",
      /** Font size to use for text input field values and button labels. */
      fontSize: "9pt",
      /** Font color to use for text input field values and button labels. */
      color: "white",
      /** Background color of focused text input field. */
      focusColor: "rgba(50, 50, 200, 0.75)",
    },

    /** Settings specific to lock buttons. */
    button: {
      /** Background color of locked buttons. */
      pressedColor: "rgba(50, 50, 50, 0.75)",
      /** Margin to use on left and right to position relative to text input field. */
      margin: "0.25em",
      /** Width of border outline. */
      outlineWidth: "thin",
      /** Shadow shown when unlocked to make it appear raised. */
      shadow: "0.25em 0.25em 0.2em rgb(75, 75, 75)",
    },
  };

  /** Create a new instance of this class to set as [[IModelAppOptions.accuDraw]] for this session. */
  public constructor() {
    super();
    this._focusItem = this.defaultFocusItem();
  }

  /** Call to set a vertical layout that follows the cursor. This is the default configuration. */
  public setVerticalCursorLayout() {
    const props = AccuDrawViewportUI.controlProps;
    props.horizontalArrangement = false;
    props.fixedLocation = false;
    props.suspendLocateToolTip = true;
  }

  /** Call to set a horizontal layout that is anchored to the bottom middle of the view. */
  public setHorizontalFixedLayout() {
    const props = AccuDrawViewportUI.controlProps;
    props.horizontalArrangement = true;
    props.fixedLocation = true;
    props.suspendLocateToolTip = false;
  }

  /** Call to update the currently displayed controls after settings are changed. */
  public refreshControls(): void {
    if (undefined === this._controls)
      return;

    this.removeControls();
    if (!this.isActive)
      return;

    // Shouldn't need to call IModelApp.toolAdmin.simulateMotionEvent() in this case...
    const ev = new BeButtonEvent();
    IModelApp.toolAdmin.fillEventFromCursorLocation(ev);
    this.updateControls(ev);
  }

  private suspendToolTips() {
    if (!AccuDrawViewportUI.controlProps.suspendLocateToolTip || undefined === (this._toolTipsSuspended = (IModelApp.accuSnap.userSettings.toolTip ? true : undefined)))
      return;
    IModelApp.accuSnap.userSettings.toolTip = false;
    IModelApp.notifications.clearToolTip();
  }

  private unsuspendToolTips() {
    if (undefined === this._toolTipsSuspended)
      return;
    IModelApp.accuSnap.userSettings.toolTip = true;
    this._toolTipsSuspended = undefined;
  }


  private setDynamicKeyinStatus(item: ItemField): void {
    // This does nothing if keyin status is already dynamic...
    AccuDrawShortcuts.itemFieldCompletedInput(item);
  }

  private setPartialKeyinStatus(item: ItemField, selectAll: boolean): void {
    if (!this.isDynamicKeyinStatus(item))
      return;

    AccuDrawShortcuts.itemFieldNewInput(item);
    if (undefined === this._controls || !selectAll)
      return;

    const itemField = this._controls.itemFields[item];
    itemField.setSelectionRange(0, itemField.value.length);
  }

  private makeParserHappy(value: string, isAngle: boolean): string {
    // TODO: Work around for default length parser not accepting output formatted with dash separator, ex. 20'-6"...
    const parserSpec = (isAngle ? undefined : this.getLengthParser());
    if (undefined === parserSpec)
      return value;
    return (FormatType.Fractional === parserSpec.format.type && -1 !== value.indexOf("'-") ? value.replaceAll("'-", "':") : value);
  }

  private evaluateExpression(operator: string, operandA: number, operandB: number): number {
    switch (operator) {
      case "+":
        return operandA + operandB;
      case "-":
        return operandA - operandB;
      case "*":
        return operandA * operandB;
      case "/":
        return operandA / operandB;
      default:
        return operandA;
    }
  }

  private parseExpression(currentValue: string, isAngle: boolean): string | undefined {
    if (undefined === this._expression)
      return undefined; // Not an expression...

    // Attempt to parse and apply operation to current value...
    const operator = currentValue.lastIndexOf(this._expression.operator)
    if (-1 === operator) {
      this._expression = undefined; // Operator has been edited out of string, parse current value...
      return undefined;
    }

    const parserSpec = (isAngle ? this.getAngleParser() : this.getLengthParser());
    const formatterSpec = (isAngle ? this.getAngleFormatter() : this.getLengthFormatter());
    if (undefined === parserSpec || undefined === formatterSpec)
      return undefined; // Nothing to do...

    const operandAStr = currentValue.substring(0, operator);
    const parseResultA = parserSpec.parseToQuantityValue(this.makeParserHappy(operandAStr, isAngle));
    if (!Parser.isParsedQuantity(parseResultA))
      return undefined; // First operand isn't valid, try to parse current value (which is also likely to fail)...

    const operandBStr = currentValue.substring(operator + this._expression.operator.length);
    const operatorKey = this._expression.operator[1];
    const isNumber = ("*" === operatorKey || "/" === operatorKey); // Treat as number for */ and quantity for +-...
    let operandB;

    if (isNumber) {
      operandB = parseFloat(operandBStr);
      if (Number.isNaN(operandB))
        return operandAStr; // Second operand is invalid number, set value to first operand which is valid...
    } else {
      const parseResultB = parserSpec.parseToQuantityValue(this.makeParserHappy(operandBStr, isAngle));
      if (!Parser.isParsedQuantity(parseResultB))
        return operandAStr; // Second operand is invalid quantity, set value to first operand which is valid...
      operandB = parseResultB.value;
    }

    const operandA = parseResultA.value;
    const newValue = this.evaluateExpression(operatorKey, operandA, operandB);
    const newValueStr = IModelApp.quantityFormatter.formatQuantity(newValue, formatterSpec);

    return newValueStr;
  }

  private async processPartialInput(item: ItemField): Promise<void> {
    if (undefined === this._controls)
      return;

    const itemField = this._controls.itemFields[item];
    const currentValue = itemField.value;

    // If current value has been deleted, unlock field and refresh for current cursor location...
    if (0 === currentValue.length) {
      this.updateFieldLock(item, false);
      IModelApp.toolAdmin.simulateMotionEvent();
      return;
    }

    const isAngle = (ItemField.ANGLE_Item === item);
    const expressionValue = this.parseExpression(currentValue, isAngle);
    return this.processFieldInput(item, this.makeParserHappy(expressionValue ?? currentValue, isAngle), false);
  }

  private async acceptPartialInput(item: ItemField, forward?: boolean): Promise<void> {
    if (undefined === this._controls)
      return;

    const itemField = this._controls.itemFields[item];
    const currentValue = itemField.value;
    const isAngle = (ItemField.ANGLE_Item === item);
    const expressionValue = this.parseExpression(currentValue, isAngle);

    if (undefined === forward)
      return AccuDrawShortcuts.itemFieldAcceptInput(item, this.makeParserHappy(expressionValue ?? currentValue, isAngle));

    return AccuDrawShortcuts.itemFieldNavigate(item, this.makeParserHappy(expressionValue ?? currentValue, isAngle), forward);
  }

  private acceptSavedValue(item: ItemField, next: boolean): void {
    if (next)
      AccuDrawShortcuts.chooseNextValue(item);
    else
      AccuDrawShortcuts.choosePreviousValue(item);
  }

  private doFocusHome(ev: KeyboardEvent, isDown: boolean, _item: ItemField): void {
    ev.preventDefault();
    if (!isDown || this._isFocusHome)
      return;

    ev.stopPropagation();
    this.setFocusHome();
    IModelApp.viewManager.invalidateDecorationsAllViews();
  }

  private async doChooseSavedValue(ev: KeyboardEvent, isDown: boolean, item: ItemField, next: boolean): Promise<void> {
    ev.preventDefault();
    ev.stopPropagation();

    if (!isDown)
      return;

    this.acceptSavedValue(item, next);
  }

  private async doNavigate(ev: KeyboardEvent, isDown: boolean, item: ItemField, forward: boolean): Promise<void> {
    ev.preventDefault();
    ev.stopPropagation();

    if (!isDown)
      return;

    return this.acceptPartialInput(item, forward);
  }

  private async doAcceptInput(ev: KeyboardEvent, isDown: boolean, item: ItemField): Promise<void> {
    ev.preventDefault();
    if (!isDown || this.isDynamicKeyinStatus(item))
      return;

    ev.stopPropagation();
    return this.acceptPartialInput(item);
  }

  private doNewInput(_ev: KeyboardEvent, isDown: boolean, item: ItemField): void {
    if (!isDown)
      return;

    this.setPartialKeyinStatus(item, false);
  }

  private async doDeleteInput(_ev: KeyboardEvent, isDown: boolean, item: ItemField): Promise<void> {
    if (isDown)
      return this.setPartialKeyinStatus(item, false);

    return this.processPartialInput(item);
  }

  private processReplacementKey(ev: KeyboardEvent, isDown: boolean, item: ItemField, replacement: string, allowStart: boolean): boolean {
    if (undefined === this._controls)
      return false;

    ev.preventDefault()
    if (!isDown || 0 === replacement.length || this.isDynamicKeyinStatus(item))
      return true;

    const itemField = this._controls.itemFields[item];
    if (null === itemField.selectionStart || null === itemField.selectionEnd)
      return true;

    const currentValue = itemField.value;
    if (!allowStart && (!currentValue.length || !itemField.selectionStart || !itemField.selectionEnd))
      return true;

    const selectionStart = (itemField.selectionStart > itemField.selectionEnd ? itemField.selectionEnd : itemField.selectionStart);
    itemField.value = currentValue.substring(0, selectionStart) + replacement + currentValue.substring(itemField.selectionEnd);
    itemField.selectionStart = itemField.selectionEnd = selectionStart + 1;

    return false;
  }

  private processRepeatedKey(ev: KeyboardEvent, isDown: boolean, item: ItemField, replacement: string): boolean {
    if (undefined === this._controls)
      return false;

    const itemField = this._controls.itemFields[item];
    const currentValue = itemField.value;
    if (!currentValue.length || !itemField.selectionStart || !itemField.selectionEnd)
      return false;

    const selectionStart = (itemField.selectionStart > itemField.selectionEnd ? itemField.selectionEnd : itemField.selectionStart);
    if (selectionStart !== itemField.selectionEnd)
      return false;

    const selectionPrevious = selectionStart - 1;
    if (currentValue[selectionPrevious] !== (isDown ? ev.key : replacement))
      return false;

    ev.preventDefault()
    if (!isDown)
      return false;

    itemField.value = currentValue.substring(0, selectionPrevious) + replacement + currentValue.substring(selectionStart);
    itemField.selectionStart = itemField.selectionEnd = selectionPrevious + 1;

    return false;
  }

  private doProcessOverrideKey(ev: KeyboardEvent, isDown: boolean, item: ItemField): boolean {
    if (undefined === this._controls || !AccuDrawViewportUI.controlProps.simplifiedInput)
      return false;

    switch (ev.key) {
      case "^":
        return this.processReplacementKey(ev, isDown, item, (ItemField.ANGLE_Item === item ? "°" : ""), false); // Easier "°" input...
      case ";":
        return this.processReplacementKey(ev, isDown, item, (ItemField.ANGLE_Item === item ? "°" : ":"), false); // Easier ":" input still useful w/o MU:SU:PU?
      case ".":
        return this.processRepeatedKey(ev, isDown, item, ":"); // Still useful replacing ".." with ":" for numeric keypad users w/o MU:SU:PU?
      default:
        return false;
    }
  }

  private doProcessExpressionKey(ev: KeyboardEvent, isDown: boolean, item: ItemField): boolean {
    if (undefined === this._controls || !AccuDrawViewportUI.controlProps.mathOperations)
      return false;

    const itemField = this._controls.itemFields[item];
    const currentValue = itemField.value;

    switch (ev.key) {
      case "ArrowLeft":
      case "ArrowRight":
        if (undefined === this._expression || !isDown || this.isDynamicKeyinStatus(item) || !itemField.selectionStart)
          break;

        const moveLeft = ("ArrowLeft" === ev.key);
        const operatorPosIns = currentValue.lastIndexOf(this._expression.operator);
        if (itemField.selectionStart !== (moveLeft ? operatorPosIns + this._expression.operator.length : operatorPosIns))
          break;

        // Treat expression operator string as a single character when moving the text insertion cursor...
        itemField.selectionStart = itemField.selectionEnd = (moveLeft ? operatorPosIns : operatorPosIns + this._expression.operator.length);
        ev.preventDefault();
        return true;

      case "Backspace":
      case "Delete":
        if (undefined === this._expression || !isDown || this.isDynamicKeyinStatus(item) || !itemField.selectionStart)
          break;

        const deleteBefore = ("Backspace" === ev.key);
        const operatorPosDel = currentValue.lastIndexOf(this._expression.operator);
        if (itemField.selectionStart !== (deleteBefore ? operatorPosDel + this._expression.operator.length : operatorPosDel))
          break;

        // Treat expression operator string as single character for delete...
        itemField.value = currentValue.substring(0, operatorPosDel);
        itemField.selectionStart = itemField.selectionEnd = itemField.value.length;
        this._expression = undefined;
        ev.preventDefault();
        return true;

      case " ":
        if (!isDown || !this.isDynamicKeyinStatus(item))
          break;

        this.setPartialKeyinStatus(item, false); // Replacing current w/space isn't useful, append to end to support + or - more conveniently...
        return true;

      case "+":
      case "-":
      case "*":
      case "/":
        if (!isDown || undefined !== this._expression)
          break;

        if (!currentValue.length || !itemField.selectionStart || itemField.selectionStart !== currentValue.length)
          break;

        const haveSpace = (" " === currentValue[itemField.selectionStart - 1]);
        const requireSpace = ("+" === ev.key || "-" === ev.key); // These are valid for 1st character to replace current value...

        if (!(requireSpace ? haveSpace : (haveSpace || this.isDynamicKeyinStatus(item))))
          break;

        const operator = ` ${ev.key} `
        const expression = `${currentValue + (haveSpace ? operator.substring(1) : operator)}`;

        itemField.value = expression;
        itemField.selectionStart = itemField.selectionEnd = itemField.value.length;
        this._expression = { item, operator };

        this.setPartialKeyinStatus(item, false);
        ev.preventDefault();

        return true;
    }

    return false;
  }

  private async doProcessKey(ev: KeyboardEvent, isDown: boolean, item: ItemField): Promise<void> {
    if (!this.itemFieldInputIsValid(ev.key, item)) {
      ev.preventDefault(); // Ignore potential shortcuts...
      return;
    }

    if (this.doProcessOverrideKey(ev, isDown, item))
      return;

    if (this.doProcessExpressionKey(ev, isDown, item))
      return;

    if (isDown)
      return this.setPartialKeyinStatus(item, true);

    return this.processPartialInput(item);
  }

  private async onKeyboardEvent(ev: KeyboardEvent, isDown: boolean): Promise<void> {
    if (ev.ctrlKey || ev.altKey || ev.metaKey) {
      ev.preventDefault(); // Ignore qualifiers other than shift...
      return;
    }

    switch (ev.key) {
      case "Escape":
        return this.doFocusHome(ev, isDown, this._focusItem);
      case "PageDown":
        return this.doChooseSavedValue(ev, isDown, this._focusItem, true);
      case "PageUp":
        return this.doChooseSavedValue(ev, isDown, this._focusItem, false);
      case "Tab":
        return this.doNavigate(ev, isDown, this._focusItem, !ev.shiftKey);
      case "ArrowDown":
        if (ev.shiftKey)
          return this.doChooseSavedValue(ev, isDown, this._focusItem, true);
        return this.doNavigate(ev, isDown, this._focusItem, true);
      case "ArrowUp":
        if (ev.shiftKey)
          return this.doChooseSavedValue(ev, isDown, this._focusItem, false);
        return this.doNavigate(ev, isDown, this._focusItem, false);
      case "Enter":
        return this.doAcceptInput(ev, isDown, this._focusItem);
      case "Home":
      case "End":
      case "Insert":
        return this.doNewInput(ev, isDown, this._focusItem);
      case "ArrowLeft":
      case "ArrowRight":
        if (this.doProcessExpressionKey(ev, isDown, this._focusItem))
          return;
        return this.doNewInput(ev, isDown, this._focusItem);
      case "Backspace":
      case "Delete":
        if (this.doProcessExpressionKey(ev, isDown, this._focusItem))
          return;
        return this.doDeleteInput(ev, isDown, this._focusItem);
      default:
        return this.doProcessKey(ev, isDown, this._focusItem);
    }
  }

  private removeControls(): void {
    if (undefined === this._controls)
      return;

    this._controls.overlay.remove();
    this._controls = undefined;
    this.unsuspendToolTips();
  }

  private createControlDiv(): HTMLDivElement {
    const div = document.createElement("div");
    div.className = "accudraw-controls";

    const style = div.style;
    style.pointerEvents = "none";
    style.overflow = "visible"; // Don't clip/hide outline or shadow...
    style.position = "absolute";
    style.top = style.left = "0";
    style.height = style.width = "100%";

    return div;
  }

  private updateItemFieldKeyinStatus(itemField: HTMLInputElement, item: ItemField) {
    const isDynamic = this.isDynamicKeyinStatus(item)

    if (isDynamic && item === this._expression?.item)
      this._expression = undefined; // Only valid when entering partial input...

    itemField.style.caretColor = isDynamic ? itemField.style.backgroundColor : itemField.style.color;
  }

  private updateItemFieldValue(itemField: HTMLInputElement, item: ItemField) {
    const value = this.getFormattedValueByIndex(item)
    itemField.value = value;
    this.updateItemFieldKeyinStatus(itemField, item);
  }

  private updateItemFieldLock(itemLock: HTMLButtonElement, item: ItemField) {
    const locked = this.getFieldLock(item);
    itemLock.style.outlineStyle = locked ? "inset" : "outset";
    itemLock.style.boxShadow = locked ? "none" : AccuDrawViewportUI.controlProps.button.shadow;
    itemLock.style.backgroundColor = locked ? AccuDrawViewportUI.controlProps.button.pressedColor : AccuDrawViewportUI.controlProps.backgroundColor;
  }

  private initializeItemStyle(style: CSSStyleDeclaration, isButton: boolean): void {
    style.pointerEvents = "none"; // Don't receive pointer events...
    style.position = "absolute";
    style.textWrap = "nowrap";
    style.textAnchor = "top";
    style.textAlign = isButton ? "center" : "left";

    const controlProps = AccuDrawViewportUI.controlProps;
    style.fontFamily = controlProps.text.fontFamily;
    style.fontSize = controlProps.text.fontSize;
    style.color = controlProps.text.color;
    style.backgroundColor = controlProps.backgroundColor;
    style.borderRadius = controlProps.borderRadius;
  }

  private createItemField(item: ItemField): HTMLInputElement {
    const itemField = document.createElement("input");

    itemField.contentEditable = "true";
    itemField.size = AccuDrawViewportUI.controlProps.fieldSize;

    const style = itemField.style;
    this.initializeItemStyle(style, false);
    this.updateItemFieldValue(itemField, item);

    itemField.onkeydown = async (ev: KeyboardEvent) => { await this.onKeyboardEvent(ev, true); };
    itemField.onkeyup = async (ev: KeyboardEvent) => { await this.onKeyboardEvent(ev, false); };
    itemField.onfocus = (ev: FocusEvent) => { this.onFocusChange(ev, item, true); };
    itemField.onblur = (ev: FocusEvent) => { this.onFocusChange(ev, item, false); };;

    return itemField;
  }

  private createItemFieldLock(item: ItemField): HTMLButtonElement {
    const itemLock = document.createElement("button");

    itemLock.type = "button";
    itemLock.contentEditable = "false";
    itemLock.disabled = true; // Don't receive focus...

    switch (item) {
      case ItemField.DIST_Item:
        itemLock.innerHTML = "\u21A6"; // right arrow from bar...
        break;
      case ItemField.ANGLE_Item:
        itemLock.innerHTML = "\u2221"; // measured angle...
        break;
      case ItemField.X_Item:
        itemLock.innerHTML = "X";
        break;
      case ItemField.Y_Item:
        itemLock.innerHTML = "Y";
        break;
      case ItemField.Z_Item:
        itemLock.innerHTML = "Z";
        break;
    }

    const style = itemLock.style;
    this.initializeItemStyle(style, true);
    this.updateItemFieldLock(itemLock, item);

    const button = AccuDrawViewportUI.controlProps.button;
    style.paddingLeft = style.paddingRight = "0";
    style.marginLeft = style.marginRight = button.margin;
    style.outlineWidth = button.outlineWidth;

    return itemLock;
  }

  /** Use to override the position of the controls in the supplied view. */
  protected modifyControlRect(_rect: ViewRect, _vp: ScreenViewport): void { }

  /** Return the ViewRect currently occupied by the controls in the supplied view. */
  protected currentControlRect(vp: ScreenViewport): ViewRect | undefined {
    if (undefined === this._controls || this._controls.overlay.parentElement !== vp.vpDiv)
      return undefined;

    const viewRect = vp.vpDiv.getBoundingClientRect();
    const elemRect = this._controls.div.getBoundingClientRect();
    const controlRect = new ViewRect(elemRect.left - viewRect.left, elemRect.top - viewRect.top, elemRect.right - viewRect.left, elemRect.bottom - viewRect.top);

    return controlRect;
  }

  private updateControlVisibility(isPolar: boolean, is3d?: boolean): void {
    if (undefined === this._controls)
      return;

    this._controls.itemFields[ItemField.ANGLE_Item].hidden = !isPolar;
    this._controls.itemLocks[ItemField.ANGLE_Item].hidden = !isPolar;

    this._controls.itemFields[ItemField.DIST_Item].hidden = !isPolar;
    this._controls.itemLocks[ItemField.DIST_Item].hidden = !isPolar;

    this._controls.itemFields[ItemField.X_Item].hidden = isPolar;
    this._controls.itemLocks[ItemField.X_Item].hidden = isPolar;

    this._controls.itemFields[ItemField.Y_Item].hidden = isPolar;
    this._controls.itemLocks[ItemField.Y_Item].hidden = isPolar;

    if (undefined === is3d)
      return;

    this._controls.itemFields[ItemField.Z_Item].hidden = !is3d;
    this._controls.itemLocks[ItemField.Z_Item].hidden = !is3d;
  }

  private updateControls(ev: BeButtonEvent): void {
    const vp = ev.viewport;
    if (undefined === vp || !this.isActive)
      return;

    if (undefined !== this._controls && this._controls.overlay.parentElement !== vp.vpDiv)
      this.removeControls(); // Could be enhanced to save/restore partial input of currently focused item...

    const props = AccuDrawViewportUI.controlProps;

    if (undefined === this._controls) {
      const overlay = vp.addNewDiv("accudraw-overlay", true, 35);
      const div = this.createControlDiv();
      const is3dLayout = vp.view.is3d();
      const isHorizontalLayout = props.horizontalArrangement;

      overlay.appendChild(div);

      const createFieldAndLock = (item: ItemField) => {
        const itemField = itemFields[item] = this.createItemField(item);
        itemField.style.top = isHorizontalLayout ? "0" : `${rowOffset}px`;
        itemField.style.left = isHorizontalLayout ? `${columnOffset}px` : "0";

        div.appendChild(itemField);

        if (is3dLayout || ItemField.Z_Item !== item)
          rowOffset += itemField.offsetHeight * props.rowSpacingFactor;

        itemWidth = itemField.offsetWidth;
        itemHeight = itemField.offsetHeight;

        const itemLock = itemLocks[item] = this.createItemFieldLock(item);
        itemLock.style.top = itemField.style.top;
        itemLock.style.left = isHorizontalLayout ? `${columnOffset + itemWidth}px` : `${itemWidth}px`;
        itemLock.style.width = itemLock.style.height = `${itemHeight}px`; // Make square of same height as text field...

        div.appendChild(itemLock);

        lockWidth = itemLock.offsetWidth;

        if (is3dLayout || ItemField.Z_Item !== item)
          columnOffset += (itemWidth + lockWidth) * props.columnSpacingFactor;
      };

      let rowOffset = 0;
      let columnOffset = 0;
      let itemWidth = 0;
      let itemHeight = 0;
      let lockWidth = 0;

      const itemFields: HTMLInputElement[] = [];
      const itemLocks: HTMLButtonElement[] = [];

      createFieldAndLock(ItemField.DIST_Item);
      createFieldAndLock(ItemField.ANGLE_Item);

      rowOffset = 0;
      columnOffset = 0;

      createFieldAndLock(ItemField.X_Item);
      createFieldAndLock(ItemField.Y_Item);
      createFieldAndLock(ItemField.Z_Item); // Both polar and rectangular modes support Z in 3d views...

      div.style.width = isHorizontalLayout ? `${columnOffset}px` : `${itemWidth + lockWidth + 5}px`;
      div.style.height = isHorizontalLayout ? `${itemHeight * props.rowSpacingFactor}px` : `${rowOffset}px`;

      this._controls = { overlay, div, itemFields, itemLocks };
      this.updateControlVisibility(CompassMode.Polar === this.compassMode, vp.view.is3d());
      this.setFocusItem(this._focusItem);
      this.suspendToolTips();

      vp.onChangeView.addOnce(() => this.removeControls()); // Clear on view change/closure...
    }

    const viewRect = vp.viewRect;
    const position = vp.worldToView(ev.point);

    if (props.fixedLocation) {
      position.x = (viewRect.left + ((viewRect.width - this._controls.div.offsetWidth) * 0.5));
      position.y = (viewRect.bottom - this._controls.div.offsetHeight);
    } else {
      position.x += Math.floor(vp.pixelsFromInches(props.cursorOffset.x)) + 0.5;
      position.y += Math.floor(vp.pixelsFromInches(props.cursorOffset.y)) + 0.5;
    }

    const controlRect = new ViewRect(position.x, position.y, position.x + this._controls.div.offsetWidth, position.y + this._controls.div.offsetHeight);
    this.modifyControlRect(controlRect, vp);

    if (!controlRect.isContained(viewRect))
      return; // Keep showing at last valid location...

    this._controls.div.style.left = `${controlRect.left}px`;
    this._controls.div.style.top = `${controlRect.top}px`;
  }

  private get _isFocusHome(): boolean {
    return (document.body === document.activeElement);
  }

  private get _isFocusAccuDraw(): boolean {
    return (undefined !== this._controls && document.activeElement?.parentElement === this._controls.itemFields[this._focusItem].parentElement);
  }

  private setFocusHome(): void {
    const element = document.activeElement as HTMLElement;
    if (element && element !== document.body)
      element.blur();
    document.body.focus();
  }

  /** Return whether keyboard shortcuts can or can't be used.
   * Used to show a visual indication of whether keyboard shortcuts will be processed.
   * Keyboard shortcuts can be supported when focus is either on AccuDraw or Home.
   * When returning false the compass displays in monochrome.
   */
  public override get hasInputFocus(): boolean {
    // Indicate when keyboard shortcuts can't be used (i.e. focus not at AccuDraw or Home) by changing compass to monochrome...
    return (this._isFocusHome || this._isFocusAccuDraw);
  }

  /** Request to set focus to the specified AccuDraw input field to start entering values.
   * The focused input field will be indicated by the background color.
   */
  public override setFocusItem(index: ItemField) {
    this._focusItem = index;
    if (undefined === this._controls)
      return;
    const itemField = this._controls.itemFields[this._focusItem];
    itemField.focus();
  }

  /** Request to set focus to the active AccuDraw input field to start entering values.
   * The focused input field will be indicated by the background color.
   */
  public override grabInputFocus() {
    // Set focus to active input field for entering values...
    if (this._isFocusAccuDraw)
      return;
    this.setFocusItem(this._focusItem);
  }

  private onFocusChange(_ev: FocusEvent, item: ItemField, focusIn: boolean): void {
    if (undefined === this._controls)
      return;

    // NOTE: Using "setSelectionRange" while value is changing in dynamics isn't pretty, use background+caret color instead...
    const itemField = this._controls.itemFields[item];
    itemField.style.backgroundColor = (focusIn ? AccuDrawViewportUI.controlProps.text.focusColor : AccuDrawViewportUI.controlProps.backgroundColor);
    this.updateItemFieldKeyinStatus(itemField, item);

    if (!focusIn)
      this.setDynamicKeyinStatus(item);
  }

  /** Change notification for when the compass is shown or hidden.
   * Used to hide the viewport controls when the compass is no longer displayed.
   */
  public override onCompassDisplayChange(state: "show" | "hide"): void {
    if ("show" === state)
      return;
    this.removeControls();
  }

  /** Change notification for when the compass mode switches between polar and rectangular inputs.
   * Used to show or hide the input fields that are applicable to the current mode.
   */
  public override onCompassModeChange(): void {
    this.updateControlVisibility(CompassMode.Polar === this.compassMode);
    this.setFocusItem(this.defaultFocusItem());
  }

  /** Change notification for when the supplied input field switches between dynamic and partial input.
   * When an input field is in the dynamic state, its value changes according to the current button event unless the field is locked.
   * When an input field is in the partial state, its value is not changed or formatted to allow the value to be changed.
   * Locking a field is expected to change the input state to partial.
   * Unlocking a field or accepting a value by focusing is expected to change the input state to dynamic.
   */
  public override onFieldKeyinStatusChange(item: ItemField) {
    if (undefined === this._controls)
      return;
    this.updateItemFieldKeyinStatus(this._controls.itemFields[item], item)
  }

  /** Change notification for when the supplied input field value has been modified.
   * Used to update the displayed input field with the value from the active angle or distance formatter.
   */
  public override onFieldValueChange(item: ItemField) {
    if (undefined === this._controls)
      return;
    this.updateItemFieldValue(this._controls.itemFields[item], item);
  }

  /** Change notification for when the supplied input field lock status is modified.
   * Used to update the displayed lock toggles to reflect the current state.
   */
  public override onFieldLockChange(item: ItemField) {
    if (undefined === this._controls)
      return;
    this.updateItemFieldLock(this._controls.itemLocks[item], item);
  }

  /** Change notification of a motion event in the view.
   * Used to show as well as update the dynamic input field values to reflect the current deltas when active.
   * Automatically switches the focused input field between x and y in rectangular mode based on
   * cursor position when axis isn't locked to support more intuitive user input and "smart lock" keyboard shortcut.
   */
  public override onMotion(ev: BeButtonEvent): void {
    this.updateControls(ev);
    this.processMotion();
  }
}

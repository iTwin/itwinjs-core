/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module AccuDraw */

import * as React from "react";

import { Logger } from "@bentley/bentleyjs-core";
import { XAndY } from "@bentley/geometry-core";
import { PrimitiveValue, PropertyValueFormat, PropertyRecord, PropertyDescription, AngleDescription, LengthDescription } from "@bentley/imodeljs-frontend";

import { Size, CommonProps, UiEvent, Rectangle, Point, SizeProps, withOnOutsideClick, Icon } from "@bentley/ui-core";
import { EditorContainer, PropertyUpdatedArgs } from "@bentley/ui-components";
import { offsetAndContainInContainer } from "@bentley/ui-ninezone";

import { UiFramework } from "../UiFramework";
import { MenuItemHelpers } from "../shared/MenuItem";
import { MenuItemProps } from "../shared/ItemProps";
import { MenuButton } from "./MenuButton";
import { OnCommitFunc, OnCancelFunc, Calculator } from "./Calculator";
import { PositionPopup, PositionPopupContent } from "./PositionPopup";

import angleIcon from "./angle.svg";
import lengthIcon from "./distance.svg";
import heightIcon from "./height-2.svg";

/** Type of AccuDraw Popup
 * @internal
 */
export enum AccuDrawPopupType {
  MenuButton,
  InputEditor,
  Calculator,
}

/** Information maintained by AccuDrawPopupManager about a Popup
 * @internal
 */
interface AccuDrawPopupInfo {
  id: string;
  isVisible: boolean;
  el: HTMLElement;
  pt: XAndY;
  type: AccuDrawPopupType;
  offset: XAndY;
  size?: Size;
}

/** @internal */
interface MenuButtonPopupInfo extends AccuDrawPopupInfo {
  content: React.ReactNode;
}

/** @internal */
interface CalculatorPopupInfo extends AccuDrawPopupInfo {
  initialValue: number;
  resultIcon: string;
  onOk: OnCommitFunc;
  onCancel: OnCancelFunc;
}

/** @internal */
interface InputEditorPopupInfo extends AccuDrawPopupInfo {
  record: PropertyRecord;
  onCancel: OnCancelFunc;
  commitHandler: InputEditorCommitHandler;
}

/** @internal */
class InputEditorCommitHandler {
  constructor(
    public readonly onCommit: OnCommitFunc,
  ) { }

  public handleCommit = (args: PropertyUpdatedArgs) => {
    let newValue = 0;
    // istanbul ignore else
    if (args.newValue.valueFormat === PropertyValueFormat.Primitive) {
      newValue = args.newValue.value as number;
    }
    this.onCommit(newValue);
  }
}

/** AccuDraw Popups Changed Event class.
 * @internal
 */
export class AccuDrawPopupsChangedEvent extends UiEvent<{}> { }

/** AccuDraw Popup Manager
 * @alpha
 */
export class AccuDrawPopupManager {
  private static _popups: AccuDrawPopupInfo[] = new Array<AccuDrawPopupInfo>();
  private static _calculatorId = "Calculator";
  private static _editorId = "InputEditor";
  private static _offset = { x: 8, y: 8 };

  /** @internal */
  public static readonly onAccuDrawPopupsChangedEvent = new AccuDrawPopupsChangedEvent();
  /** @internal */
  public static get popups() { return this._popups; }
  /** @internal */
  public static get popupCount() { return this._popups.length; }

  /** @internal */
  public static clearPopups() {
    this._popups.length = 0;
    AccuDrawPopupManager.emitPopupsChangedEvent();
  }

  private static emitPopupsChangedEvent(): void {
    AccuDrawPopupManager.onAccuDrawPopupsChangedEvent.emit({});
  }

  private static pushPopup(popupInfo: AccuDrawPopupInfo): void {
    AccuDrawPopupManager._popups.push(popupInfo);
  }

  private static removePopup(id: string, type: AccuDrawPopupType): void {
    const index = AccuDrawPopupManager._popups.findIndex((info: AccuDrawPopupInfo) => id === info.id && type === info.type);

    if (index >= 0) {
      AccuDrawPopupManager._popups.splice(index, 1);
      AccuDrawPopupManager.emitPopupsChangedEvent();
    } else {
      Logger.logError(UiFramework.loggerCategory(this), `removePopup: Could not find popup with id of '${id}'`);
    }
  }

  private static hidePopup(id: string, type: AccuDrawPopupType): void {
    const popupInfo = AccuDrawPopupManager._popups.find((info: AccuDrawPopupInfo) => id === info.id && type === info.type);
    if (popupInfo) {
      popupInfo.isVisible = false;
      AccuDrawPopupManager.emitPopupsChangedEvent();
    } else {
      Logger.logError(UiFramework.loggerCategory(this), `hidePopup: Could not find popup with id of '${id}'`);
    }
  }

  public static get offset(): XAndY { return AccuDrawPopupManager._offset; }
  public static set offset(offset: XAndY) { AccuDrawPopupManager._offset = offset; }

  public static showMenuButton(id: string, el: HTMLElement, pt: XAndY, menuItemsProps: MenuItemProps[]): void {
    const menuItems = MenuItemHelpers.createMenuItems(menuItemsProps);
    const content = MenuItemHelpers.createMenuItemNodes(menuItems);

    const popupInfo = AccuDrawPopupManager._popups.find((info: AccuDrawPopupInfo) => id === info.id && AccuDrawPopupType.MenuButton === info.type);
    if (popupInfo) {
      popupInfo.el = el;
      popupInfo.pt = pt;
      popupInfo.isVisible = true;

      const menuButtonPopupInfo = popupInfo as MenuButtonPopupInfo;
      menuButtonPopupInfo.content = content;
    } else {
      const newPopupInfo: MenuButtonPopupInfo = {
        id, el, pt,
        isVisible: true,
        type: AccuDrawPopupType.MenuButton,
        offset: AccuDrawPopupManager._offset,
        content,
      };
      AccuDrawPopupManager.pushPopup(newPopupInfo);
    }

    AccuDrawPopupManager.emitPopupsChangedEvent();
  }

  public static hideMenuButton(id: string): void {
    AccuDrawPopupManager.hidePopup(id, AccuDrawPopupType.MenuButton);
  }

  public static removeMenuButton(id: string): void {
    AccuDrawPopupManager.removePopup(id, AccuDrawPopupType.MenuButton);
  }

  public static showCalculator(el: HTMLElement, pt: XAndY, initialValue: number, resultIcon: string, onOk: OnCommitFunc, onCancel: OnCancelFunc): void {
    const id = AccuDrawPopupManager._calculatorId;
    const popupInfo = AccuDrawPopupManager._popups.find((info: AccuDrawPopupInfo) => id === info.id && AccuDrawPopupType.Calculator === info.type);
    if (popupInfo) {
      popupInfo.el = el;
      popupInfo.pt = pt;
      popupInfo.isVisible = true;

      const calculatorPopupInfo = popupInfo as CalculatorPopupInfo;
      calculatorPopupInfo.initialValue = initialValue;
      calculatorPopupInfo.resultIcon = resultIcon;
      calculatorPopupInfo.onOk = onOk;
      calculatorPopupInfo.onCancel = onCancel;
    } else {
      const newPopupInfo: CalculatorPopupInfo = {
        id, el, pt,
        isVisible: true,
        type: AccuDrawPopupType.Calculator,
        offset: AccuDrawPopupManager._offset,
        initialValue, resultIcon, onOk, onCancel,
      };
      AccuDrawPopupManager.pushPopup(newPopupInfo);
    }

    AccuDrawPopupManager.emitPopupsChangedEvent();
  }

  public static hideCalculator(): void {
    AccuDrawPopupManager.hidePopup(AccuDrawPopupManager._calculatorId, AccuDrawPopupType.Calculator);
  }

  public static removeCalculator(): void {
    AccuDrawPopupManager.removePopup(AccuDrawPopupManager._calculatorId, AccuDrawPopupType.Calculator);
  }

  public static showAngleEditor(el: HTMLElement, pt: XAndY, value: number, onCommit: OnCommitFunc, onCancel: OnCancelFunc): void {
    const propertyDescription = new AngleDescription(undefined, undefined, `svg:${angleIcon}`);
    AccuDrawPopupManager.showInputEditor(el, pt, value, propertyDescription, onCommit, onCancel);
  }

  public static showLengthEditor(el: HTMLElement, pt: XAndY, value: number, onCommit: OnCommitFunc, onCancel: OnCancelFunc): void {
    const propertyDescription = new LengthDescription(undefined, undefined, `svg:${lengthIcon}`);
    AccuDrawPopupManager.showInputEditor(el, pt, value, propertyDescription, onCommit, onCancel);
  }

  public static showHeightEditor(el: HTMLElement, pt: XAndY, value: number, onCommit: OnCommitFunc, onCancel: OnCancelFunc): void {
    const propertyDescription = new LengthDescription(undefined, undefined, `svg:${heightIcon}`);
    AccuDrawPopupManager.showInputEditor(el, pt, value, propertyDescription, onCommit, onCancel);
  }

  public static showInputEditor(el: HTMLElement, pt: XAndY, value: number, propertyDescription: PropertyDescription, onCommit: OnCommitFunc, onCancel: OnCancelFunc): void {
    const primitiveValue: PrimitiveValue = {
      value,
      valueFormat: PropertyValueFormat.Primitive,
    };
    const record = new PropertyRecord(primitiveValue, propertyDescription);

    const id = AccuDrawPopupManager._editorId;
    let popupInfo = AccuDrawPopupManager._popups.find((info: AccuDrawPopupInfo) => id === info.id && AccuDrawPopupType.InputEditor === info.type);
    if (popupInfo) {
      popupInfo.el = el;
      popupInfo.pt = pt;
      popupInfo.isVisible = true;

      const inputEditorPopupInfo = popupInfo as InputEditorPopupInfo;
      inputEditorPopupInfo.record = record;
      inputEditorPopupInfo.onCancel = onCancel;
      inputEditorPopupInfo.commitHandler = new InputEditorCommitHandler(onCommit);
    } else {
      const newPopupInfo: InputEditorPopupInfo = {
        id, el, pt,
        isVisible: true,
        type: AccuDrawPopupType.InputEditor,
        offset: AccuDrawPopupManager._offset,
        record, onCancel,
        commitHandler: new InputEditorCommitHandler(onCommit),
      };
      AccuDrawPopupManager.pushPopup(newPopupInfo);
      popupInfo = newPopupInfo;
    }

    AccuDrawPopupManager.emitPopupsChangedEvent();
  }

  public static hideInputEditor(): void {
    AccuDrawPopupManager.hidePopup(AccuDrawPopupManager._editorId, AccuDrawPopupType.InputEditor);
  }

  public static removeInputEditor(): void {
    AccuDrawPopupManager.removePopup(AccuDrawPopupManager._editorId, AccuDrawPopupType.InputEditor);
  }
}

const DivWithOutsideClick = withOnOutsideClick((props) => (<div {...props} />)); // tslint:disable-line:variable-name

/** AccuDraw Popup Renderer
 * @alpha
 */
export class AccuDrawPopupRenderer extends React.Component<CommonProps> {

  public componentDidMount(): void {
    AccuDrawPopupManager.onAccuDrawPopupsChangedEvent.addListener(this._handleAccuDrawPopupsChangedEvent);
  }

  public componentWillUnmount(): void {
    AccuDrawPopupManager.onAccuDrawPopupsChangedEvent.removeListener(this._handleAccuDrawPopupsChangedEvent);
  }

  public render(): React.ReactNode {
    if (AccuDrawPopupManager.popupCount <= 0)
      return null;

    return (
      <>
        {this.renderMenuButtons()}
        {this.renderCalculator()}
        {this.renderInputEditor()}
      </>
    );
  }

  private _handleAccuDrawPopupsChangedEvent = (_args: any) => {
    this.forceUpdate();
  }

  private _handleSizeKnown(popupInfo: AccuDrawPopupInfo, size: SizeProps) {
    popupInfo.size = Size.create(size);
  }

  private renderMenuButtons(): React.ReactNode {
    const filteredInfo = AccuDrawPopupManager.popups.filter((popupInfo: AccuDrawPopupInfo) => {
      return popupInfo.type === AccuDrawPopupType.MenuButton && popupInfo.isVisible;
    });
    if (filteredInfo.length > 0) {
      const type = AccuDrawPopupType.MenuButton;

      const menuButtons = filteredInfo.map((popupInfo: AccuDrawPopupInfo) => {
        const menuButtonPopupInfo = popupInfo as MenuButtonPopupInfo;
        const point = this.getPopupPosition(popupInfo);

        return (
          <MenuButton key={popupInfo.id}
            point={point}
            onSizeKnown={(size: SizeProps) => this._handleSizeKnown(popupInfo, size)}
          >
            {menuButtonPopupInfo.content}
          </MenuButton>
        );
      });

      return (
        <React.Fragment key={type.toString()}>
          {menuButtons}
        </React.Fragment>
      );

    }

    return null;
  }

  private renderCalculator(): React.ReactNode {
    const type = AccuDrawPopupType.Calculator;
    const filteredInfo = AccuDrawPopupManager.popups.filter((popupInfo: AccuDrawPopupInfo) => {
      return popupInfo.type === type && popupInfo.isVisible;
    });

    if (filteredInfo.length === 1) {
      const popupInfo = filteredInfo[0];
      const calculatorPopupInfo = popupInfo as CalculatorPopupInfo;
      const point = this.getPopupPosition(popupInfo);

      return (
        <PositionPopup key={type.toString()}
          point={point}
          className="uifw-calculator-host"
          onSizeKnown={(size: SizeProps) => this._handleSizeKnown(popupInfo, size)}
        >
          <DivWithOutsideClick onOutsideClick={calculatorPopupInfo.onCancel}>
            <PositionPopupContent>
              <Calculator
                initialValue={calculatorPopupInfo.initialValue}
                resultIcon={<Icon iconSpec={calculatorPopupInfo.resultIcon} />}
                onOk={calculatorPopupInfo.onOk}
                onCancel={calculatorPopupInfo.onCancel} />
            </PositionPopupContent>
          </DivWithOutsideClick>
        </PositionPopup>
      );
    }

    return null;
  }

  private renderInputEditor(): React.ReactNode {
    const type = AccuDrawPopupType.InputEditor;
    const filteredInfo = AccuDrawPopupManager.popups.filter((popupInfo: AccuDrawPopupInfo) => {
      return popupInfo.type === type && popupInfo.isVisible;
    });

    if (filteredInfo.length === 1) {
      const popupInfo = filteredInfo[0];
      const inputEditorPopupInfo = popupInfo as InputEditorPopupInfo;
      const point = this.getPopupPosition(popupInfo);

      return (
        <PositionPopup key={type.toString()}
          point={point}
          onSizeKnown={(size: SizeProps) => this._handleSizeKnown(popupInfo, size)}
        >
          <DivWithOutsideClick onOutsideClick={inputEditorPopupInfo.onCancel}>
            <PositionPopupContent>
              <EditorContainer
                propertyRecord={inputEditorPopupInfo.record}
                onCommit={inputEditorPopupInfo.commitHandler.handleCommit}
                onCancel={inputEditorPopupInfo.onCancel}
                setFocus={true} />
            </PositionPopupContent>
          </DivWithOutsideClick>
        </PositionPopup>
      );
    }

    return null;
  }

  private getPopupPosition(info: AccuDrawPopupInfo): Point {
    const offset = info.offset;
    const size = (info.size !== undefined) ? info.size : new Size();
    const containerBounds = Rectangle.create(info.el.getBoundingClientRect());
    const relativeBounds = Rectangle.createFromSize(size).offset(info.pt);
    const adjustedPosition: Point = offsetAndContainInContainer(relativeBounds, containerBounds.getSize(), offset);
    const position = adjustedPosition.offset(containerBounds.topLeft());

    return position;
  }

}

/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Accudraw */

import * as React from "react";

import { Logger } from "@bentley/bentleyjs-core";
import { XAndY } from "@bentley/geometry-core";

import { Size, CommonProps, UiEvent, Rectangle, Point, SizeProps, withOnOutsideClick, IconInput } from "@bentley/ui-core";
import { offsetAndContainInContainer } from "@bentley/ui-ninezone";

import { UiFramework } from "../UiFramework";
import { MenuItemHelpers } from "../shared/MenuItem";
import { MenuItemProps } from "../shared/ItemProps";
import { Icon } from "../shared/IconComponent";
import { MenuButton } from "./MenuButton";
import { CalculatorOkFunc, CalculatorCancelFunc, Calculator } from "./Calculator";
import { PositionPopup, PositionPopupContent } from "./PositionPopup";
// import { EditorContainer } from "@bentley/ui-components";

/** Type of AccudrawUiManager Popup
 * @internal
 */
export enum AccudrawPopupType {
  MenuButton,
  InputEditor,
  Calculator,
}

/** Information maintained by AccudrawUiManager about a Popup
 * @internal
 */
export interface AccudrawPopupInfo {
  id: string;
  isVisible: boolean;
  el: HTMLElement;
  pt: XAndY;
  type: AccudrawPopupType;
  size?: Size;
}

/** @internal */
export interface MenuButtonPopupInfo extends AccudrawPopupInfo {
  content: React.ReactNode;
}

/** @internal */
export interface CalculatorPopupInfo extends AccudrawPopupInfo {
  resultIcon: string;
  onOk: CalculatorOkFunc;
  onCancel: CalculatorCancelFunc;
}

/** @internal */
export interface InputEditorPopupInfo extends AccudrawPopupInfo {
  iconSpec: string;
  onCommit: (value: number) => void;
  onCancel: () => void;
}

/** Accudraw Popups Changed Event class.
 * @internal
 */
export class AccudrawPopupsChangedEvent extends UiEvent<{}> { }

/** Accudraw Ui Manager
 *  @alpha
 */
export class AccudrawUiManager {
  private static _popups: AccudrawPopupInfo[] = new Array<AccudrawPopupInfo>();
  private static _calculatorId = "Calculator";
  private static _editorId = "InputEditor";

  /** @internal */
  public static readonly onAccudrawPopupsChangedEvent = new AccudrawPopupsChangedEvent();
  /** @internal */
  public static get popups() { return this._popups; }
  /** @internal */
  public static get popupCount() { return this._popups.length; }

  /** @internal */
  public static clearPopups() {
    this._popups.length = 0;
    AccudrawUiManager.emitPopupsChangedEvent();
  }

  private static emitPopupsChangedEvent(): void {
    AccudrawUiManager.onAccudrawPopupsChangedEvent.emit({});
  }

  private static pushPopup(popupInfo: AccudrawPopupInfo): void {
    AccudrawUiManager._popups.push(popupInfo);
  }

  private static removePopup(id: string, type: AccudrawPopupType): void {
    const index = AccudrawUiManager._popups.findIndex((info: AccudrawPopupInfo) => id === info.id && type === info.type);

    if (index >= 0) {
      AccudrawUiManager._popups.splice(index, 1);
      AccudrawUiManager.emitPopupsChangedEvent();
    } else {
      Logger.logError(UiFramework.loggerCategory(this), `removePopup: Could not find popup with id of '${id}'`);
    }
  }

  private static hidePopup(id: string, type: AccudrawPopupType): void {
    const popupInfo = AccudrawUiManager._popups.find((info: AccudrawPopupInfo) => id === info.id && type === info.type);
    if (popupInfo) {
      popupInfo.isVisible = false;
      AccudrawUiManager.emitPopupsChangedEvent();
    } else {
      Logger.logError(UiFramework.loggerCategory(this), `hidePopup: Could not find popup with id of '${id}'`);
    }
  }

  public static showMenuButton(id: string, el: HTMLElement, pt: XAndY, menuItemsProps: MenuItemProps[]): void {
    const menuItems = MenuItemHelpers.createMenuItems(menuItemsProps);
    const content = MenuItemHelpers.createMenuItemNodes(menuItems);

    const popupInfo = AccudrawUiManager._popups.find((info: AccudrawPopupInfo) => id === info.id && AccudrawPopupType.MenuButton === info.type);
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
        type: AccudrawPopupType.MenuButton,
        content,
      };
      AccudrawUiManager.pushPopup(newPopupInfo);
    }

    AccudrawUiManager.emitPopupsChangedEvent();
  }

  public static hideMenuButton(id: string): void {
    AccudrawUiManager.hidePopup(id, AccudrawPopupType.MenuButton);
  }

  public static removeMenuButton(id: string): void {
    AccudrawUiManager.removePopup(id, AccudrawPopupType.MenuButton);
  }

  public static showCalculator(el: HTMLElement, pt: XAndY, resultIcon: string, onOk: CalculatorOkFunc, onCancel: CalculatorCancelFunc): void {
    const id = AccudrawUiManager._calculatorId;
    const popupInfo = AccudrawUiManager._popups.find((info: AccudrawPopupInfo) => id === info.id && AccudrawPopupType.Calculator === info.type);
    if (popupInfo) {
      popupInfo.el = el;
      popupInfo.pt = pt;
      popupInfo.isVisible = true;

      const calculatorPopupInfo = popupInfo as CalculatorPopupInfo;
      calculatorPopupInfo.resultIcon = resultIcon;
      calculatorPopupInfo.onOk = onOk;
      calculatorPopupInfo.onCancel = onCancel;
    } else {
      const newPopupInfo: CalculatorPopupInfo = {
        id, el, pt,
        isVisible: true,
        type: AccudrawPopupType.Calculator,
        resultIcon, onOk, onCancel,
      };
      AccudrawUiManager.pushPopup(newPopupInfo);
    }

    AccudrawUiManager.emitPopupsChangedEvent();
  }

  public static hideCalculator(): void {
    AccudrawUiManager.hidePopup(AccudrawUiManager._calculatorId, AccudrawPopupType.Calculator);
  }

  public static removeCalculator(): void {
    AccudrawUiManager.removePopup(AccudrawUiManager._calculatorId, AccudrawPopupType.Calculator);
  }

  public static showInputEditor(el: HTMLElement, pt: XAndY, iconSpec: string, onCommit: (value: number) => void, onCancel: () => void): void {
    const id = AccudrawUiManager._editorId;
    const popupInfo = AccudrawUiManager._popups.find((info: AccudrawPopupInfo) => id === info.id && AccudrawPopupType.InputEditor === info.type);
    if (popupInfo) {
      popupInfo.el = el;
      popupInfo.pt = pt;
      popupInfo.isVisible = true;

      const inputEditorPopupInfo = popupInfo as InputEditorPopupInfo;
      inputEditorPopupInfo.iconSpec = iconSpec;
      inputEditorPopupInfo.onCommit = onCommit;
      inputEditorPopupInfo.onCancel = onCancel;
    } else {
      const newPopupInfo: InputEditorPopupInfo = {
        id, el, pt,
        isVisible: true,
        type: AccudrawPopupType.InputEditor,
        iconSpec, onCommit, onCancel,
      };
      AccudrawUiManager.pushPopup(newPopupInfo);
    }

    AccudrawUiManager.emitPopupsChangedEvent();
  }

  public static hideInputEditor(): void {
    AccudrawUiManager.hidePopup(AccudrawUiManager._editorId, AccudrawPopupType.InputEditor);
  }

  public static removeInputEditor(): void {
    AccudrawUiManager.removePopup(AccudrawUiManager._editorId, AccudrawPopupType.InputEditor);
  }
}

const DivWithOutsideClick = withOnOutsideClick((props) => (<div {...props} />)); // tslint:disable-line:variable-name

/** Accudraw Ui Renderer
 *  @alpha
 */
export class AccudrawUiRenderer extends React.Component<CommonProps> {

  public componentDidMount(): void {
    AccudrawUiManager.onAccudrawPopupsChangedEvent.addListener(this._handleAccudrawPopupsChangedEvent);
  }

  public componentWillUnmount(): void {
    AccudrawUiManager.onAccudrawPopupsChangedEvent.removeListener(this._handleAccudrawPopupsChangedEvent);
  }

  public render(): React.ReactNode {
    if (AccudrawUiManager.popupCount <= 0)
      return null;

    return (
      <>
        {this.renderMenuButtons()}
        {this.renderCalculator()}
        {this.renderInputEditor()}
      </>
    );
  }

  private _handleAccudrawPopupsChangedEvent = (_args: any) => {
    this.forceUpdate();
  }

  private _handleSizeKnown(popupInfo: AccudrawPopupInfo, size: SizeProps) {
    popupInfo.size = Size.create(size);
  }

  private renderMenuButtons(): React.ReactNode {
    const filteredInfo = AccudrawUiManager.popups.filter((popupInfo: AccudrawPopupInfo) => {
      return popupInfo.type === AccudrawPopupType.MenuButton && popupInfo.isVisible;
    });
    if (filteredInfo.length > 0) {
      const type = AccudrawPopupType.MenuButton;

      const menuButtons = filteredInfo.map((popupInfo: AccudrawPopupInfo) => {
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
    const type = AccudrawPopupType.Calculator;
    const filteredInfo = AccudrawUiManager.popups.filter((popupInfo: AccudrawPopupInfo) => {
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
    const type = AccudrawPopupType.InputEditor;
    const filteredInfo = AccudrawUiManager.popups.filter((popupInfo: AccudrawPopupInfo) => {
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
              <IconInput icon={<Icon iconSpec={inputEditorPopupInfo.iconSpec} />} />
            </PositionPopupContent>
          </DivWithOutsideClick>
        </PositionPopup>
      );
    }

    return null;
  }

  private getPopupPosition(info: AccudrawPopupInfo): Point {
    const offset = { x: 8, y: 8 };
    const size = (info.size !== undefined) ? info.size : new Size();
    const containerBounds = Rectangle.create(info.el.getBoundingClientRect());
    const relativeBounds = Rectangle.createFromSize(size).offset(info.pt);
    const adjustedPosition: Point = offsetAndContainInContainer(relativeBounds, containerBounds.getSize(), offset);
    const position = adjustedPosition.offset(containerBounds.topLeft());

    return position;
  }

}

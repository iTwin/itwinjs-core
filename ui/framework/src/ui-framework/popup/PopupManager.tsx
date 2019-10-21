/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as React from "react";

import { Logger } from "@bentley/bentleyjs-core";
import { XAndY } from "@bentley/geometry-core";
import {
  AbstractMenuItemProps, IconSpecUtilities,
  OnNumberCommitFunc, OnCancelFunc, OnItemExecutedFunc,
  AbstractToolbarProps, RelativePosition,
} from "@bentley/ui-abstract";
import { PrimitiveValue, PropertyValueFormat, PropertyRecord, PropertyDescription, AngleDescription, LengthDescription } from "@bentley/imodeljs-frontend";

import { Size, CommonProps, UiEvent, Rectangle, Point, SizeProps, Orientation } from "@bentley/ui-core";
import { offsetAndContainInContainer } from "@bentley/ui-ninezone";

import { UiFramework } from "../UiFramework";
import { MenuItemHelpers } from "../shared/MenuItem";
import { MenuButtonPopup } from "./MenuButtonPopup";
import { CalculatorPopup } from "./CalculatorPopup";
import { InputEditorPopup, InputEditorCommitHandler } from "./InputEditorPopup";

import angleIcon from "../accudraw/angle.svg";
import lengthIcon from "../accudraw/distance.svg";
import heightIcon from "../accudraw/height-2.svg";
import { ItemDefFactory } from "../shared/ItemDefFactory";
import { ToolbarPopup } from "./ToolbarPopup";

/** Information maintained by PopupManager about a Popup
 * @internal
 */
export class PopupInfo {
  constructor(public readonly id: string) { }
  public pt: XAndY = new Point();
  public component: React.ReactNode;
  public size?: Size;
}

/** Popups Changed Event class.
 * @internal
 */
export class PopupsChangedEvent extends UiEvent<{}> { }

/** Props for each popup managed by the PopupManager
 * @alpha
 */
export interface PopupPropsBase {
  id: string;
  el: HTMLElement;
  pt: XAndY;
  offset: XAndY;
  onSizeKnown: (size: SizeProps) => void;
  size?: Size;
}

/** Popup Manager class
 * @alpha
 */
export class PopupManager {
  private static _popups: PopupInfo[] = new Array<PopupInfo>();
  private static _calculatorId = "Calculator";
  private static _editorId = "InputEditor";
  private static _toolbarId = "Toolbar";
  private static _defaultOffset = { x: 8, y: 8 };

  /** @internal */
  public static readonly onPopupsChangedEvent = new PopupsChangedEvent();
  /** @internal */
  public static get popups() { return this._popups; }
  /** @internal */
  public static get popupCount() { return this._popups.length; }

  /** @internal */
  public static clearPopups() {
    this._popups.length = 0;
    PopupManager.emitPopupsChangedEvent();
  }

  private static emitPopupsChangedEvent(): void {
    PopupManager.onPopupsChangedEvent.emit({});
  }

  private static pushPopup(popupInfo: PopupInfo): void {
    PopupManager._popups.push(popupInfo);
  }

  private static removePopup(id: string): void {
    const index = PopupManager._popups.findIndex((info: PopupInfo) => id === info.id);

    if (index >= 0) {
      PopupManager._popups.splice(index, 1);
      PopupManager.emitPopupsChangedEvent();
    } else {
      Logger.logError(UiFramework.loggerCategory(this), `removePopup: Could not find popup with id of '${id}'`);
    }
  }

  private static _handlePopupSizeKnown(popupInfo: PopupInfo, size: SizeProps) {
    // istanbul ignore else
    if (!popupInfo.size || !popupInfo.size.equals(size)) {
      popupInfo.size = Size.create(size);
      PopupManager.emitPopupsChangedEvent();
    }
  }

  public static get defaultOffset(): XAndY { return PopupManager._defaultOffset; }
  public static set defaultOffset(offset: XAndY) { PopupManager._defaultOffset = offset; }

  public static showMenuButton(id: string, el: HTMLElement, pt: XAndY, menuItemsProps: AbstractMenuItemProps[]): void {
    let popupInfo = PopupManager._popups.find((info: PopupInfo) => id === info.id);
    if (!popupInfo) {
      popupInfo = new PopupInfo(id);
      PopupManager.pushPopup(popupInfo);
    }

    const menuItems = MenuItemHelpers.createMenuItems(menuItemsProps);
    const menuContent = MenuItemHelpers.createMenuItemNodes(menuItems);

    popupInfo.pt = pt;
    popupInfo.component = (
      <MenuButtonPopup id={id} el={el} pt={pt} offset={PopupManager.defaultOffset} size={popupInfo.size}
        onSizeKnown={(size: SizeProps) => PopupManager._handlePopupSizeKnown(popupInfo!, size)}
        content={menuContent} />
    );

    PopupManager.emitPopupsChangedEvent();
  }

  public static removeMenuButton(id: string): void {
    PopupManager.removePopup(id);
  }

  public static showCalculator(el: HTMLElement, pt: XAndY, initialValue: number, resultIcon: string, onOk: OnNumberCommitFunc, onCancel: OnCancelFunc): void {
    const id = PopupManager._calculatorId;

    let popupInfo = PopupManager._popups.find((info: PopupInfo) => id === info.id);
    if (!popupInfo) {
      popupInfo = new PopupInfo(id);
      PopupManager.pushPopup(popupInfo);
    }

    popupInfo.pt = pt;
    popupInfo.component = (
      <CalculatorPopup id={id} el={el} pt={pt} offset={PopupManager.defaultOffset} size={popupInfo.size}
        onSizeKnown={(size: SizeProps) => PopupManager._handlePopupSizeKnown(popupInfo!, size)}
        initialValue={initialValue} resultIcon={resultIcon} onOk={onOk} onCancel={onCancel} />
    );

    PopupManager.emitPopupsChangedEvent();
  }

  public static removeCalculator(): void {
    PopupManager.removePopup(PopupManager._calculatorId);
  }

  public static showAngleEditor(el: HTMLElement, pt: XAndY, value: number, onCommit: OnNumberCommitFunc, onCancel: OnCancelFunc): void {
    const propertyDescription = new AngleDescription(undefined, undefined, IconSpecUtilities.createSvgIconSpec(angleIcon));
    PopupManager.showInputEditor(el, pt, value, propertyDescription, onCommit, onCancel);
  }

  public static showLengthEditor(el: HTMLElement, pt: XAndY, value: number, onCommit: OnNumberCommitFunc, onCancel: OnCancelFunc): void {
    const propertyDescription = new LengthDescription(undefined, undefined, IconSpecUtilities.createSvgIconSpec(lengthIcon));
    PopupManager.showInputEditor(el, pt, value, propertyDescription, onCommit, onCancel);
  }

  public static showHeightEditor(el: HTMLElement, pt: XAndY, value: number, onCommit: OnNumberCommitFunc, onCancel: OnCancelFunc): void {
    const propertyDescription = new LengthDescription(undefined, undefined, IconSpecUtilities.createSvgIconSpec(heightIcon));
    PopupManager.showInputEditor(el, pt, value, propertyDescription, onCommit, onCancel);
  }

  public static showInputEditor(el: HTMLElement, pt: XAndY, value: number, propertyDescription: PropertyDescription, onCommit: OnNumberCommitFunc, onCancel: OnCancelFunc): void {
    const primitiveValue: PrimitiveValue = {
      value,
      valueFormat: PropertyValueFormat.Primitive,
    };
    const record = new PropertyRecord(primitiveValue, propertyDescription);
    const commitHandler = new InputEditorCommitHandler(onCommit);

    const id = PopupManager._editorId;
    let popupInfo = PopupManager._popups.find((info: PopupInfo) => id === info.id);
    if (!popupInfo) {
      popupInfo = new PopupInfo(id);
      PopupManager.pushPopup(popupInfo);
    }

    popupInfo.pt = pt;
    popupInfo.component = <InputEditorPopup id={id} el={el} pt={pt} offset={PopupManager.defaultOffset} size={popupInfo.size}
      onSizeKnown={(size: SizeProps) => PopupManager._handlePopupSizeKnown(popupInfo!, size)}
      record={record} onCancel={onCancel} commitHandler={commitHandler} />;

    PopupManager.emitPopupsChangedEvent();
  }

  public static removeInputEditor(): void {
    PopupManager.removePopup(PopupManager._editorId);
  }

  public static showToolbar(
    toolbarProps: AbstractToolbarProps, el: HTMLElement, pt: XAndY, offset: XAndY,
    onItemExecuted: OnItemExecutedFunc, onCancel: OnCancelFunc, relativePosition: RelativePosition,
  ): void {

    const toolbarItems = ItemDefFactory.createItemListForToolbar(toolbarProps.items, onItemExecuted);
    const id = PopupManager._toolbarId;

    let popupInfo = PopupManager._popups.find((info: PopupInfo) => id === info.id);
    if (!popupInfo) {
      popupInfo = new PopupInfo(id);
      PopupManager.pushPopup(popupInfo);
    }

    popupInfo.pt = pt;
    popupInfo.component = (
      <ToolbarPopup id={id} el={el} pt={pt} offset={offset} size={popupInfo.size}
        onSizeKnown={(size: SizeProps) => PopupManager._handlePopupSizeKnown(popupInfo!, size)}
        items={toolbarItems} relativePosition={relativePosition} orientation={Orientation.Horizontal} onCancel={onCancel} />
    );

    PopupManager.emitPopupsChangedEvent();
  }

  public static removeToolbar(): void {
    PopupManager.removePopup(PopupManager._toolbarId);
  }

  public static getPopupPosition(el: HTMLElement, pt: XAndY, offset: XAndY, size?: Size): Point {
    size = (size !== undefined) ? size : new Size();
    const containerBounds = Rectangle.create(el.getBoundingClientRect());
    const relativeBounds = Rectangle.createFromSize(size).offset(pt);
    const adjustedPosition: Point = offsetAndContainInContainer(relativeBounds, containerBounds.getSize(), offset);
    const position = adjustedPosition.offset(containerBounds.topLeft());

    return position;
  }

}

/**  Popup Renderer
 * @alpha
 */
export class PopupRenderer extends React.Component<CommonProps> {

  public componentDidMount(): void {
    PopupManager.onPopupsChangedEvent.addListener(this._handlePopupsChangedEvent);
  }

  public componentWillUnmount(): void {
    PopupManager.onPopupsChangedEvent.removeListener(this._handlePopupsChangedEvent);
  }

  public render(): React.ReactNode {
    if (PopupManager.popupCount <= 0)
      return null;

    return (
      <>
        {
          PopupManager.popups.map((popupInfo: PopupInfo) => {
            return (
              <React.Fragment key={popupInfo.id}>
                {popupInfo.component}
              </React.Fragment>
            );
          })
        }
      </>
    );
  }

  private _handlePopupsChangedEvent = (_args: any) => {
    this.forceUpdate();
  }

}

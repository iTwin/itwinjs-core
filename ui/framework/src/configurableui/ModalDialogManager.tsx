/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Dialog */

import * as React from "react";

import { UiEvent } from "@bentley/ui-core";

/** Modal Dialog Stack Changed Event Args class.
 */
export interface ModalDialogChangedEventArgs {
  modalDialogCount: number;
  activeModalDialog: React.ReactNode | undefined;
}

/** Modal Dialog Changed Event class.
 */
export class ModalDialogChangedEvent extends UiEvent<ModalDialogChangedEventArgs> { }

/** Modal Dialog Manager class.
 */
export class ModalDialogManager {
  private static _modalDialogs: React.ReactNode[] = new Array<React.ReactNode>();
  private static _modalDialogStackChangedEvent: ModalDialogChangedEvent = new ModalDialogChangedEvent();

  public static get onModalDialogChangedEvent(): ModalDialogChangedEvent { return this._modalDialogStackChangedEvent; }

  public static get modalDialogs(): Readonly<React.ReactNode[]> { return this._modalDialogs; }

  public static openModalDialog(modalDialog: React.ReactNode): void {
    this.pushModalDialog(modalDialog);
  }

  private static pushModalDialog(modalDialog: React.ReactNode): void {
    this._modalDialogs.push(modalDialog);
    this.emitModalDialogChangedEvent();
  }

  public static closeModalDialog(): void {
    this.popModalDialog();
  }

  private static popModalDialog(): void {
    this._modalDialogs.pop();
    this.emitModalDialogChangedEvent();
  }

  private static emitModalDialogChangedEvent(): void {
    this.onModalDialogChangedEvent.emit({ modalDialogCount: this.modalDialogCount, activeModalDialog: this.activeModalDialog });
  }

  public static updateModalDialog(): void {
    this.emitModalDialogChangedEvent();
  }

  public static get activeModalDialog(): React.ReactNode | undefined {
    if (this._modalDialogs.length > 0)
      return this._modalDialogs[this._modalDialogs.length - 1];

    return undefined;
  }

  public static get modalDialogCount(): number {
    return this._modalDialogs.length;
  }

}

/** Props for the ModalDialogRenderer component.
 */
export interface ModalDialogRendererProps {
  className?: string;
  style?: React.CSSProperties;
}

/** State for the ModalDialogRenderer component.
 */
export interface ModalDialogRendererState {
  modalDialogCount: number;
}

/** ModalDialogRenderer React component.
 */
export class ModalDialogRenderer extends React.Component<ModalDialogRendererProps, ModalDialogRendererState> {

  public render(): React.ReactNode {
    const activeModalDialog: React.ReactNode | undefined = ModalDialogManager.activeModalDialog;
    if (!activeModalDialog)
      return null;

    return (
      <>
        {
          ModalDialogManager.modalDialogs.map((node: React.ReactNode, index: number) => {
            return (
              <div key={index.toString()}>
                {node}
              </div>
            );
          })
        }
      </>
    );
  }

  public componentDidMount(): void {
    ModalDialogManager.onModalDialogChangedEvent.addListener(this._handleModalDialogChangedEvent);
  }

  public componentWillUnmount(): void {
    ModalDialogManager.onModalDialogChangedEvent.removeListener(this._handleModalDialogChangedEvent);
  }

  private _handleModalDialogChangedEvent = (_args: ModalDialogChangedEventArgs) => {
    this.setState((_prevState) => {
      return {
        modalDialogCount: ModalDialogManager.modalDialogCount,
      };
    });
  }

}

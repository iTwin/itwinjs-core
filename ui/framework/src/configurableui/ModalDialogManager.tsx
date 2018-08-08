/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Dialog */

import * as React from "react";

import { UiEvent } from "@bentley/ui-core";

/** Modal Dialog Stack Changed Event Args class.
 */
export interface ModalDialogStackChangedEventArgs {
  modalDialogStackDepth: number;
}

/** Modal Dialog Stack Changed Event class.
 */
export class ModalDialogStackChangedEvent extends UiEvent<ModalDialogStackChangedEventArgs> { }

/** Modal Dialog Manager class.
 */
export class ModalDialogManager {
  private static _modalDialogs: React.ReactNode[] = new Array<React.ReactNode>();
  private static _modalDialogStackChangedEvent: ModalDialogStackChangedEvent = new ModalDialogStackChangedEvent();

  public static get ModalDialogStackChangedEvent(): ModalDialogStackChangedEvent { return this._modalDialogStackChangedEvent; }

  public static get modalDialogs(): Readonly<React.ReactNode[]> { return this._modalDialogs; }

  public static openModalDialog(modalDialog: React.ReactNode): void {
    this.pushModalDialog(modalDialog);
  }

  private static pushModalDialog(modalDialog: React.ReactNode): void {
    this._modalDialogs.push(modalDialog);
    this.emitModalDialogStackChangedEvent();
  }

  public static closeModalDialog(): void {
    this.popModalDialog();
  }

  private static popModalDialog(): void {
    this._modalDialogs.pop();
    this.emitModalDialogStackChangedEvent();
  }

  private static emitModalDialogStackChangedEvent(): void {
    this.ModalDialogStackChangedEvent.emit({ modalDialogStackDepth: this.ModalDialogStackDepth });
  }

  public static updateModalDialog(): void {
    this.emitModalDialogStackChangedEvent();
  }

  public static get activeModalDialog(): React.ReactNode | undefined {
    if (this._modalDialogs.length > 0)
      return this._modalDialogs[this._modalDialogs.length - 1];

    return undefined;
  }

  public static get ModalDialogStackDepth(): number {
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
  modalDialogStackDepth: number;
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
    ModalDialogManager.ModalDialogStackChangedEvent.addListener(this.handleModalDialogStackChangedEvent);
  }

  public componentWillUnmount(): void {
    ModalDialogManager.ModalDialogStackChangedEvent.removeListener(this.handleModalDialogStackChangedEvent);
  }

  private handleModalDialogStackChangedEvent = (_args: ModalDialogStackChangedEventArgs) => {
    this.setState((_prevState) => {
      return {
        modalDialogStackDepth: ModalDialogManager.ModalDialogStackDepth,
      };
    });
  }

}

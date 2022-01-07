/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Dialog
 */

import * as React from "react";
import { Dialog, DialogProps } from "@itwin/core-react";
import { ContentDialogManager } from "./ContentDialogManager";

/** Properties for the [[ContentDialog]] component
 * @public
 */
export interface ContentDialogProps extends DialogProps {
  dialogId: string;
  movable?: boolean;
}

/** Content Dialog React component uses the Dialog component with a modal={false} prop.
 * It controls the z-index to keep the focused dialog above content but below widgets.
 * @public
 */
export class ContentDialog extends React.Component<ContentDialogProps> {
  constructor(props: ContentDialogProps) {
    super(props);
  }

  public override render(): JSX.Element {
    const { dialogId, style, modal, modelessId, onModelessPointerDown, ...props } = this.props; // eslint-disable-line @typescript-eslint/no-unused-vars

    return (
      <Dialog
        resizable={true}
        movable={true}
        trapFocus={false}
        modal={false}
        {...props}
        modelessId={dialogId}
        onModelessPointerDown={(event) => ContentDialogManager.handlePointerDownEvent(event, dialogId, this._updateDialog)}
        style={{ zIndex: ContentDialogManager.getDialogZIndex(dialogId), ...style }}
      >
        {this.props.children}
      </Dialog >
    );
  }

  private _updateDialog = () => {
    this.forceUpdate();
  };
}

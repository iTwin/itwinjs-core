/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ConfigurableUi */

import * as React from "react";
import { UiEvent } from "@bentley/ui-core";
import Tooltip from "@bentley/ui-ninezone/lib/widget/tool-settings/Tooltip";

/** ElementTooltip State.
 */
export interface ElementTooltipState {
  isTooltipVisible: boolean;
  message: string;
}

/** ElementTooltip Changed Event class.
 */
export class ElementTooltipChangedEvent extends UiEvent<ElementTooltipState> { }

/** ElementTooltip React component.
 */
export class ElementTooltip extends React.Component<{}, ElementTooltipState> {
  private static _elementTooltipChangedEvent: ElementTooltipChangedEvent = new ElementTooltipChangedEvent();
  private static _isTooltipVisible: boolean;

  public static get ElementTooltipChangedEvent(): ElementTooltipChangedEvent { return ElementTooltip._elementTooltipChangedEvent; }
  public static get isTooltipVisible(): boolean { return ElementTooltip._isTooltipVisible; }

  public static showTooltip(message: string): void {
    ElementTooltip._isTooltipVisible = true;
    ElementTooltip.ElementTooltipChangedEvent.emit({ isTooltipVisible: true, message });
  }

  public static hideTooltip(): void {
    ElementTooltip._isTooltipVisible = false;
    ElementTooltip.ElementTooltipChangedEvent.emit({ isTooltipVisible: false, message: "" });
  }

  /** hidden */
  public readonly state: Readonly<ElementTooltipState> = {
    message: "",
    isTooltipVisible: false,
  };

  public render() {
    return (
      <Tooltip
        isVisible={this.state.isTooltipVisible}
      >
        {this.state.message &&
          <div dangerouslySetInnerHTML={{ __html: this.state.message }} />
        }
      </Tooltip>
    );
  }

  public componentDidMount(): void {
    ElementTooltip.ElementTooltipChangedEvent.addListener(this.handleElementTooltipChangedEvent);
  }

  public componentWillUnmount(): void {
    ElementTooltip.ElementTooltipChangedEvent.removeListener(this.handleElementTooltipChangedEvent);
  }

  private handleElementTooltipChangedEvent = (args: ElementTooltipState) => {
    this.setState(() => ({
      message: args.message,
      isTooltipVisible: args.isTooltipVisible,
    }));
  }

}

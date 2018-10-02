/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import {
  ConfigurableUIManager,
  WidgetControl,
  ConfigurableCreateInfo,
  MessageManager,
  InputFieldMessageEventArgs,
} from "@bentley/ui-framework";
import { ValidationTextbox, InputStatus } from "@bentley/ui-framework/lib/feedback/ValidationTextbox";
import InputFieldMessage from "@bentley/ui-framework/lib/messages/InputField";

/** Feedback Demo Widget */
export class FeedbackDemoWidget extends WidgetControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = <FeedbackWidget />;
  }
}

export interface FeedbackWidgetState {
  /** The closest parent of the invalid input */
  inputMessageParent: Element;
  /** The text to display in an error message */
  inputMessageText: string;
  /** Flag for displaying inputFieldMessage */
  isInputFieldMessageVisible: boolean;
}

/**
 * Sample widget component that contains feedback components
 * (ValidationTextbox, InputFieldMessage, PointerMessage)
 */
export class FeedbackWidget extends React.Component<any, FeedbackWidgetState> {
  /** hidden */
  public readonly state: Readonly<FeedbackWidgetState> = {
    inputMessageParent: document.getElementById("root") as Element,
    inputMessageText: "",
    isInputFieldMessageVisible: false,
  };

  public render() {
    return (
      <div>
        <table>
          <tbody>
            <tr>
              <th>Name</th>
              <th>Value</th>
            </tr>
            <tr>
              <td>No empty strings:</td>
              <td>
                {/* Defaults to check for empty value */}
                <ValidationTextbox
                  errorText="Cannot be blank"
                />
              </td>
            </tr>
            <tr>
              <td>No numbers:</td>
              <td>
                {/* Invalid if value provided is a number */}
                <ValidationTextbox
                  errorText="Cannot be blank or a number"
                  onValueChanged={(value: string) => {
                    if (!value || Number(value))
                      return InputStatus.Invalid;
                    return InputStatus.Valid;
                  }
                  }
                />
              </td>
            </tr>
          </tbody>
        </table>
        {
          (this.state.isInputFieldMessageVisible) ?
            // The InputFieldMessage class is displayed via a portal, so this element
            // will render under the provided parent rather than under the <table>
            <InputFieldMessage
              target={
                this.state.inputMessageParent
              }
              children={
                this.state.inputMessageText
              }
              onClose={
                () => {
                  this.setState((_prevState) => ({
                    isInputFieldMessageVisible: false,
                  }));
                }
              }
            /> :
            <div />
        }
      </div>
    );
  }

  /** Registers listeners for managing InputFieldMessage */
  public componentDidMount() {
    MessageManager.onInputFieldMessageAddedEvent.addListener(this._handleInputFieldMessageAddedEvent);
    MessageManager.onInputFieldMessageRemovedEvent.addListener(this._handleInputFieldMessageRemovedEvent);
  }

  /** Removes listeners for managing InputFieldMessage */
  public componentWillUnmount() {
    MessageManager.onInputFieldMessageAddedEvent.removeListener(this._handleInputFieldMessageAddedEvent);
    MessageManager.onInputFieldMessageRemovedEvent.removeListener(this._handleInputFieldMessageRemovedEvent);
  }

  /**
   * Shows InputFieldMessage and updates inputMessageText with text provided by target element.
   * @param args    Information about the InputFieldMessage to display
   */
  private _handleInputFieldMessageAddedEvent = (args: InputFieldMessageEventArgs) => {
    this.setState((_prevState) => ({
      inputMessageParent: args.target.closest("td") as Element,
      inputMessageText: args.messageText,
      isInputFieldMessageVisible: true,
    }));
  }

  /**
   * Hides InputFieldMessage
   */
  private _handleInputFieldMessageRemovedEvent = () => {
    this.setState((_prevState) => ({
      isInputFieldMessageVisible: false,
    }));
  }
}

ConfigurableUIManager.registerControl("FeedbackWidget", FeedbackDemoWidget);

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { createComboBox } from "./ComboBox";
import { createLabel } from "./Label";
import { createDiv } from "./Div";

/**
 * This class creates and inserts generic HTML Elements into a Widget Container and processes registered callbacks.
 */
export class GenericWidget {
  private _animalType = "Dog";

  private _handleSelection = (select: HTMLSelectElement) => {
    this._animalType = select.value;
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, `${this._animalType} Selected`,
      `Your favorite animal is a ${this._animalType}`));
  };

  /** Create and attach Elements to the widget container div that was provided. */
  public attachToDom = (container: HTMLElement) => {
    const parentDiv = createDiv({ parent: container, className: "generic-widget-container" });
    parentDiv.style.display = "flex";
    parentDiv.style.flexDirection = "column";
    parentDiv.style.padding = "6px";

    const label = createLabel({
      label: "Your favorite animal:",
      forId: "Animal_Type",
      parent: parentDiv,
      className: "iui-label iui-small",
    });
    parentDiv.appendChild(label);

    const selectInput = createComboBox({
      parent: parentDiv,
      id: "Animal_Type",
      handler: this._handleSelection,
      className: "iui-input iui-small",
      entries: [
        { name: "Dog", value: "Dog" },
        { name: "Cat", value: "Cat" },
        { name: "Mouse", value: "Mouse" },
        { name: "Elephant", value: "Elephant" },
      ],
      value: this._animalType,
    });
    parentDiv.appendChild(selectInput);
    container.appendChild(parentDiv);
  };
}

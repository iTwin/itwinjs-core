/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// import { IModelApp } from "@bentley/imodeljs-frontend";
import { Dialog, Form, FieldDefinitions, FieldValues } from "@bentley/ui-core";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority } from "@bentley/imodeljs-frontend";
import { ModalDialogManager } from "@bentley/ui-framework";
import * as React from "react";

export class ExampleForm extends React.Component {
  private _title = "Example Form"; // IModelApp.i18n.translate("RiskManagementPlugin:config.title");
  private _siteUrlLabel = "Enter Site"; // IModelApp.i18n.translate("RiskManagementPlugin:config.siteUrl");
  private _nameLabel = "Specify List Name"; // IModelApp.i18n.translate("RiskManagementPlugin:config.Name");
  private _notesLabel = "Notes";
  private _lockLabel = "Lock";
  private _pickListLabel = "Picker";

  public static open() {
    const form = new ExampleForm({});
    ModalDialogManager.openDialog(form.render());
  }

  protected async handleSubmit(values: FieldValues): Promise<void> {
    await this.processFormSubmission(values);
    ModalDialogManager.closeDialog();
    const msg = JSON.stringify(values);
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "Form Submitted", msg));
  }

  protected async processFormSubmission(values: FieldValues): Promise<void> {
    if (!values) {
      throw new Error("No values are available");
    }
    const keys = Object.keys(values);
    if (keys.find((value: string) => value === "SiteUrl")) {
      // for testing just ensure url string has text
      const urlString = values.SiteUrl as string;
      if (urlString.length) {
        return;
      }
    }
    throw new Error("SiteUrl value is not defined"); // Error message will be displayed to user.
  }

  protected handleCancel() {
    ModalDialogManager.closeDialog();
  }

  public render() {
    const fields: FieldDefinitions = {
      SiteUrl: {
        label: this._siteUrlLabel,
        editor: "textbox",
        value: "",
      },
      Name: {
        label: this._nameLabel,
        editor: "textbox",
        value: "John Smith",
      },
      Notes: {
        label: this._notesLabel,
        editor: "multilinetextbox",
        value: "",

      },
      Lock: {
        label: this._lockLabel,
        editor: "checkbox",  // value for "checkbox" should be a boolean
        value: true,
      },
      PickList: {
        label: this._pickListLabel,
        editor: "dropdown",
        value: "one",
        options: ["one", "two", "three", "four"],
      },
    };

    return (
      <div>
        <Dialog title={this._title}
          opened={true}
          onClose={() => this.handleCancel()}>
          <Form handleFormSubmit={(values: FieldValues) => this.handleSubmit(values)}
            fields={fields}
          />
        </Dialog>
      </div >
    );
  }
}

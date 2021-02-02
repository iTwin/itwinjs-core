# Form

A [Form]($ui-core) React component is used to collect data from the user and submit the collected data to an async processing method.
The Form component supports one ore more fields that implement the [FieldDef]($ui-core) interface.
The [FieldDefinitions]($ui-core) interface contains key/value pairs for all the field definitions to be displayed in a Form.

## Form Properties

The Form properties, as defined in [FormProps]($ui-core), include
`handleFormSubmit`, which is the callback to be called when the Submit button is pressed,
and `fields`, which are the definitions used to create each Field in the Form.

## Example

```tsx
import { Dialog, Form, FieldDefinitions, FieldValues } from "@bentley/ui-core";

// Example of using a Form as contents of a modal dialog.
export class ExampleForm extends React.Component {

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
    // if error occurs during async processing throw an Error and return error message back to form.
    throw new Error("Error processing form");
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
        <Dialog title="Example Form"
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

```

![form](./images/Form.png "Form with Fields")

## API Reference

- [Form]($ui-core:Form)

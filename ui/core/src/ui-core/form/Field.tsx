/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Form
 */

import * as React from "react";
import { Checkbox, Input, Textarea } from "@itwin/itwinui-react";
import { FieldDef, FormContext, FormContextState } from "./Form";
import { Select } from "../select/Select";

// cSpell:ignore multilinetextbox

/** Properties used to create a [[Field]] in a [[Form]]
 * @beta
 */
export interface FieldProps extends FieldDef {
  /* The unique field name */
  id: string;
}

// type FieldDefOptions = FieldDef["options"];

/** Component that represents a single field in an input form. Only four type of editors are supported. Field gets/sets state data from/to the context control by the form.
 * @beta
 */
export class Field extends React.Component<FieldProps> {
  constructor(props: FieldProps) {
    super(props);
  }

  // NEEDSWORK: Can change to iTwinUI-react Select component once the `id` prop is supported
  // private _generateSelectOptions = (propOptions: FieldDefOptions): SelectOption<string>[] => {
  //   const selectOptions: SelectOption<string>[] = [];
  //   if (propOptions instanceof Array) {
  //     propOptions.map((option: string) => (
  //       { value: option, label: option }
  //     ));
  //   } else if (propOptions !== undefined) {
  //     Object.keys(propOptions).map((key) => (
  //       { value: key, label: propOptions[key] }
  //     ));
  //   }

  //   return selectOptions;
  // };

  public render() {
    // NEEDSWORK: Can change to iTwinUI-react Select component once the `id` prop is supported
    // const selectOptions = this._generateSelectOptions(this.props.options);

    return (
      <FormContext.Consumer>
        {(context: FormContextState | undefined) => (
          <div className="core-form-group">
            {this.props.editor!.toLowerCase() !== "checkbox" && this.props.label && <label className="core-form-label" htmlFor={this.props.id}>{this.props.label}</label>}

            {this.props.editor!.toLowerCase() === "textbox" && (
              <Input
                id={this.props.id}
                value={context!.values[this.props.id]}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => context!.setValues({ [this.props.id]: event.currentTarget.value })}
                className="core-form-input"
              />
            )}
            {this.props.editor!.toLowerCase() === "checkbox" && (
              <Checkbox
                label={this.props.label}
                id={this.props.id}
                checked={context!.values[this.props.id]}
                onChange={() => context!.setValues({ [this.props.id]: !context!.values[this.props.id] })}
              />
            )}
            {this.props.editor!.toLowerCase() === "multilinetextbox" && (
              <Textarea
                id={this.props.id}
                value={context!.values[this.props.id]}
                onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => context!.setValues({ [this.props.id]: event.currentTarget.value })}
                className="core-form-textarea"
              />
            )}
            {this.props.editor!.toLowerCase() === "dropdown" && this.props.options && (
              // NEEDSWORK: Can change to iTwinUI-react Select component once the `id` prop is supported
              // eslint-disable-next-line deprecation/deprecation
              <Select
                id={this.props.id}
                name={this.props.id}
                value={context!.values[this.props.id]}
                onChange={(event) => context!.setValues({ [this.props.id]: event.currentTarget.value })}
                options={this.props.options}
                // onChange={(newValue: any) => context!.setValues({ [this.props.id]: newValue })}
                // options={selectOptions}
                className="core-form-select"
              />
            )}
          </div>
        )}
      </FormContext.Consumer>
    );
  }
}

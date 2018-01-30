/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { ElementState } from "./EntityState";
import { IModel } from "./IModel";
import { ModelSelectorProps } from "./ElementProps";

/** A list of GeometricModels for a SpatialViewDefinition. */
export class ModelSelectorState extends ElementState {
  public readonly models: Set<string> = new Set<string>();
  constructor(props: ModelSelectorProps, iModel: IModel) {
    super(props, iModel);
    if (props.models)
      props.models.forEach((model) => this.models.add(model));
  }

  /** Get the name of this ModelSelector */
  public getName(): string { return this.code.getValue(); }

  public toJSON(): ModelSelectorProps {
    const val: any = super.toJSON();
    val.models = [];
    this.models.forEach((model) => val.models.push(model));
    return val;
  }

  public addModel(id: Id64) { this.models.add(id.value); }
  public dropModel(id: Id64): boolean { return this.models.delete(id.value); }
  public containsModel(modelId: Id64): boolean { return this.models.has(modelId.value); }
}

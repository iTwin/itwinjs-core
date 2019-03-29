/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@bentley/bentleyjs-core";
import { CalloutProps, ElementProps, GeometricElement2dProps, GeometricElement3dProps, IModel, InformationPartitionElementProps, ModelProps, ViewAttachmentLabelProps } from "@bentley/imodeljs-common";
import { GraphicalElement2d, GraphicalElement3d, GroupInformationElement, GroupInformationPartition, PhysicalElement, SpatialLocationElement } from "../Element";
import { IModelDb } from "../IModelDb";
import { GroupInformationModel } from "../Model";
import { SubjectOwnsPartitionElements } from "../NavigationRelationship";

/** @public */
export abstract class DetailingSymbol extends GraphicalElement2d {
  public constructor(props: GeometricElement2dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export class TitleText extends DetailingSymbol {
  public constructor(props: GeometricElement2dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export class ViewAttachmentLabel extends DetailingSymbol implements ViewAttachmentLabelProps {
  public constructor(props: ViewAttachmentLabelProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export abstract class Callout extends DetailingSymbol implements CalloutProps {
  public constructor(props: CalloutProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export class SectionCallout extends Callout {
  public constructor(props: CalloutProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export class ElevationCallout extends Callout {
  public constructor(props: CalloutProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export class PlanCallout extends Callout {
  public constructor(props: CalloutProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export class DetailCallout extends Callout {
  public constructor(props: CalloutProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export class Graphic3d extends GraphicalElement3d {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export class PhysicalObject extends PhysicalElement {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export class SpatialLocation extends SpatialLocationElement {
  public constructor(props: GeometricElement3dProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/** @public */
export class GroupModel extends GroupInformationModel {
  public constructor(props: ModelProps, iModel: IModelDb) {
    super(props, iModel);
  }
  /** Insert a GroupInformationPartition and a GroupModel that breaks it down.
   * @param iModelDb Insert into this iModel
   * @param parentSubjectId The GroupInformationPartition will be inserted as a child of this Subject element.
   * @param name The name of the GroupInformationPartition that the new GroupModel will break down.
   * @returns The Id of the newly inserted GroupModel.
   * @throws [[IModelError]] if there is an insert problem.
   */
  public static insert(iModelDb: IModelDb, parentSubjectId: Id64String, name: string): Id64String {
    const partitionProps: InformationPartitionElementProps = {
      classFullName: GroupInformationPartition.classFullName,
      model: IModel.repositoryModelId,
      parent: new SubjectOwnsPartitionElements(parentSubjectId),
      code: GroupInformationPartition.createCode(iModelDb, parentSubjectId, name),
    };
    const partitionId = iModelDb.elements.insertElement(partitionProps);
    return iModelDb.models.insertModel({
      classFullName: this.classFullName,
      modeledElement: { id: partitionId },
    });
  }
}

/** @public */
export class Group extends GroupInformationElement {
  public constructor(props: ElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

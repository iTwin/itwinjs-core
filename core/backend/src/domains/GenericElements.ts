/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { CalloutProps, GeometricElement2dProps, GeometricElement3dProps, ModelProps, ElementProps, ViewAttachmentLabelProps } from "@bentley/imodeljs-common";
import { GraphicalElement2d, GraphicalElement3d, GroupInformationElement, PhysicalElement, SpatialLocationElement } from "../Element";
import { IModelDb } from "../IModelDb";
import { GroupInformationModel } from "../Model";

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
}

/** @public */
export class Group extends GroupInformationElement {
  public constructor(props: ElementProps, iModel: IModelDb) {
    super(props, iModel);
  }
}

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AngleProps, XYProps, XYZProps } from "@itwin/core-geometry";
import { ElementProps, GeometricElementProps, RelatedElementProps, SubCategoryProps } from "./ElementProps";
import { SpatialViewDefinitionProps, ViewDefinition2dProps, ViewDefinition3dProps, ViewDefinitionProps } from "./ViewProps";

type NativeInterfaceMapping =
| [NativeElementProps, ElementProps]
| [NativeViewDefinitionProps, ViewDefinitionProps]
| [NativeViewDefinition2dProps, ViewDefinition2dProps]
| [NativeViewDefinition3dProps, ViewDefinition3dProps]
| [NativeSpatialViewDefinitionProps, SpatialViewDefinitionProps]
| [NativeGeometricElementProps, GeometricElementProps]
| [NativeSubCategoryProps, SubCategoryProps];

export type NativeInterfaceMap<T> = Extract<NativeInterfaceMapping, [unknown, T]>[0];

type NativeElementProps = Omit<ElementProps, "model" | "code" | "classFullName" | "jsonProperties"> & {
  model: RelatedElementProps;
  className: string;
  codeValue?: string;
  codeSpec: RelatedElementProps;
  codeScope: RelatedElementProps;
  jsonProperties?: string;
};
type NativeViewDefinitionProps = NativeElementProps & Pick<ViewDefinitionProps, "isPrivate" | "description" | "jsonProperties"> & {
  categorySelector: RelatedElementProps;
  displayStyle: RelatedElementProps;
};
type NativeViewDefinition2dProps = NativeViewDefinitionProps & Pick<ViewDefinition2dProps, "origin" | "delta" | "angle"> & {
  baseModel: RelatedElementProps;
};
type NativeViewDefinition3dProps = NativeViewDefinitionProps & Pick<ViewDefinition3dProps, "jsonProperties" | "cameraOn" | "camera" | "angles" | "origin" | "extents">;
type NativeSpatialViewDefinitionProps = NativeViewDefinition3dProps & {
  modelSelector: RelatedElementProps;
};
type NativeGeometricElementProps = NativeElementProps & {
  category: RelatedElementProps;
} & (
  { origin: XYProps, bBoxLow: XYProps, bBoxHigh?: XYProps, rotation: AngleProps } |
  { origin: XYZProps, bBoxLow: XYZProps, bBoxHigh?: XYZProps, yaw?: AngleProps, pitch?: AngleProps, roll?: AngleProps }
);
type NativeSubCategoryProps = NativeElementProps & Pick<SubCategoryProps, "isPrivate" | "description"> & {
  properties?: string;
};

function mapRelatedElementProps(props: RelatedElementProps): RelatedElementProps {
  const { id, relClassName } = props;
  return { id, relClassName: relClassName?.replace(".", ":")  };
}
function mapElementProps(props: NativeElementProps): ElementProps {
  const { model, parent, codeValue, codeScope, codeSpec, className, jsonProperties, ...rest } = props;
  return {
    code: { scope: codeScope.id,  spec: codeSpec.id, value: codeValue },
    model: model.id,
    parent: parent ? mapRelatedElementProps(parent) : undefined,
    classFullName: className.replace(".", ":"),
    jsonProperties: jsonProperties ? JSON.parse(jsonProperties) : undefined,
    ...rest,
  };
}

export function mapNativeElementProps<T extends ElementProps>(props: NativeInterfaceMap<T>): T {
  const element = mapElementProps(props) as any;

  // ViewDefinitionProps
  if ("categorySelector" in props && props.categorySelector !== undefined) {
    element.categorySelectorId = props.categorySelector.id;
    element.displayStyleId = props.displayStyle.id;
    delete element.categorySelector;
    delete element.displayStyle;
  }

  // ViewDefinition2dProps
  if ("baseModel" in props && props.baseModel !== undefined) {
    element.baseModelId = props.baseModel.id;
    delete element.baseModel;
  }

  // ViewDefinition3dProps?

  // SpatialViewDefinitionProps
  if ("modelSelector" in props && props.modelSelector !== undefined) {
    element.modelSelectorId = props.modelSelector.id;
    delete element.modelSelector;
  }

  // GeometricElementProps
  if ("category" in props && props.category !== undefined) {
    element.category = props.category.id;
    element.placement = ("rotation" in props) ? {
      origin: props.origin,
      bbox: { low: props.bBoxLow, high: props.bBoxHigh },
      angle: props.rotation,
    } : {
      origin: props.origin,
      bbox: { low: props.bBoxLow, high: props.bBoxHigh },
      angles: { yaw: props.yaw, roll: props.roll, pitch: props.pitch },
    };
    delete element.origin;
    delete element.bBoxLow;
    delete element.bBoxHigh;
    delete element.rotation;
    delete element.yaw;
    delete element.roll;
    delete element.pitch;
  }

  // SubCategoryProps
  if ("properties" in props && props.properties !== undefined) {
    element.appearance = JSON.parse(props.properties);
    delete element.properties;
  }

  return element as T;
}

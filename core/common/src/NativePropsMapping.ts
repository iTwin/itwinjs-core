/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AngleProps, XYProps, XYZProps } from "@itwin/core-geometry";
import { ElementProps, GeometricElementProps, GeometryPartProps, RelatedElementProps, SubCategoryProps } from "./ElementProps";
import { SpatialViewDefinitionProps, ViewDefinition2dProps, ViewDefinition3dProps, ViewDefinitionProps } from "./ViewProps";
import { Base64EncodedString } from "./Base64EncodedString";

type NativeInterfaceMapping =
| [NativeElementProps, ElementProps]
| [NativeViewDefinitionProps, ViewDefinitionProps]
| [NativeViewDefinition2dProps, ViewDefinition2dProps]
| [NativeViewDefinition3dProps, ViewDefinition3dProps]
| [NativeSpatialViewDefinitionProps, SpatialViewDefinitionProps]
| [NativeGeometricElementProps, GeometricElementProps]
| [NativeSubCategoryProps, SubCategoryProps]
| [NativeGeometryPartProps, GeometryPartProps];

export type NativeInterfaceMap<T> = Extract<NativeInterfaceMapping, [unknown, T]>[0];

type NativeElementProps = Omit<ElementProps, "model" | "code" | "classFullName" | "jsonProperties"> & {
  model: RelatedElementProps;
  className: string;
  codeValue?: string;
  codeSpec: RelatedElementProps;
  codeScope: RelatedElementProps;
  jsonProperties?: string;
  lastMod: string;
};
type NativeViewDefinitionProps = NativeElementProps & Pick<ViewDefinitionProps, "isPrivate" | "description" | "jsonProperties"> & {
  categorySelector: RelatedElementProps;
  displayStyle: RelatedElementProps;
};
type NativeViewDefinition2dProps = NativeViewDefinitionProps & Pick<ViewDefinition2dProps, "origin" | "delta" | "angle"> & {
  baseModel: RelatedElementProps;
};
type NativeViewDefinition3dProps = NativeViewDefinitionProps & Pick<ViewDefinition3dProps, "jsonProperties" | "origin" | "extents"> & {
  isCameraOn: boolean; focusDistance: number; lensAngle: number; eyePoint: XYZProps;
  yaw?: AngleProps; pitch?: AngleProps; roll?: AngleProps;
};
type NativeSpatialViewDefinitionProps = NativeViewDefinition3dProps & {
  modelSelector: RelatedElementProps;
};
type NativeGeometricElementProps = NativeElementProps & {
  category: RelatedElementProps;
  geometryStream: Base64EncodedString;
} & (
  { origin: XYProps, bBoxLow: XYProps, bBoxHigh?: XYProps, rotation: AngleProps } |
  { origin: XYZProps, bBoxLow: XYZProps, bBoxHigh?: XYZProps, yaw?: AngleProps, pitch?: AngleProps, roll?: AngleProps }
);
type NativeGeometryPartProps = NativeElementProps & { bBoxLow: XYZProps, bBoxHigh?: XYZProps, geometryStream: Base64EncodedString } ;
type NativeSubCategoryProps = NativeElementProps & Pick<SubCategoryProps, "isPrivate" | "description"> & {
  properties?: string;
};

function mapBinaryProperties(props: { [key: string]: any }): { [key: string]: any } {
  for (const key of Object.keys(props)) {
    const val = props[key];

    if (typeof val === "string") {
      if (Base64EncodedString.hasPrefix(val)) {
        props[key] = Base64EncodedString.toUint8Array(val);
      }
    } else if (typeof val === "object" && val !== null) {
      props[key] = mapBinaryProperties(val);
    }
  }
  return props;
}
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
    jsonProperties: jsonProperties
      ? JSON.parse(jsonProperties, (key, value) => {
        if (value === null)
          return undefined;
        if (key === "subCategory")
          return `0x${(+value).toString(16)}`;
        return value;
      })
      : undefined,
    ...mapBinaryProperties(rest),
  };
}

export function mapNativeElementProps<T extends ElementProps>(props: NativeInterfaceMap<T>): T {
  const element = mapElementProps(props) as any;
  delete element.lastMod;

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

  // ViewDefinition3dProps
  if ("isCameraOn" in props && props.isCameraOn !== undefined) {
    element.cameraOn = props.isCameraOn;
    element.camera = { eye: props.eyePoint, focusDist: props.focusDistance, lens: props.lensAngle };
    element.angles = { yaw: props.yaw, roll: props.roll, pitch: props.pitch },

    delete element.isCameraOn;
    delete element.eyePoint;
    delete element.focusDistance;
    delete element.lensAngle;
    delete element.yaw;
    delete element.roll;
    delete element.pitch;
  }

  // SpatialViewDefinitionProps
  if ("modelSelector" in props && props.modelSelector !== undefined) {
    element.modelSelectorId = props.modelSelector.id;
    delete element.modelSelector;
  }

  // GeometryPartProps and partially GeometricElementProps
  if ("bBoxHigh" in props && props.bBoxHigh !== undefined && "bBoxLow" in props && props.bBoxLow !== undefined) {
    element.bbox = { low: element.bBoxLow, high: element.bBoxHigh };
    delete element.bBoxLow;
    delete element.bBoxHigh;
    delete element.geometryStream;
  }

  // GeometricElementProps
  if ("category" in props && props.category !== undefined) {
    element.category = props.category.id;
    element.placement = ("rotation" in props) ? {
      origin: props.origin,
      bbox: element.bbox, // already tackled in GeometryPartProps handling
      angle: props.rotation,
    } : {
      origin: props.origin,
      bbox: element.bbox,
      angles: { yaw: props.yaw, roll: props.roll, pitch: props.pitch },
    };
    delete element.origin;
    delete element.rotation;
    delete element.yaw;
    delete element.roll;
    delete element.pitch;
    delete element.bbox;
  }

  // SubCategoryProps
  if ("properties" in props && !!props.properties) {
    element.appearance = JSON.parse(props.properties);
    delete element.properties;
  }

  return element as T;
}

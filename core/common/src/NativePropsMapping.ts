/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString, Id64String } from "@itwin/core-bentley";
import { EntityProps } from "./EntityProps";
import { ElementProps, RelatedElementProps } from "./ElementProps";
import { CodeProps } from "./Code";

export type NativeInterfaceMapping =
  | [NativeCodeProps, CodeProps]
  | [NativeElementProps, ElementProps]
  | [NativeEntityProps, EntityProps];

export type NativeInterfaceMap<T> = Extract<NativeInterfaceMapping, [unknown, T]>[0];
export type NativeMappingInterfaces = Extract<NativeInterfaceMapping, [unknown, unknown]>[0];

export interface NativeElementProps extends NativeEntityProps, NativeCodeProps {
  model: RelatedElementProps;
  federationGuid?: GuidString;
  parent?: RelatedElementProps;
  userLabel?: string;
}

export interface NativeEntityProps {
  classFullName: string;
  id?: Id64String;
  jsonProperties?: { [key: string]: any };
}

export interface NativeCodeProps {
  codeValue?: string;
  codeSpec: RelatedElementProps;
  codeScope: RelatedElementProps;
}

export function mapCodeProps(props: NativeCodeProps): CodeProps {
  const { codeScope, codeSpec, codeValue } = props;
  return { scope: codeScope.id,  spec: codeSpec.id,  value: codeValue  };
}

export function mapElementProps(props: NativeElementProps): ElementProps {
  const { model, federationGuid, parent, userLabel, ...rest } = props;
  return {
    code: mapCodeProps(rest),
    model: model.id,
    parent,
    federationGuid,
    userLabel,
    ...mapEntityProps(rest),
  };
}

export function mapEntityProps(props: NativeEntityProps): EntityProps {
  const { classFullName, id, jsonProperties } = props;
  return { classFullName, id, jsonProperties };
}

export function mapNativeProps<T>(props: NativeInterfaceMap<T>): T {
  if (isNativeCodeProps(props)) {
    return mapCodeProps(props) as T;
  } else if (isNativeElementProps(props)) {
    return mapElementProps(props) as T;
  } else if (isNativeEntityProps(props)) {
    return mapEntityProps(props) as T;
  }

  return props as T;
}

function isNativeCodeProps(props: NativeMappingInterfaces): props is NativeCodeProps {
  throw new Error("Function not implemented.");
}

function isNativeElementProps(props: NativeMappingInterfaces): props is NativeElementProps {
  throw new Error("Function not implemented.");
}

function isNativeEntityProps(props: NativeMappingInterfaces): props is NativeEntityProps {
  throw new Error("Function not implemented.");
}


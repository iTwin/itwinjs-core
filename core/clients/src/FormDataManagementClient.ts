/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module FormDataManagementService */

import { ECJsonTypeMap, WsgInstance } from "./ECJsonTypeMap";
import { DeploymentEnv, UrlDescriptor } from "./Client";
import { WsgClient } from "./WsgClient";
import { AccessToken } from "./Token";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

/** FormDefinition */
@ECJsonTypeMap.classToJson("wsg", "Forms_EC_Mapping.FormDefinition", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class FormDefinition extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Status")
  public status?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.FormId")
  public formId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ClassDisplayLabel")
  public classDisplayLabel?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ClassName")
  public className?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ClassSchema")
  public classSchema?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Definition")
  public definition?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Type")
  public type?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsShared")
  public isShared?: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ShareType")
  public shareType?: number;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ProjectId")
  public projectId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ProjectNumber")
  public projectNumber?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ProjectName")
  public projectName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Discipline")
  public discipline?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Classification")
  public classification?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ErrorStatus")
  public errorStatus?: string;
}

/** FormData */
@ECJsonTypeMap.classToJson("wsg", "DynamicSchema.Issue", { schemaPropertyName: "schemaName", classPropertyName: "className" })
export class FormInstanceData extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties")
  public properties?: any;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FormData].direction")
  public formDataDirection?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FormData].schemaName")
  public formDataSchemaName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FormData].relatedInstance[Form].instanceId")
  public formId?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FormData].relatedInstance[Form].schemaName")
  public formSchemaName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FormData].relatedInstance[Form].properties.Name")
  public formName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FormData].relatedInstance[Form].properties.FormDisplayLabel")
  public formDisplayLabel?: string;
}

/**
 * Client wrapper to Reality Data Service
 */
export class FormDataManagementClient extends WsgClient {
  public static readonly searchKey: string = "Forms.WSGService";
  private static readonly _defaultUrlDescriptor: UrlDescriptor = {
    DEV: "https://dev-formswsg-eus.cloudapp.net",
    QA: "https://qa-formswsg-eus.cloudapp.net",
    PROD: "https://connect-formswsg.bentley.com",
    PERF: "https://perf-formswsg-eus.cloudapp.net",
  };

  /**
   * Creates an instance of RealityDataServicesClient.
   * @param deploymentEnv Deployment environment.
   */
  public constructor(public deploymentEnv: DeploymentEnv) {
    super(deploymentEnv, "v2.5", FormDataManagementClient._defaultUrlDescriptor[deploymentEnv] + "/");
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return FormDataManagementClient.searchKey;
  }

  /**
   * Gets the default URL for the service.
   * @returns Default URL for the service.
   */
  protected getDefaultUrl(): string {
    return FormDataManagementClient._defaultUrlDescriptor[this.deploymentEnv];
  }

  /**
   * get form definitions and their meta data from the form data management client
   * @param token the access token used to authenticate the request
   * @param alctx the ActivityLoggingContext to track this request by
   * @param projectId the project associated with the form definitions
   * @param filter [optional] can either supply a string or an array of property names and values which are then unioned together as a string and inserted into the url to exclude definitions
   * @param format either xml or json, this corresponds to the actual form definition which will be returned a string property, but can be parse into the format specified
   */
  public getFormDefinitions(token: AccessToken, alctx: ActivityLoggingContext, projectId: string, filter?: string | Array<{ name: string, value: string }>, format: "json" | "xml" = "json"): Promise<FormDefinition[]> {
    let url = `/Repositories/Bentley.Forms--${projectId}/Forms_EC_Mapping/FormDefinition`;

    if (filter !== undefined) {
      const filterString = typeof filter === "string" ? filter : FormDataManagementClient.buildFormDataFilter(filter);
      url += `?$filter=${filterString}&definitionFormat=${format}`;
    } else {
      url += `?definitionFormat=${format}`;
    }

    return this.getInstances<FormDefinition>(alctx, FormDefinition, token, url);
  }

  /**
   * get form definitions that have the classification "Risk" and the discipline "Issue"
   * @param token the access token used to authenticate the request
   * @param alctx the ActivityLoggingContext to track this request by
   * @param projectId the project associated with the form definitions
   */
  public getRiskIssueFormDefinitions(token: AccessToken, alctx: ActivityLoggingContext, projectId: string): Promise<FormDefinition[]> {
    const filters = [
      { name: "Classification", value: "Risk" },
      { name: "Discipline", value: "Issue" },
    ];

    return this.getFormDefinitions(token, alctx, projectId, filters);
  }

  /**
   * get the form data instances from the form data management client. Note this the data saved from a user filling out a form definition, it is not the form definition itself,
   * furthermore, the data does not correspond directly to a form definition but rather the 'class' both this data and a form definition share. That 'class' can be said to 'own' the properties
   * that are referenced by both a form definition and this
   * @param token the access token used to authenticate the request
   * @param alctx the ActivityLoggingContext to track this request by
   * @param projectId the project associated with the form data
   * @param className the name of the class that owns the properties for which each instance binds data to (note this is dynamic, ie a user can create/destroy classes)
   * @param skip the starting index of instances to fetch (accomodates paging to reduce the request payload)
   * @param top the maximum number of instances to return
   * @param filter [optional] can either supply a string or an array of property names and values which are then unioned together as a string and inserted into the url to exclude data instances
   */
  public getFormData(token: AccessToken, alctx: ActivityLoggingContext, projectId: string, className: string, skip: number = 0, top: number = 50, filter?: string | Array<{ name: string, value: string }>): Promise<FormInstanceData[]> {
    let url = `/Repositories/Bentley.Forms--${projectId}/DynamicSchema/${className}?$select=*,Forms_EC_Mapping.Form.*&$skip=${skip}&$top=${top}`;

    if (filter !== undefined) {
      const filterString = typeof filter === "string" ? filter : FormDataManagementClient.buildFormDataFilter(filter);
      url += `&$filter=${filterString}`;
    }

    return this.getInstances<FormInstanceData>(alctx, FormInstanceData, token, url);
  }

  /**
   * utility function to construct a filter string that can be insert into the request url to exclude instances
   * @param filters an array of property names and the values to filter them against
   */
  public static buildFormDataFilter(filters: Array<{ name: string, value: string }>): string {
    let filter = "";
    filters.forEach((entry: { name: string, value: string }) => {
      if (filter.length > 0)
        filter += "+and+";
      filter += `${entry.name}+eq+%27${entry.value}%27`;
    });
    return filter;
  }

  /**
   * get form data instances with the "Risk" classification, "Issue" discipline, and the given iModelId which is stored as the data isntance's "_ContainerId" property
   * @param token the access token used to authenticate the request
   * @param alctx the ActivityLoggingContext to track this request by
   * @param projectId the project associated with the form data
   * @param iModelId the iModelId associated with the form data
   * @param className the name of the class that owns the properties for which each instance binds data to (note this is dynamic, ie a user can create/destroy classes)
   * @param skip the starting index of instances to fetch (accomodates paging to reduce the request payload)
   * @param top the maximum number of instances to return
   */
  public getRiskIssueFormData(token: AccessToken, alctx: ActivityLoggingContext, projectId: string, iModelId: string, className: string = "Issue", skip: number = 0, top: number = 50): Promise<FormInstanceData[]> {
    const filters = [
      { name: "_Classification", value: "Risk" },
      { name: "_Discipline", value: "Issue" },
      { name: "_ContainerId", value: iModelId },
    ];
    return this.getFormData(token, alctx, projectId, className, skip, top, filters);
  }

  /**
   * create/update a form data instance with given form data
   * @param token the access token used to authenticate the request
   * @param alctx the ActivityLoggingContext to track this request by
   * @param formData the data to be persisted
   * @param projectId the project associated with the form data
   * @param className the name of the class that owns the properties for which each instance binds data to (note this is dynamic, ie a user can create/destroy classes)
   * @param instanceId [optional] if provided the data is used to update an existing form data instance, otherwise a new instance is created
   */
  public postFormData(token: AccessToken, alctx: ActivityLoggingContext, formData: FormInstanceData, projectId: string, className: string = "Issue", instanceId?: string): Promise<FormInstanceData> {
    formData.changeState = instanceId === undefined ? "new" : "modified";
    formData.formDataDirection = "forward";
    formData.formSchemaName = "Forms_EC_Mapping";
    formData.formDataSchemaName = "DynamicSchema";

    let url = `/Repositories/Bentley.Forms--${projectId}/DynamicSchema/${className}`;
    if (instanceId !== undefined)
      url += `/${instanceId}`;

    return this.postInstance<FormInstanceData>(alctx, FormInstanceData, token, url, formData as FormInstanceData);
  }

  /**
   * create/update a form data instance with given form data that is associated by the classification "Risk", discipline "Issue", and the element and imodel ids provided
   * @param token the access token used to authenticate the request
   * @param alctx the ActivityLoggingContext to track this request by
   * @param properties the data to be persisted, note due to the dynamic nature of classes this cannot be generalized by a specific type
   * @param projectId the project associated with the form data
   * @param iModelId the iModelId associated with the form data (bound to teh _ContainerId reference property)
   * @param elementId the elementId associated with the form data (bound to teh _ItemId reference property)
   * @param formId the form definition the form data was filled out from
   * @param className the name of the class that owns the properties for which each instance binds data to (note this is dynamic, ie a user can create/destroy classes)
   * @param instanceId [optional] if provided the data is used to update an existing form data instance, otherwise a new instance is created
   */
  public postRiskIssueFormData(token: AccessToken, alctx: ActivityLoggingContext, properties: any, projectId: string, iModelId: string, elementId: string, formId: string, className: string = "Issue", instanceId?: string): Promise<FormInstanceData> {
    const formData = new FormInstanceData();
    formData.formId = formId;
    formData.properties = properties;
    formData.properties["_ContainerId"] = iModelId; // tslint:disable-line
    formData.properties["_ItemId"] = elementId; // tslint:disable-line
    formData.properties["_Classification"] = "Risk"; // tslint:disable-line
    formData.properties["_Discipline"] = "Issue"; // tslint:disable-line
    return this.postFormData(token, alctx, formData, projectId, className, instanceId);
  }
}

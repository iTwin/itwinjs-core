/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module FormDataManagementService
 */

import { Config } from "@bentley/bentleyjs-core";
import {
  AuthorizedClientRequestContext,
  ECJsonTypeMap,
  request,
  RequestOptions,
  WsgClient,
  WsgInstance,
} from "@bentley/itwin-client";

/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/naming-convention */

/** @internal */
export type FormFilterArray = Array<{
  name: string;
  value: any;
}>;

/** @internal */
@ECJsonTypeMap.classToJson("wsg", "Forms_EC_Mapping.FormDefinition", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
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

/** ProjectMember
 * @internal
 */
@ECJsonTypeMap.classToJson("wsg", "Connect.ProjectMember", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
export class ProjectMember extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.UserId")
  public userId?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Email")
  public email?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ProjectId")
  public projectId?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.OrganizationGUID")
  public organizationGUID?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.OrganizationName")
  public organizationName?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsRole")
  public isRole?: boolean;
}

/** @internal */
@ECJsonTypeMap.classToJson("wsg", "Connect.Stats", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
export class ProjectStats extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Count")
  public count?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Open")
  public open?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Closed")
  public closed?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Assigned")
  public assigned?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.New")
  public new?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Overdue")
  public overdue?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.NearDeadline")
  public nearDeadline?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Upcoming")
  public upcoming?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.AssignedNew")
  public assignedNew?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.AssignedOverdue")
  public assignedOverdue?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.AssignedNearDeadline")
  public assignedNearDeadline?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.AssignedUpcoming")
  public assignedUpcoming?: number;
}

@ECJsonTypeMap.classToJson("wsg", "Bentley_Standard_Classes.InstanceCount", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
class InstanceCount extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Count")
  public count!: number;
}

/** @internal */
@ECJsonTypeMap.classToJson("wsg", "DynamicSchema.BaseClass", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
export class FormInstanceData extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties")
  public properties?: any;

  @ECJsonTypeMap.propertyToJson("wsg", "relationshipInstances[FormData]")
  public formData?: any;
}

/** @internal */
@ECJsonTypeMap.classToJson("wsg", "Workflow.WorkflowDefinition", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
@ECJsonTypeMap.classToJson("wsg", "Workflow.State", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
@ECJsonTypeMap.classToJson("wsg", "Workflow.Transition", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
@ECJsonTypeMap.classToJson("wsg", "Workflow.PropertyAssignment", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})

export class WorkflowDefinition extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Discipline")
  public discipline?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Classification")
  public classification?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.States")
  public states?: WorkflowStatus[];
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Transitions")
  public transitions?: WorkflowTransition[];
  @ECJsonTypeMap.propertyToJson("wsg", "properties.StartingTransitions")
  public startingTransitions?: WorkflowTransition[];
  @ECJsonTypeMap.propertyToJson("wsg", "properties.UninitializedState")
  public uninitializedState?: WorkflowStatus;
}

class WorkflowStatus extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Id")
  public id?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Color")
  public color?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.EditableProperties")
  public editableProperties?: string[];
  @ECJsonTypeMap.propertyToJson("wsg", "properties.VisibileTo")
  public visibileTo?: string[];
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Closed")
  public closed?: boolean;
}

class WorkflowTransition extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Start")
  public start?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.End")
  public end?: string[];
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Permissions")
  public permissions?: string[];
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Conditions")
  public conditions?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.AssignedUser")
  public assignedUser?: boolean;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.PropertyAssignments")
  public propertyAssignments?: PropertyAssignment[];
  @ECJsonTypeMap.propertyToJson("wsg", "properties.SubmitDisplay")
  public submitDisplay?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Notes")
  public notes?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ButtonColor")
  public buttonColor?: number;
}

class PropertyAssignment extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Property")
  public property?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Value")
  public value?: string;
}

/** @internal */
@ECJsonTypeMap.classToJson("wsg", "DynamicSchema.Attachment", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
export class Attachment extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Size")
  public size?: number;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedDate")
  public createdDate?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ModifiedDate")
  public modifiedDate?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Binding")
  public binding?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Type")
  public type?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.SasUrl")
  public sasUrl?: string;
}

/** @internal */
@ECJsonTypeMap.classToJson("wsg", "DynamicSchema._Comment", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
export class Comment extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Author")
  public author?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.AuthorId")
  public authorId?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.CreatedDate")
  public createdDate?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ModifiedDate")
  public modifiedDate?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Text")
  public text?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsWorkflowNote")
  public isWorkflowNote?: boolean;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FromStateName")
  public fromStateName?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ToStateName")
  public toStateName?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.FromStateId")
  public fromStateId?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.ToStateId")
  public toStateId?: string;
}

/** @internal */
@ECJsonTypeMap.classToJson("wsg", "DynamicSchema.AuditRecord", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
@ECJsonTypeMap.classToJson("wsg", "DynamicSchema.AuditValue", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})

export class AuditRecord extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.RecordBy")
  public recordBy?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.RecordById")
  public recordById?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.RecordDate")
  public recordDate?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Action")
  public action?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Text")
  public text?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsWorkflowNote")
  public values?: AuditValue[];
}

class AuditValue extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.RecordBy")
  public property?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.OldValue")
  public oldValue?: string;
  @ECJsonTypeMap.propertyToJson("wsg", "properties.NewValue")
  public newValue?: string;
}

/** @internal */
@ECJsonTypeMap.classToJson("wsg", "MetaSchema.ECPropertyDef", {
  schemaPropertyName: "schemaName",
  classPropertyName: "className",
})
export class FormProperties extends WsgInstance {
  @ECJsonTypeMap.propertyToJson("wsg", "properties.Name")
  public name?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.OriginClass")
  public originClass?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.OriginClassName")
  public originClassName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Overrides")
  public overrides?: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.DisplayLabel")
  public displayLabel?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.TypeName")
  public typeName?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.Description")
  public descriptions?: string;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsArray")
  public isArray?: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.ReadOnly")
  public readonly?: boolean;

  @ECJsonTypeMap.propertyToJson("wsg", "properties.IsTransient")
  public isTransient?: boolean;

  @ECJsonTypeMap.propertyToJson(
    "wsg",
    "relationshipInstances[CustomAttributeContainerHasCustomAttribute].relatedInstance[DisplayOptions].properties.Hidden"
  )
  public hidden?: boolean;

  @ECJsonTypeMap.propertyToJson(
    "wsg",
    "relationshipInstances[CustomAttributeContainerHasCustomAttribute].relatedInstance[DateTimeInfo].properties.DateTimeComponent"
  )
  public dateTimeComponent?: string;

  @ECJsonTypeMap.propertyToJson(
    "wsg",
    "relationshipInstances[CustomAttributeContainerHasCustomAttribute].relatedInstance[DateTimeInfo].properties.DateTimeKind"
  )
  public dateTimeKind?: string;

  @ECJsonTypeMap.propertyToJson(
    "wsg",
    "relationshipInstances[CustomAttributeContainerHasCustomAttribute].relatedInstance[PropertyLink].properties.ObjectName"
  )
  public objectName?: string;

  @ECJsonTypeMap.propertyToJson(
    "wsg",
    "relationshipInstances[CustomAttributeContainerHasCustomAttribute].relatedInstance[PropertyLink].properties.ObjectId"
  )
  public objectId?: string;

  @ECJsonTypeMap.propertyToJson(
    "wsg",
    "relationshipInstances[CustomAttributeContainerHasCustomAttribute].relatedInstance[PropertyLink].properties.ObjectDate"
  )
  public objectDate?: string;
}

const PREVIEW_IMAGE_NAME = "DesignReview_Preview.png";

/** @internal */
export class FormDataManagementClient extends WsgClient {
  public static readonly searchKey: string = "Forms.WSGService";
  public static readonly configRelyingPartyUri = "imjs_form_data_management_relying_party_uri";
  public constructor() {
    super("sv1.2");
  }

  /**
   * Gets name/key to query the service URLs from the URL Discovery Service ("Buddi")
   * @returns Search key for the URL.
   */
  protected getUrlSearchKey(): string {
    return FormDataManagementClient.searchKey;
  }

  /**
   * Gets theRelyingPartyUrl for the service.
   * @returns RelyingPartyUrl for the service.
   */
  protected getRelyingPartyUrl(): string {
    if (Config.App.has(FormDataManagementClient.configRelyingPartyUri))
      return `${Config.App.get(
        FormDataManagementClient.configRelyingPartyUri
      )}/`;

    if (
      Config.App.getBoolean(
        WsgClient.configUseHostRelyingPartyUriAsFallback,
        true
      )
    ) {
      if (Config.App.has(WsgClient.configHostRelyingPartyUri))
        return `${Config.App.get(WsgClient.configHostRelyingPartyUri)}/`;
    }

    throw new Error(
      `RelyingPartyUrl not set. Set it in Config.App using key ${FormDataManagementClient.configRelyingPartyUri}`
    );
  }

  /**
   * Get form definitions and their meta data from the form data management client
   * @param requestContext The client request context
   * @param projectId the project associated with the form definitions
   * @param filter [optional] can either supply a string or an array of property names and values which are then unioned together as a string and inserted into the url to exclude definitions
   * @param format either xml or json, this corresponds to the actual form definition which will be returned a string property, but can be parse into the format specified
   */
  public async getFormDefinitions(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    filter?: string | Array<{ name: string, value: string }>,
    format: "json" | "xml" = "json"
  ): Promise<FormDefinition[]> {
    requestContext.enter();
    let url = `/Repositories/Bentley.Forms--${projectId}/Forms_EC_Mapping/FormDefinition`;

    if (filter !== undefined) {
      const filterString =
        typeof filter === "string"
          ? filter
          : FormDataManagementClient.buildFormDataFilter(filter);
      url += `?$filter=${filterString}&definitionFormat=${format}`;
    } else {
      url += `?definitionFormat=${format}`;
    }

    return this.getInstances<FormDefinition>(
      requestContext,
      FormDefinition,
      url
    );
  }

  /**
   * Get the form data instances from the form data management client. Note this the data saved from a user filling out a form definition, it is not the form definition itself,
   * furthermore, the data does not correspond directly to a form definition but rather the 'class' both this data and a form definition share. That 'class' can be said to 'own' the properties
   * that are referenced by both a form definition and this
   * @param requestContext The client request context
   * @param projectId the project associated with the form data
   * @param className the name of the class that owns the properties for which each instance binds data to (note this is dynamic, ie a user can create/destroy classes)
   * @param skip the starting index of instances to fetch (accommodates paging to reduce the request payload)
   * @param top the maximum number of instances to return
   * @param filter [optional] can either supply a string or an array of property names and values which are then unioned together as a string and inserted into the url to exclude data instances
   */
  public async getFormData(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    className: string,
    skip: number = 0,
    top: number = 50,
    filter?: string | Array<{ name: string, value: string }>
  ): Promise<WsgInstance[]> {
    requestContext.enter();
    const baseUrl = await this.getUrl(requestContext);
    let url = `${baseUrl}/Repositories/Bentley.Forms--${projectId}/DynamicSchema/${className}?$select=*,Forms_EC_Mapping.Form.*&$skip=${skip}&$top=${top}`;
    url += "&api.filtersettings=CaseInsensitive";
    if (filter !== undefined) {
      const filterString =
        typeof filter === "string"
          ? filter
          : FormDataManagementClient.buildFormDataFilter(filter);
      url += `&$filter=${filterString}`;
    }

    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessTokenString },
    };
    requestContext.enter();
    const response = await request(requestContext, url, options);
    return response.body.instances ? response.body.instances : response.body;
  }

  public async getFormInstance(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    className: string,
    instanceId: string
  ): Promise<WsgInstance[]> {
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "GET",
      headers: { authorization: accessTokenString },
    };
    requestContext.enter();
    const baseUrl = await this.getUrl(requestContext);
    const url = `${baseUrl}/Repositories/Bentley.Forms--${projectId}/DynamicSchema/${className}/${instanceId}?$select=*,Forms_EC_Mapping.Form.*`;
    const response = await request(requestContext, url, options);
    return response.body.instances ? response.body.instances : response.body;
  }

  /**
   * Utility function to construct a filter string that can be insert into the request url to exclude instances
   * @param filters an array of property names and the values to filter them against
   */
  public static buildFormDataFilter(
    filters: Array<{ name: string, value: string }>
  ): string {
    let filter = "";
    filters.forEach((entry: { name: string, value: string }) => {
      if (filter.length > 0) filter += "+and+";
      filter += `${entry.name}+eq+%27${entry.value}%27`;
    });
    return filter;
  }

  /**
   * Create/update a form data instance with given form data
   * @param requestContext The client request context
   * @param formData the data to be persisted
   * @param projectId the project associated with the form data
   * @param className the name of the class that owns the properties for which each instance binds data to (note this is dynamic, ie a user can create/destroy classes)
   * @param instanceId [optional] if provided the data is used to update an existing form data instance, otherwise a new instance is created
   */
  public async postFormData(
    requestContext: AuthorizedClientRequestContext,
    formData: FormInstanceData,
    projectId: string,
    className: string,
    instanceId?: string,
    formDefId?: string
  ): Promise<WsgInstance> {
    let url = `/Repositories/Bentley.Forms--${projectId}/DynamicSchema/${className}`;
    if (instanceId !== undefined) {
      url += `/${instanceId}`;
    } else {
      formData.relationshipInstances = [
        {
          changeState: "new",
          schemaName: "DynamicSchema",
          className: "FormData",
          direction: "forward",
          relatedInstance: {
            changeState: "existing",
            schemaName: "Forms_EC_Mapping",
            className: "Form",
            instanceId: formDefId,
          },
        },
        {
          changeState: "new",
          schemaName: "DynamicSchema",
          className: "BaseAttachment",
          direction: "forward",
          relatedInstance: {
            schemaName: "DynamicSchema",
            className: "Attachment",
            properties: {
              Name: PREVIEW_IMAGE_NAME,
            },
          },
        },
      ];
    }

    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: accessTokenString },
      body: {
        instance: formData,
      },
    };

    const baseUrl = await this.getUrl(requestContext);
    url = `${baseUrl}${url}`;
    const response = await request(requestContext, url, options);
    return response.body.instances ? response.body.instances : response.body;
  }

  /**
   * get the form data instances from the form data management client. Note this the data saved from a user filling out a form definition, it is not the form definition itself,
   * furthermore, the data does not correspond directly to a form definition but rather the 'class' both this data and a form definition share. That 'class' can be said to 'own' the properties
   * that are referenced by both a form definition and this
   * @param requestContext The client request context
   * @param projectId the project associated with the form data
   * @param className the name of the class that owns the properties for which each instance binds data to (note this is dynamic, ie a user can create/destroy classes)
   * @param skip the starting index of instances to fetch (accomodates paging to reduce the request payload)
   * @param top the maximum number of instances to return
   * @param filter [optional] can either supply a string or an array of property names and values which are then unioned together as a string and inserted into the url to exclude data instances
   */
  public async getCount(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    className: string,
    filter?: string | FormFilterArray
  ) {
    requestContext.enter();
    let url = `/Repositories/Bentley.Forms--${projectId}/DynamicSchema/${className}/$count`;
    if (filter !== undefined) {
      const filterString =
        typeof filter === "string"
          ? filter
          : FormDataManagementClient.buildFormDataFilter(filter);
      url += `?$filter=${filterString}`;
    }
    url += "&api.filtersettings=CaseInsensitive";

    return this.getInstances<InstanceCount>(requestContext, InstanceCount, url);
  }

  public async getProjectMembers(
    requestContext: AuthorizedClientRequestContext,
    projectId: string
  ) {
    requestContext.enter();
    const url = `/Repositories/Bentley.Forms--${projectId}/CONNECT/ProjectMember`;
    return this.getInstances<ProjectMember>(requestContext, ProjectMember, url);
  }

  public async getProjectStats(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    filter?: string | FormFilterArray
  ) {
    requestContext.enter();

    let url = `/Repositories/Bentley.Forms--${projectId}/CONNECT/Stats`;
    if (filter !== undefined) {
      const filterString =
        typeof filter === "string"
          ? filter
          : FormDataManagementClient.buildFormDataFilter(filter);
      url += `?$filter=${filterString}`;
    }
    return this.getInstances<ProjectStats>(requestContext, ProjectStats, url);
  }

  public async getWorkflow(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    classification: string,
    discipline: string
  ) {
    requestContext.enter();
    const url = `/Repositories/Bentley.Forms--${projectId}/Workflow/WorkflowDefinition?$filter=Discipline+eq+%27${discipline}%27+and+Classification+eq+%27${classification}%27`;
    return this.getInstances<WorkflowDefinition>(
      requestContext,
      WorkflowDefinition,
      url
    );
  }

  public async deleteWorkflow(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    workflowDefId: string
  ) {
    requestContext.enter();
    const url = `/Repositories/Bentley.Forms--${projectId}/Workflow/WorkflowDefinition/${workflowDefId}`;
    return this.deleteInstance<WorkflowDefinition>(requestContext, url);
  }

  public async addWorkflow(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    workflow: WorkflowDefinition
  ) {
    requestContext.enter();
    const url = `/Repositories/Bentley.Forms--${projectId}/Workflow/WorkflowDefinition`;
    return this.postInstance<WorkflowDefinition>(
      requestContext,
      WorkflowDefinition,
      url,
      workflow
    );
  }

  public async getComments(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    formClass: string,
    formId: string
  ) {
    requestContext.enter();
    const url = `/Repositories/Bentley.Forms--${projectId}/DynamicSchema/${formClass}/${formId}?$select=$id,_Comment.*`;
    return this.getInstances<Comment>(requestContext, Comment, url);
  }

  public async getAuditTrail(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    formClass: string,
    formId: string
  ) {
    requestContext.enter();
    const url = `/Repositories/Bentley.Forms--${projectId}/DynamicSchema/${formClass}/${formId}?$select=$id,AuditRecord.*`;
    return this.getInstances<AuditRecord>(requestContext, AuditRecord, url);
  }

  public async getAttachmentSasUrl(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    attachmentId: string
  ) {
    requestContext.enter();
    const url = `/Repositories/Bentley.Forms--${projectId}/DynamicSchema/Attachment/${attachmentId}?$select=Name,Type,SasUrl`;
    return this.getInstances<Attachment>(requestContext, Attachment, url);
  }

  public async getAttachment(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    attachmentId: string
  ) {
    requestContext.enter();
    return this.getAttachmentSasUrl(requestContext, projectId, attachmentId);
  }

  public async getAttachments(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    formClass: string,
    formId: string
  ) {
    requestContext.enter();
    const url = `/Repositories/Bentley.Forms--${projectId}/DynamicSchema/Attachment?$filter=${formClass}.$id eq '${formId}'&$select=Name,Size,CreatedDate,ModifiedDate,Type,Caption,SasUrl,Binding`;
    return this.getInstances<Attachment>(requestContext, Attachment, url);
  }

  public async getFormProperties(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    className: string
  ): Promise<any> {
    const url = `/Repositories/Bentley.Forms--${projectId}/metaschema/ecpropertydef?$filter=ecclassdef.Name+eq+%27${className}%27&$select=*,CustomAttributeContainerHasCustomAttribute-forward-Bentley_Standard_CustomAttributes.DisplayOptions.*,CustomAttributeContainerHasCustomAttribute-forward-DynamicSchema.PropertyLink.*,CustomAttributeContainerHasCustomAttribute-forward-Bentley_Standard_CustomAttributes.DateTimeInfo.*`;
    return this.getInstances<FormProperties>(
      requestContext,
      FormProperties,
      url
    );
  }

  public async postComment(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    formClass: string,
    formId: string,
    comment: string
  ): Promise<WsgInstance[]> {
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const postBody = {
      className: "_Comment",
      schemaName: "DynamicSchema",
      properties: {
        Text: comment,
      },
      relationshipInstances: [
        {
          className: "_InstanceComments",
          schemaName: "DynamicSchema",
          direction: "forward",
          relatedInstance: {
            className: formClass,
            schemaName: "DynamicSchema",
            instanceId: formId,
          },
        },
      ],
    };

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: accessTokenString },
      body: {
        instance: postBody,
      },
    };
    requestContext.enter();
    const baseUrl = await this.getUrl(requestContext);
    const url = `${baseUrl}/Repositories/Bentley.Forms--${projectId}/DynamicSchema/_Comment`;
    const response = await request(requestContext, url, options);
    return response.body.instances ? response.body.instances : response.body;
  }

  public async addNewAttachment(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    formClass: string,
    id: string,
    attachmentData: string,
    fileName: string,
    caption: string = ""
  ) {
    const relatedAttachmentInstance = {
      className: "Attachment",
      schemaName: "DynamicSchema",
      properties: {
        Name: fileName,
        Caption: caption,
      },
      relationshipInstances: [
        {
          schemaName: "DynamicSchema",
          className: "BaseAttachment",
          direction: "backward",
          relatedInstance: {
            instanceId: id,
            className: formClass,
            schemaName: "DynamicSchema",
          },
        },
      ],
    };

    const response = await this.postNewAttachment(
      requestContext,
      projectId,
      relatedAttachmentInstance
    );
    const instance = response.changedInstance.instanceAfterChange;
    const sasUrl = instance.properties.SasUrl;
    return this.putAttachment(sasUrl, instance.instanceId, attachmentData);
  }

  public async postNewAttachment(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    attachmentInstance: object
  ) {
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: accessTokenString },
      body: {
        instance: attachmentInstance,
      },
    };
    requestContext.enter();
    const baseUrl = await this.getUrl(requestContext);
    const url = `${baseUrl}/Repositories/Bentley.Forms--${projectId}/DynamicSchema/Attachment`;
    const response = await request(requestContext, url, options);
    return response.body.instances ? response.body.instances : response.body;
  }

  private async putAttachment(
    sasUrl: string,
    attachmentId: string,
    attachmentData: string
  ): Promise<string> {
    const fileResponse = await fetch(attachmentData);
    const blob = await fileResponse.blob();

    const xhr = new XMLHttpRequest();
    const promise = new Promise<string>((resolve) => {
      xhr.open("PUT", sasUrl);
      xhr.setRequestHeader("x-ms-blob-type", "BlockBlob");
      xhr.setRequestHeader("Content-Type", "application/octet-stream");

      xhr.send(blob);
      resolve(attachmentId);
    });

    return promise;
  }

  public async deleteAttachment(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    formClass: string,
    formId: string,
    attachmentId: string
  ) {
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const postBody = {
      instances: [
        {
          className: formClass,
          schemaName: "DynamicSchema",
          instanceId: formId,
          changeState: "existing",
          relationshipInstances: [
            {
              className: "BaseAttachment",
              schemaName: "DynamicSchema",
              instanceId: attachmentId,
              changeState: "deleted",
              direction: "forward",
              relatedInstance: {
                instanceId: attachmentId,
                className: "Attachment",
                schemaName: "DynamicSchema",
                changeState: "deleted",
              },
            },
          ],
        },
      ],
    };

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: accessTokenString },
      body: {
        instance: postBody,
      },
    };

    requestContext.enter();
    const baseUrl = await this.getUrl(requestContext);
    const url = `${baseUrl}/Repositories/Bentley.Forms--${projectId}/$changeset`;
    const response = await request(requestContext, url, options);
    return response.body.instances ? response.body.instances : response.body;
  }

  public async importTemplate(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    templateName: string = "Design Review Punchlist"
  ) {
    const accessTokenString: string | undefined = requestContext.accessToken.toTokenString();

    const postBody = {
      instance: {
        instanceId: templateName,
        schemaName: "Connect",
        className: "Template",
        properties: {
          Copy: false,
          OnlyIfUnique: true,
        },
      },
    };

    const options: RequestOptions = {
      method: "POST",
      headers: { authorization: accessTokenString },
      body: {
        instance: postBody,
      },
    };

    requestContext.enter();
    const baseUrl = await this.getUrl(requestContext);
    const url = `${baseUrl}/Repositories/Bentley.Forms--${projectId}/CONNECT/Template/${templateName}`;
    const response = await request(requestContext, url, options);
    return response.body.instances ? response.body.instances : response.body;
  }

  /**
   * get the form data instances from the form data management client. Note this the data saved from a user filling out a form definition, it is not the form definition itself,
   * furthermore, the data does not correspond directly to a form definition but rather the 'class' both this data and a form definition share. That 'class' can be said to 'own' the properties
   * that are referenced by both a form definition and this
   * @param accessToken
   * @param projectId the project associated with the form data
   * @param iModelId Optional iModel id (if undefined, all Issues of the project are returned)
   */
  public async getIssues(
    requestContext: AuthorizedClientRequestContext,
    projectId: string,
    iModelId?: string
  ) {
    let filter: FormFilterArray | undefined;
    if (iModelId) {
      filter = [];
      filter.push({ name: "_ContainerId", value: iModelId });
    }
    requestContext.enter();
    return this.getFormData(
      requestContext,
      projectId,
      "_Issues",
      undefined,
      undefined,
      filter
    );
  }
}

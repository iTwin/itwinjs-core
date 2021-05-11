---
containsMetadata: 'AvailableScopes'
---

# Available scopes

This list contains all the OAuth scopes that are required for an application to interact with various portions of the iTwin Services.

| Name                     | Description                                                                                  |
|--------------------------|----------------------------------------------------------------------------------------------|
| openid                   | Required to get the id_token and the id of the user                                          |
| profile                  | Required to get the user profile – the first and last names                                  |
| organization             | Required to get the user’s organization information                                          |
| email                    | Required to get the email of the user                                                        |
| imodelhub                | Required to access iModelHub, the service that allows access to the iModels                  |
| imodeljs-router                     | Access any iTwin.js backend hosted by Bentley (i.e. the General Purpose Backend) |
| general-purpose-imodeljs-backend    | Required to access the iTwin.js General Purpose Backend                          |
| rbac-user:external-client           | Required to get the user's role-based permissions                                 |
| urlps-third-party                   | Required to report usage data to Bentley's usage logging service                  |
| context-registry-service:read-only  | Required to access the Context Registry, the service that allows access to an iTwin project |
| projectwise-share        | Required to view and manage data in ProjectWise Share                                        |
| product-settings-service | View and manage settings stored in the Product Settings Service                              |
| offline_access | Required to get a refresh_token (only supported in Desktop registration)                               |

---
containsMetadata: 'AvailableScopes'
---


# Available scopes

| Name                     | Description                                                                                  |
|--------------------------|----------------------------------------------------------------------------------------------|
| openid                   | Required to get the id_token and the id of the user                                          |
| profile                  | Required to get the user profile – the first and last names                                  |
| organization             | Required to get the user’s organization information                                          |
| email                    | Required to get the email of the user                                                        |
| imodelhub                | Required to access the iModelHub, the service that allows access to the iModels              |
| rbac-user:external-client |                                                                                             |
| urlps-third-party        | Third party access to Bentley's usage logging                                                |
| context-registry-service:read-only | Required to access the Context Registry, the service that allows access to a CONNECT project |
| imodeljs-router          | Access any iModel.js backend hosted by Bentley (i.e. the General Purpose Backend)            |
| visible-api-scope        |                                                                                              |
| product-settings-service |                                                                                              |
| components-center-service:external |                                                                                    |
| imodeljs-appregistry-api |                                                                                              |
| general-purpose-imodeljs-backend | Required to access the general purpose backend                                       |
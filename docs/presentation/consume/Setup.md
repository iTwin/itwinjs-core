# Setting Up the Library

In addition to setting up *imodeljs-core* there are some steps that API
consumers must do before the library can be used.

## Backend

1. Initialize the library:
  ``` ts
  [[include:Presentation.Backend.Initialization]]
  ```

2. Register `PresentationRpcInterface` (amongst other RPC interfaces):
  ``` ts
  [[include:Presentation.Common.Imports]]
  ```
  ``` ts
  [[include:Presentation.Common.RpcInterface]]
  ```
  ``` ts
  [[include:Presentation.Backend.RpcInterface]]
  ```

## Frontend

1. Initialize the library:
  ``` ts
  [[include:Presentation.Frontend.Imports]]
  ```
  ``` ts
  [[include:Presentation.Frontend.Initialization]]
  ```

2. Register `PresentationRpcInterface` (amongst other RPC interfaces):
  ``` ts
  [[include:Presentation.Common.Imports]]
  ```
  ``` ts
  [[include:Presentation.Common.RpcInterface]]
  ```
  ``` ts
  [[include:Presentation.Frontend.RpcInterface]]
  ```

# Setting Up the Library

In addition to setting up *imodeljs-core* there are some steps that API
consumers must do before the library can be used.

## Backend

1. Initialize:
  ``` ts
  [[include:Backend.Initialization.Presentation]]
  ```
2. Initialize `PresentationRpcInterface` (amongst other RPC interfaces):
  ``` ts
  [[include:Backend.Imports]]
  ```
  ``` ts
  [[include:Backend.Initialization.RpcInterface]]
  ```

## Frontend

1. Import dependencies:
  ``` ts
  [[include:Frontend.Imports]]
  ```

2. Initialize:
  ``` ts
  [[include:Frontend.Initialization.Presentation]]
  ```

3. Initialize `PresentationRpcInterface` (amongst other RPC interfaces):
  ``` ts
  [[include:Frontend.Initialization.RpcInterface]]
  ```

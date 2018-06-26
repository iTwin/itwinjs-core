# Setting Up ECPresentation Library

In addition to setting up *imodeljs-core* there are some steps that API
consumers must do before ECPresentation library can be used.

## Backend

1. Initialize `ECPresentation`:
  ``` ts
  [[include:Backend.Initialization.ECPresentation]]
  ```
2. Initialize `ECPresentationRpcInterface` (amongst other RPC interfaces):
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

2. Initialize `ECPresentation`:
  ``` ts
  [[include:Frontend.Initialization.ECPresentation]]
  ```

3. Initialize `ECPresentationRpcInterface` (amongst other RPC interfaces):
  ``` ts
  [[include:Frontend.Initialization.RpcInterface]]
  ```

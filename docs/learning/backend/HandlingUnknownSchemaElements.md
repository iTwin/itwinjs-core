## Handling of schemas with unsupported/wrong elements

A schema with a newer ECXml version might contain elements not recognized by the older ECDb runtime. Additionally, a schema might include incorrect elements, such as an ECProperty tag used to denote a struct inside an entity class. A read-compatible but write-incompatible schema (with only an ECXml minor version increment) cannot be imported into the iModel. However, any schema, except for version 3.2 of the ECXml schema, can be deserialized and loaded into memory. This schema version is also restricted from being serialized to a file or a string.

### Behavior of wrong property types across different versions during deserialization

| Version | Behavior during deserialization |
| - | - |
| Versions older than latest (known to ECDb runtime) | Throws an error |
| Latest Version | Throws an error |
| Versions newer than latest | Defaults to `string` |

### Behavior during deserialization

| Schema Element or Attribute | Behavior during deserialization |
| - | - |
| Unsupported class modifier | Defaults to `none` |
| Unsupported class mapping strategy | Schema gets deserialized successfully |
| Unsupported schema item type | Schema Item gets ignored |
| Unsupported attribute in a schema item | The attribute gets ignored |
| Unsupported primitive type | Defaults to `string` |
| Unsupported property kind | Schema element gets ignored |
| Unsupported backing type in ECEnumeration | Defaults to `string` |
| Unsupported relationship class strength | Defaults to `referencing` |

### Reading a newer schema already present in a newer iModel

A newer iModel may contain schemas that are write incompatible due to elements unsupported/unknown to the ECDb runtime being used.
When reading such a schema with an older ECDb runtime, a reduced form of the schema will be loaded where only the elements the ECDb runtime understands are read.

| Schema Element or Attribute | Behavior when reading from iModel |
| - | - |
| Unsupported class modifier | The class and any sub-classes will not be loaded |
| Unsupported class mapping strategy | Class and any sub-classes will be loaded, but querying them will return null values. |
| Unsupported schema item type | The schema item will not be loaded |
| Unsupported attribute in a schema item | The schema item will not be loaded  |
| Unsupported primitive type | The property will not be loaded |
| Unsupported property kind | The property will not be loaded |
| Unsupported backing type in ECEnumeration | The enumeration will not be loaded |
| Unsupported relationship class strength | The relationship class and it's corresponding navigation properties will not be loaded |
| Unsupported relationship class direction | The relationship class and it's corresponding navigation properties will not be loaded |
| Unsupported navigation property direction | The navigation property will not be loaded |


### Querying a class which has an unsupported mapping strategy

A newer iModel might contain a class which is mapped to the Db tables in a way that is unsupported by or unknown to the ECDb runtime being used.
These classes can be loaded successfully, as the user might want to look at the layout to see how the properties and/or relationships are estabished in the schema.
However, querying these classes and it's sub-classes is restricted due to the unknown nature of the db mapping.

Consider the following example schema:

``` xml
<ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.9">
  <ECEntityClass typeName="Employee">
    <ECProperty propertyName="EmployeeId" typeName="int"/>
    <ECNavigationProperty propertyName="Company" relationshipName="EmployeeWorksAtCompany" direction="Forward"/>
  </ECEntityClass>

  <ECEntityClass typeName="Engineer">
    <BaseClass>Employee</BaseClass>
    <ECProperty propertyName="TeamName" typeName="string"/>
  </ECEntityClass>

  <ECEntityClass typeName="Manager">
    <BaseClass>Engineer</BaseClass>
    <ECProperty propertyName="NoOfEmployeesManaged" typeName="int"/>
  </ECEntityClass>

  <ECEntityClass typeName="Company">
    <ECProperty propertyName="CompanyName" typeName="string"/>
    <ECNavigationProperty propertyName="Engineers" relationshipName="CompanyHasEngineers" direction="Forward"/>
  </ECEntityClass>

  <ECRelationshipClass typeName="EmployeeWorksAtCompany" strength="Referencing" modifier="Sealed" strengthDirection="Forward">
    <Source multiplicity="(0..*)" polymorphic="False" roleLabel="Employee">
      <Class class ="Employee"/>
    </Source>
    <Target multiplicity="(1..1)" polymorphic="False" roleLabel="Company">
      <Class class ="Company"/>
    </Target>
  </ECRelationshipClass>

  <ECRelationshipClass typeName="CompanyHasEngineers" strength="Referencing" modifier="Sealed" strengthDirection="Forward">
    <Source multiplicity="(0..*)" polymorphic="False" roleLabel="Company">
      <Class class ="Company"/>
    </Source>
    <Target multiplicity="(1..1)" polymorphic="False" roleLabel="Engineer">
      <Class class ="Engineer"/>
    </Target>
  </ECRelationshipClass>
</ECSchema>
```
All schema, classes and properties will be loaded successfully.

Refer to the tables below on how queries will work when one or more classes have an unsupported mapping strategy.
#### If the class `ts.Employee` has an unsupported mapping strategy:

| ECSql Query | ECSql Prepare Result | Result | Explanation |
| - | - | - | - |
| select * from ts.Employee | Success | Null/Empty row | `ts.Employee` has unsupported mapping |
| select * from ts.Engineer | Success | Null/Empty row | `ts.Engineer` has a parent class with unsupported mapping |
| select * from ts.Manager | Success | Null/Empty row  | `ts.Manager` has a base class with unsupported mapping |
| select * from ts.Company | Success | Valid row but without Engineers column | Engineers nav prop has `ts.Engineer` as the target constraint class |
| select ECInstanceId, CompanyName from ts.Company | Success | Valid row | None of the columns have any overlap with `ts.Employee` or any of it's sub-classes |
| select CompanyName, Engineers from ts.Company | Invalid ECSql | Error | Explicit select for `Engineers` property which has `ts.Engineer` as the target constraint class |
| select * from ts.EmployeeWorksAtCompany | Success | Null/Empty row | `ts.EmployeeWorksAtCompany` has `ts.Employee` as the source constraint class |
| select * from ts.CompanyHasEngineers | Success | Null/Empty row | `ts.CompanyHasEngineers` has `ts.Engineer` as the target constraint class |


#### If the class `ts.Engineer` has an unsupported mapping strategy:

| ECSql Query | ECSql Prepare Result | Result | Explanation |
| - | - | - | - |
| select * from ts.Employee | Success | Valid row | Unsupported mapping in any sub-class should not affect base class |
| select * from ts.Engineer | Success | Null/Empty row | `ts.Engineer` has unsupported mapping |
| select * from ts.Manager | Success | Null/Empty row  | Parent class `ts.Engineer` has unsupported mapping |
| select * from ts.Company | Success | Valid row but without Engineers column | Engineers nav prop has `ts.Engineer` as the target constraint class |
| select ECInstanceId, CompanyName from ts.Company | Success | Valid row | None of the columns have any overlap with `ts.Engineer` or `ts.Manager` |
| select CompanyName, Engineers from ts.Company | Invalid ECSql | Error | Explicit select for `Engineers` property which has `ts.Engineer` as the target constraint class |
| select * from ts.EmployeeWorksAtCompany | Success | Valid row | `ts.Engineer` or `ts.Manager` are not a constraint class |
| select * from ts.CompanyHasEngineers | Success | Null/Empty row | `ts.Engineer` is the target constraint class |


#### If the class `ts.Manager` has an unsupported mapping strategy:

| ECSql Query | ECSql Prepare Result | Result | Explanation |
| - | - | - | - |
| select * from ts.Employee | Success | Valid row | Unsupported mapping in any sub-class should not affect base class |
| select * from ts.Engineer | Success | Valid row | Unsupported mapping in any sub-class should not affect base class |
| select * from ts.Manager | Success | Null/Empty row  | `ts.Manager` has unsupported mapping |
| select * from ts.Company | Success | Valid row | `ts.Manager` is not a base class nor a constraint class in any nav prop |
| select CompanyName, Engineers from ts.Company | Success | Valid row | `ts.Manager` is not a base class nor a constraint class in any nav prop |
| select * from ts.EmployeeWorksAtCompany | Success | Valid row | `ts.Manager` is not a constraint class |
| select * from ts.CompanyHasEngineers | Success | Null/Empty row | `ts.Manager` is not a constraint class |

#### If the classes `ts.Engineer` and `ts.Manager` have an unsupported mapping strategy:

| ECSql Query | ECSql Prepare Result | Result | Explanation |
| - | - | - | - |
| select * from ts.Employee | Success | Valid row | Unsupported mapping in any sub-class should not affect base class |
| select * from ts.Engineer | Success | Null/Empty row  | `ts.Engineer` has unsupported mapping |
| select * from ts.Manager | Success | Null/Empty row  | `ts.Manager` has unsupported mapping |
| select * from ts.Company | Success | Valid row but without Engineers column | `Engineers` nav prop has `ts.Engineer` as the target constraint class |
| select ECInstanceId, CompanyName from ts.Company | Success | Valid row | None of the columns have any overlap with `ts.Engineer` or `ts.Manager` |
| select CompanyName, Engineers from ts.Company | Invalid ECSql | Error | Explicit select for `Engineers` property which has `ts.Engineer` as the target constraint class |
| select * from ts.EmployeeWorksAtCompany | Success | Valid row | `ts.Engineer` and `ts.Manager` are not constraint classes |
| select * from ts.CompanyHasEngineers | Success | Null/Empty row | `ts.Engineer` is a constraint class |
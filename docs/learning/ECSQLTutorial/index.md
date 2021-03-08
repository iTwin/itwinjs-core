# Learning ECSQL

This tutorial allows you to learn how to use ECSQL to read and query the business data in your iModels.

ECSQL is an implementation of SQL — a proven, well-adopted text-based command language. It adheres to
standard SQL (SQL-92 and SQL-99) wherever possible.

## Prerequisites

### SQL

In the course of the tutorial you will notice how similar ECSQL and SQL are. To not reinvent the wheel, this tutorial therefore expects you to be familiar with the basics of SQL. **If you are new to SQL, please take a class on the SQL basics first.**

### iModelConsole

The tutorial makes reference to the **iModelConsole** application.  Use the app to follow along with the tutorial by executing the ECSQL examples yourself.  You can also experiment with your own ECSQL statements.

[Open the iModelConsole](https://imodelconsole.bentley.com/)

### Sample iModel

The ECSQL examples in the tutorial work with the "House Sample" iModel. You can explore the imodels [here](https://itwinjs.org/sample-showcase/).

### BIS

The schemas for iModels are based on [BIS](../../bis/index.md). Therefore, the examples throughout the tutorial use the BIS schemas. While not required to learn ECSQL, familiarity with BIS is a good idea to get more from this tutorial.

## Scope

The data in iModels can only be modified via the respective APIs. ECSQL is used to query the data from iModels. Therefore the tutorial only covers the query portion of ECSQL, i.e. **ECSQL SELECT** statements.

## How to use the tutorial

The tutorial looks at typical questions and finds the respective ECSQL answer to it. The goal of the tutorial is that you can try out all ECSQL statements used in the lessons yourself. The tool to run the ECSQL statements is the [iModelConsole](#imodelconsole) with the tutorial's [Sample iModel](#sample-imodel).

This also enables you to experiment more with ECSQL by modifying the tutorial's ECSQL statements or by trying out your own ECSQL statements.

### Step 1 - Start the iModelConsole

If you want to follow along with your own iModel:

1. Launch the console at <https://imodelconsole.bentley.com>
2. Authenticate with your iTwin credentials.
3. Open your iModel by clicking on the iModels in the table

### Step 2 - Open the sample iModel

For this ECSQL tutorial, the embedded console will attach to the sample iModel we provide.

### Step 3 - Run an ECSQL in the iModelConsole

Once you have opened your iModel, just type in the ECSQL and hit *Enter* to execute it.

Or simply use the provided sample below:

> **Try it yourself**
>
> *ECSQL*
>
> ```sql
> SELECT * FROM bis.Element
> ```

<iframe class="embedded-console" src="/console/?imodel=House Sample Bak&query=SELECT * FROM bis.Element"></iframe>

## Tutorial Overview

- [Lesson 1: Key to ECSQL](./KeyToECSQL.md)
- [Lesson 2: The first examples](./FirstExamples.md)
- [Lesson 3: ECSQL Data Types](./ECSQLDataTypes.md)
- [Lesson 4: Relationships and Joins](./Joins.md)
- [Lesson 5: Class Polymorphism](./PolymorphicQueries.md)
- [Lesson 6: Spatial Queries](./SpatialQueries.md)
- [Lesson 7: Meta Queries - Querying ECSchemas](./MetaQueries.md)
- [Lesson 8: Querying Change Summaries](./ChangeSummaryQueries.md)
- [Lesson 9: Type Filter](./TypeFilter.md)
- [Lesson 10: Conditional Expressions](./ConditionalExpr.md)
- [Lesson 11: Built-In functions](./BuiltInFunctions.md)

---

[**Next >**](./KeyToECSQL.md)

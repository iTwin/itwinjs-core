# Learning ECSQL

> The tutorial is still a **work in progress**. The iModelConsole and the sample iModel used in the tutorial are not yet publicly available. However, you can still use the tutorial and learn ECSQL. You won't be able to run and experiment with the examples though.

This tutorial allows you to learn how to use ECSQL to read and query the business data in your iModels.

ECSQL is an implementation of SQL — a proven, well-adopted text-based command language. It sticks to
standard SQL (SQL-92 and SQL-99) wherever possible.

## Prerequisites

### SQL

In the course of the tutorial you will notice how similar ECSQL and SQL are. To not reinvent the wheel, this tutorial therefore expects you to be familiar with the basics of SQL. **If you are new to SQL, please take a class on the SQL basics first.**

### iModelConsole

**WIP**
You will also need to use the **iModelConsole** to try out the ECSQL examples in the tutorial yourself and to experiment with your own ECSQL statements. You can download it from here XXX. Follow the instructions on XXX for how to install and run it.

> In the iModelConsole run the `.help` command to see all available commands.

### Sample iModel

**WIP**
The ECSQL examples in the tutorial work with the sample iModel which you can download from here: XXX

### BIS

The schemas for iModels are based on [BIS](../../bis/index.md). Therefore, the examples throughout the tutorial use the BIS schemas. While not required to learn ECSQL, familiarity with BIS is a good idea to get more from this tutorial.

## Scope

The data in iModels can only be modified via the respective APIs. ECSQL is used to query the data from iModels. Therefore the tutorial only covers the query portion of ECSQL, i.e. **ECSQL SELECT** statements.

## How to use the tutorial

The tutorial looks at typical questions and finds the respective ECSQL answer to it. The goal of the tutorial is that you can try out all ECSQL statements used in the lessons yourself. The tool to run the ECSQL statements is the [iModelConsole](#imodelconsole) with the tutorial's [Sample iModel](#sample-imodel).

This also enables you to experiment more with ECSQL by modifying the tutorial's ECSQL statements or by trying out your own ECSQL statements.

### Step 1 - Start the iModelConsole

1. Launch the console (TBD)
1. Authenticate with your CONNECT credentials.

### Step 2 - Open the sample iModel

Run this command:

> `.open -path:<path to sample imodel>`

### Step 3 - Run an ECSQL in the iModelConsole

Once you opened the iModel just type in the ECSQL (without a leading .) and hit *Enter* to execute it.

> **Try it yourself**
>
> *ECSQL*
> ```sql
> SELECT count(*) ElementCount FROM bis.Element
> ```
>
> *Result*
>
> ElementCount |
> --- |
> 80 |

## Tutorial Overview

* [Lesson 1: Key to ECSQL](./KeyToECSQL.md)
* [Lesson 2: The first examples](./FirstExamples.md)
* [Lesson 3: ECSQL Data Types](./ECSQLDataTypes.md)
* [Lesson 4: Relationships and Joins](./Joins.md)
* [Lesson 5: Class Polymorphism](./PolymorphicQueries.md)
* [Lesson 6: Spatial Queries](./SpatialQueries.md)
* [Lesson 7: Meta Queries - Querying ECSchemas](./MetaQueries.md)
* [Lesson 8: Querying Change Summaries](./ChangeSummaryQueries.md)

---

[**Next >**](./KeyToECSQL.md)
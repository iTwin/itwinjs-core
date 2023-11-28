import * as dotenv from "dotenv";

const { error } = dotenv.config();

if (error && !process.env.CI)
  throw new Error("no env file found, and not ran as a CI job");

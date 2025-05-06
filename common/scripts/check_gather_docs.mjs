import fs from "fs";
import path from "path";

function checkFile(filePath, currentBranch) {
  // const filePath = path.normalize("./common/config/azure-pipelines/templates/gather-docs.yaml")
  if (!fs.existsSync(filePath)) {
    console.error("File not found.");
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, "utf8");

  const textToFind = /branchName: refs\/heads\/release\/\d+\.\d+\.x/gi;
  const branchInFile = fileContent.match(textToFind);

  if (!branchInFile) {
    console.error("No match for branch name found");
    process.exit(1);
  }

  if (branchInFile[0] === `branchName: ${currentBranch}`) {
    console.log("The current branch  matches the branch in gather-docs.yaml. No update Needed.");
    return false;
  }
  else {
    const newContent = fileContent.replace(textToFind, `branchName: ${currentBranch}`);
    fs.writeFileSync(filePath, newContent, "utf8");
    console.log("Updated gather-docs.yaml with the current branch.");
    return true;
  }
}

function main() {
  const filePath = path.normalize("./common/config/azure-pipelines/templates/gather-docs.yaml")
  const currentBranch = process.env.CURRENT_BRANCH;

  const textToFind = /refs\/heads\/release\/\d+\.\d+\.x/gi;
  if (!currentBranch.match(textToFind)) {
    console.error("Invalid branch name.");
    process.exit(1);
  }

  checkFile(filePath, currentBranch);
}
main();

// Tests
function createTempFile(name, content) {
  const tempFilePath = path.join('./', `${name}`);

  fs.writeFileSync(tempFilePath, content, "utf8");
  console.log(`Temporary file created at: ${tempFilePath}`);

  return tempFilePath;
}

function deleteTempFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Temporary file deleted: ${filePath}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
}

function tests() {
  const currentBranch = "refs/heads/release/1.2.x";
  // Test for when file needs to be updated
  let filePath = createTempFile("should-change.txt", "branchName: refs/heads/release/0.0.x");
  console.assert(checkFile(filePath, currentBranch) === true, "File should be updated");
  deleteTempFile(filePath);

  filePath = createTempFile("should-not-change.txt", "branchName: refs/heads/release/1.2.x");
  console.assert(checkFile(filePath, currentBranch) === false, "File should not be updated");
  deleteTempFile(filePath);
}
// tests();
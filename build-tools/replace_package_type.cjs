// eslint-disable-next-line @typescript-eslint/no-var-requires
const {readFileSync, writeFileSync} = require("fs");

/**
 * Temporary script to replace module type on windows
 */

let packageJson = readFileSync("package.json").toString();
packageJson = packageJson.replace(
  new RegExp(`"type":\\s*"${process.argv[2]}",`, "g"),
  `"type": "${process.argv[3]}",`
)
writeFileSync("package.json", packageJson);

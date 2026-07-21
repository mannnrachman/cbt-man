import fs from "fs";
import path from "path";

const target = path.join(process.cwd(), "src/lib/server/repos/functions.ts");
let content = fs.readFileSync(target, "utf8");

const startMarker = "async function loadSnapshotRows";
const startIndex = content.indexOf(startMarker);

const endMarker = "async function buildSnapshotForUser";
const endIndex1 = content.indexOf(endMarker);
const endIndex2 = content.indexOf("}", endIndex1);

if (startIndex === -1 || endIndex1 === -1 || endIndex2 === -1) {
    console.error("Markers not found!");
    process.exit(1);
}

const finalContent = content.substring(0, startIndex) + 
    `export * from "./snapshot";\nimport { buildSnapshotForUser } from "./snapshot";\n` + 
    content.substring(endIndex2 + 1);

fs.writeFileSync(target, finalContent, "utf8");
console.log("Successfully extracted snapshot from functions.ts");

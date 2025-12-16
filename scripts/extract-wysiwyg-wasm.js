#!/usr/bin/env node

/**
 * Script to extract matrix-wysiwyg-wasm bundled dependency from the yarn cache
 * This is needed because yarn doesn't properly extract bundled dependencies
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const wasmTargetDir = path.resolve(
    __dirname,
    "../node_modules/@vector-im/matrix-wysiwyg/node_modules/@vector-im/matrix-wysiwyg-wasm",
);

// Check if already extracted
if (fs.existsSync(path.resolve(wasmTargetDir, "package.json"))) {
    console.log("matrix-wysiwyg-wasm already extracted, skipping...");
    process.exit(0);
}

// Find the zip file in yarn cache
const homeDir = require("os").homedir();
const yarnCachePattern = path.join(
    homeDir,
    ".yarn/berry/cache/@vector-im-matrix-wysiwyg-npm-2.38.0-*.zip",
);

try {
    // Use find to locate the zip file
    const findResult = execSync(`find ${homeDir}/.yarn -name "*matrix-wysiwyg*2.38.0*.zip" -type f 2>/dev/null | head -1`, {
        encoding: "utf-8",
    }).trim();

    if (!findResult) {
        console.warn("Warning: Could not find matrix-wysiwyg zip file in yarn cache");
        process.exit(0);
    }

    const zipFile = findResult;

    // Create target directory
    fs.mkdirSync(wasmTargetDir, { recursive: true });

    // Extract the bundled dependency
    const extractPath = "node_modules/@vector-im/matrix-wysiwyg/node_modules/@vector-im/matrix-wysiwyg-wasm/*";
    execSync(`unzip -q -o "${zipFile}" "${extractPath}" -d /tmp`, { stdio: "inherit" });

    // Copy to target location
    const tmpPath = path.join("/tmp", extractPath.replace("/*", ""));
    if (fs.existsSync(tmpPath)) {
        execSync(`cp -r "${tmpPath}"/* "${wasmTargetDir}/"`, { stdio: "inherit" });
        console.log("Successfully extracted matrix-wysiwyg-wasm");
    } else {
        console.warn("Warning: Extracted files not found in expected location");
    }
} catch (error) {
    console.warn("Warning: Failed to extract matrix-wysiwyg-wasm:", error.message);
    // Don't fail the build if extraction fails
    process.exit(0);
}









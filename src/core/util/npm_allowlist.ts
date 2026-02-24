// src/core/util/npm_allowlist.ts
// Allowlist of npm packages that services can use.
// Only packages in this list will be bundled into services.
// This provides a security layer - arbitrary npm packages cannot be imported.

/**
 * Allowed npm packages for services.
 * Format: package-name -> version (or "*" for any version)
 * 
 * To add a new package:
 * 1. Review the package source code for security
 * 2. Ensure it has no problematic dependencies
 * 3. Add it here with a pinned version or "*"
 * 4. Update deno.json imports if needed
 */
export const ALLOWED_NPM_PACKAGES: Record<string, string> = {
    // URL cleaning/normalization
    "tidy-url": "*",

    // Future additions go here
    // "lodash": "4.17.21",
    // "date-fns": "*",
};

/**
 * Check if an npm package import is allowed
 * @param packageSpec - Full import specifier (e.g., "npm:tidy-url" or "npm:tidy-url@1.18.3")
 * @returns true if the package is in the allowlist
 */
export function isNpmPackageAllowed(packageSpec: string): boolean {
    if (!packageSpec.startsWith("npm:")) return false;

    // Extract package name from specifier
    // Handles: npm:package, npm:package@version, npm:@scope/package, npm:@scope/package@version
    const withoutNpm = packageSpec.slice(4);
    let packageName: string;
    let packageVersion: string | undefined;

    if (withoutNpm.startsWith("@")) {
        // Scoped package: @scope/name or @scope/name@version
        const parts = withoutNpm.split("@");
        if (parts.length >= 3) {
            // @scope/name@version -> ["", "scope/name", "version"]
            packageName = "@" + parts[1];
            packageVersion = parts[2];
        } else {
            // @scope/name -> ["", "scope/name"]
            packageName = "@" + parts[1];
        }
    } else {
        // Regular package: name or name@version
        const atIdx = withoutNpm.indexOf("@");
        if (atIdx > 0) {
            packageName = withoutNpm.slice(0, atIdx);
            packageVersion = withoutNpm.slice(atIdx + 1);
        } else {
            packageName = withoutNpm;
        }
    }

    const allowedVersion = ALLOWED_NPM_PACKAGES[packageName];
    if (!allowedVersion) return false;

    // If allowlist specifies "*", any version is ok
    if (allowedVersion === "*") return true;

    // If no version in import, allow (will use allowlisted version)
    if (!packageVersion) return true;

    // Version must match exactly
    return packageVersion === allowedVersion;
}

/**
 * Get the list of allowed npm package names
 */
export function getAllowedNpmPackages(): string[] {
    return Object.keys(ALLOWED_NPM_PACKAGES);
}

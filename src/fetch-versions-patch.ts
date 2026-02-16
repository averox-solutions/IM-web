/*
 * Patch global fetch to rewrite GET /_matrix/client/versions to POST with password.
 * Must be loaded before matrix-js-sdk (custom server requirement).
 */
const originalFetch = window.fetch;
// process.env.REACT_APP_MATRIX_PASSWORD is injected at build time via webpack DefinePlugin
const matrixPassword = process.env.REACT_APP_MATRIX_PASSWORD ?? "";

if (originalFetch) {
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const method = init?.method ?? (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET");

        if (method === "GET" && url.includes("/_matrix/client/versions")) {
            return originalFetch.call(
                window,
                typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url,
                {
                    ...init,
                    method: "POST",
                    headers: {
                        ...init?.headers,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ password: matrixPassword }),
                },
            );
        }

        return originalFetch.call(window, input, init);
    };
}

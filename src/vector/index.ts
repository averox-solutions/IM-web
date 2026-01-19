/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2019 Michael Telatynski <7t3chguy@gmail.com>
Copyright 2018, 2019 New Vector Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { shouldPolyfill as shouldPolyFillIntlSegmenter } from "@formatjs/intl-segmenter/should-polyfill";

// These are things that can run before the skin loads - be careful not to reference the react-sdk though.
import { parseQsFromFragment } from "./url_utils";
import "./modernizr";

// Load test utilities (safe to import - window check inside makes it safe)
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("../utils/testIceServers");

// Require common CSS here; this will make webpack process it into bundle.css.
// Our own CSS (which is themed) is imported via separate webpack entry points
// in webpack.config.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("katex/dist/katex.css");

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./localstorage-fix");

async function settled(...promises: Array<Promise<any>>): Promise<void> {
    for (const prom of promises) {
        try {
            await prom;
        } catch (e) {
            logger.error(e);
        }
    }
}

function checkBrowserFeatures(): boolean {
    // Browser compatibility check disabled - allow all browsers
    // This enables the app to work on mobile devices and older browsers
    return true;

    /* Original browser check code - disabled
    if (!window.Modernizr) {
        logger.error("Cannot check features - Modernizr global is missing.");
        return false;
    }

    // Custom checks atop Modernizr because it doesn't have checks in it for
    // some features we depend on.
    // Modernizr requires rules to be lowercase with no punctuation.
    // ES2018: http://262.ecma-international.org/9.0/#sec-promise.prototype.finally
    window.Modernizr.addTest("promiseprototypefinally", () => typeof window.Promise?.prototype?.finally === "function");
    // ES2020: http://262.ecma-international.org/#sec-promise.allsettled
    window.Modernizr.addTest("promiseallsettled", () => typeof window.Promise?.allSettled === "function");
    // ES2018: https://262.ecma-international.org/9.0/#sec-get-regexp.prototype.dotAll
    window.Modernizr.addTest(
        "regexpdotall",
        () => window.RegExp?.prototype && !!Object.getOwnPropertyDescriptor(window.RegExp.prototype, "dotAll")?.get,
    );
    // ES2019: http://262.ecma-international.org/10.0/#sec-object.fromentries
    window.Modernizr.addTest("objectfromentries", () => typeof window.Object?.fromEntries === "function");
    // ES2024: https://402.ecma-international.org/9.0/#sec-intl.segmenter
    // The built-in modernizer 'intl' check only checks for the presence of the Intl object, not the Segmenter,
    // and older Firefox has the former but not the latter, so we add our own.
    // This is polyfilled now, but we still want to show the warning because we want to remove the polyfill
    // at some point.
    window.Modernizr.addTest("intlsegmenter", () => typeof window.Intl?.Segmenter === "function");

    // Basic test for WebAssembly support. We could also try instantiating a simple module,
    // although this would start to make (more) assumptions about how rust-crypto loads its wasm.
    window.Modernizr.addTest("wasm", () => typeof WebAssembly === "object" && typeof WebAssembly.Module === "function");

    // Check that the session is in a secure context otherwise most Crypto & WebRTC APIs will be unavailable
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/isSecureContext
    window.Modernizr.addTest("securecontext", () => window.isSecureContext);

    const featureList = Object.keys(window.Modernizr) as Array<keyof ModernizrStatic>;

    let featureComplete = true;
    for (const feature of featureList) {
        if (window.Modernizr[feature] === undefined) {
            logger.error(
                "Looked for feature '%s' but Modernizr has no results for this. " + "Has it been configured correctly?",
                feature,
            );
            return false;
        }
        if (window.Modernizr[feature] === false) {
            logger.error("Browser missing feature: '%s'", feature);
            // toggle flag rather than return early so we log all missing features rather than just the first.
            featureComplete = false;
        }
    }
    return featureComplete;
    */
}

const supportedBrowser = checkBrowserFeatures();

// React depends on Map & Set which we check for using modernizr's es6collections
// if modernizr fails we may not have a functional react to show the error message.
// try in react but fallback to an `alert`
// We start loading stuff but don't block on it until as late as possible to allow
// the browser to use as much parallelism as it can.
// Load parallelism is based on research in https://github.com/element-hq/element-web/issues/12253
async function start(): Promise<void> {
    if (shouldPolyFillIntlSegmenter()) {
        await import(/* webpackChunkName: "intl-segmenter-polyfill" */ "@formatjs/intl-segmenter/polyfill-force");
    }

    // Prevent DevTools usage globally - comprehensive blocking including browser menus
    // Enabled in production mode OR when in responsive/mobile mode (window width <= 767px)
    const isProduction =
        process.env.REACT_APP_ENV === 'prod' ||
        process.env.REACT_APP_ENV === 'production' ||
        process.env.NODE_ENV === 'production' ||
        (process.env.REACT_APP_ENV !== 'dev' && process.env.REACT_APP_ENV !== 'development' && process.env.NODE_ENV !== 'development');

    // Check if in responsive/mobile mode
    const isResponsiveMode = window.innerWidth <= 767;

    // Override window.alert to prevent alerts in responsive mode
    if (isResponsiveMode) {
        window.alert = function (message?: any): void {
            // Silently ignore alerts in responsive mode
            console.log("[Alert suppressed in responsive mode]:", message);
            return;
        };
    }

    if (isProduction || isResponsiveMode) {
        (function blockDevTools() {
            // Detect DevTools using multiple methods
            let devtools = { open: false, orientation: null };
            let alertShown = false;

            // Establish baseline window dimensions on page load to account for zoom levels
            // Zoom changes affect window dimensions proportionally, so we track the baseline
            // and only trigger if the difference increases significantly (indicating DevTools)
            let baselineWidthDiff: number | null = null;
            let baselineHeightDiff: number | null = null;
            let baselineInnerWidth: number | null = null;
            let baselineInnerHeight: number | null = null;
            let baselineEstablished = false;
            const BASELINE_ESTABLISHMENT_DELAY = 500; // Wait 500ms after page load for dimensions to stabilize
            const SIGNIFICANT_INCREASE_THRESHOLD = 120; // DevTools adds at least 120px difference beyond baseline (lowered for better detection)
            const ZOOM_TOLERANCE = 0.1; // 10% tolerance for zoom-induced variations

            // Establish baseline after page has loaded and dimensions have stabilized
            // This accounts for initial zoom levels and browser chrome differences
            setTimeout(() => {
                baselineWidthDiff = window.outerWidth - window.innerWidth;
                baselineHeightDiff = window.outerHeight - window.innerHeight;
                baselineInnerWidth = window.innerWidth;
                baselineInnerHeight = window.innerHeight;
                baselineEstablished = true;
            }, BASELINE_ESTABLISHMENT_DELAY);

            // Aggressive detection function - runs very frequently
            const aggressiveDetection = () => {
                // Skip detection if baseline hasn't been established yet
                if (!baselineEstablished || baselineWidthDiff === null || baselineHeightDiff === null ||
                    baselineInnerWidth === null || baselineInnerHeight === null) {
                    return;
                }

                // Method 1: Window size detection (accounts for zoom levels)
                const currentWidthDiff = window.outerWidth - window.innerWidth;
                const currentHeightDiff = window.outerHeight - window.innerHeight;
                const currentInnerWidth = window.innerWidth;
                const currentInnerHeight = window.innerHeight;

                // Calculate the increase in difference from baseline FIRST
                // This is the PRIMARY metric for DevTools detection
                const widthDiffIncrease = currentWidthDiff - baselineWidthDiff;
                const heightDiffIncrease = currentHeightDiff - baselineHeightDiff;

                // KEY INSIGHT: When DevTools opens:
                // - innerWidth decreases (DevTools panel takes space)
                // - difference increases dramatically (200-400px+)
                // When zoom changes:
                // - innerWidth changes proportionally
                // - difference changes proportionally (small change)

                // Check for dramatic difference increase FIRST (primary DevTools signal)
                const dramaticIncrease = widthDiffIncrease > SIGNIFICANT_INCREASE_THRESHOLD ||
                    heightDiffIncrease > SIGNIFICANT_INCREASE_THRESHOLD;

                // Check if innerWidth decreased (strong DevTools signal - panel takes space)
                const innerWidthDecreased = currentInnerWidth < baselineInnerWidth;
                const innerHeightDecreased = currentInnerHeight < baselineInnerHeight;
                const significantInnerDecrease = (innerWidthDecreased &&
                    (baselineInnerWidth - currentInnerWidth) / baselineInnerWidth > 0.1) ||
                    (innerHeightDecreased &&
                        (baselineInnerHeight - currentInnerHeight) / baselineInnerHeight > 0.1);

                // DevTools pattern: innerWidth decreased AND difference increased dramatically
                const devToolsPattern = dramaticIncrease && significantInnerDecrease;

                let isDetected = false;

                if (devToolsPattern) {
                    // This matches DevTools pattern - trigger detection immediately
                    // No need to check for zoom when we have this clear DevTools signal
                    isDetected = true;
                } else if (dramaticIncrease) {
                    // Difference increased dramatically but innerWidth didn't decrease significantly
                    // This could be DevTools opening from a different position or zoom + DevTools
                    // Check if this could be explained by zoom
                    const innerWidthChangeRatio = Math.abs(currentInnerWidth - baselineInnerWidth) / baselineInnerWidth;
                    const innerHeightChangeRatio = Math.abs(currentInnerHeight - baselineInnerHeight) / baselineInnerHeight;

                    if (innerWidthChangeRatio > ZOOM_TOLERANCE || innerHeightChangeRatio > ZOOM_TOLERANCE) {
                        // Inner dimensions changed - check if proportional (zoom) or not (DevTools)
                        const widthZoomRatio = currentInnerWidth / baselineInnerWidth;
                        const heightZoomRatio = currentInnerHeight / baselineInnerHeight;

                        // Expected difference if this were just zoom
                        const expectedWidthDiff = baselineWidthDiff * widthZoomRatio;
                        const expectedHeightDiff = baselineHeightDiff * heightZoomRatio;

                        // Calculate deviation from expected proportional change
                        const widthDiffDeviation = Math.abs(currentWidthDiff - expectedWidthDiff);
                        const heightDiffDeviation = Math.abs(currentHeightDiff - expectedHeightDiff);

                        const ZOOM_PROPORTIONALITY_TOLERANCE = 100;
                        const isProportional = widthDiffDeviation < ZOOM_PROPORTIONALITY_TOLERANCE &&
                            heightDiffDeviation < ZOOM_PROPORTIONALITY_TOLERANCE;

                        if (isProportional) {
                            // This is zoom - update baseline
                            baselineWidthDiff = currentWidthDiff;
                            baselineHeightDiff = currentHeightDiff;
                            baselineInnerWidth = currentInnerWidth;
                            baselineInnerHeight = currentInnerHeight;
                            return; // Don't trigger DevTools detection
                        }
                        // Not proportional - likely DevTools
                        isDetected = true;
                    } else {
                        // Dramatic increase without inner dimension change = DevTools
                        isDetected = true;
                    }
                } else {
                    // No dramatic increase - could be zoom or nothing
                    const innerWidthChangeRatio = Math.abs(currentInnerWidth - baselineInnerWidth) / baselineInnerWidth;
                    const innerHeightChangeRatio = Math.abs(currentInnerHeight - baselineInnerHeight) / baselineInnerHeight;

                    if (innerWidthChangeRatio > ZOOM_TOLERANCE || innerHeightChangeRatio > ZOOM_TOLERANCE) {
                        // Inner dimensions changed but difference didn't increase dramatically = zoom
                        baselineWidthDiff = currentWidthDiff;
                        baselineHeightDiff = currentHeightDiff;
                        baselineInnerWidth = currentInnerWidth;
                        baselineInnerHeight = currentInnerHeight;
                        return; // Don't trigger DevTools detection
                    }
                    // No significant changes - nothing to detect
                    return;
                }

                if (isDetected && !devtools.open) {
                    devtools.open = true;
                    if (!alertShown) {
                        alertShown = true;
                        // Clear the entire page and show logo with message
                        document.body.innerHTML = `
                        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#1a1a1a;color:#ff4444;font-family:Arial,sans-serif;">
                            <img src="themes/element/img/logos/element-logo.svg" alt="Logo" style="width:200px;height:auto;margin-bottom:30px;opacity:0.9;" />
                            <h1 style="font-size:32px;margin:0;margin-bottom:10px;">Developer Tools Detected</h1>
                            <p style="font-size:18px;margin:0;color:#ff8888;">The page will reload automatically.</p>
                        </div>
                    `;
                        // Block all interactions
                        document.body.style.pointerEvents = 'none';
                        document.body.style.userSelect = 'none';
                        // Reload immediately
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    }
                } else if (!isDetected) {
                    devtools.open = false;
                    alertShown = false;
                }
            };

            // Method 2: Performance-based detection (catches browser menu-triggered DevTools)
            const detectDevTools = () => {
                try {
                    const start = performance.now();
                    // eslint-disable-next-line no-debugger
                    debugger;
                    const end = performance.now();
                    if (end - start > 100) {
                        if (!alertShown) {
                            alertShown = true;
                            document.body.innerHTML = `
                            <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#1a1a1a;color:#ff4444;font-family:Arial,sans-serif;">
                                <img src="themes/element/img/logos/element-logo.svg" alt="Logo" style="width:200px;height:auto;margin-bottom:30px;opacity:0.9;" />
                                <h1 style="font-size:32px;margin:0;margin-bottom:10px;">Developer Tools Detected</h1>
                                <p style="font-size:18px;margin:0;color:#ff8888;">The page will reload automatically.</p>
                            </div>
                        `;
                            document.body.style.pointerEvents = 'none';
                            setTimeout(() => {
                                window.location.reload();
                            }, 1000);
                        }
                    }
                } catch (e) {
                    // Ignore errors
                }
            };

            // Method 3: Focus/Blur detection (browser menu DevTools often causes focus loss)
            let focusTime = Date.now();
            window.addEventListener("blur", () => {
                focusTime = Date.now();
            });
            window.addEventListener("focus", () => {
                const timeDiff = Date.now() - focusTime;
                // If window was blurred for more than 100ms, check for DevTools
                if (timeDiff > 100) {
                    setTimeout(aggressiveDetection, 100);
                }
            });

            // Method 4: Visibility API detection
            document.addEventListener("visibilitychange", () => {
                if (!document.hidden) {
                    // Page became visible, check for DevTools immediately
                    aggressiveDetection();
                }
            });

            // Run aggressive detection very frequently to catch browser menu DevTools
            setInterval(aggressiveDetection, 200);
            setInterval(detectDevTools, 600);

            // Method 5: Block keyboard shortcuts for DevTools in responsive mode
            const blockDevToolsShortcuts = (event: KeyboardEvent): void => {
                // Check if still in responsive mode (window might have been resized)
                const stillResponsive = window.innerWidth <= 767;
                if (!stillResponsive) {
                    return; // Exit if no longer in responsive mode
                }

                const ctrlOrCmd = event.ctrlKey || event.metaKey;
                const shift = event.shiftKey;

                // Block F12 (common DevTools shortcut)
                if (event.key === 'F12') {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    return;
                }

                // Block Ctrl+Shift+I (Chrome/Edge DevTools)
                if (ctrlOrCmd && shift && (event.key === 'I' || event.key === 'i')) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    return;
                }

                // Block Ctrl+Shift+J (Chrome/Edge Console)
                if (ctrlOrCmd && shift && (event.key === 'J' || event.key === 'j')) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    return;
                }

                // Block Ctrl+Shift+C (Chrome/Edge Inspect Element)
                if (ctrlOrCmd && shift && (event.key === 'C' || event.key === 'c')) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    return;
                }

                // Block Ctrl+U (View Source - often used to inspect)
                if (ctrlOrCmd && (event.key === 'U' || event.key === 'u')) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                    return;
                }
            };

            // Add keyboard event listener with capture phase to catch before other handlers
            document.addEventListener('keydown', blockDevToolsShortcuts, true);
            window.addEventListener('keydown', blockDevToolsShortcuts, true);
        })();
    }

    // Disable browser's native right-click context menu everywhere
    // This prevents the browser's default context menu from appearing
    // but allows React's onContextMenu handlers to work normally
    const preventBrowserContextMenu = (e: MouseEvent) => {
        // Only prevent the default browser context menu
        // Don't stop propagation so React handlers can still fire
        e.preventDefault();
    };

    // Use capture phase on document to catch ALL contextmenu events early,
    // including those in dialogs, menus, and dynamically created elements
    // Capture phase fires before any child element handlers, ensuring we catch everything
    document.addEventListener('contextmenu', preventBrowserContextMenu, true);

    // Also add to window as a fallback for edge cases
    window.addEventListener('contextmenu', preventBrowserContextMenu, true);

    const {
        rageshakePromise,
        setupLogStorage,
        preparePlatform,
        loadConfig,
        loadLanguage,
        loadTheme,
        loadApp,
        loadModules,
        loadPlugins,
        showError,
        showIncompatibleBrowser,
        _t,
        extractErrorMessageFromError,
    } = await import(
        /* webpackChunkName: "init" */
        /* webpackPreload: true */
        "./init"
    );

    try {
        await settled(rageshakePromise);

        const fragparts = parseQsFromFragment(window.location);
        const preventRedirect = fragparts.params.client_secret || fragparts.location.length > 0;

        if (!preventRedirect) {
            // Mobile redirect disabled - web app is now fully mobile-optimized
            // Users can access the full web experience on mobile devices
            /* 
            const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const isAndroid = /Android/.test(navigator.userAgent);
            if (isIos || isAndroid) {
                if (document.cookie.indexOf("element_mobile_redirect_to_guide=false") === -1) {
                    window.location.href = "mobile_guide/";
                    return;
                }
            }
            */
        }

        preparePlatform();
        const loadConfigPromise = loadConfig();
        await settled(loadConfigPromise);

        const persistLogsPromise = setupLogStorage();
        const loadModulesPromise = loadModules();
        await settled(loadModulesPromise);
        const loadPluginsPromise = loadPlugins();
        await settled(loadPluginsPromise);

        const loadLanguagePromise = loadLanguage();
        const loadThemePromise = loadTheme();
        await settled(loadThemePromise, loadLanguagePromise);

        let acceptBrowser = supportedBrowser;
        if (!acceptBrowser && window.localStorage) {
            acceptBrowser = Boolean(window.localStorage.getItem("mx_accepts_unsupported_browser"));
        }

        if (!acceptBrowser) {
            await new Promise<void>((resolve, reject) => {
                logger.error("Browser is missing required features.");
                showIncompatibleBrowser(() => {
                    if (window.localStorage) {
                        window.localStorage.setItem("mx_accepts_unsupported_browser", String(true));
                    }
                    logger.log("User accepts the compatibility risks.");
                    resolve();
                }).catch(reject);
            });
        }

        try {
            await loadConfigPromise;
        } catch (error) {
            if (error instanceof SyntaxError) {
                return showError(_t("error|misconfigured"), [
                    _t("error|invalid_json"),
                    _t("error|invalid_json_detail", {
                        message: error.message || _t("error|invalid_json_generic"),
                    }),
                ]);
            }
            return showError(_t("error|cannot_load_config"));
        }

        await loadPluginsPromise;
        await loadModulesPromise;
        await loadThemePromise;
        await loadLanguagePromise;
        await settled(persistLogsPromise);

        await loadApp(fragparts.params);
    } catch (err) {
        logger.error(err);
        await showError(_t("error|misconfigured"), [
            extractErrorMessageFromError(err, _t("error|app_launch_unexpected_error")),
        ]);
    }
}


if (process.env.NODE_ENV === "production") {
    logger.debug = () => { };
    logger.log = () => { };
    logger.info = () => { };
    logger.warn = () => { };
    logger.error = () => { };
}

start().catch((err) => {
    // If we get here, things have gone terribly wrong and we cannot load the app javascript at all.
    // Show a different, very simple iframed-static error page. Or actually, one of two different ones
    // depending on whether the browser is supported (ie. we think we should be able to load but
    // failed) or unsupported (where we tried anyway and, lo and behold, we failed).
    logger.error(err);
    // show the static error in an iframe to not lose any context / console data
    // with some basic styling to make the iframe full page
    document.body.style.removeProperty("height");
    const iframe = document.createElement("iframe");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - typescript seems to only like the IE syntax for iframe sandboxing
    iframe["sandbox"] = "";
    iframe.src = supportedBrowser ? "static/unable-to-load.html" : "static/incompatible-browser.html";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.border = "0";
    document.getElementById("matrixchat")?.appendChild(iframe);
});
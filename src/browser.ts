import {
    BROWSER_EXECUTABLE_PATH,
    BROWSER_HEADLESS_ENABLE,
    BROWSER_PERSISTENT_ENABLE,
    BROWSER_PERSISTENT_USER_DATA_DIR,
    BROWSER_USE_INSTALLED_ON_SYSTEM,
} from './config';

import fs from 'fs';

import type { Browser, BrowserContext, Locator, Page } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';
import { LaunchOptions } from 'playwright-core';

export enum BrowserType {
    CHROMIUM = 'chromium',
    FIREFOX = 'firefox',
    WEBKIT = 'webkit',
}

export const DEFAULT_BROWSER_TYPE: BrowserType = BrowserType.CHROMIUM;

export type BrowserOptions = {
    browserType?: BrowserType;
    headless?: boolean;
    executablePath?: string;
    useInstalledOnSystem?: boolean;
};

export type BrowserContextOptions = {
    browserOptions: BrowserOptions;
    persistent?: {
        userDataDir: string;
    };
};

export type BrowserContextInfo = {
    browserContext: BrowserContext;
};

export type PageOptions = {};

const browsers: Map<string, Browser> = new Map();
const persistenceBrowserContexts: Map<string, BrowserContext> = new Map();

////////////////////////////////////////////////////////////////////////////////

function _browserKey(browserOptions: BrowserOptions): string {
    return JSON.stringify(browserOptions);
}

function _browserLaunchOptions(browserOptions: BrowserOptions): LaunchOptions {
    const launchOptions: LaunchOptions = {
        headless: browserOptions.headless,
        executablePath: browserOptions.executablePath,
        handleSIGINT: false,
        handleSIGTERM: false,
    };
    if (browserOptions.useInstalledOnSystem) {
        switch (browserOptions.browserType) {
            case BrowserType.CHROMIUM:
                launchOptions.channel = 'chrome';
                launchOptions.args = [
                    '--disable-blink-features=AutomationControlled',
                ];
                break;
            default:
                throw new Error(
                    `Browser type ${browserOptions.browserType} is not supported to be used from the one installed on the system`
                );
        }
    }
    return launchOptions;
}

async function _createBrowser(
    browserOptions: BrowserOptions
): Promise<Browser> {
    // Use the appropriate browser engine
    let browserInstance;
    switch (browserOptions.browserType) {
        case BrowserType.FIREFOX:
            browserInstance = firefox;
            break;
        case BrowserType.WEBKIT:
            browserInstance = webkit;
            break;
        case BrowserType.CHROMIUM:
        default:
            browserInstance = chromium;
            break;
    }
    return browserInstance.launch(_browserLaunchOptions(browserOptions));
}

async function _getBrowser(browserOptions: BrowserOptions): Promise<Browser> {
    const browserKey: string = _browserKey(browserOptions);
    let browserInstance: Browser | undefined = browsers.get(browserKey);
    if (browserInstance && !browserInstance.isConnected()) {
        try {
            await browserInstance.close().catch((): void => {});
        } catch {}
        browserInstance = undefined;
    }
    if (!browserInstance) {
        browserInstance = await _createBrowser(browserOptions);
        browsers.set(browserKey, browserInstance);
    }
    return browserInstance;
}

////////////////////////////////////////////////////////////////////////////////

function _persistentBrowserContextKey(
    browserContextOptions: BrowserContextOptions
): string {
    // There can be one active persistent browser context in a user data directory
    return browserContextOptions.persistent!.userDataDir;
}

function _persistentBrowserContextLaunchOptions(
    browserContextOptions: BrowserContextOptions
) {
    const browserOptions: BrowserOptions = browserContextOptions.browserOptions;
    const launchOptions = {
        headless: browserOptions.headless,
        executablePath: browserOptions.executablePath,
        bypassCSP: true,
    };
    if (browserOptions.useInstalledOnSystem) {
        switch (browserOptions.browserType) {
            case BrowserType.CHROMIUM:
                (launchOptions as any).channel = 'chrome';
                (launchOptions as any).args = [
                    '--disable-blink-features=AutomationControlled',
                ];
                break;
            default:
                throw new Error(
                    `Browser type ${browserOptions.browserType} is not supported to be used from the one installed on the system`
                );
        }
    }
    return launchOptions;
}

async function _createPersistentBrowserContext(
    browserContextOptions: BrowserContextOptions
): Promise<BrowserContext> {
    // Use the appropriate browser engine
    let browserInstance;
    switch (browserContextOptions.browserOptions.browserType) {
        case BrowserType.FIREFOX:
            browserInstance = firefox;
            break;
        case BrowserType.WEBKIT:
            browserInstance = webkit;
            break;
        case BrowserType.CHROMIUM:
        default:
            browserInstance = chromium;
            break;
    }

    const userDataDir: string = browserContextOptions.persistent!.userDataDir;

    // Be sure that user data dir is available
    fs.mkdirSync(userDataDir, { recursive: true });

    const browserContext: BrowserContext =
        await browserInstance.launchPersistentContext(
            userDataDir,
            _persistentBrowserContextLaunchOptions(browserContextOptions)
        );

    // Be sure that any restored pages are closed if there is any
    for (const p of browserContext.pages()) {
        try {
            await p.close();
        } catch {}
    }

    return browserContext;
}

async function _getPersistentBrowserContext(
    browserContextOptions: BrowserContextOptions
): Promise<BrowserContext> {
    const persistentBrowserContextKey: string = _persistentBrowserContextKey(
        browserContextOptions
    );
    let browserContext: BrowserContext | undefined =
        persistenceBrowserContexts.get(persistentBrowserContextKey);
    if (browserContext && !browserContext.browser()?.isConnected()) {
        try {
            await browserContext.close().catch((): void => {});
        } catch {}
        browserContext = undefined;
    }
    if (!browserContext) {
        browserContext = await _createPersistentBrowserContext(
            browserContextOptions
        );
        persistenceBrowserContexts.set(
            persistentBrowserContextKey,
            browserContext
        );
    } else {
        // There can be one active persistent browser context in a user data directory
        throw new Error(
            `There is already active persistent browser context in the user data directory: ${browserContextOptions.persistent?.userDataDir}`
        );
    }
    return browserContext;
}

////////////////////////////////////////////////////////////////////////////////

export async function newBrowserContext(
    browserContextOptions: BrowserContextOptions = {
        browserOptions: {
            browserType: DEFAULT_BROWSER_TYPE,
            headless: BROWSER_HEADLESS_ENABLE,
            executablePath: BROWSER_EXECUTABLE_PATH,
            useInstalledOnSystem: BROWSER_USE_INSTALLED_ON_SYSTEM,
        },
        persistent: BROWSER_PERSISTENT_ENABLE
            ? {
                  userDataDir: BROWSER_PERSISTENT_USER_DATA_DIR,
              }
            : undefined,
    }
): Promise<BrowserContextInfo> {
    if (browserContextOptions.persistent) {
        const browserContext: BrowserContext =
            await _getPersistentBrowserContext(browserContextOptions);
        return {
            browserContext,
        };
    } else {
        const browser: Browser = await _getBrowser(
            browserContextOptions.browserOptions
        );
        const browserContext: BrowserContext = await browser.newContext({
            bypassCSP: true,
        });
        return {
            browserContext,
        };
    }
}

export async function newPage(
    browserContext: BrowserContext,
    pageOptions: PageOptions = {}
): Promise<Page> {
    // TODO Design page options and take care of it here for the newly created page
    return await browserContext.newPage();
}

export async function closeBrowserContext(
    browserContext: BrowserContext
): Promise<boolean> {
    await browserContext.close();

    let deleted: boolean = false;
    for (const [key, val] of persistenceBrowserContexts.entries()) {
        if (browserContext === val) {
            persistenceBrowserContexts.delete(key);
            deleted = true;
        }
    }
    return deleted;
}

////////////////////////////////////////////////////////////////////////////////

async function getElementFailFast(
    page: Page,
    selector: string
): Promise<Locator> {
    const element: Locator = page.locator(selector);
    if ((await element.count()) === 0) {
        throw new Error(`Could not find element with selector "${selector}"`);
    }
    return element;
}

import { BROWSER_EXECUTABLE_PATH } from './config';
import type { Browser, BrowserContext, Page } from 'playwright';
import { chromium, firefox, webkit } from 'playwright';

export enum BrowserType {
    CHROMIUM = 'chromium',
    FIREFOX = 'firefox',
    WEBKIT = 'webkit',
}

export type BrowserOptions = {
    browserType?: BrowserType;
    executablePath?: string;
};

export type BrowserContextOptions = {};

export type PageOptions = {};

const browsers: Map<BrowserType, Browser> = new Map();

function _createBrowserOptions(browserType: BrowserType): BrowserOptions {
    return {
        browserType,
        executablePath: BROWSER_EXECUTABLE_PATH,
    };
}

async function _createBrowser(
    browserOptions: BrowserOptions = {}
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
    return browserInstance.launch({
        executablePath: browserOptions.executablePath,
        handleSIGINT: false,
        handleSIGTERM: false,
    });
}

export async function getBrowser(
    browserType: BrowserType = BrowserType.CHROMIUM
): Promise<Browser> {
    let browserInstance: Browser | undefined = browsers.get(browserType);
    if (browserInstance && !browserInstance.isConnected()) {
        try {
            await browserInstance.close().catch((): void => {});
        } catch (err: any) {
            // Ignore errors when closing disconnected browser
        }
        // Reset browser and page references
        browserInstance = undefined;
    }
    if (!browserInstance) {
        browserInstance = await _createBrowser(
            _createBrowserOptions(browserType)
        );
        browsers.set(browserType, browserInstance);
    }
    return browserInstance;
}

export async function newBrowserContext(
    browser: Browser,
    browserContextOptions: BrowserContextOptions = {}
): Promise<BrowserContext> {
    return await browser.newContext({
        bypassCSP: true,
    });
}

export async function newPage(
    browserContext: BrowserContext,
    pageOptions: PageOptions = {}
): Promise<Page> {
    return await browserContext.newPage();
}

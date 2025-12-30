import { McpSessionContext } from '../../context';
import {
    Tool,
    ToolInput,
    ToolInputSchema,
    ToolOutput,
    ToolOutputSchema,
} from '../types';
import {
    createEnumTransformer,
    formattedTimeForFilename,
    getEnumKeyTuples,
} from '../../utils';

import * as path from 'path';

import type { ElementHandle } from 'playwright';
import { z } from 'zod';

export enum ScreenshotType {
    PNG = 'png',
    JPEG = 'jpeg',
}

export interface TakeScreenshotInput extends ToolInput {
    outputPath: string;
    name?: string;
    selector?: string;
    fullPage?: boolean;
    type?: ScreenshotType;
}

export interface TakeScreenshotOutput extends ToolOutput {}

const DEFAULT_SCREENSHOT_NAME: string = 'screenshot';
const DEFAULT_SCREENSHOT_TYPE: ScreenshotType = ScreenshotType.PNG;

export class TakeScreenshot implements Tool {
    name(): string {
        return 'content_take-screenshot';
    }

    description(): string {
        return 'Takes a screenshot of the current page or a specific element.';
    }

    inputSchema(): ToolInputSchema {
        return {
            outputPath: z
                .string()
                .describe('Directory path where screenshot will be saved.'),
            name: z
                .string()
                .describe(
                    `Name of the screenshot. Default value is "${DEFAULT_SCREENSHOT_NAME}". ` +
                        'Note that final saved/exported file name is in the "{name}-{time}.{type}" format ' +
                        'in which "{time}" is in the "YYYYMMDD-HHmmss" format.'
                )
                .optional()
                .default(DEFAULT_SCREENSHOT_NAME),
            selector: z
                .string()
                .describe('CSS selector for element to take screenshot.')
                .optional(),
            fullPage: z
                .boolean()
                .describe(
                    'Whether to take a screenshot of the full scrollable page, instead of the currently visible viewport (default: "false").'
                )
                .optional()
                .default(false),
            type: z
                .enum(getEnumKeyTuples(ScreenshotType))
                .transform(createEnumTransformer(ScreenshotType))
                .describe(
                    `Page format. Valid values are: ${getEnumKeyTuples(ScreenshotType)}`
                )
                .optional()
                .default(DEFAULT_SCREENSHOT_TYPE),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            filePath: z
                .string()
                .describe('Full path of the saved screenshot file.'),
        };
    }

    async handle(
        context: McpSessionContext,
        args: TakeScreenshotInput
    ): Promise<TakeScreenshotOutput> {
        const screenshotType: ScreenshotType =
            args.type || DEFAULT_SCREENSHOT_TYPE;
        const filename: string = `${args.name || DEFAULT_SCREENSHOT_NAME}-${formattedTimeForFilename()}.${screenshotType}`;
        const filePath: string = path.resolve(args.outputPath, filename);

        const options: any = {
            path: filePath,
            type: screenshotType,
            fullPage: !!args.fullPage,
        };

        if (args.selector) {
            const element: ElementHandle | null = await context.page.$(
                args.selector
            );
            if (!element) {
                throw new Error(`Element not found: ${args.selector}`);
            }
            options.element = element;
        }

        await context.page.screenshot(options);

        return {
            filePath,
        };
    }
}

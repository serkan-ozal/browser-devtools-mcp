import { ToolSessionContext } from '../../context';
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

import os from 'os';
import path from 'path';

import { z } from 'zod';

export enum SizeUnit {
    PIXEL = 'px',
    INCH = 'in',
    CENTIMETER = 'cm',
    MILLIMETER = 'mm',
}

export enum PageFormat {
    LETTER = 'Letter',
    LEGAL = 'Legal',
    TABLOID = 'Tabloid',
    LEDGER = 'Ledger',
    A0 = 'A0',
    A1 = 'A1',
    A2 = 'A2',
    A3 = 'A3',
    A4 = 'A4',
    A5 = 'A5',
    A6 = 'A6',
}

export interface SaveAsPdfInput extends ToolInput {
    outputPath: string;
    name?: string;
    format?: PageFormat;
    printBackground?: boolean;
    margin?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
    };
}

export interface SaveAsPdfOutput extends ToolOutput {
    filePath: string;
}

const DEFAULT_NAME: string = 'page';
const DEFAULT_MARGIN: string = '1cm';
const DEFAULT_FORMAT: PageFormat = PageFormat.A4;

const DEFAULT_MARGINS = {
    top: DEFAULT_MARGIN,
    right: DEFAULT_MARGIN,
    bottom: DEFAULT_MARGIN,
    left: DEFAULT_MARGIN,
};

export class SaveAsPdf implements Tool {
    name(): string {
        return 'content_save-as-pdf';
    }

    description(): string {
        return 'Saves the current page as a PDF file.';
    }

    inputSchema(): ToolInputSchema {
        return {
            outputPath: z
                .string()
                .describe(
                    'Directory path where PDF will be saved. By default OS tmp directory is used.'
                )
                .optional()
                .default(os.tmpdir()),
            name: z
                .string()
                .describe(
                    `Name of the save/export. Default value is "${DEFAULT_NAME}". ` +
                        'Note that final saved/exported file name is in the "{name}-{time}.pdf" format ' +
                        'in which "{time}" is in the "YYYYMMDD-HHmmss" format.'
                )
                .optional()
                .default(DEFAULT_NAME),
            format: z
                .enum(getEnumKeyTuples(PageFormat))
                .transform(createEnumTransformer(PageFormat))
                .describe(
                    `Page format. Valid values are: ${getEnumKeyTuples(PageFormat)}.`
                )
                .optional()
                .default(DEFAULT_FORMAT),
            printBackground: z
                .boolean()
                .describe(
                    'Whether to print background graphics (default: "false").'
                )
                .optional()
                .default(false),
            margin: z
                .object({
                    top: z
                        .string()
                        .describe('Top margin.')
                        .default(DEFAULT_MARGIN),
                    right: z
                        .string()
                        .describe('Right margin.')
                        .default(DEFAULT_MARGIN),
                    bottom: z
                        .string()
                        .describe('Bottom margin.')
                        .default(DEFAULT_MARGIN),
                    left: z
                        .string()
                        .describe('Left margin.')
                        .default(DEFAULT_MARGIN),
                })
                .describe(
                    'Page margins. Numeric margin values labeled with units ("100px", "10cm", etc ...). ' +
                        'Unlabeled values are treated as pixels. ' +
                        `Valid units are: ${getEnumKeyTuples(SizeUnit)}.`
                )
                .optional(),
        };
    }

    outputSchema(): ToolOutputSchema {
        return {
            filePath: z.string().describe('Full path of the saved PDF file.'),
        };
    }

    async handle(
        context: ToolSessionContext,
        args: SaveAsPdfInput
    ): Promise<SaveAsPdfOutput> {
        const filename: string = `${args.name || DEFAULT_NAME}-${formattedTimeForFilename()}.pdf`;
        const filePath: string = path.resolve(args.outputPath, filename);

        const options = {
            path: filePath,
            format: args.format,
            printBackground: args.printBackground,
            margin: args.margin || DEFAULT_MARGINS,
        };

        await context.page.pdf(options);

        return {
            filePath,
        };
    }
}

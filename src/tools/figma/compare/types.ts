export type ImageType = 'png' | 'jpeg';

export type ScreenshotInfo = {
    /**
     * Raw image bytes.
     */
    image: Buffer;

    /**
     * Best-effort image type (helps with debugging/metadata decisions).
     */
    type: ImageType;

    /**
     * Optional human-friendly label for logs/diagnostics.
     */
    name?: string;
};

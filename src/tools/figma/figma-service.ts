import { FIGMA_ACCESS_TOKEN, FIGMA_API_BASE_URL } from '../../config';

import crypto from 'node:crypto';

export type FigmaImageFormat = 'png' | 'jpg';

export type FigmaScreenshotRequest = {
    /**
     * Figma file key.
     * Example:
     * https://www.figma.com/file/<FILE_KEY>/...
     */
    fileKey: string;

    /**
     * Node id inside the file (frame/component/etc).
     * Example: '123:456'
     */
    nodeId: string;

    /**
     * Image format to render.
     * Default: 'png'
     */
    format?: FigmaImageFormat;

    /**
     * Scale factor for raster export (Figma `scale`).
     * Typical: 1..4
     * Default: 2
     */
    scale?: number;

    /**
     * Optional: whether to include id in response.
     * Default: false
     */
    includeId?: boolean;
};

export type FigmaScreenshotResult = {
    /**
     * Raw image bytes.
     */
    image: Buffer;

    /**
     * Mime type of the image.
     */
    mimeType: string;

    /**
     * File extension type.
     */
    type: 'png' | 'jpeg';

    /**
     * Optional: nodeId returned back.
     */
    nodeId?: string;

    /**
     * Optional: fileKey returned back.
     */
    fileKey?: string;

    /**
     * Optional: a stable-ish id you can use for caching.
     */
    cacheKey: string;
};

type FigmaImageResponse = {
    err?: string;
    images?: Record<string, string>;
};

type FigmaFileNodesResponse = {
    err?: string;
    nodes?: Record<
        string,
        {
            document?: any;
            components?: any;
            styles?: any;
        }
    >;
};

function _requireFigmaToken(): string {
    const token: string | undefined = FIGMA_ACCESS_TOKEN;
    if (!token) {
        throw new Error('No Figma access token configured');
    }
    return token;
}

function _mimeTypeFor(format: FigmaImageFormat): {
    mimeType: string;
    type: 'png' | 'jpeg';
} {
    if (format === 'jpg') {
        return { mimeType: 'image/jpeg', type: 'jpeg' };
    }
    return { mimeType: 'image/png', type: 'png' };
}

function _buildCacheKey(req: FigmaScreenshotRequest): string {
    const h: crypto.Hash = crypto.createHash('sha256');
    h.update(req.fileKey);
    h.update('|');
    h.update(req.nodeId);
    h.update('|');
    h.update(req.format ?? 'png');
    h.update('|');
    h.update(String(req.scale ?? 2));
    return h.digest('hex').slice(0, 24);
}

async function _fetchJson<T>(url: string, token: string): Promise<T> {
    const res: Response = await fetch(url, {
        method: 'GET',
        headers: {
            'X-Figma-Token': token,
            Accept: 'application/json',
        },
    });

    const text: string = await res.text();
    let json: any;
    try {
        json = text ? JSON.parse(text) : {};
    } catch (e: unknown) {
        throw new Error(
            `Figma API returned non-JSON response (status=${res.status}). Body: ${text.slice(0, 500)}`
        );
    }

    if (!res.ok) {
        const msg: string =
            typeof json?.err === 'string'
                ? json.err
                : `Figma API error (status=${res.status})`;
        throw new Error(msg);
    }

    return json as T;
}

async function _fetchBinary(url: string): Promise<Buffer> {
    const res: Response = await fetch(url, { method: 'GET' });
    if (!res.ok) {
        const t: string = await res.text().catch((): string => '');
        throw new Error(
            `Failed to download Figma rendered image (status=${res.status}): ${t.slice(0, 300)}`
        );
    }
    const ab: ArrayBuffer = await res.arrayBuffer();
    return Buffer.from(ab);
}

/**
 * Fetches a rendered screenshot of a given node (frame/component/etc) from Figma.
 *
 * Implementation:
 * 1) Calls GET /images/:fileKey?ids=:nodeId&format=png|jpg&scale=N to get a temporary CDN URL.
 * 2) Downloads the image bytes from that URL.
 *
 * Notes:
 * - The returned URL is time-limited; download immediately.
 * - If you need strict determinism, set a fixed `scale`.
 */
export async function getFigmaDesignScreenshot(
    req: FigmaScreenshotRequest
): Promise<FigmaScreenshotResult> {
    const token: string = _requireFigmaToken();

    const format: FigmaImageFormat = req.format ?? 'png';
    const scale: number =
        typeof req.scale === 'number' && req.scale > 0 ? req.scale : 2;

    const { mimeType, type } = _mimeTypeFor(format);

    const base: string = FIGMA_API_BASE_URL;
    const fileKey: string = req.fileKey;
    const nodeId: string = req.nodeId;

    /**
     * Use Figma Images API.
     * GET /images/:file_key?ids=...&format=...&scale=...
     */
    const url: string =
        `${base}/images/${encodeURIComponent(fileKey)}` +
        `?ids=${encodeURIComponent(nodeId)}` +
        `&format=${encodeURIComponent(format)}` +
        `&scale=${encodeURIComponent(String(scale))}`;

    const imgResp: FigmaImageResponse = await _fetchJson<FigmaImageResponse>(
        url,
        token
    );

    const imageUrl: string | undefined = imgResp.images?.[nodeId];
    if (!imageUrl) {
        const err: string =
            typeof imgResp.err === 'string' && imgResp.err.trim()
                ? imgResp.err
                : 'Figma did not return an image URL for the given nodeId.';
        throw new Error(err);
    }

    const image: Buffer = await _fetchBinary(imageUrl);

    const cacheKey: string = _buildCacheKey(req);

    const out: FigmaScreenshotResult = {
        image,
        mimeType,
        type,
        cacheKey,
    };

    if (req.includeId === true) {
        out.nodeId = nodeId;
        out.fileKey = fileKey;
    }

    return out;
}

/**
 * Optional helper:
 * Validates that the node exists in the file before requesting render.
 * This is useful for clearer errors (e.g., nodeId typo).
 */
export async function assertNodeExists(
    fileKey: string,
    nodeId: string
): Promise<void> {
    const token: string = _requireFigmaToken();

    /**
     * GET /files/:file_key/nodes?ids=...
     */
    const url: string =
        `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}/nodes` +
        `?ids=${encodeURIComponent(nodeId)}`;

    const resp: FigmaFileNodesResponse =
        await _fetchJson<FigmaFileNodesResponse>(url, token);

    const node: unknown = resp.nodes?.[nodeId]?.document;
    if (!node) {
        throw new Error(
            `Figma node not found: fileKey=${fileKey}, nodeId=${nodeId}`
        );
    }
}

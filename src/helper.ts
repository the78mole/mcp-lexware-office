import { logger } from './logger.js';
import { VERSION } from './version.js';

const LEXWARE_OFFICE_API_KEY = process.env.LEXWARE_OFFICE_API_KEY!;
if (!LEXWARE_OFFICE_API_KEY) {
	logger.error('Error: LEXWARE_OFFICE_API_KEY environment variable is required');
	process.exit(1);
}

const LEXOFFICE_API_BASE = 'https://api.lexware.io';
const USER_AGENT = `mcp-lexware-office/${VERSION}`;

export type WriteResult<T> =
	| { ok: true; data: T }
	| { ok: false; status: number; error: unknown };

export type LexwareRequestOptions = {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
	body?: unknown; // JSON-serialized; mutually exclusive with formData
	formData?: FormData; // multipart body — fetch sets the Content-Type boundary itself
	accept?: string; // defaults to 'application/json'
};

// The single seam to the Lexware API: base URL, auth, headers, logging, and
// network-error handling live here and nowhere else. Returns null on network error.
async function send(path: string, options: LexwareRequestOptions): Promise<Response | null> {
	const url = `${LEXOFFICE_API_BASE}${path}`;
	const method = options.method ?? 'GET';
	const headers: Record<string, string> = {
		'User-Agent': USER_AGENT,
		Accept: options.accept ?? 'application/json',
		Authorization: `Bearer ${LEXWARE_OFFICE_API_KEY}`,
		...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
	};

	logger.log('Making Lexware Office request', { url, method });

	try {
		return await fetch(url, {
			method,
			headers,
			...(options.formData !== undefined
				? { body: options.formData }
				: options.body !== undefined
					? { body: JSON.stringify(options.body) }
					: {}),
		});
	} catch (error) {
		logger.error('Error making Lexware Office request', { url, method, error });
		return null;
	}
}

// Full result envelope including the HTTP status — for callers that branch on
// specific statuses. Returns null only on network error.
export async function lexwareRequest<T>(
	path: string,
	options: LexwareRequestOptions = {},
): Promise<WriteResult<T> | null> {
	const response = await send(path, options);
	if (!response) return null;

	let responseBody: unknown;
	try {
		responseBody = await response.json();
	} catch {
		responseBody = null;
	}

	if (!response.ok) {
		logger.error('Lexware Office request failed', { status: response.status, error: responseBody });
		return { ok: false, status: response.status, error: responseBody };
	}

	logger.log('Lexware Office response', { status: response.status });
	return { ok: true, data: responseBody as T };
}

export async function makeLexwareOfficeRequest<T>(path: string): Promise<T | null> {
	const result = await lexwareRequest<T>(path);
	return result?.ok ? result.data : null;
}

export async function makeLexwareOfficeFileRequest(
	path: string,
	accept: string,
): Promise<{ data: Buffer; mimeType: string; filename?: string } | null> {
	const response = await send(path, { accept });
	if (!response) return null;

	if (!response.ok) {
		logger.error('Lexware Office file request failed', { status: response.status });
		return null;
	}

	const contentType = response.headers.get('Content-Type') ?? accept;
	const mimeType = contentType.split(';')[0].trim();
	const contentDisposition = response.headers.get('Content-Disposition') ?? '';
	const filename = contentDisposition.match(/filename="?([^";\n]+)"?/)?.[1];
	const data = Buffer.from(await response.arrayBuffer());
	logger.log('Lexware Office file response received', { mimeType, bytes: data.length });
	return { data, mimeType, ...(filename !== undefined ? { filename } : {}) };
}

export async function makeLexwareOfficeWriteRequest<T>(
	path: string,
	method: 'POST' | 'PUT' | 'DELETE',
	body?: unknown,
): Promise<WriteResult<T> | null> {
	return lexwareRequest<T>(path, { method, body });
}

export async function makeLexwareOfficeMultipartRequest<T>(
	path: string,
	formData: FormData,
): Promise<WriteResult<T> | null> {
	return lexwareRequest<T>(path, { method: 'POST', formData });
}

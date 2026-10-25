// Client for spark-gateway (tailnet only). Enable with "gateway": true in app.config.json.

// The device isn't on the tailnet (or the gateway is down): the request never got an HTTP answer.
export class OffTailnetError extends Error {
	constructor() {
		super("Not connected to the tailnet");
		this.name = "OffTailnetError";
	}
}

// The gateway answered with a non-2xx status.
export class GatewayError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = "GatewayError";
		this.status = status;
	}
}

export async function gatewayFetch(path: string, init: RequestInit = {}): Promise<unknown> {
	const headers = new Headers(init.headers);
	if (init.body !== undefined && init.body !== null && !headers.has("content-type")) headers.set("content-type", "application/json");
	let res: Response;
	try {
		res = await fetch(`${__GATEWAY_URL__}${path}`, { ...init, headers });
	} catch {
		throw new OffTailnetError();
	}
	const text = await res.text();
	let body: unknown;
	try {
		body = text === "" ? undefined : JSON.parse(text);
	} catch {
		body = undefined;
	}
	if (!res.ok) {
		const msg = typeof body === "object" && body !== null && typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : `HTTP ${res.status}`;
		throw new GatewayError(res.status, msg);
	}
	return body;
}

const store = (collection: string, id?: string) => `/apps/${__APP_NAME__}/kv/${encodeURIComponent(collection)}${id === undefined ? "" : `/${encodeURIComponent(id)}`}`;

export const kv = {
	get: (collection: string, id: string) => gatewayFetch(store(collection, id)),
	put: (collection: string, id: string, value: Record<string, unknown>) => gatewayFetch(store(collection, id), { method: "PUT", body: JSON.stringify(value) }),
	del: (collection: string, id: string) => gatewayFetch(store(collection, id), { method: "DELETE" }),
	list: (collection: string, opts: { limit?: number; cursor?: string } = {}) => {
		const q = new URLSearchParams();
		if (opts.limit !== undefined) q.set("limit", String(opts.limit));
		if (opts.cursor !== undefined) q.set("cursor", opts.cursor);
		const qs = q.toString();
		return gatewayFetch(store(collection) + (qs ? `?${qs}` : ""));
	},
};

export const system = {
	models: () => gatewayFetch("/system/models"),
	gpu: () => gatewayFetch("/system/gpu"),
	sessions: () => gatewayFetch("/system/sessions"),
};

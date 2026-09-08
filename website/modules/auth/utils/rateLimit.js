const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;
const MAX_REQUESTS = 30;

const buckets = new Map();

export function getClientKey(req) {
	const forwarded = req.headers["x-forwarded-for"];

	return (
		req.headers["cf-connecting-ip"] ||
		(typeof forwarded === "string" ? forwarded.split(",")[0].trim() : null) ||
		req.headers["remote-address"] ||
		req.socket.remoteAddress ||
		"unknown"
	);
}

function getBucket(key) {
	const bucket = buckets.get(key);

	if (!bucket || Date.now() - bucket.start > WINDOW_MS) {
		const fresh = { start: Date.now(), requests: 0, failures: 0 };
		buckets.set(key, fresh);
		return fresh;
	}

	return bucket;
}

setInterval(() => {
	const cutoff = Date.now() - WINDOW_MS;

	for (const [key, bucket] of buckets) {
		if (bucket.start < cutoff) {
			buckets.delete(key);
		}
	}
}, WINDOW_MS).unref();

export function checkRateLimit(key) {
	const bucket = getBucket(key);

	bucket.requests++;

	if (bucket.failures >= MAX_FAILURES || bucket.requests > MAX_REQUESTS) {
		return Math.max(
			1,
			Math.ceil((bucket.start + WINDOW_MS - Date.now()) / 1000),
		);
	}

	return null;
}

export function recordFailure(key) {
	getBucket(key).failures++;
}

export function clearRateLimit(key) {
	buckets.delete(key);
}

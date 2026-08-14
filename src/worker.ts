async function authenticate(request: Request, env: any) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Basic ")) {
        return false;
    }

    const base64Credentials = authHeader.substring(6);
    const credentials = atob(base64Credentials);
    const [username, password] = credentials.split(":");

    if (!username || !password) return false;

    // Look up the password for the given username in KV
    const storedPassword = await env.AUTH_KV.get(`user:${username}`);
    return storedPassword === password;
}

export default {
    async fetch(request: Request, env: any) {
        const url = new URL(request.url);
        const bucket = env.BUCKET;
        const key = url.pathname.slice(1);
        const action = url.searchParams.get("action");

        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, PUT, GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Authorization, Content-Type",
                },
            });
        }

        if (!action) {
            const authReadOnly = await env.AUTH_KV.get("config:auth_read_only");
            if (authReadOnly === "true") {
                if (!(await authenticate(request, env))) {
                    return new Response("Unauthorized", {
                        status: 401,
                        headers: {
                            "WWW-Authenticate": 'Basic realm="Secure Upload"',
                            "Access-Control-Allow-Origin": "*",
                        },
                    });
                }
            }
            return fetch(request);
        }

        if (!(await authenticate(request, env))) {
            return new Response("Unauthorized", {
                status: 401,
                headers: {
                    "WWW-Authenticate": 'Basic realm="Secure Upload"',
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }

        switch (request.method) {
            case "POST":
                if (action === "mpu-create") {
                    const multipartUpload = await bucket.createMultipartUpload(key);
                    return new Response(JSON.stringify({
                        key: multipartUpload.key,
                        uploadId: multipartUpload.uploadId,
                    }), {
                        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
                    });
                } else if (action === "mpu-complete") {
                    const uploadId = url.searchParams.get("uploadId");
                    if (!uploadId) {
                        return new Response("Missing uploadId", { status: 400 });
                    }

                    const multipartUpload = bucket.resumeMultipartUpload(key, uploadId);
                    const body = await request.json();
                    if (!body || !body.parts) {
                        return new Response("Missing or incomplete body", { status: 400 });
                    }

                    try {
                        const object = await multipartUpload.complete(body.parts);
                        return new Response(null, {
                            status: 200,
                            headers: {
                                "etag": object.httpEtag,
                                "Access-Control-Allow-Origin": "*",
                            },
                        });
                    } catch (error: any) {
                        return new Response(error.message, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
                    }
                }
                return new Response(`Unknown action ${action} for POST`, { status: 400 });

            case "PUT":
                if (action === "mpu-uploadpart") {
                    const uploadId = url.searchParams.get("uploadId");
                    const partNumberString = url.searchParams.get("partNumber");
                    if (!partNumberString || !uploadId) {
                        return new Response("Missing partNumber or uploadId", { status: 400 });
                    }
                    if (!request.body) {
                        return new Response("Missing request body", { status: 400 });
                    }

                    const partNumber = parseInt(partNumberString);
                    const multipartUpload = bucket.resumeMultipartUpload(key, uploadId);
                    try {
                        const uploadedPart = await multipartUpload.uploadPart(partNumber, request.body);
                        return new Response(JSON.stringify(uploadedPart), {
                            headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
                        });
                    } catch (error: any) {
                        return new Response(error.message, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
                    }
                }
                return new Response(`Unknown action ${action} for PUT`, { status: 400 });

            default:
                return fetch(request);
        }
    },
};
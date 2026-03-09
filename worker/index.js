// Cloudflare Worker for photo uploads
// Bindings needed: R2 bucket "PHOTOS", environment variable "UPLOAD_PASSWORD"

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const auth = request.headers.get('Authorization');
        const needsAuth = ['/upload', '/list', '/delete'];

        if (needsAuth.some(p => url.pathname.startsWith(p))) {
            if (auth !== env.UPLOAD_PASSWORD) {
                return new Response('Unauthorized', { status: 401, headers: corsHeaders });
            }
        }

        // Upload photo
        if (url.pathname === '/upload' && request.method === 'POST') {
            try {
                const formData = await request.formData();
                const file = formData.get('file');
                const category = formData.get('category') || 'general';
                const title = formData.get('title') || 'Untitled';
                const photoType = formData.get('photoType') || 'single';

                const timestamp = Date.now();
                const ext = file.name.split('.').pop().toLowerCase();
                const key = `${category}/${timestamp}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

                await env.PHOTOS.put(key, file.stream(), {
                    httpMetadata: { contentType: file.type },
                    customMetadata: { category, title, photoType, uploaded: new Date().toISOString() }
                });

                return new Response(JSON.stringify({ success: true, key }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), {
                    status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        // List photos
        if (url.pathname === '/list') {
            const list = await env.PHOTOS.list({ limit: 1000 });
            const photos = [];

            for (const obj of list.objects) {
                const head = await env.PHOTOS.head(obj.key);
                photos.push({
                    key: obj.key,
                    category: head.customMetadata?.category || 'general',
                    title: head.customMetadata?.title || 'Untitled',
                    photoType: head.customMetadata?.photoType || 'single',
                    uploaded: head.customMetadata?.uploaded || obj.uploaded
                });
            }

            photos.sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));

            return new Response(JSON.stringify({ photos }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Public gallery endpoint (no auth needed)
        if (url.pathname === '/gallery') {
            const list = await env.PHOTOS.list({ limit: 1000 });
            const photos = [];

            for (const obj of list.objects) {
                const head = await env.PHOTOS.head(obj.key);
                photos.push({
                    key: obj.key,
                    category: head.customMetadata?.category || 'general',
                    title: head.customMetadata?.title || 'Untitled',
                    photoType: head.customMetadata?.photoType || 'single',
                    uploaded: head.customMetadata?.uploaded || obj.uploaded
                });
            }

            return new Response(JSON.stringify({ photos }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Serve image
        if (url.pathname.startsWith('/image/')) {
            const key = url.pathname.replace('/image/', '');
            const object = await env.PHOTOS.get(key);

            if (!object) {
                return new Response('Not found', { status: 404, headers: corsHeaders });
            }

            return new Response(object.body, {
                headers: {
                    'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
                    'Cache-Control': 'public, max-age=31536000',
                    ...corsHeaders
                }
            });
        }

        // Delete photo
        if (url.pathname.startsWith('/delete/') && request.method === 'DELETE') {
            const key = url.pathname.replace('/delete/', '');
            await env.PHOTOS.delete(key);
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        return new Response('RA Photos API', { headers: corsHeaders });
    }
};

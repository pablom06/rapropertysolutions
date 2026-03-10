// Cloudflare Worker for photo uploads
// Bindings needed: R2 bucket "PHOTOS", environment variable "UPLOAD_PASSWORD"

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        const auth = request.headers.get('Authorization');
        const needsAuth = ['/upload', '/list', '/delete', '/update'];

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
                    customMetadata: { category, title, photoType, uploaded: new Date().toISOString(), order: '0' }
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
                if (obj.key.startsWith('contact/')) continue;
                const head = await env.PHOTOS.head(obj.key);
                photos.push({
                    key: obj.key,
                    category: head.customMetadata?.category || 'general',
                    title: head.customMetadata?.title || 'Untitled',
                    photoType: head.customMetadata?.photoType || 'single',
                    uploaded: head.customMetadata?.uploaded || obj.uploaded,
                    order: parseInt(head.customMetadata?.order || '0', 10)
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
                if (obj.key.startsWith('contact/')) continue;
                const head = await env.PHOTOS.head(obj.key);
                photos.push({
                    key: obj.key,
                    category: head.customMetadata?.category || 'general',
                    title: head.customMetadata?.title || 'Untitled',
                    photoType: head.customMetadata?.photoType || 'single',
                    uploaded: head.customMetadata?.uploaded || obj.uploaded,
                    order: parseInt(head.customMetadata?.order || '0', 10)
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

        // Contact form submission (no auth needed)
        if (url.pathname === '/contact' && request.method === 'POST') {
            try {
                const formData = await request.formData();
                const name = formData.get('name') || '';
                const email = formData.get('email') || '';
                const phone = formData.get('phone') || '';
                const service = formData.get('service') || '';
                const message = formData.get('message') || '';

                const timestamp = Date.now();
                const key = `contact/${timestamp}-${Math.random().toString(36).slice(2, 8)}.json`;

                // Save to R2 as backup
                await env.PHOTOS.put(key, JSON.stringify({
                    name, email, phone, service, message,
                    submitted: new Date().toISOString()
                }), {
                    httpMetadata: { contentType: 'application/json' }
                });

                // Send email via Resend
                await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${env.RESEND_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        from: 'RA Property Solutions <noreply@rapropertysolutions.net>',
                        to: 'main@rapropertysolutions.net',
                        reply_to: email,
                        subject: `New Contact: ${service} - ${name}`,
                        html: `<h2>New Contact Form Submission</h2>
                            <p><strong>Name:</strong> ${name}</p>
                            <p><strong>Email:</strong> ${email}</p>
                            <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
                            <p><strong>Service:</strong> ${service}</p>
                            <p><strong>Message:</strong></p>
                            <p>${message}</p>
                            <hr>
                            <p style="color:#666;font-size:12px">Submitted from rapropertysolutions.net</p>`
                    })
                });

                // Redirect back to site with success message
                return Response.redirect('https://rapropertysolutions.net/#contact-success', 303);
            } catch (e) {
                return new Response('Something went wrong. Please email us at main@rapropertysolutions.net', {
                    status: 500, headers: corsHeaders
                });
            }
        }

        // List contact messages (auth required)
        if (url.pathname === '/messages') {
            const list = await env.PHOTOS.list({ prefix: 'contact/', limit: 100 });
            const messages = [];

            for (const obj of list.objects) {
                const data = await env.PHOTOS.get(obj.key);
                const json = await data.json();
                messages.push({ key: obj.key, ...json });
            }

            messages.sort((a, b) => new Date(b.submitted) - new Date(a.submitted));

            return new Response(JSON.stringify({ messages }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Update photo metadata (title, category, photoType)
        if (url.pathname.startsWith('/update/') && request.method === 'PUT') {
            try {
                const key = url.pathname.replace('/update/', '');
                const updates = await request.json();
                const obj = await env.PHOTOS.head(key);
                if (!obj) {
                    return new Response('Not found', { status: 404, headers: corsHeaders });
                }

                const meta = obj.customMetadata || {};
                const newMeta = {
                    category: updates.category || meta.category || 'general',
                    title: updates.title || meta.title || 'Untitled',
                    photoType: updates.photoType || meta.photoType || 'single',
                    uploaded: meta.uploaded || new Date().toISOString(),
                    order: updates.order !== undefined ? String(updates.order) : (meta.order || '0')
                };

                // R2 doesn't support updating metadata in place, so copy the object
                const original = await env.PHOTOS.get(key);
                await env.PHOTOS.put(key, original.body, {
                    httpMetadata: obj.httpMetadata,
                    customMetadata: newMeta
                });

                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), {
                    status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
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

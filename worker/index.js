// Cloudflare Worker for photo uploads
// Bindings needed: R2 bucket "PHOTOS", environment variable "UPLOAD_PASSWORD"

export default {
    async fetch(request, env, ctx) {
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
        const needsAuth = ['/upload', '/list', '/delete', '/update', '/testimonials-admin', '/messages'];

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

        // Google reviews (no auth needed; cached at the edge)
        if (url.pathname === '/reviews') {
            const cache = caches.default;
            const cacheKey = new Request('https://cache.local/reviews-v1');
            const hit = await cache.match(cacheKey);
            if (hit) return hit;

            const placeId = env.GOOGLE_PLACE_ID;
            const apiKey = env.GOOGLE_PLACES_API_KEY;
            if (!placeId || !apiKey) {
                return new Response(JSON.stringify({ error: 'Reviews not configured' }), {
                    status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            try {
                const apiResp = await fetch(
                    `https://places.googleapis.com/v1/places/${placeId}?languageCode=en`,
                    {
                        headers: {
                            'X-Goog-Api-Key': apiKey,
                            'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri'
                        }
                    }
                );

                if (!apiResp.ok) {
                    const detail = await apiResp.text();
                    return new Response(JSON.stringify({ error: 'Places API error', detail }), {
                        status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders }
                    });
                }

                const data = await apiResp.json();
                const out = {
                    rating: data.rating || 0,
                    total: data.userRatingCount || 0,
                    mapsUrl: data.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${placeId}`,
                    writeReviewUrl: `https://search.google.com/local/writereview?placeid=${placeId}`,
                    reviews: (data.reviews || []).map(r => ({
                        author: r.authorAttribution?.displayName || 'Anonymous',
                        photo: r.authorAttribution?.photoUri || '',
                        profileUrl: r.authorAttribution?.uri || '',
                        rating: r.rating || 0,
                        time: r.relativePublishTimeDescription || '',
                        text: r.text?.text || ''
                    }))
                };

                const response = new Response(JSON.stringify(out), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'public, max-age=21600',
                        ...corsHeaders
                    }
                });
                ctx.waitUntil(cache.put(cacheKey, response.clone()));
                return response;
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), {
                    status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        // Submit a testimonial (no auth, honeypot for spam)
        if (url.pathname === '/testimonial' && request.method === 'POST') {
            try {
                const formData = await request.formData();
                const honeypot = (formData.get('website') || '').toString();
                if (honeypot.trim() !== '') {
                    return new Response(JSON.stringify({ success: true }), {
                        headers: { 'Content-Type': 'application/json', ...corsHeaders }
                    });
                }

                const author = (formData.get('author') || '').toString().trim().slice(0, 80);
                const text = (formData.get('text') || '').toString().trim().slice(0, 2000);
                const rating = Math.max(1, Math.min(5, parseInt(formData.get('rating'), 10) || 0));
                const email = (formData.get('email') || '').toString().trim().slice(0, 120);

                if (!author || !text || !rating) {
                    return new Response(JSON.stringify({ error: 'Name, rating, and review text are required.' }), {
                        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders }
                    });
                }

                const submitted = new Date().toISOString();
                const timestamp = Date.now();
                const key = `testimonial/${timestamp}-${Math.random().toString(36).slice(2, 8)}.json`;

                await env.PHOTOS.put(key, JSON.stringify({
                    author, email, rating, text, submitted, approved: false
                }), {
                    httpMetadata: { contentType: 'application/json' }
                });

                if (env.RESEND_KEY) {
                    ctx.waitUntil(fetch('https://api.resend.com/emails', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${env.RESEND_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            from: 'RA Property Solutions <noreply@rapropertysolutions.net>',
                            to: 'main@rapropertysolutions.net',
                            subject: `New testimonial pending: ${rating}★ from ${author}`,
                            html: `<h2>New testimonial awaiting approval</h2>
                                <p><strong>Name:</strong> ${author}</p>
                                <p><strong>Email:</strong> ${email || 'Not provided'}</p>
                                <p><strong>Rating:</strong> ${rating} / 5</p>
                                <p><strong>Review:</strong></p>
                                <p>${text.replace(/</g, '&lt;')}</p>
                                <hr>
                                <p>Approve or delete it from the upload page.</p>`
                        })
                    }));
                }

                return new Response(JSON.stringify({ success: true }), {
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message }), {
                    status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }
        }

        // Public testimonials (approved only, no auth)
        if (url.pathname === '/testimonials' && request.method === 'GET') {
            const list = await env.PHOTOS.list({ prefix: 'testimonial/', limit: 200 });
            const items = [];
            for (const obj of list.objects) {
                const data = await env.PHOTOS.get(obj.key);
                if (!data) continue;
                const json = await data.json();
                if (!json.approved) continue;
                items.push({
                    author: json.author,
                    rating: json.rating,
                    text: json.text,
                    submitted: json.submitted
                });
            }
            items.sort((a, b) => new Date(b.submitted) - new Date(a.submitted));
            return new Response(JSON.stringify({ testimonials: items }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Admin: list all testimonials including pending (auth)
        if (url.pathname === '/testimonials-admin' && request.method === 'GET') {
            const list = await env.PHOTOS.list({ prefix: 'testimonial/', limit: 200 });
            const items = [];
            for (const obj of list.objects) {
                const data = await env.PHOTOS.get(obj.key);
                if (!data) continue;
                const json = await data.json();
                items.push({ key: obj.key, ...json });
            }
            items.sort((a, b) => new Date(b.submitted) - new Date(a.submitted));
            return new Response(JSON.stringify({ testimonials: items }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Admin: approve / unapprove a testimonial (auth)
        if (url.pathname.startsWith('/testimonials-admin/') && request.method === 'PUT') {
            try {
                const key = url.pathname.replace('/testimonials-admin/', '');
                const body = await request.json();
                const data = await env.PHOTOS.get(key);
                if (!data) {
                    return new Response('Not found', { status: 404, headers: corsHeaders });
                }
                const json = await data.json();
                const updated = { ...json, approved: !!body.approved };
                await env.PHOTOS.put(key, JSON.stringify(updated), {
                    httpMetadata: { contentType: 'application/json' }
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

        // Admin: delete a testimonial (auth)
        if (url.pathname.startsWith('/testimonials-admin/') && request.method === 'DELETE') {
            const key = url.pathname.replace('/testimonials-admin/', '');
            await env.PHOTOS.delete(key);
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        return new Response('RA Photos API', { headers: corsHeaders });
    }
};

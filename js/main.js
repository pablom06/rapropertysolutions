// Mobile menu toggle
const mobileMenuBtn = document.querySelector('.mobile-menu');
const navLinks = document.querySelector('.nav-links');

mobileMenuBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    navLinks.classList.toggle('active');
});

mobileMenuBtn.addEventListener('touchend', function(e) {
    e.preventDefault();
    e.stopPropagation();
    navLinks.classList.toggle('active');
});

// Close mobile menu when a link is clicked
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        document.querySelector('.nav-links').classList.remove('active');
    });
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// How many project cards to show on the homepage
const MAX_HOME_CARDS = 6;
const isGalleryPage = document.body.classList.contains('gallery-page');

// Gallery rendering - project cards
function renderGallery(filter) {
    const gallery = document.getElementById('gallery');
    const placeholder = document.getElementById('gallery-placeholder');
    const viewMoreWrap = document.getElementById('view-more-wrap');
    const items = filter === 'all' ? projectsData : projectsData.filter(p => p.category === filter);

    if (items.length === 0) {
        gallery.innerHTML = '';
        if (placeholder) placeholder.style.display = 'block';
        if (viewMoreWrap) viewMoreWrap.style.display = 'none';
        return;
    }

    if (placeholder) placeholder.style.display = 'none';

    const limit = isGalleryPage ? items.length : MAX_HOME_CARDS;
    const visible = items.slice(0, limit);

    gallery.innerHTML = visible.map(project => `
        <div class="project-card" onclick="openProject(${items.indexOf(project)}, '${filter}')">
            <img src="${project.cover}" alt="${project.title}" loading="lazy">
            <div class="card-info">
                <h3>${project.title}<span class="photo-count">${project.totalPhotos} photo${project.totalPhotos !== 1 ? 's' : ''}</span></h3>
                <span>${project.categoryLabel}</span>
            </div>
        </div>
    `).join('');

    if (viewMoreWrap) {
        viewMoreWrap.style.display = isGalleryPage ? 'none' : 'block';
    }
}

// Open project modal
function openProject(index, filter) {
    const items = filter === 'all' ? projectsData : projectsData.filter(p => p.category === filter);
    const project = items[index];
    if (!project) return;

    const modal = document.getElementById('project-modal');
    const header = modal.querySelector('.modal-header h2');
    const body = modal.querySelector('.modal-body');

    header.textContent = project.title + ' — ' + project.categoryLabel;

    let html = '';

    if (project.befores.length > 0) {
        html += '<div class="modal-section-label before">BEFORE</div>';
        html += '<div class="photo-grid">';
        project.befores.forEach(src => {
            html += `<img src="${src}" alt="Before" loading="lazy" onclick="openLightbox(this.src)">`;
        });
        html += '</div>';
    }

    if (project.afters.length > 0) {
        html += '<div class="modal-section-label after">AFTER</div>';
        html += '<div class="photo-grid">';
        project.afters.forEach(src => {
            html += `<img src="${src}" alt="After" loading="lazy" onclick="openLightbox(this.src)">`;
        });
        html += '</div>';
    }

    if (project.singles.length > 0) {
        if (project.befores.length > 0 || project.afters.length > 0) {
            html += '<div class="modal-section-label" style="background:#1a3a5c;color:white">PHOTOS</div>';
        }
        html += '<div class="photo-grid">';
        project.singles.forEach(src => {
            html += `<img src="${src}" alt="Photo" loading="lazy" onclick="openLightbox(this.src)">`;
        });
        html += '</div>';
    }

    body.innerHTML = html;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeProjectModal() {
    document.getElementById('project-modal').classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal on background click
document.addEventListener('click', function(e) {
    const modal = document.getElementById('project-modal');
    if (e.target === modal) {
        closeProjectModal();
    }
});

// Lightbox
function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    lightbox.querySelector('img').src = src;
    lightbox.classList.add('active');
}

const lightbox = document.createElement('div');
lightbox.id = 'lightbox';
lightbox.className = 'lightbox';
lightbox.innerHTML = '<img src="" alt="Full size">';
lightbox.addEventListener('click', () => lightbox.classList.remove('active'));
document.body.appendChild(lightbox);

// Scroll animations
const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.fade-in, .fade-in-left, .fade-in-right').forEach(el => {
    scrollObserver.observe(el);
});

// Header shrink on scroll
const header = document.querySelector('header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        header.style.padding = '0';
        header.style.boxShadow = '0 2px 30px rgba(0,0,0,0.4)';
    } else {
        header.style.padding = '';
        header.style.boxShadow = '';
    }
});

// Initial render
renderGallery('all');

// ===== Reviews (Google + self-hosted testimonials) =====
const REVIEWS_API_BASE = 'https://ra-photos.rapropertysolutions.net';

function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function renderStars(rating) {
    const r = Number(rating) || 0;
    const full = Math.floor(r);
    const half = r - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return (
        '<i class="fas fa-star"></i>'.repeat(full) +
        (half ? '<i class="fas fa-star-half-stroke"></i>' : '') +
        '<i class="far fa-star"></i>'.repeat(empty)
    );
}

function relativeTime(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    const diff = (Date.now() - then) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' minutes ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' days ago';
    if (diff < 86400 * 30) return Math.floor(diff / (86400 * 7)) + ' weeks ago';
    if (diff < 86400 * 365) return Math.floor(diff / (86400 * 30)) + ' months ago';
    return Math.floor(diff / (86400 * 365)) + ' years ago';
}

async function fetchGoogleReviews() {
    try {
        const resp = await fetch(REVIEWS_API_BASE + '/reviews');
        if (!resp.ok) return null;
        return await resp.json();
    } catch (e) {
        return null;
    }
}

async function fetchTestimonials() {
    try {
        const resp = await fetch(REVIEWS_API_BASE + '/testimonials');
        if (!resp.ok) return [];
        const data = await resp.json();
        return data.testimonials || [];
    } catch (e) {
        return [];
    }
}

async function loadReviews() {
    const section = document.getElementById('reviews');
    const summary = document.getElementById('reviews-summary');
    const grid = document.getElementById('reviews-grid');
    const googleCta = document.getElementById('leave-review-btn');
    if (!section || !summary || !grid) return;

    const [google, testimonials] = await Promise.all([fetchGoogleReviews(), fetchTestimonials()]);

    const merged = [];

    if (google && google.reviews) {
        google.reviews.forEach(r => merged.push({
            source: 'google',
            author: r.author,
            photo: r.photo,
            rating: r.rating,
            text: r.text,
            timeLabel: r.time
        }));
    }

    testimonials.forEach(t => merged.push({
        source: 'site',
        author: t.author,
        photo: '',
        rating: t.rating,
        text: t.text,
        timeLabel: relativeTime(t.submitted)
    }));

    if (google && googleCta && google.writeReviewUrl) {
        googleCta.href = google.writeReviewUrl;
        googleCta.style.display = '';
    }

    const haveAnything = merged.length > 0 || (google && google.total > 0);
    if (!haveAnything) {
        section.style.display = '';
        summary.innerHTML = '';
        grid.innerHTML = '<p class="reviews-empty">Be the first to leave a review.</p>';
        return;
    }

    let combinedTotal = 0;
    let combinedSum = 0;
    if (google && google.total > 0 && google.rating) {
        combinedTotal += google.total;
        combinedSum += google.rating * google.total;
    }
    testimonials.forEach(t => {
        combinedTotal += 1;
        combinedSum += Number(t.rating) || 0;
    });
    const avg = combinedTotal > 0 ? combinedSum / combinedTotal : 0;

    summary.innerHTML = `
        <div class="reviews-rating">${renderStars(avg)}</div>
        <div class="reviews-rating-text">
            <strong>${avg.toFixed(1)}</strong> out of 5 ·
            ${combinedTotal} review${combinedTotal === 1 ? '' : 's'}
        </div>
    `;

    grid.innerHTML = merged.map(r => {
        const initial = (r.author && r.author[0] ? r.author[0] : '?').toUpperCase();
        const avatar = r.photo
            ? `<img src="${escapeHtml(r.photo)}" alt="" class="review-photo" loading="lazy" referrerpolicy="no-referrer">`
            : `<div class="review-photo placeholder">${escapeHtml(initial)}</div>`;
        const sourceBadge = r.source === 'google'
            ? '<span class="review-source google">Google</span>'
            : '<span class="review-source">Verified customer</span>';
        return `
            <div class="review-card fade-in">
                <div class="review-header">
                    ${avatar}
                    <div>
                        <div class="review-author">${escapeHtml(r.author)}${sourceBadge}</div>
                        <div class="review-time">${escapeHtml(r.timeLabel || '')}</div>
                    </div>
                </div>
                <div class="review-stars">${renderStars(r.rating)}</div>
                <p class="review-text">${escapeHtml(r.text)}</p>
            </div>
        `;
    }).join('');

    grid.querySelectorAll('img.review-photo').forEach(img => {
        img.addEventListener('error', () => {
            const card = img.closest('.review-card');
            const author = card?.querySelector('.review-author')?.textContent || '?';
            const ph = document.createElement('div');
            ph.className = 'review-photo placeholder';
            ph.textContent = (author[0] || '?').toUpperCase();
            img.replaceWith(ph);
        });
    });

    section.querySelectorAll('.review-card').forEach(el => scrollObserver.observe(el));
}

loadReviews();

// ===== Testimonial submission form =====
function openTestimonialForm() {
    const wrap = document.getElementById('testimonial-form-wrap');
    if (!wrap) return;
    wrap.style.display = 'block';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('t-name')?.focus();
}

function closeTestimonialForm() {
    const wrap = document.getElementById('testimonial-form-wrap');
    if (wrap) wrap.style.display = 'none';
}

document.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const value = parseInt(btn.dataset.value, 10);
        document.getElementById('t-rating').value = String(value);
        document.querySelectorAll('.star-btn').forEach((b, i) => {
            const active = i < value;
            b.classList.toggle('active', active);
            const icon = b.querySelector('i');
            if (icon) icon.className = active ? 'fas fa-star' : 'far fa-star';
        });
    });
});

async function submitTestimonial(event) {
    event.preventDefault();
    const form = event.target;
    const status = document.getElementById('t-status');
    const submitBtn = document.getElementById('t-submit');
    const rating = parseInt(document.getElementById('t-rating').value, 10) || 0;

    if (rating < 1) {
        status.className = 'testimonial-form-status error';
        status.textContent = 'Please choose a star rating.';
        return;
    }

    status.className = 'testimonial-form-status';
    status.textContent = 'Sending...';
    submitBtn.disabled = true;

    try {
        const resp = await fetch(REVIEWS_API_BASE + '/testimonial', {
            method: 'POST',
            body: new FormData(form)
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.error || 'Submission failed');

        status.className = 'testimonial-form-status success';
        status.textContent = 'Thank you! Your review will appear after our team reviews it.';
        form.reset();
        document.querySelectorAll('.star-btn').forEach(b => {
            b.classList.remove('active');
            const icon = b.querySelector('i');
            if (icon) icon.className = 'far fa-star';
        });
        document.getElementById('t-rating').value = '0';
    } catch (e) {
        status.className = 'testimonial-form-status error';
        status.textContent = e.message || 'Something went wrong. Please try again.';
    } finally {
        submitBtn.disabled = false;
    }
}

// Show success message if redirected from contact form
if (window.location.hash === '#contact-success') {
    const successMsg = document.getElementById('contact-success');
    const form = document.getElementById('contact-form');
    if (successMsg && form) {
        successMsg.style.display = 'block';
        form.style.display = 'none';
    }
    history.replaceState(null, '', window.location.pathname + '#contact');
}

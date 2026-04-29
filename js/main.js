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
        viewMoreWrap.style.display = (!isGalleryPage && items.length > MAX_HOME_CARDS) ? 'block' : 'none';
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

// ===== Google reviews =====
const REVIEWS_API = 'https://ra-photos.rapropertysolutions.net/reviews';

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

async function loadReviews() {
    const section = document.getElementById('reviews');
    const summary = document.getElementById('reviews-summary');
    const grid = document.getElementById('reviews-grid');
    const cta = document.getElementById('leave-review-btn');
    if (!section || !summary || !grid) return;

    try {
        const resp = await fetch(REVIEWS_API);
        if (!resp.ok) throw new Error('reviews unavailable');
        const data = await resp.json();

        if (cta && data.writeReviewUrl) cta.href = data.writeReviewUrl;

        const ratingText = (data.rating || 0).toFixed(1);
        const total = data.total || 0;
        summary.innerHTML = `
            <div class="reviews-rating">${renderStars(data.rating)}</div>
            <div class="reviews-rating-text">
                <strong>${ratingText}</strong> out of 5 ·
                ${total} Google review${total === 1 ? '' : 's'}
            </div>
        `;

        const reviews = data.reviews || [];
        if (reviews.length === 0) {
            grid.innerHTML = '<p class="reviews-empty">Be the first to leave a review.</p>';
            return;
        }

        grid.innerHTML = reviews.map(r => {
            const initial = (r.author && r.author[0] ? r.author[0] : '?').toUpperCase();
            const avatar = r.photo
                ? `<img src="${escapeHtml(r.photo)}" alt="" class="review-photo" loading="lazy" referrerpolicy="no-referrer">`
                : `<div class="review-photo placeholder">${escapeHtml(initial)}</div>`;
            return `
                <div class="review-card fade-in">
                    <div class="review-header">
                        ${avatar}
                        <div>
                            <div class="review-author">${escapeHtml(r.author)}</div>
                            <div class="review-time">${escapeHtml(r.time)}</div>
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
    } catch (e) {
        section.style.display = 'none';
    }
}

loadReviews();

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

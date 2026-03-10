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

// Initial render
renderGallery('all');

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

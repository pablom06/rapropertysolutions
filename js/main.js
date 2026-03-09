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

// Gallery rendering
function renderGallery(filter) {
    const gallery = document.getElementById('gallery');
    const placeholder = document.getElementById('gallery-placeholder');
    const items = filter === 'all' ? galleryData : galleryData.filter(item => item.category === filter);

    if (items.length === 0) {
        gallery.innerHTML = '';
        placeholder.style.display = 'block';
        return;
    }

    placeholder.style.display = 'none';
    gallery.innerHTML = items.map(item => {
        if (item.before && item.after) {
            return `
                <div class="gallery-item" data-category="${item.category}">
                    <div class="before-after">
                        <div>
                            <div class="label before">BEFORE</div>
                            <img src="${item.before}" alt="Before - ${item.title}" loading="lazy" onclick="openLightbox(this.src)">
                        </div>
                        <div>
                            <div class="label after">AFTER</div>
                            <img src="${item.after}" alt="After - ${item.title}" loading="lazy" onclick="openLightbox(this.src)">
                        </div>
                    </div>
                </div>`;
        }
        return `
            <div class="gallery-item" data-category="${item.category}">
                <img src="${item.image}" alt="${item.title}" loading="lazy" onclick="openLightbox(this.src)">
            </div>`;
    }).join('');
}

// Gallery filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderGallery(btn.dataset.filter);
    });
});

// Lightbox
function openLightbox(src) {
    const lightbox = document.getElementById('lightbox');
    lightbox.querySelector('img').src = src;
    lightbox.classList.add('active');
}

// Create lightbox element
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

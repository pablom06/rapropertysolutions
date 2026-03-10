// Gallery loads photos from the upload API
const PHOTOS_API = 'https://ra-photos.rapropertysolutions.net';

// Known category labels (custom ones get auto-formatted)
const CATEGORY_LABELS = {
    'turns': 'Turns & Make-Readies',
    'rehab': 'Rehabs',
    'plumbing': 'Plumbing',
    'electrical': 'Electrical',
    'hvac': 'HVAC',
    'foundation': 'Foundation',
    'handyman': 'Handyman',
    'roofing': 'Roofing',
    'flooring': 'Flooring',
    'appliance-repair': 'Appliance Repair',
    'appliance-install': 'Appliance Install',
    'landscaping': 'Landscaping',
    'powerwashing': 'Powerwashing',
    'windows': 'Windows',
    'underground-plumbing': 'Underground Plumbing',
    'bathrooms': 'Bathrooms',
    'kitchens': 'Kitchens',
    'general': 'General'
};

function getCategoryLabel(cat) {
    if (CATEGORY_LABELS[cat]) return CATEGORY_LABELS[cat];
    // Auto-format: "my-new-category" -> "My New Category"
    return cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Build filter buttons dynamically from photo categories
function buildFilterButtons(photos) {
    const filtersContainer = document.querySelector('.gallery-filters');
    if (!filtersContainer) return;

    // Get unique categories from photos
    const categories = [...new Set(photos.map(p => p.category))];

    // Start with "All" button
    let html = '<button class="filter-btn active" data-filter="all">All</button>';

    // Add buttons for each category that has photos
    categories.sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b)));
    categories.forEach(cat => {
        html += `<button class="filter-btn" data-filter="${cat}">${getCategoryLabel(cat)}</button>`;
    });

    filtersContainer.innerHTML = html;

    // Re-attach click handlers
    filtersContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filtersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderGallery(btn.dataset.filter);
        });
    });
}

// Group photos by title for before/after pairing
function buildGallery(photos) {
    const grouped = {};

    photos.forEach(photo => {
        const groupKey = photo.title + '|' + photo.category;
        if (!grouped[groupKey]) {
            grouped[groupKey] = { title: photo.title, category: photo.category, photos: [] };
        }
        grouped[groupKey].photos.push(photo);
    });

    return Object.values(grouped).map(group => {
        const befores = group.photos.filter(p => p.photoType === 'before');
        const afters = group.photos.filter(p => p.photoType === 'after');
        const singles = group.photos.filter(p => p.photoType === 'single');

        const items = [];

        // Pair up before/after photos in order
        const pairCount = Math.min(befores.length, afters.length);
        for (let i = 0; i < pairCount; i++) {
            items.push({
                category: group.category,
                title: group.title,
                before: PHOTOS_API + '/image/' + befores[i].key,
                after: PHOTOS_API + '/image/' + afters[i].key
            });
        }

        // Show any unpaired before/after photos as singles
        for (let i = pairCount; i < befores.length; i++) {
            items.push({
                category: group.category,
                title: group.title,
                image: PHOTOS_API + '/image/' + befores[i].key
            });
        }
        for (let i = pairCount; i < afters.length; i++) {
            items.push({
                category: group.category,
                title: group.title,
                image: PHOTOS_API + '/image/' + afters[i].key
            });
        }

        singles.forEach(photo => {
            items.push({
                category: group.category,
                title: group.title,
                image: PHOTOS_API + '/image/' + photo.key
            });
        });

        return items;
    }).flat();
}

// Fallback data if API is unreachable
let galleryData = [];

// Load gallery from API
fetch(PHOTOS_API + '/gallery')
    .then(r => r.json())
    .then(data => {
        galleryData = buildGallery(data.photos);
        buildFilterButtons(data.photos);
        renderGallery('all');
    })
    .catch(() => {
        renderGallery('all');
    });

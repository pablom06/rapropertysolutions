// Gallery loads photos from the upload API
const PHOTOS_API = 'https://ra-photos.rapropertysolutions.net';

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
    'general': 'General',
    'drywall': 'Drywall'
};

function getCategoryLabel(cat) {
    if (CATEGORY_LABELS[cat]) return CATEGORY_LABELS[cat];
    return cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Build projects grouped by title + category
function buildProjects(photos) {
    const grouped = {};

    photos.forEach(photo => {
        const groupKey = photo.title + '|' + photo.category;
        if (!grouped[groupKey]) {
            grouped[groupKey] = { title: photo.title, category: photo.category, photos: [] };
        }
        grouped[groupKey].photos.push(photo);
    });

    return Object.values(grouped).map(group => {
        // Sort photos by order within each group
        group.photos.sort((a, b) => (a.order || 0) - (b.order || 0));

        const befores = group.photos.filter(p => p.photoType === 'before').map(p => PHOTOS_API + '/image/' + p.key);
        const afters = group.photos.filter(p => p.photoType === 'after').map(p => PHOTOS_API + '/image/' + p.key);
        const singles = group.photos.filter(p => p.photoType === 'single').map(p => PHOTOS_API + '/image/' + p.key);

        // Pick a cover photo: first after, then first single, then first before
        const cover = afters[0] || singles[0] || befores[0];
        const totalPhotos = befores.length + afters.length + singles.length;

        return {
            title: group.title,
            category: group.category,
            categoryLabel: getCategoryLabel(group.category),
            cover: cover,
            totalPhotos: totalPhotos,
            befores: befores,
            afters: afters,
            singles: singles
        };
    });
}

// Build filter buttons from project categories
function buildFilterButtons(projects) {
    const filtersContainer = document.querySelector('.gallery-filters');
    if (!filtersContainer) return;

    const categories = [...new Set(projects.map(p => p.category))];
    let html = '<button class="filter-btn active" data-filter="all">All</button>';
    categories.sort((a, b) => getCategoryLabel(a).localeCompare(getCategoryLabel(b)));
    categories.forEach(cat => {
        html += `<button class="filter-btn" data-filter="${cat}">${getCategoryLabel(cat)}</button>`;
    });

    filtersContainer.innerHTML = html;

    filtersContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            filtersContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderGallery(btn.dataset.filter);
        });
    });
}

let projectsData = [];

// Load from API
fetch(PHOTOS_API + '/gallery')
    .then(r => r.json())
    .then(data => {
        projectsData = buildProjects(data.photos);
        buildFilterButtons(projectsData);
        renderGallery('all');
    })
    .catch(() => {
        renderGallery('all');
    });

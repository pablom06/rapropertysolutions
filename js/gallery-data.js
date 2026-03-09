// Gallery loads photos from the upload API
const PHOTOS_API = 'https://ra-photos.rapropertysolutions.net';

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
        const before = group.photos.find(p => p.photoType === 'before');
        const after = group.photos.find(p => p.photoType === 'after');
        const singles = group.photos.filter(p => p.photoType === 'single');

        const items = [];

        // If we have before and after, create a pair
        if (before && after) {
            items.push({
                category: group.category,
                title: group.title,
                before: PHOTOS_API + '/image/' + before.key,
                after: PHOTOS_API + '/image/' + after.key
            });
        } else {
            // Add before/after as singles if missing their pair
            if (before) {
                items.push({
                    category: group.category,
                    title: group.title + ' (Before)',
                    image: PHOTOS_API + '/image/' + before.key
                });
            }
            if (after) {
                items.push({
                    category: group.category,
                    title: group.title + ' (After)',
                    image: PHOTOS_API + '/image/' + after.key
                });
            }
        }

        // Add all single photos
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
        renderGallery('all');
    })
    .catch(() => {
        renderGallery('all');
    });

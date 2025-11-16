// Initialize the map
const map = L.map('map').setView([30, 0], 3);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    minZoom: 2
}).addTo(map);

// Store markers for easy access
const markers = {};
let locations = [];

// Custom icon for markers
const customIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Load and display locations from data.json
async function loadLocations() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();
        locations = data.locations;
        
        displayLocations(locations);
        addMarkersToMap(locations);
        
        // Fit map to show all markers
        if (locations.length > 0) {
            const bounds = L.latLngBounds(locations.map(loc => [loc.latitude, loc.longitude]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    } catch (error) {
        console.error('Error loading locations:', error);
        document.getElementById('location-list').innerHTML = 
            '<p style="color: red;">Error loading locations. Please check data.json file.</p>';
    }
}

// Add markers to the map
function addMarkersToMap(locations) {
    locations.forEach(location => {
        const marker = L.marker([location.latitude, location.longitude], {
            icon: customIcon
        }).addTo(map);
        
        // Create popup content
        const popupContent = `
            <div class="popup-content">
                <h3>${location.name}</h3>
                <p>${location.description}</p>
                <p><strong>Coordinates:</strong> ${location.latitude}, ${location.longitude}</p>
                ${location.image ? `<img src="${location.image}" alt="${location.name}" class="popup-image" onerror="this.style.display='none'">` : ''}
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        // Store marker reference
        markers[location.id] = marker;
        
        // Add click event to highlight sidebar item
        marker.on('click', () => {
            highlightLocation(location.id);
        });
    });
}

// Display locations in sidebar
function displayLocations(locations) {
    const locationList = document.getElementById('location-list');
    locationList.innerHTML = '';
    
    locations.forEach(location => {
        const locationItem = document.createElement('div');
        locationItem.className = 'location-item';
        locationItem.id = `location-${location.id}`;
        locationItem.innerHTML = `
            <h3>${location.name}</h3>
            <p>${location.description}</p>
            <div class="coordinates">📍 ${location.latitude}, ${location.longitude}</div>
        `;
        
        // Add click event to zoom to marker
        locationItem.addEventListener('click', () => {
            const marker = markers[location.id];
            if (marker) {
                map.setView([location.latitude, location.longitude], 6);
                marker.openPopup();
                highlightLocation(location.id);
            }
        });
        
        locationList.appendChild(locationItem);
    });
}

// Highlight selected location in sidebar
function highlightLocation(locationId) {
    // Remove active class from all items
    document.querySelectorAll('.location-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to selected item
    const selectedItem = document.getElementById(`location-${locationId}`);
    if (selectedItem) {
        selectedItem.classList.add('active');
        selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Initialize the application
loadLocations();

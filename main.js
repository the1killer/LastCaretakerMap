import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';

// Fix for default marker icons in Webpack/Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Initialize the map
const map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 4
});

// Set the view based on the coordinate system
map.setView([30, 0], 0);

// Create a tiled background image layer
const BackgroundLayer = L.GridLayer.extend({
    createTile: function(coords) {
        const tile = document.createElement('img');
        tile.src = '/images/mapbg.png';
        tile.style.width = '100%';
        tile.style.height = '100%';
        return tile;
    }
});

// Add tiled background layer
new BackgroundLayer().addTo(map);

// Create a custom grid overlay with fixed size
const GridLayer = L.GridLayer.extend({
    createTile: function(coords) {
        const tile = document.createElement('canvas');
        const tileSize = this.getTileSize();
        tile.width = tileSize.x;
        tile.height = tileSize.y;
        
        const ctx = tile.getContext('2d');
        
        // Draw grid with transparency
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        
        var gridsize = 64;

        // Draw vertical lines
        for (let i = 0; i <= tileSize.x; i += gridsize) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, tileSize.y);
            ctx.stroke();
        }
        
        // Draw horizontal lines
        for (let i = 0; i <= tileSize.y; i += gridsize) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(tileSize.x, i);
            ctx.stroke();
        }
        
        return tile;
    }
});

// Add grid layer on top of the background with updateWhenZooming disabled
new GridLayer({
    updateWhenZooming: false,
    updateWhenIdle: false
}).addTo(map);

// Store markers for easy access
const markers = {};
const markerLabels = {};
let locations = [];

// Load visibility state from localStorage
function getVisibilityState(locationId) {
    const state = localStorage.getItem(`marker-visible-${locationId}`);
    return state === null ? true : state === 'true';
}

// Save visibility state to localStorage
function setVisibilityState(locationId, visible) {
    localStorage.setItem(`marker-visible-${locationId}`, visible);
}

// Toggle marker visibility
function toggleMarkerVisibility(locationId) {
    const marker = markers[locationId];
    const label = markerLabels[locationId];
    const currentState = getVisibilityState(locationId);
    const newState = !currentState;
    
    if (marker) {
        if (newState) {
            marker.addTo(map);
            if (label) label.addTo(map);
        } else {
            map.removeLayer(marker);
            if (label) map.removeLayer(label);
        }
    }
    
    setVisibilityState(locationId, newState);
    updateToggleButton(locationId, newState);
}

// Update toggle button appearance
function updateToggleButton(locationId, visible) {
    const button = document.getElementById(`toggle-${locationId}`);
    if (button) {
        button.textContent = visible ? '👁️' : '👁️‍🗨️';
        button.style.opacity = visible ? '1' : '0.5';
    }
}

// Function to create custom icon for each location
function createCustomIcon(imageName) {
    return L.icon({
        iconUrl: `/images/${imageName}`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -50]
    });
}

// Load and display locations from data.json
async function loadLocations() {
    try {
        const response = await fetch('/data.json');
        const data = await response.json();
        locations = data.locations;
        
        displayLocations(locations);
        addMarkersToMap(locations);
        
        // Fit map to show all markers
        if (locations.length > 0) {
            const bounds = L.latLngBounds(locations.map(loc => [-loc.latitude, loc.longitude]));
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
        const isVisible = getVisibilityState(location.id);
        
        const marker = L.marker([-location.latitude, location.longitude], {
            icon: createCustomIcon(location.image)
        });
        
        // Add text label above marker
        const labelIcon = L.divIcon({
            className: 'marker-label',
            html: `<div class="marker-label-text">${location.name}</div>`,
            iconSize: [200, 30],
            iconAnchor: [100, 60]
        });
        
        const label = L.marker([-location.latitude, location.longitude], {
            icon: labelIcon,
            interactive: false
        });
        
        // Only add to map if visible
        if (isVisible) {
            marker.addTo(map);
            label.addTo(map);
        }
        
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
        
        // Store marker and label references
        markers[location.id] = marker;
        markerLabels[location.id] = label;
        
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
        
        const isVisible = getVisibilityState(location.id);
        
        locationItem.innerHTML = `
            <div class="location-header">
                <h3>${location.name}</h3>
                <button class="toggle-visibility" id="toggle-${location.id}" title="Toggle visibility">
                    ${isVisible ? '👁️' : '👁️‍🗨️'}
                </button>
            </div>
            <!--<p>${location.description}</p>-->
            <!--<div class="coordinates">📍 ${location.latitude}, ${location.longitude}</div>-->
        `;
        
        // Add click event to zoom to marker (only on the item, not the button)
        locationItem.addEventListener('click', (e) => {
            // Don't trigger if clicking the toggle button
            if (e.target.classList.contains('toggle-visibility')) {
                return;
            }
            const marker = markers[location.id];
            if (marker && getVisibilityState(location.id)) {
                map.setView([-location.latitude, location.longitude], 6);
                marker.openPopup();
                highlightLocation(location.id);
            }
        });
        
        // Add toggle button click event
        const toggleButton = locationItem.querySelector(`#toggle-${location.id}`);
        toggleButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMarkerVisibility(location.id);
        });
        
        // Update button appearance
        updateToggleButton(location.id, isVisible);
        
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

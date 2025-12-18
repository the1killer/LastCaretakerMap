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
    maxZoom: 6,
    zoomSnap: 0.5,
    zoomControl: false
});

// Set the view based on the coordinate system
map.setView([30, 0], 0);

// Create a tiled background image layer
const BackgroundLayer = L.GridLayer.extend({
    createTile: function(coords) {
        const tile = document.createElement('img');
        tile.src = './images/mapbg.png';
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
const radarCircles = {};
let locations = [];
let hiddenLocations = [];
let lastListenerLocations = [];
let caves = [];
let selectedMarkerId = null;

// Load visibility state from localStorage
function getVisibilityState(locationId) {
    const state = localStorage.getItem(`marker-visible-${locationId}`);
    return state === null ? true : state === 'true';
}

// Save visibility state to localStorage
function setVisibilityState(locationId, visible) {
    localStorage.setItem(`marker-visible-${locationId}`, visible);
}

// Get category visibility state from localStorage
function getCategoryVisibilityState(categoryId) {
    const state = localStorage.getItem(`category-visible-${categoryId}`);
    return state === null ? true : state === 'true';
}

// Save category visibility state to localStorage
function setCategoryVisibilityState(categoryId, visible) {
    localStorage.setItem(`category-visible-${categoryId}`, visible);
}

// Toggle all markers in a category
function toggleCategoryVisibility(categoryId, locations) {
    const currentState = getCategoryVisibilityState(categoryId);
    const newState = !currentState;
    
    // Update all markers in this category
    locations.forEach(location => {
        const marker = markers[location.id];
        const label = markerLabels[location.id];
        const radarCircle = radarCircles[location.id];
        
        if (marker) {
            if (newState) {
                marker.addTo(map);
                if (label) label.addTo(map);
                if (radarCircle) radarCircle.addTo(map);
            } else {
                map.removeLayer(marker);
                if (label) map.removeLayer(label);
                if (radarCircle) map.removeLayer(radarCircle);
            }
        }
        
        // Update individual marker state
        setVisibilityState(location.id, newState);
        updateToggleButton(location.id, newState);
    });
    
    // Save category state
    setCategoryVisibilityState(categoryId, newState);
    updateCategoryToggleButton(categoryId, newState);
}

// Update category toggle button appearance
function updateCategoryToggleButton(categoryId, visible) {
    const button = document.getElementById(`category-toggle-${categoryId}`);
    if (button) {
        button.textContent = visible ? '👁️' : '👁️‍🗨️';
        button.style.opacity = visible ? '1' : '0.5';
        button.title = visible ? 'Hide all in category' : 'Show all in category';
    }
}

// Toggle marker visibility
function toggleMarkerVisibility(locationId) {
    const marker = markers[locationId];
    const label = markerLabels[locationId];
    const radarCircle = radarCircles[locationId];
    const currentState = getVisibilityState(locationId);
    const newState = !currentState;
    
    if (marker) {
        if (newState) {
            marker.addTo(map);
            if (label) label.addTo(map);
            if (radarCircle) radarCircle.addTo(map);
        } else {
            map.removeLayer(marker);
            if (label) map.removeLayer(label);
            if (radarCircle) map.removeLayer(radarCircle);
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
function createCustomIcon(imageName, locationType = 'regular') {
    const className = locationType === 'lastListener' ? 'marker-icon-last-listener' : '';
    return L.icon({
        iconUrl: `./images/${imageName}`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -50],
        className: className
    });
}

// Load and display locations from data.json
async function loadLocations() {
    try {
        const response = await fetch('./data.json');
        const data = await response.json();
        locations = data.locations || [];
        hiddenLocations = data.hiddenLocations || [];
        lastListenerLocations = data.lastListenerLocations || [];
        caves = data.caves || [];
        
        refreshDisplay();
    } catch (error) {
        console.error('Error loading locations:', error);
        document.getElementById('location-list').innerHTML = 
            '<p style="color: red;">Error loading locations. Please check data.json file.</p>';
    }
}

// Refresh the display based on current settings
function refreshDisplay() {
    // Clear existing markers
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    Object.values(markerLabels).forEach(label => map.removeLayer(label));
    Object.values(radarCircles).forEach(circle => map.removeLayer(circle));
    
    // Clear marker references
    Object.keys(markers).forEach(key => delete markers[key]);
    Object.keys(markerLabels).forEach(key => delete markerLabels[key]);
    Object.keys(radarCircles).forEach(key => delete radarCircles[key]);
    
    // Get current settings
    const showHidden = localStorage.getItem('show-hidden-locations') === 'true';
    const showLastListener = localStorage.getItem('show-last-listener') === 'true';
    const showCaves = localStorage.getItem('show-caves') === 'true';
    
    // Display sections based on settings
    displayLocationSections();
    
    // Add markers for enabled location types
    addMarkersToMap(locations, 'regular');
    
    if (showHidden) {
        addMarkersToMap(hiddenLocations, 'hidden');
    }
    
    if (showLastListener) {
        addMarkersToMap(lastListenerLocations, 'lastListener');
    }
    
    if (showCaves) {
        addMarkersToMap(caves, 'caves');
    }
    
    // Fit map to show all visible markers
    const visibleLocations = [locations];
    if (showHidden) visibleLocations.push(hiddenLocations);
    if (showLastListener) visibleLocations.push(lastListenerLocations);
    if (showCaves) visibleLocations.push(caves);
    
    const allLocations = visibleLocations.flat();
    if (allLocations.length > 0) {
        const bounds = L.latLngBounds(allLocations.map(loc => [-loc.latitude, loc.longitude]));
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Add markers to the map
function addMarkersToMap(locations, locationType = 'regular') {
    locations.forEach(location => {
        const isVisible = getVisibilityState(location.id);
        
        const marker = L.marker([-location.latitude, location.longitude], {
            icon: createCustomIcon(location.image, locationType)
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
        
        // Add radar circle if radarRadius is specified
        let radarCircle = null;
        if (location.radarRadius) {
            radarCircle = L.circle([-location.latitude + 1, location.longitude], {
                radius: location.radarRadius,
                color: '#CC00CC',
                fillColor: '#CC00CC',
                fillOpacity: 0,
                weight: 2,
                opacity: 0.5
            });
        }
        
        // Only add to map if visible
        if (isVisible) {
            marker.addTo(map);
            label.addTo(map);
            if (radarCircle) radarCircle.addTo(map);
        }
        
        // Create popup content
        const popupContent = `
            <div class="popup-content">
                <h3>${location.name}</h3>
                <p>${location.description}</p>
                <p><strong>Coordinates:</strong> ${location.longitude} : ${location.latitude}</p>
                ${location.image ? `<img src="${location.image}" alt="${location.name}" class="popup-image" onerror="this.style.display='none'">` : ''}
                <p><small class="locid">(id: ${location.id})</small></p>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        
        // Store marker, label, and radar circle references
        markers[location.id] = marker;
        markerLabels[location.id] = label;
        if (radarCircle) radarCircles[location.id] = radarCircle;
        
        // Add click event to highlight sidebar item and marker
        marker.on('click', () => {
            highlightLocation(location.id);
            highlightMarker(location.id);
        });
    });
}

// Display location sections in sidebar
function displayLocationSections() {
    const locationList = document.getElementById('location-list');
    locationList.innerHTML = '';
    
    // Get current settings
    const showHidden = localStorage.getItem('show-hidden-locations') === 'true';
    const showLastListener = localStorage.getItem('show-last-listener') === 'true';
    const showCaves = localStorage.getItem('show-caves') === 'true';
    
    // Create sections
    if (locations.length > 0) {
        const mainSection = createLocationSection('Locations', locations, 'main-locations', true);
        locationList.appendChild(mainSection);
    }
    
    if (showHidden && hiddenLocations.length > 0) {
        const hiddenSection = createLocationSection('Hidden Locations', hiddenLocations, 'hidden-locations', false);
        locationList.appendChild(hiddenSection);
    }
    
    if (showLastListener && lastListenerLocations.length > 0) {
        const lastListenerSection = createLocationSection('Last Listener Locations', lastListenerLocations, 'last-listener-locations', false);
        locationList.appendChild(lastListenerSection);
    }
    
    if (showCaves && caves.length > 0) {
        const cavesSection = createLocationSection('Caves', caves, 'caves-locations', false);
        locationList.appendChild(cavesSection);
    }
}

// Create a collapsible location section
function createLocationSection(title, locations, sectionId, isExpanded = true) {
    const section = document.createElement('div');
    section.className = 'location-section';
    section.id = sectionId;
    
    const categoryVisible = getCategoryVisibilityState(sectionId);
    
    // Create section header
    const header = document.createElement('div');
    header.className = 'section-header';
    header.innerHTML = `
        <div class="section-header-content">
            <button class="toggle-visibility category-toggle" id="category-toggle-${sectionId}" title="${categoryVisible ? 'Hide all in category' : 'Show all in category'}">
                ${categoryVisible ? '👁️' : '👁️‍🗨️'}
            </button>
            <h3> ${title} <span class="section-count">(${locations.length})</span></h3>
        </div>
        <span class="section-toggle">${isExpanded ? '▼' : '▶'}</span>
    `;
    
    // Create section content
    const content = document.createElement('div');
    content.className = `section-content ${isExpanded ? 'expanded' : 'collapsed'}`;
    
    // Add locations to content
    locations.forEach(location => {
        const locationItem = createLocationItem(location);
        content.appendChild(locationItem);
    });
    
    // Toggle section expansion on header click (but not on category toggle button)
    header.addEventListener('click', (e) => {
        // Don't toggle expansion if clicking the category visibility button
        if (e.target.classList.contains('category-toggle') || e.target.closest('.category-toggle')) {
            return;
        }
        
        const isCurrentlyExpanded = content.classList.contains('expanded');
        content.classList.toggle('expanded');
        content.classList.toggle('collapsed');
        header.querySelector('.section-toggle').textContent = isCurrentlyExpanded ? '▶' : '▼';
    });
    
    // Add category toggle button click event
    const categoryToggleButton = header.querySelector(`#category-toggle-${sectionId}`);
    categoryToggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCategoryVisibility(sectionId, locations);
    });
    
    // Update button appearance
    updateCategoryToggleButton(sectionId, categoryVisible);
    
    section.appendChild(header);
    section.appendChild(content);
    
    return section;
}

// Create a location item
function createLocationItem(location) {
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
            highlightMarker(location.id);
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
    
    return locationItem;
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

// Highlight selected marker on map
function highlightMarker(locationId) {
    // Remove highlight from previously selected marker
    if (selectedMarkerId !== null && markers[selectedMarkerId]) {
        const prevMarker = markers[selectedMarkerId];
        const prevIcon = prevMarker.getElement();
        if (prevIcon) {
            prevIcon.classList.remove('marker-selected');
        }
    }
    
    // Add highlight to newly selected marker
    selectedMarkerId = locationId;
    const marker = markers[locationId];
    if (marker) {
        const icon = marker.getElement();
        if (icon) {
            icon.classList.add('marker-selected');
        }
    }
}

// Settings popup functionality
const settingsPopup = document.getElementById('settings-popup');
const settingsButton = document.getElementById('settings-button');
const closeSettingsButton = document.getElementById('close-settings');
const clearDataButton = document.getElementById('clear-data-button');
const showHiddenCheckbox = document.getElementById('show-hidden-locations');
const showLastListenerCheckbox = document.getElementById('show-last-listener');
const showCavesCheckbox = document.getElementById('show-caves');

// Open settings popup
settingsButton.addEventListener('click', () => {
    settingsPopup.classList.add('active');
    // Load current settings state
    loadSettingsState();
});

// Close settings popup
closeSettingsButton.addEventListener('click', () => {
    settingsPopup.classList.remove('active');
});

// Close popup when clicking outside
settingsPopup.addEventListener('click', (e) => {
    if (e.target === settingsPopup) {
        settingsPopup.classList.remove('active');
    }
});

// Close popup with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsPopup.classList.contains('active')) {
        settingsPopup.classList.remove('active');
    }
});

// Clear local data
clearDataButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all local data? This will reset all visibility preferences.')) {
        // Clear all marker visibility states for all location types
        const allLocations = [...locations, ...hiddenLocations, ...lastListenerLocations, ...caves];
        allLocations.forEach(location => {
            localStorage.removeItem(`marker-visible-${location.id}`);
        });
        
        // Clear category visibility states
        localStorage.removeItem('category-visible-main-locations');
        localStorage.removeItem('category-visible-hidden-locations');
        localStorage.removeItem('category-visible-last-listener-locations');
        localStorage.removeItem('category-visible-caves-locations');
        
        // Clear settings
        localStorage.removeItem('show-hidden-locations');
        localStorage.removeItem('show-last-listener');
        localStorage.removeItem('show-caves');
        
        // Reload the page to reset everything
        window.location.reload();
    }
});

// Load settings state from localStorage
function loadSettingsState() {
    const showHidden = localStorage.getItem('show-hidden-locations') === 'true';
    const showLastListener = localStorage.getItem('show-last-listener') === 'true';
    const showCaves = localStorage.getItem('show-caves') === 'true';
    
    showHiddenCheckbox.checked = showHidden;
    showLastListenerCheckbox.checked = showLastListener;
    showCavesCheckbox.checked = showCaves;
}

// Save settings state to localStorage
function saveSettingsState() {
    localStorage.setItem('show-hidden-locations', showHiddenCheckbox.checked);
    localStorage.setItem('show-last-listener', showLastListenerCheckbox.checked);
    localStorage.setItem('show-caves', showCavesCheckbox.checked);
}

// Handle show hidden locations toggle
showHiddenCheckbox.addEventListener('change', () => {
    saveSettingsState();
    refreshDisplay();
});

// Handle show last listener locations toggle
showLastListenerCheckbox.addEventListener('change', () => {
    saveSettingsState();
    refreshDisplay();
});

// Handle show caves toggle
showCavesCheckbox.addEventListener('change', () => {
    saveSettingsState();
    refreshDisplay();
});

// Initialize the application
loadLocations();

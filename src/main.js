import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';

import './settings.js'

import locationData from './data/locations.json';
import locationTypes from './data/types.json';

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

let selectedMarkerId = null;
let searchQuery = '';
let searchAllText = false;

const locations = locationData.locations;
const hiddenLocations = locationData.hiddenLocations;
const lastListenerLocations = locationData.lastListenerLocations;
const caves = locationData.caves;

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
const iconCache = {};
function createCustomIcon(locationType, locationCategory = 'regular') {
    iconCache[locationType] = iconCache[locationType] || {};
    if (iconCache[locationType][locationCategory]) {
        console.log('Using cached icon for', locationType, locationCategory);
        return iconCache[locationType][locationCategory];
    }

    const className = locationCategory === 'lastListener' ? 'marker-icon-last-listener' : '';
    const icon = L.icon({
        iconUrl: `./images/${locationTypes[locationType]}`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -50],
        className: className
    });

    iconCache[locationType][locationCategory] = icon;

    return icon;
}

// Setup search functionality
function setupSearch() {
    const searchInput = document.getElementById('location-search');
    const clearButton = document.getElementById('clear-search');
    const searchOptions = document.querySelector('.search-options');
    const searchAllCheckbox = document.getElementById('search-all-text');
    
    // Show/hide search options on focus/blur
    searchInput.addEventListener('focus', () => {
        searchOptions.classList.add('visible');
    });
    
    searchInput.addEventListener('blur', () => {
        // Delay to allow checkbox click to register
        setTimeout(() => {
            if (!searchAllCheckbox.matches(':focus')) {
                searchOptions.classList.remove('visible');
            }
        }, 150);
    });
    
    // Keep options visible when interacting with checkbox
    searchOptions.addEventListener('mousedown', (e) => {
        e.preventDefault();
    });
    
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        clearButton.style.display = searchQuery ? 'block' : 'none';
        displayLocationSections();
    });
    
    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearButton.style.display = 'none';
        displayLocationSections();
    });
    
    searchAllCheckbox.addEventListener('change', (e) => {
        searchAllText = e.target.checked;
        if (searchQuery) {
            displayLocationSections();
        }
    });
}

// Filter locations based on search query
function filterLocations(locations) {
    if (!searchQuery) return locations;
    return locations.filter(location => {
        const nameMatch = location.name.toLowerCase().includes(searchQuery);
        if (!searchAllText) {
            return nameMatch;
        }
        const descriptionMatch = location.description && location.description.toLowerCase().includes(searchQuery);
        return nameMatch || descriptionMatch;
    });
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
function addMarkersToMap(locations, locationCategory = 'regular') {
    locations.forEach(location => {
        const isVisible = getVisibilityState(location.id);
        
        const marker = L.marker([-location.latitude, location.longitude], {
            icon: createCustomIcon(location.type, locationCategory)
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
    
    // Filter locations based on search query
    const filteredLocations = filterLocations(locations);
    const filteredHiddenLocations = filterLocations(hiddenLocations);
    const filteredLastListenerLocations = filterLocations(lastListenerLocations);
    const filteredCaves = filterLocations(caves);
    
    // Show message if no results
    if (searchQuery && 
        filteredLocations.length === 0 && 
        filteredHiddenLocations.length === 0 && 
        filteredLastListenerLocations.length === 0 && 
        filteredCaves.length === 0) {
        locationList.innerHTML = '<div class="no-results">No locations found</div>';
        return;
    }
    
    // Create sections
    if (filteredLocations.length > 0) {
        const mainSection = createLocationSection('Locations', filteredLocations, 'main-locations', true);
        locationList.appendChild(mainSection);
    }
    
    if (showHidden && filteredHiddenLocations.length > 0) {
        const hiddenSection = createLocationSection('Hidden Locations', filteredHiddenLocations, 'hidden-locations', false);
        locationList.appendChild(hiddenSection);
    }
    
    if (showLastListener && filteredLastListenerLocations.length > 0) {
        const lastListenerSection = createLocationSection('Last Listener Locations', filteredLastListenerLocations, 'last-listener-locations', false);
        locationList.appendChild(lastListenerSection);
    }
    
    if (showCaves && filteredCaves.length > 0) {
        const cavesSection = createLocationSection('Caves', filteredCaves, 'caves-locations', false);
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

// Initialize the application
refreshDisplay();
setupSearch();

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.scss';

import { getMarkerColor } from './settings.js'

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

window.map = map; // Expose map for debugging

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

// Add cloth map as a non-tiling image overlay with rotation
// Define bounds to match the map's coordinate system (adjust as needed)
let msz = 80; 
let xmod = 50; // Offset to align the cloth map
let ymod = 90;
const YSZ_RATIO = 0.8056640625; // Vertical adjustment factor
let clothMapBounds = [[-YSZ_RATIO*msz+xmod, -msz+ymod], 
                        [YSZ_RATIO*msz+xmod, msz+ymod]];

function updateClothMapBounds() {
    const ysz = YSZ_RATIO * msz;
    const newBounds = [[-ysz + xmod, -msz + ymod], [ysz + xmod, msz + ymod]];
    clothMapLayer.setBounds(newBounds);
}

// Create custom rotated image overlay
const RotatedImageOverlay = L.ImageOverlay.extend({
    _initImage: function () {
        L.ImageOverlay.prototype._initImage.call(this);
        // this._image.style.transform = 'rotate(10deg)';
        // this._image.style.transformOrigin = 'center center';
    }
});

// Create the cloth map layer (initially visible)
let clothMapLayer = new RotatedImageOverlay('./images/ingame_cloth_map.png', clothMapBounds, {
    opacity: 0.5,
    interactive: false,
    zIndex: 1,
    className: 'cloth-map-rotated'
}).addTo(map);

let clothMapVisible = false;

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

export const locations = locationData.locations;
export const hiddenLocations = locationData.hiddenLocations;
export const lastListenerLocations = locationData.lastListenerLocations;
export const caves = locationData.caves;

// Load visibility state from localStorage
function getVisibilityState(locationId) {
    const state = localStorage.getItem(`marker-visible-${locationId}`);
    return state === null ? true : state === 'true';
}

// Save visibility state to localStorage
function setVisibilityState(locationId, visible) {
    localStorage.setItem(`marker-visible-${locationId}`, visible);

}

// --- Visit state (not-visited / visited / cleared) ---
const VISIT_STATES = ['not-visited', 'visited', 'cleared'];
const VISIT_ICONS  = { 'not-visited': '☐', 'visited': '✔', 'cleared': '✔' }; //✅
const VISIT_LABELS = { 'not-visited': 'Not Visited', 'visited': 'Visited', 'cleared': 'Cleared' };

function getVisitState(locationId) {
    return localStorage.getItem(`location-visit-${locationId}`) || 'not-visited';
}

function setVisitState(locationId, state) {
    localStorage.setItem(`location-visit-${locationId}`, state);
}

function cycleVisitState(locationId) {
    const current = getVisitState(locationId);
    const next = VISIT_STATES[(VISIT_STATES.indexOf(current) + 1) % VISIT_STATES.length];
    setVisitState(locationId, next);
    return next;
}

// Update the visit overlay badge on a map marker's icon element
function updateMarkerVisitOverlay(locationId, state) {
    const marker = markers[locationId];
    if (!marker) return;
    const el = marker.getElement();
    if (!el) return;
    const overlay = el.querySelector('.visit-overlay');
    if (overlay) overlay.dataset.state = state;
}

// Update the visit icon in the sidebar row
function updateSidebarVisitIcon(locationId, state) {
    const icon = document.getElementById(`sidebar-visit-${locationId}`);
    if (icon) icon.dataset.state = state;
}

// Apply/remove the hide-visit-overlays class from the map container
export function applyVisitOverlayVisibility() {
    const show = localStorage.getItem('show-visit-overlays') !== 'false';
    document.getElementById('map').classList.toggle('hide-visit-overlays', !show);
}

// --- End visit state ---

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
        button.dataset.visible = visible;
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
        button.dataset.visible = visible;
    }
}

// Function to create custom icon for each location
const iconCache = {};
function clearIconCache() {
    Object.keys(iconCache).forEach(key => delete iconCache[key]);
}
function createCustomIcon(locationType, locationCategory = 'regular') {
    const color = getMarkerColor(locationType);
    const cacheKey = `${locationCategory}_${color}`;
    iconCache[locationType] = iconCache[locationType] || {};
    if (iconCache[locationType][cacheKey]) {
        return iconCache[locationType][cacheKey];
    }

    const extraClass = locationCategory === 'lastListener' ? ' marker-icon-last-listener' : '';
    const isBlack = color.toLowerCase() === '#000000' || color.toLowerCase() === 'black';
    const outlineClass = isBlack ? ' no-outline' : '';
    const icon = L.divIcon({
        className: `colored-marker-icon${extraClass}${outlineClass}`,
        html: `<div class="marker-icon-inner" style="background-color: ${color}; -webkit-mask-image: url('./images/${locationTypes[locationType]}'); mask-image: url('./images/${locationTypes[locationType]}');"></div><div class="visit-overlay" data-state="not-visited"></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -50]
    });

    iconCache[locationType][cacheKey] = icon;

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
export function refreshDisplay() {
    // Clear existing markers
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    Object.values(markerLabels).forEach(label => map.removeLayer(label));
    Object.values(radarCircles).forEach(circle => map.removeLayer(circle));
    
    // Clear marker references
    Object.keys(markers).forEach(key => delete markers[key]);
    Object.keys(markerLabels).forEach(key => delete markerLabels[key]);
    Object.keys(radarCircles).forEach(key => delete radarCircles[key]);
    clearIconCache();
    
    // Get current settings
    const showHidden = localStorage.getItem('show-hidden-locations') !== 'false';
    const showLastListener = localStorage.getItem('show-last-listener') !== 'false';
    const showCaves = localStorage.getItem('show-caves') !== 'false';
    
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
    
    // Apply visit overlay visibility setting
    applyVisitOverlayVisibility();

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
        const showPrimaryNumbers = localStorage.getItem('show-primary-numbers') === 'true';
        const primaryNumber = location.primaryNumber || location.primaryNumbers;
        const useNumberIcon = showPrimaryNumbers && primaryNumber;
        const iconColor = getMarkerColor(location.type);
        const markerIcon = useNumberIcon
            ? L.divIcon({
                className: 'number-marker-icon',
                html: `
                    <div class="number-marker">
                        <div class="marker-icon-inner" style="background-color: ${iconColor}; -webkit-mask-image: url('./images/${locationTypes[location.type]}'); mask-image: url('./images/${locationTypes[location.type]}');"></div>
                        <span class="number-marker-number">${primaryNumber}</span>
                        <div class="visit-overlay" data-state="not-visited"></div>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -50]
            })
            : createCustomIcon(location.type, locationCategory);
        
        const marker = L.marker([-location.latitude, location.longitude], {
            icon: markerIcon
        });
        
        // Add text label above marker
        const labelColor = getMarkerColor(location.type);
        const noShadow = labelColor.toLowerCase() === '#000000' || labelColor.toLowerCase() === 'black' ? ' no-shadow' : '';
        const labelIcon = L.divIcon({
            className: 'marker-label',
            html: `<div class="marker-label-text${noShadow}" style="color: ${labelColor}">${location.name}</div>`,
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
        
        // Update visit overlay whenever the marker element is added to the DOM
        marker.on('add', () => {
            const el = marker.getElement();
            if (!el) return;
            const overlay = el.querySelector('.visit-overlay');
            if (overlay) overlay.dataset.state = getVisitState(location.id);
        });

        // Only add to map if visible
        if (isVisible) {
            marker.addTo(map);
            label.addTo(map);
            if (radarCircle) radarCircle.addTo(map);
        }
        
        // Create popup content (generated dynamically so visit state is always fresh)
        const primaryNum = location.primaryNumber || location.primaryNumbers;
        const secondaryNum = location.secondaryNumber || location.secondaryNumbers;
        marker.bindPopup(() => {
            const state = getVisitState(location.id);
            return `
                <div class="popup-content">
                    <h3>${location.name}</h3>
                    <p>${location.description}</p>
                    ${primaryNum ? `<p><strong>Primary #:</strong> ${primaryNum}</p>` : ''}
                    ${secondaryNum ? `<p><strong>Secondary #:</strong> ${secondaryNum}</p>` : ''}
                    <p><strong>Coordinates:</strong> ${location.longitude} : ${location.latitude}</p>
                    <button class="visit-status-btn" data-location-id="${location.id}" data-state="${state}">
                        <span class="visit-icon">${VISIT_ICONS[state]}</span>
                        <span class="visit-text">${VISIT_LABELS[state]}</span>
                    </button>
                    <p><small class="locid">(id: ${location.id})&nbsp;&nbsp;(gameid: ${location.gameid})</small></p>
                </div>
            `;
        });

        // Bind visit-status button click after popup opens
        marker.on('popupopen', (e) => {
            const btn = e.popup.getElement().querySelector('.visit-status-btn');
            if (btn) {
                btn.addEventListener('click', () => {
                    const newState = cycleVisitState(location.id);
                    btn.dataset.state = newState;
                    btn.querySelector('.visit-icon').textContent = VISIT_ICONS[newState];
                    btn.querySelector('.visit-text').textContent = VISIT_LABELS[newState];
                    updateMarkerVisitOverlay(location.id, newState);
                    updateSidebarVisitIcon(location.id, newState);
                });
            }
        });

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
    const showHidden = localStorage.getItem('show-hidden-locations') !== 'false';
    const showLastListener = localStorage.getItem('show-last-listener') !== 'false';
    const showCaves = localStorage.getItem('show-caves') !== 'false';
    
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
            <button class="toggle-visibility category-toggle" id="category-toggle-${sectionId}" title="${categoryVisible ? 'Hide all in category' : 'Show all in category'}"></button>
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
    const visitState = getVisitState(location.id);
    
    locationItem.innerHTML = `
        <span class="sidebar-visit-icon" id="sidebar-visit-${location.id}" data-state="${visitState}"></span>
        <div class="location-header">
            <h3>${location.name}</h3>
            <button class="toggle-visibility" id="toggle-${location.id}" title="Toggle visibility"></button>
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
            map.setView([-location.latitude, location.longitude]);
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
const showClothMapCheckbox = document.getElementById('show-cloth-map');

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
        localStorage.removeItem('show-cloth-map');
        
        // Reload the page to reset everything
        window.location.reload();
    }
});

// Load settings state from localStorage
function loadSettingsState() {
    const showHidden = localStorage.getItem('show-hidden-locations') === 'true';
    const showLastListener = localStorage.getItem('show-last-listener') === 'true';
    const showCaves = localStorage.getItem('show-caves') === 'true';
    const showClothMap = localStorage.getItem('show-cloth-map');
    
    showHiddenCheckbox.checked = showHidden;
    showLastListenerCheckbox.checked = showLastListener;
    showCavesCheckbox.checked = showCaves;
    showClothMapCheckbox.checked = showClothMap === null ? false : showClothMap === 'true';
}

// Save settings state to localStorage
function saveSettingsState() {
    localStorage.setItem('show-hidden-locations', showHiddenCheckbox.checked);
    localStorage.setItem('show-last-listener', showLastListenerCheckbox.checked);
    localStorage.setItem('show-caves', showCavesCheckbox.checked);
    localStorage.setItem('show-cloth-map', showClothMapCheckbox.checked);
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

// Handle show cloth map toggle
function setClothMapControlsVisible(visible) {
    const display = visible ? '' : 'none';
    const left = document.getElementById('cloth-map-controls-left');
    const right = document.getElementById('cloth-map-controls');
    if (left) left.style.display = display;
    if (right) right.style.display = display;
}

showClothMapCheckbox.addEventListener('change', () => {
    saveSettingsState();
    if (showClothMapCheckbox.checked) {
        if (!clothMapVisible) {
            clothMapLayer.addTo(map);
            clothMapVisible = true;
        }
    } else {
        if (clothMapVisible) {
            map.removeLayer(clothMapLayer);
            clothMapVisible = false;
        }
    }
    setClothMapControlsVisible(showClothMapCheckbox.checked);
});

// Initialize cloth map visibility from localStorage
const initialShowClothMap = localStorage.getItem('show-cloth-map');
if (initialShowClothMap !== 'true') {
    map.removeLayer(clothMapLayer);
    clothMapVisible = false;
}
setClothMapControlsVisible(initialShowClothMap === 'true');

// Initialize the application
refreshDisplay();
setupSearch();

// Wire up cloth map position sliders
(function setupClothMapSliders() {
    const xmodSlider = document.getElementById('xmod-slider');
    const ymodSlider = document.getElementById('ymod-slider');
    const xmodValue = document.getElementById('xmod-value');
    const ymodValue = document.getElementById('ymod-value');

    if (!xmodSlider || !ymodSlider) return;

    const mszSlider = document.getElementById('msz-slider');
    const mszValue = document.getElementById('msz-value');

    if (mszSlider) {
        mszSlider.addEventListener('input', () => {
            msz = parseFloat(mszSlider.value);
            mszValue.textContent = msz;
            updateClothMapBounds();
        });
    }

    xmodSlider.addEventListener('input', () => {
        xmod = parseFloat(xmodSlider.value);
        xmodValue.textContent = xmod;
        updateClothMapBounds();
    });

    ymodSlider.addEventListener('input', () => {
        ymod = parseFloat(ymodSlider.value);
        ymodValue.textContent = ymod;
        updateClothMapBounds();
    });
})();

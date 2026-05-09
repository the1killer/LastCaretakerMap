import {
    refreshDisplay,
    applyVisitOverlayVisibility,
    toggleBackgroundLayer,
    locations,
    hiddenLocations,
    lastListenerLocations,
    caves
} from './main.js';

// Default marker colors per type
const defaultMarkerColors = {
    Hanger: '#ffffff',
    NavBeacon: '#ffffff',
    Rocket: '#ffffff',
    RefuelOutpost: '#aa232f',
    HeliosReserve: '#AB5024',
    Habitat: '#1C86E6',
    RockySpire: '#A67E3D',
    Maze: '#A67E3D',
    Ruin: '#000000',
    NDNS: '#555555',
    Cave: '#8A1CE6',
    SeedVault: '#1CE2E6',
    Lazarus: '#ffffff',
    OilRig: '#ffffff',
    SharkBay: '#E61CE6',
    StarChild: '#E61CE6',
    RollerFactory: '#E61CE6',
    GyroPlatform: '#ff9900',
    Silo: '#ff9900'
};

// Friendly display names for types
const typeDisplayNames = {
    Hanger: 'Hangars',
    NavBeacon: 'Nav Beacons',
    Rocket: 'Rocket',
    RefuelOutpost: 'Fuel',
    HeliosReserve: 'Solar',
    Habitat: 'Habitat',
    RockySpire: 'Rockyspire',
    Maze: 'Maze',
    Ruin: 'Ruin',
    NDNS: 'NDNS',
    Cave: 'Cave',
    SeedVault: 'Seed Vault',
    Lazarus: 'Lazarus',
    OilRig: 'Oil Rig',
    SharkBay: 'Shark Bay',
    StarChild: 'Star Child',
    RollerFactory: 'Roller Factory',
    GyroPlatform: 'Gyro Platform',
    Silo: 'Silo'
};

// Get the marker color for a given type, checking user overrides first
export function getMarkerColor(type) {
    const userColor = localStorage.getItem(`marker-color-${type}`);
    if (userColor) return userColor;
    return defaultMarkerColors[type] || '#ffffff';
}

// Settings popup functionality
const settingsPopup = document.getElementById('settings-popup');
const settingsButton = document.getElementById('settings-button');
const closeSettingsButton = document.getElementById('close-settings');
const clearDataButton = document.getElementById('clear-data-button');
const showHiddenCheckbox = document.getElementById('show-hidden-locations');
const showLastListenerCheckbox = document.getElementById('show-last-listener');
const showCavesCheckbox = document.getElementById('show-caves');
const showPrimaryNumbersCheckbox = document.getElementById('show-primary-numbers');
const showVisitOverlaysCheckbox = document.getElementById('show-visit-overlays');
const useSolidBackgroundCheckbox = document.getElementById('use-solid-background');
const backgroundColorPicker = document.getElementById('background-color');
const showClothMapCheckbox = document.getElementById('show-cloth-map');

// Open settings popup
settingsButton.addEventListener('click', () => {
    settingsPopup.classList.add('active');
    // Load current settings state
    loadSettingsState();
    gtag('event', 'settings_open');
});

// Close settings popup
closeSettingsButton.addEventListener('click', () => {
    settingsPopup.classList.remove('active');
    gtag('event', 'settings_close', { method: 'button' });
});

// Close popup when clicking outside
settingsPopup.addEventListener('click', (e) => {
    if (e.target === settingsPopup) {
        settingsPopup.classList.remove('active');
        gtag('event', 'settings_close', { method: 'outside_click' });
    }
});

// Close popup with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsPopup.classList.contains('active')) {
        settingsPopup.classList.remove('active');
        gtag('event', 'settings_close', { method: 'escape_key' });
    }
});

// Clear local data
clearDataButton.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all local data? This will reset all visibility preferences.')) {
        gtag('event', 'settings_clear_data');
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
        localStorage.removeItem('show-primary-numbers');
        localStorage.removeItem('show-visit-overlays');
        localStorage.removeItem('use-solid-background');
        localStorage.removeItem('background-color');
        localStorage.removeItem('show-cloth-map');

        // Clear all visit states
        allLocations.forEach(location => {
            localStorage.removeItem(`location-visit-${location.id}`);
        });

        // Clear marker color settings
        Object.keys(defaultMarkerColors).forEach(type => {
            localStorage.removeItem(`marker-color-${type}`);
        });

        // Reload the page to reset everything
        window.location.reload();
    }
});

// Load settings state from localStorage
function loadSettingsState() {
    const showHidden = localStorage.getItem('show-hidden-locations') !== 'false';
    const showLastListener = localStorage.getItem('show-last-listener') !== 'false';
    const showCaves = localStorage.getItem('show-caves') !== 'false';
    const showPrimaryNumbers = localStorage.getItem('show-primary-numbers') === 'true';
    const showVisitOverlays = localStorage.getItem('show-visit-overlays') !== 'false';
    const useSolidBackground = localStorage.getItem('use-solid-background') === 'true';
    const backgroundColor = localStorage.getItem('background-color') || '#17531b';
    const showClothMap = localStorage.getItem('show-cloth-map') === 'true';

    showHiddenCheckbox.checked = showHidden;
    showLastListenerCheckbox.checked = showLastListener;
    showCavesCheckbox.checked = showCaves;
    showPrimaryNumbersCheckbox.checked = showPrimaryNumbers;
    showVisitOverlaysCheckbox.checked = showVisitOverlays;
    useSolidBackgroundCheckbox.checked = useSolidBackground;
    backgroundColorPicker.value = backgroundColor;
    showClothMapCheckbox.checked = showClothMap;

    // Populate marker color pickers
    populateColorSettings();
}

// Save settings state to localStorage
function saveSettingsState() {
    localStorage.setItem('show-hidden-locations', showHiddenCheckbox.checked);
    localStorage.setItem('show-last-listener', showLastListenerCheckbox.checked);
    localStorage.setItem('show-caves', showCavesCheckbox.checked);
    localStorage.setItem('show-primary-numbers', showPrimaryNumbersCheckbox.checked);
    localStorage.setItem('show-visit-overlays', showVisitOverlaysCheckbox.checked);
    localStorage.setItem('use-solid-background', useSolidBackgroundCheckbox.checked);
    localStorage.setItem('background-color', backgroundColorPicker.value);
    localStorage.setItem('show-cloth-map', showClothMapCheckbox.checked);
}

// Handle show hidden locations toggle
showHiddenCheckbox.addEventListener('change', () => {
    saveSettingsState();
    refreshDisplay();
    gtag('event', 'settings_toggle', { setting: 'show_hidden_locations', value: showHiddenCheckbox.checked });
});

// Handle show last listener locations toggle
showLastListenerCheckbox.addEventListener('change', () => {
    saveSettingsState();
    refreshDisplay();
    gtag('event', 'settings_toggle', { setting: 'show_last_listener', value: showLastListenerCheckbox.checked });
});

// Handle show caves toggle
showCavesCheckbox.addEventListener('change', () => {
    saveSettingsState();
    refreshDisplay();
    gtag('event', 'settings_toggle', { setting: 'show_caves', value: showCavesCheckbox.checked });
});

// Handle display primary numbers toggle
showPrimaryNumbersCheckbox.addEventListener('change', () => {
    saveSettingsState();
    refreshDisplay();
    gtag('event', 'settings_toggle', { setting: 'show_primary_numbers', value: showPrimaryNumbersCheckbox.checked });
});

// Handle show visit overlays toggle (no full refresh needed, just apply CSS class)
showVisitOverlaysCheckbox.addEventListener('change', () => {
    saveSettingsState();
    applyVisitOverlayVisibility();
    gtag('event', 'settings_toggle', { setting: 'show_visit_overlays', value: showVisitOverlaysCheckbox.checked });
});

// Handle use solid background toggle
useSolidBackgroundCheckbox.addEventListener('change', () => {
    saveSettingsState();
    applyBackgroundStyle();
    gtag('event', 'settings_toggle', { setting: 'use_solid_background', value: useSolidBackgroundCheckbox.checked });
});

// Handle background color change
backgroundColorPicker.addEventListener('input', () => {
    saveSettingsState();
    applyBackgroundStyle();
    gtag('event', 'settings_change', { setting: 'background_color', value: backgroundColorPicker.value });
});

// Handle show cloth map toggle
showClothMapCheckbox.addEventListener('change', () => {
    saveSettingsState();
    gtag('event', 'settings_toggle', { setting: 'show_cloth_map', value: showClothMapCheckbox.checked });
});

// Apply background style based on settings
function applyBackgroundStyle() {
    const useSolid = localStorage.getItem('use-solid-background') === 'true';
    const bgColor = localStorage.getItem('background-color') || '#17531b';
    const mapElement = document.getElementById('map');

    if (useSolid) {
        mapElement.style.background = bgColor;
        toggleBackgroundLayer(false); // Hide the background image layer
    } else {
        mapElement.style.background = '#000000';
        toggleBackgroundLayer(true); // Show the background image layer
    }
}

// Populate marker color settings grid
function populateColorSettings() {
    const container = document.getElementById('marker-color-settings');
    if (!container) return;
    container.innerHTML = '';

    Object.keys(defaultMarkerColors).forEach(type => {
        const currentColor = getMarkerColor(type);
        const row = document.createElement('div');
        row.className = 'color-setting-row';
        row.innerHTML = `
            <label for="color-${type}">${typeDisplayNames[type] || type}</label>
            <input type="color" id="color-${type}" value="${currentColor}" data-type="${type}">
        `;
        container.appendChild(row);

        const input = row.querySelector(`#color-${type}`);
        input.addEventListener('input', (e) => {
            localStorage.setItem(`marker-color-${type}`, e.target.value);
            refreshDisplay();
        });
    });
}

// Reset colors to defaults
const resetColorsButton = document.getElementById('reset-colors-button');
if (resetColorsButton) {
    resetColorsButton.addEventListener('click', () => {
        Object.keys(defaultMarkerColors).forEach(type => {
            localStorage.removeItem(`marker-color-${type}`);
        });
        populateColorSettings();
        refreshDisplay();
        gtag('event', 'settings_reset_colors');
    });
}

// Set all colors to white
const allWhiteButton = document.getElementById('all-white-button');
if (allWhiteButton) {
    allWhiteButton.addEventListener('click', () => {
        Object.keys(defaultMarkerColors).forEach(type => {
            localStorage.setItem(`marker-color-${type}`, '#ffffff');
        });
        populateColorSettings();
        refreshDisplay();
        gtag('event', 'settings_all_white_colors');
    });
}

// Apply background style on page load (delayed to ensure proper initialization)
requestAnimationFrame(() => applyBackgroundStyle());

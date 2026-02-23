import { refreshDisplay } from './main.js';

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
    OilRig: '#ffffff'
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
    OilRig: 'Oil Rig'
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
        localStorage.removeItem('show-primary-numbers');
        
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
    
    showHiddenCheckbox.checked = showHidden;
    showLastListenerCheckbox.checked = showLastListener;
    showCavesCheckbox.checked = showCaves;
    showPrimaryNumbersCheckbox.checked = showPrimaryNumbers;

    // Populate marker color pickers
    populateColorSettings();
}

// Save settings state to localStorage
function saveSettingsState() {
    localStorage.setItem('show-hidden-locations', showHiddenCheckbox.checked);
    localStorage.setItem('show-last-listener', showLastListenerCheckbox.checked);
    localStorage.setItem('show-caves', showCavesCheckbox.checked);
    localStorage.setItem('show-primary-numbers', showPrimaryNumbersCheckbox.checked);
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

// Handle display primary numbers toggle
showPrimaryNumbersCheckbox.addEventListener('change', () => {
    saveSettingsState();
    refreshDisplay();
});

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
    });
}

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

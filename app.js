
/**
 * FuelEU Pooling Platform - Compliance Engine
 * Implementation based on Regulation (EU) 2023/1805 (FuelEU Maritime)
 */

var vessels = []; // Global scope for easier debugging/testing
var currentGroups = {}; // Global for export access
let isManualMode = false;
let isReportsMode = false;
let currentPoolIndex = 0; // Changed from currentPoolId
let filters = { imo: '', name: '' };
let isSearchActive = false;

// Constants from regulation context
const PENALTY_RATE_EUR_PER_TONNE = 2400;
const VLSFO_ENERGY_MJ_PER_TONNE = 41000;
const DEFAULT_MAX_POOL_SIZE = 10;
const AWS_API_ENDPOINT = "https://cqwj9z68z6.execute-api.us-east-1.amazonaws.com/prod/fleet";

/* ... (rest of file) ... */

// Initial cloud fetch moved to fetchGlobalStateFromAWS() and called in init()
let globalPoolCounter = 0;

// Base64 Logo (to bypass CORS on local file:// execution)
const LOGO_BASE64 = "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";

function getFleetName(index) {
    return `OSS-${index + 1}`;
}

// Consolidated initialization below at bottom

function init() {
    setupEventListeners();
    initTheme();
    loadVessels(); // Load local vessels first for immediate UI
    loadSavedReports(); // Load local reports first for immediate UI
    updateDashboard(true);

    // Then trigger cloud sync which will update the UI again when data arrives
    fetchGlobalStateFromAWS();
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('theme-icon').textContent = '☀️';
    }
}

function setupEventListeners() {
    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Vessel Management
    // document.getElementById('add-vessel-btn').addEventListener('click', () => toggleModal(true));
    document.querySelectorAll('.close-modal').forEach(el => el.addEventListener('click', () => {
        toggleModal(false);
        toggleSaveModal(false);
    }));

    document.getElementById('vessel-form').addEventListener('submit', (e) => {
        e.preventDefault();
        addVessel();
    });

    // Toggle Saved Reports Panel
    const toggleBtn = document.getElementById('toggle-saved-panel');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            document.getElementById('saved-files-bar').classList.toggle('collapsed');
        });
    }

    // Excel Upload
    document.getElementById('excel-upload').addEventListener('change', handleExcelUpload);

    // Mode Selection
    document.getElementById('auto-mode-btn').addEventListener('click', () => setMode('auto'));
    document.getElementById('manual-mode-btn').addEventListener('click', () => setMode('manual'));

    // Actions
    document.getElementById('run-pooling-btn').addEventListener('click', runOptimizer);
    document.getElementById('save-results-btn').addEventListener('click', openSaveModal);
    document.getElementById('confirm-save-btn').addEventListener('click', handleSaveResults);
    // Reset and Delete listeners moved to Modal section below

    // Search Toggle
    const searchBtn = document.getElementById('search-toggle-btn');
    if (searchBtn) searchBtn.addEventListener('click', toggleSearch);

    // Multi-select
    const selectAll = document.getElementById('select-all');
    if (selectAll) {
        selectAll.addEventListener('change', (e) => {
            const filteredVessels = getFilteredVessels();
            filteredVessels.forEach(v => v.selected = e.target.checked);
            renderVessels();
        });
    }
    // Filter Inputs (Attach directly to new panel inputs)
    const filterNameInput = document.getElementById('filter-name');
    const filterImoInput = document.getElementById('filter-imo');

    const handleSearchInput = () => {
        // Ensure global filters object is updated
        if (typeof filters === 'undefined') window.filters = { name: '', imo: '' };

        filters.name = filterNameInput ? filterNameInput.value.toLowerCase() : '';
        filters.imo = filterImoInput ? filterImoInput.value.toLowerCase() : '';

        // Trigger update
        updateDashboard();
    };

    if (filterNameInput) filterNameInput.addEventListener('input', handleSearchInput);
    if (filterImoInput) filterImoInput.addEventListener('input', handleSearchInput);

    // Modals
    // Reset Modal
    document.getElementById('reset-btn').addEventListener('click', () => {
        const hasPooled = vessels.some(v => v.poolId);
        if (!hasPooled && vessels.length > 0) {
            showToast("No active pools to reset.", "info");
            return;
        }
        document.getElementById('reset-confirmation-modal').classList.add('active');
    });

    document.querySelectorAll('.close-reset-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('reset-confirmation-modal').classList.remove('active');
        });
    });

    document.getElementById('confirm-reset-btn').addEventListener('click', () => {
        executeResetPooling();
        document.getElementById('reset-confirmation-modal').classList.remove('active');
    });

    // Delete All Modal
    const deleteAllBtn = document.getElementById('delete-all-btn');
    if (deleteAllBtn) {
        deleteAllBtn.addEventListener('click', () => {
            document.getElementById('delete-confirmation-modal').classList.add('active');
        });
    }

    document.querySelectorAll('.close-delete-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('delete-confirmation-modal').classList.remove('active');
        });
    });

    document.getElementById('confirm-delete-all-btn').addEventListener('click', () => {
        executeClearAllData();
        document.getElementById('delete-confirmation-modal').classList.remove('active');
    });

    // Cloud Modal
}

function toggleModal(active) {
    document.getElementById('vessel-modal').classList.toggle('active', active);
}

function setMode(mode) {
    isManualMode = (mode === 'manual');
    isReportsMode = false; // Always false now

    document.body.classList.toggle('manual-mode', isManualMode);

    const autoBtn = document.getElementById('auto-mode-btn');
    const manualBtn = document.getElementById('manual-mode-btn');

    [autoBtn, manualBtn].forEach(btn => btn.classList.remove('active'));

    if (mode === 'auto') autoBtn.classList.add('active');
    if (mode === 'manual') manualBtn.classList.add('active');

    const optBtn = document.getElementById('run-pooling-btn');
    optBtn.textContent = isManualMode ? "Create Manual Pool" : "Optimize Fleet";

    renderVessels();
}

// Reusable Excel Processing Logic
// Excel processing logic removed per user request

async function saveVessels(sync = true) {
    localStorage.setItem('fuel_eu_vessels', JSON.stringify(vessels));
    if (sync && AWS_API_ENDPOINT) {
        await saveGlobalStateToAWS();
    }
}

function loadVessels() {
    const saved = localStorage.getItem('fuel_eu_vessels');
    if (saved) {
        try {
            vessels = JSON.parse(saved);
            console.log("Loaded vessels from persistence:", vessels.length);
        } catch (e) {
            console.error("Error loading vessels:", e);
        }
    }
}

async function handleExcelUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    showToast("Processing Excel file...", "info");

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                alert("Excel file appears to be empty.");
                return;
            }

            console.log("First row keys:", Object.keys(jsonData[0]));

            let addedCount = 0;
            let updatedCount = 0;
            let debugInfo = "";

            jsonData.forEach((row, index) => {
                // Flexible column matching (case-insensitive keys)
                const keys = Object.keys(row);
                const getKey = (target) => keys.find(k => k && k.toString().toLowerCase().includes(target));

                // Debug first row only
                if (index === 0) {
                    debugInfo = `Found columns: ${keys.join(', ')}`;
                    console.log("Debug Info:", debugInfo);
                }

                const nameKey = getKey('name') || getKey('vessel');
                const imoKey = getKey('imo');
                const ghgKey = getKey('ghg') || getKey('intensity');
                const cbKey = getKey('compliance') || getKey('balance') || getKey('cb');

                if (nameKey && (ghgKey || cbKey)) {
                    const name = row[nameKey];
                    const imo = imoKey ? row[imoKey] : "N/A";
                    const ghg = parseFloat(row[ghgKey] || 94.1);
                    const cb = parseFloat(row[cbKey] || 0);

                    // ROBUST MATCHING STRATEGY
                    // 1. Normalize inputs
                    const normalizeStr = (str) => str ? String(str).trim().toLowerCase() : "";
                    const safeImo = imo && imo !== "N/A" ? String(imo).trim() : null;

                    // 2. Try match by IMO first (Unique Identifier)
                    let existingIndex = -1;
                    if (safeImo) {
                        existingIndex = vessels.findIndex(v => {
                            const vImo = v.imo && v.imo !== "N/A" ? String(v.imo).trim() : null;
                            return vImo === safeImo;
                        });
                    }

                    // 3. Fallback: Try match by Name if IMO match failed
                    if (existingIndex === -1 && name) {
                        existingIndex = vessels.findIndex(v => normalizeStr(v.name) === normalizeStr(name));
                    }

                    if (existingIndex !== -1) {
                        // UPDATE EXISTING
                        // We update keywords to ensure consistency
                        vessels[existingIndex].name = name;
                        if (safeImo) vessels[existingIndex].imo = safeImo; // Update IMO if the incoming one is valid
                        vessels[existingIndex].ghg = ghg;
                        vessels[existingIndex].cb = cb;
                        vessels[existingIndex].status = cb >= 0 ? "surplus" : "deficit";
                        updatedCount++;
                    } else {
                        // ADD NEW
                        vessels.push({
                            id: Date.now() + Math.random(),
                            name,
                            imo: safeImo || "N/A",
                            ghg,
                            cb,
                            status: cb >= 0 ? "surplus" : "deficit",
                            poolId: null,
                            selected: false
                        });
                        addedCount++;
                    }

                } else if (index === 0) {
                    console.warn("Row 1 failed match. NameKey:", nameKey, "GHG/CB:", ghgKey, cbKey);
                }
            });

            if (addedCount > 0 || updatedCount > 0) {
                saveVessels();
                updateDashboard();
                showToast(`Import Success: ${addedCount} added, ${updatedCount} updated.`);
            } else {
                alert(`No valid vessels found!\n\n${debugInfo}\n\nRequired: 'Name' AND ('GHG' OR 'Compliance')`);
            }

        } catch (error) {
            console.error("Excel parse error:", error);
            alert(`Failed to parse Excel: ${error.message}. \nCheck console for details.`);
        }
        // Reset input so same file can be selected again if needed
        event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
}

// NOTE: Automatic Sync Logic
// If a valid public URL is provided in the future, it can be set here.
// const AUTO_SYNC_URL = "https://example.com/public_fleet_data.xlsx"; 
// if (typeof AUTO_SYNC_URL !== 'undefined' && AUTO_SYNC_URL) { ... fetch logic ... }

// Search Toggle
function toggleSearch() {
    const searchPanel = document.getElementById('search-bar-panel');
    if (!searchPanel) return;

    searchPanel.classList.toggle('hidden');

    // If opening, focus name field
    if (!searchPanel.classList.contains('hidden')) {
        setTimeout(() => document.getElementById('filter-name').focus(), 50);
    }
}

function addVessel() {
    const name = document.getElementById('vessel-name').value;
    const imo = document.getElementById('vessel-imo').value;
    const ghg = parseFloat(document.getElementById('ghg-intensity').value);
    const cb = parseFloat(document.getElementById('compliance-balance').value);

    vessels.push({
        id: Date.now(),
        name,
        imo,
        ghg: ghg || 94.1, // Fallback
        cb,
        status: cb >= 0 ? "surplus" : "deficit",
        poolId: null,
        selected: false
    });

    saveVessels(); // Persist data
    toggleModal(false);
    document.getElementById('vessel-form').reset();
    updateDashboard();
    showToast(`Added ${name} to fleet`);
}

async function fetchGlobalStateFromAWS() {
    if (!AWS_API_ENDPOINT) {
        loadVessels();
        loadSavedReports();
        updateDashboard();
        return;
    }

    showToast("Connecting to Shared Database...");
    try {
        const response = await fetch(AWS_API_ENDPOINT);
        if (response.ok) {
            const cloudData = await response.json();

            let cloudHasVessels = false;
            // Handle both legacy (just array) and new (object with vessels/reports) formats
            if (Array.isArray(cloudData)) {
                if (cloudData.length > 0) {
                    vessels = cloudData;
                    cloudHasVessels = true;
                }
            } else if (cloudData && typeof cloudData === 'object') {
                if (cloudData.vessels && cloudData.vessels.length > 0) {
                    vessels = cloudData.vessels;
                    cloudHasVessels = true;
                }
                if (cloudData.reports) {
                    let reports = cloudData.reports;
                    if (reports.length > 10) reports = reports.slice(0, 10);
                    localStorage.setItem('fuel_eu_reports', JSON.stringify(reports));
                    renderSavedFilesBar();
                }
            }

            // Logic: If cloud is empty but we have local vessels, PUSH local to cloud (Migration)
            if (!cloudHasVessels && vessels.length > 0) {
                console.log("Cloud is empty. Migrating local fleet to Cloud...");
                saveGlobalStateToAWS();
                showToast("Fleet migrated to Shared Database");
            } else {
                saveVessels(false); // Update local cache with cloud data
                showToast("Database Synced (Fleet & Reports)");
            }
            renderSavedFilesBar();
        } else {
            throw new Error("Cloud fetch failed");
        }
    } catch (error) {
        console.error("Cloud fetch error:", error);
        loadVessels();
        loadSavedReports();
        showToast("Using local offline data", "info");
    }
    updateDashboard();
}

async function saveGlobalStateToAWS() {
    if (!AWS_API_ENDPOINT) return;

    const reports = JSON.parse(localStorage.getItem('fuel_eu_reports') || '[]');

    // AWS DynamoDB (via Boto3) doesn't like float types. 
    // We round numerical values to satisfy the backend.
    const sanitizeVessel = (v) => ({
        ...v,
        ghg: Math.round(v.ghg || 0),
        cb: Math.round(v.cb || 0)
    });

    const sanitizeReport = (r) => ({
        ...r,
        vessels: r.vessels.map(sanitizeVessel),
        stats: {
            ...r.stats,
            totalCB: Math.round(r.stats.totalCB || 0)
        }
    });

    const state = {
        vessels: vessels.map(sanitizeVessel),
        reports: reports.map(sanitizeReport),
        lastUpdated: new Date().toISOString()
    };

    try {
        const response = await fetch(AWS_API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state)
        });
        if (response.ok) {
            console.log("Cloud state synchronized");
            showToast("Cloud Sync Successful", "info");
        } else {
            console.error("Cloud sync failed:", response.status);
            showToast("Cloud Sync Failed. Check internet.", "error");
        }
    } catch (error) {
        console.error("Cloud save error:", error);
        showToast("Cloud Connection Error", "error");
    }
}

function loadSavedReports() {
    // Basic local load; fetchGlobalState handles cloud load
    renderSavedFilesBar();
}

// Re-implementing a more robust sync function for the UI if needed
function syncData() {
    fetchGlobalStateFromAWS();
}

function toggleTheme(event) {
    const themeIcon = document.getElementById('theme-icon');

    // Check for browser support
    if (!document.startViewTransition) {
        const isLight = document.body.classList.toggle('light-mode');
        themeIcon.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        return;
    }

    // Get the transition origin
    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
        const isLight = document.body.classList.toggle('light-mode');
        themeIcon.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });

    transition.ready.then(() => {
        document.documentElement.animate(
            {
                clipPath: [
                    `circle(0px at ${x}px ${y}px)`,
                    `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
            },
            {
                duration: 600,
                easing: "cubic-bezier(0.4, 0, 0.2, 1)",
                pseudoElement: "::view-transition-new(root)",
            }
        );
    });
}

function toggleSearch() {
    isSearchActive = !isSearchActive;
    ['filter-name', 'filter-imo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('hidden', !isSearchActive);
    });
}

function getFilteredVessels() {
    return vessels.filter(v => {
        const name = v.name ? v.name.toString().toLowerCase() : "";
        const imo = v.imo ? v.imo.toString().toLowerCase() : "";
        return name.includes(filters.name) && imo.includes(filters.imo);
    });
}

function deleteVessel(id) {
    vessels = vessels.filter(v => v.id !== id);
    saveVessels(); // Persist data
    updateDashboard();
}

function runOptimizer() {
    if (isManualMode) {
        handleManualPooling();
        return;
    }

    // 1. Reset existing pools
    vessels.forEach(v => {
        v.poolId = null;
        v.status = v.cb >= 0 ? "surplus" : "deficit";
        v.selected = false;
    });

    let surpluses = vessels.filter(v => v.cb > 0).sort((a, b) => b.cb - a.cb); // Descending (Largest Surplus First)
    let deficits = vessels.filter(v => v.cb < 0).sort((a, b) => a.cb - b.cb);  // Ascending (Largest Deficit First - e.g. -1.5M)

    let pools = [];
    globalPoolCounter = 0;

    // Multi-Pool Target Zero Strategy
    // Goal: Create multiple pools where Balance is close to 0 (but >= 0)
    // Algo:
    // 1. Pick largest surplus vessel.
    // 2. Greedily add largest possible deficits that fit without making pool negative.
    // 3. Save pool, repeat for next surplus vessel.

    // Multi-Surplus Target Zero Strategy
    // Goal: Use 100% of available Surplus to clear the maximum amount of Deficit.
    // Approach:
    // 1. Sort Deficits Largest to Smallest (Tackle the "Big Rocks" like Star Mariner first).
    // 2. For each Deficit, recruit enough Surplus vessels to cover it.
    // 3. Create a pool if successful.

    // PHASE 1: Main Pooling (Best Fit Strategy)
    // ----------------------------------------
    // Sort logic remains: Largest Deficits First
    let availableSurpluses = [...surpluses];
    let availableDeficits = [...deficits];

    // Sort Deficits: Largest magnitude (-1.5M) first
    availableDeficits.sort((a, b) => a.cb - b.cb);

    // Sort Surpluses: ASCENDING (Smallest First) for "Best Fit" check
    availableSurpluses.sort((a, b) => a.cb - b.cb);

    while (availableDeficits.length > 0) {
        let targetDeficit = availableDeficits[0];
        let requiredAmount = Math.abs(targetDeficit.cb);
        let recruitedSurpluses = [];
        let recruitedSum = 0;

        // STRATEGY A: Best Fit (Single Vessel)
        // Find the smallest surplus that covers the deficit alone
        let bestFitIndex = availableSurpluses.findIndex(s => s.cb >= requiredAmount);

        if (bestFitIndex !== -1) {
            // Found a perfect single match!
            let bestSurplus = availableSurpluses[bestFitIndex];
            recruitedSurpluses.push(bestSurplus);
            recruitedSum += bestSurplus.cb;
        } else {
            // STRATEGY B: Multi-Surplus Aggregation (Greedy from Largest)
            // If no single vessel fits, we need to pool multiple.
            // For this, we want the LARGEST surpluses first to minimize vessel count.
            // We'll iterate backwards through our sorted-ascending list.
            for (let i = availableSurpluses.length - 1; i >= 0; i--) {
                let s = availableSurpluses[i];
                recruitedSurpluses.push(s);
                recruitedSum += s.cb;

                if (recruitedSum >= requiredAmount) break;
            }
        }

        // Commit the Pool
        if (recruitedSum >= requiredAmount) {
            let poolId = getFleetName(globalPoolCounter++);

            // Metadata
            targetDeficit.poolId = poolId;
            targetDeficit.status = "pooled";
            recruitedSurpluses.forEach(s => {
                s.poolId = poolId;
                s.status = "pooled";
            });

            // Create Pool
            let newPool = {
                id: poolId,
                members: [targetDeficit, ...recruitedSurpluses],
                totalCB: targetDeficit.cb + recruitedSum
            };
            pools.push(newPool);

            // Cleanup Available Lists
            availableDeficits.shift();
            let usedIds = recruitedSurpluses.map(v => v.id);
            availableSurpluses = availableSurpluses.filter(s => !usedIds.includes(s.id));

        } else {
            // Skip this deficit (cannot be pooled with current surplus)
            availableDeficits.shift();
            // Don't modify targetDeficit here, it remains unpooled
        }
    }

    // PHASE 2: Gap Fill (Cleanup)
    // ----------------------------------------
    // Try to fit valid unpooled deficits into existing pools
    let unpooledDeficits = deficits.filter(d => !d.poolId);

    // Sort unpooled deficits (Smallest magnitude first?) - easier to fit small ones
    // Deficits are negative, so ascending sort puts large magnitude (-1.5M) first.
    // We want small magnitude (-10k) first: Descending sort.
    unpooledDeficits.sort((a, b) => b.cb - a.cb);

    unpooledDeficits.forEach(d => {
        // Try each pool
        for (let pool of pools) {
            if (pool.totalCB + d.cb >= 0) {
                // It fits!
                d.poolId = pool.id;
                d.status = "pooled";
                pool.members.push(d);
                pool.totalCB += d.cb;
                break; // Stop looking for this vessel
            }
        }
    });

    // PHASE 3: Handle Remaining Surplus
    // ----------------------------------------
    if (availableSurpluses.length > 0) {
        let leftoverPool = {
            id: getFleetName(globalPoolCounter++),
            members: [],
            totalCB: 0
        };
        availableSurpluses.forEach(s => {
            s.poolId = leftoverPool.id;
            s.status = "pooled";
            leftoverPool.members.push(s);
            leftoverPool.totalCB += s.cb;
        });
        pools.push(leftoverPool);
    }

    // Reset unpooled
    deficits.forEach(d => {
        if (!d.poolId) {
            d.poolId = null;
            d.status = "deficit";
        }
    });

    updateDashboard();
    saveVessels(true); // Persist optimization results (and sync any new Excel data) to Cloud
    showToast(`Optimization Complete: ${pools.length} pools generated.`);

    // Show save button after optimization
    document.getElementById('save-results-btn').style.display = 'inline-flex';
}

function openSaveModal() {
    const today = new Date();
    const dateStr = today.toLocaleDateString('en-GB'); // DD/MM/YYYY
    const defaultName = `Fueleu pooling-${dateStr}`;
    document.getElementById('report-name-input').value = defaultName;
    toggleSaveModal(true);
}

function toggleSaveModal(active) {
    document.getElementById('save-modal').classList.toggle('active', active);
}

function handleSaveResults() {
    const reportName = document.getElementById('report-name-input').value.trim();
    if (!reportName) {
        showToast("Please enter a report name", "error");
        return;
    }

    const snapshot = {
        id: Date.now(),
        name: reportName,
        date: new Date().toLocaleString(),
        vessels: JSON.parse(JSON.stringify(vessels)),
        stats: {
            totalCB: vessels.reduce((acc, v) => acc + v.cb, 0),
            pooledCount: vessels.filter(v => v.status === 'pooled').length
        }
    };

    const savedReports = JSON.parse(localStorage.getItem('fuel_eu_reports') || '[]');
    savedReports.unshift(snapshot);

    // Enforce 10-file rolling limit
    if (savedReports.length > 10) {
        savedReports.pop(); // Remove the oldest one
        showToast("Maximum 10 reports reached. Oldest report auto-deleted.");
    }

    localStorage.setItem('fuel_eu_reports', JSON.stringify(savedReports));

    saveVessels(); // This calls saveGlobalStateToAWS internally
    showToast("Optimization results saved to Cloud & Local Storage");
    toggleSaveModal(false);
    document.getElementById('save-results-btn').style.display = 'none';

    // Auto-expand panel on new save
    const panel = document.getElementById('saved-files-bar');
    if (panel) panel.classList.remove('collapsed');

    renderSavedFilesBar(); // Update the bar
}

function renderSavedReports() {
    // This function is now legacy but we keep it for any internal calls that might remain
    // though the UI tab is removed.
}

function downloadHistoricalReport(reportId, type) {
    const savedReports = JSON.parse(localStorage.getItem('fuel_eu_reports') || '[]');
    const report = savedReports.find(r => r.id == reportId);
    if (!report) return;

    // Temporarily swap global vessels to generate correctly
    const originalVessels = vessels;
    vessels = report.vessels;

    if (type === 'excel') exportExcel();
    else exportPDF();

    // Restore
    vessels = originalVessels;
}

function deleteReport(id) {
    if (!confirm("Are you sure you want to delete this report?")) return;
    let savedReports = JSON.parse(localStorage.getItem('fuel_eu_reports') || '[]');
    savedReports = savedReports.filter(r => r.id !== id);
    localStorage.setItem('fuel_eu_reports', JSON.stringify(savedReports));

    // Sync the deletion to AWS
    if (AWS_API_ENDPOINT) {
        saveGlobalStateToAWS();
    }

    renderSavedFilesBar(); // Update the bar
    showToast("Report deleted");
}

function renderSavedFilesBar() {
    const list = document.getElementById('saved-files-list');
    const countTag = document.getElementById('saved-count');
    const savedReports = JSON.parse(localStorage.getItem('fuel_eu_reports') || '[]');

    countTag.textContent = `${savedReports.length}/10`;

    if (savedReports.length === 0) {
        list.innerHTML = `<div class="empty-state-mini" style="padding:1rem; text-align:center; font-size:0.75rem; color:var(--text-muted);">No saved reports.</div>`;
        return;
    }

    list.innerHTML = savedReports.map(report => `
        <div class="saved-file-item">
            <button class="btn-delete-mini" onclick="deleteReport(${report.id})" title="Delete">×</button>
            <div class="file-info">
                <span class="file-name" title="${report.name}">${report.name}</span>
                <span class="file-date">${report.date}</span>
            </div>
            <div class="file-actions">
                <button class="btn-mini" onclick="downloadHistoricalReport('${report.id}', 'pdf')">PDF</button>
                <button class="btn-mini" onclick="downloadHistoricalReport('${report.id}', 'excel')">Excel</button>
            </div>
        </div>
    `).join('');
}

function handleManualPooling() {
    const selected = vessels.filter(v => v.selected);
    if (selected.length < 2) {
        alert("Select at least 2 vessels to form a pool.");
        return;
    }

    const totalCB = selected.reduce((acc, v) => acc + v.cb, 0);
    if (totalCB < 0) {
        if (!confirm("Caution: This pool has a net deficit. Proceed anyway?")) return;
    }

    const newPoolId = getFleetName(globalPoolCounter++);
    selected.forEach(v => {
        v.poolId = newPoolId;
        v.status = "pooled";
        v.selected = false;
    });

    updateDashboard();
    saveVessels(true); // Persist manual pool to Cloud
    showToast(`Manual Pool ${newPoolId} created.`);
}

// Reset Fleet -> Clear All Data (Triggered by Modal)
function executeClearAllData() {
    vessels = [];
    currentPoolIndex = 0;
    globalPoolCounter = 0;
    saveVessels(true);
    updateDashboard();
    showToast("All data deleted.");
}

// Reset Pooling -> Only clear pool assignments (Triggered by Modal)
function executeResetPooling() {
    vessels.forEach(v => {
        v.poolId = null;
        v.status = v.cb >= 0 ? "surplus" : "deficit";
        v.selected = false;
    });

    updateDashboard();
    saveVessels(true);
    showToast("Pooling reset. Fleet data retained.");
}

function updateDashboard(silent = false) {
    // calculateRobinHoodAllocations(); // REMOVED per user request
    renderVessels();
    calculateStats(silent);
}


function renderVessels() {
    const list = document.getElementById('vessel-list');
    const emptyState = document.getElementById('empty-state');
    const footer = document.getElementById('vessel-footer');


    list.innerHTML = '';

    const filteredVessels = getFilteredVessels();

    if (vessels.length === 0) {
        emptyState.style.display = 'flex';
        footer.style.display = 'none';
        return;
    }
    emptyState.style.display = 'none';
    footer.style.display = 'table-footer-group';

    // Group vessels by Pool ID
    const groups = {};
    filteredVessels.forEach(v => {
        const pId = v.poolId || 'Unpooled';
        if (!groups[pId]) groups[pId] = [];
        groups[pId].push(v);
    });

    let totalCB = 0;
    let totalPenalty = 0;
    let totalSavings = 0;

    Object.keys(groups).sort().forEach(pId => {
        const poolVessels = groups[pId];
        const poolCB = poolVessels.reduce((sum, v) => sum + v.cb, 0);

        // Initial individual penalties for vessels in this pool (Before Pooling)
        const initialIndividualPoolPenalty = poolVessels.reduce((sum, v) => {
            if (v.cb >= 0) return sum;
            return sum + (Math.abs(v.cb) / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }, 0);

        // Net Pool Penalty (After Pooling)
        let netPoolPenalty = 0;
        if (poolCB < 0) {
            const avgGhg = poolVessels.reduce((s, m) => s + m.ghg, 0) / poolVessels.length;
            netPoolPenalty = (Math.abs(poolCB) / avgGhg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }

        // Saved amount in this pool
        const poolSaved = initialIndividualPoolPenalty - netPoolPenalty;
        totalSavings += poolSaved;

        // Add a clean group header row
        if (pId !== 'Unpooled') {
            const headerRow = document.createElement('tr');
            headerRow.className = 'pool-group-header-row';

            headerRow.innerHTML = `
                <td colspan="10" class="pool-group-header">
                    <div class="pool-title">
                        <span class="pool-badge">${pId}</span>
                        <span class="pool-vessel-count">${poolVessels.length} ${poolVessels.length === 1 ? 'Vessel' : 'Vessels'}</span>
                    </div>
                </td>
            `;
            list.appendChild(headerRow);
        }

        poolVessels.forEach(v => {
            const row = document.createElement('tr');
            if (v.selected) row.classList.add('selected');

            // Financial Impact Logic
            // 1. Calculate potential standalone penalty (if deficit)
            let standalonePenalty = 0;
            if (v.cb < 0) {
                standalonePenalty = (Math.abs(v.cb) / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
            }

            // 2. Logic for Columns
            let displayPenalty = '—';
            let displaySavings = '—';

            if (v.cb < 0) {
                // It has a standalone penalty
                displayPenalty = `€${Math.floor(standalonePenalty).toLocaleString()}`;
            } else {
                // It generates savings (by offsetting deficit)
                // We display basic surplus value here or just dash? 
                // Requirement: "for positive deficit vessel need to create another column for Savings"
                // Interpret: Surplus vessels = Savings? Or Deficit vessels that are pooled = Savings?
                // Usually "Savings" is the avoided penalty.
                // For a surplus vessel, its "monetary value" is potential savings.
                const surplusValue = (v.cb / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
                displaySavings = `€${Math.floor(surplusValue).toLocaleString()}`;
            }

            // Accumulate Global Totals logic is complex because of Pooling.
            // We track "Total Penalty Payble" and "Total Savings Realized"

            totalCB += v.cb;

            // Conditional Coloring
            const impactClass = v.cb >= 0 ? 'text-success' : 'text-error';

            // Pool ID Column Content
            let poolCellContent = v.poolId ? `<span class="pool-tag">${v.poolId}</span>` : '—';

            if (isManualMode) {
                const existingPools = [...new Set(vessels.map(ship => ship.poolId).filter(p => p))];
                poolCellContent = `
                    <select class="pool-select-dropdown" onchange="changePool(${v.id}, this.value)">
                        <option value="">None</option>
                        ${existingPools.map(p => `<option value="${p}" ${v.poolId === p ? 'selected' : ''}>${p}</option>`).join('')}
                        <option value="NEW_POOL">+ New Pool</option>
                    </select>
                `;
            }

            row.innerHTML = `
                <td class="manual-col col-select">
                    <input type="checkbox" ${v.selected ? 'checked' : ''} onchange="toggleSelect(${v.id})">
                </td>
                <td class="col-imo"><strong>${v.imo}</strong></td>
                <td class="col-name" title="${v.name}">${v.name}</td>
                <td class="col-ghg">${v.ghg}</td>
                <td class="${impactClass} col-cb">${v.cb.toLocaleString()}<span class="unit-label">gCO2eq</span></td>
                <td class="col-pool">${poolCellContent}</td>
                <td class="text-error col-impact text-right">${displayPenalty}</td>
                <td class="text-success col-impact text-right">${displaySavings}</td>
                <td class="col-status text-center"><span class="status-badge ${v.status}">${v.status}</span></td>
                <td class="col-actions">
                    <button onclick="deleteVessel(${v.id})" class="btn-delete" title="Delete Vessel">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
`;
            list.appendChild(row);
        });

        // Add a group footer with summary stats
        if (pId !== 'Unpooled') {
            const footerRow = document.createElement('tr');
            footerRow.className = 'pool-group-footer-row';

            const cbClass = poolCB >= 0 ? 'text-success' : 'text-error';

            footerRow.innerHTML = `
                <td class="manual-col"></td>
                <td colspan="3" class="text-right summary-label">${pId} SUM:</td>
                <td class="pool-summary-cell text-right ${cbClass} text-bold">
                    ${poolCB.toLocaleString()}<span class="unit-label">gCO2eq</span>
                </td>
                <td></td>
                <td class="pool-summary-cell text-right">
                    <div class="pool-summary-item">
                         ${netPoolPenalty > 0 ? `<span class="text-error">Pays: €${Math.floor(netPoolPenalty).toLocaleString()}</span>` : '<span class="text-success">Compliant</span>'}
                    </div>
                </td>
                <td class="pool-summary-cell text-right">
                    <div class="pool-summary-item">
                        <span class="text-success text-bold">Saved: €${Math.abs(poolSaved).toLocaleString(undefined, { minimumFractionDigits: 0 })}</span>
                    </div>
                </td>
                <td colspan="2"></td>
`;
            list.appendChild(footerRow);
        }
    });

    // Total Penalty: Realized penalty after optimization
    let totalFleetPenalty = 0;
    Object.keys(groups).forEach(pId => {
        const poolVessels = groups[pId];
        const poolCB = poolVessels.reduce((sum, v) => sum + v.cb, 0);
        if (pId === 'Unpooled') {
            totalFleetPenalty += poolVessels.reduce((sum, v) => {
                if (v.cb >= 0) return sum;
                return sum + (Math.abs(v.cb) / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
            }, 0);
        } else if (poolCB < 0) {
            const avgGhg = poolVessels.reduce((s, m) => s + m.ghg, 0) / poolVessels.length;
            totalFleetPenalty += (Math.abs(poolCB) / avgGhg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }
    });

    // Total Savings: Initial - Realized
    // (This is already calculated in totalSavings accumulator above per-pool, but let's re-verify)
    // Actually, simple sum of poolSaved is safer

    // Total Footers Summary
    const footerSummary = document.getElementById('vessel-footer');
    footerSummary.innerHTML = `
        <tr class="total-row">
            <td class="manual-col"></td>
            <td colspan="3" class="text-right summary-label">TOTAL FLEET:</td>
            <td class="text-bold text-right ${totalCB < 0 ? 'text-error' : 'text-success'}" id="total-cb-cell">
                ${totalCB.toLocaleString()} gCO2eq
            </td>
            <td></td>
            <td class="text-bold text-right text-error" id="total-penalty-cell">
                €${totalFleetPenalty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </td>
            <td class="text-bold text-right text-success" id="total-savings-cell">
                €${totalSavings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </td>
            <td colspan="2"></td>
        </tr >
    `;
}

function toggleSelect(id) {
    const v = vessels.find(ship => ship.id === id);
    if (v) v.selected = !v.selected;
    renderVessels();
}

function changePool(id, newPoolId) {
    const v = vessels.find(ship => ship.id === id);
    if (!v) return;

    if (newPoolId === "NEW_POOL") {
        v.poolId = getFleetName(globalPoolCounter++);
    } else if (newPoolId === "") {
        v.poolId = null;
    } else {
        v.poolId = newPoolId;
    }

    // Update status based on pooling
    v.status = v.poolId ? "pooled" : (v.cb >= 0 ? "surplus" : "deficit");

    updateDashboard();
    if (newPoolId === "NEW_POOL") {
        showToast(`Created and assigned to ${v.poolId} `);
    } else if (v.poolId) {
        showToast(`Moved to ${v.poolId} `);
    } else {
        showToast(`Removed from pool`);
    }
}

function calculateStats(silent = false) {
    const totalCB = vessels.reduce((acc, v) => acc + v.cb, 0);
    const pooledCount = vessels.filter(v => v.status === 'pooled').length;

    // Potential Savings logic: 
    // Initial Penalty is the sum of all individual penalties for vessels in deficit.
    // Realized Penalty is the sum of penalties of unpooled vessels + net deficit of pools.

    const calculateIndividualDeficitPenalty = (vesselList) => {
        return vesselList.reduce((acc, v) => {
            if (v.cb >= 0) return acc;
            return acc + (Math.abs(v.cb) / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }, 0);
    };

    const initialTotalPenalty = calculateIndividualDeficitPenalty(vessels);

    // Group vessels by pool for current state
    currentGroups = {};
    vessels.forEach(v => {
        const pId = v.poolId || 'Unpooled';
        if (!currentGroups[pId]) currentGroups[pId] = [];
        currentGroups[pId].push(v);
    });

    let currentTotalPenalty = 0;
    Object.keys(currentGroups).forEach(pId => {
        const members = currentGroups[pId];
        const poolCB = members.reduce((sum, v) => sum + v.cb, 0);
        if (pId === 'Unpooled') {
            currentTotalPenalty += calculateIndividualDeficitPenalty(members);
        } else if (poolCB < 0) {
            const avgGhg = members.reduce((s, m) => s + m.ghg, 0) / members.length;
            currentTotalPenalty += (Math.abs(poolCB) / avgGhg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }
    });

    const savings = initialTotalPenalty - currentTotalPenalty;

    // Update UI with animations
    const balanceEl = document.getElementById('total-balance');
    const savingsEl = document.getElementById('total-savings');
    const savingsTitle = document.getElementById('savings-title');
    const pooledCountEl = document.getElementById('pooled-count');

    // Create Breakdown for Potential Savings Card
    let breakdownHtml = '<div class="savings-breakdown">';
    Object.keys(currentGroups).forEach(pId => {
        if (pId === 'Unpooled') return;
        const members = currentGroups[pId];
        const poolCB = members.reduce((sum, v) => sum + v.cb, 0);
        const individualPenalty = calculateIndividualDeficitPenalty(members);
        let netPenalty = 0;
        if (poolCB < 0) {
            const avgGhg = members.reduce((s, m) => s + m.ghg, 0) / members.length;
            netPenalty = (Math.abs(poolCB) / avgGhg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }
        const fleetSaving = individualPenalty - netPenalty;
        if (fleetSaving > 0) {
            breakdownHtml += `
                <div class="breakdown-item">
                    <span class="fleet-name">${pId}</span>
                    <span class="fleet-saving">+€${Math.floor(fleetSaving).toLocaleString()} savings</span>
                </div>
            `;
        }
    });
    breakdownHtml += '</div>';

    if (totalCB < 0 && savings <= 0) {
        if (savingsTitle) savingsTitle.textContent = "Net Fleet Penalty";
    } else {
        if (savingsTitle) savingsTitle.textContent = "Potential Savings";
    }

    if (silent) {
        balanceEl.innerHTML = `${totalCB.toLocaleString()} <span class="unit-label">gCO2eq</span>`;
        savingsEl.textContent = `€${Math.floor(Math.abs(savings)).toLocaleString()} `;
        pooledCountEl.textContent = `${pooledCount} / ${vessels.length}`;
        if (savingsEl.parentElement.querySelector('.savings-breakdown')) {
            savingsEl.parentElement.querySelector('.savings-breakdown').remove();
        }
        savingsEl.insertAdjacentHTML('afterend', breakdownHtml);
    } else {
        animateValue(balanceEl, parseFloat(balanceEl.textContent.replace(/[^\d.-]/g, '')) || 0, totalCB, 1000, '<span class="unit-label">gCO2eq</span>');
        animateValue(savingsEl, parseFloat(savingsEl.textContent.replace(/[^\d.-]/g, '')) || 0, Math.floor(Math.abs(savings)), 1000, "€", true);
        pooledCountEl.textContent = `${pooledCount} / ${vessels.length}`;

        // Update breakdown after a slight delay for better feel
        setTimeout(() => {
            if (savingsEl.parentElement.querySelector('.savings-breakdown')) {
                savingsEl.parentElement.querySelector('.savings-breakdown').remove();
            }
            savingsEl.insertAdjacentHTML('afterend', breakdownHtml);
        }, 500);
    }

    const indicator = document.getElementById('balance-status');
    indicator.className = 'status-indicator ' + (totalCB >= 0 ? 'positive' : 'negative');

    const progress = vessels.length > 0 ? (pooledCount / vessels.length) * 100 : 0;
    document.getElementById('pooling-progress').style.width = `${progress}%`;
}

function animateValue(obj, start, end, duration, affix = "", isPrefix = false) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);

        if (isPrefix) {
            obj.innerHTML = affix + current.toLocaleString();
        } else {
            obj.innerHTML = current.toLocaleString() + affix;
        }

        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon">✨</span> <span class="toast-msg">${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px) scale(0.95)';
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// Helper to force browser to respect filename
// Reliable Base64 Download Helper
function downloadBase64(base64Data, filename, mimeType) {
    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${base64Data}`;
    link.download = filename;
    document.body.appendChild(link);
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    document.body.removeChild(link);
}

function exportExcel() {
    if (!vessels || vessels.length === 0) {
        showToast("No vessels to optimize", "error");
        return;
    }

    // 1. Calculate Summary Stats
    const totalCB = vessels.reduce((acc, v) => acc + v.cb, 0);

    // Calculate penalties
    const calculateDeficitPenalty = (vList) => {
        return vList.reduce((acc, v) => {
            if (v.cb >= 0) return acc;
            return acc + (Math.abs(v.cb) / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }, 0);
    };

    const initialTotalPenalty = calculateDeficitPenalty(vessels); // If no pooling existed

    // Group by Pool to calculate actual current penalties
    const currentGroups = {};
    vessels.forEach(v => {
        const pId = v.poolId || 'Unpooled';
        if (!currentGroups[pId]) currentGroups[pId] = [];
        currentGroups[pId].push(v);
    });

    let currentTotalPenalty = 0;
    Object.keys(currentGroups).forEach(pId => {
        const members = currentGroups[pId];
        const poolCB = members.reduce((sum, v) => sum + v.cb, 0);

        let poolPenalty = 0;
        if (pId === 'Unpooled') {
            poolPenalty = calculateDeficitPenalty(members);
        } else if (poolCB < 0) {
            // Whole pool penalty
            const avgGhg = members.reduce((s, m) => s + m.ghg, 0) / members.length;
            poolPenalty = (Math.abs(poolCB) / avgGhg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }
        currentTotalPenalty += poolPenalty;
    });

    const savings = initialTotalPenalty - currentTotalPenalty;

    // Sort keys: Unpooled last
    const poolKeys = Object.keys(currentGroups).sort((a, b) => {
        if (a === 'Unpooled') return 1;
        if (b === 'Unpooled') return -1;
        return a.localeCompare(b);
    });

    // 2. Prepare Data Structure for Sheet (Template Formatting)
    const exportData = [
        ["ONESEA SOLUTIONS"],
        ["FuelEU Compliance & Pooling Platform"],
        ["Official Optimization Report"],
        [],
        ["GENERATED ON:", new Date().toLocaleString()],
        ["FLEET STATUS:", totalCB >= 0 ? "COMPLIANT" : "DEFICIT"],
        [],
        ["[ SUMMARY METRICS ]"],
        ["Total Fleet Balance", `${totalCB.toLocaleString()} gCO2eq`],
        ["Initial Penalty (Unpooled)", `€${Math.floor(initialTotalPenalty).toLocaleString()}`],
        ["Final Penalty (Optimized)", `€${Math.floor(currentTotalPenalty).toLocaleString()}`],
        ["TOTAL SAVINGS REALIZED", `€${Math.floor(savings).toLocaleString()}`],
        [],
        ["[ DETAILED POOL ASSIGNMENTS ]"],
        ["IMO Number", "Vessel Name", "GHG Intensity", "Compliance Balance", "Pool ID", "Penalty (EUR)", "Status"] // Headers
    ];

    // 3. Add Vessel Rows (Grouped by Pool)
    poolKeys.forEach(pId => {
        const members = currentGroups[pId];
        const poolCB = members.reduce((sum, v) => sum + v.cb, 0);
        const poolStatus = poolCB >= 0 ? "Compliant" : "Deficit";

        exportData.push([
            "",
            "POOL HEADER:",
            "",
            "",
            pId,
            "",
            poolStatus
        ]);

        members.forEach(v => {
            let rowPenalty = 0;
            if (pId === 'Unpooled' && v.cb < 0) {
                rowPenalty = (Math.abs(v.cb) / (v.ghg || 94.1) / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
            } else if (pId !== 'Unpooled' && poolCB < 0) {
                rowPenalty = "Shared pool penalty";
            }

            exportData.push([
                v.imo || "",
                v.name || "",
                Number((v.ghg || 0).toFixed(1)),
                Math.round(v.cb || 0),
                pId,
                typeof rowPenalty === 'number' ? `€${Math.floor(rowPenalty).toLocaleString()}` : rowPenalty,
                v.status || ""
            ]);
        });
        exportData.push(["", "", "", "", "", "", ""]);
    });

    // Ensure all rows have 7 columns (padding)
    const finalizedData = exportData.map(row => {
        const padded = [...row];
        while (padded.length < 7) padded.push("");
        return padded;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(finalizedData);

    // Auto-width columns
    const wscols = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 15 }];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, "Pooling Results");

    try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        downloadBase64(wbout, "FuelEU_Pooling_Report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        showToast("Excel exported successfully!");
    } catch (err) {
        console.error("Excel Export Error:", err);
        showToast("Error generating Excel.", "error");
    }
}

function exportPDF() {
    if (!window.jspdf) {
        showToast("Error: PDF library not loaded");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- Template Assets (Logo) ---
    const logoImg = document.querySelector('.brand-logo');
    if (logoImg) {
        try {
            const canvas = document.createElement("canvas");
            canvas.width = logoImg.naturalWidth;
            canvas.height = logoImg.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(logoImg, 0, 0);
            const logoData = canvas.toDataURL("image/png");
            doc.addImage(logoData, 'PNG', 150, 10, 35, 12); // Right aligned
        } catch (e) {
            console.warn("Could not add logo to PDF:", e);
        }
    }

    // --- Header ---
    doc.setFontSize(22);
    doc.setTextColor(40, 58, 109);
    doc.text("FuelEU Pooling Report", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    // --- Summary Metrics ---
    const currentGroups = {};
    vessels.forEach(v => {
        const pId = v.poolId || 'Unpooled';
        if (!currentGroups[pId]) currentGroups[pId] = [];
        currentGroups[pId].push(v);
    });

    let totalCB = 0;
    let initialTotalPenalty = 0;
    let currentTotalPenalty = 0;

    const poolKeys = Object.keys(currentGroups).sort((a, b) => {
        if (a === 'Unpooled') return 1;
        if (b === 'Unpooled') return -1;
        return a.localeCompare(b);
    });

    poolKeys.forEach(pId => {
        const members = currentGroups[pId];
        totalCB += members.reduce((s, v) => s + v.cb, 0);

        members.forEach(v => {
            if (v.cb < 0) {
                initialTotalPenalty += (Math.abs(v.cb) / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
            }
        });

        const poolCB = members.reduce((s, v) => s + v.cb, 0);
        if (pId === 'Unpooled') {
            currentTotalPenalty += members.reduce((sum, v) => {
                return v.cb < 0 ? sum + (Math.abs(v.cb) / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE : sum;
            }, 0);
        } else if (poolCB < 0) {
            const avgGhg = members.reduce((s, m) => s + m.ghg, 0) / members.length;
            currentTotalPenalty += (Math.abs(poolCB) / avgGhg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }
    });

    const savings = initialTotalPenalty - currentTotalPenalty;

    doc.autoTable({
        startY: 40,
        head: [['Summary Metrics', 'Value']],
        body: [
            ['Total Fleet Balance', `${totalCB.toLocaleString()} gCO2eq`],
            ['Initial Penalty (Unpooled)', `€${Math.floor(initialTotalPenalty).toLocaleString()}`],
            ['Final Penalty (Optimized)', `€${Math.floor(currentTotalPenalty).toLocaleString()}`],
            ['TOTAL SAVINGS', `€${Math.floor(savings).toLocaleString()}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [49, 58, 109], textColor: 255 },
        styles: { fontSize: 10, cellPadding: 4 },
        columnStyles: { 0: { fontStyle: 'bold' } }
    });

    let startY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setTextColor(40, 58, 109);
    doc.text("Detailed Pool Assignments", 14, startY);

    const tableBody = [];
    poolKeys.forEach(pId => {
        const members = currentGroups[pId];
        const poolCB = members.reduce((sum, v) => sum + v.cb, 0);
        const poolStatus = poolCB >= 0 ? "Compliant" : "Deficit";

        tableBody.push([{ content: `Pool: ${pId} | Count: ${members.length} | Balance: ${poolCB.toLocaleString()} | Status: ${poolStatus}`, colSpan: 7, styles: { fillColor: [240, 240, 240], fontStyle: 'bold', halign: 'left' } }]);

        members.forEach(v => {
            let rowPenalty = "0";
            if (pId === 'Unpooled' && v.cb < 0) {
                const val = (Math.abs(v.cb) / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
                rowPenalty = `€${Math.floor(val).toLocaleString()}`;
            } else if (pId !== 'Unpooled') {
                const pCB = poolCB;
                if (pCB < 0) rowPenalty = "Shared";
            }

            tableBody.push([
                v.imo || "",
                v.name || "",
                (v.ghg || 0).toFixed(1),
                Math.round(v.cb || 0).toLocaleString(),
                pId,
                rowPenalty,
                v.status || ""
            ]);
        });
    });

    doc.autoTable({
        startY: startY + 6,
        head: [['IMO', 'Vessel Name', 'GHG', 'Balance', 'Pool', 'Penalty', 'Status']],
        body: tableBody,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 3, lineColor: [200, 200, 200], lineWidth: 0.1 },
        headStyles: { fillColor: [49, 58, 109], textColor: 255, fontStyle: 'bold' }
    });

    // Generate Base64 for PDF
    const pdfBase64 = doc.output('datauristring').split(',')[1];
    downloadBase64(pdfBase64, "FuelEU_Pooling_Report.pdf", "application/pdf");
    showToast("PDF exported successfully!");
}

// Initialize Application
// Consolidated Initialization
document.addEventListener('DOMContentLoaded', () => {
    init();
    console.log("FuelEU Pooling App Initialized");
});

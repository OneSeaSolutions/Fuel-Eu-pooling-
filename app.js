/**
 * FuelEU Pooling Platform - Compliance Engine
 * Implementation based on Regulation (EU) 2023/1805 (FuelEU Maritime)
 */

var vessels = []; // Global scope for easier debugging/testing
let isManualMode = false;
let currentPoolIndex = 0; // Changed from currentPoolId
let filters = { imo: '', name: '' };
let isSearchActive = false;

// Constants from regulation context
const PENALTY_RATE_EUR_PER_TONNE = 2400;
const VLSFO_ENERGY_MJ_PER_TONNE = 41000;
const DEFAULT_MAX_POOL_SIZE = 10;
let globalPoolCounter = 0;

function getFleetName(index) {
    const letter = String.fromCharCode(65 + (index % 26));
    const suffix = index >= 26 ? Math.floor(index / 26) + 1 : '';
    return `Fleet ${letter}${suffix}`;
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    setupEventListeners();
    initTheme();
    updateDashboard(true); // Initial silent update
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
    document.getElementById('add-vessel-btn').addEventListener('click', () => toggleModal(true));
    document.querySelectorAll('.close-modal').forEach(el => el.addEventListener('click', () => toggleModal(false)));

    document.getElementById('vessel-form').addEventListener('submit', (e) => {
        e.preventDefault();
        addVessel();
    });

    // Excel Upload
    document.getElementById('excel-upload').addEventListener('change', handleExcelUpload);

    // Mode Selection
    document.getElementById('auto-mode-btn').addEventListener('click', () => setMode(false));
    document.getElementById('manual-mode-btn').addEventListener('click', () => setMode(true));

    // Actions
    document.getElementById('run-pooling-btn').addEventListener('click', runOptimizer);
    document.getElementById('reset-btn').addEventListener('click', resetFleet);

    // Search Toggle
    document.getElementById('search-toggle-btn').addEventListener('click', toggleSearch);

    // Export
    document.getElementById('export-btn').addEventListener('click', exportToExcel);

    // Multi-select
    document.getElementById('select-all').addEventListener('change', (e) => {
        const filteredVessels = getFilteredVessels();
        filteredVessels.forEach(v => v.selected = e.target.checked);
        renderVessels();
    });

    // Filtering
    document.getElementById('filter-imo').addEventListener('input', (e) => {
        filters.imo = e.target.value.toLowerCase();
        renderVessels();
    });
    document.getElementById('filter-name').addEventListener('input', (e) => {
        filters.name = e.target.value.toLowerCase();
        renderVessels();
    });
}

function toggleModal(active) {
    document.getElementById('vessel-modal').classList.toggle('active', active);
}

function setMode(manual) {
    isManualMode = manual;
    document.body.classList.toggle('manual-mode', manual);

    const autoBtn = document.getElementById('auto-mode-btn');
    const manualBtn = document.getElementById('manual-mode-btn');
    const addVesselBtn = document.getElementById('add-vessel-btn');

    if (manual) {
        manualBtn.classList.add('active');
        autoBtn.classList.remove('active');
    } else {
        autoBtn.classList.add('active');
        manualBtn.classList.remove('active');
    }

    const optBtn = document.getElementById('run-pooling-btn');
    optBtn.textContent = manual ? "Create Manual Pool" : "Optimize Fleet";

    renderVessels();
}

function handleExcelUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Smart Sheet Detection: Scan all sheets
        let allVessels = [];
        let foundSheet = false;

        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            // Convert to array of arrays (headerless first) to scan for header row
            const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            if (!rawData || rawData.length === 0) continue;

            // Find Header Row (look for "IMO", "Name", "Vessel", etc. in first 20 rows)
            let headerRowIndex = -1;
            for (let i = 0; i < Math.min(20, rawData.length); i++) {
                const row = rawData[i];
                if (!row) continue;
                const rowStr = row.map(c => String(c).toLowerCase()).join(" ");
                if ((rowStr.includes("imo") || rowStr.includes("vessel")) && rowStr.includes("compliance")) {
                    headerRowIndex = i;
                    break;
                }
            }

            if (headerRowIndex !== -1) {
                // Parse starting from the found header row
                const json = XLSX.utils.sheet_to_json(sheet, { range: headerRowIndex });
                const newVessels = json.map((row, index) => {
                    const keys = Object.keys(row);
                    const k = (search) => keys.find(key => key.toLowerCase().includes(search));

                    const cbKey = k("compliance") || k("cb") || k("balance");
                    const nameKey = k("name") || k("vessel");
                    const imoKey = k("imo") || k("number");
                    const ghgKey = k("ghg") || k("intensity");

                    if (!cbKey && !nameKey) return null; // Skip invalid rows

                    const cb = parseFloat(row[cbKey] || 0);
                    if (isNaN(cb) && !row[nameKey]) return null; // Skip empty rows

                    return {
                        id: Date.now() + index + Math.random(),
                        name: row[nameKey] || `Ship-${index}`,
                        imo: row[imoKey] || "0000000",
                        ghg: parseFloat(row[ghgKey] || 94.1),
                        cb: cb || 0,
                        status: (cb || 0) >= 0 ? "surplus" : "deficit",
                        poolId: null,
                        selected: false
                    };
                }).filter(v => v !== null);

                if (newVessels.length > 0) {
                    allVessels = [...allVessels, ...newVessels];
                    foundSheet = true;
                    console.log(`Found ${newVessels.length} vessels in sheet: ${sheetName}`);
                }
            }
        }

        if (!foundSheet) {
            // Fallback: Try reading first sheet normally if smart scan failed
            console.warn("Smart scan failed, trying fallback to Sheet 0");
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            const newVessels = json.map((row, index) => {
                // ... (Existing basic parsing logic could go here, but omitted to keep clean. 
                // If smart scan fails, the file is likely very malformed or simple.
                // We will trust smart scan usually works for varied headers).
                return null;
            }).filter(x => x);

            if (allVessels.length === 0) {
                showToast("Error: Could not find valid vessel data. Check headers.");
                return;
            }
        }

        vessels = [...vessels, ...allVessels];
        showToast(`Imported ${allVessels.length} vessels successfully`);

        if (!isManualMode) {
            // OLD: runOptimizer(); 
            // NEW: Just show data first, let user click Optimize
            updateDashboard();
        } else {
            updateDashboard();
        }
    };
    reader.readAsArrayBuffer(file);
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

    toggleModal(false);
    document.getElementById('vessel-form').reset();
    updateDashboard();
    showToast(`Added ${name} to fleet`);
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
    document.getElementById('vessel-thead').classList.toggle('filters-active', isSearchActive);
}

function getFilteredVessels() {
    return vessels.filter(v => {
        const name = v.name ? v.name.toString().toLowerCase() : "";
        return name.includes(filters.name);
    });
}

function deleteVessel(id) {
    vessels = vessels.filter(v => v.id !== id);
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
    showToast(`Optimization Complete: ${pools.length} pools generated.`);
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
    showToast(`Manual Pool ${newPoolId} created.`);
}

function resetFleet() {
    vessels = [];
    currentPoolIndex = 0;
    globalPoolCounter = 0;
    updateDashboard();
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

    Object.keys(groups).sort().forEach(pId => {
        const poolVessels = groups[pId];
        const poolCB = poolVessels.reduce((sum, v) => sum + v.cb, 0);

        // Initial individual penalties for vessels in this pool
        const initialIndividualPoolPenalty = poolVessels.reduce((sum, v) => {
            if (v.cb >= 0) return sum;
            return sum + (Math.abs(v.cb) / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }, 0);

        // Net Pool Penalty
        let netPoolPenalty = 0;
        if (poolCB < 0) {
            const avgGhg = poolVessels.reduce((s, m) => s + m.ghg, 0) / poolVessels.length;
            netPoolPenalty = (Math.abs(poolCB) / avgGhg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }

        // Saved amount in this pool
        const poolSaved = initialIndividualPoolPenalty - netPoolPenalty;

        // Add a clean group header row
        if (pId !== 'Unpooled') {
            const headerRow = document.createElement('tr');
            headerRow.className = 'pool-group-header-row';

            headerRow.innerHTML = `
                <td colspan="9" class="pool-group-header">
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

            // Financial Impact Logic (Saving if CB > 0, Penalty if CB < 0)
            const energyImpactMJ = Math.abs(v.cb) / v.ghg;
            const monetaryValue = (energyImpactMJ / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;

            let penalty = 0;
            if (v.cb < 0) {
                penalty = monetaryValue;
                totalPenalty += penalty;
            } else {
                // Surplus contribution value (not a penalty)
                // totalPenalty is unaffected here for individual unpooled view
            }

            totalCB += v.cb;

            // Conditional Coloring: Green for surplus, Red for deficit
            const impactClass = v.cb >= 0 ? 'text-success' : 'text-error';
            const impactPrefix = v.cb >= 0 ? '+' : '-';

            // Pool ID Column Content (Static or Dropdown)
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
                <td class="${impactClass} col-impact">${impactPrefix}€${monetaryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                <td class="col-status text-center"><span class="status-badge ${v.status}">${v.status}</span></td>
                <td class="col-actions">
                    <button onclick="deleteVessel(${v.id})" class="btn-delete" title="Delete Vessel">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </td>
            `;
            list.appendChild(row);
        });

        // Add a group footer with summary stats exactly under the correct columns
        if (pId !== 'Unpooled') {
            const footerRow = document.createElement('tr');
            footerRow.className = 'pool-group-footer-row';

            const cbClass = poolCB >= 0 ? 'text-success' : 'text-error';

            // Columns: Select, IMO, Name, GHG, CB, Pool, Impact, Status, Actions
            // Index: 0, 1, 2, 3, 4, 5, 6, 7, 8
            footerRow.innerHTML = `
                <td class="manual-col"></td>
                <td colspan="3" class="text-right summary-label">${pId} SUM:</td>
                <td class="pool-summary-cell text-right ${cbClass} text-bold">
                    ${poolCB.toLocaleString()}<span class="unit-label">gCO2eq</span>
                </td>
                <td></td><!-- Pool ID -->
                <td class="pool-summary-cell text-right">
                    <div class="pool-summary-item">
                        <span class="summary-label">SAVED:</span>
                        <span class="text-success text-bold">€${Math.abs(poolSaved).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </td>
                <td colspan="2"></td>
            `;
            list.appendChild(footerRow);
        }
    });

    // Total Penalty: Show net collective status for unpooled + pooled
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

    // Total Footers Summary
    const footerSummary = document.getElementById('vessel-footer');
    footerSummary.innerHTML = `
        <tr class="total-row">
            <td class="manual-col"></td>
            <td colspan="3" class="text-right summary-label">TOTAL FLEET SUM:</td>
            <td class="text-bold text-right ${totalCB < 0 ? 'text-error' : 'text-success'}" id="total-cb-cell">
                ${totalCB.toLocaleString()} gCO2eq
            </td>
            <td></td>
            <td class="text-bold text-right ${totalFleetPenalty > 0 ? 'text-error' : 'text-success'}" id="total-penalty-cell">
                €${totalFleetPenalty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td colspan="2"></td>
        </tr>
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
        showToast(`Created and assigned to ${v.poolId}`);
    } else if (v.poolId) {
        showToast(`Moved to ${v.poolId}`);
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
        balanceEl.innerHTML = `${totalCB.toLocaleString()}<span class="unit-label">gCO2eq</span>`;
        savingsEl.textContent = `€${Math.floor(Math.abs(savings)).toLocaleString()}`;
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

function exportToExcel() {
    if (!vessels || vessels.length === 0) {
        showToast("No vessels to optimize", "error");
        return;
    }

    // 1. Prepare Vessel Details Sheet
    const vesselDetails = vessels.map(v => ({
        "IMO Number": v.imo,
        "Vessel Name": v.name,
        "GHG Intensity": v.ghg,
        "Compliance Balance (gCO2eq)": v.cb,
        "Pool ID": v.poolId || 'Unpooled',
        "Status": v.status,
        "Energy Impact (MJ)": Math.abs(v.cb) / v.ghg,
        "Monetary Impact (€)": (Math.abs(v.cb) / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE
    }));

    // 2. Prepare Summary Sheet
    const totalCB = vessels.reduce((acc, v) => acc + v.cb, 0);

    // Calculate stats using existing logic
    const calculateIndividualDeficitPenalty = (vesselList) => {
        return vesselList.reduce((acc, v) => {
            if (v.cb >= 0) return acc;
            return acc + (Math.abs(v.cb) / v.ghg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }, 0);
    };

    const initialTotalPenalty = calculateIndividualDeficitPenalty(vessels);
    const currentGroups = {};
    vessels.forEach(v => {
        const pId = v.poolId || 'Unpooled';
        if (!currentGroups[pId]) currentGroups[pId] = [];
        currentGroups[pId].push(v);
    });

    let currentTotalPenalty = 0;
    const poolSummaries = [];

    Object.keys(currentGroups).forEach(pId => {
        const members = currentGroups[pId];
        const poolCB = members.reduce((sum, v) => sum + v.cb, 0);
        let netPenalty = 0;
        if (pId === 'Unpooled') {
            netPenalty = calculateIndividualDeficitPenalty(members);
        } else if (poolCB < 0) {
            const avgGhg = members.reduce((s, m) => s + m.ghg, 0) / members.length;
            netPenalty = (Math.abs(poolCB) / avgGhg / VLSFO_ENERGY_MJ_PER_TONNE) * PENALTY_RATE_EUR_PER_TONNE;
        }
        currentTotalPenalty += netPenalty;

        poolSummaries.push({
            "Pool ID": pId,
            "Vessel Count": members.length,
            "Total CB (gCO2eq)": poolCB,
            "Net Penalty (€)": netPenalty,
            "Status": poolCB >= 0 ? "Compliant" : "Deficit"
        });
    });

    const savings = initialTotalPenalty - currentTotalPenalty;

    const summaryData = [
        ["FuelEU Compliance Report"],
        ["Generated on", new Date().toLocaleString()],
        [],
        ["Overall Fleet Stats"],
        ["Total Vessels", vessels.length],
        ["Total Fleet Balance (gCO2eq)", totalCB.toLocaleString()],
        ["Initial Potential Penalty (€)", initialTotalPenalty.toLocaleString()],
        ["Realized Penalty (€)", currentTotalPenalty.toLocaleString()],
        ["Potential Savings (€)", savings.toLocaleString()],
        [],
        ["Pool Summaries"],
        ["Pool ID", "Vessel Count", "Total CB (gCO2eq)", "Net Penalty (€)", "Status"],
        ...poolSummaries.map(p => [p["Pool ID"], p["Vessel Count"], p["Total CB (gCO2eq)"], p["Net Penalty (€)"], p["Status"]])
    ];

    // Create workbook and append sheets
    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Fleet Summary");

    const wsDetails = XLSX.utils.json_to_sheet(vesselDetails);
    XLSX.utils.book_append_sheet(wb, wsDetails, "Vessel Details");

    // Export
    XLSX.writeFile(wb, `FuelEU_Compliance_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Report exported successfully!");
}

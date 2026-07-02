// ============================================================
// LANDMARK GROUPS TRACKER - COMPLETE FRONTEND
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================

const APP_CONFIG = {
    // Default credentials (you can change these)
    DEFAULT_USERNAME: 'admin',
    DEFAULT_PASSWORD: 'admin123',
    
    // API endpoints (will be set in settings)
    API_URL: '',
    GEMINI_API_KEY: '',
    
    // Status colors for display
    STATUS_COLORS: {
        'Confirmed': '#48BB78',
        'Tentative': '#F6AD55',
        'Cancelled': '#FC8181',
        'Lost': '#FC8181',
        'Inquiry': '#9F7AEA',
        'Offered': '#63B3ED'
    }
};

// ============================================================
// STATE MANAGEMENT
// ============================================================

let state = {
    isLoggedIn: false,
    currentUser: 'admin',
    groups: [],
    dashboardData: null,
    followUps: [],
    settings: {
        webAppUrl: '',
        geminiKey: ''
    }
};

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // Load saved settings
    loadSettings();
    
    // Check if already logged in
    const savedSession = sessionStorage.getItem('lgt_session');
    if (savedSession === 'true') {
        showMainApp();
        loadDashboard();
        loadGroups();
    }
    
    // Setup login form
    document.getElementById('loginPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    // Setup add group form
    document.getElementById('addGroupForm').addEventListener('submit', function(e) {
        e.preventDefault();
        handleAddGroup();
    });
    
    // Setup quick add form
    document.getElementById('quickAddForm').addEventListener('submit', function(e) {
        e.preventDefault();
        handleQuickAdd();
    });
    
    // Setup settings form
    document.getElementById('settingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveSettings();
    });
    
    // Setup navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const section = this.dataset.section;
            navigateTo(section);
        });
    });
    
    // Initialize date inputs
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('addCheckIn').value = today;
    document.getElementById('addCheckOut').value = today;
    document.getElementById('quickCheckIn').value = today;
    document.getElementById('quickCheckOut').value = today;
    document.getElementById('reportMonth').value = today.substring(0, 7);
    
    // Populate hotel dropdowns
    populateHotelDropdowns();
    
    // Load agents list
    loadAgents();
});

// ============================================================
// LOGIN / LOGOUT
// ============================================================

function handleLogin() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    if (username === APP_CONFIG.DEFAULT_USERNAME && password === APP_CONFIG.DEFAULT_PASSWORD) {
        state.isLoggedIn = true;
        state.currentUser = username;
        sessionStorage.setItem('lgt_session', 'true');
        sessionStorage.setItem('lgt_user', username);
        
        showMainApp();
        loadDashboard();
        loadGroups();
        checkFollowUps();
        
        // Show success message
        showNotification('Welcome back, ' + username + '!', 'success');
    } else {
        showNotification('Invalid username or password', 'error');
    }
}

function handleLogout() {
    state.isLoggedIn = false;
    sessionStorage.removeItem('lgt_session');
    sessionStorage.removeItem('lgt_user');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
    showNotification('Logged out successfully', 'info');
}

function showMainApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('userDisplay').textContent = state.currentUser;
}

// ============================================================
// NAVIGATION
// ============================================================

function navigateTo(section) {
    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');
    
    // Update sections
    document.querySelectorAll('.section').forEach(s => {
        s.classList.remove('active');
    });
    const targetSection = document.getElementById(`section-${section}`);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // Load data based on section
    switch(section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'groups':
            loadGroups();
            break;
        case 'followUps':
            checkFollowUps();
            break;
        case 'reports':
            generateReport();
            break;
    }
}

// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {
    try {
        const data = await callApi('getDashboard');
        
        if (data && data.success && data.data) {
            const d = data.data;
            
            // Update stats
            document.getElementById('activeGroups').textContent = d.activeGroups || 0;
            document.getElementById('roomsToday').textContent = d.roomsToday || 0;
            document.getElementById('revenueYTD').textContent = 'AED ' + formatCurrency(d.revenueYTD || 0);
            document.getElementById('comingWeek').textContent = d.comingWeek || 0;
            document.getElementById('followUpsDue').textContent = d.followUpsDue || 0;
            
            // Update notification badge
            document.getElementById('notificationCount').textContent = d.followUpsDue || 0;
            
            // Render status chart
            renderStatusChart(d.statusCounts || {});
            
            // Render top agents
            renderTopAgents(d.topAgents || []);
            
            // Render monthly chart
            renderMonthlyChart(d.monthlyData || {});
            
            state.dashboardData = d;
        } else {
            showNotification('Failed to load dashboard data', 'error');
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showNotification('Error loading dashboard: ' + error.message, 'error');
    }
}

function renderStatusChart(statusCounts) {
    const container = document.getElementById('statusChart');
    
    const statuses = Object.keys(statusCounts);
    const counts = Object.values(statusCounts);
    
    if (statuses.length === 0) {
        container.innerHTML = '<p class="text-muted">No data available</p>';
        return;
    }
    
    const colors = ['#48BB78', '#F6AD55', '#FC8181', '#9F7AEA', '#63B3ED', '#4A5568'];
    
    let html = '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">';
    statuses.forEach((status, index) => {
        const color = colors[index % colors.length];
        const count = counts[index] || 0;
        const percentage = statuses.reduce((sum, s) => sum + (statusCounts[s] || 0), 0) > 0 
            ? Math.round((count / statuses.reduce((sum, s) => sum + (statusCounts[s] || 0), 0)) * 100) 
            : 0;
        
        html += `
            <div style="display:flex;flex-direction:column;align-items:center;padding:12px 20px;background:var(--background);border-radius:8px;min-width:80px;">
                <div style="font-size:24px;font-weight:700;color:${color};">${count}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${status}</div>
                <div style="font-size:11px;color:var(--text-secondary);">${percentage}%</div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function renderTopAgents(agents) {
    const container = document.getElementById('topAgentsList');
    
    if (!agents || agents.length === 0) {
        container.innerHTML = '<p class="text-muted">No agent data available</p>';
        return;
    }
    
    let html = '<div class="agent-list">';
    agents.slice(0, 5).forEach((agent, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index+1}.`;
        html += `
            <div class="agent-item">
                <span class="agent-name">${medal} ${agent.name}</span>
                <span class="agent-revenue">AED ${formatCurrency(agent.revenue)}</span>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function renderMonthlyChart(monthlyData) {
    const container = document.getElementById('monthlyChart');
    
    const months = Object.keys(monthlyData);
    const revenues = Object.values(monthlyData);
    
    if (months.length === 0 || revenues.every(r => r === 0)) {
        container.innerHTML = '<p class="text-muted">No monthly data available</p>';
        return;
    }
    
    const maxRevenue = Math.max(...revenues, 1);
    
    let html = '<div style="display:flex;align-items:flex-end;gap:8px;height:150px;padding:8px 0;">';
    months.forEach((month, index) => {
        const height = (revenues[index] / maxRevenue) * 130;
        const color = '#4A90D9';
        html += `
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;">
                <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">${formatCurrency(revenues[index])}</div>
                <div style="width:100%;max-width:40px;height:${height}px;background:${color};border-radius:4px 4px 0 0;transition:height 0.3s;"></div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;font-weight:600;">${month}</div>
            </div>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

// ============================================================
// GROUPS
// ============================================================

async function loadGroups() {
    try {
        const data = await callApi('getGroups');
        
        if (data && data.success) {
            state.groups = data.data || [];
            renderGroupsTable(state.groups);
        } else {
            showNotification('Failed to load groups', 'error');
        }
    } catch (error) {
        console.error('Error loading groups:', error);
        showNotification('Error loading groups: ' + error.message, 'error');
    }
}

function renderGroupsTable(groups) {
    const tbody = document.getElementById('groupsTableBody');
    
    if (!groups || groups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No groups found</td></tr>';
        return;
    }
    
    let html = '';
    groups.forEach(group => {
        const statusClass = group['Status'] || 'Inquiry';
        const statusColor = APP_CONFIG.STATUS_COLORS[statusClass] || '#4A5568';
        
        html += `
            <tr>
                <td><strong>${group['Group ID'] || 'N/A'}</strong></td>
                <td>${group['Hotel'] || 'N/A'}</td>
                <td>${group['Agent'] || 'N/A'}</td>
                <td><span class="status-badge ${statusClass}">${statusClass}</span></td>
                <td>${group['Check-In'] || 'N/A'}</td>
                <td>${group['Check-Out'] || 'N/A'}</td>
                <td>${group['Total Rooms'] || 0}</td>
                <td>AED ${formatCurrency(group['Net Revenue'] || 0)}</td>
                <td>
                    <button onclick="viewGroup('${group['Group ID']}')" class="btn-secondary btn-sm" title="View">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="editGroup('${group['Group ID']}')" class="btn-secondary btn-sm" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteGroup('${group['Group ID']}')" class="btn-danger btn-sm" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function filterGroups() {
    const searchTerm = document.getElementById('searchGroups').value.toLowerCase();
    const statusFilter = document.getElementById('filterStatus').value;
    const hotelFilter = document.getElementById('filterHotel').value;
    
    let filtered = state.groups;
    
    if (searchTerm) {
        filtered = filtered.filter(g => 
            (g['Group ID'] || '').toLowerCase().includes(searchTerm) ||
            (g['Agent'] || '').toLowerCase().includes(searchTerm) ||
            (g['Hotel'] || '').toLowerCase().includes(searchTerm)
        );
    }
    
    if (statusFilter !== 'All') {
        filtered = filtered.filter(g => g['Status'] === statusFilter);
    }
    
    if (hotelFilter !== 'All') {
        filtered = filtered.filter(g => g['Hotel'] === hotelFilter);
    }
    
    renderGroupsTable(filtered);
}

function refreshGroups() {
    loadGroups();
    showNotification('Groups refreshed', 'success');
}

function viewGroup(groupId) {
    const group = state.groups.find(g => g['Group ID'] === groupId);
    if (!group) {
        showNotification('Group not found', 'error');
        return;
    }
    
    let details = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
    Object.keys(group).forEach(key => {
        if (key && group[key] && group[key] !== '') {
            details += `
                <div>
                    <strong style="font-size:12px;color:var(--text-secondary);">${key}:</strong>
                    <div style="font-size:14px;">${group[key]}</div>
                </div>
            `;
        }
    });
    details += '</div>';
    
    showModal('Group Details: ' + groupId, details);
}

function editGroup(groupId) {
    const group = state.groups.find(g => g['Group ID'] === groupId);
    if (!group) {
        showNotification('Group not found', 'error');
        return;
    }
    
    // Pre-fill the add form with group data
    document.getElementById('addHotel').value = group['Hotel'] || '';
    document.getElementById('addAgent').value = group['Agent'] || '';
    document.getElementById('addStatus').value = group['Status'] || 'Inquiry';
    document.getElementById('addCheckIn').value = group['Check-In'] || '';
    document.getElementById('addCheckOut').value = group['Check-Out'] || '';
    document.getElementById('addRoomType').value = group['Room Type'] || 'Standard';
    document.getElementById('addPaidRooms').value = group['Paid Rooms'] || 0;
    document.getElementById('addFOCPolicy').value = group['FOC Policy'] || 'None';
    document.getElementById('addFOCRooms').value = group['FOC Rooms'] || 0;
    document.getElementById('addRate').value = group['Rate'] || 0;
    document.getElementById('addTDInclusive').value = group['TD Inclusive'] || 'No';
    document.getElementById('addMealPlan').value = group['Meal Plan'] || 'Room Only';
    document.getElementById('addMealSupplement').value = group['Meal Supplement'] || 0;
    document.getElementById('addCurrency').value = group['Currency'] || 'AED';
    document.getElementById('addExchangeRate').value = group['Exchange Rate'] || 1;
    document.getElementById('addCutoffDate').value = group['Cutoff Date'] || '';
    document.getElementById('addRemarks').value = group['Remarks'] || '';
    
    // Store group ID for update
    document.getElementById('addGroupForm').dataset.editId = groupId;
    document.querySelector('#addGroupForm button[type="submit"]').textContent = 'Update Group';
    
    // Navigate to add group section
    navigateTo('addGroup');
    showNotification('Edit mode: Update the group details', 'info');
}

async function deleteGroup(groupId) {
    if (!confirm(`Are you sure you want to delete group ${groupId}?`)) {
        return;
    }
    
    try {
        const result = await callApi('deleteGroup', { groupId: groupId });
        
        if (result && result.success) {
            showNotification(result.message, 'success');
            loadGroups();
            loadDashboard();
        } else {
            showNotification(result?.message || 'Failed to delete group', 'error');
        }
    } catch (error) {
        console.error('Error deleting group:', error);
        showNotification('Error deleting group: ' + error.message, 'error');
    }
}

// ============================================================
// ADD GROUP
// ============================================================

async function handleAddGroup() {
    const form = document.getElementById('addGroupForm');
    const editId = form.dataset.editId;
    
    // Calculate nights
    const checkIn = document.getElementById('addCheckIn').value;
    const checkOut = document.getElementById('addCheckOut').value;
    let nights = 0;
    if (checkIn && checkOut) {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }
    
    const paidRooms = parseInt(document.getElementById('addPaidRooms').value) || 0;
    const focRooms = parseInt(document.getElementById('addFOCRooms').value) || 0;
    const totalRooms = paidRooms + focRooms;
    
    const data = {
        hotel: document.getElementById('addHotel').value,
        agent: document.getElementById('addAgent').value,
        status: document.getElementById('addStatus').value,
        checkIn: checkIn,
        checkOut: checkOut,
        nights: nights,
        roomType: document.getElementById('addRoomType').value,
        paidRooms: paidRooms,
        focPolicy: document.getElementById('addFOCPolicy').value,
        focRooms: focRooms,
        totalRooms: totalRooms,
        rate: parseFloat(document.getElementById('addRate').value) || 0,
        tdInclusive: document.getElementById('addTDInclusive').value,
        mealPlan: document.getElementById('addMealPlan').value,
        mealSupplement: parseFloat(document.getElementById('addMealSupplement').value) || 0,
        currency: document.getElementById('addCurrency').value,
        exchangeRate: parseFloat(document.getElementById('addExchangeRate').value) || 1,
        cutoffDate: document.getElementById('addCutoffDate').value || '',
        remarks: document.getElementById('addRemarks').value || '',
        source: 'Manual',
        totalRoomNights: totalRooms * nights
    };
    
    try {
        let result;
        if (editId) {
            // Update existing group
            result = await callApi('updateGroup', { groupId: editId, data: data });
        } else {
            // Add new group
            result = await callApi('addGroup', { data: data });
        }
        
        if (result && result.success) {
            showNotification(result.message, 'success');
            form.reset();
            form.dataset.editId = '';
            document.querySelector('#addGroupForm button[type="submit"]').textContent = 'Save Group';
            loadGroups();
            loadDashboard();
            loadAgents();
        } else {
            showNotification(result?.message || 'Failed to save group', 'error');
        }
    } catch (error) {
        console.error('Error saving group:', error);
        showNotification('Error saving group: ' + error.message, 'error');
    }
}

// ============================================================
// QUICK ADD
// ============================================================

async function handleQuickAdd() {
    const checkIn = document.getElementById('quickCheckIn').value;
    const checkOut = document.getElementById('quickCheckOut').value;
    let nights = 0;
    if (checkIn && checkOut) {
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }
    
    const totalRooms = parseInt(document.getElementById('quickRooms').value) || 0;
    
    const data = {
        hotel: document.getElementById('quickHotel').value,
        agent: document.getElementById('quickAgent').value,
        status: document.getElementById('quickStatus').value,
        checkIn: checkIn,
        checkOut: checkOut,
        nights: nights,
        roomType: 'Standard',
        paidRooms: totalRooms,
        focPolicy: 'None',
        focRooms: 0,
        totalRooms: totalRooms,
        rate: parseFloat(document.getElementById('quickRate').value) || 0,
        tdInclusive: 'No',
        mealPlan: 'Room Only',
        mealSupplement: 0,
        currency: 'AED',
        exchangeRate: 1,
        cutoffDate: '',
        remarks: 'Quick add',
        source: 'Quick Add',
        totalRoomNights: totalRooms * nights
    };
    
    try {
        const result = await callApi('addGroup', { data: data });
        
        if (result && result.success) {
            showNotification(result.message, 'success');
            document.getElementById('quickAddForm').reset();
            loadGroups();
            loadDashboard();
            loadAgents();
        } else {
            showNotification(result?.message || 'Failed to add group', 'error');
        }
    } catch (error) {
        console.error('Error adding group:', error);
        showNotification('Error adding group: ' + error.message, 'error');
    }
}

// ============================================================
// AI EXTRACTION
// ============================================================

async function extractWithAI() {
    const text = document.getElementById('aiText').value;
    const source = document.getElementById('aiSource').value;
    
    if (!text || text.trim() === '') {
        showNotification('Please paste some text to extract', 'error');
        return;
    }
    
    const resultDiv = document.getElementById('aiResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="text-center text-muted">⏳ Processing with AI...</div>';
    
    try {
        const result = await callApi('extractWithAI', { text: text, source: source });
        
        if (result && result.success && result.data) {
            const data = result.data;
            
            // Display extracted data
            let html = `
                <div style="background:var(--background);padding:16px;border-radius:8px;margin-top:12px;">
                    <h4 style="color:var(--primary);margin-bottom:12px;">✅ Extracted Data</h4>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            `;
            
            Object.keys(data).forEach(key => {
                if (data[key] && data[key] !== '') {
                    html += `
                        <div>
                            <strong style="font-size:12px;color:var(--text-secondary);">${key}:</strong>
                            <div style="font-size:14px;">${data[key]}</div>
                        </div>
                    `;
                }
            });
            
            html += `
                    </div>
                    <div style="margin-top:16px;display:flex;gap:8px;">
                        <button onclick="addExtractedGroup()" class="btn-primary btn-sm">
                            <i class="fas fa-save"></i> Add Group
                        </button>
                        <button onclick="document.getElementById('aiResult').style.display='none'" class="btn-secondary btn-sm">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                </div>
            `;
            
            resultDiv.innerHTML = html;
            
            // Store extracted data for adding
            resultDiv.dataset.extractedData = JSON.stringify(data);
            
            showNotification('Data extracted successfully!', 'success');
        } else {
            resultDiv.innerHTML = `
                <div style="background:#FC818120;padding:16px;border-radius:8px;margin-top:12px;color:#FC8181;">
                    <strong>❌ ${result?.message || 'Failed to extract data'}</strong>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error extracting with AI:', error);
        resultDiv.innerHTML = `
            <div style="background:#FC818120;padding:16px;border-radius:8px;margin-top:12px;color:#FC8181;">
                <strong>❌ Error: ${error.message}</strong>
            </div>
        `;
    }
}

function addExtractedGroup() {
    const resultDiv = document.getElementById('aiResult');
    const dataStr = resultDiv.dataset.extractedData;
    
    if (!dataStr) {
        showNotification('No extracted data found', 'error');
        return;
    }
    
    try {
        const data = JSON.parse(dataStr);
        
        // Pre-fill the add form
        document.getElementById('addHotel').value = data.hotel || '';
        document.getElementById('addAgent').value = data.agent || '';
        document.getElementById('addStatus').value = 'Inquiry';
        document.getElementById('addCheckIn').value = data.checkIn || '';
        document.getElementById('addCheckOut').value = data.checkOut || '';
        document.getElementById('addRoomType').value = data.roomType || 'Standard';
        document.getElementById('addPaidRooms').value = data.paidRooms || 0;
        document.getElementById('addFOCPolicy').value = data.focPolicy || 'None';
        document.getElementById('addFOCRooms').value = data.focRooms || 0;
        document.getElementById('addRate').value = data.rate || 0;
        document.getElementById('addTDInclusive').value = data.tdInclusive || 'No';
        document.getElementById('addMealPlan').value = data.mealPlan || 'Room Only';
        document.getElementById('addMealSupplement').value = data.mealSupplement || 0;
        document.getElementById('addCurrency').value = data.currency || 'AED';
        document.getElementById('addExchangeRate').value = data.exchangeRate || 1;
        document.getElementById('addCutoffDate').value = data.cutoffDate || '';
        document.getElementById('addRemarks').value = data.remarks || '';
        document.getElementById('aiSource').value = data.source || 'Email';
        
        // Navigate to add group section
        navigateTo('addGroup');
        resultDiv.style.display = 'none';
        showNotification('Extracted data loaded into form', 'success');
        
    } catch (error) {
        console.error('Error adding extracted group:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

// ============================================================
// FOLLOW-UPS
// ============================================================

async function checkFollowUps() {
    try {
        const result = await callApi('getFollowUps');
        
        if (result && result.success) {
            state.followUps = result.groups || [];
            renderFollowUps(state.followUps);
            
            // Update badge
            document.getElementById('notificationCount').textContent = result.count || 0;
        }
    } catch (error) {
        console.error('Error checking follow-ups:', error);
        showNotification('Error checking follow-ups: ' + error.message, 'error');
    }
}

function renderFollowUps(followUps) {
    const container = document.getElementById('followUpsList');
    
    if (!followUps || followUps.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted" style="padding:40px 0;">
                <i class="fas fa-check-circle" style="font-size:48px;color:#48BB78;display:block;margin-bottom:12px;"></i>
                <p>No follow-ups due! Great job! 🎉</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    followUps.forEach(group => {
        html += `
            <div class="follow-up-item">
                <div class="follow-up-info">
                    <div class="follow-up-id">${group['Group ID']} - ${group['Hotel']}</div>
                    <div class="follow-up-details">
                        Agent: ${group['Agent']} | Status: ${group['Status']} | Follow-up: ${group['Follow-up Date']}
                        ${group['Remarks'] ? ' | ' + group['Remarks'] : ''}
                    </div>
                </div>
                <div class="follow-up-actions">
                    <button onclick="viewGroup('${group['Group ID']}')" class="btn-secondary btn-sm">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button onclick="editGroup('${group['Group ID']}')" class="btn-primary btn-sm">
                        <i class="fas fa-edit"></i> Update
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================================
// REPORTS
// ============================================================

function generateReport() {
    const reportType = document.getElementById('reportType').value;
    const month = document.getElementById('reportMonth').value;
    
    const container = document.getElementById('reportResults');
    
    if (!state.groups || state.groups.length === 0) {
        container.innerHTML = '<p class="text-muted">No data available for reports</p>';
        return;
    }
    
    let filteredGroups = state.groups;
    
    // Filter by month
    if (month) {
        filteredGroups = filteredGroups.filter(g => {
            const createdDate = g['Created Date'];
            return createdDate && createdDate.startsWith(month);
        });
    }
    
    let html = '';
    
    switch(reportType) {
        case 'monthly':
            html = generateMonthlyReport(filteredGroups);
            break;
        case 'agent':
            html = generateAgentReport(filteredGroups);
            break;
        case 'hotel':
            html = generateHotelReport(filteredGroups);
            break;
        case 'status':
            html = generateStatusReport(filteredGroups);
            break;
        default:
            html = '<p class="text-muted">Select a report type</p>';
    }
    
    container.innerHTML = html;
}

function generateMonthlyReport(groups) {
    const totalRevenue = groups.reduce((sum, g) => sum + (parseFloat(g['Net Revenue']) || 0), 0);
    const totalRooms = groups.reduce((sum, g) => sum + (parseInt(g['Total Rooms']) || 0), 0);
    const totalGroups = groups.length;
    const confirmed = groups.filter(g => g['Status'] === 'Confirmed').length;
    
    return `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-top:12px;">
            <div class="stat-card">
                <div class="stat-content">
                    <span class="stat-label">Total Groups</span>
                    <span class="stat-value">${totalGroups}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <span class="stat-label">Total Rooms</span>
                    <span class="stat-value">${totalRooms}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <span class="stat-label">Confirmed</span>
                    <span class="stat-value">${confirmed}</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-content">
                    <span class="stat-label">Total Revenue</span>
                    <span class="stat-value">AED ${formatCurrency(totalRevenue)}</span>
                </div>
            </div>
        </div>
    `;
}

function generateAgentReport(groups) {
    const agentData = {};
    groups.forEach(g => {
        const agent = g['Agent'] || 'Unknown';
        if (!agentData[agent]) {
            agentData[agent] = { groups: 0, revenue: 0, rooms: 0 };
        }
        agentData[agent].groups++;
        agentData[agent].revenue += parseFloat(g['Net Revenue']) || 0;
        agentData[agent].rooms += parseInt(g['Total Rooms']) || 0;
    });
    
    const sorted = Object.keys(agentData).sort((a, b) => agentData[b].revenue - agentData[a].revenue);
    
    let html = `
        <div style="margin-top:12px;overflow-x:auto;">
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>Agent</th>
                        <th>Groups</th>
                        <th>Rooms</th>
                        <th>Revenue</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    sorted.forEach((agent, index) => {
        const data = agentData[agent];
        html += `
            <tr>
                <td>${index + 1}</td>
                <td><strong>${agent}</strong></td>
                <td>${data.groups}</td>
                <td>${data.rooms}</td>
                <td>AED ${formatCurrency(data.revenue)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

function generateHotelReport(groups) {
    const hotelData = {};
    groups.forEach(g => {
        const hotel = g['Hotel'] || 'Unknown';
        if (!hotelData[hotel]) {
            hotelData[hotel] = { groups: 0, revenue: 0, rooms: 0 };
        }
        hotelData[hotel].groups++;
        hotelData[hotel].revenue += parseFloat(g['Net Revenue']) || 0;
        hotelData[hotel].rooms += parseInt(g['Total Rooms']) || 0;
    });
    
    const sorted = Object.keys(hotelData).sort((a, b) => hotelData[b].revenue - hotelData[a].revenue);
    
    let html = `
        <div style="margin-top:12px;overflow-x:auto;">
            <table>
                <thead>
                    <tr>
                        <th>Hotel</th>
                        <th>Groups</th>
                        <th>Rooms</th>
                        <th>Revenue</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    sorted.forEach(hotel => {
        const data = hotelData[hotel];
        html += `
            <tr>
                <td><strong>${hotel}</strong></td>
                <td>${data.groups}</td>
                <td>${data.rooms}</td>
                <td>AED ${formatCurrency(data.revenue)}</td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

function generateStatusReport(groups) {
    const statusData = {};
    groups.forEach(g => {
        const status = g['Status'] || 'Unknown';
        if (!statusData[status]) {
            statusData[status] = 0;
        }
        statusData[status]++;
    });
    
    const total = groups.length;
    
    let html = `
        <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px;">
    `;
    
    Object.keys(statusData).forEach(status => {
        const count = statusData[status];
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        const color = APP_CONFIG.STATUS_COLORS[status] || '#4A5568';
        
        html += `
            <div style="text-align:center;padding:16px;background:var(--background);border-radius:8px;border-top:4px solid ${color};">
                <div style="font-size:28px;font-weight:700;color:${color};">${count}</div>
                <div style="font-size:14px;color:var(--text-secondary);">${status}</div>
                <div style="font-size:12px;color:var(--text-secondary);">${percentage}%</div>
            </div>
        `;
    });
    
    html += '</div>';
    
    return html;
}

// ============================================================
// EXPORT
// ============================================================

async function exportData() {
    const status = document.getElementById('filterStatus').value || 'All';
    const hotel = document.getElementById('filterHotel').value || 'All';
    const agent = document.getElementById('searchGroups').value || '';
    
    try {
        const result = await callApi('exportToExcel', { 
            status: status, 
            hotel: hotel, 
            agent: agent 
        });
        
        if (result && result.success) {
            showNotification('Export created: ' + result.sheetName, 'success');
            
            // Open the Google Sheet
            const sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
            window.open(sheetUrl, '_blank');
        } else {
            showNotification(result?.message || 'Failed to export', 'error');
        }
    } catch (error) {
        console.error('Error exporting:', error);
        showNotification('Error exporting: ' + error.message, 'error');
    }
}

// ============================================================
// SETTINGS
// ============================================================

function loadSettings() {
    const saved = localStorage.getItem('lgt_settings');
    if (saved) {
        try {
            state.settings = JSON.parse(saved);
            document.getElementById('settingsWebAppUrl').value = state.settings.webAppUrl || '';
            document.getElementById('settingsGeminiKey').value = state.settings.geminiKey || '';
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }
}

function saveSettings() {
    const webAppUrl = document.getElementById('settingsWebAppUrl').value.trim();
    const geminiKey = document.getElementById('settingsGeminiKey').value.trim();
    
    state.settings.webAppUrl = webAppUrl;
    state.settings.geminiKey = geminiKey;
    
    localStorage.setItem('lgt_settings', JSON.stringify(state.settings));
    
    // Update API URL
    APP_CONFIG.API_URL = webAppUrl;
    APP_CONFIG.GEMINI_API_KEY = geminiKey;
    
    // Save to session
    sessionStorage.setItem('lgt_api_url', webAppUrl);
    sessionStorage.setItem('lgt_gemini_key', geminiKey);
    
    // Test connection
    testConnection();
    
    showNotification('Settings saved successfully!', 'success');
}

function testConnection() {
    const status = document.getElementById('backendStatus');
    const dbStatus = document.getElementById('dbStatus');
    const aiStatus = document.getElementById('aiStatus');
    
    status.textContent = 'Testing...';
    status.parentElement.querySelector('.fa-circle').style.color = '#F6AD55';
    
    // Test backend connection
    callApi('getGroups')
        .then(result => {
            if (result && result.success) {
                status.textContent = 'Connected ✅';
                status.parentElement.querySelector('.fa-circle').style.color = '#48BB78';
                dbStatus.textContent = 'Available ✅';
                dbStatus.parentElement.querySelector('.fa-circle').style.color = '#48BB78';
                
                // Test AI if key is set
                if (APP_CONFIG.GEMINI_API_KEY) {
                    aiStatus.textContent = 'Configured ✅';
                    aiStatus.parentElement.querySelector('.fa-circle').style.color = '#48BB78';
                } else {
                    aiStatus.textContent = 'No API Key';
                    aiStatus.parentElement.querySelector('.fa-circle').style.color = '#F6AD55';
                }
            } else {
                status.textContent = 'Failed ❌';
                status.parentElement.querySelector('.fa-circle').style.color = '#FC8181';
                dbStatus.textContent = 'Not Available ❌';
                dbStatus.parentElement.querySelector('.fa-circle').style.color = '#FC8181';
            }
        })
        .catch(() => {
            status.textContent = 'Error ❌';
            status.parentElement.querySelector('.fa-circle').style.color = '#FC8181';
            dbStatus.textContent = 'Error ❌';
            dbStatus.parentElement.querySelector('.fa-circle').style.color = '#FC8181';
        });
}

// ============================================================
// API CALLS
// ============================================================

async function callApi(action, params = {}) {
    const apiUrl = state.settings.webAppUrl || sessionStorage.getItem('lgt_api_url');
    
    if (!apiUrl) {
        throw new Error('API URL not configured. Please set it in Settings.');
    }
    
    const payload = {
        action: action,
        ...params
    };
    
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });
        
        // Since we're using no-cors, we need to handle the response differently
        // For now, we'll use a workaround with JSONP or assume success
        // This is a limitation of Apps Script web app with no-cors
        
        // Actually, let's try a different approach - use the proxy
        // For now, we'll use a simpler approach with the Apps Script URL directly
        
        const response2 = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'payload=' + encodeURIComponent(JSON.stringify(payload))
        });
        
        const text = await response2.text();
        
        try {
            return JSON.parse(text);
        } catch (e) {
            // If response is not JSON, it might be HTML error
            console.error('Response not JSON:', text);
            return { success: false, message: 'Invalid response from server' };
        }
        
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// ============================================================
// HELPERS
// ============================================================

function formatCurrency(amount) {
    if (!amount) return '0';
    return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function populateHotelDropdowns() {
    const hotels = [
        'Landmark Grand Hotel',
        'Landmark Summit Hotel',
        'Landmark Premier Hotel',
        'Landmark Hotel Riqqa',
        'Landmark Hotel Baniyas',
        'Landmark Plaza Hotel'
    ];
    
    const selects = document.querySelectorAll('#addHotel, #quickHotel, #filterHotel');
    selects.forEach(select => {
        // Keep the default option if it exists
        const defaultOption = select.querySelector('option[value=""]');
        select.innerHTML = '';
        if (defaultOption) {
            select.appendChild(defaultOption);
        } else {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Select Hotel';
            select.appendChild(opt);
        }
        
        hotels.forEach(hotel => {
            const option = document.createElement('option');
            option.value = hotel;
            option.textContent = hotel;
            select.appendChild(option);
        });
    });
}

async function loadAgents() {
    try {
        const result = await callApi('getAgents');
        if (result && result.success) {
            const agents = result.data || [];
            const datalist = document.getElementById('agentList');
            datalist.innerHTML = '';
            agents.forEach(agent => {
                const option = document.createElement('option');
                option.value = agent;
                datalist.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading agents:', error);
    }
}

// ============================================================
// MODAL
// ============================================================

function showModal(title, body) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// Close modal on click outside
document.getElementById('modal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// ============================================================
// NOTIFICATIONS
// ============================================================

function showNotification(message, type = 'info') {
    // Create notification element
    const existing = document.querySelector('.notification-toast');
    if (existing) {
        existing.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    
    const colors = {
        success: '#48BB78',
        error: '#FC8181',
        info: '#63B3ED',
        warning: '#F6AD55'
    };
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 24px;
        background: var(--surface);
        border-left: 4px solid ${colors[type] || colors.info};
        padding: 16px 20px;
        border-radius: var(--radius-sm);
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        z-index: 2000;
        max-width: 400px;
        display: flex;
        align-items: center;
        gap: 12px;
        animation: slideInRight 0.3s ease;
        font-size: 14px;
        border: 1px solid var(--border);
    `;
    
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}" style="color:${colors[type] || colors.info};font-size:20px;"></i>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-secondary);">
            ×
        </button>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// Add animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', function(e) {
    // Escape to close modal
    if (e.key === 'Escape') {
        closeModal();
    }
    
    // Ctrl+1-7 for navigation
    if (e.ctrlKey && e.key >= '1' && e.key <= '7') {
        const sections = ['dashboard', 'groups', 'addGroup', 'quickAdd', 'aiExtract', 'followUps', 'reports', 'settings'];
        const index = parseInt(e.key) - 1;
        if (index < sections.length) {
            e.preventDefault();
            navigateTo(sections[index]);
        }
    }
});

// ============================================================
// INITIAL LOAD
// ============================================================

console.log('✦ Landmark Groups Tracker loaded successfully!');
console.log('📊 Version 1.0');
console.log('🔐 Optimized for 75" HD TV display');

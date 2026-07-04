// ============================================================
// LANDMARK GROUPS TRACKER - COMPLETE FRONTEND
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================

const APP_CONFIG = {
    DEFAULT_USERNAME: 'admin',
    DEFAULT_PASSWORD: 'admin123'
};

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
    loadSettings();
    populateMonthFilter();
    
    // Check if already logged in
    var savedSession = sessionStorage.getItem('lgt_session');
    if (savedSession === 'true') {
        showMainApp();
        loadDashboard();
        loadGroups();
        checkFollowUps();
    }
    
    // Setup login
    document.getElementById('loginPassword').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });
    
    // Setup forms
    document.getElementById('addGroupForm').addEventListener('submit', function(e) {
        e.preventDefault();
        handleAddGroup();
    });
    
    document.getElementById('quickAddForm').addEventListener('submit', function(e) {
        e.preventDefault();
        handleQuickAdd();
    });
    
    document.getElementById('settingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        saveSettings();
    });
    
    // Setup navigation
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.addEventListener('click', function() {
            var section = this.dataset.section;
            navigateTo(section);
        });
    });
    
    // Set today's date
    var today = new Date().toISOString().split('T')[0];
    document.getElementById('addCheckIn').value = today;
    document.getElementById('addCheckOut').value = today;
    document.getElementById('quickCheckIn').value = today;
    document.getElementById('quickCheckOut').value = today;
    document.getElementById('reportMonth').value = today.substring(0, 7);
    
    // Populate hotels
    populateHotelDropdowns();
    loadAgents();
    
    console.log('✦ Landmark Groups Tracker loaded successfully!');
});

// ============================================================
// LOGIN / LOGOUT
// ============================================================

function handleLogin() {
    var username = document.getElementById('loginUsername').value;
    var password = document.getElementById('loginPassword').value;
    
    if (username === APP_CONFIG.DEFAULT_USERNAME && password === APP_CONFIG.DEFAULT_PASSWORD) {
        state.isLoggedIn = true;
        state.currentUser = username;
        sessionStorage.setItem('lgt_session', 'true');
        sessionStorage.setItem('lgt_user', username);
        
        showMainApp();
        loadDashboard();
        loadGroups();
        checkFollowUps();
        
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
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.classList.remove('active');
    });
    var activeItem = document.querySelector('.nav-item[data-section="' + section + '"]');
    if (activeItem) {
        activeItem.classList.add('active');
    }
    
    document.querySelectorAll('.section').forEach(function(s) {
        s.classList.remove('active');
    });
    var targetSection = document.getElementById('section-' + section);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
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
// API CALLS - CLEAN VERSION
// ============================================================

function callApi(action, params, method) {
    method = method || 'GET';
    params = params || {};
    
    return new Promise(function(resolve, reject) {
        var apiUrl = state.settings.webAppUrl || sessionStorage.getItem('lgt_api_url');
        
        if (!apiUrl) {
            reject(new Error('API URL not configured. Please set it in Settings.'));
            return;
        }
        
        // ============================================================
        // 1. DEFINE CALLBACK NAME FIRST
        // ============================================================
        var callbackName = 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        
        // ============================================================
        // 2. CLEAN THE URL
        // ============================================================
        var cleanUrl = apiUrl.replace(/\/$/, '');
        
        // ============================================================
        // 3. POST REQUESTS (Add, Update, Delete)
        // ============================================================
        if (method === 'POST') {
            var payload = {
                action: action,
                groupId: params.groupId || null,
                data: params.data || params
            };
            
            console.log('📤 Sending POST to:', cleanUrl);
            console.log('📤 Payload:', JSON.stringify(payload));
            
            fetch(cleanUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            .then(function(response) {
                console.log('📥 Response status:', response.status);
                return response.text();
            })
            .then(function(text) {
                console.log('📥 Response text:', text);
                try {
                    var data = JSON.parse(text);
                    if (data.success) {
                        showNotification('Success!', 'success');
                        resolve(data);
                    } else {
                        showNotification('Error: ' + data.message, 'error');
                        resolve(data);
                    }
                } catch (e) {
                    console.error('❌ Parse error:', e);
                    showNotification('Invalid response from server', 'error');
                    resolve({ success: false, message: 'Invalid response: ' + text });
                }
            })
            .catch(function(error) {
                console.error('❌ Fetch error:', error);
                try {
                    var form = document.createElement('form');
                    form.method = 'POST';
                    form.action = cleanUrl;
                    form.target = '_blank';
                    form.style.display = 'none';
                    
                    var formPayload = {
                        action: action,
                        groupId: params.groupId || null,
                        data: params.data || params
                    };
                    
                    var input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = 'payload';
                    input.value = JSON.stringify(formPayload);
                    form.appendChild(input);
                    
                    document.body.appendChild(form);
                    form.submit();
                    document.body.removeChild(form);
                    
                    showNotification('Operation submitted! Check the new tab.', 'success');
                    resolve({ success: true, message: 'Operation submitted' });
                } catch (error2) {
                    showNotification('Failed: ' + error2.message, 'error');
                    reject(new Error('Failed to send request: ' + error2.message));
                }
            });
            return;
        }
        
        // ============================================================
        // 4. GET REQUESTS - Build URL with callback
        // ============================================================
        var url = cleanUrl + '?action=' + encodeURIComponent(action) + '&callback=' + encodeURIComponent(callbackName);
        
        // Add additional parameters
        Object.keys(params).forEach(function(key) {
            if (key !== 'action' && key !== 'callback') {
                if (typeof params[key] === 'object') {
                    url += '&' + key + '=' + encodeURIComponent(JSON.stringify(params[key]));
                } else {
                    url += '&' + key + '=' + encodeURIComponent(params[key]);
                }
            }
        });
        
        var script = document.createElement('script');
        script.src = url;
        
        var timeout = setTimeout(function() {
            cleanup();
            reject(new Error('Request timed out'));
        }, 60000);
        
        function cleanup() {
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            delete window[callbackName];
            clearTimeout(timeout);
        }
        
        window[callbackName] = function(response) {
            try {
                cleanup();
                resolve(response);
            } catch (error) {
                reject(error);
            }
        };
        
        script.onerror = function() {
            cleanup();
            reject(new Error('Failed to load script. Check your internet connection.'));
        };
        
        document.head.appendChild(script);
    });
}
// ============================================================
// DASHBOARD
// ============================================================

function loadDashboard() {
    callApi('getDashboard')
        .then(function(data) {
            if (data && data.success && data.data) {
                var d = data.data;
                
                document.getElementById('activeGroups').textContent = d.activeGroups || 0;
                document.getElementById('roomsToday').textContent = d.roomsToday || 0;
                document.getElementById('revenueYTD').textContent = 'AED ' + formatCurrency(d.revenueYTD || 0);
                document.getElementById('comingWeek').textContent = d.comingWeek || 0;
                document.getElementById('followUpsDue').textContent = d.followUpsDue || 0;
                document.getElementById('notificationCount').textContent = d.followUpsDue || 0;
                
                renderStatusChart(d.statusCounts || {});
                renderTopAgents(d.topAgents || []);
                renderMonthlyChart(d.monthlyData || {});
                
                state.dashboardData = d;
                
                // Update system status
                document.getElementById('backendStatus').textContent = 'Connected ✅';
                var statusCircle = document.getElementById('backendStatus').parentElement.querySelector('.fa-circle');
                if (statusCircle) statusCircle.style.color = '#48BB78';
                document.getElementById('dbStatus').textContent = 'Available ✅';
                var dbCircle = document.getElementById('dbStatus').parentElement.querySelector('.fa-circle');
                if (dbCircle) dbCircle.style.color = '#48BB78';
            } else {
                showNotification('Failed to load dashboard data', 'error');
            }
        })
        ['catch'](function(error) {
            console.error('Error loading dashboard:', error);
            document.getElementById('backendStatus').textContent = 'Error ❌';
            var statusCircle = document.getElementById('backendStatus').parentElement.querySelector('.fa-circle');
            if (statusCircle) statusCircle.style.color = '#FC8181';
            document.getElementById('dbStatus').textContent = 'Error ❌';
            var dbCircle = document.getElementById('dbStatus').parentElement.querySelector('.fa-circle');
            if (dbCircle) dbCircle.style.color = '#FC8181';
        });
}

function renderStatusChart(statusCounts) {
    var container = document.getElementById('statusChart');
    var statuses = Object.keys(statusCounts);
    
    if (statuses.length === 0) {
        container.innerHTML = '<p class="text-muted">No data available</p>';
        return;
    }
    
    var colors = ['#48BB78', '#F6AD55', '#FC8181', '#9F7AEA', '#63B3ED', '#4A5568'];
    var html = '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">';
    
    for (var i = 0; i < statuses.length; i++) {
        var status = statuses[i];
        var color = colors[i % colors.length];
        var count = statusCounts[status] || 0;
        html += '<div style="display:flex;flex-direction:column;align-items:center;padding:12px 20px;background:var(--background);border-radius:8px;min-width:80px;">';
        html += '<div style="font-size:24px;font-weight:700;color:' + color + ';">' + count + '</div>';
        html += '<div style="font-size:12px;color:var(--text-secondary);">' + status + '</div>';
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

function renderTopAgents(agents) {
    var container = document.getElementById('topAgentsList');
    if (!agents || agents.length === 0) {
        container.innerHTML = '<p class="text-muted">No agent data available</p>';
        return;
    }
    
    var html = '<div class="agent-list">';
    for (var i = 0; i < Math.min(agents.length, 5); i++) {
        var agent = agents[i];
        var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1) + '.';
        html += '<div class="agent-item">';
        html += '<span class="agent-name">' + medal + ' ' + agent.name + '</span>';
        html += '<span class="agent-revenue">AED ' + formatCurrency(agent.revenue) + '</span>';
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

function renderMonthlyChart(monthlyData) {
    var container = document.getElementById('monthlyChart');
    var months = Object.keys(monthlyData);
    var revenues = Object.values(monthlyData);
    
    if (months.length === 0 || revenues.every(function(r) { return r === 0; })) {
        container.innerHTML = '<p class="text-muted">No monthly data available</p>';
        return;
    }
    
    var maxRevenue = Math.max.apply(null, revenues);
    if (maxRevenue === 0) maxRevenue = 1;
    
    var html = '<div style="display:flex;align-items:flex-end;gap:8px;height:150px;padding:8px 0;">';
    for (var i = 0; i < months.length; i++) {
        var height = (revenues[i] / maxRevenue) * 130;
        html += '<div style="display:flex;flex-direction:column;align-items:center;flex:1;">';
        html += '<div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">' + formatCurrency(revenues[i]) + '</div>';
        html += '<div style="width:100%;max-width:40px;height:' + height + 'px;background:#4A90D9;border-radius:4px 4px 0 0;transition:height 0.3s;"></div>';
        html += '<div style="font-size:11px;color:var(--text-secondary);margin-top:4px;font-weight:600;">' + months[i] + '</div>';
        html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
}

// ============================================================
// GROUPS
// ============================================================

function loadGroups() {
    callApi('getGroups')
        .then(function(data) {
            if (data && data.success) {
                state.groups = data.data || [];
                renderGroupsTable(state.groups);
                populateFilterDropdowns();
            } else {
                showNotification('Failed to load groups', 'error');
            }
        })
        ['catch'](function(error) {
            console.error('Error loading groups:', error);
            showNotification('Error loading groups: ' + error.message, 'error');
        });
}

function renderGroupsTable(groups) {
    var tbody = document.getElementById('groupsTableBody');
    
    if (!groups || groups.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No groups found</td></tr>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        var statusClass = group['Status'] || 'Inquiry';
        var groupId = group['Group ID'] || 'N/A';
        var hotel = group['Hotel'] || 'N/A';
        var agent = group['Agent'] || 'N/A';
        var status = statusClass;
        var checkIn = formatDate(group['Check-In']);   // <-- FORMAT DATE
        var checkOut = formatDate(group['Check-Out']); // <-- FORMAT DATE
        var rooms = group['Total Rooms'] || 0;
        var revenue = group['Net Revenue'] || 0;
        
        html += '<tr>';
        html += '<td><strong>' + groupId + '</strong></td>';
        html += '<td>' + hotel + '</td>';
        html += '<td>' + agent + '</td>';
        html += '<td><span class="status-badge ' + status + '">' + status + '</span></td>';
        html += '<td>' + checkIn + '</td>';
        html += '<td>' + checkOut + '</td>';
        html += '<td>' + rooms + '</td>';
        html += '<td>AED ' + formatCurrency(revenue) + '</td>';
        html += '<td>';
        html += '<button onclick="viewGroup(\'' + groupId + '\')" class="btn-secondary btn-sm" title="View"><i class="fas fa-eye"></i></button>';
        html += '<button onclick="editGroup(\'' + groupId + '\')" class="btn-secondary btn-sm" title="Edit"><i class="fas fa-edit"></i></button>';
        html += '<button onclick="deleteGroup(\'' + groupId + '\')" class="btn-danger btn-sm" title="Delete"><i class="fas fa-trash"></i></button>';
        html += '</td>';
        html += '</tr>';
    }
    tbody.innerHTML = html;
}

function filterGroups() {
    var searchTerm = document.getElementById('searchGroups').value.toLowerCase();
    var statusFilter = document.getElementById('filterStatus').value;
    var hotelFilter = document.getElementById('filterHotel').value;
    var monthFilter = document.getElementById('filterMonth').value;
    
    var filtered = state.groups.slice();
    
    if (searchTerm) {
        filtered = filtered.filter(function(g) {
            var id = g['Group ID'] || '';
            var agent = g['Agent'] || '';
            var hotel = g['Hotel'] || '';
            return id.toLowerCase().includes(searchTerm) || 
                   agent.toLowerCase().includes(searchTerm) || 
                   hotel.toLowerCase().includes(searchTerm);
        });
    }
    
    if (statusFilter !== 'All') {
        filtered = filtered.filter(function(g) { return g['Status'] === statusFilter; });
    }
    
    if (hotelFilter !== 'All') {
        filtered = filtered.filter(function(g) { return g['Hotel'] === hotelFilter; });
    }
    
    // ✅ ADD MONTH FILTER
    if (monthFilter !== 'All') {
        filtered = filtered.filter(function(g) {
            var checkIn = g['Check-In'] || '';
            return checkIn.startsWith(monthFilter);
        });
    }
    
    renderGroupsTable(filtered);
}

// ============================================================
// POPULATE MONTH FILTER - DYNAMIC (Next 12 Months)
// ============================================================

function populateMonthFilter() {
    var select = document.getElementById('filterMonth');
    if (!select) return;
    
    // Keep the "All Months" option
    var allOption = document.createElement('option');
    allOption.value = 'All';
    allOption.textContent = 'All Months';
    select.innerHTML = '';
    select.appendChild(allOption);
    
    var now = new Date();
    var currentMonth = now.getMonth();
    var currentYear = now.getFullYear();
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Show last 6 months and next 12 months (18 months total)
    var startMonth = currentMonth - 6;
    var startYear = currentYear;
    
    if (startMonth < 0) {
        startMonth += 12;
        startYear -= 1;
    }
    
    var endMonth = currentMonth + 12;
    var endYear = currentYear;
    
    if (endMonth >= 12) {
        endMonth -= 12;
        endYear += 1;
    }
    
    var month = startMonth;
    var year = startYear;
    
    while (true) {
        var monthKey = year + '-' + String(month + 1).padStart(2, '0');
        var monthLabel = monthNames[month] + ' ' + year;
        
        var option = document.createElement('option');
        option.value = monthKey;
        option.textContent = monthLabel;
        
        // Auto-select current month
        if (month === currentMonth && year === currentYear) {
            option.textContent = monthLabel + ' (Current)';
            option.selected = true;
        }
        
        select.appendChild(option);
        
        month++;
        if (month >= 12) {
            month = 0;
            year++;
        }
        
        if (year > endYear || (year === endYear && month > endMonth)) {
            break;
        }
    }
    
    console.log('📅 Month filter populated with ' + (select.options.length - 1) + ' months');
}
function refreshGroups() {
    loadGroups();
    showNotification('Groups refreshed', 'success');
}

function viewGroup(groupId) {
    var group = null;
    for (var i = 0; i < state.groups.length; i++) {
        if (state.groups[i]['Group ID'] === groupId) {
            group = state.groups[i];
            break;
        }
    }
    
    if (!group) {
        showNotification('Group not found', 'error');
        return;
    }
    
    var details = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
    Object.keys(group).forEach(function(key) {
        if (key && group[key] && group[key] !== '') {
            var value = group[key];
            // Format dates if they look like ISO dates
            if (key === 'Check-In' || key === 'Check-Out' || 
                key === 'Created Date' || key === 'Last Modified' ||
                key === 'Cutoff Date' || key === 'Inquiry Date' ||
                key === 'Offered Date' || key === 'Tentative Date' ||
                key === 'Confirmed Date' || key === 'Archive Date') {
                value = formatDate(value);
            }
            details += '<div><strong style="font-size:12px;color:var(--text-secondary);">' + key + ':</strong>';
            details += '<div style="font-size:14px;">' + value + '</div></div>';
        }
    });
    details += '</div>';
    showModal('Group Details: ' + groupId, details);
}

function editGroup(groupId) {
    var group = null;
    for (var i = 0; i < state.groups.length; i++) {
        if (state.groups[i]['Group ID'] === groupId) {
            group = state.groups[i];
            break;
        }
    }
    if (!group) return;
    
    document.getElementById('addHotel').value = group['Hotel'] || '';
    document.getElementById('addAgent').value = group['Agent'] || '';
    document.getElementById('addStatus').value = group['Status'] || 'Inquiry';
    document.getElementById('addCheckIn').value = formatDate(group['Check-In']) || '';
    document.getElementById('addCheckOut').value = formatDate(group['Check-Out']) || '';
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
    document.getElementById('addCutoffDate').value = formatDate(group['Cutoff Date']) || '';
    document.getElementById('addRemarks').value = group['Remarks'] || '';
    
    // ✅ CRITICAL: Store the group ID and make sure status will be updated
    document.getElementById('addGroupForm').dataset.editId = groupId;
    document.querySelector('#addGroupForm button[type="submit"]').textContent = 'Update Group';
    
    // ✅ CRITICAL: Force status to be included in the update
    var statusField = document.getElementById('addStatus');
    if (statusField) {
        statusField.dataset.originalValue = group['Status'] || 'Inquiry';
    }
    
    navigateTo('addGroup');
    showNotification('Edit mode: Update the group details', 'info');
}

function deleteGroup(groupId) {
    if (!confirm('Are you sure you want to delete group ' + groupId + '?')) return;
    
    callApi('deleteGroup', { groupId: groupId }, 'POST')
        .then(function(result) {
            if (result && result.success) {
                showNotification(result.message, 'success');
                loadGroups();
                loadDashboard();
            } else {
                showNotification(result?.message || 'Failed to delete group', 'error');
            }
        })
        ['catch'](function(error) {
            console.error('Error deleting group:', error);
            showNotification('Error deleting group: ' + error.message, 'error');
        });
}

// ============================================================
// ADD GROUP
// ============================================================

function handleAddGroup() {
    var form = document.getElementById('addGroupForm');
    var editId = form.dataset.editId;
    
    var checkIn = document.getElementById('addCheckIn').value;
    var checkOut = document.getElementById('addCheckOut').value;
    var nights = 0;
    if (checkIn && checkOut) {
        var start = new Date(checkIn);
        var end = new Date(checkOut);
        nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }
    
    var paidRooms = parseInt(document.getElementById('addPaidRooms').value) || 0;
    var focRooms = parseInt(document.getElementById('addFOCRooms').value) || 0;
    var totalRooms = paidRooms + focRooms;
    
    // ✅ CRITICAL: Explicitly get the status value
    var statusValue = document.getElementById('addStatus').value;
    
    var data = {
        hotel: document.getElementById('addHotel').value,
        agent: document.getElementById('addAgent').value,
        status: statusValue,  // <-- This must be included!
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
    
    // ✅ Log the data being sent
    console.log('📤 Saving group data:', data);
        
    var apiCall;
    if (editId) {
        apiCall = callApi('updateGroup', { groupId: editId, data: data }, 'POST');
    } else {
        apiCall = callApi('addGroup', { data: data }, 'POST');
    }
    
    apiCall
        .then(function(result) {
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
        })
        ['catch'](function(error) {
            console.error('Error saving group:', error);
            showNotification('Error saving group: ' + error.message, 'error');
        });
}

// ============================================================
// QUICK ADD
// ============================================================

function handleQuickAdd() {
    var checkIn = document.getElementById('quickCheckIn').value;
    var checkOut = document.getElementById('quickCheckOut').value;
    var nights = 0;
    if (checkIn && checkOut) {
        var start = new Date(checkIn);
        var end = new Date(checkOut);
        nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }
    
    var totalRooms = parseInt(document.getElementById('quickRooms').value) || 0;
    
    var data = {
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
    
    callApi('addGroup', { data: data }, 'POST')
        .then(function(result) {
            if (result && result.success) {
                showNotification(result.message, 'success');
                document.getElementById('quickAddForm').reset();
                loadGroups();
                loadDashboard();
                loadAgents();
            } else {
                showNotification(result?.message || 'Failed to add group', 'error');
            }
        })
        ['catch'](function(error) {
            console.error('Error adding group:', error);
            showNotification('Error adding group: ' + error.message, 'error');
        });
}

// ============================================================
// AI EXTRACTION
// ============================================================

function extractWithAI() {
    var text = document.getElementById('aiText').value;
    var source = document.getElementById('aiSource').value;
    
    if (!text || text.trim() === '') {
        showNotification('Please paste some text to extract', 'error');
        return;
    }
    
    // Check if API key is configured
    var geminiKey = state.settings.geminiKey || sessionStorage.getItem('lgt_gemini_key');
    if (!geminiKey) {
        showNotification('Gemini API key not configured. Please add it in Settings.', 'error');
        return;
    }
    
    var resultDiv = document.getElementById('aiResult');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="text-center text-muted">⏳ Processing with AI... (may take 10-20 seconds)</div>';
    
    callApi('extractWithAI', { text: text, source: source }, 'GET')
        .then(function(result) {
            console.log('AI Result:', result);
            
            if (result && result.success && result.data) {
                var data = result.data;
                var html = '<div style="background:#E8F0FE;padding:16px;border-radius:8px;margin-top:12px;">';
                html += '<h4 style="color:var(--primary);margin-bottom:12px;">✅ Extracted Data</h4>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
                
                var displayFields = ['hotel', 'agent', 'checkIn', 'checkOut', 'nights', 'roomType', 'paidRooms', 'focPolicy', 'focRooms', 'rate', 'tdInclusive', 'mealPlan', 'currency', 'remarks'];
                
                for (var i = 0; i < displayFields.length; i++) {
                    var key = displayFields[i];
                    if (data[key] && data[key] !== '') {
                        html += '<div><strong style="font-size:12px;color:var(--text-secondary);">' + key + ':</strong>';
                        html += '<div style="font-size:14px;">' + data[key] + '</div></div>';
                    }
                }
                
                html += '</div>';
                html += '<div style="margin-top:16px;display:flex;gap:8px;">';
                html += '<button onclick="addExtractedGroup()" class="btn-primary btn-sm"><i class="fas fa-save"></i> Add Group</button>';
                html += '<button onclick="document.getElementById(\'aiResult\').style.display=\'none\'" class="btn-secondary btn-sm"><i class="fas fa-times"></i> Close</button>';
                html += '</div></div>';
                
                resultDiv.innerHTML = html;
                resultDiv.dataset.extractedData = JSON.stringify(data);
                showNotification('Data extracted successfully!', 'success');
            } else {
                resultDiv.innerHTML = '<div style="background:#FC818120;padding:16px;border-radius:8px;margin-top:12px;color:#FC8181;">';
                resultDiv.innerHTML += '<strong>❌ ' + (result?.message || 'Failed to extract data') + '</strong>';
                resultDiv.innerHTML += '<div style="font-size:12px;margin-top:8px;color:var(--text-secondary);">';
                resultDiv.innerHTML += 'Make sure your Gemini API key is correct and the text contains booking information.';
                resultDiv.innerHTML += '</div></div>';
            }
        })
        ['catch'](function(error) {
            console.error('Error extracting with AI:', error);
            var resultDiv = document.getElementById('aiResult');
            resultDiv.innerHTML = '<div style="background:#FC818120;padding:16px;border-radius:8px;margin-top:12px;color:#FC8181;">';
            resultDiv.innerHTML += '<strong>❌ Error: ' + error.message + '</strong>';
            resultDiv.innerHTML += '<div style="font-size:12px;margin-top:8px;color:var(--text-secondary);">';
            resultDiv.innerHTML += 'Check your internet connection and make sure the Apps Script URL is correct.';
            resultDiv.innerHTML += '</div></div>';
        });
}

function addExtractedGroup() {
    var resultDiv = document.getElementById('aiResult');
    var dataStr = resultDiv.dataset.extractedData;
    
    if (!dataStr) {
        showNotification('No extracted data found', 'error');
        return;
    }
    
    try {
        var data = JSON.parse(dataStr);
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

function checkFollowUps() {
    callApi('getFollowUps')
        .then(function(result) {
            if (result && result.success) {
                state.followUps = result.groups || [];
                renderFollowUps(state.followUps);
                document.getElementById('notificationCount').textContent = result.count || 0;
            }
        })
        ['catch'](function(error) {
            console.error('Error checking follow-ups:', error);
        });
}

function renderFollowUps(followUps) {
    var container = document.getElementById('followUpsList');
    
    if (!followUps || followUps.length === 0) {
        container.innerHTML = '<div class="text-center text-muted" style="padding:40px 0;">';
        container.innerHTML += '<i class="fas fa-check-circle" style="font-size:48px;color:#48BB78;display:block;margin-bottom:12px;"></i>';
        container.innerHTML += '<p>No follow-ups due! Great job! 🎉</p></div>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < followUps.length; i++) {
        var group = followUps[i];
        html += '<div class="follow-up-item">';
        html += '<div class="follow-up-info">';
        html += '<div class="follow-up-id">' + group['Group ID'] + ' - ' + group['Hotel'] + '</div>';
        html += '<div class="follow-up-details">';
        html += 'Agent: ' + group['Agent'] + ' | Status: ' + group['Status'];
        html += ' | Follow-up: ' + formatDate(group['Follow-up Date']); // <-- FORMAT DATE
        if (group['Remarks']) {
            html += ' | ' + group['Remarks'];
        }
        html += '</div></div>';
        html += '<div class="follow-up-actions">';
        html += '<button onclick="viewGroup(\'' + group['Group ID'] + '\')" class="btn-secondary btn-sm"><i class="fas fa-eye"></i></button>';
        html += '<button onclick="editGroup(\'' + group['Group ID'] + '\')" class="btn-primary btn-sm"><i class="fas fa-edit"></i> Update</button>';
        html += '</div></div>';
    }
    container.innerHTML = html;
}

// ============================================================
// SETTINGS
// ============================================================

function loadSettings() {
    var saved = localStorage.getItem('lgt_settings');
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
    var webAppUrl = document.getElementById('settingsWebAppUrl').value.trim();
    var geminiKey = document.getElementById('settingsGeminiKey').value.trim();
    
    state.settings.webAppUrl = webAppUrl;
    state.settings.geminiKey = geminiKey;
    
    localStorage.setItem('lgt_settings', JSON.stringify(state.settings));
    sessionStorage.setItem('lgt_api_url', webAppUrl);
    sessionStorage.setItem('lgt_gemini_key', geminiKey);
    
    showNotification('Settings saved successfully!', 'success');
    testConnection();
}

function testConnection() {
    var status = document.getElementById('backendStatus');
    status.textContent = 'Testing...';
    var statusCircle = status.parentElement.querySelector('.fa-circle');
    if (statusCircle) statusCircle.style.color = '#F6AD55';
    
    callApi('getGroups')
        .then(function(result) {
            if (result && result.success) {
                status.textContent = 'Connected ✅';
                var circle = status.parentElement.querySelector('.fa-circle');
                if (circle) circle.style.color = '#48BB78';
                document.getElementById('dbStatus').textContent = 'Available ✅';
                var dbCircle = document.getElementById('dbStatus').parentElement.querySelector('.fa-circle');
                if (dbCircle) dbCircle.style.color = '#48BB78';
                
                if (state.settings.geminiKey || sessionStorage.getItem('lgt_gemini_key')) {
                    document.getElementById('aiStatus').textContent = 'Configured ✅';
                    var aiCircle = document.getElementById('aiStatus').parentElement.querySelector('.fa-circle');
                    if (aiCircle) aiCircle.style.color = '#48BB78';
                }
                loadDashboard();
                loadGroups();
            } else {
                status.textContent = 'Failed ❌';
                var circle = status.parentElement.querySelector('.fa-circle');
                if (circle) circle.style.color = '#FC8181';
            }
        })
        ['catch'](function() {
            status.textContent = 'Error ❌';
            var circle = status.parentElement.querySelector('.fa-circle');
            if (circle) circle.style.color = '#FC8181';
        });
}

// ============================================================
// REPORTS
// ============================================================

function generateReport() {
    var reportType = document.getElementById('reportType').value;
    var month = document.getElementById('reportMonth').value;
    var container = document.getElementById('reportResults');
    
    if (!state.groups || state.groups.length === 0) {
        container.innerHTML = '<p class="text-muted">No data available for reports</p>';
        return;
    }
    
    var filteredGroups = state.groups.slice();
    if (month) {
        filteredGroups = filteredGroups.filter(function(g) {
            var createdDate = g['Created Date'];
            return createdDate && createdDate.startsWith(month);
        });
    }
    
    var html = '';
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
    var totalRevenue = 0;
    var totalRooms = 0;
    var totalGroups = groups.length;
    var confirmed = 0;
    
    for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        totalRevenue += parseFloat(g['Net Revenue']) || 0;
        totalRooms += parseInt(g['Total Rooms']) || 0;
        if (g['Status'] === 'Confirmed') confirmed++;
    }
    
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-top:12px;">' +
           '<div class="stat-card"><div class="stat-content"><span class="stat-label">Total Groups</span><span class="stat-value">' + totalGroups + '</span></div></div>' +
           '<div class="stat-card"><div class="stat-content"><span class="stat-label">Total Rooms</span><span class="stat-value">' + totalRooms + '</span></div></div>' +
           '<div class="stat-card"><div class="stat-content"><span class="stat-label">Confirmed</span><span class="stat-value">' + confirmed + '</span></div></div>' +
           '<div class="stat-card"><div class="stat-content"><span class="stat-label">Total Revenue</span><span class="stat-value">AED ' + formatCurrency(totalRevenue) + '</span></div></div>' +
           '</div>';
}

function generateAgentReport(groups) {
    var agentData = {};
    for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var agent = g['Agent'] || 'Unknown';
        if (!agentData[agent]) {
            agentData[agent] = { groups: 0, revenue: 0, rooms: 0 };
        }
        agentData[agent].groups++;
        agentData[agent].revenue += parseFloat(g['Net Revenue']) || 0;
        agentData[agent].rooms += parseInt(g['Total Rooms']) || 0;
    }
    
    var sorted = Object.keys(agentData).sort(function(a, b) {
        return agentData[b].revenue - agentData[a].revenue;
    });
    
    var html = '<div style="margin-top:12px;overflow-x:auto;"><table><thead><tr><th>Rank</th><th>Agent</th><th>Groups</th><th>Rooms</th><th>Revenue</th></tr></thead><tbody>';
    for (var i = 0; i < sorted.length; i++) {
        var agent = sorted[i];
        var data = agentData[agent];
        html += '<tr><td>' + (i + 1) + '</td><td><strong>' + agent + '</strong></td><td>' + data.groups + '</td><td>' + data.rooms + '</td><td>AED ' + formatCurrency(data.revenue) + '</td></tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

function generateHotelReport(groups) {
    var hotelData = {};
    for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var hotel = g['Hotel'] || 'Unknown';
        if (!hotelData[hotel]) {
            hotelData[hotel] = { groups: 0, revenue: 0, rooms: 0 };
        }
        hotelData[hotel].groups++;
        hotelData[hotel].revenue += parseFloat(g['Net Revenue']) || 0;
        hotelData[hotel].rooms += parseInt(g['Total Rooms']) || 0;
    }
    
    var sorted = Object.keys(hotelData).sort(function(a, b) {
        return hotelData[b].revenue - hotelData[a].revenue;
    });
    
    var html = '<div style="margin-top:12px;overflow-x:auto;"><table><thead><tr><th>Hotel</th><th>Groups</th><th>Rooms</th><th>Revenue</th></tr></thead><tbody>';
    for (var i = 0; i < sorted.length; i++) {
        var hotel = sorted[i];
        var data = hotelData[hotel];
        html += '<tr><td><strong>' + hotel + '</strong></td><td>' + data.groups + '</td><td>' + data.rooms + '</td><td>AED ' + formatCurrency(data.revenue) + '</td></tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

function generateStatusReport(groups) {
    var statusData = {};
    for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        var status = g['Status'] || 'Unknown';
        if (!statusData[status]) statusData[status] = 0;
        statusData[status]++;
    }
    
    var total = groups.length;
    var html = '<div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:16px;">';
    
    Object.keys(statusData).forEach(function(status) {
        var count = statusData[status];
        var percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        var color = '#4A5568';
        if (status === 'Confirmed') color = '#48BB78';
        else if (status === 'Tentative') color = '#F6AD55';
        else if (status === 'Cancelled' || status === 'Lost') color = '#FC8181';
        else if (status === 'Inquiry') color = '#9F7AEA';
        else if (status === 'Offered') color = '#63B3ED';
        
        html += '<div style="text-align:center;padding:16px;background:var(--background);border-radius:8px;border-top:4px solid ' + color + ';">';
        html += '<div style="font-size:28px;font-weight:700;color:' + color + ';">' + count + '</div>';
        html += '<div style="font-size:14px;color:var(--text-secondary);">' + status + '</div>';
        html += '<div style="font-size:12px;color:var(--text-secondary);">' + percentage + '%</div>';
        html += '</div>';
    });
    html += '</div>';
    return html;
}

// ============================================================
// EXPORT
// ============================================================

function exportData() {
    var status = document.getElementById('filterStatus').value || 'All';
    var hotel = document.getElementById('filterHotel').value || 'All';
    var agent = document.getElementById('searchGroups').value || '';
    var month = document.getElementById('filterMonth').value || 'All';
    
    showNotification('Exporting data...', 'info');
    
    var apiUrl = state.settings.webAppUrl || sessionStorage.getItem('lgt_api_url');
    if (!apiUrl) {
        showNotification('API URL not configured', 'error');
        return;
    }
    
    var cleanUrl = apiUrl.replace(/\/$/, '');
    
    // Use GET for export (simpler, works with JSONP)
    var url = cleanUrl + '?action=exportToExcel' + 
              '&status=' + encodeURIComponent(status) + 
              '&hotel=' + encodeURIComponent(hotel) + 
              '&agent=' + encodeURIComponent(agent) +
              '&month=' + encodeURIComponent(month);
    
    window.open(url, '_blank');
    showNotification('✅ Export started!', 'success');
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
    var hotels = [
        'Landmark Grand Hotel',
        'Landmark Summit Hotel',
        'Landmark Premier Hotel',
        'Landmark Hotel Riqqa',
        'Landmark Hotel Baniyas',
        'Landmark Plaza Hotel'
    ];
    
    var selects = document.querySelectorAll('#addHotel, #quickHotel, #filterHotel');
    selects.forEach(function(select) {
        var defaultOption = select.querySelector('option[value=""]');
        select.innerHTML = '';
        if (defaultOption) {
            select.appendChild(defaultOption);
        } else {
            var opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Select Hotel';
            select.appendChild(opt);
        }
        
        hotels.forEach(function(hotel) {
            var option = document.createElement('option');
            option.value = hotel;
            option.textContent = hotel;
            select.appendChild(option);
        });
    });
}

function populateFilterDropdowns() {
    var hotels = [];
    for (var i = 0; i < state.groups.length; i++) {
        var hotel = state.groups[i]['Hotel'];
        if (hotel && hotels.indexOf(hotel) === -1) {
            hotels.push(hotel);
        }
    }
    
    var filterHotel = document.getElementById('filterHotel');
    var currentValue = filterHotel.value;
    
    if (hotels.length > 0) {
        filterHotel.innerHTML = '<option value="All">All Hotels</option>';
        for (var i = 0; i < hotels.length; i++) {
            var option = document.createElement('option');
            option.value = hotels[i];
            option.textContent = hotels[i];
            filterHotel.appendChild(option);
        }
        filterHotel.value = currentValue || 'All';
    }
}

function loadAgents() {
    callApi('getAgents')
        .then(function(result) {
            if (result && result.success) {
                var agents = result.data || [];
                var datalist = document.getElementById('agentList');
                datalist.innerHTML = '';
                for (var i = 0; i < agents.length; i++) {
                    var option = document.createElement('option');
                    option.value = agents[i];
                    datalist.appendChild(option);
                }
            }
        })
        ['catch'](function(error) {
            console.error('Error loading agents:', error);
        });
}
// ============================================================
// FORMAT DATE - Convert ISO date to YYYY-MM-DD for display
// ============================================================

function formatDate(dateString) {
    if (!dateString) return '';
    try {
        // If it's already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            return dateString;
        }
        
        var date = new Date(dateString);
        // Check if date is valid
        if (isNaN(date.getTime())) return dateString;
        
        var year = date.getFullYear();
        var month = String(date.getMonth() + 1).padStart(2, '0');
        var day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    } catch (e) {
        return dateString;
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

document.getElementById('modal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// ============================================================
// NOTIFICATIONS
// ============================================================

function showNotification(message, type) {
    type = type || 'info';
    var existing = document.querySelector('.notification-toast');
    if (existing) existing.remove();
    
    var toast = document.createElement('div');
    toast.className = 'notification-toast';
    
    var colors = {
        success: '#48BB78',
        error: '#FC8181',
        info: '#63B3ED',
        warning: '#F6AD55'
    };
    
    var icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    
    toast.style.cssText = 'position: fixed; top: 80px; right: 24px; background: var(--surface); border-left: 4px solid ' + (colors[type] || colors.info) + '; padding: 16px 20px; border-radius: var(--radius-sm); box-shadow: 0 8px 30px rgba(0,0,0,0.15); z-index: 2000; max-width: 400px; display: flex; align-items: center; gap: 12px; animation: slideInRight 0.3s ease; font-size: 14px; border: 1px solid var(--border);';
    
    toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '" style="color:' + (colors[type] || colors.info) + ';font-size:20px;"></i>';
    toast.innerHTML += '<span>' + message + '</span>';
    toast.innerHTML += '<button onclick="this.parentElement.remove()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-secondary);">×</button>';
    
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 5000);
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
    if (e.ctrlKey && e.key >= '1' && e.key <= '7') {
        var sections = ['dashboard', 'groups', 'addGroup', 'quickAdd', 'aiExtract', 'followUps', 'reports', 'settings'];
        var index = parseInt(e.key) - 1;
        if (index < sections.length) {
            e.preventDefault();
            navigateTo(sections[index]);
        }
    }
});

// Add animation styles
var style = document.createElement('style');
style.textContent = '@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
document.head.appendChild(style);

console.log('✦ Landmark Groups Tracker loaded successfully!');
console.log('📊 Version 1.0');
console.log('🔐 Optimized for 75" HD TV display');

// License Portal JavaScript

// Global variables
let notificationCheckInterval;

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeTooltips();
    initializePopovers();
    initializeFileUploads();
    initializeFormValidation();
    setupAjaxDefaults();
});

// Initialize Bootstrap tooltips
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Initialize Bootstrap popovers
function initializePopovers() {
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function(popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
}

// Initialize file upload handling
function initializeFileUploads() {
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        input.addEventListener('change', function(e) {
            const files = e.target.files;
            if (files.length > 0) {
                validateFiles(files);
            }
        });
    });
}

// Validate uploaded files
function validateFiles(files) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    
    for (let file of files) {
        if (file.size > maxSize) {
            showAlert('error', 'File too large. Maximum size is 10MB.');
            return false;
        }
        
        if (!allowedTypes.includes(file.type)) {
            showAlert('error', 'Invalid file type. Only PDF, JPG, and PNG files are allowed.');
            return false;
        }
    }
    
    return true;
}

// Initialize form validation
function initializeFormValidation() {
    const forms = document.querySelectorAll('.needs-validation');
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        });
    });
}

// Setup AJAX defaults
function setupAjaxDefaults() {
    // Add CSRF token to all AJAX requests if available
    const csrfToken = document.querySelector('meta[name="csrf-token"]');
    if (csrfToken) {
        fetch.defaults = {
            headers: {
                'X-CSRF-TOKEN': csrfToken.getAttribute('content')
            }
        };
    }
}

// Notification functions
async function loadNotifications() {
    try {
        const response = await fetch('/api/notifications?unread_only=false&limit=5');
        if (!response.ok) throw new Error('Failed to load notifications');
        
        const data = await response.json();
        updateNotificationUI(data.notifications, data.unreadCount);
    } catch (error) {
        console.error('Error loading notifications:', error);
    }
}

function updateNotificationUI(notifications, unreadCount) {
    const notificationList = document.getElementById('notification-list');
    const notificationCount = document.getElementById('notification-count');
    
    // Update count badge
    if (unreadCount > 0) {
        notificationCount.textContent = unreadCount > 99 ? '99+' : unreadCount;
        notificationCount.style.display = 'block';
    } else {
        notificationCount.style.display = 'none';
    }
    
    // Update notification list
    if (notifications.length === 0) {
        notificationList.innerHTML = `
            <div class="text-center py-3 text-muted">
                <i class="bi bi-bell-slash"></i>
                <div>No notifications</div>
            </div>
        `;
        return;
    }
    
    notificationList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${!notification.is_read ? 'unread' : ''}" 
             onclick="markNotificationRead(${notification.id}, '${notification.action_url || '#'}')">
            <div class="notification-title">${escapeHtml(notification.title)}</div>
            <div class="notification-message">${escapeHtml(notification.message)}</div>
            <div class="notification-time">${formatRelativeTime(new Date(notification.created_at))}</div>
        </div>
    `).join('');
}

async function markNotificationRead(id, actionUrl) {
    try {
        await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
        
        if (actionUrl && actionUrl !== '#') {
            window.location.href = actionUrl;
        } else {
            loadNotifications(); // Refresh notifications
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
    }
}

async function markAllNotificationsRead() {
    try {
        await fetch('/api/notifications/read-all', { method: 'PATCH' });
        loadNotifications(); // Refresh notifications
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

// Utility functions
function showAlert(type, message) {
    const alertContainer = document.createElement('div');
    alertContainer.className = `alert alert-${type} alert-dismissible fade show`;
    alertContainer.innerHTML = `
        <i class="bi bi-${type === 'error' ? 'exclamation-triangle' : 'check-circle'} me-2"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const main = document.querySelector('main');
    main.insertBefore(alertContainer, main.firstChild);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (alertContainer.parentNode) {
            alertContainer.remove();
        }
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function formatCurrency(amount, currency = 'EUR') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

// Search functionality
let searchTimeout;
function setupSearch(inputId, resultsId, searchUrl, onSelect) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    
    if (!input || !results) return;
    
    input.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length < 2) {
            results.innerHTML = '';
            results.style.display = 'none';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`${searchUrl}?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                
                if (data.success) {
                    displaySearchResults(results, data, onSelect);
                }
            } catch (error) {
                console.error('Search error:', error);
            }
        }, 300);
    });
    
    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !results.contains(e.target)) {
            results.style.display = 'none';
        }
    });
}

function displaySearchResults(resultsContainer, data, onSelect) {
    const items = data.tickets || data.users || data.items || [];
    
    if (items.length === 0) {
        resultsContainer.innerHTML = '<div class="p-2 text-muted">No results found</div>';
    } else {
        resultsContainer.innerHTML = items.map(item => 
            `<div class="search-result-item p-2 border-bottom" data-id="${item.id}">
                ${getSearchResultDisplay(item)}
            </div>`
        ).join('');
        
        // Add click handlers
        resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                const selectedItem = items.find(i => i.id == id);
                onSelect(selectedItem);
                resultsContainer.style.display = 'none';
            });
        });
    }
    
    resultsContainer.style.display = 'block';
}

function getSearchResultDisplay(item) {
    if (item.ticket_number) {
        // Ticket result
        return `<strong>${item.ticket_number}</strong> - ${item.title}`;
    } else if (item.email) {
        // User result
        return `<strong>${item.name}</strong> - ${item.email}`;
    } else if (item.name) {
        // Catalog item result
        return `<strong>${item.name}</strong> - ${item.type}`;
    }
    return item.toString();
}

// Confirm dialogs
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

// Loading states
function setLoadingState(element, loading = true) {
    if (loading) {
        element.disabled = true;
        element.classList.add('loading');
        element.setAttribute('data-original-text', element.textContent);
        element.textContent = 'Loading...';
    } else {
        element.disabled = false;
        element.classList.remove('loading');
        element.textContent = element.getAttribute('data-original-text') || element.textContent;
    }
}

// Form submission with loading state
function submitFormWithLoading(formId, callback) {
    const form = document.getElementById(formId);
    const submitBtn = form.querySelector('button[type="submit"]');
    
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        setLoadingState(submitBtn, true);
        
        if (callback) {
            callback(form).finally(() => {
                setLoadingState(submitBtn, false);
            });
        }
    });
}

// Auto-refresh functionality
function startAutoRefresh(callback, interval = 30000) {
    return setInterval(callback, interval);
}

function stopAutoRefresh(intervalId) {
    if (intervalId) {
        clearInterval(intervalId);
    }
}
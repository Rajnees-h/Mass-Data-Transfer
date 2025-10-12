// Server URL is now managed in config.js (public/JsHelper/config.js)
const SERVER_URL = CONFIG.serverUrl;

// State management
let connectedOrgs = {
  source: false,
  target: false
};

// Console logging utility
function logToConsole(message, type = 'info') {
  const console = document.getElementById('activityConsole');
  const logEntry = document.createElement('div');
  logEntry.className = `console-log ${type}`;
  
  const timestamp = new Date().toLocaleTimeString();
  logEntry.innerHTML = `
    <span class="log-time">[${timestamp}]</span>
    <span class="log-message">${message}</span>
  `;
  
  console.appendChild(logEntry);
  console.scrollTop = console.scrollHeight;
}

// Update connection status badge
function updateConnectionBadge() {
  const badge = document.getElementById('connectionStatus');
  const dot = badge.querySelector('.status-dot');
  const text = badge.querySelector('.status-text');
  
  if (connectedOrgs.source && connectedOrgs.target) {
    dot.className = 'status-dot';
    dot.style.background = 'var(--success-color)';
    text.textContent = 'Orgs: Both Connected';
    enableFetchFieldsButton();
  } else if (connectedOrgs.source || connectedOrgs.target) {
    dot.className = 'status-dot';
    dot.style.background = 'var(--warning-color)';
    text.textContent = 'Orgs: Partially Connected';
  } else {
    dot.className = 'status-dot gray';
    text.textContent = 'Orgs: Not Connected';
  }
}

// Enable/disable fetch fields button and load objects
async function enableFetchFieldsButton() {
  const fetchBtn = document.getElementById('fetchFieldsBtn');
  const refreshBtn = document.getElementById('refreshObjectsBtn');
  
  if (connectedOrgs.source && connectedOrgs.target) {
    fetchBtn.disabled = false;
    refreshBtn.disabled = false;
    logToConsole('Both orgs connected. Loading available objects...', 'info');
    
    // Fetch objects from source org
    await fetchObjects();
  }
}

// Fetch Salesforce objects and populate dropdown
async function fetchObjects() {
  const objectSelect = document.getElementById('objectSelect');
  const originalHTML = objectSelect.innerHTML;
  
  try {
    // Show loading state
    objectSelect.innerHTML = '<option value="">Loading objects...</option>';
    objectSelect.disabled = true;
    
    logToConsole('Fetching Salesforce objects from source org...', 'info');
    
    // Fetch objects from source org
    const response = await fetch(`${SERVER_URL}/api/objects?type=source`);
    const data = await response.json();
    
    if (response.ok && data.objects) {
      // Clear dropdown
      objectSelect.innerHTML = '<option value="">-- Select Object --</option>';
      
      // Group objects into Standard and Custom
      const standardObjects = data.objects.filter(obj => !obj.custom);
      const customObjects = data.objects.filter(obj => obj.custom);
      
      // Add standard objects
      if (standardObjects.length > 0) {
        const standardGroup = document.createElement('optgroup');
        standardGroup.label = '📦 Standard Objects';
        standardObjects.forEach(obj => {
          const option = document.createElement('option');
          option.value = obj.name;
          option.textContent = `${obj.label} (${obj.name})`;
          standardGroup.appendChild(option);
        });
        objectSelect.appendChild(standardGroup);
      }
      
      // Add custom objects
      if (customObjects.length > 0) {
        const customGroup = document.createElement('optgroup');
        customGroup.label = '⚙️ Custom Objects';
        customObjects.forEach(obj => {
          const option = document.createElement('option');
          option.value = obj.name;
          option.textContent = `${obj.label} (${obj.name})`;
          customGroup.appendChild(option);
        });
        objectSelect.appendChild(customGroup);
      }
      
      objectSelect.disabled = false;
      logToConsole(`✅ Loaded ${data.count} objects (${standardObjects.length} standard, ${customObjects.length} custom)`, 'success');
    } else {
      throw new Error(data.error || 'Failed to fetch objects');
    }
  } catch (error) {
    console.error('Error fetching objects:', error);
    logToConsole(`❌ Error loading objects: ${error.message}`, 'error');
    
    // Restore original options on error
    objectSelect.innerHTML = originalHTML;
    objectSelect.disabled = false;
    alert('Failed to load objects. Please try reconnecting the orgs.');
  }
}





async function connectOrg(type) {
  const statusLabel = document.getElementById(type === "source" ? "sourceStatus" : "targetStatus");
  const domainInput = document.getElementById(type === 'source' ? 'sourceDomain' : 'targetDomain');
  const domain = domainInput.value.trim();

  if (!domain) {
    alert("Please enter a domain URL");
    logToConsole(`Failed to connect ${type} org: No domain provided`, 'error');
    return;
  }

  logToConsole(`Initiating OAuth for ${type} org: ${domain}`, 'info');

  try {
    const response = await fetch(`${SERVER_URL}/auth/start?domain=${encodeURIComponent(domain)}&type=${type}`);
    const data = await response.json();

    if (data.authUrl) {
      // Open a popup for OAuth
      const popup = window.open(data.authUrl, "_blank", "width=500,height=600");
      logToConsole(`OAuth popup opened for ${type} org`, 'info');

      window.addEventListener("message", async (event) => {
        if (event.data.status === "connected" && event.data.org === type) {
          // Update status UI
          statusLabel.className = "connection-status connected";
          statusLabel.innerHTML = '<span class="status-icon">●</span> Connected';
          popup.close();
          
          // Update state
          connectedOrgs[type] = true;
          updateConnectionBadge();
          
          logToConsole(`${type.toUpperCase()} org connected successfully!`, 'success');
          
          // Fetch and display org details
          await fetchOrgDetails(type);
        }
      });

    } else {
      alert("Failed to start authentication");
      logToConsole(`Authentication failed for ${type} org`, 'error');
    }
  } catch (error) {
    alert("Error: " + error.message);
    logToConsole(`Error connecting to ${type} org: ${error.message}`, 'error');
  }
}

async function fetchOrgDetails(type) {
  try {
    logToConsole(`Fetching org details for ${type} org...`, 'info');
    const response = await fetch(`${SERVER_URL}/api/org-info?type=${type}`);
    const data = await response.json();
    
    if (response.ok) {
      // Update org details in the UI
      const orgNameElement = document.getElementById(`${type}OrgName`);
      const orgIdElement = document.getElementById(`${type}OrgId`);
      const orgDetailsSection = document.getElementById(`${type}OrgDetails`);
      
      orgNameElement.textContent = data.orgName;
      orgIdElement.textContent = data.orgId;
      orgDetailsSection.style.display = "block";
      
      logToConsole(`${type.toUpperCase()} Org: ${data.orgName} (${data.orgId})`, 'success');
    } else {
      console.error("Error fetching org details:", data.error);
      logToConsole(`Failed to fetch ${type} org details: ${data.error}`, 'error');
    }
  } catch (error) {
    console.error("Error fetching org details:", error);
    logToConsole(`Error fetching ${type} org details: ${error.message}`, 'error');
  }
}

async function fetchServerMessage() {
  try {
    const response = await fetch(`${SERVER_URL}/`);
    const text = await response.text();
    const badge = document.getElementById("backendServerStatus");
    const dot = badge.querySelector('.status-dot');
    const statusText = badge.querySelector('.status-text');
    
    dot.style.background = 'var(--success-color)';
    statusText.textContent = text;
    logToConsole('Backend server connected successfully', 'success');
  } catch (error) {
    console.error("Error fetching server message:", error);
    const badge = document.getElementById("backendServerStatus");
    const dot = badge.querySelector('.status-dot');
    const statusText = badge.querySelector('.status-text');
    
    dot.style.background = 'var(--danger-color)';
    statusText.textContent = "Backend Offline";
    logToConsole('Failed to connect to backend server', 'error');
  }
}

// Fetch Fields Handler - Real implementation
async function handleFetchFields() {
  const objectSelect = document.getElementById('objectSelect');
  const selectedObject = objectSelect.value;
  const selectedObjectText = objectSelect.options[objectSelect.selectedIndex].text;
  const fetchBtn = document.getElementById('fetchFieldsBtn');
  const statusSpan = document.getElementById('fieldFetchStatus');
  
  if (!selectedObject) {
    alert('Please select an object first');
    return;
  }
  
  // Disable button and show loading
  fetchBtn.disabled = true;
  fetchBtn.innerHTML = '<span class="btn-icon">⏳</span> Fetching...';
  statusSpan.textContent = 'Loading fields...';
  statusSpan.style.color = 'var(--info-color)';
  
  logToConsole(`Fetching fields for ${selectedObject} object...`, 'info');
  
  try {
    // Fetch fields from both source and target orgs
    const [sourceResponse, targetResponse] = await Promise.all([
      fetch(`${SERVER_URL}/api/fields?type=source&objectName=${encodeURIComponent(selectedObject)}`),
      fetch(`${SERVER_URL}/api/fields?type=target&objectName=${encodeURIComponent(selectedObject)}`)
    ]);
    
    const sourceData = await sourceResponse.json();
    const targetData = await targetResponse.json();
    
    if (sourceResponse.ok && targetResponse.ok) {
      logToConsole(`✅ Source org: ${sourceData.totalFields} fields fetched`, 'success');
      logToConsole(`✅ Target org: ${targetData.totalFields} fields fetched`, 'success');
      
      // Display field mappings
      displayFieldMapping(sourceData.fields, targetData.fields, selectedObjectText);
      
      // Update status
      statusSpan.textContent = `✅ ${sourceData.totalFields} fields loaded`;
      statusSpan.style.color = 'var(--success-color)';
      
      // Show mapping section and enable buttons
      document.getElementById('fieldMappingSection').style.display = 'block';
      enableTransferButtons();
      
      logToConsole(`Field mapping ready for ${selectedObject}`, 'success');
    } else {
      throw new Error(sourceData.error || targetData.error || 'Failed to fetch fields');
    }
  } catch (error) {
    console.error('Error fetching fields:', error);
    logToConsole(`❌ Error fetching fields: ${error.message}`, 'error');
    statusSpan.textContent = '❌ Failed to load fields';
    statusSpan.style.color = 'var(--danger-color)';
    alert(`Failed to fetch fields: ${error.message}`);
  } finally {
    // Re-enable button
    fetchBtn.disabled = false;
    fetchBtn.innerHTML = '<span class="btn-icon">⟳</span> Fetch Fields';
  }
}

// Display field mapping with real Salesforce fields
function displayFieldMapping(sourceFields, targetFields, objectName) {
  const mappingList = document.getElementById('fieldMappingList');
  mappingList.innerHTML = '';
  
  // Create a map of target fields by name for easy lookup
  const targetFieldMap = new Map();
  targetFields.forEach(field => {
    targetFieldMap.set(field.name, field);
  });
  
  // Display each source field with its mapping
  sourceFields.forEach(sourceField => {
    const row = document.createElement('div');
    row.className = 'mapping-row';
    
    // Check if field exists in target
    const targetField = targetFieldMap.get(sourceField.name);
    const isMapped = targetField !== undefined;
    
    // Build field info display
    const sourceFieldDisplay = `
      <div class="field-item ${sourceField.required ? 'field-required' : ''}">
        <div class="field-name">${sourceField.label}</div>
        <div class="field-metadata">
          ${sourceField.name} • ${sourceField.type}
          ${sourceField.required ? ' • <span class="required-badge">Required</span>' : ''}
        </div>
      </div>
    `;
    
    const targetFieldDisplay = isMapped ? `
      <div class="field-item ${targetField.required ? 'field-required' : ''}">
        <div class="field-name">${targetField.label}</div>
        <div class="field-metadata">
          ${targetField.name} • ${targetField.type}
          ${targetField.required ? ' • <span class="required-badge">Required</span>' : ''}
        </div>
      </div>
    ` : `
      <div class="field-item field-unmapped">
        <div class="field-name">⚠️ Not Found</div>
        <div class="field-metadata">Field doesn't exist in target org</div>
      </div>
    `;
    
    const connector = isMapped 
      ? '<div class="field-connector mapped">→</div>'
      : '<div class="field-connector unmapped">✕</div>';
    
    row.innerHTML = sourceFieldDisplay + connector + targetFieldDisplay;
    mappingList.appendChild(row);
  });
  
  // Update field count and stats
  const mappedCount = sourceFields.filter(sf => targetFieldMap.has(sf.name)).length;
  document.getElementById('fieldCount').textContent = mappedCount;
  document.getElementById('recordCount').textContent = '0'; // Will be updated in preview
  
  logToConsole(`Mapped ${mappedCount} of ${sourceFields.length} fields`, 
    mappedCount === sourceFields.length ? 'success' : 'warning');
  
  // Show warning if some fields are unmapped
  if (mappedCount < sourceFields.length) {
    const unmappedCount = sourceFields.length - mappedCount;
    logToConsole(`⚠️ Warning: ${unmappedCount} field(s) not found in target org`, 'warning');
  }
}

// Enable transfer buttons
function enableTransferButtons() {
  document.getElementById('previewTransferBtn').disabled = false;
  document.getElementById('startTransferBtn').disabled = false;
  document.getElementById('transferStats').style.display = 'grid';
  logToConsole('Transfer buttons enabled. Ready to migrate data.', 'success');
}

// Preview Transfer Handler
function handlePreviewTransfer() {
  logToConsole('Previewing transfer...', 'info');
  // Mock preview - in real implementation, query source org
  setTimeout(() => {
    document.getElementById('recordCount').textContent = '15';
    logToConsole('Preview complete: 15 records ready for transfer', 'success');
  }, 1000);
}

// Start Transfer Handler
function handleStartTransfer() {
  const confirmed = confirm('Are you sure you want to start the data transfer?');
  if (!confirmed) {
    logToConsole('Transfer cancelled by user', 'warning');
    return;
  }
  
  logToConsole('Starting data transfer...', 'info');
  document.getElementById('transferStatus').textContent = 'In Progress';
  
  // Mock transfer - in real implementation, perform actual data transfer
  setTimeout(() => {
    document.getElementById('transferStatus').textContent = 'Completed';
    logToConsole('Data transfer completed successfully!', 'success');
    logToConsole('15 records transferred', 'success');
  }, 3000);
}

// Clear Console Handler
function clearConsole() {
  const console = document.getElementById('activityConsole');
  console.innerHTML = `
    <div class="console-log info">
      <span class="log-time">[System]</span>
      <span class="log-message">Console cleared.</span>
    </div>
  `;
}

// Event Listeners
document.getElementById("connectSource").addEventListener("click", () => connectOrg("source"));
document.getElementById("connectTarget").addEventListener("click", () => connectOrg("target"));
document.getElementById("refreshObjectsBtn").addEventListener("click", () => {
  logToConsole('Refreshing object list...', 'info');
  fetchObjects();
});
document.getElementById("fetchFieldsBtn").addEventListener("click", handleFetchFields);
document.getElementById("previewTransferBtn").addEventListener("click", handlePreviewTransfer);
document.getElementById("startTransferBtn").addEventListener("click", handleStartTransfer);
document.getElementById("clearConsoleBtn").addEventListener("click", clearConsole);

// Initialize
fetchServerMessage();
logToConsole('Mass Data Transfer application initialized', 'info');

// Mass Data Transfer - New UI Script
// Server URL from config
const SERVER_URL = CONFIG.serverUrl;

// Application State
const appState = {
  currentStep: 1,
  connectedOrgs: {
    source: false,
    target: false
  },
  orgDetails: {
    source: null,
    target: null
  },
  allObjects: [], // All objects from source org
  targetObjects: [], // All objects from target org
  selectedObjects: [], // Selected source objects
  objectMappings: new Map(), // source -> target mapping
  fieldMappings: new Map(), // objectName -> {source: [], target: [], mappings: []}
  totalFieldsMapped: 0
};

// ==================== UTILITY FUNCTIONS ====================

function updateStepper(step) {
  appState.currentStep = step;
  
  // Update stepper UI
  for (let i = 1; i <= 5; i++) {
    const stepIndicator = document.querySelector(`[data-step="${i}"] .step-indicator`);
    const stepText = document.querySelector(`[data-step="${i}"] span`);
    
    if (i < step) {
      // Completed steps
      stepIndicator.classList.remove('border-gray-300', 'bg-white', 'text-gray-400');
      stepIndicator.classList.add('border-green-500', 'bg-green-500', 'text-white');
      stepIndicator.innerHTML = '<i data-lucide="check" class="w-6 h-6"></i>';
      stepText.classList.remove('text-gray-400');
      stepText.classList.add('text-green-600');
    } else if (i === step) {
      // Current step
      stepIndicator.classList.remove('border-gray-300', 'bg-white', 'text-gray-400', 'border-green-500', 'bg-green-500');
      stepIndicator.classList.add('border-sf-blue', 'bg-sf-blue', 'text-white', 'active');
      stepIndicator.textContent = i;
      stepText.classList.remove('text-gray-400', 'text-green-600');
      stepText.classList.add('text-sf-blue');
    } else {
      // Future steps
      stepIndicator.classList.remove('border-sf-blue', 'bg-sf-blue', 'text-white', 'active', 'border-green-500', 'bg-green-500');
      stepIndicator.classList.add('border-gray-300', 'bg-white', 'text-gray-400');
      stepIndicator.textContent = i;
      stepText.classList.remove('text-sf-blue', 'text-green-600');
      stepText.classList.add('text-gray-400');
    }
  }
  
  // Reinitialize icons
  lucide.createIcons();
  
  // Show/hide step content
  for (let i = 1; i <= 5; i++) {
    const stepContent = document.getElementById(`step${i}`);
    if (i === step) {
      stepContent.classList.remove('hidden');
    } else {
      stepContent.classList.add('hidden');
    }
  }
}

function updateSidebar() {
  // Calculate total mapped fields
  let totalMappedFields = 0;
  appState.fieldMappings.forEach((fieldMapping) => {
    totalMappedFields += fieldMapping.mappings.size;
  });
  
  document.getElementById('sidebarSourceOrg').textContent = 
    appState.orgDetails.source ? appState.orgDetails.source.orgName : 'Not connected';
  document.getElementById('sidebarTargetOrg').textContent = 
    appState.orgDetails.target ? appState.orgDetails.target.orgName : 'Not connected';
  document.getElementById('sidebarObjects').textContent = 
    `${appState.selectedObjects.length} selected`;
  document.getElementById('sidebarFields').textContent = 
    `${totalMappedFields} mapped`;
}

function logTransfer(message, type = 'info') {
  const logsContainer = document.getElementById('transferLogs');
  if (!logsContainer) return;
  
  const timestamp = new Date().toLocaleTimeString();
  const logEntry = document.createElement('div');
  logEntry.textContent = `[${timestamp}] ${message}`;
  
  if (type === 'success') logEntry.classList.add('text-green-400');
  else if (type === 'error') logEntry.classList.add('text-red-400');
  else if (type === 'warning') logEntry.classList.add('text-yellow-400');
  
  logsContainer.appendChild(logEntry);
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

// ==================== STEP 1: CONNECT ORGS ====================

async function connectOrg(type) {

  const domainInput = document.getElementById(`${type}Domain`);
  const domain = domainInput.value.trim();
  const statusDiv = document.getElementById(`${type}Status`);

  if (!domain) {
    alert(`Please enter a ${type} org domain`);
    return;
  }

  try {
    const response = await fetch(`${SERVER_URL}/auth/start?domain=${encodeURIComponent(domain)}&type=${type}`);
    const data = await response.json();

    if (data.authUrl) {
      const popup = window.open(data.authUrl, "_blank", "width=500,height=600");

      window.addEventListener("message", async (event) => {
        if (event.data.status === "connected" && event.data.org === type) {
          // Update status
          statusDiv.innerHTML = `
            <span class="w-3 h-3 bg-green-500 rounded-full"></span>
            <span class="text-sm font-medium text-green-700">✓ Connected</span>
          `;
          statusDiv.classList.remove('bg-red-50', 'border-red-200');
          statusDiv.classList.add('bg-green-50', 'border-green-200');
          
          popup.close();
          
          // Update state
          appState.connectedOrgs[type] = true;
          
          // Fetch and display org details
          await fetchOrgDetails(type);
          
          // Enable next button if both orgs connected
          if (appState.connectedOrgs.source && appState.connectedOrgs.target) {
            document.getElementById('step1Next').disabled = false;
          }
          
          updateSidebar();
        }
      });
    }
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

async function fetchOrgDetails(type) {
  try {
    const response = await fetch(`${SERVER_URL}/api/org-info?type=${type}`);
    const data = await response.json();
    
    if (response.ok) {
      appState.orgDetails[type] = data;
      
      document.getElementById(`${type}OrgName`).textContent = data.orgName;
      document.getElementById(`${type}OrgId`).textContent = data.orgId;
      document.getElementById(`${type}OrgDetails`).classList.remove('hidden');
    }
  } catch (error) {
    console.error(`Error fetching ${type} org details:`, error);
  }
}

// ==================== STEP 2: SELECT OBJECTS ====================

async function loadObjects() {
  try {
    const response = await fetch(`${SERVER_URL}/api/objects?type=source`);
    const data = await response.json();
    
    if (response.ok) {
      appState.allObjects = data.objects;
      displayObjects(appState.allObjects);
      
      document.getElementById('totalObjects').textContent = data.count;
    }
  } catch (error) {
    console.error('Error loading objects:', error);
    document.getElementById('objectList').innerHTML = `
      <div class="p-8 text-center text-red-600">
        <p>Error loading objects. Please try again.</p>
      </div>
    `;
  }
}

function displayObjects(objects) {
  const objectList = document.getElementById('objectList');
  objectList.innerHTML = '';
  
  if (objects.length === 0) {
    objectList.innerHTML = '<div class="p-8 text-center text-gray-500">No objects found</div>';
    return;
  }
  
  // Get currently selected object names for preservation
  const selectedObjectNames = appState.selectedObjects.map(obj => obj.name);
  
  objects.forEach(obj => {
    // Check if this object is already selected
    const isSelected = selectedObjectNames.includes(obj.name);
    
    const row = document.createElement('div');
    row.className = 'p-4 hover:bg-gray-50 transition-colors';
    row.innerHTML = `
      <label class="flex items-center space-x-3 cursor-pointer">
        <input type="checkbox" value="${obj.name}" class="object-checkbox w-5 h-5 text-sf-blue rounded focus:ring-2 focus:ring-sf-blue" ${isSelected ? 'checked' : ''}>
        <div class="flex-1">
          <div class="font-semibold text-gray-900">${obj.label}</div>
          <div class="text-sm text-gray-500">${obj.name} ${obj.custom ? '• Custom' : '• Standard'}</div>
        </div>
        <div class="text-xs px-2 py-1 rounded-full ${obj.custom ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
          ${obj.custom ? 'Custom' : 'Standard'}
        </div>
      </label>
    `;
    objectList.appendChild(row);
  });
  
  // Add event listeners - pass event to handler
  const checkboxes = document.querySelectorAll('.object-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => handleObjectSelection(e));
  });
}

function handleObjectSelection(event) {
  // Get the checkbox that triggered this event
  if (event && event.target) {
    const checkbox = event.target;
    const objName = checkbox.value;
    const obj = appState.allObjects.find(o => o.name === objName);
    
    if (checkbox.checked) {
      // Add to selected if not already there
      if (!appState.selectedObjects.find(o => o.name === objName)) {
        appState.selectedObjects.push(obj);
      }
    } else {
      // Remove from selected
      appState.selectedObjects = appState.selectedObjects.filter(o => o.name !== objName);
    }
  } else {
    // Called without event (e.g., from Select All) - sync with DOM
    const checkboxes = document.querySelectorAll('.object-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.object-checkbox:checked');
    const checkedNames = Array.from(checkedCheckboxes).map(cb => cb.value);
    const displayedNames = Array.from(checkboxes).map(cb => cb.value);
    
    // Add newly checked items
    checkedNames.forEach(name => {
      if (!appState.selectedObjects.find(o => o.name === name)) {
        const obj = appState.allObjects.find(o => o.name === name);
        if (obj) appState.selectedObjects.push(obj);
      }
    });
    
    // Remove unchecked items (only from currently displayed objects)
    appState.selectedObjects = appState.selectedObjects.filter(selectedObj => {
      // Keep if not currently displayed OR is checked
      return !displayedNames.includes(selectedObj.name) || checkedNames.includes(selectedObj.name);
    });
  }
  
  // Update UI counters
  document.getElementById('selectedObjects').textContent = appState.selectedObjects.length;
  document.getElementById('readyToMap').textContent = appState.selectedObjects.length;
  document.getElementById('step2Next').disabled = appState.selectedObjects.length === 0;
  
  updateSidebar();
}

// Select All functionality
document.getElementById('selectAllObjects').addEventListener('change', function(e) {
  const checkboxes = document.querySelectorAll('.object-checkbox');
  checkboxes.forEach(cb => cb.checked = e.target.checked);
  handleObjectSelection();
});

// Search functionality
document.getElementById('objectSearch').addEventListener('input', function(e) {
  const searchTerm = e.target.value.toLowerCase();
  const filtered = appState.allObjects.filter(obj => 
    obj.name.toLowerCase().includes(searchTerm) || 
    obj.label.toLowerCase().includes(searchTerm)
  );
  displayObjects(filtered);
});

// ==================== STEP 3: MATCH TARGET OBJECTS ====================

async function initializeObjectMatching() {
  try {
    // Fetch target org objects
    const response = await fetch(`${SERVER_URL}/api/objects?type=target`);
    const data = await response.json();
    
    if (response.ok) {
      const targetObjects = data.objects;
      displayObjectMappings(targetObjects);
    }
  } catch (error) {
    console.error('Error loading target objects:', error);
  }
}

function displayObjectMappings(targetObjects) {
  const container = document.getElementById('objectMappingList');
  container.innerHTML = '';
  
  // Store target objects in state for auto-match function
  appState.targetObjects = targetObjects;
  
  appState.selectedObjects.forEach(sourceObj => {
    // DO NOT auto-map - let user select manually or use auto-match button
    // Don't set any mapping initially
    
    const card = document.createElement('div');
    card.className = 'border-2 border-gray-200 rounded-lg p-6 bg-white hover:shadow-lg transition-shadow';
    card.dataset.sourceObject = sourceObj.name;
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-4 flex-1">
          <!-- Source Object -->
          <div class="flex-1 bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div class="text-xs text-purple-600 font-medium mb-1">SOURCE</div>
            <div class="font-bold text-gray-900">${sourceObj.label}</div>
            <div class="text-sm text-gray-500">${sourceObj.name}</div>
          </div>
          
          <!-- Arrow -->
          <div class="text-gray-400">
            <i data-lucide="arrow-right" class="w-6 h-6"></i>
          </div>
          
          <!-- Target Object Dropdown (All objects, no pre-selection) -->
          <div class="flex-1 bg-pink-50 border border-pink-200 rounded-lg p-4">
            <div class="text-xs text-pink-600 font-medium mb-1">TARGET</div>
            <select 
              class="target-object-select w-full mt-2 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500" 
              data-source="${sourceObj.name}"
            >
              <option value="">-- Select Target Object --</option>
              ${targetObjects.map(t => `
                <option value="${t.name}">
                  ${t.label} (${t.name})
                </option>
              `).join('')}
            </select>
          </div>
        </div>
        
        <!-- Status -->
        <div class="ml-4 object-status-badge">
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <i data-lucide="x-circle" class="w-4 h-4 mr-1"></i>
            Not Mapped
          </span>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
  
  // Add event listeners for dropdowns
  const selects = document.querySelectorAll('.target-object-select');
  selects.forEach(select => {
    select.addEventListener('change', function() {
      const sourceObjName = this.dataset.source;
      const targetObjName = this.value;
      
      if (targetObjName) {
        // User manually selected a target object
        appState.objectMappings.set(sourceObjName, targetObjName);
        
        // Update status badge to "Mapped"
        const card = this.closest('[data-source-object]');
        const statusBadge = card.querySelector('.object-status-badge');
        statusBadge.innerHTML = `
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <i data-lucide="check-circle" class="w-4 h-4 mr-1"></i>
            Mapped
          </span>
        `;
        
        // Update dropdown styling
        this.classList.remove('border-gray-300');
        this.classList.add('border-green-300', 'bg-green-50');
        
        lucide.createIcons();
      } else {
        // User cleared selection
        appState.objectMappings.delete(sourceObjName);
        
        // Update status badge to "Not Mapped"
        const card = this.closest('[data-source-object]');
        const statusBadge = card.querySelector('.object-status-badge');
        statusBadge.innerHTML = `
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            <i data-lucide="x-circle" class="w-4 h-4 mr-1"></i>
            Not Mapped
          </span>
        `;
        
        // Update dropdown styling
        this.classList.remove('border-green-300', 'bg-green-50');
        this.classList.add('border-gray-300');
        
        lucide.createIcons();
      }
      
      updateMappingProgress();
    });
  });
  
  // Reinitialize icons
  lucide.createIcons();
  
  // Update progress (initially 0/X)
  updateMappingProgress();
}

function updateMappingProgress() {
  const total = appState.selectedObjects.length;
  const mapped = appState.objectMappings.size;
  const percentage = (mapped / total) * 100;
  
  document.getElementById('mappingProgress').textContent = `${mapped} / ${total} objects mapped`;
  document.getElementById('mappingProgressBar').style.width = `${percentage}%`;
  
  // Enable Next button only if all objects are mapped
  document.getElementById('step3Next').disabled = mapped < total;
}

// Auto-Match All Objects by API Name
function autoMatchAllObjects() {
  if (!appState.targetObjects || appState.targetObjects.length === 0) {
    alert('No target objects available');
    return;
  }
  
  let matchedCount = 0;
  
  appState.selectedObjects.forEach(sourceObj => {
    // Find exact API name match in target objects
    const exactMatch = appState.targetObjects.find(t => t.name === sourceObj.name);
    
    if (exactMatch) {
      // Set mapping
      appState.objectMappings.set(sourceObj.name, exactMatch.name);
      
      // Update dropdown
      const card = document.querySelector(`[data-source-object="${sourceObj.name}"]`);
      if (card) {
        const select = card.querySelector('.target-object-select');
        select.value = exactMatch.name;
        select.classList.remove('border-gray-300');
        select.classList.add('border-green-300', 'bg-green-50');
        
        // Update status badge
        const statusBadge = card.querySelector('.object-status-badge');
        statusBadge.innerHTML = `
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
            <i data-lucide="check-circle" class="w-4 h-4 mr-1"></i>
            Mapped
          </span>
        `;
      }
      
      matchedCount++;
    }
  });
  
  // Reinitialize icons
  lucide.createIcons();
  
  // Update progress
  updateMappingProgress();
  
  // Show result message
  const unmatchedCount = appState.selectedObjects.length - matchedCount;
  if (unmatchedCount > 0) {
    alert(`Auto-Match Complete!\n\nMatched: ${matchedCount}\nNot Found: ${unmatchedCount}\n\nPlease manually map remaining objects.`);
  } else {
    alert(`Auto-Match Complete!\n\nAll ${matchedCount} objects matched successfully!`);
  }
}

// ==================== STEP 4: FIELD MAPPING ====================

async function initializeFieldMapping() {
  const container = document.getElementById('fieldMappingAccordion');
  container.innerHTML = '';
  
  for (const sourceObj of appState.selectedObjects) {
    const targetObjName = appState.objectMappings.get(sourceObj.name);
    
    // Fetch fields for both objects
    const [sourceFields, targetFields] = await Promise.all([
      fetchFields('source', sourceObj.name),
      fetchFields('target', targetObjName)
    ]);
    
    if (sourceFields && targetFields) {
      displayFieldMappingCard(sourceObj, targetObjName, sourceFields, targetFields);
    }
  }
}

// Auto-Map All Objects - Global function for all objects at once
function autoMapAllObjects() {
  let totalMapped = 0;
  let totalFields = 0;
  
  // Loop through all field mappings and enable auto-map for each
  appState.fieldMappings.forEach((fieldMapping, objectName) => {
    const card = document.querySelector(`[data-object-name="${objectName}"]`);
    if (!card) return;
    
    const sourceFieldMap = new Map(fieldMapping.source.map(f => [f.name, f]));
    
    // Map each target field to matching source field (exact API name match)
    fieldMapping.target.forEach(targetField => {
      const matchingSource = sourceFieldMap.get(targetField.name);
      
      if (matchingSource && matchingSource.name === targetField.name) {
        // Exact match found
        fieldMapping.mappings.set(targetField.name, matchingSource.name);
        totalMapped++;
        
        // Update dropdown
        const row = card.querySelector(`[data-mapping-row="${targetField.name}"]`);
        if (row) {
          const select = row.querySelector('select');
          const statusIndicator = row.querySelector('.status-indicator');
          
          select.value = matchingSource.name;
          select.classList.remove('border-gray-300');
          select.classList.add('border-green-300', 'bg-green-50');
          
          statusIndicator.classList.remove('bg-gray-300');
          statusIndicator.classList.add('bg-green-500');
          statusIndicator.title = 'Auto-mapped (exact match)';
        }
      }
      
      totalFields++;
    });
    
    fieldMapping.autoMapEnabled = true;
    
    // Update button to "Auto-Mapped"
    const autoMapBtn = card.querySelector('.auto-field-map-btn');
    if (autoMapBtn) {
      autoMapBtn.className = 'auto-field-map-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-md';
      autoMapBtn.innerHTML = `
        <i data-lucide="wand-2" class="w-4 h-4"></i>
        <span>Auto-Mapped</span>
      `;
      autoMapBtn.dataset.autoMap = 'true';
    }
    
    // Update counters for this object
    updateFieldMappingCounters(objectName);
  });
  
  // Reinitialize icons
  lucide.createIcons();
  
  // Show summary alert
  const unmappedCount = totalFields - totalMapped;
  alert(`Auto-Map All Fields Complete!\n\nTotal Fields: ${totalFields}\nMapped: ${totalMapped}\nUnmapped: ${unmappedCount}\n\n${unmappedCount > 0 ? 'Please manually map remaining fields.' : 'All fields mapped successfully!'}`);
}

async function fetchFields(type, objectName) {
  try {
    const response = await fetch(`${SERVER_URL}/api/fields?type=${type}&objectName=${encodeURIComponent(objectName)}`);
    const data = await response.json();
    
    if (response.ok) {
      return data.fields;
    }
  } catch (error) {
    console.error(`Error fetching fields for ${objectName}:`, error);
  }
  return null;
}

function displayFieldMappingCard(sourceObj, targetObjName, sourceFields, targetFields) {
  const container = document.getElementById('fieldMappingAccordion');
  
  // Separate required and optional target fields
  const requiredTargetFields = targetFields.filter(f => f.required);
  const optionalTargetFields = targetFields.filter(f => !f.required);
  
  // Create source field map for lookup
  const sourceFieldMap = new Map(sourceFields.map(f => [f.name, f]));
  
  // Initialize mapping state - ALL UNMAPPED by default
  appState.fieldMappings.set(sourceObj.name, {
    source: sourceFields,
    target: targetFields,
    mappings: new Map(), // targetFieldName -> sourceFieldName
    autoMapEnabled: false
  });
  
  const card = document.createElement('div');
  card.className = 'border-2 border-gray-200 rounded-lg overflow-hidden';
  card.dataset.objectName = sourceObj.name;
  card.innerHTML = `
    <!-- Card Header with Buttons -->
    <div class="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200 p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3 flex-1 cursor-pointer" onclick="toggleFieldCard(this.parentElement.parentElement)">
          <i data-lucide="chevron-down" class="w-5 h-5 text-gray-600 transform transition-transform card-chevron"></i>
          <div>
            <h3 class="font-bold text-gray-900 text-lg">${sourceObj.label} → ${targetObjName}</h3>
            <p class="text-sm text-gray-600">
              <span class="field-count-display">0 of ${targetFields.length} target fields mapped</span>
            </p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <button 
            onclick="toggleAutoFieldMapping('${sourceObj.name}', event)" 
            class="auto-field-map-btn bg-gray-400 hover:bg-gray-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-md"
            data-auto-map="false"
          >
            <i data-lucide="wand-2" class="w-4 h-4"></i>
            <span>Enable Auto-Map</span>
          </button>
          <div class="text-sm bg-white px-3 py-1 rounded-full border border-gray-300">
            <span class="font-semibold text-gray-600" id="required-badge-${sourceObj.name}">0/${requiredTargetFields.length}</span>
            <span class="text-gray-600"> required</span>
          </div>
          <button 
            onclick="checkFieldMapping('${sourceObj.name}', event)" 
            class="bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-md"
          >
            <i data-lucide="check-circle" class="w-4 h-4"></i>
            <span>Check Mapping</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- Card Content - Target-Centric Two Column Layout -->
    <div class="hidden field-mapping-content">
      <div class="p-6 bg-gray-50">
        
        <!-- Mapping Grid Header -->
        <div class="bg-white rounded-t-lg border-2 border-gray-200 border-b-0">
          <div class="grid grid-cols-2 gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 font-semibold text-gray-700">
            <div class="flex items-center">
              <i data-lucide="list" class="w-4 h-4 mr-2 text-purple-600"></i>
              Select Source Field (Map From)
            </div>
            <div class="flex items-center">
              <i data-lucide="target" class="w-4 h-4 mr-2 text-pink-600"></i>
              Target Field (Map To) - ${targetFields.length} fields
            </div>
          </div>
        </div>
        
        <!-- Required Fields Section -->
        ${requiredTargetFields.length > 0 ? `
        <div class="bg-red-50 border-2 border-red-200 p-3">
          <h4 class="text-sm font-bold text-red-700 flex items-center">
            <i data-lucide="alert-circle" class="w-4 h-4 mr-2"></i>
            Required Target Fields (${requiredTargetFields.length})
          </h4>
        </div>
        <div class="bg-white border-x-2 border-gray-200">
          <div class="divide-y divide-gray-200">
            ${requiredTargetFields.map(targetField => {
              return `
                <div class="grid grid-cols-2 gap-4 p-4 hover:bg-gray-50 transition-colors bg-red-50" data-mapping-row="${targetField.name}">
                  
                  <!-- Source Field Dropdown (Left) -->
                  <div class="flex items-center space-x-2">
                    <select 
                      class="flex-1 px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors source-field-select" 
                      onchange="updateTargetFieldMapping('${sourceObj.name}', '${targetField.name}', this.value)"
                      data-target-field="${targetField.name}"
                    >
                      <option value="">-- Select Source Field --</option>
                      ${sourceFields.map(sf => `
                        <option value="${sf.name}">
                          ${sf.label} (${sf.name}) • ${sf.type}
                        </option>
                      `).join('')}
                    </select>
                    <div class="status-indicator w-3 h-3 rounded-full bg-gray-300" title="Not mapped"></div>
                  </div>
                  
                  <!-- Target Field Display (Right) -->
                  <div class="flex items-center space-x-3">
                    <span class="text-red-500 font-bold text-lg">*</span>
                    <div class="flex-1 bg-pink-50 border-2 border-pink-300 rounded-lg p-3">
                      <div class="font-bold text-gray-900">${targetField.label}</div>
                      <div class="text-xs text-gray-500">${targetField.name} • ${targetField.type}</div>
                      <span class="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">Required</span>
                    </div>
                  </div>
                  
                </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}
        
        <!-- Optional Fields Section -->
        ${optionalTargetFields.length > 0 ? `
        <div class="bg-blue-50 border-2 border-blue-200 border-t-0 p-3">
          <h4 class="text-sm font-bold text-blue-700 flex items-center">
            <i data-lucide="list" class="w-4 h-4 mr-2"></i>
            Optional Target Fields (${optionalTargetFields.length})
          </h4>
        </div>
        <div class="bg-white border-2 border-gray-200 border-t-0 rounded-b-lg max-h-96 overflow-y-auto">
          <div class="divide-y divide-gray-200">
            ${optionalTargetFields.map(targetField => {
              return `
                <div class="grid grid-cols-2 gap-4 p-4 hover:bg-gray-50 transition-colors" data-mapping-row="${targetField.name}">
                  
                  <!-- Source Field Dropdown (Left) -->
                  <div class="flex items-center space-x-2">
                    <select 
                      class="flex-1 px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors source-field-select" 
                      onchange="updateTargetFieldMapping('${sourceObj.name}', '${targetField.name}', this.value)"
                      data-target-field="${targetField.name}"
                    >
                      <option value="">-- Select Source Field --</option>
                      ${sourceFields.map(sf => `
                        <option value="${sf.name}">
                          ${sf.label} (${sf.name}) • ${sf.type}
                        </option>
                      `).join('')}
                    </select>
                    <div class="status-indicator w-3 h-3 rounded-full bg-gray-300" title="Not mapped"></div>
                  </div>
                  
                  <!-- Target Field Display (Right) -->
                  <div class="flex items-center space-x-3">
                    <span class="text-gray-300 text-lg">•</span>
                    <div class="flex-1 bg-pink-50 border-2 border-pink-200 rounded-lg p-3">
                      <div class="font-semibold text-gray-900">${targetField.label}</div>
                      <div class="text-xs text-gray-500">${targetField.name} • ${targetField.type}</div>
                    </div>
                  </div>
                  
                </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}
        
        <!-- Mapping Summary Footer -->
        <div class="mt-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <div class="grid grid-cols-3 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold text-green-600" id="mapped-count-${sourceObj.name}">0</div>
              <div class="text-sm text-gray-600">Mapped</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-gray-400" id="unmapped-count-${sourceObj.name}">${targetFields.length}</div>
              <div class="text-sm text-gray-600">Unmapped</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-red-600" id="required-count-${sourceObj.name}">0/${requiredTargetFields.length}</div>
              <div class="text-sm text-gray-600">Required</div>
            </div>
          </div>
        </div>
        
      </div>
    </div>
  `;
  
  container.appendChild(card);
  lucide.createIcons();
}

function toggleFieldCard(headerParent) {
  const content = headerParent.nextElementSibling;
  const icon = headerParent.querySelector('.card-chevron');
  
  content.classList.toggle('hidden');
  icon.classList.toggle('rotate-180');
  lucide.createIcons();
}

// Update Target Field Mapping (user selects source field for a target field)
function updateTargetFieldMapping(objectName, targetFieldName, sourceFieldName) {
  const fieldMapping = appState.fieldMappings.get(objectName);
  if (!fieldMapping) return;
  
  const card = document.querySelector(`[data-object-name="${objectName}"]`);
  const row = card.querySelector(`[data-mapping-row="${targetFieldName}"]`);
  
  if (sourceFieldName) {
    // User selected a source field
    fieldMapping.mappings.set(targetFieldName, sourceFieldName);
    
    // Update visual indicators
    if (row) {
      const statusIndicator = row.querySelector('.status-indicator');
      const dropdown = row.querySelector('select');
      
      statusIndicator.classList.remove('bg-gray-300');
      statusIndicator.classList.add('bg-green-500');
      statusIndicator.title = 'Mapped';
      
      dropdown.classList.remove('border-gray-300');
      dropdown.classList.add('border-green-300', 'bg-green-50');
    }
  } else {
    // User cleared selection
    fieldMapping.mappings.delete(targetFieldName);
    
    // Update visual indicators
    if (row) {
      const statusIndicator = row.querySelector('.status-indicator');
      const dropdown = row.querySelector('select');
      
      statusIndicator.classList.remove('bg-green-500');
      statusIndicator.classList.add('bg-gray-300');
      statusIndicator.title = 'Not mapped';
      
      dropdown.classList.remove('border-green-300', 'bg-green-50');
      dropdown.classList.add('border-gray-300');
    }
  }
  
  // Update counters
  updateFieldMappingCounters(objectName);
}

// Toggle Auto Field Mapping
function toggleAutoFieldMapping(objectName, event) {
  event.stopPropagation();
  
  const fieldMapping = appState.fieldMappings.get(objectName);
  if (!fieldMapping) return;
  
  const card = document.querySelector(`[data-object-name="${objectName}"]`);
  const autoMapBtn = card.querySelector('.auto-field-map-btn');
  const isCurrentlyEnabled = fieldMapping.autoMapEnabled;
  
  if (isCurrentlyEnabled) {
    // DISABLE: Clear all mappings
    fieldMapping.mappings.clear();
    fieldMapping.autoMapEnabled = false;
    
    // Update button
    autoMapBtn.className = 'auto-field-map-btn bg-gray-400 hover:bg-gray-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-md';
    autoMapBtn.innerHTML = `
      <i data-lucide="wand-2" class="w-4 h-4"></i>
      <span>Enable Auto-Map</span>
    `;
    autoMapBtn.dataset.autoMap = 'false';
    
    // Clear all dropdowns
    card.querySelectorAll('.source-field-select').forEach(select => {
      select.value = '';
      select.classList.remove('border-green-300', 'bg-green-50');
      select.classList.add('border-gray-300');
    });
    
    // Clear all status indicators
    card.querySelectorAll('.status-indicator').forEach(indicator => {
      indicator.classList.remove('bg-green-500');
      indicator.classList.add('bg-gray-300');
      indicator.title = 'Not mapped';
    });
    
  } else {
    // ENABLE: Auto-map by API name
    const sourceFieldMap = new Map(fieldMapping.source.map(f => [f.name, f]));
    
    // Map each target field to matching source field (exact API name match)
    fieldMapping.target.forEach(targetField => {
      const matchingSource = sourceFieldMap.get(targetField.name);
      
      if (matchingSource && matchingSource.name === targetField.name) {
        // Exact match found
        fieldMapping.mappings.set(targetField.name, matchingSource.name);
        
        // Update dropdown
        const row = card.querySelector(`[data-mapping-row="${targetField.name}"]`);
        if (row) {
          const select = row.querySelector('select');
          const statusIndicator = row.querySelector('.status-indicator');
          
          select.value = matchingSource.name;
          select.classList.remove('border-gray-300');
          select.classList.add('border-green-300', 'bg-green-50');
          
          statusIndicator.classList.remove('bg-gray-300');
          statusIndicator.classList.add('bg-green-500');
          statusIndicator.title = 'Auto-mapped (exact match)';
        }
      }
    });
    
    fieldMapping.autoMapEnabled = true;
    
    // Update button
    autoMapBtn.className = 'auto-field-map-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-md';
    autoMapBtn.innerHTML = `
      <i data-lucide="wand-2" class="w-4 h-4"></i>
      <span>Auto-Mapped</span>
    `;
    autoMapBtn.dataset.autoMap = 'true';
  }
  
  lucide.createIcons();
  updateFieldMappingCounters(objectName);
}

// Update Field Mapping Counters
function updateFieldMappingCounters(objectName) {
  const fieldMapping = appState.fieldMappings.get(objectName);
  if (!fieldMapping) return;
  
  const mapped = fieldMapping.mappings.size;
  const unmapped = fieldMapping.target.length - mapped;
  const requiredMapped = Array.from(fieldMapping.mappings.entries()).filter(([targetName, sourceName]) => {
    const targetField = fieldMapping.target.find(f => f.name === targetName);
    return targetField && targetField.required;
  }).length;
  const requiredTotal = fieldMapping.target.filter(f => f.required).length;
  
  // Update counters
  const countDisplay = document.querySelector(`[data-object-name="${objectName}"] .field-count-display`);
  if (countDisplay) {
    countDisplay.textContent = `${mapped} of ${fieldMapping.target.length} target fields mapped`;
  }
  
  const mappedCounter = document.getElementById(`mapped-count-${objectName}`);
  const unmappedCounter = document.getElementById(`unmapped-count-${objectName}`);
  const requiredCounter = document.getElementById(`required-count-${objectName}`);
  const requiredBadge = document.getElementById(`required-badge-${objectName}`);
  
  if (mappedCounter) mappedCounter.textContent = mapped;
  if (unmappedCounter) unmappedCounter.textContent = unmapped;
  if (requiredCounter) {
    requiredCounter.textContent = `${requiredMapped}/${requiredTotal}`;
    requiredCounter.className = `text-2xl font-bold ${requiredMapped === requiredTotal ? 'text-green-600' : 'text-red-600'}`;
  }
  if (requiredBadge) {
    requiredBadge.textContent = `${requiredMapped}/${requiredTotal}`;
    requiredBadge.className = `font-semibold ${requiredMapped === requiredTotal ? 'text-green-600' : 'text-orange-600'}`;
  }
  
  updateSidebar();
}

// Toggle Auto-Mapping Function
function toggleAutoMapping(objectName, event) {
  event.stopPropagation();
  
  const fieldMapping = appState.fieldMappings.get(objectName);
  if (!fieldMapping) return;
  
  const card = document.querySelector(`[data-object-name="${objectName}"]`);
  const autoMapBtn = card.querySelector('.auto-map-btn');
  const isCurrentlyAutoMapped = fieldMapping.autoMapEnabled;
  
  if (isCurrentlyAutoMapped) {
    // UNMAP ALL: Clear all auto-mapped fields
    fieldMapping.mappings = [];
    fieldMapping.unmapped = [...fieldMapping.source];
    fieldMapping.autoMapEnabled = false;
    
    // Update button to "Enable Auto-Map"
    autoMapBtn.className = 'auto-map-btn bg-gray-400 hover:bg-gray-500 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-md';
    autoMapBtn.innerHTML = `
      <i data-lucide="wand-2" class="w-4 h-4"></i>
      <span>Enable Auto-Map</span>
    `;
    autoMapBtn.dataset.autoMap = 'false';
    
    // Clear all dropdowns
    card.querySelectorAll('[data-field-select]').forEach(select => {
      select.value = '';
      select.classList.remove('border-green-300', 'bg-green-50');
      select.classList.add('border-gray-300');
    });
    
    // Clear all status indicators
    card.querySelectorAll('.status-indicator').forEach(indicator => {
      indicator.classList.remove('bg-green-500');
      indicator.classList.add('bg-gray-300');
    });
    
    // Remove all check icons
    card.querySelectorAll('.bg-green-100').forEach(icon => icon.remove());
    
  } else {
    // AUTO-MAP: Map all fields with exact API name matches
    const targetFieldMap = new Map(fieldMapping.target.map(f => [f.name, f]));
    
    fieldMapping.mappings = fieldMapping.source.filter(sf => {
      const targetField = targetFieldMap.get(sf.name);
      return targetField && sf.name === targetField.name; // Exact match only
    });
    
    fieldMapping.unmapped = fieldMapping.source.filter(sf => !targetFieldMap.has(sf.name));
    fieldMapping.autoMapEnabled = true;
    
    // Update button to "Auto-Mapped"
    autoMapBtn.className = 'auto-map-btn bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-md';
    autoMapBtn.innerHTML = `
      <i data-lucide="wand-2" class="w-4 h-4"></i>
      <span>Auto-Mapped</span>
    `;
    autoMapBtn.dataset.autoMap = 'true';
    
    // Update all rows with exact matches
    fieldMapping.source.forEach(sourceField => {
      const matchedTarget = targetFieldMap.get(sourceField.name);
      const isExactMatch = matchedTarget && sourceField.name === matchedTarget.name;
      
      const row = card.querySelector(`[data-mapping-row="${sourceField.name}"]`);
      if (row) {
        const select = row.querySelector('select');
        const statusIndicator = row.querySelector('.status-indicator');
        
        if (isExactMatch) {
          // Map the field
          select.value = matchedTarget.name;
          select.classList.remove('border-gray-300');
          select.classList.add('border-green-300', 'bg-green-50');
          statusIndicator.classList.remove('bg-gray-300');
          statusIndicator.classList.add('bg-green-500');
          
          // Add check icon if not present
          if (!row.querySelector('.bg-green-100')) {
            const iconContainer = document.createElement('div');
            iconContainer.className = 'flex items-center justify-center w-8 h-8 bg-green-100 rounded-full';
            iconContainer.title = 'Auto-mapped';
            iconContainer.innerHTML = '<i data-lucide="check" class="w-5 h-5 text-green-600"></i>';
            select.parentElement.appendChild(iconContainer);
          }
        } else {
          // Clear the field
          select.value = '';
          select.classList.remove('border-green-300', 'bg-green-50');
          select.classList.add('border-gray-300');
          statusIndicator.classList.remove('bg-green-500');
          statusIndicator.classList.add('bg-gray-300');
          
          const checkIcon = row.querySelector('.bg-green-100');
          if (checkIcon) checkIcon.remove();
        }
      }
    });
  }
  
  // Update all counters
  const mapped = fieldMapping.mappings.length;
  const unmapped = fieldMapping.unmapped.length;
  const requiredMapped = fieldMapping.mappings.filter(f => f.required).length;
  const requiredTotal = fieldMapping.source.filter(f => f.required).length;
  
  // Update header count
  const countDisplay = card.querySelector('.field-count-display');
  if (countDisplay) {
    countDisplay.textContent = `${mapped} of ${fieldMapping.source.length} fields mapped`;
  }
  
  // Update required badge
  const requiredBadge = card.querySelector('.text-sm.bg-white span.font-semibold');
  if (requiredBadge) {
    requiredBadge.textContent = `${requiredMapped}/${requiredTotal}`;
    requiredBadge.className = `font-semibold ${requiredMapped === requiredTotal ? 'text-green-600' : 'text-orange-600'}`;
  }
  
  // Update footer counters
  const mappedCounter = document.getElementById(`mapped-count-${objectName}`);
  const unmappedCounter = document.getElementById(`unmapped-count-${objectName}`);
  const requiredCounter = document.getElementById(`required-count-${objectName}`);
  
  if (mappedCounter) mappedCounter.textContent = mapped;
  if (unmappedCounter) unmappedCounter.textContent = unmapped;
  if (requiredCounter) {
    requiredCounter.textContent = `${requiredMapped}/${requiredTotal}`;
    requiredCounter.className = `text-2xl font-bold ${requiredMapped === requiredTotal ? 'text-green-600' : 'text-red-600'}`;
  }
  
  // Reinitialize icons
  lucide.createIcons();
  updateSidebar();
}

// Check Field Mapping Function with Popup
function checkFieldMapping(objectName, event) {
  event.stopPropagation();
  
  const fieldMapping = appState.fieldMappings.get(objectName);
  if (!fieldMapping) return;
  
  const totalSource = fieldMapping.source.length;
  const totalTarget = fieldMapping.target.length;
  const mapped = fieldMapping.mappings.size;
  const unmapped = totalTarget - mapped;
  
  // Count required target fields that are mapped
  const requiredMapped = Array.from(fieldMapping.mappings.entries()).filter(([targetName, sourceName]) => {
    const targetField = fieldMapping.target.find(f => f.name === targetName);
    return targetField && targetField.required;
  }).length;
  const requiredTotal = fieldMapping.target.filter(f => f.required).length;
  
  // Create popup
  const popup = document.createElement('div');
  popup.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  popup.innerHTML = `
    <div class="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all">
      <div class="text-center">
        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full ${mapped === totalSource ? 'bg-green-100' : 'bg-yellow-100'} mb-4">
          <i data-lucide="${mapped === totalSource ? 'check-circle' : 'alert-circle'}" class="w-10 h-10 ${mapped === totalSource ? 'text-green-600' : 'text-yellow-600'}"></i>
        </div>
        <h3 class="text-2xl font-bold ${mapped === totalSource ? 'text-green-900' : 'text-yellow-900'} mb-2">
          ${mapped === totalSource ? 'Mapping Successful!' : 'Mapping Incomplete'}
        </h3>
        <div class="mt-6 space-y-4">
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="text-sm text-gray-600 mb-3 font-semibold">Source Object Mapping:</div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-gray-700">Total Fields:</span>
              <span class="font-bold text-blue-600">${totalSource}</span>
            </div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-gray-700">Mapped:</span>
              <span class="font-bold text-green-600">${mapped}</span>
            </div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-gray-700">Unmapped:</span>
              <span class="font-bold ${unmapped > 0 ? 'text-orange-600' : 'text-gray-400'}">${unmapped}</span>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-gray-200">
              <span class="text-gray-700 font-semibold">Required Mapped:</span>
              <span class="font-bold ${requiredMapped === requiredTotal ? 'text-green-600' : 'text-red-600'}">${requiredMapped}/${requiredTotal}</span>
            </div>
          </div>
          <div class="bg-blue-50 rounded-lg p-4">
            <div class="text-sm text-gray-600 mb-2 font-semibold">Target Object:</div>
            <div class="flex items-center justify-between">
              <span class="text-gray-700">Available Fields:</span>
              <span class="font-bold text-blue-600">${totalTarget}</span>
            </div>
          </div>
        </div>
        <div class="mt-6">
          <button onclick="this.closest('.fixed').remove()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(popup);
  lucide.createIcons();
  
  // Close on background click
  popup.addEventListener('click', (e) => {
    if (e.target === popup) {
      popup.remove();
    }
  });
}

// Update Field Mapping
function updateFieldMapping(objectName, sourceFieldName, targetFieldName) {
  const fieldMapping = appState.fieldMappings.get(objectName);
  if (!fieldMapping) return;
  
  const targetField = fieldMapping.target.find(f => f.name === targetFieldName);
  const sourceField = fieldMapping.source.find(f => f.name === sourceFieldName);
  
  if (targetFieldName && targetField && sourceField) {
    // Check if already mapped
    const existingMappingIndex = fieldMapping.mappings.findIndex(m => m.name === sourceFieldName);
    
    if (existingMappingIndex >= 0) {
      // Update existing mapping
      fieldMapping.mappings[existingMappingIndex] = sourceField;
    } else {
      // Add new mapping
      fieldMapping.mappings.push(sourceField);
      fieldMapping.unmapped = fieldMapping.unmapped.filter(f => f.name !== sourceFieldName);
    }
    
    // Update visual indicators in the row
    const row = document.querySelector(`[data-mapping-row="${sourceFieldName}"]`);
    if (row) {
      // Update status indicator
      const statusIndicator = row.querySelector('.status-indicator');
      statusIndicator.classList.remove('bg-gray-300');
      statusIndicator.classList.add('bg-green-500');
      
      // Update dropdown styling
      const dropdown = row.querySelector('select');
      dropdown.classList.remove('border-gray-300');
      dropdown.classList.add('border-green-300', 'bg-green-50');
      
      // Add check icon if not present
      const checkIcon = row.querySelector('[data-lucide="check"]');
      if (!checkIcon) {
        const iconContainer = document.createElement('div');
        iconContainer.className = 'flex items-center justify-center w-8 h-8 bg-green-100 rounded-full';
        iconContainer.innerHTML = '<i data-lucide="check" class="w-5 h-5 text-green-600"></i>';
        dropdown.parentElement.appendChild(iconContainer);
        lucide.createIcons();
      }
    }
  } else if (!targetFieldName) {
    // Unmapping
    fieldMapping.mappings = fieldMapping.mappings.filter(m => m.name !== sourceFieldName);
    if (sourceField && !fieldMapping.unmapped.find(u => u.name === sourceFieldName)) {
      fieldMapping.unmapped.push(sourceField);
    }
    
    // Update visual indicators
    const row = document.querySelector(`[data-mapping-row="${sourceFieldName}"]`);
    if (row) {
      const statusIndicator = row.querySelector('.status-indicator');
      statusIndicator.classList.remove('bg-green-500');
      statusIndicator.classList.add('bg-gray-300');
      
      const dropdown = row.querySelector('select');
      dropdown.classList.remove('border-green-300', 'bg-green-50');
      dropdown.classList.add('border-gray-300');
      
      // Remove check icon
      const checkContainer = row.querySelector('.bg-green-100');
      if (checkContainer) {
        checkContainer.remove();
      }
    }
  }
  
  // Update all counters
  const card = document.querySelector(`[data-object-name="${objectName}"]`);
  if (card) {
    const mapped = fieldMapping.mappings.length;
    const unmapped = fieldMapping.unmapped.length;
    const requiredMapped = fieldMapping.mappings.filter(f => f.required).length;
    const requiredTotal = fieldMapping.source.filter(f => f.required).length;
    
    // Update header count
    const countDisplay = card.querySelector('.field-count-display');
    if (countDisplay) {
      countDisplay.textContent = `${mapped} of ${fieldMapping.source.length} fields mapped`;
    }
    
    // Update required badge in header
    const requiredBadge = card.querySelector('.text-sm.bg-white span.font-semibold');
    if (requiredBadge) {
      requiredBadge.textContent = `${requiredMapped}/${requiredTotal}`;
      requiredBadge.className = `font-semibold ${requiredMapped === requiredTotal ? 'text-green-600' : 'text-orange-600'}`;
    }
    
    // Update footer summary counters
    const mappedCounter = document.getElementById(`mapped-count-${objectName}`);
    const unmappedCounter = document.getElementById(`unmapped-count-${objectName}`);
    const requiredCounter = document.getElementById(`required-count-${objectName}`);
    
    if (mappedCounter) mappedCounter.textContent = mapped;
    if (unmappedCounter) unmappedCounter.textContent = unmapped;
    if (requiredCounter) {
      requiredCounter.textContent = `${requiredMapped}/${requiredTotal}`;
      requiredCounter.className = `text-2xl font-bold ${requiredMapped === requiredTotal ? 'text-green-600' : 'text-red-600'}`;
    }
  }
  
  // Update global state
  updateSidebar();
}

// Expand/Collapse All
document.getElementById('expandAllFields').addEventListener('click', () => {
  document.querySelectorAll('.field-mapping-content').forEach(el => el.classList.remove('hidden'));
  document.querySelectorAll('.card-chevron').forEach(el => el.classList.add('rotate-180'));
  lucide.createIcons();
});

document.getElementById('collapseAllFields').addEventListener('click', () => {
  document.querySelectorAll('.field-mapping-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.card-chevron').forEach(el => el.classList.remove('rotate-180'));
});

// Show All Fields - Filter to show only unmapped or all fields
let showOnlyUnmapped = false;
document.getElementById('showAllFieldsBtn').addEventListener('click', function() {
  showOnlyUnmapped = !showOnlyUnmapped;
  
  // Toggle visibility of mapped fields
  document.querySelectorAll('[data-mapping-row]').forEach(row => {
    const statusIndicator = row.querySelector('.status-indicator');
    const isMapped = statusIndicator.classList.contains('bg-green-500');
    
    if (showOnlyUnmapped && isMapped) {
      row.classList.add('hidden');
    } else {
      row.classList.remove('hidden');
    }
  });
  
  // Update button text
  const icon = this.querySelector('i');
  const text = this.querySelector('span');
  
  if (showOnlyUnmapped) {
    text.textContent = 'Show All Fields';
    icon.setAttribute('data-lucide', 'filter');
    this.classList.remove('bg-blue-100', 'hover:bg-blue-200', 'text-blue-700');
    this.classList.add('bg-orange-100', 'hover:bg-orange-200', 'text-orange-700');
  } else {
    text.textContent = 'Show Unmapped Only';
    icon.setAttribute('data-lucide', 'eye');
    this.classList.remove('bg-orange-100', 'hover:bg-orange-200', 'text-orange-700');
    this.classList.add('bg-blue-100', 'hover:bg-blue-200', 'text-blue-700');
  }
  
  lucide.createIcons();
});

// ==================== STEP 5: REVIEW & TRANSFER ====================

function initializeReviewStep() {
  // Calculate total mapped fields across all objects
  let totalMappedFields = 0;
  let estimatedRecords = 0;
  
  appState.fieldMappings.forEach((fieldMapping, objectName) => {
    totalMappedFields += fieldMapping.mappings.size;
    
    // Estimate ~50 records per object (placeholder)
    estimatedRecords += 50;
  });
  
  // Update summary counts
  document.getElementById('summaryObjectCount').textContent = appState.selectedObjects.length;
  document.getElementById('summaryFieldCount').textContent = totalMappedFields;
  document.getElementById('summaryRecordCount').textContent = `~${estimatedRecords}`;
  
  // Generate transfer summary
  const summaryContainer = document.getElementById('transferSummary');
  summaryContainer.innerHTML = '';
  
  appState.selectedObjects.forEach(sourceObj => {
    const targetObjName = appState.objectMappings.get(sourceObj.name);
    const fieldMapping = appState.fieldMappings.get(sourceObj.name);
    const mappedCount = fieldMapping ? fieldMapping.mappings.size : 0;
    
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between py-2 border-b border-gray-200 last:border-0';
    item.innerHTML = `
      <div class="flex items-center space-x-3">
        <i data-lucide="database" class="w-5 h-5 text-blue-500"></i>
        <div>
          <div class="font-semibold text-gray-900">${sourceObj.label} → ${targetObjName}</div>
          <div class="text-sm text-gray-600">${mappedCount} fields mapped</div>
        </div>
      </div>
      <span class="text-sm font-medium ${mappedCount > 0 ? 'text-green-600' : 'text-orange-600'}">${mappedCount > 0 ? '✓ Ready' : '⚠ No mappings'}</span>
    `;
    summaryContainer.appendChild(item);
  });
  
  lucide.createIcons();
  updateSidebar();
}

// Start Transfer Button
document.getElementById('startTransferBtn').addEventListener('click', () => {
  if (!confirm('Are you sure you want to start the data transfer? This action cannot be undone.')) {
    return;
  }
  
  document.getElementById('transferProgress').classList.remove('hidden');
  document.getElementById('startTransferBtn').disabled = true;
  
  // Call actual API endpoint
  executeTransfer();
});

async function executeTransfer() {
  // Prepare transfer data - Convert Map to array
  const fieldMappingsArray = Array.from(appState.fieldMappings.entries()).map(([objName, mapping]) => ({
    objectName: objName,
    mappings: Array.from(mapping.mappings.entries()).map(([targetField, sourceField]) => ({
      sourceField: sourceField,
      targetField: targetField
    }))
  }));
  
  const transferData = {
    objects: appState.selectedObjects,
    fieldMappings: fieldMappingsArray
  };
  
  console.log('📤 Transfer Data:', transferData);
  logTransfer('Initiating data transfer...', 'info');
  logTransfer(`Objects: ${appState.selectedObjects.length}`, 'info');
  logTransfer(`Total mapped fields: ${fieldMappingsArray.reduce((sum, fm) => sum + fm.mappings.length, 0)}`, 'info');
  
  document.getElementById('transferStatus').textContent = 'Connecting to server...';
  
  try {
    const response = await fetch(`${SERVER_URL}/api/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transferData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Transfer API error:', errorText);
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log('📥 Transfer Result:', result);
    
    if (result.success) {
      logTransfer('✓ Server responded successfully', 'success');
      
      // Animate progress
      let progress = 0;
      const totalObjects = result.results.length;
      const increment = totalObjects > 0 ? 100 / totalObjects : 0;
      
      for (const objResult of result.results) {
        progress += increment;
        document.getElementById('transferProgressBar').style.width = `${Math.min(progress, 100)}%`;
        document.getElementById('transferStatus').textContent = `Processing ${objResult.objectLabel}...`;
        
        // Log detailed results
        if (objResult.status === 'success') {
          logTransfer(`✓ ${objResult.objectLabel}: ${objResult.recordsSuccess} records transferred successfully`, 'success');
        } else if (objResult.status === 'partial') {
          logTransfer(`⚠ ${objResult.objectLabel}: ${objResult.recordsSuccess} success, ${objResult.recordsFailed} failed`, 'warning');
          if (objResult.errors && objResult.errors.length > 0) {
            objResult.errors.forEach(err => {
              logTransfer(`  Error: ${err.message} (Record ${err.recordIndex})`, 'error');
            });
          }
        } else if (objResult.status === 'failed') {
          logTransfer(`✗ ${objResult.objectLabel}: Transfer failed - ${objResult.error || 'Unknown error'}`, 'error');
        } else if (objResult.status === 'skipped') {
          logTransfer(`⊘ ${objResult.objectLabel}: Skipped - ${objResult.message || 'No data'}`, 'warning');
        }
        
        // Small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // Complete
      document.getElementById('transferProgressBar').style.width = '100%';
      document.getElementById('transferStatus').textContent = 'Transfer Complete!';
      
      logTransfer(`\n════════════════════════════════════`, 'success');
      logTransfer(`✓ TRANSFER COMPLETED SUCCESSFULLY`, 'success');
      logTransfer(`════════════════════════════════════`, 'success');
      logTransfer(`Total Objects: ${result.summary.totalObjects}`, 'info');
      logTransfer(`Total Records: ${result.summary.totalRecords}`, 'info');
      logTransfer(`✓ Success: ${result.summary.successRecords}`, 'success');
      logTransfer(`✗ Failed: ${result.summary.failedRecords}`, result.summary.failedRecords > 0 ? 'error' : 'info');
      
    } else {
      throw new Error(result.error || 'Transfer failed');
    }
    
  } catch (error) {
    console.error('❌ Transfer Error:', error);
    logTransfer(`\n✗ TRANSFER FAILED`, 'error');
    logTransfer(`Error: ${error.message}`, 'error');
    
    document.getElementById('transferStatus').textContent = 'Transfer Failed';
    document.getElementById('transferProgressBar').style.width = '0%';
    document.getElementById('startTransferBtn').disabled = false;
    alert(`Transfer failed: ${error.message}`);
  }
}

// ==================== NAVIGATION ====================

// Step 1 Next
document.getElementById('step1Next').addEventListener('click', () => {
  updateStepper(2);
  loadObjects();
});

// Step 2 Navigation
document.getElementById('step2Back').addEventListener('click', () => updateStepper(1));
document.getElementById('step2Next').addEventListener('click', () => {
  updateStepper(3);
  initializeObjectMatching();
});

// Step 3 Navigation
document.getElementById('step3Back').addEventListener('click', () => updateStepper(2));
document.getElementById('step3Next').addEventListener('click', async () => {
  updateStepper(4);
  await initializeFieldMapping();
});

// Step 4 Navigation
document.getElementById('step4Back').addEventListener('click', () => updateStepper(3));
document.getElementById('step4Next').addEventListener('click', () => {
  updateStepper(5);
  initializeReviewStep();
});

// Step 5 Navigation
document.getElementById('step5Back').addEventListener('click', () => updateStepper(4));

// ==================== INITIALIZATION ====================

// Connect Org Buttons
document.getElementById('connectSource').addEventListener('click', () => connectOrg('source'));
document.getElementById('connectTarget').addEventListener('click', () => connectOrg('target'));

// Check backend status
async function checkBackendStatus() {
  try {
    const response = await fetch(`${SERVER_URL}/`);
    const text = await response.text();
    
    const badge = document.getElementById('headerBackendStatus');
    badge.innerHTML = `
      <span class="w-2 h-2 bg-green-500 rounded-full pulse-dot"></span>
      <span class="text-green-600 font-medium">${text}</span>
    `;
  } catch (error) {
    const badge = document.getElementById('headerBackendStatus');
    badge.innerHTML = `
      <span class="w-2 h-2 bg-red-500 rounded-full"></span>
      <span class="text-red-600 font-medium">Backend Offline</span>
    `;
  }
}

// Toggle Sidebar Visibility
function toggleSidebar() {
  const sidebar = document.getElementById('statusSidebar');
  const showBtn = document.getElementById('showSidebarBtn');
  
  if (sidebar.classList.contains('hidden')) {
    // Show sidebar
    sidebar.classList.remove('hidden');
    showBtn.classList.add('hidden');
  } else {
    // Hide sidebar
    sidebar.classList.add('hidden');
    showBtn.classList.remove('hidden');
  }
  
  lucide.createIcons();
}

// Initialize app
checkBackendStatus();
updateSidebar();


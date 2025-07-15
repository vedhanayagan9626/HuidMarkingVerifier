let stage = "Stage1";
let unique_number = null;
let stream = null;

let currentJobNo = null;
let currentItemCode = null;
let currentHuidNo = null;

let capturedStages = { Stage1: false, QC: false, Weighing: false };
let capturedImages = { Stage1: null, QC: null, Weighing: null };

const video = document.getElementById('camera');
const canvas = document.getElementById('snapshot');
const stageLabel = document.getElementById('stage-label');
const cameraSelect = document.getElementById('cameraSelect');
const currentPreview = document.getElementById('current-preview');
const currentBadge = document.getElementById('current-stage-badge');
const noPreview = document.getElementById('no-preview');

const startCameraBtn = document.getElementById('startCameraBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');
const captureFrameBtn = document.getElementById('captureFrameBtn');
const resetAllBtn = document.getElementById('resetAllBtn');
const retakeBtn = document.getElementById('retakeBtn');
// const nextStageBtn = document.getElementById('nextStageBtn');

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async function() {
    // Safely get elements and check if they exist
    const elements = {
        uploadInput: document.getElementById('upload-image'),
        saveBtn: document.getElementById('saveBtn'),
        saveAllBtn: document.getElementById('saveAllBtn'),
        startCameraBtn: document.getElementById('startCameraBtn'),
        closeCameraBtn: document.getElementById('closeCameraBtn'),
        jobNoSelect: document.getElementById('job_no'),
        itemCodeSelect: document.getElementById('itemcode')
    };
    
 const requiredElements = ['uploadInput', 'saveBtn', 'saveAllBtn', 'jobNoSelect', 'itemCodeSelect'];
    const missingElements = requiredElements.filter(el => !elements[el]);
    
    if (missingElements.length > 0) {
        console.error('Missing required elements:', missingElements);
        showErrorToast('Failed to initialize application - missing elements');
        return;
    }

    // Add event listeners
    elements.uploadInput.addEventListener('change', handleImageUpload);
    elements.saveBtn.addEventListener('click', saveCurrentStage);
    elements.saveAllBtn.addEventListener('click', saveAllData);
    
    if (elements.startCameraBtn) {
        elements.startCameraBtn.addEventListener('click', opencamera);
    }
    if (elements.closeCameraBtn) {
        elements.closeCameraBtn.addEventListener('click', closecamera);
    }
    
    // Initialize other components
    initializeToastSystem();
    await loadJobNumbers();
    updateButtons();
    updateStageStatusCounts(); // Initial count update
    
    // Set up periodic refresh (every 30 seconds)
    setInterval(updateStageStatusCounts, 30000);
});

document.getElementById('saveBtn').addEventListener('click', saveCurrentStage);
document.getElementById('saveAllBtn').addEventListener('click', saveAllData);
// const Stage1_Upload = document.getElementById('upload-Stage1');
// const QC_Upload = document.getElementById('upload-QC');
// const WeighingUpload = document.getElementById('upload-Weighing');
// Auto-refresh every 30 seconds
setInterval(updateStageStatusCounts, 30000);

function updateButtons() {
    const saveBtn = document.getElementById('saveBtn');
    const saveAllBtn = document.getElementById('saveAllBtn');
    // const nextStageBtn = document.getElementById('nextStageBtn');
    const retakeBtn = document.getElementById('retakeBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const captureFrameBtn = document.getElementById('captureFrameBtn');

    // Hide all by default
    saveBtn.style.display = 'none';
    saveAllBtn.style.display = 'none';
    // nextStageBtn.style.display = 'none';
    retakeBtn.style.display = 'none';
    refreshBtn.style.display = 'none';
    captureFrameBtn.style.display = 'none';

    // Show buttons based on stage and state
    if (currentJobNo && currentItemCode) {
        if (stage === "Weighing") {
            saveAllBtn.style.display = 'inline-block';
        } else {
            saveBtn.style.display = 'inline-block';
            // nextStageBtn.style.display = capturedImages[stage] ? 'inline-block' : 'none';
        }
        
        retakeBtn.style.display = capturedImages[stage] ? 'inline-block' : 'none';
    }

    captureFrameBtn.style.display = !capturedImages[stage] ? 'inline-block' : 'none';
    refreshBtn.style.display = 'inline-block';
}

// Toast Notification System
function initializeToastSystem() {
    // Create toast container if it doesn't exist
    if (!document.getElementById('toast-container')) {
        const toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.position = 'fixed';
        toastContainer.style.top = '20px';
        toastContainer.style.right = '20px';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
}

function showLoadingToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast loading';
    toast.innerHTML = `
        <div class="spinner-border spinner-border-sm" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
        <span>${message}</span>
    `;
    document.getElementById('toast-container').appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
    
    return toast;
}

function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast success';
    toast.innerHTML = `
        <i class="bi bi-check-circle"></i>
        <span>${message}</span>
    `;
    document.getElementById('toast-container').appendChild(toast);
    
    setTimeout(() => toast.remove(), 3000);
}

function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.innerHTML = `
        <i class="bi bi-exclamation-circle"></i>
        <span>${message}</span>
    `;
    document.getElementById('toast-container').appendChild(toast);
    
    setTimeout(() => toast.remove(), 5000);
}

async function loadJobNumbers() {
    const jobSelect = document.getElementById('job_no');
    const itemSelect = document.getElementById('itemcode');
    
    try {
        // Reset state
        currentJobNo = null;
        currentItemCode = null;
        currentHuidNo = null;
        updateHuidDisplay();
        
        // Show loading state
        jobSelect.innerHTML = '<option value="">Loading...</option>';
        itemSelect.innerHTML = '<option value="">Select Job No first</option>';
        itemSelect.disabled = true;
        
        const response = await fetch(`/get_job_items?stage=${stage}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to load job numbers');
        }
        
        // Clear existing options
        jobSelect.innerHTML = '<option value="">-- Select Job No --</option>';
        
        // Populate job numbers
        const jobNumbers = Object.keys(data.data);
        if (jobNumbers.length === 0) {
            jobSelect.innerHTML = '<option value="">No pending items</option>';
            return;
        }
        
        jobNumbers.forEach(jobNo => {
            const option = document.createElement('option');
            option.value = jobNo;
            option.textContent = jobNo;
            jobSelect.appendChild(option);
        });
        
        // Initialize Select2 for job number
        $(jobSelect).select2({
            placeholder: "Select Job No",
            width: '100%'
        }).on('change', function() {
            currentJobNo = $(this).val();
            if (currentJobNo && data.data[currentJobNo]) {
                loadItemsForJob(currentJobNo, data.data[currentJobNo]);
            } else {
                $(itemSelect).val(null).trigger('change').prop('disabled', true);
                currentItemCode = null;
                currentHuidNo = null;
                updateHuidDisplay();
                updateButtons();
            }
        });
        
    } catch (error) {
        console.error('Failed to load job numbers:', error);
        jobSelect.innerHTML = `<option value="">Error: ${error.message}</option>`;
        showErrorToast(`Failed to load job numbers: ${error.message}`);
    }
}

async function loadItemsForJob(jobNo, items) {
    try {
        const itemSelect = document.getElementById('itemcode');
        
        // Clear existing options and reset state
        itemSelect.innerHTML = '<option value="">-- Select Item Code --</option>';
        currentItemCode = null;
        currentHuidNo = null;
        updateHuidDisplay();
        
        if (!items || items.length === 0) {
            itemSelect.innerHTML = '<option value="">No items for this job</option>';
            return;
        }
        
        // Populate items for selected job
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item.itemcode;
            option.textContent = item.itemcode;
            // Ensure we're setting the data attribute correctly
            if (item.huid_no) {
                option.setAttribute('data-huid', item.huid_no);
            }
            itemSelect.appendChild(option);
        });
        
        // Initialize Select2 and set up change handler
        $(itemSelect).select2({
            placeholder: "Select Item Code",
            width: '100%'
        }).prop('disabled', false).on('change', function() {
            const selectedOption = $(this).find('option:selected');
            currentItemCode = this.value;
            currentHuidNo = selectedOption.data('huid') || null;
            updateHuidDisplay();
            updateButtons();
        });
        
    } catch (error) {
        console.error('Failed to load items:', error);
        const itemSelect = document.getElementById('itemcode');
        itemSelect.innerHTML = '<option value="">Error loading items</option>';
        $(itemSelect).select2().prop('disabled', true);
    }
}

function updateHuidDisplay() {
    const actualHuidSpan = document.getElementById('actual_huid');
    if (!actualHuidSpan) {
        console.error('HUID display element not found');
        return;
    }
    
    if (currentHuidNo) {
        actualHuidSpan.textContent = currentHuidNo;
        actualHuidSpan.className = 'text-primary'
    } else {
        actualHuidSpan.textContent = '-';
        actualHuidSpan.className = 'badge bg-secondary bg-opacity-10 text-secondary';
    }
    
    // Special handling for QC stage
    if (stage === "QC") {
        const uniqueNumberSpan = document.getElementById('unique_number');
        if (uniqueNumberSpan) {
            if (!unique_number) {
                uniqueNumberSpan.textContent = "-";
                uniqueNumberSpan.className = 'text-primary';
            }
        }
    }
}

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        cameraSelect.innerHTML = "<option value=''>Select Camera</option>";
        videoDevices.forEach(cam => {
            let opt = new Option(cam.label || `Camera ${cameraSelect.length}`, cam.deviceId);
            cameraSelect.appendChild(opt);
        });
    } catch (e) {
        console.error(e);
        showErrorToast("Error accessing cameras");
    }
}

(async () => {
    let permission = localStorage.getItem("cameraPermission");
    if (permission === "granted") {
        await getCameras();
    } else {
        try {
            await navigator.mediaDevices.getUserMedia({ video: true });
            localStorage.setItem("cameraPermission", "granted");
            await getCameras();
        } catch (e) {
            showErrorToast("Camera permission denied");
        }
    }
})();

async function opencamera() {
    let id = cameraSelect.value;
    if (!id) return showWarningToast("Select camera first");
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: id }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        video.srcObject = stream;
        video.style.display = "block";
        document.getElementById('camera-placeholder').style.display = "none";
        document.getElementById('closeCameraBtn').style.display = "inline-block";
        document.getElementById('startCameraBtn').style.display = "none";

        // ✅ Show/Hide buttons
        startCameraBtn.style.display = "none";
        closeCameraBtn.style.display = "inline-block";

        updateButtons();
    } catch (e) {
        console.error(e);
        showErrorToast("Failed to open camera");
    }
}

function closecamera() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    video.style.display = "none";
    stream = null;
    document.getElementById('camera-placeholder').style.display = "block";
    document.getElementById('closeCameraBtn').style.display = "none";
    document.getElementById('startCameraBtn').style.display = "inline-block"; 

    // ✅ Show/Hide buttons
    startCameraBtn.style.display = "inline-block";
    closeCameraBtn.style.display = "none";

    updateButtons();
}


captureFrameBtn.addEventListener("click", () => {
    if (!video.srcObject) return showWarningToast("Camera not open");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => processCapturedBlob(blob), "image/jpeg");
});

function processCapturedBlob(blob) {
    const file = new File([blob], `${stage}_image.jpg`, { type: "image/jpeg" });
    capturedImages[stage] = file;
    capturedStages[stage] = true;

    currentPreview.src = URL.createObjectURL(blob);
    currentPreview.style.display = "block";
    noPreview.style.display = "none";

    // Update stage badge
    if (stage === "Stage1") {
        currentBadge.innerText = "Stage-1";
        currentBadge.className = "badge badge-before";
    } else if (stage === "QC") {
        currentBadge.innerText = "Stage-2 (QC)";
        currentBadge.className = "badge badge-after";
    } else if (stage === "Weighing") {
        currentBadge.innerText = "Stage-3 (Weighing)";
        currentBadge.className = "badge badge-weighing";
    }

    // Special handling for QC stage
    if (stage === "QC") {
        const loadingElement = document.getElementById('ocr-loading');
        const uniqueNumberSpan = document.getElementById('unique_number');
        const actualHuidSpan = document.getElementById('actual_huid');
        
        // Show loading state
        if (loadingElement) loadingElement.classList.remove('d-none');
        if (uniqueNumberSpan) {
            uniqueNumberSpan.textContent = "Processing...";
            uniqueNumberSpan.className = 'text-muted';
        }

        let fd = new FormData();
        fd.append("image", blob);
        if (currentJobNo) fd.append("job_no", currentJobNo);
        if (currentItemCode) fd.append("itemcode", currentItemCode);

        fetch("/ocr_QC", { 
            method: "POST", 
            body: fd 
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.unique_number) {
                unique_number = data.unique_number;
                uniqueNumberSpan.textContent = unique_number;
                
                // Update actual HUID display if available
                if (actualHuidSpan && data.expected_huid) {
                    actualHuidSpan.textContent = data.expected_huid;
                }

                // Show match result if validation data exists
                if (typeof data.is_valid !== 'undefined') {
                    if (data.is_valid) {
                        uniqueNumberSpan.className = 'badge bg-success text-white';
                        showMatchResult(true, unique_number, data.expected_huid);
                    } else {
                        uniqueNumberSpan.className = 'badge bg-danger text-white';
                        showMatchResult(false, unique_number, data.expected_huid);
                    }
                } else {
                    uniqueNumberSpan.className = 'badge bg-primary text-white';
                    showSuccessToast("HUID detected via OCR!");
                }
            } else {
                unique_number = null;
                uniqueNumberSpan.textContent = "❗ Not detected";
                uniqueNumberSpan.className = 'badge bg-danger text-white';
                showErrorToast(data.error || "OCR failed: Unique number not extracted.");
            }
        })
        .catch(e => {
            console.error("OCR Error:", e);
            if (uniqueNumberSpan) {
                uniqueNumberSpan.textContent = "Error";
                uniqueNumberSpan.className = 'badge bg-danger text-white';
            }
            showErrorToast("Error running OCR");
        })
        .finally(() => {
            if (loadingElement) loadingElement.classList.add('d-none');
        });
    } else {
        showSuccessToast(`Captured ${stage} image`);
    }

    updateButtons();
}

async function updateStageStatusCounts() {
    const pendingEl = document.getElementById('pending_count');
    const completedEl = document.getElementById('completed_count');
    const totalEl = document.getElementById('total_count'); // Optional: if you want to show total
    
    try {
        // Show loading state
        pendingEl.textContent = '...';
        completedEl.textContent = '...';
        if (totalEl) totalEl.textContent = '...';
        
        const response = await fetch(`/get_stage_status_summary?stage=${stage}`);
        const data = await response.json();
        
        if (data.success) {
            pendingEl.textContent = data.pending;
            completedEl.textContent = data.completed;
            if (totalEl) totalEl.textContent = data.total;
            
            // Update the stage label
            const stageLabel = document.getElementById('stage-label');
            if (stageLabel) {
                stageLabel.textContent = stage === 'Stage1' ? 'Stage-1' : 
                                       stage === 'QC' ? 'QC' : 'Weighing';
            }
        } else {
            pendingEl.textContent = '?';
            completedEl.textContent = '?';
            if (totalEl) totalEl.textContent = '?';
            console.error('Failed to get status counts:', data.error);
        }
    } catch (error) {
        pendingEl.textContent = '!';
        completedEl.textContent = '!';
        if (totalEl) totalEl.textContent = '!';
        console.error('Error fetching status counts:', error);
    }
}

function updateBadge() {
    if (stage === "Stage1") {
        currentBadge.innerText = "Stage-1";
        currentBadge.className = "badge badge-before";
    } else if (stage === "QC") {
        currentBadge.innerText = "Stage-2 (QC)";
        currentBadge.className = "badge badge-after";
    } else if (stage === "Weighing") {
        currentBadge.innerText = "Stage-3 (Weighing)";
        currentBadge.className = "badge badge-weighing";
    }

    stageLabel.innerText = stage;
    stageLabel.className = {
        "Stage1": "badge bg-primary",
        "QC": "badge bg-success",
        "Weighing": "badge bg-warning text-dark"
    }[stage];
}

function retake() {
    capturedImages[stage] = null;
    capturedStages[stage] = false;

    currentPreview.src = "";
    currentPreview.style.display = "none";
    noPreview.style.display = "block";
    captureFrameBtn.style.display = "inline-block";

    if (stage === "QC") {
        unique_number = null;
        const uniqueNumberSpan = document.getElementById('unique_number');
        uniqueNumberSpan.innerText = "-";
        uniqueNumberSpan.classList.remove('text-danger');
        uniqueNumberSpan.classList.add('text-primary');
    }

    showInfoToast("Retake current stage");
    updateButtons();
}

function resetAll() {
    capturedImages = { Stage1: null, QC: null, Weighing: null };
    capturedStages = { Stage1: false, QC: false, Weighing: false };
    stage = "Stage1";
    unique_number = null;

    currentPreview.src = "";
    currentPreview.style.display = "none";
    noPreview.style.display = "block";

    document.getElementById('unique_number').innerText = "-";
    updateBadge();
    updateButtons();
    showInfoToast("Reset done");
}

// Save current stage data
async function saveCurrentStage() {
    if (!currentJobNo || !currentItemCode) {
        showWarningToast("Please select Job No and Item Code");
        return;
    }

    try {
        const formData = new FormData();
        formData.append('stage', stage);
        formData.append('job_no', currentJobNo);
        formData.append('itemcode', currentItemCode);

        // Add image if captured/uploaded
        if (capturedImages[stage]) {
            formData.append('image', capturedImages[stage]);
        }

        // Add OCR HUID for QC stage
        if (stage === "QC") {
            const ocrHuid = document.getElementById('unique_number').textContent;
            if (ocrHuid === '-' || ocrHuid === '') {
                showWarningToast("Please capture OCR HUID first");
                return;
            }
            formData.append('ocr_huid', ocrHuid);
        }

        const response = await fetch('/save_stage_data', {
            method: 'POST',
            body: formData  // Note: Don't set Content-Type header, browser will do it
        });

        const data = await response.json();
        if (data.success) {
            showSuccessToast(data.message);
            updateStageStatusCounts();
        } else {
            showErrorToast(data.error || "Failed to save");
        }
    } catch (error) {
        showErrorToast("Error saving: " + error.message);
    }
}

// Save all completed data (for Weighing stage)
async function saveAllData() {
    if (!currentJobNo || !currentItemCode) {
        showWarningToast("Please select Job No and Item Code");
        return;
    }

    try {
        const formData = new FormData();
        formData.append('stage', stage);
        formData.append('job_no', currentJobNo);
        formData.append('itemcode', currentItemCode);

        // Add image if captured/uploaded
        if (capturedImages[stage]) {
            formData.append('image', capturedImages[stage]);
        }

        // First save the Weighing stage data
        const stage3Response = await fetch('/save_stage_data', {
            method: 'POST',
            body: formData
        });

        const stage3Data = await stage3Response.json();
        if (!stage3Data.success) {
            throw new Error(stage3Data.error || "Failed to save Weighing stage data");
        }

        // Then save to HuidCapture
        const response = await fetch('/save_all_completed', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                job_no: currentJobNo,
                itemcode: currentItemCode
            })
        });

        const data = await response.json();
        if (data.success) {
            showSuccessToast(data.message);
            resetAll();
        } else {
            throw new Error(data.error || "Failed to save all data");
        }
    } catch (error) {
        showErrorToast("Error saving all data: " + error.message);
    }
}

// Auto-check for completed records and save to HuidCapture
async function autoSaveCompletedRecords() {
    try {
        const response = await fetch('/check_completed_records');
        const data = await response.json();
        
        if (data.success && data.completed.length > 0) {
            // Save each completed record
            for (const record of data.completed) {
                const saveResponse = await fetch('/save_all_completed', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(record)
                });
                
                const saveData = await saveResponse.json();
                if (saveData.success) {
                    console.log(`Auto-saved: ${record.job_no} - ${record.itemcode}`);
                }
            }
        }
    } catch (error) {
        console.error("Auto-save error:", error);
    }
}

// Set up auto-save every 50 seconds
setInterval(autoSaveCompletedRecords, 50000);
function showSuccessToast(msg) { Swal.fire({ position: 'top-end', toast: true, icon: 'success', title: msg, showConfirmButton: false, timer: 1500, background: '#2ecc71', color: '#fff' }); }
function showErrorToast(msg) { Swal.fire({ position: 'top-end', toast: true, icon: 'error', title: msg, showConfirmButton: false, timer: 2000, background: '#e74c3c', color: '#fff' }); }
function showWarningToast(msg) { Swal.fire({ position: 'top-end', toast: true, icon: 'warning', title: msg, showConfirmButton: false, timer: 2000, background: '#f39c12', color: '#fff' }); }
function showInfoToast(msg) { Swal.fire({ position: 'top-end', toast: true, icon: 'info', title: msg, showConfirmButton: false, timer: 2000, background: '#3498db', color: '#fff' }); }

startCameraBtn.addEventListener("click", opencamera);
closeCameraBtn.addEventListener("click", closecamera);
retakeBtn.addEventListener("click", retake);
// nextStageBtn.addEventListener("click", nextStage);
resetAllBtn.addEventListener("click", resetAll);
saveAllBtn.addEventListener("click", saveAll);

updateButtons();


function selectStage(selectedStage) {
    // Reset all relevant state variables
    currentJobNo = null;
    currentItemCode = null;
    currentHuidNo = null;
    
    // Clear dropdowns
    document.getElementById('job_no').value = '';
    document.getElementById('itemcode').value = '';
    document.getElementById('itemcode').disabled = true;
    
    // Clear HUID display
    document.getElementById('actual_huid').textContent = '-';
    
    // Clear preview if switching stages
    if (stage !== selectedStage) {
        currentPreview.src = "";
        currentPreview.style.display = "none";
        noPreview.style.display = "block";
    }
    
    // Update stage
    stage = selectedStage;
    
    // Update UI
    updateBadge();
    updateButtons();
    loadJobNumbers();
    
    // Show existing image if already captured for this stage
    if (capturedImages[stage]) {
        currentPreview.src = URL.createObjectURL(capturedImages[stage]);
        currentPreview.style.display = "block";
        noPreview.style.display = "none";
    }
    
    // Reset OCR display for QC stage
    if (stage === "QC") {
        const uniqueNumberSpan = document.getElementById('unique_number');
        uniqueNumberSpan.textContent = "-";
        uniqueNumberSpan.className = 'text-primary';
        unique_number = null;
    }
    
    updateStageStatusCounts();
    showInfoToast(`Switched to ${selectedStage}`);
}
//upload button functionality for each stage

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset file input to allow re-uploading same file
    event.target.value = '';

    
    // Store image for current stage
    capturedImages[stage] = file;
    capturedStages[stage] = true;
    const reader = new FileReader();
    reader.onload = async function (e) {
        // Set preview image
        currentPreview.src = e.target.result;
        currentPreview.style.display = "block";
        noPreview.style.display = "none";

        // Update UI
        updateBadge();
        retakeBtn.style.display = "inline-block";
        captureFrameBtn.style.display = "none";
        updateButtons();

        // Process image based on stage
        if (stage === "QC") {
            await processQCImage(file);
        } else {
            showSuccessToast(`Uploaded image for ${stage}`);
        }
    };
    reader.readAsDataURL(file);
}

async function processQCImage(file) {
    // Show loading indicator
    const loadingElement = document.getElementById('ocr-loading');
    const uniqueNumberSpan = document.getElementById('unique_number');
    const actualHuidSpan = document.getElementById('actual_huid');
    
    if (loadingElement) loadingElement.classList.remove('d-none');
    if (uniqueNumberSpan) {
        uniqueNumberSpan.textContent = "Processing...";
        uniqueNumberSpan.className = 'text-muted';
    }
    
    try {
        const fd = new FormData();
        fd.append("image", file);
        fd.append("job_no", currentJobNo);
        fd.append("itemcode", currentItemCode);

        const response = await fetch("/ocr_QC", {
            method: "POST",
            body: fd
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!uniqueNumberSpan) {
            throw new Error("Unique number span element not found");
        }
        
        if (data.success && data.unique_number) {
            unique_number = data.unique_number;
            uniqueNumberSpan.textContent = unique_number;
            
            // Update actual HUID display
            if (actualHuidSpan) {
                actualHuidSpan.textContent = data.expected_huid || "N/A";
            }
            
            // Show match result modal
            if (data.is_valid !== undefined) {
                if (data.is_valid) {
                    uniqueNumberSpan.className = 'badge bg-success text-white';
                    showMatchResult(true, unique_number, data.expected_huid);
                } else {
                    uniqueNumberSpan.className = 'badge bg-danger text-white';
                    showMatchResult(false, unique_number, data.expected_huid);
                }
            } else {
                uniqueNumberSpan.className = 'badge bg-primary text-white';
                showSuccessToast("HUID detected via OCR!");
            }
            
            await saveOCRResult(data.unique_number);
        } else {
            unique_number = null;
            uniqueNumberSpan.textContent = "❗ Not detected";
            uniqueNumberSpan.className = 'badge bg-danger text-white';
            
            if (showErrorToast) {
                showErrorToast(data.error || "OCR failed");
            }
        }
    } catch (error) {
        console.error("OCR Error:", error);
        if (uniqueNumberSpan) {
            uniqueNumberSpan.textContent = "Error";
            uniqueNumberSpan.className = 'badge bg-danger text-white';
        }
        if (showErrorToast) {
            showErrorToast("OCR processing failed");
        }
    } finally {
        // Hide loading indicator
        if (loadingElement) loadingElement.classList.add('d-none');
    }
}

// New function to show match result modal
function showMatchResult(isMatch, detectedHUID, expectedHUID) {
    if (isMatch) {
        Swal.fire({
            title: 'Match Confirmed!',
            html: `
                <div style="text-align: left; margin-top: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong>Detected HUID:</strong>
                        <span style="font-family: monospace;">${detectedHUID}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <strong>Expected HUID:</strong>
                        <span style="font-family: monospace;">${expectedHUID}</span>
                    </div>
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'Continue',
            confirmButtonColor: '#198754',
            backdrop: `
                rgba(25,135,84,0.2)
                url("/static/images/checkmark.gif")
                center top
                no-repeat
            `,
            customClass: {
                popup: 'swal-wide'
            }
        });
    } else {
        Swal.fire({
            title: 'Mismatch Detected!',
            html: `
                <div style="text-align: left; margin-top: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <strong>Detected HUID:</strong>
                        <span style="font-family: monospace; color: #dc3545;">${detectedHUID}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <strong>Expected HUID:</strong>
                        <span style="font-family: monospace; color: #198754;">${expectedHUID}</span>
                    </div>
                </div>
                <div style="margin-top: 20px; color: #dc3545; font-weight: bold;">
                    Please verify the item and try again.
                </div>
            `,
            icon: 'error',
            confirmButtonText: 'Retry',
            confirmButtonColor: '#dc3545',
            showCancelButton: true,
            cancelButtonText: 'Cancel',
            backdrop: `
                rgba(220,53,69,0.2)
                url("/static/images/warning.gif")
                center top
                no-repeat
            `,
            customClass: {
                popup: 'swal-wide'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // Trigger retake action
                document.getElementById('retakeBtn').click();
            }
        });
    }
}

async function saveOCRResult(ocrHuid) {
    try {
        const formData = new FormData();
        formData.append('stage', stage);
        formData.append('job_no', currentJobNo);
        formData.append('itemcode', currentItemCode);
        formData.append('ocr_huid', ocrHuid);
        // Add image if captured/uploaded
        if (capturedImages[stage]) {
            formData.append('image', capturedImages[stage]);
        }

        const response = await fetch('/save_stage_data', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (!data.success) {
            console.error("Failed to save OCR result:", data.error);
        }
    } catch (error) {
        console.error("Error saving OCR result:", error);
    }
}

// Initialize everything when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function initApp() {
    initializeToastSystem();
    
    // Set default stage if not set
    if (!stage) stage = "Stage1";
    
    // Initialize event listeners
    setupEventListeners();
    
    // Load initial data
    loadJobNumbers();
    updateButtons();
    updateStageStatusCounts();
}

function setupEventListeners() {
    const elements = {
        'upload-image': handleImageUpload,
        'saveBtn': saveCurrentStage,
        'saveAllBtn': saveAllData,
        'retakeBtn': retake,
        // 'nextStageBtn': nextStage,
        'resetAllBtn': resetAll
    };
    
    Object.entries(elements).forEach(([id, handler]) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', handler);
        } else {
            console.warn(`Element #${id} not found for event listener`);
        }
    });
}
const elements = {
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('audio'),
    idleView: document.getElementById('idleView'),
    fileView: document.getElementById('fileView'),
    fileName: document.getElementById('fileName'),
    removeBtn: document.getElementById('removeBtn'),
    scanBtn: document.getElementById('scanBtn'),
    form: document.getElementById('uploadForm'),
    audioPreview: document.getElementById('audioPreview'),
    canvas: document.getElementById('visualizer'),
    scanOverlay: document.getElementById('scanOverlay'),
    terminalFeed: document.getElementById('terminalFeed'),
    resultModal: document.getElementById('resultModal'),
    closeModal: document.getElementById('closeModal'),
    progressCircle: document.getElementById('progressCircle'),
    confidenceVal: document.getElementById('confidenceVal'),
    verdictTitle: document.getElementById('verdictTitle'),
    verdictDesc: document.getElementById('verdictDesc'),
    integrityVal: document.getElementById('integrityVal'),
    typeVal: document.getElementById('typeVal'),
    scoreLabel: document.getElementById('scoreLabel'),
    dataRow: document.getElementById('dataRow')
};

let audioContext, analyser, source, animationId;

/* --- UI Interactions --- */

// Drag & Drop Handling
elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!elements.dropZone.classList.contains('active-ui')) {
        elements.dropZone.style.borderColor = 'var(--accent)';
        elements.dropZone.style.background = 'rgba(6, 182, 212, 0.1)';
    }
});

elements.dropZone.addEventListener('dragleave', () => {
    if (!elements.dropZone.classList.contains('active-ui')) {
        elements.dropZone.style.borderColor = 'var(--glass-border)';
        elements.dropZone.style.background = 'rgba(0,0,0,0.3)';
    }
});

elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.style.borderColor = 'var(--glass-border)';
    elements.dropZone.style.background = 'rgba(0,0,0,0.3)';
    
    if (e.dataTransfer.files.length) {
        elements.fileInput.files = e.dataTransfer.files;
        handleFile(e.dataTransfer.files[0]);
    }
});

elements.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

function handleFile(file) {
    if (!file.type.startsWith('audio/')) {
        alert("Please upload a valid audio file (MP3/WAV).");
        return;
    }

    elements.fileName.textContent = file.name.length > 25 ? file.name.substring(0, 25) + "..." : file.name;
    const url = URL.createObjectURL(file);
    elements.audioPreview.src = url;

    // Switch Views
    elements.idleView.classList.add('hidden');
    elements.fileView.classList.remove('hidden');
    elements.dropZone.classList.add('active-ui');
    elements.scanBtn.disabled = false;

    initVisualizer();
}

elements.removeBtn.addEventListener('click', (e) => {
    e.preventDefault(); 
    e.stopPropagation();

    elements.fileInput.value = "";
    elements.idleView.classList.remove('hidden');
    elements.fileView.classList.add('hidden');
    elements.dropZone.classList.remove('active-ui');
    elements.scanBtn.disabled = true;
    
    // Stop Audio & Clean up
    elements.audioPreview.pause();
    elements.audioPreview.src = "";
    if (animationId) cancelAnimationFrame(animationId);
    if (audioContext && audioContext.state !== 'closed') audioContext.suspend();
});

/* --- Audio Visualizer --- */
function initVisualizer() {
    // Resume or Create Context
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
    } 
    
    // Reconnect source if it exists or create new one
    if (source) {
        source.disconnect();
    }
    
    source = audioContext.createMediaElementSource(elements.audioPreview);
    source.connect(analyser);
    analyser.connect(audioContext.destination);

    // Start Drawing
    if (animationId) cancelAnimationFrame(animationId);
    draw();
}

function draw() {
    const ctx = elements.canvas.getContext('2d');
    const width = elements.canvas.width;
    const height = elements.canvas.height;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    animationId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, width, height);

    const barWidth = (width / dataArray.length) * 2;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
        const barHeight = dataArray[i] / 2.5; // Adjusted scaling

        // Cyberpunk Gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#06b6d4');
        gradient.addColorStop(1, '#7c3aed');
        ctx.fillStyle = gradient;

        // Draw Centered Bar
        const centerY = height / 2;
        ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);

        x += barWidth;
    }
}

/* --- Scanning & Backend Logic --- */
elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Browser Policy: Resume AudioContext on user gesture
    if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    // 1. Activate Overlay
    elements.scanOverlay.classList.remove('hidden');
    elements.terminalFeed.innerHTML = "";
    elements.scanBtn.disabled = true;

    // 2. Terminal Simulation
    const logs = [
        "INITIALIZING SPECTRAL ENGINE...",
        "LOADING AUDIO BUFFER...",
        "EXTRACTING MFCC FEATURES...",
        "ANALYZING PITCH CONSISTENCY...",
        "DETECTING COMPRESSION ARTIFACTS...",
        "ESTABLISHING SERVER UPLINK..."
    ];

    for (const log of logs) {
        const p = document.createElement('div');
        p.className = 'log-line';
        p.innerText = `> ${log}`;
        elements.terminalFeed.appendChild(p);
        elements.terminalFeed.scrollTop = elements.terminalFeed.scrollHeight;
        await new Promise(r => setTimeout(r, 350));
    }

    // 3. Backend Call with Error Handling
    const formData = new FormData();
    formData.append("audio", elements.fileInput.files[0]);
    formData.append("language", document.getElementById("language").value);

    // Create a timeout for the fetch (5 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch("http://127.0.0.1:8000/detect", {
            method: "POST",
            body: formData,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Server Error: ${response.status}`);
        }

        const data = await response.json();
        elements.scanOverlay.classList.add('hidden');
        showResult(data);

    } catch (err) {
        clearTimeout(timeoutId);
        elements.scanOverlay.classList.add('hidden');
        
        // This answers your specific request:
        // IF BACKEND IS NOT CONNECTED -> SHOW ERROR MSG
        showError("SYSTEM OFFLINE", "Connection to Neural Engine refused. Ensure backend is running at port 8000.");
    }
});

function showResult(data) {
    elements.resultModal.classList.remove('hidden');
    elements.dataRow.style.display = 'flex'; // Show details

    const confidence = Math.round(data.confidence_score * 100);
    const isReal = data.classification.toLowerCase() === "real";

    // Colors
    const color = isReal ? "#10b981" : "#f43f5e";
    const integrity = isReal ? "High" : "Compromised";
    const type = isReal ? "Human Voice" : "Synthetic/AI";

    updateCircle(confidence, color);

    // Update Text
    elements.confidenceVal.innerText = `${confidence}%`;
    elements.confidenceVal.style.color = color;
    elements.scoreLabel.innerText = "CONFIDENCE";

    elements.verdictTitle.innerText = isReal ? "AUTHENTIC" : "FAKE DETECTED";
    elements.verdictTitle.style.color = color;
    elements.verdictDesc.innerText = isReal ?
        "No synthetic artifacts detected. Voiceprint matches organic patterns." :
        "High frequency anomalies detected. Voiceprint matches AI generation.";

    elements.integrityVal.innerText = integrity;
    elements.integrityVal.style.color = color;
    elements.typeVal.innerText = type;
}

function showError(title, message) {
    elements.resultModal.classList.remove('hidden');
    elements.dataRow.style.display = 'none'; // Hide details for error

    const color = "#f59e0b"; // Warning Orange

    // Set Circle to 0% or Error State
    updateCircle(0, color);

    elements.confidenceVal.innerText = "ERR";
    elements.confidenceVal.style.color = color;
    elements.scoreLabel.innerText = "STATUS";

    elements.verdictTitle.innerText = title;
    elements.verdictTitle.style.color = color;
    elements.verdictDesc.innerText = message;
}

function updateCircle(percentage, color) {
    const radius = elements.progressCircle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    elements.progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    elements.progressCircle.style.strokeDashoffset = circumference;
    elements.progressCircle.style.stroke = color;

    // Trigger animation
    setTimeout(() => {
        const offset = circumference - (percentage / 100) * circumference;
        elements.progressCircle.style.strokeDashoffset = offset;
    }, 100);
}

elements.closeModal.addEventListener('click', () => {
    elements.resultModal.classList.add('hidden');
    elements.scanBtn.disabled = false;
});
// Prevent duplicate widget
if (!window.voiceScribeWidgetLoaded) {
    window.voiceScribeWidgetLoaded = true;

    // Create floating widget
    const widget = document.createElement('div');
    widget.style.position = 'fixed';
    widget.style.bottom = '30px';
    widget.style.right = '30px';
    widget.style.zIndex = '99999';
    widget.style.background = '#fff';
    widget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.15)';
    widget.style.padding = '20px';
    widget.style.borderRadius = '16px';
    widget.style.fontFamily = 'sans-serif';
    widget.style.left = '';
    widget.style.top = '';
    widget.style.minWidth = '260px';

    widget.innerHTML = `
        <div id="vs-header" style="width:100%;cursor:move;display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="font-weight:600;color:#4f46e5;font-size:16px;">VoiceScribe</span>
            <button id="vs-minimize" style="background:none;border:none;font-size:20px;cursor:pointer;line-height:1;">−</button>
        </div>
        <div id="vs-body">
            <button id="vs-rec-btn" style="background:#4f46e5;color:white;border:none;padding:10px 22px;border-radius:10px;font-size:16px;cursor:pointer;">
                Start Recording
            </button>
            <button id="vs-stop-btn" style="display:none;margin-top:12px;background:#b91c1c;color:white;border:none;padding:10px 22px;border-radius:10px;font-size:16px;cursor:pointer;">
                Stop Recording
            </button>
            <a id="vs-download" style="display:none;margin-top:12px;color:#2563eb;font-size:15px;" download="voicescribe-recording.mp3">Download Audio</a>
        </div>
    `;

    document.body.appendChild(widget);

    // Drag logic
    const header = widget.querySelector('#vs-header');
    const minimizeBtn = widget.querySelector('#vs-minimize');
    const body = widget.querySelector('#vs-body');
    let minimized = false;

    minimizeBtn.onclick = function () {
        minimized = !minimized;
        body.style.display = minimized ? 'none' : '';
        this.textContent = minimized ? '+' : '−';
    };

    let offsetX, offsetY, isDragging = false;

    header.onmousedown = function (e) {
        isDragging = true;
        offsetX = e.clientX - widget.getBoundingClientRect().left;
        offsetY = e.clientY - widget.getBoundingClientRect().top;
        document.body.style.userSelect = "none";
    };
    document.onmousemove = function (e) {
        if (isDragging) {
            widget.style.left = (e.clientX - offsetX) + "px";
            widget.style.top = (e.clientY - offsetY) + "px";
            widget.style.right = "";
            widget.style.bottom = "";
            widget.style.position = "fixed";
        }
    };
    document.onmouseup = function () {
        isDragging = false;
        document.body.style.userSelect = "";
    };

    // Recording logic
    let mediaRecorder, audioChunks = [];

    document.getElementById('vs-rec-btn').onclick = async function () {
        audioChunks = [];
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new window.MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const link = document.getElementById('vs-download');
            link.href = url;
            link.style.display = '';
        };

        mediaRecorder.start();
        this.style.display = 'none';
        document.getElementById('vs-stop-btn').style.display = '';
        document.getElementById('vs-download').style.display = 'none';
    };

    document.getElementById('vs-stop-btn').onclick = function () {
        mediaRecorder.stop();
        this.style.display = 'none';
        document.getElementById('vs-rec-btn').style.display = '';
    };
}

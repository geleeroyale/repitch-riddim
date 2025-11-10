const dropZone = document.getElementById('drop_zone');
const fileInput = document.getElementById('fileInput');
const selectButton = document.getElementById('selectButton');
const processButton = document.getElementById('processButton');
const fileStatus = document.getElementById('fileStatus');
const outputAudio = document.getElementById('outputAudio');
const ko2Form = document.getElementById('ko2Form');
const ko2FormToggle = document.getElementById('ko2FormToggle');
const ko2FormFieldset = document.getElementById('ko2FormFieldset');
const rangeInputs = document.querySelectorAll('input[type="range"]');
const rootnoteInput = document.getElementById('sound.rootnote');
const rootnootOutput = document.querySelector(`output[for="sound.rootnote"]`);
const manualBpmInput = document.getElementById('manualBpm');
let fileName;
let selectedFiles = [];

const NOTE_MAP = {};
const NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

for (let i = 0; i < 12; i++) {
    NOTE_MAP[i] = `N${i + 1}`;
}

function ensureWavExtension(name) {
    if (!name) {
        return 'processed.wav';
    }

    const dotIndex = name.lastIndexOf('.');
    if (dotIndex === -1) {
        return `${name}.wav`;
    }

    const base = name.slice(0, dotIndex);
    const ext = name.slice(dotIndex + 1);
    if (ext.toLowerCase() === 'wav') {
        return name;
    }

    return `${base}.wav`;
}
for (let i = 12; i < 128; i++) {
    const note = NOTES[(i - 12) % NOTES.length];
    const octave = Math.floor((i - 12) / NOTES.length);
    NOTE_MAP[i] = `${note}${octave}`;
}

// Event listeners
if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleFileDrop);
}

fileInput.addEventListener('change', handleFileSelect);

if (selectButton) {
    selectButton.addEventListener('click', () => fileInput.click());
}

if (processButton) {
    processButton.addEventListener('click', () => processSelectedFiles());
}

updateProcessingControls();
updateFileStatus('No files selected.');
ko2FormToggle.addEventListener('change', handleKO2FormState);
rangeInputs.forEach(input => input.addEventListener('input', handleRangeOutput));
rangeInputs.forEach(input => handleRangeOutput({ currentTarget: input }))
rootnoteInput.addEventListener('input', handleRootnoteOutput);
handleRootnoteOutput();

function handleRangeOutput({ currentTarget }) {
    const id = currentTarget.id;
    const outputElement = document.querySelector(`output[for="${id}"]`);
    if (outputElement) {
        outputElement.value = currentTarget.value;
    }
}

function handleRootnoteOutput() {
    rootnootOutput.value = NOTE_MAP[rootnoteInput.value];
}

function handleKO2FormState() {
    ko2FormFieldset.toggleAttribute('disabled');
}

function handleDragOver(event) {
    event.preventDefault();
    dropZone.classList.add('dragover');
}

function handleDragLeave(event) {
    event.preventDefault();
    dropZone.classList.remove('dragover');
}

function handleFileDrop(event) {
    event.preventDefault();
    dropZone.classList.remove('dragover');
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        prepareSelectedFiles(files);
    }
}

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        prepareSelectedFiles(files);
    }
    event.target.value = '';
}


function prepareSelectedFiles(files) {
    selectedFiles = Array.from(files);

    if (!selectedFiles.length) {
        updateFileStatus('No files selected.');
        updateProcessingControls();
        return;
    }

    const summary = formatSelectedFilesSummary(selectedFiles);
    updateFileStatus(`Selected ${summary}`);
    updateProcessingControls();
}

function formatSelectedFilesSummary(files) {
    if (files.length === 1) {
        return files[0].name;
    }

    const maxList = 3;
    const names = files.slice(0, maxList).map(file => file.name);
    const remaining = files.length - names.length;
    return remaining > 0 ? `${files.length} files (${names.join(', ')}${remaining > 0 ? `, +${remaining} more` : ''})` : `${files.length} files (${names.join(', ')})`;
}

function updateProcessingControls(isProcessing = false) {
    if (processButton) {
        processButton.disabled = isProcessing || selectedFiles.length === 0;
    }
    if (selectButton) {
        selectButton.disabled = isProcessing;
    }
}

function updateFileStatus(message) {
    if (fileStatus) {
        fileStatus.textContent = message;
    }
}


function getSelectedRadioValue(name) {
    const selectedRadio = document.querySelector(`input[name="${name}"]:checked`);
    return selectedRadio ? selectedRadio.value : null;
}

function getSampleRate(fidelity) {
    switch (fidelity) {
        case 'SP-1200':
            return 26000;
        case 'SP-1201':
            return 26000;
        case 'EP-40':
            return 22000;
        case 'SK-1':
            return 9000;
        default:
            return 46000;
    }
}

function getBitDepth(fidelity) {
    switch (fidelity) {
        case 'SP-1200':
            return 8;
        case 'SP-1201':
            return 16;
        case 'EP-40':
            return 16;
        case 'SK-1':
            return 8;
        default:
            return 16;
    }
}

function getSpeedFactor(speed) {
    switch (speed) {
        case '2x':
            return 2;
        case '4x':
            return 4;
        default:
            return 1;
    }
}

function getKO2Buffer() {
    const data = new FormData(ko2Form);
    const settings = {};
    for (const [key, value] of data.entries()) {
        // number values must be integers
        settings[key] = /^-?\d+$/.test(value) ? parseInt(value, 10) : value;
    }
    // If the form is disabled we want to return an empty buffer
    // to skip adding the headers.
    const settingsStringified = JSON.stringify(settings);
    const ko2Settings = settingsStringified !== "{}" ? settingsStringified : ``;
    const textEncoder = new TextEncoder();
    let encoded = textEncoder.encode(ko2Settings);

    if (encoded.length) {
        const withNullTerminator = new Uint8Array(encoded.length + 1);
        withNullTerminator.set(encoded, 0);
        encoded = withNullTerminator;
    }

    return encoded;
}

function extractBpmAndKey(fileName) {
    // Extract BPM as the last number in the file name between 55 and 190
    const bpmMatch = fileName.match(/(\d+)(?!.*\d)/);
    const bpm = bpmMatch ? parseInt(bpmMatch[0]) : 'Unknown';

    // Check if BPM is within the valid range (55 to 190)
    const validBpm = bpm >= 55 && bpm <= 190 ? bpm : 'Unknown';

    const keyMatch = fileName.match(/\b([A-G][#b]?m?)\b/i);
    const key = keyMatch ? keyMatch[1] : 'Unknown';

    return {
        bpm: validBpm,
        key
    };
}

async function processSelectedFiles() {
    if (!selectedFiles.length) {
        alert('Please select audio files before processing.');
        return;
    }

    updateProcessingControls(true);
    updateFileStatus('Processing...');

    const downloadMode = getSelectedRadioValue('download.mode') || 'auto';
    const shouldZip = downloadMode === 'zip' || (downloadMode === 'auto' && selectedFiles.length > 1);

    try {
        if (shouldZip) {
            const zip = new JSZip();
            for (let i = 0; i < selectedFiles.length; i++) {
                updateFileStatus(`Processing ${i + 1}/${selectedFiles.length} files...`);
                const processedFile = await processAudio(selectedFiles[i]);
                zip.file(processedFile.name, processedFile.blob);
                updateFileStatus(`Processed ${i + 1}/${selectedFiles.length} files...`);
            }
            updateFileStatus('Preparing ZIP...');
            const content = await zip.generateAsync({ type: 'blob' });
            downloadFile(content, selectedFiles.length > 1 ? 'processed_files.zip' : 'processed_file.zip');
            updateFileStatus(`Processed ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} (downloaded as ZIP).`);
        } else {
            for (let i = 0; i < selectedFiles.length; i++) {
                const processedFile = await processAudio(selectedFiles[i]);
                downloadFile(processedFile.blob, processedFile.name);

                if (selectedFiles.length === 1) {
                    updateFileStatus(`Processed: ${processedFile.name}`);
                } else {
                    updateFileStatus(`Processed ${i + 1}/${selectedFiles.length} files...`);
                }
            }

            if (selectedFiles.length > 1) {
                updateFileStatus(`Processed ${selectedFiles.length} files (downloaded individually).`);
            }
        }
    } catch (error) {
        console.error(error);
        const message = error && error.message ? error.message : 'An unexpected error occurred while processing.';
        updateFileStatus(message);
        alert(message);
        return;
    } finally {
        updateProcessingControls(false);
    }
}

function downloadFile(blob, fileName) {
    saveAs(blob, fileName);
}

async function processAudio(file) {
    let getSpeedButton = getSelectedRadioValue("speed");
    let getFidelityButton = getSelectedRadioValue("fidelity");
    let channelNr = getSelectedRadioValue("channels");
    let speedVal = getSpeedFactor(getSpeedButton);
    let sRateVal = getSampleRate(getFidelityButton);
    let bitVal = getBitDepth(getFidelityButton);
    let ko2Buffer = getKO2Buffer();
    console.log(`Speed: ${speedVal} Rate: ${sRateVal} BD: ${bitVal} Channel: ${channelNr} BufferLength: ${ko2Buffer.length}`);

    if (!file) {
        alert('Please select files.');
        return;
    }

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onload = async function (event) {
            try {
                const audioBuffer = event.target.result;
                const buffer = await audioContext.decodeAudioData(audioBuffer);

                if (buffer.duration >= 30) {
                    alert('Please upload an audio file less than 30 seconds long.');
                    reject('File too long');
                    return;
                }

                fileName = file.name;
                console.log(`Processing file: ${fileName}`);
                const { bpm, key } = extractBpmAndKey(fileName);
                console.log(`Extracted BPM: ${bpm}, Key: ${key}`);

                const renameSelection = getSelectedRadioValue("filename") === "true";
                let manualBpm = null;
                if (renameSelection) {
                    manualBpm = getManualBpmValue();
                }
                const resolvedBpm = manualBpm !== null ? manualBpm : bpm;
                const resolvedKey = key || 'Unknown';
                let outputName = file.name;

                if (renameSelection) {
                    const bpmLabel = resolvedBpm !== 'Unknown' ? resolvedBpm : 'Unknown';
                    const keyLabel = resolvedKey !== 'Unknown' ? resolvedKey : 'Unknown';
                    outputName = sanitizeFileName(`${bpmLabel} ${keyLabel}.wav`);
                } else {
                    outputName = sanitizeFileName(outputName);
                }

                outputName = ensureWavExtension(outputName);

                const channelData = [];
                let x = speedVal;
                const length = Math.floor(buffer.length / x);
                let newBuffer;

                if (channelNr === '1' && buffer.numberOfChannels === 2) { // Mono
                    const monoData = new Float32Array(length);
                    for (let j = 0; j < length; j++) {
                        monoData[j] = (buffer.getChannelData(0)[j * x] + buffer.getChannelData(1)[j * x]) / 2;
                    }
                    newBuffer = audioContext.createBuffer(1, length, buffer.sampleRate);
                    newBuffer.copyToChannel(monoData, 0);
                } else { // Stereo
                    for (let i = 0; i < buffer.numberOfChannels; i++) {
                        const inputData = buffer.getChannelData(i);
                        const newData = new Float32Array(length);
                        for (let j = 0; j < length; j++) {
                            newData[j] = inputData[j * x];
                        }
                        channelData.push(newData);
                    }
                    newBuffer = audioContext.createBuffer(buffer.numberOfChannels, length, buffer.sampleRate);
                    for (let i = 0; i < buffer.numberOfChannels; i++) {
                        newBuffer.copyToChannel(channelData[i], i);
                    }
                }

                const resampledBuffer = resampleBuffer(newBuffer, buffer.sampleRate, sRateVal);
                const modifiedBuffer = quantizeBuffer(resampledBuffer, bitVal, audioContext);
                const audioBlob = await encodeResampledAudio(modifiedBuffer, bitVal, ko2Buffer);

                resolve({ blob: audioBlob, name: outputName });
            } catch (error) {
                reject(error);
            }
        };

        reader.readAsArrayBuffer(file);
    });
}

function getManualBpmValue() {
    if (!manualBpmInput) {
        return null;
    }

    const value = manualBpmInput.value.trim();
    if (value === '') {
        return null;
    }

    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
        throw new Error('Manual BPM must be a whole number.');
    }

    if (parsed < 40 || parsed > 300) {
        throw new Error('Manual BPM must be between 40 and 300.');
    }

    return parsed;
}

function sanitizeFileName(name) {
    const sanitized = name
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();

    if (!sanitized) {
        return 'processed.wav';
    }

    return sanitized.toLowerCase().endsWith('.wav') ? sanitized : `${sanitized}.wav`;
}

function resampleBuffer(buffer, sampleRate, newSampleRate) {
    const audioContext = new(window.AudioContext || window.webkitAudioContext)();
    const newLength = Math.floor(buffer.length * newSampleRate / sampleRate);
    const newBuffer = audioContext.createBuffer(buffer.numberOfChannels, newLength, newSampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const inputData = buffer.getChannelData(channel);
        const outputData = newBuffer.getChannelData(channel);

        for (let i = 0; i < newLength; i++) {
            const ratio = i * sampleRate / newSampleRate;
            const index = Math.floor(ratio);
            const nextIndex = Math.min(index + 1, inputData.length - 1);
            const frac = ratio - index;

            const currentSample = inputData[Math.min(index, inputData.length - 1)];
            const nextSample = inputData[nextIndex];

            outputData[i] = currentSample * (1 - frac) + nextSample * frac;
        }
    }

    return newBuffer;
}

function quantizeBuffer(buffer, bitDepth, audioContext) {
    const maxValue = Math.pow(2, bitDepth) - 1;
    const newBuffer = audioContext.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const inputData = buffer.getChannelData(channel);
        const outputData = newBuffer.getChannelData(channel);

        for (let i = 0; i < buffer.length; i++) {
            const quantizedValue = Math.round(inputData[i] * maxValue) / maxValue;
            outputData[i] = quantizedValue;
        }
    }

    return newBuffer;
}

async function encodeResampledAudio(buffer, bitDepth, ko2Buffer) {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.length;

    const wavBuffer = audioBufferToWav(buffer, bitDepth, ko2Buffer);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    return blob;
}

function audioBufferToWav(buffer, bitDepth, ko2Buffer) {
    const ko2BufferSize = ko2Buffer.length;
    const ko2BufferPadding = ko2BufferSize % 2;
    const smplSize = 0;
    const listHeaderSize = ko2BufferSize !== 0 ? 12 : 0; // size for LIST chunk header and INFO type
    const infoChunkHeaderSize = ko2BufferSize !== 0 ? 8 : 0; // TNGE header + size
    const listSize = listHeaderSize + infoChunkHeaderSize;

    const numOfChannels = buffer.numberOfChannels;
    const dataSize = buffer.length * numOfChannels * (bitDepth / 8)
    const length = smplSize + listSize + ko2BufferSize + ko2BufferPadding  + dataSize + 44;

    const result = new ArrayBuffer(length);
    const view = new DataView(result);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // Write WAV header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChannels);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * (bitDepth / 8) * numOfChannels); // avg. bytes/sec
    setUint16(numOfChannels * (bitDepth / 8)); // block-align
    setUint16(bitDepth); // bit depth

    if (ko2BufferSize > 0) {
        // LIST subchunk
        setUint32(0x5453494C); // "LIST"
        setUint32(listSize + ko2BufferSize + ko2BufferPadding - 8); // exclude LIST header itself
        // INFO subchunk
        setUint32(0x4F464E49); // INFO
        setUint32(0x45474E54); // TNGE
        setUint32(ko2BufferSize);
        // Add EP-133 sample metadata
        for (let i = 0; i < ko2BufferSize; i++) {
            view.setUint8(pos, ko2Buffer[i]);
            pos++;
        }
        // Add padding if needed (ko2BufferSize is odd)
        if (ko2BufferPadding === 1) {
            view.setUint8(pos, 0x00);
            pos++;
        }
    }

    setUint32(0x61746164); // "data" - chunk
    setUint32(dataSize); // chunk length

    // Write interleaved data
    for (let i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while (pos < length) {
        for (let i = 0; i < numOfChannels; i++) { // interleave channels
            let sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            if (bitDepth === 8) {
                // Convert to 8-bit unsigned
                sample = ((sample + 1) * 127.5) | 0;
                view.setUint8(pos, sample);
            } else {
                // Convert to signed int
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                if (bitDepth === 16) {
                    view.setInt16(pos, sample, true);
                } else if (bitDepth === 24) {
                    view.setInt32(pos, sample << 8, true);
                } else if (bitDepth === 32) {
                    view.setInt32(pos, sample, true);
                }
            }
            pos += bitDepth / 8;
        }
        offset++; // next source sample
    }

    return result;

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}
//service worker implementation for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        })
        .catch(error => {
          console.log('ServiceWorker registration failed: ', error);
        });
    });
  }

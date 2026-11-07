"use strict";

/* ==========================================
   CELEBRATE MOMENTS
   Supabase connection and website features
   ========================================== */

/* 1. SUPABASE CONFIGURATION
   Replace these two placeholders with your
   Supabase Project URL and Publishable Key.
*/

const SUPABASE_URL = "https://qjbxbzmjyacsakqbjbzt.supabase.co/";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LoNp7r_8bEtnwQtVTgEvUw_GTQIPQK8";

let supabaseClient = null;

if (
    window.supabase &&
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("PASTE_") &&
    !SUPABASE_PUBLISHABLE_KEY.includes("PASTE_")
) {
    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );
}

const STORAGE_BUCKET = "celebration-photos";
const $ = id => document.getElementById(id);

const state = {
    recipient: "",
    sender: "",
    relationship: "Best friend",
    occasion: "Birthday",
    theme: "pink",
    letterStyle: "classic",
    message: "",
    photos: [],
    musicUrl: "",
    musicStart: 0,
    musicEnd: 30,
    musicVolume: 0.7,
    uploadedPhotoUrls: [],
    uploadedMusicUrl: ""
};

const stages = [
    "envelopeStage",
    "letterStage",
    "galleryStage",
    "cakeStage",
    "finalStage"
];

let musicObjectUrl = "";
let selectedMusicFile = null;
let musicTimer = null;
let giftId = null;


/* ==========================================
   HELPERS
   ========================================== */

function show(id) {
    $(id)?.classList.remove("hidden");
}

function hide(id) {
    $(id)?.classList.add("hidden");
}

function setText(id, message) {
    if ($(id)) {
        $(id).textContent = message ?? "";
    }
}

function getValue(id, fallback = "") {
    return $(id) ? $(id).value.trim() : fallback;
}

function scrollToElement(id) {
    $(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function showStatus(id, message) {
    setText(id, message);
}

function hasSupabase() {
    return Boolean(supabaseClient);
}


/* ==========================================
   NAVIGATION
   ========================================== */

document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", event => {
        const id = link.getAttribute("href").substring(1);

        if ($(id)) {
            event.preventDefault();
            scrollToElement(id);
        }
    });
});


/* ==========================================
   READ FORM
   ========================================== */

function readForm() {
    state.recipient = getValue("recipient");
    state.sender = getValue("sender");
    state.relationship = getValue("relationship", "Best friend");
    state.occasion = getValue("occasion", "Birthday");
    state.theme = getValue("theme", "pink");
    state.letterStyle = getValue("letterStyle", "classic");
    state.message = getValue("message");
}


/* ==========================================
   THEMES
   ========================================== */

function applyTheme(element, theme) {
    if (!element) return;

    element.classList.remove(
        "theme-pink",
        "theme-lavender",
        "theme-peach",
        "theme-night"
    );

    const allowed = ["pink", "lavender", "peach", "night"];

    element.classList.add(
        "theme-" + (allowed.includes(theme) ? theme : "pink")
    );
}


/* ==========================================
   CELEBRATION STAGES
   ========================================== */

function showStage(id) {
    show("experience");

    stages.forEach(stage => hide(stage));

    show(id);

    scrollToElement("experience");
}

function fillExperience() {
    setText("envelopeHeading", `${state.occasion} Surprise! 💗`);
    setText("envelopeName", state.recipient);

    setText("letterOccasion", state.occasion);
    setText("letterRecipient", state.recipient);
    setText("letterSender", state.sender || "Someone special");
    setText("letterMessage", state.message);

    setText(
        "cakeHeading",
        `A celebration just for you, ${state.recipient}!`
    );

    setText(
        "cakeMessage",
        `Make a wish, ${state.recipient}! 🎂`
    );

    setText(
        "finalHeading",
        `You are so special, ${state.recipient}! 💗`
    );

    setText("finalMessage", state.message);

    stages.forEach(id => applyTheme($(id), state.theme));

    renderGallery();
    setupExperienceMusic();
}


/* ==========================================
   PHOTO SELECTION AND PREVIEW
   ========================================== */

$("photos")?.addEventListener("change", event => {
    const files = Array.from(event.target.files || []);

    if (files.length > 5) {
        alert("Please select no more than five photos.");
        event.target.value = "";
        return;
    }

    state.photos.forEach(photo => {
        if (photo.url.startsWith("blob:")) {
            URL.revokeObjectURL(photo.url);
        }
    });

    state.photos = files
        .filter(file => file.type.startsWith("image/"))
        .map(file => ({
            file,
            name: file.name,
            url: URL.createObjectURL(file)
        }));

    const preview = $("photoPreview");

    if (preview) {
        preview.replaceChildren();

        state.photos.forEach(photo => {
            const image = document.createElement("img");

            image.src = photo.url;
            image.alt = photo.name;
            image.style.width = "100px";
            image.style.margin = "5px";
            image.style.borderRadius = "10px";

            preview.appendChild(image);
        });
    }

    setText("photoCount", `${state.photos.length} photo(s) selected.`);

    // Selecting new photos invalidates the previous upload results.
    state.uploadedPhotoUrls = [];
});


/* ==========================================
   DISPLAY PHOTOS IN CELEBRATION
   ========================================== */

function renderGallery() {
    const gallery = $("memoryGallery");

    if (!gallery) return;

    gallery.replaceChildren();

    setText(
        "galleryEmpty",
        state.photos.length
            ? "Here are your special memories 💗"
            : "No photos selected."
    );

    state.photos.forEach((photo, index) => {
        const figure = document.createElement("figure");

        const image = document.createElement("img");
        image.src = photo.url;
        image.alt = `Memory ${index + 1}`;
        image.style.width = "200px";
        image.style.maxWidth = "100%";
        image.style.borderRadius = "12px";

        const caption = document.createElement("figcaption");
        caption.textContent = photo.name;

        figure.append(image, caption);
        gallery.appendChild(figure);
    });
}


/* ==========================================
   SUPABASE FILE UPLOAD
   ========================================== */

/*
   Before uploading, create a Storage bucket named:
   celebration-files

   The bucket and its policies must permit the
   intended uploads and reads.

   This example uses public URLs. Do not upload
   private or sensitive files to a public bucket.
*/

async function uploadFile(file, folder) {
    if (!hasSupabase()) {
        throw new Error(
            "Supabase is not configured. Add your Project URL and Publishable Key."
        );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    const path =
        `${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabaseClient.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (error) {
        throw error;
    }

    const { data } = supabaseClient.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

    return data.publicUrl;
}


/* UPLOAD PHOTOS */

async function uploadPhotos() {
    if (!state.photos.length) {
        state.uploadedPhotoUrls = [];
        return [];
    }

    if (!hasSupabase()) {
        throw new Error("Configure Supabase before uploading photos.");
    }

    showStatus("photoCount", "Uploading photos...");

    const urls = [];

    for (const photo of state.photos) {
        const url = await uploadFile(
            photo.file,
            "photos"
        );

        urls.push({
            name: photo.name,
            url
        });
    }

    state.uploadedPhotoUrls = urls;

    showStatus(
        "photoCount",
        `${urls.length} photo(s) uploaded successfully.`
    );

    return urls;
}


/* UPLOAD MUSIC */

async function uploadMusic() {
    if (!selectedMusicFile) {
        return null;
    }

    if (!hasSupabase()) {
        throw new Error("Configure Supabase before uploading music.");
    }

    showStatus("musicStatus", "Uploading your music...");

    const url = await uploadFile(
        selectedMusicFile,
        "music"
    );

    state.uploadedMusicUrl = url;

    showStatus("musicStatus", "Music uploaded successfully! 💗");

    return url;
}


/* ==========================================
   CREATE MUSIC TIMELINE
   ========================================== */

function createMusicTimeline() {
    const timeline = document.querySelector(".timeline");

    if (!timeline || $("musicTimelineVisual")) return;

    const visual = document.createElement("div");

    visual.id = "musicTimelineVisual";

    visual.innerHTML = `
        <p>Choose the section of your song.</p>

        <label for="startHandle">Start position</label>
        <input
            type="range"
            id="startHandle"
            min="0"
            max="30"
            value="0"
        >

        <label for="endHandle">End position</label>
        <input
            type="range"
            id="endHandle"
            min="1"
            max="30"
            value="30"
        >

        <p id="timelineLabels">
            Start: 0 seconds — End: 30 seconds
        </p>
    `;

    visual.style.padding = "12px";
    visual.style.marginTop = "12px";
    visual.style.background = "#fff0f6";
    visual.style.borderRadius = "12px";

    timeline.appendChild(visual);

    $("startHandle")?.addEventListener("input", () => {
        updateFromHandles("start");
    });

    $("endHandle")?.addEventListener("input", () => {
        updateFromHandles("end");
    });
}

function getMusicDuration() {
    const audio = $("songPreview");

    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        return Math.floor(audio.duration);
    }

    return 30;
}

function updateTimeline() {
    const startInput = $("songStart");
    const endInput = $("songEnd");

    if (!startInput || !endInput) return;

    const duration = Math.max(1, getMusicDuration());

    let start = Math.max(0, Number(startInput.value) || 0);
    let end = Math.max(start + 1, Number(endInput.value) || 1);

    start = Math.min(start, duration - 1);
    end = Math.min(Math.max(start + 1, end), duration);

    startInput.value = String(start);
    endInput.value = String(end);

    const startHandle = $("startHandle");
    const endHandle = $("endHandle");

    if (startHandle && endHandle) {
        startHandle.max = String(duration);
        endHandle.max = String(duration);

        startHandle.value = String(start);
        endHandle.value = String(end);
    }

    setText(
        "timelineLabels",
        `Start: ${start} seconds — End: ${end} seconds`
    );

    state.musicStart = start;
    state.musicEnd = end;
}

function updateFromHandles(changed) {
    const startHandle = $("startHandle");
    const endHandle = $("endHandle");

    if (!startHandle || !endHandle) return;

    let start = Number(startHandle.value);
    let end = Number(endHandle.value);

    if (end <= start) {
        if (changed === "start") {
            start = Math.max(0, end - 1);
            startHandle.value = String(start);
        } else {
            end = Math.min(Number(endHandle.max), start + 1);
            endHandle.value = String(end);
        }
    }

    if ($("songStart")) $("songStart").value = String(start);
    if ($("songEnd")) $("songEnd").value = String(end);

    updateTimeline();
}

createMusicTimeline();


/* ==========================================
   SELECT MUSIC
   ========================================== */

$("music")?.addEventListener("change", event => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("audio/")) {
        setText("musicStatus", "Please choose an audio file.");
        return;
    }

    if (musicObjectUrl) {
        URL.revokeObjectURL(musicObjectUrl);
    }

    selectedMusicFile = file;
    state.uploadedMusicUrl = "";

    musicObjectUrl = URL.createObjectURL(file);

    const audio = $("songPreview");

    if (!audio) {
        setText("musicStatus", "The song preview element is missing.");
        return;
    }

    audio.src = musicObjectUrl;
    audio.load();

    setText("musicStatus", "Loading song information...");

    audio.onloadedmetadata = () => {
        const duration = Math.floor(audio.duration);

        if ($("songStart")) {
            $("songStart").max = String(Math.max(0, duration - 1));
            $("songStart").value = "0";
        }

        if ($("songEnd")) {
            $("songEnd").max = String(duration);
            $("songEnd").value = String(Math.min(30, duration));
        }

        updateTimeline();

        setText("musicStatus", `Selected: ${file.name}`);
    };
});

$("songStart")?.addEventListener("input", updateTimeline);
$("songEnd")?.addEventListener("input", updateTimeline);

$("musicVolume")?.addEventListener("input", () => {
    const volume = Number($("musicVolume").value);

    if ($("songPreview")) $("songPreview").volume = volume;
    if ($("experienceMusic")) $("experienceMusic").volume = volume;

    state.musicVolume = volume;
});


/* PLAY MUSIC PREVIEW */

$("playSong")?.addEventListener("click", async () => {
    const audio = $("songPreview");

    if (!audio?.src) {
        setText("musicStatus", "Choose a song first.");
        return;
    }

    updateTimeline();

    const start = Number($("songStart")?.value || 0);
    const end = Number($("songEnd")?.value || audio.duration);

    audio.volume = Number($("musicVolume")?.value ?? 0.7);

    if (audio.currentTime < start || audio.currentTime >= end) {
        audio.currentTime = start;
    }

    clearInterval(musicTimer);

    try {
        await audio.play();

        setText("musicStatus", "Playing your selected song section...");

        musicTimer = setInterval(() => {
            if (audio.currentTime >= end) {
                audio.pause();
                audio.currentTime = start;
                clearInterval(musicTimer);

                setText("musicStatus", "Preview finished.");
            }
        }, 150);
    } catch (error) {
        console.error(error);
        setText("musicStatus", "Could not play this song.");
    }
});

$("pauseSong")?.addEventListener("click", () => {
    $("songPreview")?.pause();

    clearInterval(musicTimer);

    setText("musicStatus", "Music paused.");
});


/* USE MUSIC IN PREVIEW */

$("useMusic")?.addEventListener("click", () => {
    if (!selectedMusicFile || !musicObjectUrl) {
        setText("musicStatus", "Choose a song first.");
        return;
    }

    updateTimeline();

    state.musicUrl = musicObjectUrl;
    state.musicStart = Number($("songStart")?.value || 0);
    state.musicEnd = Number($("songEnd")?.value || getMusicDuration());
    state.musicVolume = Number($("musicVolume")?.value ?? 0.7);

    setText("musicStatus", "Music is ready for your preview! 💗");
});


/* EXPERIENCE MUSIC */

/* ==========================================
   INSTAGRAM-STYLE MUSIC WAVEFORM EDITOR
   ========================================== */

let waveformAudioContext = null;
let waveformPeaks = [];
let waveformDragging = null;
let waveformDragStartX = 0;
let waveformOriginalLeft = 0;
let waveformOriginalWidth = 0;
let waveformAnimation = null;

const MIN_CLIP_LENGTH = 1;

function formatMusicTime(seconds) {
    seconds = Math.max(0, Math.floor(Number(seconds) || 0));

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function getMusicDuration() {
    const audio = $("songPreview");

    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
        return audio.duration;
    }

    return 30;
}

function getMusicElements() {
    return {
        audio: $("songPreview"),
        wrapper: $("waveformWrapper"),
        bars: $("waveformBars"),
        selection: $("selectionBox"),
        selectionBars: $("selectionBars"),
        start: $("songStart"),
        end: $("songEnd")
    };
}

/* Create the draggable handles */

function createWaveformHandles() {
    const { selection } = getMusicElements();

    if (!selection) return;

    if (!$("waveformStartHandle")) {
        const leftHandle = document.createElement("div");

        leftHandle.id = "waveformStartHandle";
        leftHandle.className = "waveform-handle waveform-handle-left";
        leftHandle.setAttribute("aria-label", "Drag to change start time");
        leftHandle.title = "Drag to change start time";

        selection.appendChild(leftHandle);
    }

    if (!$("waveformEndHandle")) {
        const rightHandle = document.createElement("div");

        rightHandle.id = "waveformEndHandle";
        rightHandle.className = "waveform-handle waveform-handle-right";
        rightHandle.setAttribute("aria-label", "Drag to change end time");
        rightHandle.title = "Drag to change end time";

        selection.appendChild(rightHandle);
    }
}

/* Draw the waveform from the actual uploaded audio */

async function generateWaveform(file) {
    const { bars, selectionBars } = getMusicElements();

    if (!bars) return;

    bars.replaceChildren();

    if (selectionBars) {
        selectionBars.replaceChildren();
    }

    waveformPeaks = [];

    setText("musicStatus", "Preparing your song waveform...");

    try {
        if (!waveformAudioContext) {
            const AudioContextClass =
                window.AudioContext || window.webkitAudioContext;

            if (!AudioContextClass) {
                throw new Error("Audio waveform processing is unavailable.");
            }

            waveformAudioContext = new AudioContextClass();
        }

        const audioBuffer = await waveformAudioContext.decodeAudioData(
            await file.arrayBuffer()
        );

        const channel = audioBuffer.getChannelData(0);
        const barCount = 100;
        const samplesPerBar = Math.max(
            1,
            Math.floor(channel.length / barCount)
        );

        for (let i = 0; i < barCount; i++) {
            const start = i * samplesPerBar;
            const end = Math.min(
                channel.length,
                start + samplesPerBar
            );

            let peak = 0;

            for (let j = start; j < end; j++) {
                peak = Math.max(peak, Math.abs(channel[j]));
            }

            waveformPeaks.push(peak);
        }

        drawWaveformBars();
        setText("musicStatus", `Song ready: ${file.name}`);
    } catch (error) {
        console.error("Waveform generation:", error);

        // Fallback waveform if the browser cannot decode the audio.
        waveformPeaks = Array.from(
            { length: 100 },
            (_, index) => 0.25 + Math.abs(Math.sin(index * 1.7)) * 0.6
        );

        drawWaveformBars();

        setText(
            "musicStatus",
            "Song loaded. Waveform preview is using a visual fallback."
        );
    }
}

/* Draw waveform bars */

function drawWaveformBars() {
    const { bars, selectionBars } = getMusicElements();

    if (!bars) return;

    bars.replaceChildren();

    if (selectionBars) {
        selectionBars.replaceChildren();
    }

    waveformPeaks.forEach(peak => {
        const bar = document.createElement("span");

        bar.className = "waveform-bar";
        bar.style.height = `${Math.max(8, peak * 100)}%`;

        bars.appendChild(bar);

        if (selectionBars) {
            const selectedBar = document.createElement("span");

            selectedBar.className = "waveform-bar";
            selectedBar.style.height = `${Math.max(8, peak * 100)}%`;

            selectionBars.appendChild(selectedBar);
        }
    });

    updateTimeline();
}

/* Keep the sliders, time labels and waveform selection synchronized */

function updateTimeline() {
    const {
        audio,
        wrapper,
        selection,
        start,
        end
    } = getMusicElements();

    if (!start || !end) return;

    const duration = Math.max(1, getMusicDuration());

    start.min = "0";
    start.max = String(duration);
    start.step = "0.1";

    end.min = "0";
    end.max = String(duration);
    end.step = "0.1";

    let startTime = Math.max(0, Number(start.value) || 0);
    let endTime = Number(end.value);

    if (!Number.isFinite(endTime) || endTime <= 0) {
        endTime = Math.min(30, duration);
    }

    startTime = Math.min(startTime, Math.max(0, duration - MIN_CLIP_LENGTH));

    endTime = Math.max(
        startTime + Math.min(MIN_CLIP_LENGTH, duration),
        endTime
    );

    endTime = Math.min(endTime, duration);

    start.value = String(startTime);
    end.value = String(endTime);

    state.musicStart = startTime;
    state.musicEnd = endTime;

    setText("startLabel", formatMusicTime(startTime));
    setText("endLabel", formatMusicTime(endTime));
    setText("totalTime", formatMusicTime(duration));

    if (selection && wrapper && duration > 0) {
        const leftPercent = (startTime / duration) * 100;
        const widthPercent = ((endTime - startTime) / duration) * 100;

        selection.style.left = `${leftPercent}%`;
        selection.style.width = `${widthPercent}%`;
    }

    if (audio) {
        setText("currentTime", formatMusicTime(audio.currentTime));
    }

    updatePlayedWaveform();
}

/* Show which part of the song has played */

function updatePlayedWaveform() {
    const { audio, bars } = getMusicElements();

    if (!audio || !bars || !Number.isFinite(audio.duration)) return;

    const progress = audio.currentTime / audio.duration;
    const barElements = bars.querySelectorAll(".waveform-bar");

    barElements.forEach((bar, index) => {
        bar.classList.toggle(
            "waveform-played",
            index / Math.max(1, barElements.length) < progress
        );
    });
}

/* Drag either handle or move the selected music section */

function setupWaveformDragging() {
    const {
        wrapper,
        selection,
        start,
        end
    } = getMusicElements();

    if (!wrapper || !selection || !start || !end) return;

    createWaveformHandles();

    const leftHandle = $("waveformStartHandle");
    const rightHandle = $("waveformEndHandle");

    function pointerDown(event, mode) {
        if (event.button !== undefined && event.button !== 0) return;

        event.preventDefault();

        waveformDragging = mode;
        waveformDragStartX = event.clientX;

        waveformOriginalLeft = Number(start.value);
        waveformOriginalWidth = Number(end.value) - Number(start.value);

        document.addEventListener("pointermove", pointerMove);
        document.addEventListener("pointerup", pointerUp, { once: true });
    }

    function pointerMove(event) {
        if (!waveformDragging) return;

        const duration = getMusicDuration();
        const rect = wrapper.getBoundingClientRect();

        if (!rect.width) return;

        const timeChange =
            ((event.clientX - waveformDragStartX) / rect.width) * duration;

        let newStart = waveformOriginalLeft;
        let newEnd = waveformOriginalLeft + waveformOriginalWidth;

        if (waveformDragging === "left") {
            newStart = Math.max(
                0,
                Math.min(
                    waveformOriginalLeft + timeChange,
                    newEnd - MIN_CLIP_LENGTH
                )
            );
        } else if (waveformDragging === "right") {
            newEnd = Math.min(
                duration,
                Math.max(
                    waveformOriginalLeft + MIN_CLIP_LENGTH,
                    waveformOriginalLeft + waveformOriginalWidth + timeChange
                )
            );
        } else if (waveformDragging === "move") {
            newStart = Math.max(
                0,
                Math.min(
                    waveformOriginalLeft + timeChange,
                    duration - waveformOriginalWidth
                )
            );

            newEnd = newStart + waveformOriginalWidth;
        }

        start.value = String(newStart);
        end.value = String(newEnd);

        updateTimeline();
    }

    function pointerUp() {
        waveformDragging = null;

        document.removeEventListener("pointermove", pointerMove);
    }

    leftHandle?.addEventListener("pointerdown", event => {
        pointerDown(event, "left");
    });

    rightHandle?.addEventListener("pointerdown", event => {
        pointerDown(event, "right");
    });

    selection.addEventListener("pointerdown", event => {
        if (
            event.target === leftHandle ||
            event.target === rightHandle
        ) {
            return;
        }

        pointerDown(event, "move");
    });
}

/* Select a song */

$("music")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("audio/")) {
        setText("musicStatus", "Please choose an audio file.");
        return;
    }

    if (musicObjectUrl) {
        URL.revokeObjectURL(musicObjectUrl);
    }

    selectedMusicFile = file;
    state.uploadedMusicUrl = "";

    musicObjectUrl = URL.createObjectURL(file);

    const audio = $("songPreview");

    if (!audio) {
        setText("musicStatus", "Song preview element is missing.");
        return;
    }

    audio.pause();
    audio.src = musicObjectUrl;
    audio.load();

    setText("songName", file.name);
    setText("musicStatus", "Loading song...");

    audio.onloadedmetadata = async () => {
        const duration = getMusicDuration();

        $("songStart").value = "0";
        $("songEnd").value = String(Math.min(30, duration));

        updateTimeline();

        await generateWaveform(file);
    };
});

/* Slider controls */

$("songStart")?.addEventListener("input", updateTimeline);
$("songEnd")?.addEventListener("input", updateTimeline);

/* Volume control */

$("musicVolume")?.addEventListener("input", () => {
    const volume = Number($("musicVolume").value);

    if ($("songPreview")) {
        $("songPreview").volume = volume;
    }

    if ($("experienceMusic")) {
        $("experienceMusic").volume = volume;
    }

    state.musicVolume = volume;
});

/* Play only the selected part */

$("playSong")?.addEventListener("click", async () => {
    const audio = $("songPreview");

    if (!audio || !audio.src || !selectedMusicFile) {
        setText("musicStatus", "Please choose a song first.");
        return;
    }

    updateTimeline();

    const start = Number($("songStart").value);
    const end = Number($("songEnd").value);

    clearInterval(musicTimer);

    audio.volume = Number($("musicVolume")?.value ?? 0.7);

    if (
        audio.currentTime < start ||
        audio.currentTime >= end
    ) {
        audio.currentTime = start;
    }

    try {
        await audio.play();

        setText("musicStatus", "Playing your selected song section 💗");

        musicTimer = setInterval(() => {
            setText("currentTime", formatMusicTime(audio.currentTime));

            updatePlayedWaveform();

            if (audio.currentTime >= end) {
                audio.pause();
                audio.currentTime = start;

                clearInterval(musicTimer);

                setText("musicStatus", "Preview finished. Choose another part!");
            }
        }, 100);
    } catch (error) {
        console.error(error);

        setText("musicStatus", "Could not play this song.");
    }
});

/* Pause preview */

$("pauseSong")?.addEventListener("click", () => {
    $("songPreview")?.pause();

    clearInterval(musicTimer);

    setText("musicStatus", "Music paused.");
});

/* Use the selected music in the celebration */

$("useMusic")?.addEventListener("click", () => {
    if (!selectedMusicFile || !musicObjectUrl) {
        setText("musicStatus", "Please choose a song first.");
        return;
    }

    updateTimeline();

    state.musicUrl = musicObjectUrl;
    state.musicStart = Number($("songStart").value);
    state.musicEnd = Number($("songEnd").value);
    state.musicVolume = Number($("musicVolume").value);

    setText("musicStatus", "Your music is ready for the celebration! 💗");
});

/* Music inside the celebration experience */

function setupExperienceMusic() {
    const audio = $("experienceMusic");

    if (!audio || !state.musicUrl) {
        if (audio) {
            audio.pause();
            audio.removeAttribute("src");
            audio.load();
        }

        hide("experienceMusic");
        return;
    }

    audio.src = state.musicUrl;
    audio.volume = state.musicVolume;

    show("experienceMusic");

    audio.onloadedmetadata = () => {
        audio.currentTime = Math.min(
            state.musicStart,
            Math.max(0, audio.duration - 0.1)
        );
    };

    audio.onplay = () => {
        clearInterval(musicTimer);

        musicTimer = setInterval(() => {
            if (audio.currentTime >= state.musicEnd) {
                audio.pause();
                audio.currentTime = state.musicStart;

                clearInterval(musicTimer);
            }
        }, 100);
    };

    audio.onpause = () => {
        clearInterval(musicTimer);
    };
}

/* Start waveform controls */

setupWaveformDragging();

/* ==========================================
   CREATE SURPRISE
   ========================================== */

$("surpriseForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    readForm();

    if (!state.recipient || !state.sender || !state.message) {
        alert("Please fill in the recipient name, your name, and message.");
        return;
    }

    try {
        fillExperience();
        showStage("envelopeStage");

        /*
          Files are uploaded when the user creates a shareable gift.
          The local preview does not require Supabase.
        */

        setText(
            "shareStatus",
            "Preview ready! Create a share link to save it online."
        );
    } catch (error) {
        console.error(error);
        alert("Could not create the preview. Check your form and try again.");
    }
});


/* ==========================================
   CELEBRATION NAVIGATION
   ========================================== */

$("openEnvelopeBtn")?.addEventListener("click", () => showStage("letterStage"));
$("toGalleryBtn")?.addEventListener("click", () => showStage("galleryStage"));
$("toCakeBtn")?.addEventListener("click", () => showStage("cakeStage"));
$("toFinalBtn")?.addEventListener("click", () => showStage("finalStage"));

$("cutCakeBtn")?.addEventListener("click", () => {
    $("birthdayCake")?.classList.add("cake-cut");

    setText("cakeMessage", "The cake is cut! Make a wish! 🎂");
});

$("blowCandleBtn")?.addEventListener("click", () => {
    document.querySelectorAll(".candle i").forEach(flame => {
        flame.style.opacity = "0";
    });

    setText("cakeMessage", "Wish made! The candles are blown out! ✨");
});

$("startOverBtn")?.addEventListener("click", () => {
    hide("experience");
    scrollToElement("creator");
});


/* ==========================================
   SAVE GIFT AND UPLOAD FILES
   ========================================== */

async function saveGiftOnline() {
    if (!hasSupabase()) {
        throw new Error(
            "Supabase is not configured. Add your URL and Publishable Key."
            
        );
       
    }
    

    const photoUrls = await uploadPhotos();
    const musicUrl = await uploadMusic();

    const gift = {
        recipient: state.recipient,
        sender: state.sender,
        relationship: state.relationship,
        occasion: state.occasion,
        theme: state.theme,
        letter_style: state.letterStyle,
        message: state.message,
        photos: photoUrls,
        music_url: musicUrl,
        music_start: state.musicStart,
        music_end: state.musicEnd,
        music_volume: state.musicVolume
    };

    /*
      Create a Supabase table called "celebration_gifts".
      Add a text column "id" as the primary key, and
      JSONB column "gift_data".
      Configure Row Level Security policies safely.
    */

    const { data, error } = await supabaseClient
        .from("celebration_gifts")
        .insert({
            gift_data: gift
        })
        .select("id")
        .single();

    if (error) throw error;

    giftId = data.id;

    return `${location.origin}${location.pathname}#gift=${encodeURIComponent(giftId)}`;
}


/* ==========================================
   SHARE GIFT LINK
   ========================================== */

$("shareGiftBtn")?.addEventListener("click", async () => {
    readForm();

    if (!state.recipient || !state.sender || !state.message) {
        alert("Fill in the form and create your surprise first.");
        return;
    }

    if (!hasSupabase()) {
        /*
          This fallback creates a text-only preview link.
          It does not upload photos or music.
        */

        const gift = {
            recipient: state.recipient,
            sender: state.sender,
            relationship: state.relationship,
            occasion: state.occasion,
            theme: state.theme,
            message: state.message
        };

        const encoded = btoa(
            unescape(encodeURIComponent(JSON.stringify(gift)))
        );

        const link =
            `${location.origin}${location.pathname}#gift=${encoded}`;

        show("shareResult");

        if ($("shareLink")) $("shareLink").value = link;

        setText(
            "shareStatus",
            "Text-only link created. Configure Supabase to save photos and music online."
        );

        return;
    }

    try {
        setText("shareStatus", "Uploading photos and music...");

        const link = await saveGiftOnline();

        show("shareResult");

        if ($("shareLink")) $("shareLink").value = link;

        setText("shareStatus", "Your online gift has been saved! 💗");
    } catch (error) {
        console.error(error);

        setText(
            "shareStatus",
            `Could not save the gift: ${error.message}`
        );
    }
});


/* COPY SHARE LINK */

$("copyLinkBtn")?.addEventListener("click", async () => {
    const input = $("shareLink");

    if (!input?.value) {
        setText("shareStatus", "Create a link first.");
        return;
    }

    try {
        await navigator.clipboard.writeText(input.value);

        setText("shareStatus", "Link copied! 💗");
    } catch (error) {
        input.select();

        setText("shareStatus", "Press Ctrl+C to copy the link.");
    }
});


/* ==========================================
   OPEN A GIFT FROM A LINK
   ========================================== */

async function openGiftFromLink() {
    if (!location.hash.startsWith("#gift=")) return;

    const encoded = location.hash.slice(6);

    /*
      Supabase gift IDs are looked up in the database.
      Otherwise, the script tries the text-only format.
    */

    if (hasSupabase()) {
        try {
            const id = decodeURIComponent(encoded);

            const { data, error } = await supabaseClient
                .from("celebration_gifts")
                .select("gift_data")
                .eq("id", id)
                .single();

            if (error) throw error;

            const gift = data.gift_data;

            Object.assign(state, {
                recipient: gift.recipient || "",
                sender: gift.sender || "",
                relationship: gift.relationship || "Friend",
                occasion: gift.occasion || "Birthday",
                theme: gift.theme || "pink",
                letterStyle: gift.letter_style || "classic",
                message: gift.message || "",
                uploadedPhotoUrls: gift.photos || [],
                uploadedMusicUrl: gift.music_url || null,
                musicStart: gift.music_start || 0,
                musicEnd: gift.music_end || 30,
                musicVolume: gift.music_volume ?? 0.7,
                photos: (gift.photos || []).map(photo => ({
                    name: photo.name || "Memory",
                    url: photo.url
                })),
                musicUrl: gift.music_url || ""
            });

            fillExperience();
            showStage("envelopeStage");
            hide("checkoutSection");

            return;
        } catch (error) {
            console.error(error);
        }
    }

    try {
        const gift = JSON.parse(
            decodeURIComponent(
                escape(atob(decodeURIComponent(encoded)))
            )
        );

        Object.assign(state, gift);

        fillExperience();
        showStage("envelopeStage");
    } catch (error) {
        console.error(error);

        setText(
            "shareStatus",
            "Could not open this gift link."
        );
    }
}


/* ==========================================
   QR CODE
   ========================================== */

$("createGiftQRBtn")?.addEventListener("click", () => {
    const link = getValue("shareLink");
    const box = $("shareQR");

    if (!link || !box) {
        setText("shareStatus", "Create a share link first.");
        return;
    }

    if (typeof QRCode === "undefined") {
        setText("shareStatus", "QR code library did not load.");
        return;
    }

    box.replaceChildren();

    new QRCode(box, {
        text: link,
        width: 180,
        height: 180
    });

    setText(
        "shareStatus",
        "QR code created. Your website must be hosted online for others to open it."
    );
});


/* ==========================================
   POSTER
   ========================================== */

function updatePoster() {
    setText(
        "posterName",
        getValue("posterNameInput", "A Special Person") || "A Special Person"
    );

    setText(
        "posterSender",
        getValue("posterSenderInput", "With love 💗") || "With love 💗"
    );

    setText(
        "posterOccasion",
        `${getValue("posterOccasionInput", "Birthday")} Wishes`
    );

    setText(
        "posterQuote",
        getValue(
            "posterQuoteInput",
            "You make the world brighter just by being in it."
        ) || "You make the world brighter just by being in it."
    );

    const poster = $("posterPreview");

    if (poster) {
        poster.classList.remove(
            "poster-rose",
            "poster-lavender",
            "poster-peach",
            "poster-night"
        );

        poster.classList.add(
            getValue("posterThemeInput", "poster-rose")
        );
    }

    const characters = {
        girl: "👩🏻‍🦰",
        boy: "👦🏻",
        girlFriends: "👭",
        boyFriends: "👬",
        bestFriends: "🫶",
        couple: "💑"
    };

    setText(
        "posterCharacterArt",
        characters[getValue("posterCharacterInput", "girl")] || "💗"
    );

    const url = getValue("posterUrlInput");
    const qr = $("posterQR");

    if ($("posterQRWrap")) hide("posterQRWrap");
    qr?.replaceChildren();

    if (url && typeof QRCode !== "undefined" && qr) {
        new QRCode(qr, {
            text: url,
            width: 100,
            height: 100
        });

        show("posterQRWrap");
    }
}

$("updatePosterBtn")?.addEventListener("click", updatePoster);

$("posterForm")?.addEventListener("submit", event => {
    event.preventDefault();
    updatePoster();
});


/* DOWNLOAD POSTER */

$("downloadPosterBtn")?.addEventListener("click", async () => {
    updatePoster();

    if (typeof html2canvas === "undefined") {
        alert("Poster download library did not load.");
        return;
    }

    try {
        const canvas = await html2canvas($("posterPreview"), {
            scale: 2,
            backgroundColor: null
        });

        const link = document.createElement("a");

        link.download = "celebrate-moments-poster.png";
        link.href = canvas.toDataURL("image/png");

        link.click();

        setText("posterStatus", "Poster downloaded! 💗");
    } catch (error) {
        console.error(error);
        setText("posterStatus", "Could not download the poster.");
    }
});


/* ==========================================
   DOWNLOAD KEEPSAKE
   ========================================== */

$("downloadGiftBtn")?.addEventListener("click", () => {
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>A surprise for ${escapeHTML(state.recipient)}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #fff0f6;
                    color: #54243b;
                    padding: 30px;
                    line-height: 1.7;
                }
                article {
                    background: white;
                    border-radius: 18px;
                    padding: 25px;
                    max-width: 700px;
                    margin: auto;
                }
            </style>
        </head>
        <body>
            <article>
                <h1>${escapeHTML(state.occasion)} Surprise 💗</h1>
                <h2>Dear ${escapeHTML(state.recipient)},</h2>
                <p>${escapeHTML(state.message).replace(/\n/g, "<br>")}</p>
                <p>With love, ${escapeHTML(state.sender)} 💗</p>
            </article>
        </body>
        </html>
    `;

    const blob = new Blob([html], {
        type: "text/html"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "celebrate-moments-keepsake.html";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
});


/* ==========================================
   PAYMENT DEMO
   ========================================== */

$("checkoutBtn")?.addEventListener("click", () => {
    setText(
        "paymentStatus",
        "Demo only. Real payments are not connected."
    );
});


/* ==========================================
   START WEBSITE
   ========================================== */

updatePoster();
openGiftFromLink();

console.log("Celebrate Moments is ready 💗");
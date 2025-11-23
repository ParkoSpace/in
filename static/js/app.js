const state = {
    view: 'landing',
    listings: [],
    userLoc: { lat: 12.9716, lng: 77.5946 }, // Default to Bangalore
    radius: 5,
    map: null,
    currentUser: null,
    editMode: false,
    editId: null,
    parsedLocation: null,
    userMarker: null
};

// --- GEOLOCATION LOGIC ---
function locateUser() {
    const btn = document.getElementById('btn-locate');
    if(btn) btn.innerHTML = '<i data-lucide="loader" class="animate-spin w-4 h-4"></i>';
    lucide.createIcons();

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        if(btn) btn.innerHTML = '<i data-lucide="crosshair" class="w-4 h-4"></i>';
        lucide.createIcons();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            state.userLoc = { lat, lng };

            // Update map view
            if(state.map) {
                state.map.setView([lat, lng], 14);
                // Add/Update user marker
                if (state.userMarker) state.map.removeLayer(state.userMarker);

                // Custom pulsar marker
                const pulsarHtml = `<div class="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"><div class="absolute -inset-2 bg-blue-500 rounded-full opacity-50 animate-ping"></div></div>`;
                const pulsarIcon = L.divIcon({ className: 'bg-transparent', html: pulsarHtml, iconSize: [16, 16], iconAnchor: [8, 8] });

                state.userMarker = L.marker([lat, lng], {icon: pulsarIcon}).addTo(state.map).bindPopup("You are here").openPopup();
            }

            renderMap(); // Fetch spots near new location
            if(btn) btn.innerHTML = '<i data-lucide="crosshair" class="w-4 h-4"></i>';
            lucide.createIcons();
        },
        (error) => {
            alert("Unable to retrieve your location: " + error.message);
            console.error(error);
            if(btn) btn.innerHTML = '<i data-lucide="crosshair" class="w-4 h-4"></i>';
            lucide.createIcons();
        }
    );
}

// --- UTILITY LOGIC ---

async function parseMapUrl() {
    const urlInput = document.getElementById('in-gmap');
    const statusDiv = document.getElementById('url-status');
    const url = urlInput.value;

    if (!url) return;

    statusDiv.innerHTML = `<span class="text-[#2ED8DF] text-xs flex items-center gap-1"><i data-lucide="loader" class="animate-spin w-3 h-3"></i> Analysing Google Maps Data...</span>`;
    lucide.createIcons();

    try {
        const res = await fetch('/api/utils/parse-map-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();

        if (data.success) {
            state.parsedLocation = { lat: data.lat, lng: data.lng, address: data.address };
            statusDiv.innerHTML = `
            <div class="mt-2 bg-[#12EF86]/10 border border-[#12EF86]/30 p-2 rounded-lg text-xs animate-fade-in">
            <div class="text-[#12EF86] font-bold flex items-center gap-1"><i data-lucide="check-circle" class="w-3 h-3"></i> Location Verified</div>
            <div class="text-gray-300 mt-1 font-medium">${data.address}</div>
            <div class="text-gray-500 font-mono mt-0.5 text-[10px]">${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}</div>
            </div>
            `;
            lucide.createIcons();
        } else {
            statusDiv.innerHTML = `<span class="text-[#FE3A7F] text-xs mt-1 block font-bold">X ${data.error}</span>`;
        }
    } catch (e) {
        statusDiv.innerHTML = `<span class="text-[#FE3A7F] text-xs mt-1 block">X Connection Error</span>`;
    }
}

async function searchLocation(e) {
    if (e.key !== 'Enter') return;

    const query = e.target.value;
    if (!query) return;

    const btn = e.target.previousElementSibling;
    // Visual feedback
    const originalIcon = btn.innerHTML;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 text-[#2ED8DF] animate-spin"></i>`;
    lucide.createIcons();

    try {
        const res = await fetch('/api/utils/search-location', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await res.json();

        if (data.success) {
            state.userLoc = { lat: data.lat, lng: data.lng };
            if (state.map) {
                state.map.setView([data.lat, data.lng], 14);
                // Add search marker
                if (state.searchMarker) state.map.removeLayer(state.searchMarker);
                state.searchMarker = L.marker([data.lat, data.lng]).addTo(state.map)
                .bindPopup(`<b>${data.address}</b>`).openPopup();

                renderMap(); // Fetch listings around new area
            }
        } else {
            alert("Location not found: " + data.error);
        }
    } catch (err) {
        alert("Search failed");
    } finally {
        btn.innerHTML = originalIcon; // Restore icon
        lucide.createIcons();
    }
}

// --- TYPING ANIMATION LOGIC ---
async function startChatAnimation() {
    const sequence = [
        {
            id: 'chat-1',
            text: "I finally bought my first car today! I’m so happy. I just pulled into our lane… but now I can’t find any parking near my home.",
            delay: 500
        },
        {
            id: 'chat-2',
            text: "Yeah, man. These days getting a parking space is nearly impossible. Everywhere is full.",
            delay: 1000
        },
        {
            id: 'chat-3',
            text: "No problem. We’ve got you covered! Find verified nearby parking spots instantly—safe, easy, and affordable.",
            delay: 1000,
            speed: 20 // Faster for app
        }
    ];

    for (const item of sequence) {
        await new Promise(r => setTimeout(r, item.delay));
        const container = document.getElementById(item.id);
        const bubble = container.querySelector('.msg-bubble');
        container.classList.add('visible'); // Fade in container
        bubble.classList.add('typing-cursor');

        const speed = item.speed || 40;

        // Type writer effect
        for (let i = 0; i < item.text.length; i++) {
            bubble.textContent += item.text.charAt(i);
            await new Promise(r => setTimeout(r, speed));
        }

        bubble.classList.remove('typing-cursor');
    }
}

// --- VIEW RENDERERS ---

function renderLanding() {
    document.getElementById('app').innerHTML = `
    <div class="min-h-screen flex flex-col relative overflow-x-hidden bg-[#181727]">
    <!-- Navbar -->
    <nav class="p-4 md:p-6 flex justify-between items-center backdrop-blur-md border-b border-white/5 fixed w-full top-0 z-50 bg-[#181727]/80">
    <div class="flex items-center gap-1.5 md:gap-2">
    <img src="/static/logo.png" alt="Logo" class="h-8 w-8 md:h-10 md:w-10 object-contain">
    <div class="text-2xl md:text-3xl font-black tracking-tighter text-[#2ED8DF] leading-none flex items-center">
    ParkoSpace<span class="text-white font-light ml-[-1px]">INDIA</span>
    </div>
    </div>
    <div class="flex gap-2 md:gap-4">
    <button onclick="checkOwnerAuth()" class="text-[#EBEBEB] hover:text-[#2ED8DF] font-bold transition text-sm md:text-base px-2">Partner</button>
    <button onclick="setView('map')" class="bg-[#2ED8DF] text-[#181727] px-4 py-2 md:px-6 rounded-xl font-bold hover:shadow-[0_0_20px_#2ED8DF] transition transform hover:scale-105 text-sm md:text-base">Find Parking</button>
    </div>
    </nav>

    <!-- Hero Section -->
    <header class="min-h-screen flex flex-col items-center justify-center text-center px-4 relative z-10 pt-20">
    <div class="absolute top-20 left-20 w-64 h-64 bg-[#A764FE] rounded-full blur-[120px] opacity-30 animate-pulse"></div>
    <div class="absolute bottom-20 right-20 w-64 h-64 bg-[#2ED8DF] rounded-full blur-[120px] opacity-30 animate-pulse delay-75"></div>
    <h1 class="text-4xl md:text-7xl font-black mb-6 tracking-tighter drop-shadow-2xl">SMART PARKING <br/><span class="text-transparent bg-clip-text bg-gradient-to-r from-[#2ED8DF] via-[#A764FE] to-[#FE3A7F]">REIMAGINED</span></h1>
    <p class="text-lg md:text-xl text-gray-300 max-w-2xl mb-10 font-light leading-relaxed px-4">Your driveway is an asset. Someone else's car needs a home. We connect the two.</p>
    <div class="flex flex-col w-full md:w-auto md:flex-row gap-4 px-4">
    <button onclick="setView('map')" class="bg-[#2ED8DF] text-[#181727] w-full md:w-auto px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition shadow-[0_0_30px_rgba(46,216,223,0.3)]"><i data-lucide="search" class="w-5 h-5"></i> I need a spot</button>
    <button onclick="checkOwnerAuth()" class="border-2 border-[#FE3A7F] text-[#FE3A7F] w-full md:w-auto px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#FE3A7F] hover:text-white transition"><i data-lucide="plus" class="w-5 h-5"></i> List my space</button>
    </div>
    <div class="absolute bottom-10 animate-bounce text-gray-500 hidden md:block">
    <i data-lucide="chevron-down" class="w-8 h-8"></i>
    </div>
    </header>

    <!-- About Section with Chat Animation -->
    <section class="py-20 px-4 bg-[#13121F] border-t border-white/5 relative z-20">
    <div class="max-w-6xl mx-auto">
    <div class="text-center mb-12">
    <h2 class="text-3xl md:text-5xl font-black text-white mb-4">THE <span class="text-[#2ED8DF]">PROBLEM</span> & <span class="text-[#A764FE]">SOLUTION</span></h2>
    <div class="w-20 h-1 bg-[#FE3A7F] mx-auto rounded-full"></div>
    </div>

    <!-- Typing Animation Box -->
    <div class="chat-container">
    <!-- Arjun -->
    <div id="chat-1" class="chat-message msg-arjun">
    <div class="sender-name">Arjun</div>
    <div class="msg-bubble"></div>
    </div>

    <!-- Rohan -->
    <div id="chat-2" class="chat-message msg-rohan">
    <div class="sender-name">Rohan</div>
    <div class="msg-bubble"></div>
    </div>

    <!-- ParkoSpace -->
    <div id="chat-3" class="chat-message msg-parkospace">
    <div class="sender-name">ParkoSpace INDIA</div>
    <div class="msg-bubble"></div>
    </div>
    </div>

    <!-- Feature Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mt-16">
    <div class="glass-card p-8 text-center hover:border-[#2ED8DF]/50 transition transform hover:-translate-y-2 duration-300">
    <div class="w-16 h-16 bg-[#2ED8DF]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#2ED8DF]">
    <i data-lucide="map" class="w-8 h-8"></i>
    </div>
    <h3 class="text-xl font-bold text-white mb-3">Smart Discovery</h3>
    <p class="text-gray-400 leading-relaxed">Find hidden parking gems in crowded neighborhoods. We aggregate private driveways and commercial spots into one seamless map.</p>
    </div>

    <div class="glass-card p-8 text-center hover:border-[#A764FE]/50 transition transform hover:-translate-y-2 duration-300">
    <div class="w-16 h-16 bg-[#A764FE]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#A764FE]">
    <i data-lucide="wallet" class="w-8 h-8"></i>
    </div>
    <h3 class="text-xl font-bold text-white mb-3">Earn Passive Income</h3>
    <p class="text-gray-400 leading-relaxed">Got an empty slab of concrete? List it in seconds. Homeowners and businesses are earning thousands by monetizing their unused space.</p>
    </div>

    <div class="glass-card p-8 text-center hover:border-[#FE3A7F]/50 transition transform hover:-translate-y-2 duration-300">
    <div class="w-16 h-16 bg-[#FE3A7F]/10 rounded-full flex items-center justify-center mx-auto mb-6 text-[#FE3A7F]">
    <i data-lucide="shield-check" class="w-8 h-8"></i>
    </div>
    <h3 class="text-xl font-bold text-white mb-3">Secure & Verified</h3>
    <p class="text-gray-400 leading-relaxed">Every host is verified. Every booking is tracked. Experience stress-free parking with our secure OTP-based verification system.</p>
    </div>
    </div>
    </div>
    </section>

    <!-- Footer -->
    <footer class="py-8 text-center text-gray-600 text-sm border-t border-white/5 bg-[#0a0a0f]">
    &copy; 2025 ParkoSpace India. All rights reserved.
    </footer>
    </div>`;
    lucide.createIcons();
    // Start the chat animation after render
    startChatAnimation();
}

function renderOwnerSignup() {
    document.getElementById('app').innerHTML = `
    <div class="h-screen flex items-center justify-center p-4 relative bg-[#181727]">
    <div class="glass-card w-full max-w-md p-6 md:p-8 relative z-10 border-t border-l border-white/20 shadow-2xl">
    <button onclick="renderLanding()" class="absolute top-4 right-4 text-gray-500 hover:text-white"><i data-lucide="x"></i></button>
    <div class="text-center mb-8"><h2 class="text-2xl font-black text-white tracking-tight">OWNER LOGIN</h2><p class="text-gray-400 text-sm mt-2">One-time verification via Email.</p></div>
    <div id="step-1" class="space-y-4">
    <input id="signup-name" type="text" placeholder="Full Name" class="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-[#2ED8DF] transition">
    <input id="signup-phone" type="tel" placeholder="Mobile Number" class="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-[#2ED8DF] transition">
    <input id="signup-email" type="email" placeholder="Email Address (For OTP)" class="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-[#2ED8DF] transition">
    <button onclick="sendOTP()" id="btn-otp" class="w-full bg-gradient-to-r from-[#2ED8DF] to-[#26b0b6] text-[#181727] font-bold py-4 rounded-xl transition mt-2 hover:scale-105 transform duration-200">SEND EMAIL OTP</button>
    </div>
    <div id="step-2" class="hidden space-y-5 animate-in fade-in">
    <div class="text-sm text-[#2ED8DF] text-center">OTP sent to <span id="disp-email" class="font-bold text-white"></span></div>
    <input id="signup-otp" type="text" placeholder="Enter OTP from Email" class="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white text-center text-2xl tracking-widest font-bold outline-none focus:border-[#2ED8DF] transition">
    <button onclick="verifyOTP()" id="btn-verify" class="w-full bg-[#12EF86] text-[#181727] font-bold py-4 rounded-xl transition mt-2 hover:scale-105 transform duration-200">VERIFY ACCESS</button>
    </div>
    </div>
    </div>`;
    lucide.createIcons();
}

async function sendOTP() {
    const name = document.getElementById('signup-name').value;
    const phone = document.getElementById('signup-phone').value;
    const email = document.getElementById('signup-email').value;

    if(!name || phone.length < 10 || !email.includes('@')) { alert('Enter valid details including Email'); return; }

    const btn = document.getElementById('btn-otp');
    const originalText = btn.innerText;
    btn.innerText = "SENDING...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/auth/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, phone }) });
        const data = await res.json();

        if(data.success) {
            document.getElementById('step-1').classList.add('hidden');
            document.getElementById('step-2').classList.remove('hidden');
            document.getElementById('disp-email').innerText = email;
        } else {
            alert('Error: ' + data.error);
        }
    } catch(e) {
        alert('Connection failed');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function verifyOTP() {
    const name = document.getElementById('signup-name').value;
    const phone = document.getElementById('signup-phone').value;
    const email = document.getElementById('signup-email').value;
    const otp = document.getElementById('signup-otp').value;

    const btn = document.getElementById('btn-verify');
    const originalText = btn.innerText;
    btn.innerText = "VERIFYING...";
    btn.disabled = true;

    try {
        const res = await fetch('/api/auth/verify-owner', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, email, code: otp, name }) });
        const data = await res.json();
        if(data.success) { state.currentUser = data.user; setView('dashboard'); } else { alert('Invalid OTP'); }
    } catch(e) {
        alert('Verification failed');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function checkOwnerAuth() { state.currentUser ? setView('dashboard') : renderOwnerSignup(); }

function renderMap() {
    fetch(`/api/listings?lat=${state.userLoc.lat}&lng=${state.userLoc.lng}&radius=${state.radius}`).then(res => res.json()).then(data => { state.listings = data; buildMapUI(); });
}

function buildMapUI() {
    document.getElementById('app').innerHTML = `
    <div class="h-screen flex flex-col bg-[#181727]">
    <div class="h-16 bg-[#181727]/90 border-b border-white/10 flex items-center justify-between px-4 z-30 shadow-lg">
    <div onclick="renderLanding()" class="flex items-center gap-2 cursor-pointer hidden md:flex group">
    <img src="/static/logo.png" alt="Logo" class="h-8 w-8 object-contain group-hover:scale-110 transition">
    <div class="text-xl md:text-2xl font-black text-[#2ED8DF] leading-none flex items-center">
    Parko<span class="text-white font-light hidden md:inline ml-[-1px]">Space</span>
    </div>
    </div>

    <!-- NEW: SEARCH BAR + LOCATE ME -->
    <div class="flex-1 max-w-md mx-4 flex gap-2">
    <div class="relative flex-1">
    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><i data-lucide="search" class="w-4 h-4"></i></span>
    <input type="text" placeholder="Search Area (e.g. Indiranagar)" onkeypress="searchLocation(event)"
    class="w-full bg-black/40 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:border-[#2ED8DF] focus:outline-none transition"
    >
    </div>
    <button id="btn-locate" onclick="locateUser()" class="bg-[#2ED8DF]/20 text-[#2ED8DF] p-2 rounded-full border border-[#2ED8DF]/30 hover:bg-[#2ED8DF] hover:text-[#181727] transition shrink-0" title="Locate Me">
    <i data-lucide="crosshair" class="w-4 h-4"></i>
    </button>
    </div>

    <div class="flex items-center gap-2 md:gap-6">
    <div class="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg border border-white/5"><span class="text-[10px] text-gray-400 uppercase tracking-wider hidden sm:inline">Range</span><input type="range" min="1" max="20" value="${state.radius}" onchange="updateRadius(this.value)" class="accent-[#2ED8DF] h-1 w-16 md:w-24 bg-gray-700 rounded-lg appearance-none cursor-pointer"><span class="text-[#2ED8DF] font-mono text-sm w-8 text-right">${state.radius}km</span></div>
    </div>
    </div>
    <div class="flex-1 flex relative overflow-hidden">
    <div class="hidden md:flex flex-col w-96 bg-[#181727] border-r border-white/10 overflow-y-auto p-4 z-20 shadow-2xl">
    <h2 class="text-white font-bold mb-4 flex items-center gap-2"><i data-lucide="map-pin" class="w-4 h-4 text-[#FE3A7F]"></i> Nearby Spots</h2>
    <div class="space-y-4 pb-20">
    ${state.listings.length === 0 ? '<div class="text-gray-500 text-center py-10 border border-dashed border-white/10 rounded-xl">No spots found.</div>' : ''}
    ${state.listings.map(l => `
        <div class="bg-white/5 border border-white/10 p-4 rounded-xl hover:border-[#2ED8DF] transition group cursor-pointer" onclick="flyToLoc(${l.lat}, ${l.lng})">
        <div class="flex justify-between items-start mb-2">
        <div>
        <h3 class="font-bold text-white truncate w-48" title="${l.title}">${l.title}</h3>
        ${l.area_landmark ? `<p class="text-xs text-[#2ED8DF] mt-0.5 truncate max-w-[180px]"><i data-lucide="map-pin" class="inline w-3 h-3 mr-1"></i>${l.area_landmark}</p>` : ''}
        </div>
        <span class="${l.is_sold ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-[#2ED8DF]/10 text-[#2ED8DF] border-[#2ED8DF]/30'} text-[10px] px-2 py-1 rounded font-bold border">${l.is_sold ? 'SOLD' : '₹'+l.price_hourly+'/hr'}</span>
        </div>
        <div class="grid grid-cols-3 gap-2 mb-3"><div class="bg-black/40 rounded p-1.5 text-center"><div class="text-[10px] text-gray-500">Dist</div><div class="text-white font-bold text-xs">${l.distance}km</div></div><div class="bg-black/40 rounded p-1.5 text-center"><div class="text-[10px] text-gray-500">Daily</div><div class="text-[#12EF86] font-bold text-xs">₹${l.price_daily}</div></div><div class="bg-black/40 rounded p-1.5 text-center"><div class="text-[10px] text-gray-500">Size</div><div class="text-white font-bold text-xs">${l.length}x${l.breadth}</div></div></div>${l.is_sold ? `<div class="bg-red-500/10 border border-red-500/50 text-red-500 text-center py-2 rounded-lg font-bold text-xs">SOLD OUT</div>` : `<div class="flex gap-2"><a href="${l.gmap_link}" target="_blank" onclick="event.stopPropagation()" class="flex-1 bg-[#2ED8DF] text-[#181727] py-2 rounded-lg font-bold text-xs hover:bg-white flex items-center justify-center gap-2">NAVIGATE</a><a href="tel:${l.owner_phone}" onclick="event.stopPropagation()" class="flex-1 border border-[#12EF86] text-[#12EF86] py-2 rounded-lg font-bold text-xs hover:bg-[#12EF86] hover:text-[#181727] flex items-center justify-center gap-2">CALL</a></div>`}</div>`).join('')}
        </div>
        </div>
        <div id="map-container" class="flex-1 bg-[#0a0a0f] z-10 relative"></div>
        </div>
        </div>`;
        lucide.createIcons();
        setTimeout(initLeaflet, 50);
}

function initLeaflet() {
    if(state.map) { state.map.remove(); }
    state.map = L.map('map-container', { zoomControl: false }).setView([state.userLoc.lat, state.userLoc.lng], 14);
    L.control.zoom({ position: 'topright' }).addTo(state.map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CARTO', subdomains: 'abcd', maxZoom: 20 }).addTo(state.map);

    state.listings.forEach(l => {
        const color = l.is_sold ? '#EF4444' : '#12EF86'; const text = l.is_sold ? 'SOLD' : `₹${l.price_hourly}`;
        const markerHtml = `<div style="background: #181727; border: 2px solid ${color}; color: white; padding: 4px 8px; border-radius: 8px; font-weight: bold; font-family: monospace; font-size: 12px; box-shadow: 0 0 10px ${color};">${text}</div>`;
        const icon = L.divIcon({ className: '', html: markerHtml, iconSize: [50, 24], iconAnchor: [25, 35] });
        const popupContent = `<div class="p-1 min-w-[200px]"><h3 class="font-bold text-sm mb-1">${l.title}</h3>${l.area_landmark ? `<p class="text-xs text-[#2ED8DF] mb-1 flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i> ${l.area_landmark}</p>` : ''}${l.is_sold ? '<div class="bg-red-500 text-white text-center font-bold py-1 rounded mb-2 text-xs">SOLD OUT</div>' : ''}<div class="bg-black/20 p-2 rounded mb-2 border border-white/10"><div class="flex justify-between text-xs mb-1"><span>Daily:</span> <span class="text-[#12EF86]">₹${l.price_daily}</span></div><div class="flex justify-between text-xs"><span>Size:</span> <span class="text-white">${l.length}x${l.breadth}m</span></div></div>${l.address_text ? `<div class="mb-2 text-xs text-gray-400 truncate border-t border-white/10 pt-2 mt-2"><i data-lucide="map-pin" class="inline w-3 h-3"></i> ${l.address_text}</div>` : ''}${!l.is_sold ? `<div class="flex gap-2"><a href="${l.gmap_link}" target="_blank" class="flex-1 bg-[#2ED8DF] text-[#181727] text-xs py-1.5 rounded text-center font-bold">Nav</a><a href="tel:${l.owner_phone}" class="flex-1 border border-[#12EF86] text-[#12EF86] text-xs py-1.5 rounded text-center font-bold">Call</a></div>` : ''}</div>`;
        const marker = L.marker([l.lat, l.lng], {icon: icon}).addTo(state.map).bindPopup(popupContent);
        marker.on('popupopen', () => lucide.createIcons());
    });

    // Re-add user marker if exists
    if (state.userMarker) {
        const pulsarHtml = `<div class="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"><div class="absolute -inset-2 bg-blue-500 rounded-full opacity-50 animate-ping"></div></div>`;
        const pulsarIcon = L.divIcon({ className: 'bg-transparent', html: pulsarHtml, iconSize: [16, 16], iconAnchor: [8, 8] });
        state.userMarker = L.marker([state.userLoc.lat, state.userLoc.lng], {icon: pulsarIcon}).addTo(state.map).bindPopup("You are here");
    }

    setTimeout(() => state.map.invalidateSize(), 200);
}

function flyToLoc(lat, lng) { state.map.flyTo([lat, lng], 16, { duration: 1.5 }); }

async function renderDashboard() {
    const user = state.currentUser;
    const res = await fetch(`/api/listings?owner_phone=${user.phone}`);
    const myListings = await res.json();
    document.getElementById('app').innerHTML = `
    <div class="min-h-screen bg-[#181727] p-4 md:p-12 pb-20">
    <div class="max-w-6xl mx-auto">
    <header class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
    <div class="text-center md:text-left"><h1 class="text-2xl md:text-4xl font-black tracking-tight text-white">OWNER DASHBOARD</h1><p class="text-[#2ED8DF] text-sm flex items-center justify-center md:justify-start gap-2 mt-1"><i data-lucide="user-check" class="w-4 h-4"></i> Verified Partner: ${user.name}</p></div>
    <div class="flex gap-3"><button onclick="renderLanding()" class="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5 text-sm transition">Home</button><button onclick="logout()" class="px-4 py-2 rounded-lg bg-[#FE3A7F]/10 text-[#FE3A7F] border border-[#FE3A7F]/30 hover:bg-[#FE3A7F] hover:text-white text-sm font-bold transition">Log Out</button></div>
    </header>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
    <div class="lg:col-span-5 space-y-6">
    <div class="glass-card p-5 md:p-6 relative overflow-hidden border-t border-[#2ED8DF]/50">
    <div class="absolute top-0 right-0 bg-[#2ED8DF] text-[#181727] text-[10px] px-3 py-1 font-bold rounded-bl-xl">${state.editMode ? 'EDITING' : 'NEW LISTING'}</div>
    <h2 class="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-2"><i data-lucide="${state.editMode ? 'pencil' : 'plus-circle'}" class="w-5 h-5 text-[#2ED8DF]"></i> ${state.editMode ? 'Edit Property' : 'Add Property'}</h2>
    <div class="space-y-4">
    <input id="in-title" type="text" placeholder="Title" class="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white outline-none text-sm focus:border-[#2ED8DF] transition">
    <input id="in-landmark" type="text" placeholder="Area / Landmark (e.g. Indiranagar, Near Starbucks)" class="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white outline-none text-sm focus:border-[#2ED8DF] transition">
    <textarea id="in-desc" placeholder="Description" rows="2" class="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white outline-none text-sm resize-none focus:border-[#2ED8DF] transition"></textarea>
    <div class="grid grid-cols-2 gap-3"><input id="in-len" type="number" oninput="calcPreview()" placeholder="Length (m)" class="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white outline-none text-sm text-center"><input id="in-bre" type="number" oninput="calcPreview()" placeholder="Breadth (m)" class="w-full bg-black/30 border border-white/10 rounded-lg p-2 text-white outline-none text-sm text-center"></div>
    <div class="text-center text-xs text-gray-500 font-mono" id="area-prev">Area: 0 m²</div>
    <div class="flex gap-2"><input id="in-gmap" type="text" placeholder="Paste Google Maps Link Here" class="flex-1 bg-black/20 border border-white/10 rounded-xl p-3 text-white outline-none text-sm text-[#2ED8DF] focus:border-[#2ED8DF] transition"><button onclick="parseMapUrl()" class="bg-[#2ED8DF]/20 hover:bg-[#2ED8DF]/40 text-[#2ED8DF] p-3 rounded-xl border border-[#2ED8DF]/30 transition" title="Auto-fill from Link"><i data-lucide="wand-2" class="w-4 h-4"></i></button></div>
    <div id="url-status" class="text-xs"></div>
    <div class="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer" onclick="document.getElementById('in-sold').click()"><input id="in-sold" type="checkbox" class="w-5 h-5 accent-[#FE3A7F]"><label for="in-sold" class="text-sm font-bold text-white cursor-pointer">Mark as Sold / Booked</label></div>
    <div class="glass-card p-4 border border-[#A764FE]/30 mt-4"><div class="flex items-center gap-4 mb-2"><label class="w-16 text-xs text-gray-400">Hourly</label><input id="in-hourly" type="number" value="50" class="flex-1 bg-black/30 border border-white/10 rounded p-1 text-[#12EF86] text-right font-mono"></div><div class="flex items-center gap-4 mb-2"><label class="w-16 text-xs text-gray-400">Daily</label><input id="in-daily" type="number" value="300" class="flex-1 bg-black/30 border border-white/10 rounded p-1 text-[#12EF86] text-right font-mono"></div><div class="flex items-center gap-4"><label class="w-16 text-xs text-gray-400">Monthly</label><input id="in-monthly" type="number" value="0" class="flex-1 bg-black/30 border border-white/10 rounded p-1 text-[#A764FE] text-right font-mono"></div></div>
    <div class="flex gap-3 mt-4">${state.editMode ? `<button onclick="cancelEdit()" class="flex-1 bg-white/5 text-gray-300 font-bold py-3 rounded-xl text-sm">Cancel</button>` : ''}<button onclick="handleFormSubmit()" class="flex-[2] bg-[#2ED8DF] text-[#181727] font-bold py-3 rounded-xl text-sm hover:scale-105 transition transform">${state.editMode ? 'UPDATE' : 'PUBLISH'}</button></div>
    </div>
    </div>
    </div>
    <div class="lg:col-span-7">
    <h2 class="text-lg md:text-xl font-bold text-white mb-6 flex items-center gap-2"><i data-lucide="layout-grid" class="w-5 h-5 text-gray-400"></i> Your Portfolio <span class="bg-white/10 text-xs px-2 py-0.5 rounded-full text-gray-300">${myListings.length}</span></h2>
    <div class="space-y-4 max-h-[600px] overflow-y-auto pr-2">
    ${myListings.map(l => `<div class="glass-card p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group hover:border-[#2ED8DF]/50 transition"><div class="flex-1 w-full"><div class="flex items-center gap-2 mb-1"><h3 class="font-bold text-lg text-white truncate">${l.title}</h3><span class="${l.is_sold ? 'bg-red-500/20 text-red-500 border-red-500/30' : 'bg-[#12EF86]/20 text-[#12EF86] border-[#12EF86]/30'} text-[10px] px-1.5 rounded font-bold border shrink-0">${l.is_sold ? 'SOLD' : 'ACTIVE'}</span></div>${l.area_landmark ? `<p class="text-xs text-[#2ED8DF] mb-1 flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i> ${l.area_landmark}</p>` : ''}<p class="text-xs text-gray-400 line-clamp-1 mb-2">${l.desc}</p><div class="flex gap-4 text-xs font-mono text-gray-500"><span><span class="text-[#2ED8DF]">₹${l.price_hourly}</span>/hr</span><span><span class="text-[#2ED8DF]">₹${l.price_daily}</span>/day</span>${l.address_text ? `<div class="ml-auto text-gray-500 flex items-center gap-1 truncate max-w-[120px]"><i data-lucide="map-pin" class="w-3 h-3"></i> ${l.address_text}</div>` : ''}</div></div><div class="flex gap-2 w-full sm:w-auto"><button onclick='loadForEdit(${JSON.stringify(l).replace(/'/g, "&apos;")})' class="flex-1 sm:flex-none bg-white/5 hover:bg-[#2ED8DF] hover:text-[#181727] text-white p-2.5 rounded-lg transition"><i data-lucide="pencil" class="w-4 h-4"></i></button><button onclick='deleteListing("${l.id}")' class="flex-1 sm:flex-none bg-white/5 hover:bg-[#FE3A7F] hover:text-white text-[#FE3A7F] p-2.5 rounded-lg transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div></div>`).join('')}
    </div>
    </div>
    </div>
    </div>
    </div>`;
    lucide.createIcons();
}

function calcPreview() {
    const area = (parseFloat(document.getElementById('in-len').value)||0) * (parseFloat(document.getElementById('in-bre').value)||0); document.getElementById('area-prev').innerText = `Area: ${area.toFixed(2)} m²`;
    if (area > 0 && !state.editMode) { document.getElementById('in-hourly').value = 50; document.getElementById('in-daily').value = 300; document.getElementById('in-monthly').value = (area * 100).toFixed(0); }
}
function loadForEdit(l) {
    state.editMode = true; state.editId = l.id; state.parsedLocation = { lat: l.lat, lng: l.lng, address: l.address_text };
    renderDashboard().then(() => {
        document.getElementById('in-title').value = l.title; document.getElementById('in-desc').value = l.desc; document.getElementById('in-landmark').value = l.area_landmark || ''; document.getElementById('in-len').value = l.length; document.getElementById('in-bre').value = l.breadth; document.getElementById('in-gmap').value = l.gmap_link;
        document.getElementById('in-hourly').value = l.price_hourly; document.getElementById('in-daily').value = l.price_daily; document.getElementById('in-monthly').value = l.price_monthly; document.getElementById('in-sold').checked = l.is_sold || false;
        if(l.address_text) document.getElementById('url-status').innerHTML = `<div class="mt-2 bg-[#2ED8DF]/10 border border-[#2ED8DF]/30 p-2 rounded-lg text-xs text-[#2ED8DF]">${l.address_text}</div>`;
        calcPreview(); window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}
function cancelEdit() { state.editMode = false; state.editId = null; state.parsedLocation = null; renderDashboard(); }
async function handleFormSubmit() {
    if(!state.currentUser) { alert("Session Expired"); renderOwnerSignup(); return; }
    const title = document.getElementById('in-title').value; if(!title) { alert("Title required"); return; }
    const data = { title, desc: document.getElementById('in-desc').value, area_landmark: document.getElementById('in-landmark').value, length: parseFloat(document.getElementById('in-len').value)||0, breadth: parseFloat(document.getElementById('in-bre').value)||0, price_hourly: parseFloat(document.getElementById('in-hourly').value)||0, price_daily: parseFloat(document.getElementById('in-daily').value)||0, price_monthly: parseFloat(document.getElementById('in-monthly').value)||0, gmap_link: document.getElementById('in-gmap').value, is_sold: document.getElementById('in-sold').checked, owner_phone: state.currentUser.phone };

    if (state.parsedLocation) { data.lat = state.parsedLocation.lat; data.lng = state.parsedLocation.lng; data.address_text = state.parsedLocation.address; }
    else if (!state.editMode) { data.lat = state.userLoc.lat + (Math.random()*0.005-0.0025); data.lng = state.userLoc.lng + (Math.random()*0.005-0.0025); }

    let url = state.editMode ? '/api/listings/update' : '/api/create'; if (state.editMode) data.id = state.editId;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if(res.ok) { alert(state.editMode ? 'Updated!' : 'Listed!'); cancelEdit(); }
}
async function deleteListing(id) { if(confirm("Remove listing?")) { const res = await fetch('/api/listings/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, owner_phone: state.currentUser.phone }) }); if(res.ok) renderDashboard(); } }
function logout() { if(confirm("Log out?")) { state.currentUser = null; renderLanding(); } }
function setView(v) { state.view = v; if(v==='map') setTimeout(renderMap,50); if(v==='dashboard') renderDashboard(); if(v==='landing') renderLanding(); }
async function updateRadius(val) { state.radius = val; if(this.tm) clearTimeout(this.tm); this.tm = setTimeout(()=>renderMap(),500); }

// INITIALIZE
renderLanding();

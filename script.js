// ====== FIREBASE SETUP (Apni Keys Yahan Dalein) ======
const firebaseConfig = {
    apiKey: "AIzaSyCJtCQ_xEzq4Dq6769Cpp6lopHoyko2LT0",
    authDomain: "speedmath-live.firebaseapp.com",
    databaseURL: "https://speedmath-live-default-rtdb.firebaseio.com",
    projectId: "speedmath-live",
    storageBucket: "speedmath-live.firebasestorage.app",
    messagingSenderId: "4434523943",
    appId: "1:4434523943:web:9fcada4214b5229bf95b02"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
// ======================================================

// Globals
let operation, isBodmasMode, isSpecialMode, activityMode, inputMode;
let diff, d1, d2, totalQuestions;
let targetNumbers = [], practicePool = []; 

let bodmasNumType, bodmasNumOps, bodmasAllowedOps = [];
let currentQ = 0, currentAnswerStr = "", currentAnswerVal = 0, currentTyped = "";
let timerInterval, secondsPassed = 0, mcqOptionsArray = [];

// Multiplayer Globals
let isMultiplayer = false;
let roomID = "";
let isHost = false;
let myName = "";
let myPlayerId = "player_" + Math.random().toString(36).substr(2, 9);
let myScore = 0;
let mpSyncedQuestions = []; // Taaki sabko same questions aayein

// Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode); gainNode.connect(audioCtx.destination);
    if (type === 'correct') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } else {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
}

// Theme
function toggleTheme() {
    const body = document.body; body.classList.toggle('light-mode');
    const isLight = body.classList.contains('light-mode');
    document.getElementById('theme-btn').innerText = isLight ? '🌙' : '☀️';
    localStorage.setItem('speedMathTheme', isLight ? 'light' : 'dark');
}
window.onload = () => { if(localStorage.getItem('speedMathTheme') === 'light') toggleTheme(); }

// Math Utility
class Frac {
    constructor(n, d) { this.n = n; this.d = d; this.simplify(); }
    simplify() { let g = gcd(Math.abs(this.n), Math.abs(this.d)); this.n/=g; this.d/=g; if(this.d < 0){this.n*=-1; this.d*=-1;} }
    add(f) { return new Frac(this.n*f.d + f.n*this.d, this.d*f.d); }
    sub(f) { return new Frac(this.n*f.d - f.n*this.d, this.d*f.d); }
    mul(f) { return new Frac(this.n*f.n, this.d*f.d); }
    div(f) { return new Frac(this.n*f.d, this.d*f.n); }
    toString() { return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`; }
}
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function getRandom(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Screen Nav
function showScreen(screenId) {
    document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

// ==========================================
// ====== NEW MULTIPLAYER FLOW LOGIC ========
// ==========================================

function showMultiplayerNameScreen() {
    isMultiplayer = true;
    showScreen('screen-mp-name');
}

function proceedToMpLobby() {
    myName = document.getElementById('player-name-input').value.trim();
    if(myName === "") return alert("Please enter your name!");
    document.getElementById('display-player-name').innerText = myName;
    showScreen('screen-mp-choice');
}

// Ye function ab Solo aur Host dono ke liye kaam karega
function goToScreen2(asHost = false) {
    if(!asHost) isMultiplayer = false;
    
    operation = document.querySelector('input[name="op"]:checked').value;
    isBodmasMode = (operation === 'bodmas');
    isSpecialMode = ['table', 'sq', 'sqrt', 'cube', 'cuberoot'].includes(operation);

    document.getElementById('bodmas-config').classList.add('hidden');
    document.getElementById('special-config').classList.add('hidden');
    document.getElementById('standard-config').classList.add('hidden');
    document.getElementById('digits-config').classList.remove('hidden');

    if(isBodmasMode) {
        document.getElementById('bodmas-config').classList.remove('hidden');
        document.getElementById('standard-config').classList.remove('hidden');
        document.getElementById('digits-config').classList.add('hidden');
    } else if(isSpecialMode) {
        document.getElementById('special-config').classList.remove('hidden');
    } else {
        document.getElementById('standard-config').classList.remove('hidden');
    }

    // Change Button Text based on mode
    document.getElementById('start-btn').innerText = asHost ? "Create Multiplayer Room 🚀" : "Start Solo Practice 🚀";
    
    showScreen('screen-2');
}

// When clicking Start/Create on Screen 2
function startSession() {
    clearInterval(timerInterval);
    
    // Read all settings
    diff = document.getElementById('diff-select').value;
    inputMode = document.querySelector('input[name="input-mode"]:checked').value;
    totalQuestions = parseInt(document.getElementById('total-q').value);
    
    if (isSpecialMode) {
        activityMode = document.querySelector('input[name="activity-mode"]:checked').value;
        let str = document.getElementById('target-numbers').value;
        targetNumbers = [];
        str.split(',').forEach(p => {
            if(p.includes('-')) {
                let [start, end] = p.split('-').map(Number);
                if(!isNaN(start) && !isNaN(end)) for(let i=start; i<=end; i++) targetNumbers.push(i);
            } else if (!isNaN(parseInt(p))) targetNumbers.push(parseInt(p));
        });
        if(targetNumbers.length === 0) { return alert("Enter valid numbers!"); }
        if (activityMode === 'learn') return generateLearnScreen(); 
        generatePracticePool(); 
    } else if (isBodmasMode) {
        bodmasNumType = document.querySelector('input[name="bodmas-type"]:checked').value;
        bodmasNumOps = parseInt(document.getElementById('bodmas-length').value);
        bodmasAllowedOps = Array.from(document.querySelectorAll('input[name="bodmas-ops"]:checked')).map(cb => cb.value);
        if(bodmasAllowedOps.length === 0) return alert("Select at least 1 operation!"); 
    } else {
        d1 = parseInt(document.getElementById('digit1').value);
        d2 = parseInt(document.getElementById('digit2').value);
    }

    if (isMultiplayer) {
        // HOST CREATING ROOM
        roomID = Math.floor(1000 + Math.random() * 9000).toString();
        isHost = true;
        myScore = 0;
        
        // Host pre-generates ALL questions so everyone gets exactly the same math problems
        mpSyncedQuestions = [];
        for(let i=0; i<totalQuestions; i++) {
            mpSyncedQuestions.push(generateSingleQuestionData());
        }

        // Push Room to Firebase
        db.ref('rooms/' + roomID).set({
            status: 'waiting',
            totalQ: totalQuestions,
            inputMode: inputMode,
            questions: mpSyncedQuestions,
            players: {
                [myPlayerId]: { name: myName, score: 0 }
            }
        });

        enterWaitingRoom();
    } else {
        // SOLO PLAY
        setupGameUIAndStart();
    }
}

function joinMultiplayerRoom() {
    let code = document.getElementById('join-room-code').value;
    if (!code) return alert("Enter 4-Digit Room Code!");
    
    db.ref('rooms/' + code).once('value', (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            if (data.status === 'waiting') {
                roomID = code;
                isHost = false;
                myScore = 0;
                totalQuestions = data.totalQ;
                inputMode = data.inputMode;
                mpSyncedQuestions = data.questions; // Sync host's questions
                
                // Add me to players list
                db.ref('rooms/' + roomID + '/players/' + myPlayerId).set({
                    name: myName, score: 0
                });
                
                enterWaitingRoom();
            } else {
                alert("Room is already full or game started!");
            }
        } else {
            alert("Invalid Room Code!");
        }
    });
}

function enterWaitingRoom() {
    showScreen('screen-mp-waiting');
    document.getElementById('display-room-code').innerText = roomID;
    
    if(isHost) {
        document.getElementById('host-controls').classList.remove('hidden');
        document.getElementById('client-msg').classList.add('hidden');
    } else {
        document.getElementById('host-controls').classList.add('hidden');
        document.getElementById('client-msg').classList.remove('hidden');
    }

    // Listen to players joining
    db.ref('rooms/' + roomID).on('value', (snapshot) => {
        const data = snapshot.val();
        if(!data) return;

        // Update Players List
        let listHtml = "";
        let players = data.players || {};
        Object.keys(players).forEach(pid => {
            let p = players[pid];
            let isMe = (pid === myPlayerId) ? "(You)" : "";
            listHtml += `<li class="player-list-item ${pid===myPlayerId?'me':''}">${p.name} ${isMe} <span style="color:var(--success)">Ready</span></li>`;
        });
        document.getElementById('mp-players-list').innerHTML = listHtml;

        // If Host started game
        if (data.status === 'playing' && currentQ === 0) {
            setupGameUIAndStart();
        }

        // Live updating progress bars during game
        if (data.status === 'playing') {
            updateDynamicProgressBars(data.players);
        }
    });
}

function hostStartGame() {
    db.ref('rooms/' + roomID).update({ status: 'playing' });
}

// Render dynamic progress bars for N players
function updateDynamicProgressBars(playersData) {
    let container = document.getElementById('dynamic-bars-container');
    container.innerHTML = "";
    
    // Sort players by score highest first
    let playersArr = Object.keys(playersData).map(k => ({id: k, ...playersData[k]}));
    playersArr.sort((a,b) => b.score - a.score);

    playersArr.forEach(p => {
        let isMe = p.id === myPlayerId;
        let color = isMe ? '#22c55e' : '#3b82f6'; // Green for me, Blue for others
        let barWidth = (p.score / totalQuestions) * 100;
        
        // Winner check
        if(p.score >= totalQuestions) {
            endMultiplayerGame(p);
        }

        container.innerHTML += `
            <div class="mp-bar-row">
                <span>${p.name} ${isMe?'(You)':''}</span><span>${p.score}/${totalQuestions}</span>
            </div>
            <div style="background:var(--bg-main); width:100%; height:10px; border-radius:5px; margin-bottom:12px; border: 1px solid var(--border);">
                <div style="background:${color}; width:${barWidth}%; height:100%; border-radius:5px; transition:0.3s;"></div>
            </div>
        `;
    });
}

function endMultiplayerGame(winnerData) {
    clearInterval(timerInterval);
    db.ref('rooms/' + roomID).off(); // Stop listening
    
    showScreen('screen-result');
    let title = document.getElementById('result-title');
    let winMsg = document.getElementById('mp-winner-announcement');
    
    document.getElementById('btn-view-history').classList.add('hidden'); // Hide history for MP

    if (winnerData.id === myPlayerId) {
        title.innerText = "🏆 YOU WON! 🎉";
        title.style.color = "var(--success)";
        winMsg.innerText = "Fastest Fingers!";
    } else {
        title.innerText = "❌ YOU LOST!";
        title.style.color = "var(--danger)";
        winMsg.innerText = `Winner: ${winnerData.name} 🏆`;
    }
    winMsg.classList.remove('hidden');
    
    document.getElementById('res-total').innerText = totalQuestions;
    let m = Math.floor(secondsPassed / 60).toString().padStart(2, '0');
    let s = (secondsPassed % 60).toString().padStart(2, '0');
    document.getElementById('res-time').innerText = `${m}:${s}`;
    document.getElementById('res-speed').innerText = `${(secondsPassed / totalQuestions).toFixed(1)} sec/q`;
    
    isMultiplayer = false;
}

// ==========================================
// ====== GAME ENGINE & UI SETUP ============
// ==========================================

function setupGameUIAndStart() {
    document.getElementById('typing-wrapper').classList.toggle('hidden', inputMode === 'mcq');
    document.getElementById('custom-keyboard').classList.toggle('hidden', inputMode === 'mcq');
    document.getElementById('mcq-wrapper').classList.toggle('hidden', inputMode !== 'mcq');

    let isFrac = (!isMultiplayer && isBodmasMode && bodmasNumType === 'fraction');
    document.getElementById('minus-key').classList.toggle('hidden', !(isBodmasMode));
    document.getElementById('slash-key').classList.toggle('hidden', !isFrac);
    document.getElementById('custom-keyboard').classList.toggle('fraction-mode', isFrac);

    if(isMultiplayer) {
        document.getElementById('multiplayer-progress').classList.remove('hidden');
        document.getElementById('mp-winner-announcement').classList.add('hidden');
    } else {
        document.getElementById('multiplayer-progress').classList.add('hidden');
        document.getElementById('result-title').innerText = "Session Complete 🎉";
        document.getElementById('result-title').style.color = "var(--primary)";
        document.getElementById('btn-view-history').classList.remove('hidden');
    }

    showScreen('screen-game');
    secondsPassed = 0; 
    timerInterval = setInterval(updateTimer, 1000);
    currentQ = 0; 
    loadNextQuestion();
}

function generateSingleQuestionData() {
    let ansStr, ansVal, displayTxt;
    if (isSpecialMode) {
        if(practicePool.length === 0) generatePracticePool();
        let randomItem = practicePool[Math.floor(Math.random() * practicePool.length)];
        displayTxt = randomItem.txt; ansStr = randomItem.ans.toString(); ansVal = randomItem.ans;
    } else if (isBodmasMode) {
        let q = generateBODMAS();
        displayTxt = q.txt; ansStr = q.str; ansVal = q.val;
    } else {
        let r1 = getRangeByDifficulty(d1||2, diff), r2 = getRangeByDifficulty(d2||2, diff);
        let num1 = getRandom(r1.min, r1.max), num2 = getRandom(r2.min, r2.max);
        if(operation==='-'){ if(num2>num1)[num1,num2]=[num2,num1]; ansVal=num1-num2; displayTxt=`${num1} - ${num2} = `;}
        else if(operation==='*'){ ansVal=num1*num2; displayTxt=`${num1} × ${num2} = `;}
        else if(operation==='/'){ 
            let startMult = Math.ceil(r1.min/num2), endMult = Math.floor(r1.max/num2);
            if(startMult<=endMult){ ansVal=getRandom(startMult,endMult); num1=num2*ansVal; } else { num1=num2*2; ansVal=2; }
            displayTxt = `${num1} ÷ ${num2} = `;
        }
        else { ansVal=num1+num2; displayTxt=`${num1} + ${num2} = `;}
        ansStr = ansVal.toString();
    }
    
    // Gen MCQs for this question
    let options = new Set(); options.add(ansStr);
    while(options.size < 4) {
        let offset = getRandom(1, 15);
        let fakeVal = Math.random() > 0.5 ? ansVal + offset : ansVal - offset;
        options.add(fakeVal.toString());
    }
    let mcqOptions = Array.from(options).sort(() => Math.random() - 0.5);

    return { txt: displayTxt, str: ansStr, val: ansVal, mcq: mcqOptions };
}

function loadNextQuestion() {
    currentQ++;
    if (currentQ > totalQuestions && !isMultiplayer) { endPractice(); return; }

    document.getElementById('q-counter').innerText = `${currentQ}/${totalQuestions}`;
    currentTyped = ""; document.getElementById('answer-display').innerText = "";
    document.getElementById('error-message').classList.add('hidden');
    document.getElementById('answer-display').classList.remove('error');
    
    document.querySelectorAll('.mcq-btn').forEach(btn => { 
        btn.classList.remove('correct', 'wrong'); btn.disabled = false; btn.innerText = "";
    });

    if (isMultiplayer) {
        // Sync questions read
        let q = mpSyncedQuestions[currentQ - 1];
        document.getElementById('equation-text').innerText = q.txt;
        currentAnswerStr = q.str; currentAnswerVal = q.val; mcqOptionsArray = q.mcq;
    } else {
        // Solo local generate
        let q = generateSingleQuestionData();
        document.getElementById('equation-text').innerText = q.txt;
        currentAnswerStr = q.str; currentAnswerVal = q.val; mcqOptionsArray = q.mcq;
    }

    let eqEl = document.getElementById('equation-text');
    if (eqEl.innerText.length > 20) eqEl.style.fontSize = "1.3rem";
    else if (eqEl.innerText.length > 12) eqEl.style.fontSize = "1.8rem";
    else eqEl.style.fontSize = "2.2rem";

    if(inputMode === 'mcq') {
        for(let i=0; i<4; i++) document.getElementById(`mcq-${i}`).innerText = mcqOptionsArray[i];
    }
}

function checkMCQ(btn, index) {
    if (mcqOptionsArray[index] === currentAnswerStr) {
        playSound('correct'); btn.classList.add('correct');
        document.querySelectorAll('.mcq-btn').forEach(b => b.disabled = true);
        if (isMultiplayer) { myScore++; db.ref(`rooms/${roomID}/players/${myPlayerId}`).update({score: myScore}); }
        setTimeout(loadNextQuestion, 250);
    } else { playSound('wrong'); btn.classList.add('wrong'); btn.disabled = true; }
}

function keyPress(key) {
    if (inputMode === 'mcq') return;
    if (key === 'clear') currentTyped = ""; 
    else if (key === 'delete') currentTyped = currentTyped.slice(0, -1); 
    else currentTyped += key;
    
    document.getElementById('answer-display').innerText = currentTyped;
    
    let isCorrect = false;
    let isFrac = (!isMultiplayer && isBodmasMode && bodmasNumType === 'fraction');
    
    if (isFrac && currentTyped.includes('/')) {
        let parts = currentTyped.split('/');
        if (parts.length === 2 && parts[1] !== "") {
            if (Math.abs((parseFloat(parts[0]) / parseFloat(parts[1])) - currentAnswerVal) < 0.001) isCorrect = true;
        }
    } else {
        if (currentTyped === currentAnswerStr) isCorrect = true;
    }

    if (isCorrect) {
        playSound('correct');
        document.getElementById('answer-display').classList.remove('error');
        document.getElementById('error-message').classList.add('hidden');
        if (isMultiplayer) { myScore++; db.ref(`rooms/${roomID}/players/${myPlayerId}`).update({score: myScore}); }
        setTimeout(loadNextQuestion, 200); 
    } else if (currentTyped.length >= currentAnswerStr.length) {
        if(currentTyped !== "-" && currentTyped !== currentAnswerStr.substring(0, currentTyped.length)){
             playSound('wrong'); document.getElementById('answer-display').classList.add('error');
        }
    } else {
        document.getElementById('answer-display').classList.remove('error');
    }
}

document.addEventListener('keydown', (e) => {
    if (document.getElementById('screen-game').classList.contains('hidden') || inputMode === 'mcq') return;
    if (e.key >= '0' && e.key <= '9') keyPress(e.key);
    else if (e.key === '-' || e.key === '/') keyPress(e.key);
    else if (e.key === 'Backspace') keyPress('delete');
});

function updateTimer() {
    secondsPassed++;
    let m = Math.floor(secondsPassed / 60).toString().padStart(2, '0');
    let s = (secondsPassed % 60).toString().padStart(2, '0');
    document.getElementById('time-display').innerText = `${m}:${s}`;
}

// --- REST OF CODE (History/Learn/BODMAS) Remains Same ---
function endPractice() {
    clearInterval(timerInterval);
    let avgSpeed = (secondsPassed / totalQuestions).toFixed(1);
    let saveDiff = diff;
    if(isSpecialMode) saveDiff = 'Target: ' + document.getElementById('target-numbers').value;
    let history = JSON.parse(localStorage.getItem('sm_history') || '[]');
    history.push({ date: new Date().toLocaleDateString(), op: isSpecialMode ? 'table/sq' : operation, diff: saveDiff, total: totalQuestions, speed: parseFloat(avgSpeed) });
    localStorage.setItem('sm_history', JSON.stringify(history));

    showScreen('screen-result');
    document.getElementById('res-total').innerText = totalQuestions;
    let m = Math.floor(secondsPassed / 60).toString().padStart(2, '0');
    let s = (secondsPassed % 60).toString().padStart(2, '0');
    document.getElementById('res-time').innerText = `${m}:${s}`;
    document.getElementById('res-speed').innerText = `${avgSpeed} sec/q`;
}

function showHistory() { showScreen('screen-history'); renderHistory(); }

function renderHistory() {
    let opFilter = document.getElementById('history-op-filter').value;
    let diffFilter = document.getElementById('history-diff-filter').value;
    let history = JSON.parse(localStorage.getItem('sm_history') || '[]');
    let filtered = history.filter(h => {
        let matchOp = (opFilter === 'all' || h.op === opFilter);
        let matchDiff = (diffFilter === 'all' || h.diff === diffFilter);
        if (h.op === 'table/sq') return matchOp; return matchOp && matchDiff;
    });
    let top10 = [...filtered].sort((a,b) => a.speed - b.speed).slice(0, 10);
    let lbHtml = top10.length === 0 ? '<p style="text-align:center; color:gray;">No data yet</p>' : '';
    top10.forEach((item, idx) => {
        let opName = item.op === 'table/sq' ? 'Special Mode' : item.op.toUpperCase();
        lbHtml += `<div class="lb-item"><div><span class="lb-rank">#${idx+1}</span> ${opName} <span style="font-size:0.8rem; color:gray">(${item.diff})</span></div><div class="lb-speed">${item.speed}s / q</div></div>`;
    });
    document.getElementById('leaderboard-list').innerHTML = lbHtml;

    let recent = filtered.slice(-10);
    let svg = document.getElementById('trend-graph');
    if(recent.length < 2) { svg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="gray">Play more to see graph</text>'; return; }
    let w = svg.clientWidth || 400, h = 150; let maxSpeed = Math.max(...recent.map(r => r.speed)) * 1.2; 
    let points = recent.map((r, i) => { let x = (i / (recent.length - 1)) * (w - 40) + 20; let y = h - ((r.speed / maxSpeed) * (h - 40)) - 20; return `${x},${y}`; }).join(' ');
    svg.innerHTML = `<polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>${recent.map((r, i) => { let x = (i / (recent.length - 1)) * (w - 40) + 20; let y = h - ((r.speed / maxSpeed) * (h - 40)) - 20; return `<circle cx="${x}" cy="${y}" r="4" fill="#f59e0b" /><text x="${x}" y="${y-10}" font-size="10" fill="gray" text-anchor="middle">${r.speed}</text>`; }).join('')}`;
}

// Missing Learn/BODMAS helper functions included for completeness
function generateLearnScreen() {
    let container = document.getElementById('learn-content'); container.innerHTML = "";
    targetNumbers.forEach(n => {
        let block = document.createElement('div'); block.className = "learn-block";
        let title = "Table of " + n;
        if(operation==='sq') title = "Square of " + n; else if(operation==='sqrt') title = "Square Root of " + n; else if(operation==='cube') title = "Cube of " + n; else if(operation==='cuberoot') title = "Cube Root of " + n;
        let html = `<h3>${title}</h3>`;
        if (operation === 'table') { for(let i=1; i<=10; i++) html += `<div class="learn-line">${n} × ${i} = ${n*i}</div>`; }
        else if (operation === 'sq') { html += `<div class="learn-line">${n}² = ${n*n}</div>`; }
        else if (operation === 'sqrt') { html += `<div class="learn-line">√${n*n} = ${n}</div>`; }
        else if (operation === 'cube') { html += `<div class="learn-line">${n}³ = ${n*n*n}</div>`; }
        else if (operation === 'cuberoot') { html += `<div class="learn-line">∛${n*n*n} = ${n}</div>`; }
        block.innerHTML = html; container.appendChild(block);
    });
    showScreen('screen-learn');
}

function generatePracticePool() {
    practicePool = [];
    targetNumbers.forEach(n => {
        if (operation === 'table') { for(let i=1; i<=10; i++) practicePool.push({ txt: `${n} × ${i} = `, ans: n*i }); }
        else if (operation === 'sq') { practicePool.push({ txt: `${n}² = `, ans: n*n }); }
        else if (operation === 'sqrt') { practicePool.push({ txt: `√${n*n} = `, ans: n }); }
        else if (operation === 'cube') { practicePool.push({ txt: `${n}³ = `, ans: n*n*n }); }
        else if (operation === 'cuberoot') { practicePool.push({ txt: `∛${n*n*n} = `, ans: n }); }
    });
}

function evaluateBodmasArray(tokens, isFraction) {
    let temp = [];
    for(let i=0; i<tokens.length; i++) {
        if (tokens[i] === '*' || tokens[i] === '/') {
            let op = tokens[i], left = temp.pop(), right = tokens[++i];
            temp.push(isFraction ? (op === '*' ? left.mul(right) : left.div(right)) : (op === '*' ? left * right : left / right));
        } else temp.push(tokens[i]);
    }
    let res = temp[0];
    for(let i=1; i<temp.length; i+=2) {
        let op = temp[i], right = temp[i+1];
        res = isFraction ? (op === '+' ? res.add(right) : res.sub(right)) : (op === '+' ? res + right : res - right);
    }
    return res;
}

function generateBODMAS() {
    let isFraction = (!isMultiplayer && bodmasNumType === 'fraction');
    let minN = 1, maxN = 9;
    if(diff === 'moderate') { minN = 2; maxN = 20; }
    if(diff === 'difficult') { minN = 5; maxN = 50; }
    if(diff === 'expert') { minN = 10; maxN = 99; }
    
    let opsCount = bodmasNumOps;
    let opsArr = bodmasAllowedOps;

    for(let r=0; r<500; r++) { 
        let tokens = [], displayStr = "";
        let n1 = getRandom(minN, maxN), d1 = isFraction ? getRandom(2, 5) : 1;
        tokens.push(isFraction ? new Frac(n1, d1) : n1); displayStr += (isFraction ? `${n1}/${d1}` : `${n1}`);
        let divByZero = false;

        for(let i=0; i<opsCount; i++) {
            let op = opsArr[Math.floor(Math.random()*opsArr.length)];
            let cMax = (op === '*' || op === '/') ? Math.min(maxN, 12) : maxN;
            let nextN = getRandom(minN, cMax), nextD = isFraction ? getRandom(2, 5) : 1;
            let nextVal = isFraction ? new Frac(nextN, nextD) : nextN;
            if (op === '/' && nextN === 0) divByZero = true;
            
            tokens.push(op); tokens.push(nextVal);
            let opChar = op === '*' ? '×' : (op === '/' ? '÷' : op);
            displayStr += ` ${opChar} ` + (isFraction ? `${nextN}/${nextD}` : `${nextN}`);
        }
        if(divByZero) continue;
        let res = evaluateBodmasArray(tokens, isFraction);
        if (!isFraction) {
            if (!Number.isInteger(res) || Math.abs(res) > (maxN * opsCount * 5)) continue;
            return { txt: displayStr + " =", str: res.toString(), val: res };
        } else {
            if (res.d === 0) continue;
            return { txt: displayStr + " =", str: res.toString(), val: res.n/res.d };
        }
    }
    return { txt: "Regenerate Failed =", str: "0", val: 0 };
}
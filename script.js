// Globals
let operation, isBodmasMode, isSpecialMode, activityMode, inputMode;
let diff, d1, d2, totalQuestions;
let targetNumbers = [], practicePool = []; 

let bodmasNumType, bodmasNumOps, bodmasAllowedOps = [];
let currentQ = 0, currentAnswerStr = "", currentAnswerVal = 0, currentTyped = "";
let timerInterval, secondsPassed = 0, mcqOptionsArray = [];

// Audio Context Setup
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
        osc.start(); osc.stop(audioCtx.currentTime + 0.15);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    }
}

// Theme Toggle
function toggleTheme() {
    const body = document.body;
    body.classList.toggle('light-mode');
    const isLight = body.classList.contains('light-mode');
    document.getElementById('theme-btn').innerText = isLight ? '🌙' : '☀️';
    localStorage.setItem('speedMathTheme', isLight ? 'light' : 'dark');
}
window.onload = () => {
    if(localStorage.getItem('speedMathTheme') === 'light') toggleTheme();
}

// Math Utility
class Frac {
    constructor(n, d) { this.n = n; this.d = d; this.simplify(); }
    simplify() { 
        let g = gcd(Math.abs(this.n), Math.abs(this.d)); 
        this.n/=g; this.d/=g; if(this.d < 0){this.n*=-1; this.d*=-1;} 
    }
    add(f) { return new Frac(this.n*f.d + f.n*this.d, this.d*f.d); }
    sub(f) { return new Frac(this.n*f.d - f.n*this.d, this.d*f.d); }
    mul(f) { return new Frac(this.n*f.n, this.d*f.d); }
    div(f) { return new Frac(this.n*f.d, this.d*f.n); }
    toString() { return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`; }
}
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function getRandom(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Navigation
function showScreen(screenId) {
    document.querySelectorAll('.container').forEach(c => c.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function goToScreen2() {
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
    showScreen('screen-2');
}

document.querySelectorAll('input[name="activity-mode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        if(this.value === 'learn') {
            document.getElementById('practice-config').classList.add('hidden');
            document.getElementById('start-btn').innerText = "Start Learning 📖";
        } else {
            document.getElementById('practice-config').classList.remove('hidden');
            document.getElementById('start-btn').innerText = "Start Practice 🚀";
        }
    });
});

function startSession() {
    // Clear any previous running timer (Fixes double speed bug)
    clearInterval(timerInterval);

    diff = document.getElementById('diff-select').value;
    
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
        if(targetNumbers.length === 0) { alert("Enter valid numbers!"); return; }
        
        if (activityMode === 'learn') { 
            generateLearnScreen(); 
            return; 
        } else { 
            generatePracticePool(); 
        }
    } else if (isBodmasMode) {
        bodmasNumType = document.querySelector('input[name="bodmas-type"]:checked').value;
        bodmasNumOps = parseInt(document.getElementById('bodmas-length').value);
        bodmasAllowedOps = Array.from(document.querySelectorAll('input[name="bodmas-ops"]:checked')).map(cb => cb.value);
        if(bodmasAllowedOps.length === 0) { alert("Select at least 1 operation!"); return; }
    } else {
        d1 = parseInt(document.getElementById('digit1').value);
        d2 = parseInt(document.getElementById('digit2').value);
    }

    inputMode = document.querySelector('input[name="input-mode"]:checked').value;
    totalQuestions = parseInt(document.getElementById('total-q').value);

    document.getElementById('typing-wrapper').classList.toggle('hidden', inputMode === 'mcq');
    document.getElementById('custom-keyboard').classList.toggle('hidden', inputMode === 'mcq');
    document.getElementById('mcq-wrapper').classList.toggle('hidden', inputMode !== 'mcq');

    let isFrac = isBodmasMode && bodmasNumType === 'fraction';
    document.getElementById('minus-key').classList.toggle('hidden', !isBodmasMode);
    document.getElementById('slash-key').classList.toggle('hidden', !isFrac);
    document.getElementById('custom-keyboard').classList.toggle('fraction-mode', isFrac);

    showScreen('screen-game');
    secondsPassed = 0; 
    timerInterval = setInterval(updateTimer, 1000);
    currentQ = 0; 
    loadNextQuestion();
}

// Generate Learn Screen content
function generateLearnScreen() {
    let container = document.getElementById('learn-content');
    container.innerHTML = "";

    targetNumbers.forEach(n => {
        let block = document.createElement('div');
        block.className = "learn-block";
        let title = "Table of " + n;
        if(operation==='sq') title = "Square of " + n;
        if(operation==='sqrt') title = "Square Root of " + n;
        if(operation==='cube') title = "Cube of " + n;
        if(operation==='cuberoot') title = "Cube Root of " + n;
        
        let html = `<h3>${title}</h3>`;
        
        if (operation === 'table') {
            for(let i=1; i<=10; i++) html += `<div class="learn-line">${n} × ${i} = ${n*i}</div>`;
        } else if (operation === 'sq') {
            html += `<div class="learn-line">${n}² = ${n*n}</div>`;
        } else if (operation === 'sqrt') {
            html += `<div class="learn-line">√${n*n} = ${n}</div>`;
        } else if (operation === 'cube') {
            html += `<div class="learn-line">${n}³ = ${n*n*n}</div>`;
        } else if (operation === 'cuberoot') {
            html += `<div class="learn-line">∛${n*n*n} = ${n}</div>`;
        }
        block.innerHTML = html;
        container.appendChild(block);
    });
    showScreen('screen-learn');
}

// Generate Practice Pool for Tables/Squares
function generatePracticePool() {
    practicePool = [];
    targetNumbers.forEach(n => {
        if (operation === 'table') {
            for(let i=1; i<=10; i++) practicePool.push({ txt: `${n} × ${i} = `, ans: n*i });
        } else if (operation === 'sq') {
            practicePool.push({ txt: `${n}² = `, ans: n*n });
        } else if (operation === 'sqrt') {
            practicePool.push({ txt: `√${n*n} = `, ans: n });
        } else if (operation === 'cube') {
            practicePool.push({ txt: `${n}³ = `, ans: n*n*n });
        } else if (operation === 'cuberoot') {
            practicePool.push({ txt: `∛${n*n*n} = `, ans: n });
        }
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
    let isFraction = (bodmasNumType === 'fraction');
    let minN = 1, maxN = 9;
    if(diff === 'moderate') { minN = 2; maxN = 20; }
    if(diff === 'difficult') { minN = 5; maxN = 50; }
    if(diff === 'expert') { minN = 10; maxN = 99; }

    for(let r=0; r<500; r++) { 
        let tokens = [], displayStr = "";
        let n1 = getRandom(minN, maxN), d1 = isFraction ? getRandom(2, 5) : 1;
        tokens.push(isFraction ? new Frac(n1, d1) : n1);
        displayStr += (isFraction ? `${n1}/${d1}` : `${n1}`);
        let divByZero = false;

        for(let i=0; i<bodmasNumOps; i++) {
            let op = bodmasAllowedOps[Math.floor(Math.random()*bodmasAllowedOps.length)];
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
            if (!Number.isInteger(res) || Math.abs(res) > (maxN * bodmasNumOps * 5)) continue;
            return { txt: displayStr + " =", str: res.toString(), val: res };
        } else {
            if (res.d === 0) continue;
            return { txt: displayStr + " =", str: res.toString(), val: res.n/res.d };
        }
    }
    return { txt: "Regenerate Failed =", str: "0", val: 0 };
}

function getRangeByDifficulty(digits, difficulty) {
    let min = Math.pow(10, digits - 1); if(digits === 1) min = 2;
    let max = Math.pow(10, digits) - 1; let range = max - min;
    if (difficulty === "easy") return { min: min, max: min + Math.floor(range * 0.3) };
    if (difficulty === "difficult") return { min: min + Math.floor(range * 0.5), max: max };
    if (difficulty === "expert") return { min: min + Math.floor(range * 0.8), max: max };
    return { min: min, max: max };
}

function loadNextQuestion() {
    currentQ++;
    if (currentQ > totalQuestions) { endPractice(); return; }

    document.getElementById('q-counter').innerText = `${currentQ}/${totalQuestions}`;
    currentTyped = ""; document.getElementById('answer-display').innerText = "";
    document.getElementById('error-message').classList.add('hidden');
    document.getElementById('answer-display').classList.remove('error');
    
    document.querySelectorAll('.mcq-btn').forEach(btn => { 
        btn.classList.remove('correct', 'wrong'); btn.disabled = false; btn.innerText = "";
    });

    let ansStr, ansVal, displayTxt;

    if (isSpecialMode) {
        if(practicePool.length === 0) generatePracticePool(); // Fallback
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

    currentAnswerStr = ansStr; currentAnswerVal = ansVal;
    let eqEl = document.getElementById('equation-text');
    eqEl.innerText = displayTxt;
    if (displayTxt.length > 20) eqEl.style.fontSize = "1.3rem";
    else if (displayTxt.length > 12) eqEl.style.fontSize = "1.8rem";
    else eqEl.style.fontSize = "2.2rem";

    if(inputMode === 'mcq') generateMCQOptions(ansStr, ansVal);
}

function generateMCQOptions(correctAnsStr, correctAnsVal) {
    let options = new Set(); options.add(correctAnsStr);
    while(options.size < 4) {
        let offset = getRandom(1, 15);
        let fakeVal = Math.random() > 0.5 ? correctAnsVal + offset : correctAnsVal - offset;
        options.add(fakeVal.toString());
    }
    mcqOptionsArray = Array.from(options).sort(() => Math.random() - 0.5);
    for(let i=0; i<4; i++) document.getElementById(`mcq-${i}`).innerText = mcqOptionsArray[i];
}

function checkMCQ(btn, index) {
    if (mcqOptionsArray[index] === currentAnswerStr) {
        playSound('correct');
        btn.classList.add('correct');
        document.querySelectorAll('.mcq-btn').forEach(b => b.disabled = true);
        setTimeout(loadNextQuestion, 250);
    } else {
        playSound('wrong');
        btn.classList.add('wrong'); btn.disabled = true;
    }
}

function keyPress(key) {
    if (inputMode === 'mcq') return;
    if (key === 'clear') currentTyped = ""; 
    else if (key === 'delete') currentTyped = currentTyped.slice(0, -1); 
    else currentTyped += key;
    
    document.getElementById('answer-display').innerText = currentTyped;
    
    let isCorrect = false;
    if (isBodmasMode && bodmasNumType === 'fraction' && currentTyped.includes('/')) {
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
        setTimeout(loadNextQuestion, 200); 
    } else if (currentTyped.length >= currentAnswerStr.length) {
        if(currentTyped !== "-" && currentTyped !== currentAnswerStr.substring(0, currentTyped.length)){
             playSound('wrong');
             document.getElementById('answer-display').classList.add('error');
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

// History & Progress functions
function endPractice() {
    clearInterval(timerInterval);
    let avgSpeed = (secondsPassed / totalQuestions).toFixed(1);
    
    // Setting up the specific save data
    let saveDiff = diff;
    if(isSpecialMode) saveDiff = 'Target: ' + document.getElementById('target-numbers').value;

    let history = JSON.parse(localStorage.getItem('sm_history') || '[]');
    history.push({
        date: new Date().toLocaleDateString(),
        op: isSpecialMode ? 'table/sq' : operation, 
        diff: saveDiff, 
        total: totalQuestions, 
        speed: parseFloat(avgSpeed)
    });
    localStorage.setItem('sm_history', JSON.stringify(history));

    showScreen('screen-result');
    document.getElementById('res-total').innerText = totalQuestions;
    let m = Math.floor(secondsPassed / 60).toString().padStart(2, '0');
    let s = (secondsPassed % 60).toString().padStart(2, '0');
    document.getElementById('res-time').innerText = `${m}:${s}`;
    document.getElementById('res-speed').innerText = `${avgSpeed} sec/q`;
}

function showHistory() {
    showScreen('screen-history');
    renderHistory();
}

function renderHistory() {
    let opFilter = document.getElementById('history-op-filter').value;
    let diffFilter = document.getElementById('history-diff-filter').value;
    let history = JSON.parse(localStorage.getItem('sm_history') || '[]');
    
    // Filtering Logic
    let filtered = history.filter(h => {
        let matchOp = (opFilter === 'all' || h.op === opFilter);
        let matchDiff = (diffFilter === 'all' || h.diff === diffFilter);
        // Table mode ignores diff filter because it uses custom target ranges
        if (h.op === 'table/sq') return matchOp; 
        return matchOp && matchDiff;
    });
    
    // Leaderboard logic
    let top10 = [...filtered].sort((a,b) => a.speed - b.speed).slice(0, 10);
    let lbHtml = top10.length === 0 ? '<p style="text-align:center; color:gray;">No data yet</p>' : '';
    top10.forEach((item, idx) => {
        let opName = item.op === 'table/sq' ? 'Special Mode' : item.op.toUpperCase();
        lbHtml += `<div class="lb-item">
            <div><span class="lb-rank">#${idx+1}</span> ${opName} <span style="font-size:0.8rem; color:gray">(${item.diff})</span></div>
            <div class="lb-speed">${item.speed}s / q</div>
        </div>`;
    });
    document.getElementById('leaderboard-list').innerHTML = lbHtml;

    // SVG Graph
    let recent = filtered.slice(-10);
    let svg = document.getElementById('trend-graph');
    if(recent.length < 2) {
        svg.innerHTML = '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="gray">Play more to see graph</text>';
        return;
    }

    let w = svg.clientWidth || 400, h = 150;
    let maxSpeed = Math.max(...recent.map(r => r.speed)) * 1.2; 
    let points = recent.map((r, i) => {
        let x = (i / (recent.length - 1)) * (w - 40) + 20;
        let y = h - ((r.speed / maxSpeed) * (h - 40)) - 20;
        return `${x},${y}`;
    }).join(' ');

    svg.innerHTML = `
        <polyline points="${points}" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round"/>
        ${recent.map((r, i) => {
            let x = (i / (recent.length - 1)) * (w - 40) + 20;
            let y = h - ((r.speed / maxSpeed) * (h - 40)) - 20;
            return `<circle cx="${x}" cy="${y}" r="4" fill="#f59e0b" />
                    <text x="${x}" y="${y-10}" font-size="10" fill="gray" text-anchor="middle">${r.speed}</text>`;
        }).join('')}
    `;
}
// ====================== 联机变量 ======================
let myRole = "";
let myPeerId = "";
let peer = null;
let connections = {};
let roomId = "";
let roomPassword = "";
let blueJoined = false;
let redJoined = false;

const roomPanel = document.getElementById("roomPanel");
const mainContainer = document.getElementById("mainContainer");

// 房间 DOM
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const createForm = document.getElementById("createForm");
const joinForm = document.getElementById("joinForm");
const confirmCreateBtn = document.getElementById("confirmCreateBtn");
const cancelCreateBtn = document.getElementById("cancelCreateBtn");
const confirmJoinBtn = document.getElementById("confirmJoinBtn");
const cancelJoinBtn = document.getElementById("cancelJoinBtn");
const roomMsg = document.getElementById("roomMsg");
const roomInfo = document.getElementById("roomInfo");
const displayRoomId = document.getElementById("displayRoomId");
const displayPassword = document.getElementById("displayPassword");
const blueStatus = document.getElementById("blueStatus");
const redStatus = document.getElementById("redStatus");
const selectBlueBtn = document.getElementById("selectBlue");
const selectRedBtn = document.getElementById("selectRed");
const joinRoleText = document.getElementById("joinRoleText");
const roleDisplay = document.getElementById("roleDisplay");
const blueCol = document.getElementById("blueCol");
const redCol = document.getElementById("redCol");

let selectedJoinRole = "";

// ====================== 房间面板逻辑 ======================
createRoomBtn.onclick = () => {
    createForm.style.display = "block";
    joinForm.style.display = "none";
    roomMsg.innerText = "";
};
joinRoomBtn.onclick = () => {
    joinForm.style.display = "block";
    createForm.style.display = "none";
    roomMsg.innerText = "";
    selectedJoinRole = "";
    joinRoleText.innerText = "未选择阵营";
    confirmJoinBtn.disabled = true;
    selectBlueBtn.classList.remove("selected");
    selectRedBtn.classList.remove("selected");
};
cancelCreateBtn.onclick = () => { createForm.style.display = "none"; };
cancelJoinBtn.onclick = () => { joinForm.style.display = "none"; };

selectBlueBtn.onclick = () => {
    selectedJoinRole = "blue";
    joinRoleText.innerText = "已选择：蓝方";
    confirmJoinBtn.disabled = false;
    selectBlueBtn.classList.add("selected");
    selectRedBtn.classList.remove("selected");
};
selectRedBtn.onclick = () => {
    selectedJoinRole = "red";
    joinRoleText.innerText = "已选择：红方";
    confirmJoinBtn.disabled = false;
    selectRedBtn.classList.add("selected");
    selectBlueBtn.classList.remove("selected");
};

confirmCreateBtn.onclick = () => {
    const pw = document.getElementById("createPassword").value.trim();
    if (!pw) return alert("请设置房间密码");
    roomPassword = pw;
    roomId = "room-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    myRole = "judge";
    displayRoomId.innerText = roomId;
    displayPassword.innerText = roomPassword;
    roomInfo.style.display = "block";
    createForm.style.display = "none";
    initPeer(roomId);
    roomMsg.innerText = "房间已创建，等待双方加入...";
};

confirmJoinBtn.onclick = () => {
    const id = document.getElementById("joinRoomId").value.trim();
    const pw = document.getElementById("joinPassword").value.trim();
    if (!id || !pw) return alert("请输入房间ID和密码");
    if (!selectedJoinRole) return alert("请选择阵营");
    roomId = id;
    roomPassword = pw;
    myRole = selectedJoinRole;
    joinForm.style.display = "none";
    roomInfo.style.display = "none";
    initPeer("client-" + Date.now().toString(36));
    roomMsg.innerText = "正在连接房间...";
};

// ====================== PeerJS ======================
function initPeer(id) {
    peer = new Peer(id, {
        debug: 0,
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        path: '/',
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });
    peer.on("open", (pid) => {
        myPeerId = pid;
        console.log("Peer 已启动:", pid);
        if (myRole !== "judge") connectToJudge();
    });
    peer.on("connection", (conn) => handleConnection(conn));
    peer.on("error", (err) => {
        console.error("Peer 错误:", err);
        roomMsg.innerText = "连接错误：" + err.message;
    });
    peer.on("disconnected", () => {
        console.log("断开连接，尝试重连...");
        peer.reconnect();
    });
}

function connectToJudge() {
    const conn = peer.connect(roomId, { reliable: true });
    handleConnection(conn);
}

function handleConnection(conn) {
    conn.on("open", () => {
        connections[conn.peer] = conn;
        conn.send({ type: "auth", role: myRole, password: roomPassword });
    });
    conn.on("data", (data) => handleData(data, conn));
    conn.on("close", () => delete connections[conn.peer]);
}

function handleData(data, conn) {
    switch (data.type) {
        case "auth":
            if (myRole === "judge") {
                if (data.password !== roomPassword) {
                    conn.send({ type: "error", msg: "密码错误" });
                    conn.close();
                    return;
                }
                if (data.role === "blue" && blueJoined) {
                    conn.send({ type: "error", msg: "蓝方已有人加入" });
                    conn.close();
                    return;
                }
                if (data.role === "red" && redJoined) {
                    conn.send({ type: "error", msg: "红方已有人加入" });
                    conn.close();
                    return;
                }
                conn.clientRole = data.role;
                if (data.role === "blue") blueJoined = true;
                if (data.role === "red") redJoined = true;
                updateRoomStatus();
                conn.send({ type: "auth_ok", role: data.role });
                if (!mainContainer.style.display || mainContainer.style.display === "none") enterMainUI();
                if (blueJoined && redJoined) roomMsg.innerText = "双方已就位，可以开始BP！";
            }
            break;
        case "auth_ok":
            myRole = data.role;
            enterMainUI();
            roomMsg.innerText = "已加入房间，阵营：" + (myRole === "blue" ? "蓝方" : "红方");
            break;
        case "error":
            alert(data.msg);
            roomMsg.innerText = data.msg;
            break;
        case "sync_state":
            if (data.from !== myPeerId) {
                receiveSync(data.state);
            }
            if (myRole === "judge") {
                broadcast(data);
            }
            break;
        case "select":
            if (data.from !== myPeerId) {
                receiveSelection(data);
            }
            if (myRole === "judge") {
                broadcast(data);
            }
            break;
        case "start_bp":
            if (myRole !== "judge") startBPFromJudge(data);
            break;
        case "reset":
            if (myRole !== "judge") fullResetAllSeries();
            break;
    }
}

function updateRoomStatus() {
    blueStatus.innerText = blueJoined ? "已就位" : "等待加入";
    redStatus.innerText = redJoined ? "已就位" : "等待加入";
}

function broadcast(data) {
    Object.values(connections).forEach(conn => { if (conn.open) conn.send(data); });
}

function enterMainUI() {
    roomPanel.style.display = "none";
    mainContainer.style.display = "block";
    roleDisplay.innerText = "身份：" + (myRole === "judge" ? "裁判" : myRole === "blue" ? "蓝方" : "红方");
    if (myRole === "blue") {
        redCol.style.pointerEvents = "none";
        redCol.style.opacity = "0.6";
    } else if (myRole === "red") {
        blueCol.style.pointerEvents = "none";
        blueCol.style.opacity = "0.6";
    }
    if (myRole === "judge") {
        blueCol.style.pointerEvents = "none";
        redCol.style.pointerEvents = "none";
        document.getElementById("centerPool").style.pointerEvents = "none";
        document.getElementById("confirmSelectBtn").style.display = "none";
    }
}

// ====================== 同步 ======================
function receiveSync(state) {
    matchType = state.matchType;
    currentRound = state.currentRound;
    maxRound = state.maxRound;
    globalUsedRoleIds = state.globalUsedRoleIds;
    battleStart = state.battleStart;
    roleStep = state.roleStep;
    skillStep = state.skillStep;
    usedRoleIds = state.usedRoleIds;
    usedSkillIds = state.usedSkillIds;
    bannedSkillIds = state.bannedSkillIds;
    blueRole = state.blueRole;
    redRole = state.redRole;
    blueSupport = state.blueSupport;
    redSupport = state.redSupport;
    supportPhase = state.supportPhase;
    refreshAll();
}

function receiveSelection(data) {
    const item = findItemById(data.itemId, data.poolType);
    if (item) executeSelectLocal(item);
}

function findItemById(id, poolType) {
    if (poolType === "role") return ROLE_POOL.find(x => x.id === id);
    if (poolType === "skill") return SKILL_POOL.find(x => x.id === id);
    if (poolType === "support") return SUPPORT_POOL.find(x => x.id === id);
    return null;
}

function syncState() {
    broadcast({
        type: "sync_state",
        from: myPeerId,
        state: {
            matchType, currentRound, maxRound, globalUsedRoleIds,
            battleStart, roleStep, skillStep,
            usedRoleIds, usedSkillIds, bannedSkillIds,
            blueRole, redRole, blueSupport, redSupport, supportPhase
        }
    });
}

function syncSelection(item, poolType) {
    broadcast({ type: "select", from: myPeerId, itemId: item.id, poolType });
}

// ====================== BP 变量 ======================
const ROLE_ORDER = ROLE_BP_ORDER;
const SKILL_ORDER = SKILL_BP_ORDER;
const ROLE_POOL = ROLE_LIST;
const SKILL_POOL = SKILL_LIST;
const SUPPORT_POOL = SUPPORT_LIST;
const SUPPORT_LIMIT = SUPPORT_MAX_NUM;
const TIME_LIMIT = COUNTDOWN_SEC;

const poolBox = document.getElementById("centerPool");
const mainStageText = document.getElementById("mainStage");
const stepText = document.getElementById("stepInfo");
const timerDom = document.getElementById("timerText");
const startBtn = document.getElementById("startBtn");
const resetAllBtn = document.getElementById("resetAllBtn");
const matchSelect = document.getElementById("matchSelect");
const roundNumDom = document.getElementById("roundNum");
const confirmSelectBtn = document.getElementById("confirmSelectBtn");
const blueRoleBanWrap = document.getElementById("blueRoleBan");
const redRoleBanWrap = document.getElementById("redRoleBan");
const bluePickWrap = document.getElementById("bluePickList");
const redPickWrap = document.getElementById("redPickList");
const blueSupportWrap = document.getElementById("blueSupport");
const redSupportWrap = document.getElementById("redSupport");
const banAudio = document.getElementById("banAudio");
const pickAudio = document.getElementById("pickAudio");

let matchType = "", currentRound = 0, maxRound = 0, globalUsedRoleIds = [], preSelectItem = null;
let battleStart = false, roundFinish = false, roleStep = 0, skillStep = 0;
let usedRoleIds = [], usedSkillIds = [], bannedSkillIds = [];
let blueRole = [], redRole = [], blueSupport = [], redSupport = [], supportPhase = 0;
let timerVal = TIME_LIMIT, timerInterval = null;
let lastBlueRoleCount = 0, lastRedRoleCount = 0;

// ====================== BP 函数 ======================
function clearTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }
function playBanSound() { banAudio.currentTime = 0; banAudio.play().catch(() => {}); }
function playPickSound() { pickAudio.currentTime = 0; pickAudio.play().catch(() => {}); }

function startTimer() {
    clearTimer();
    timerVal = TIME_LIMIT;
    timerDom.innerText = timerVal;
    timerDom.classList.remove("timer-warning");
    timerInterval = setInterval(() => {
        timerVal--;
        timerDom.innerText = timerVal;
        if (timerVal <= 4) timerDom.classList.add("timer-warning");
        else timerDom.classList.remove("timer-warning");
        if (timerVal <= 0) { clearTimer(); autoRandomPick(); }
    }, 1000);
}

function checkRoundComplete() {
    return roleStep >= ROLE_ORDER.length && skillStep >= SKILL_ORDER.length &&
           redSupport.length >= SUPPORT_LIMIT && blueSupport.length >= SUPPORT_LIMIT;
}

function getMainStage() {
    if (!matchType) return "等待选择BO3/BO5赛制";
    if (checkRoundComplete()) return `第${currentRound}局全部BP完成，可开启下一局`;
    if (!battleStart) return "等待点击开启本局BP";
    if (roleStep < ROLE_ORDER.length) return "角色BP阶段";
    if (skillStep < SKILL_ORDER.length) return "贝壳能力BP阶段";
    if (supportPhase === 1) return "援护阶段：红方选择4个援护（限时20秒）";
    if (supportPhase === 2) return "援护阶段：蓝方选择4个援护（限时20秒）";
    return `第${currentRound}局全部BP完成，可开启下一局`;
}

function getNowStep() {
    if (!matchType || checkRoundComplete() || !battleStart) return "无";
    const stage = getMainStage();
    if (stage === "角色BP阶段") return ROLE_ORDER[roleStep];
    if (stage === "贝壳能力BP阶段") return SKILL_ORDER[skillStep];
    if (supportPhase === 1) return "点击援护池选择红方援护（不可重复）";
    if (supportPhase === 2) return "点击援护池选择蓝方援护（不可重复）";
    return "";
}

function autoRandomPick() {
    const stage = getMainStage();
    if (stage.includes("角色BP")) {
        const pool = ROLE_POOL.filter(i => !usedRoleIds.includes(i.id) && !globalUsedRoleIds.includes(i.id));
        if (pool.length) executeSelect(pool[Math.floor(Math.random() * pool.length)]);
    } else if (stage.includes("贝壳能力BP")) {
        const pool = SKILL_POOL.filter(i => !usedSkillIds.includes(i.id));
        if (pool.length) executeSelect(pool[Math.floor(Math.random() * pool.length)]);
    } else if (supportPhase === 1) {
        while (redSupport.length < SUPPORT_LIMIT) {
            const all = [...blueRole.map(x => x.role.id), ...redRole.map(x => x.role.id)];
            const can = SUPPORT_POOL.filter(t => !redSupport.includes(t.id) && !all.includes(t.id));
            if (!can.length) break;
            const rnd = can[Math.floor(Math.random() * can.length)];
            redSupport.push(rnd.id);
            redSupportWrap.appendChild(makeSupportCard(rnd));
        }
        refreshAll(); supportPhase = 2; refreshAll(); startTimer();
    } else if (supportPhase === 2) {
        while (blueSupport.length < SUPPORT_LIMIT) {
            const all = [...blueRole.map(x => x.role.id), ...redRole.map(x => x.role.id)];
            const can = SUPPORT_POOL.filter(t => !blueSupport.includes(t.id) && !all.includes(t.id));
            if (!can.length) break;
            const rnd = can[Math.floor(Math.random() * can.length)];
            blueSupport.push(rnd.id);
            blueSupportWrap.appendChild(makeSupportCard(rnd));
        }
        refreshAll(); clearTimer(); finishCurrentRound();
    }
}

function finishCurrentRound() {
    roundFinish = true; battleStart = false; preSelectItem = null; confirmSelectBtn.disabled = true; refreshAll();
}

function renderPool() {
    poolBox.innerHTML = "";
    const stage = getMainStage();
    let list = [], used = [];
    const allPicked = [...blueRole.map(x => x.role.id), ...redRole.map(x => x.role.id)];
    if (stage.includes("角色BP")) { list = ROLE_POOL; used = [...usedRoleIds, ...globalUsedRoleIds]; }
    else if (stage.includes("贝壳能力BP")) { list = SKILL_POOL; used = usedSkillIds; }
    else { list = SUPPORT_POOL; if (supportPhase === 1) used = [...redSupport, ...allPicked]; if (supportPhase === 2) used = [...blueSupport, ...allPicked]; }
    list.forEach(item => {
        const div = document.createElement("div");
        div.className = "pool-card";
        if (used.includes(item.id)) div.classList.add("used");
        if (stage.includes("贝壳能力BP") && bannedSkillIds.includes(item.id)) div.classList.add("banned");
        if (preSelectItem && preSelectItem.id === item.id) div.classList.add("pre-select");
        div.innerHTML = `<img src="img/${item.img}"><p>${item.name}</p>`;
        div.onclick = () => setPreSelect(item);
        poolBox.appendChild(div);
    });
}

function setPreSelect(item) {
    if (!matchType) return alert("请先选择BO3/BO5赛制");
    if (!battleStart) return alert("请点击【开启本轮对局BP】");
    const stage = getMainStage();
    const all = [...blueRole.map(x => x.role.id), ...redRole.map(x => x.role.id)];
    if (stage.includes("角色BP")) { if (globalUsedRoleIds.includes(item.id) || usedRoleIds.includes(item.id)) return; }
    else if (stage.includes("贝壳能力BP")) { if (usedSkillIds.includes(item.id)) return; }
    else {
        if (supportPhase === 1 && (redSupport.includes(item.id) || all.includes(item.id))) return alert("红方不可重复/不可选择出战英雄作为援护");
        if (supportPhase === 2 && (blueSupport.includes(item.id) || all.includes(item.id))) return alert("蓝方不可重复/不可选择出战英雄作为援护");
    }
    preSelectItem = item;
    confirmSelectBtn.disabled = false;
    refreshAll();
}

function executeSelectLocal(item) {
    clearTimer();
    const stage = getMainStage();
    if (stage.includes("角色BP")) {
        const op = ROLE_ORDER[roleStep];
        usedRoleIds.push(item.id);
        if (op === "蓝ban角色" || op === "红ban角色") { playBanSound(); const c = makeBanCard(item); op === "蓝ban角色" ? blueRoleBanWrap.appendChild(c) : redRoleBanWrap.appendChild(c); }
        else { playPickSound(); if (!globalUsedRoleIds.includes(item.id)) globalUsedRoleIds.push(item.id); if (op === "蓝pick角色") blueRole.push({ role: item, skill: null }); else redRole.push({ role: item, skill: null }); }
        roleStep++; preSelectItem = null; confirmSelectBtn.disabled = true; refreshAll();
        if (getMainStage().includes("角色BP")) startTimer();
    } else if (stage.includes("贝壳能力BP")) {
        const op = SKILL_ORDER[skillStep];
        usedSkillIds.push(item.id);
        if (op === "红ban贝壳" || op === "蓝ban贝壳") { playBanSound(); bannedSkillIds.push(item.id); }
        else { playPickSound(); if (op.includes("红")) { for (let r of redRole) if (!r.skill) { r.skill = item; break; } } else { for (let r of blueRole) if (!r.skill) { r.skill = item; break; } } }
        skillStep++; preSelectItem = null; confirmSelectBtn.disabled = true; refreshAll();
        if (!getMainStage().includes("贝壳能力BP")) { supportPhase = 1; refreshAll(); startTimer(); } else startTimer();
    } else if (supportPhase === 1) {
        playPickSound(); redSupport.push(item.id); preSelectItem = null; confirmSelectBtn.disabled = true; refreshAll();
        if (redSupport.length >= SUPPORT_LIMIT) { supportPhase = 2; clearTimer(); refreshAll(); startTimer(); } else startTimer();
    } else if (supportPhase === 2) {
        playPickSound(); blueSupport.push(item.id); preSelectItem = null; confirmSelectBtn.disabled = true; refreshAll();
        if (blueSupport.length >= SUPPORT_LIMIT) { clearTimer(); finishCurrentRound(); } else startTimer();
    }
}

function executeSelect(item) {
    const stage = getMainStage();
    if (myRole === "blue") {
        const op = stage.includes("角色BP") ? ROLE_ORDER[roleStep] : stage.includes("贝壳能力BP") ? SKILL_ORDER[skillStep] : "";
        if (op && !op.includes("蓝") && supportPhase !== 2) return;
        if (supportPhase === 1) return;
    }
    if (myRole === "red") {
        const op = stage.includes("角色BP") ? ROLE_ORDER[roleStep] : stage.includes("贝壳能力BP") ? SKILL_ORDER[skillStep] : "";
        if (op && !op.includes("红") && supportPhase !== 1) return;
        if (supportPhase === 2) return;
    }
    if (myRole === "judge") return;
    executeSelectLocal(item);
    const poolType = stage.includes("角色BP") ? "role" : stage.includes("贝壳能力BP") ? "skill" : "support";
    syncSelection(item, poolType);
    syncState();
}

function makeBanCard(data) { const d = document.createElement("div"); d.className = "ban-card"; d.innerHTML = `<img src="img/${data.img}"><p>${data.name}</p>`; return d; }
function makeSupportCard(data) { const d = document.createElement("div"); d.className = "tl-card"; d.innerHTML = `<img src="img/${data.img}"><p>${data.name}</p>`; return d; }

function renderRoleList(wrap, arr, sideFlag) {
    const existingCount = wrap.querySelectorAll('.nin-item').length;
    const newCount = arr.length;
    const hasNewItem = newCount > existingCount;
    const newItemCount = newCount - existingCount;
    wrap.innerHTML = "";
    arr.forEach((obj, index) => {
        const item = document.createElement("div");
        item.className = "nin-item";
        const isNew = hasNewItem && (index >= newCount - newItemCount);
        if (isNew && sideFlag) item.classList.add("pick-enter");
        let skillHtml = "";
        if (obj.skill) skillHtml = `<div class="book-sub"><img src="img/${obj.skill.img}"><p>${obj.skill.name}</p></div>`;
        item.innerHTML = `<div class="nin-main"><img src="img/${obj.role.img}"><p>${obj.role.name}</p></div>${skillHtml}`;
        wrap.appendChild(item);
        if (isNew && sideFlag) {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                item.classList.add("pick-enter-active");
                item.addEventListener('animationend', function h(e) {
                    if (e.animationName === 'pickAppear') {
                        item.classList.remove("pick-enter", "pick-enter-active");
                        item.classList.add("fresh-glow");
                        item.addEventListener('animationend', function h2(e2) { if (e2.animationName === 'freshGlow') { item.classList.remove("fresh-glow"); item.removeEventListener('animationend', h2); } });
                    }
                    item.removeEventListener('animationend', h);
                });
            }));
        }
    });
    if (sideFlag === "blue") lastBlueRoleCount = newCount;
    if (sideFlag === "red") lastRedRoleCount = newCount;
}

function renderSupport() {
    blueSupportWrap.innerHTML = ""; redSupportWrap.innerHTML = "";
    redSupport.forEach(id => { const t = SUPPORT_POOL.find(x => x.id === id); redSupportWrap.appendChild(makeSupportCard(t)); });
    blueSupport.forEach(id => { const t = SUPPORT_POOL.find(x => x.id === id); blueSupportWrap.appendChild(makeSupportCard(t)); });
}

function refreshAll() {
    mainStageText.innerText = getMainStage();
    stepText.innerText = getNowStep();
    roundNumDom.innerText = currentRound;
    renderPool();
    renderRoleList(bluePickWrap, blueRole, "blue");
    renderRoleList(redPickWrap, redRole, "red");
    renderSupport();
}

function clearSingleRound() {
    clearTimer();
    battleStart = false; roundFinish = false; roleStep = 0; skillStep = 0; supportPhase = 0;
    preSelectItem = null; confirmSelectBtn.disabled = true;
    usedRoleIds = []; usedSkillIds = []; bannedSkillIds = [];
    blueRole = []; redRole = []; blueSupport = []; redSupport = [];
    lastBlueRoleCount = 0; lastRedRoleCount = 0;
    blueRoleBanWrap.innerHTML = ""; redRoleBanWrap.innerHTML = "";
    bluePickWrap.innerHTML = ""; redPickWrap.innerHTML = "";
    blueSupportWrap.innerHTML = ""; redSupportWrap.innerHTML = "";
    refreshAll();
}

function fullResetAllSeries() {
    clearTimer();
    matchType = ""; maxRound = 0; currentRound = 0; globalUsedRoleIds = [];
    preSelectItem = null; confirmSelectBtn.disabled = true; matchSelect.value = "";
    lastBlueRoleCount = 0; lastRedRoleCount = 0;
    clearSingleRound();
}

startBtn.onclick = function () {
    if (myRole !== "judge") return alert("只有裁判可以开始BP！");
    if (!blueJoined || !redJoined) return alert("双方未全部就位！");
    if (!matchType) return alert("请先在上方选择BO3或BO5赛制！");
    if (battleStart) return alert("当前对局BP正在进行中，无法重复开启");
    if (currentRound > 0 && !checkRoundComplete()) return alert("上一局BP未全部完成（援护未选满4个），无法开启下一局");
    if (currentRound >= maxRound) return alert(`已打完${maxRound}局，本轮系列赛结束，请点击【全部重置整轮系列赛】`);
    clearSingleRound();
    currentRound++;
    battleStart = true;
    refreshAll();
    startTimer();
    broadcast({ type: "start_bp", state: { matchType, maxRound } });
    syncState();
};

resetAllBtn.onclick = function () {
    if (myRole !== "judge") return alert("只有裁判可以重置！");
    fullResetAllSeries();
    broadcast({ type: "reset" });
    syncState();
};

function startBPFromJudge(data) {
    matchType = data.state.matchType;
    maxRound = data.state.maxRound;
    matchSelect.value = matchType;
    clearSingleRound();
    currentRound = 1;
    battleStart = true;
    refreshAll();
    startTimer();
}

confirmSelectBtn.onclick = function () { if (preSelectItem) executeSelect(preSelectItem); };

matchSelect.onchange = function () {
    if (myRole !== "judge") { this.value = matchType || ""; return alert("只有裁判可以切换赛制！"); }
    const val = this.value;
    if (val === "bo3") { matchType = "bo3"; maxRound = 3; }
    else if (val === "bo5") { matchType = "bo5"; maxRound = 5; }
    else { matchType = ""; maxRound = 0; }
    clearSingleRound();
};

window.onload = () => { fullResetAllSeries(); };

const poolTitleEl = document.getElementById("poolTitle");
const originRefresh = refreshAll;
refreshAll = function () {
    originRefresh();
    const opText = getNowStep();
    poolTitleEl.innerText = opText === "无" ? "" : opText;
    stepText.className = ""; poolTitleEl.className = "";
    let cls = "op-normal";
    if (opText.includes("蓝")) cls = "op-blue";
    if (opText.includes("红")) cls = "op-red";
    stepText.classList.add(cls); poolTitleEl.classList.add(cls);
};
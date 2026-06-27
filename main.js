// ====================== 纯手工 WebRTC，零服务器依赖 ======================
let myRole = "";
let myOriginalRole = "";
let pc = null;
let dataChannel = null;
let roomPassword = "";
let blueJoined = false;
let redJoined = false;
let spectatorCount = 0;

const roomPanel = document.getElementById("roomPanel");
const mainContainer = document.getElementById("mainContainer");

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const createForm = document.getElementById("createForm");
const joinForm = document.getElementById("joinForm");
const genInviteBtn = document.getElementById("genInviteBtn");
const inviteCodeBox = document.getElementById("inviteCodeBox");
const inviteCodeText = document.getElementById("inviteCodeText");
const copyInviteBtn = document.getElementById("copyInviteBtn");
const waitingMsg = document.getElementById("waitingMsg");
const inviteInput = document.getElementById("inviteInput");
const cancelCreateBtn = document.getElementById("cancelCreateBtn");
const confirmJoinBtn = document.getElementById("confirmJoinBtn");
const cancelJoinBtn = document.getElementById("cancelJoinBtn");
const roomMsg = document.getElementById("roomMsg");
const selectBlueBtn = document.getElementById("selectBlue");
const selectRedBtn = document.getElementById("selectRed");
const selectSpectatorBtn = document.getElementById("selectSpectator");
const joinRoleText = document.getElementById("joinRoleText");
const roleDisplay = document.getElementById("roleDisplay");
const blueCol = document.getElementById("blueCol");
const redCol = document.getElementById("redCol");

let selectedJoinRole = "";
let blueUsedSupportGlobal = [];
let redUsedSupportGlobal = [];
let pendingAnswer = null;

// ====================== WebRTC ======================
const iceConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.qq.com:3478' },
        { urls: 'stun:stun.miwifi.com:3478' }
    ]
};

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
    selectSpectatorBtn.classList.remove("selected");
    inviteInput.value = "";
};
cancelCreateBtn.onclick = () => { 
    createForm.style.display = "none"; 
    inviteCodeBox.style.display = "none"; 
    waitingMsg.style.display = "none";
    if (pc) { pc.close(); pc = null; }
};
cancelJoinBtn.onclick = () => { 
    joinForm.style.display = "none"; 
    if (pc) { pc.close(); pc = null; }
};

selectBlueBtn.onclick = () => {
    selectedJoinRole = "blue";
    joinRoleText.innerText = "已选择：蓝方";
    confirmJoinBtn.disabled = false;
    selectBlueBtn.classList.add("selected");
    selectRedBtn.classList.remove("selected");
    selectSpectatorBtn.classList.remove("selected");
};
selectRedBtn.onclick = () => {
    selectedJoinRole = "red";
    joinRoleText.innerText = "已选择：红方";
    confirmJoinBtn.disabled = false;
    selectRedBtn.classList.add("selected");
    selectBlueBtn.classList.remove("selected");
    selectSpectatorBtn.classList.remove("selected");
};
selectSpectatorBtn.onclick = () => {
    selectedJoinRole = "spectator";
    joinRoleText.innerText = "已选择：观众";
    confirmJoinBtn.disabled = false;
    selectSpectatorBtn.classList.add("selected");
    selectBlueBtn.classList.remove("selected");
    selectRedBtn.classList.remove("selected");
};

// 裁判：生成邀请码
genInviteBtn.onclick = () => {
    myRole = "judge";
    roomPassword = Math.random().toString(36).slice(2, 8);
    roomMsg.innerText = "正在生成邀请码...";
    
    pc = new RTCPeerConnection(iceConfig);
    dataChannel = pc.createDataChannel("bp", { ordered: true });
    setupDataChannel(dataChannel);
    
    pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        // 等待 ICE 收集完成
        waitForIceComplete(offer);
    });
    
    pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
            waitingMsg.innerText = "✅ 对方已连接！";
            roomMsg.innerText = "";
            dataChannel.send(JSON.stringify({ type: "auth_ok", role: "blue" }));
            setTimeout(() => {
                blueJoined = true;
                redJoined = true;
                enterMainUI();
            }, 500);
        }
    };
};

function waitForIceComplete(offer) {
    let timer = setTimeout(() => {
        const finalOffer = pc.localDescription;
        const invite = JSON.stringify({
            type: "offer",
            sdp: finalOffer.sdp,
            password: roomPassword
        });
        inviteCodeText.value = btoa(unescape(encodeURIComponent(invite)));
        inviteCodeBox.style.display = "block";
        waitingMsg.style.display = "block";
        roomMsg.innerText = "";
        waitingMsg.innerText = "等待对方连接...";
    }, 3000);
    
    pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") {
            clearTimeout(timer);
            const finalOffer = pc.localDescription;
            const invite = JSON.stringify({
                type: "offer",
                sdp: finalOffer.sdp,
                password: roomPassword
            });
            inviteCodeText.value = btoa(unescape(encodeURIComponent(invite)));
            inviteCodeBox.style.display = "block";
            waitingMsg.style.display = "block";
            roomMsg.innerText = "";
            waitingMsg.innerText = "等待对方连接...";
        }
    };
}

copyInviteBtn.onclick = () => {
    inviteCodeText.select();
    document.execCommand("copy");
    alert("邀请码已复制！请通过QQ/微信发给对方");
};

// 加入者：粘贴邀请码
confirmJoinBtn.onclick = () => {
    const code = inviteInput.value.trim();
    if (!code) return alert("请粘贴邀请码");
    if (!selectedJoinRole) return alert("请选择阵营");
    
    try {
        const invite = JSON.parse(decodeURIComponent(escape(atob(code))));
        roomPassword = invite.password;
        myRole = selectedJoinRole;
        myOriginalRole = selectedJoinRole;
        
        roomMsg.innerText = "正在连接...";
        
        pc = new RTCPeerConnection(iceConfig);
        
        pc.ondatachannel = (event) => {
            dataChannel = event.channel;
            setupDataChannel(dataChannel);
            dataChannel.onopen = () => {
                dataChannel.send(JSON.stringify({ type: "auth", role: myRole, password: roomPassword }));
            };
        };
        
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") {
                roomMsg.innerText = "✅ 已连接！";
            }
        };
        
        pc.setRemoteDescription(new RTCSessionDescription({
            type: "offer",
            sdp: invite.sdp
        })).then(() => {
            return pc.createAnswer();
        }).then(answer => {
            return pc.setLocalDescription(answer);
        });
        
        joinForm.style.display = "none";
        
    } catch (e) {
        roomMsg.innerText = "邀请码无效，请检查";
    }
};

function setupDataChannel(ch) {
    ch.onopen = () => {
        console.log("数据通道已打开");
        if (myRole === "judge") {
            ch.send(JSON.stringify({ type: "auth_ok", role: "blue" }));
        }
    };
    
    ch.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleData(data);
    };
    
    ch.onclose = () => {
        console.log("数据通道关闭");
    };
}

function handleData(data) {
    switch (data.type) {
        case "auth":
            if (myRole === "judge") {
                if (data.password !== roomPassword) {
                    dataChannel.send(JSON.stringify({ type: "error", msg: "密码错误" }));
                    return;
                }
                if (data.role === "blue") blueJoined = true;
                if (data.role === "red") redJoined = true;
                dataChannel.send(JSON.stringify({ type: "auth_ok", role: data.role }));
                if (!mainContainer.style.display || mainContainer.style.display === "none") {
                    enterMainUI();
                }
            }
            break;
        case "auth_ok":
            myRole = data.role;
            myOriginalRole = data.role;
            enterMainUI();
            roomMsg.innerText = "已加入，身份：" + (myRole === "blue" ? "蓝方" : myRole === "red" ? "红方" : "观众");
            break;
        case "error":
            alert(data.msg);
            break;
        case "sync_state":
            if (myRole === "judge") {
                receiveSync(data.state);
                dataChannel.send(JSON.stringify(data));
            } else {
                receiveSync(data.state);
            }
            break;
        case "select":
            if (myRole === "judge") {
                receiveSelection(data);
                dataChannel.send(JSON.stringify(data));
            } else {
                receiveSelection(data);
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

function send(data) {
    if (dataChannel && dataChannel.readyState === "open") {
        dataChannel.send(JSON.stringify(data));
    }
}

// ====================== 换边 ======================
function getCurrentRole() {
    if (myRole === "judge" || myRole === "spectator") return myRole;
    if (currentRound % 2 === 0) {
        return myOriginalRole === "blue" ? "red" : "blue";
    }
    return myOriginalRole;
}

function updateSideByRound() {
    if (myRole === "judge" || myRole === "spectator") return;
    const currentRole = getCurrentRole();
    if (currentRole === "blue") {
        blueCol.style.pointerEvents = "auto"; blueCol.style.opacity = "1";
        redCol.style.pointerEvents = "none"; redCol.style.opacity = "0.6";
    } else {
        redCol.style.pointerEvents = "auto"; redCol.style.opacity = "1";
        blueCol.style.pointerEvents = "none"; blueCol.style.opacity = "0.6";
    }
}

function enterMainUI() {
    roomPanel.style.display = "none";
    mainContainer.style.display = "block";
    roleDisplay.innerText = "身份：" + (myRole === "judge" ? "裁判" : myRole === "blue" ? "蓝方" : myRole === "red" ? "红方" : "观众");
    if (myRole === "judge" || myRole === "spectator") {
        blueCol.style.pointerEvents = "none";
        redCol.style.pointerEvents = "none";
        document.getElementById("centerPool").style.pointerEvents = "none";
        document.getElementById("confirmSelectBtn").style.display = "none";
        if (myRole === "spectator") {
            document.getElementById("startBtn").style.display = "none";
            document.getElementById("resetAllBtn").style.display = "none";
            matchSelect.disabled = true;
        }
    } else {
        updateSideByRound();
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
    blueUsedSupportGlobal = state.blueUsedSupportGlobal || [];
    redUsedSupportGlobal = state.redUsedSupportGlobal || [];
    updateSideByRound();
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
    send({ type: "sync_state", state: {
        matchType, currentRound, maxRound, globalUsedRoleIds,
        battleStart, roleStep, skillStep,
        usedRoleIds, usedSkillIds, bannedSkillIds,
        blueRole, redRole, blueSupport, redSupport, supportPhase,
        blueUsedSupportGlobal, redUsedSupportGlobal
    }});
}

function syncSelection(item, poolType) {
    send({ type: "select", itemId: item.id, poolType });
}

// ====================== BP 变量和逻辑 ======================
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
    if (!matchType) return "等待选择BO3/BO5/BO7赛制";
    if (checkRoundComplete()) return '第' + currentRound + '局全部BP完成';
    if (!battleStart) return "等待点击开启本局BP";
    if (roleStep < ROLE_ORDER.length) return "角色BP阶段";
    if (skillStep < SKILL_ORDER.length) return "贝壳能力BP阶段";
    if (supportPhase === 1) return "红方选择援护";
    if (supportPhase === 2) return "蓝方选择援护";
    return '第' + currentRound + '局全部BP完成';
}

function getNowStep() {
    if (!matchType || checkRoundComplete() || !battleStart) return "无";
    const stage = getMainStage();
    if (stage === "角色BP阶段") return ROLE_ORDER[roleStep];
    if (stage === "贝壳能力BP阶段") return SKILL_ORDER[skillStep];
    if (supportPhase === 1) return "红方选择援护";
    if (supportPhase === 2) return "蓝方选择援护";
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
            const can = SUPPORT_POOL.filter(t => !redSupport.includes(t.id) && !all.includes(t.id) && !redUsedSupportGlobal.includes(t.id));
            if (!can.length) break;
            const rnd = can[Math.floor(Math.random() * can.length)];
            redSupport.push(rnd.id);
            if (!redUsedSupportGlobal.includes(rnd.id)) redUsedSupportGlobal.push(rnd.id);
            redSupportWrap.appendChild(makeSupportCard(rnd));
        }
        refreshAll(); supportPhase = 2; refreshAll(); startTimer();
    } else if (supportPhase === 2) {
        while (blueSupport.length < SUPPORT_LIMIT) {
            const all = [...blueRole.map(x => x.role.id), ...redRole.map(x => x.role.id)];
            const can = SUPPORT_POOL.filter(t => !blueSupport.includes(t.id) && !all.includes(t.id) && !blueUsedSupportGlobal.includes(t.id));
            if (!can.length) break;
            const rnd = can[Math.floor(Math.random() * can.length)];
            blueSupport.push(rnd.id);
            if (!blueUsedSupportGlobal.includes(rnd.id)) blueUsedSupportGlobal.push(rnd.id);
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
    else {
        list = SUPPORT_POOL;
        if (supportPhase === 1) used = [...redSupport, ...allPicked, ...redUsedSupportGlobal];
        if (supportPhase === 2) used = [...blueSupport, ...allPicked, ...blueUsedSupportGlobal];
    }
    list.forEach(item => {
        const div = document.createElement("div");
        div.className = "pool-card";
        if (used.includes(item.id)) div.classList.add("used");
        if (stage.includes("贝壳能力BP") && bannedSkillIds.includes(item.id)) div.classList.add("banned");
        if (preSelectItem && preSelectItem.id === item.id) div.classList.add("pre-select");
        div.innerHTML = '<img src="img/' + item.img + '"><p>' + item.name + '</p>';
        div.onclick = () => setPreSelect(item);
        poolBox.appendChild(div);
    });
}

function setPreSelect(item) {
    if (!matchType) return alert("请先选择赛制");
    if (!battleStart) return alert("请点击开启BP");
    const stage = getMainStage();
    const all = [...blueRole.map(x => x.role.id), ...redRole.map(x => x.role.id)];
    if (stage.includes("角色BP")) { if (globalUsedRoleIds.includes(item.id) || usedRoleIds.includes(item.id)) return; }
    else if (stage.includes("贝壳能力BP")) { if (usedSkillIds.includes(item.id)) return; }
    else {
        if (supportPhase === 1 && (redSupport.includes(item.id) || all.includes(item.id) || redUsedSupportGlobal.includes(item.id))) return;
        if (supportPhase === 2 && (blueSupport.includes(item.id) || all.includes(item.id) || blueUsedSupportGlobal.includes(item.id))) return;
    }
    document.querySelectorAll('.pool-card.pre-select').forEach(card => card.classList.remove('pre-select'));
    preSelectItem = item;
    poolBox.querySelectorAll('.pool-card').forEach(card => {
        if (card.querySelector('p') && card.querySelector('p').innerText === item.name && !card.classList.contains('used') && !card.classList.contains('banned')) {
            card.classList.add('pre-select');
        }
    });
    confirmSelectBtn.disabled = false;
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
        playPickSound();
        redSupport.push(item.id);
        if (!redUsedSupportGlobal.includes(item.id)) redUsedSupportGlobal.push(item.id);
        preSelectItem = null; confirmSelectBtn.disabled = true; refreshAll();
        if (redSupport.length >= SUPPORT_LIMIT) { supportPhase = 2; clearTimer(); refreshAll(); startTimer(); } else startTimer();
    } else if (supportPhase === 2) {
        playPickSound();
        blueSupport.push(item.id);
        if (!blueUsedSupportGlobal.includes(item.id)) blueUsedSupportGlobal.push(item.id);
        preSelectItem = null; confirmSelectBtn.disabled = true; refreshAll();
        if (blueSupport.length >= SUPPORT_LIMIT) { clearTimer(); finishCurrentRound(); } else startTimer();
    }
}

function executeSelect(item) {
    const stage = getMainStage();
    const currentRole = getCurrentRole();
    if (currentRole === "blue") {
        const op = stage.includes("角色BP") ? ROLE_ORDER[roleStep] : stage.includes("贝壳能力BP") ? SKILL_ORDER[skillStep] : "";
        if (op && !op.includes("蓝") && supportPhase !== 2) return;
        if (supportPhase === 1) return;
    }
    if (currentRole === "red") {
        const op = stage.includes("角色BP") ? ROLE_ORDER[roleStep] : stage.includes("贝壳能力BP") ? SKILL_ORDER[skillStep] : "";
        if (op && !op.includes("红") && supportPhase !== 1) return;
        if (supportPhase === 2) return;
    }
    if (myRole === "judge" || myRole === "spectator") return;
    executeSelectLocal(item);
    syncSelection(item, stage.includes("角色BP") ? "role" : stage.includes("贝壳能力BP") ? "skill" : "support");
    syncState();
}

function makeBanCard(data) { const d = document.createElement("div"); d.className = "ban-card"; d.innerHTML = '<img src="img/' + data.img + '"><p>' + data.name + '</p>'; return d; }
function makeSupportCard(data) { const d = document.createElement("div"); d.className = "tl-card"; d.innerHTML = '<img src="img/' + data.img + '"><p>' + data.name + '</p>'; return d; }

function renderRoleList(wrap, arr, sideFlag) {
    wrap.innerHTML = "";
    arr.forEach((obj, index) => {
        const item = document.createElement("div");
        item.className = "nin-item";
        let skillHtml = "";
        if (obj.skill) skillHtml = '<div class="book-sub"><img src="img/' + obj.skill.img + '"><p>' + obj.skill.name + '</p></div>';
        item.innerHTML = '<div class="nin-main"><img src="img/' + obj.role.img + '"><p>' + obj.role.name + '</p></div>' + skillHtml;
        wrap.appendChild(item);
    });
    if (sideFlag === "blue") lastBlueRoleCount = arr.length;
    if (sideFlag === "red") lastRedRoleCount = arr.length;
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
    blueRoleBanWrap.innerHTML = ""; redRoleBanWrap.innerHTML = "";
    bluePickWrap.innerHTML = ""; redPickWrap.innerHTML = "";
    blueSupportWrap.innerHTML = ""; redSupportWrap.innerHTML = "";
    refreshAll();
}

function fullResetAllSeries() {
    clearTimer();
    matchType = ""; maxRound = 0; currentRound = 0; globalUsedRoleIds = [];
    preSelectItem = null; confirmSelectBtn.disabled = true; matchSelect.value = "";
    blueUsedSupportGlobal = [];
    redUsedSupportGlobal = [];
    clearSingleRound();
}

startBtn.onclick = function () {
    if (myRole !== "judge") return alert("只有裁判可以开始BP！");
    if (!matchType) return alert("请先选择赛制！");
    if (battleStart) return alert("当前BP进行中！");
    if (currentRound >= maxRound) return alert('已打完，请重置');
    clearSingleRound();
    currentRound++;
    battleStart = true;
    updateSideByRound();
    refreshAll();
    startTimer();
    send({ type: "start_bp", state: { matchType, maxRound } });
    syncState();
};

resetAllBtn.onclick = function () {
    if (myRole !== "judge") return alert("只有裁判可以重置！");
    fullResetAllSeries();
    send({ type: "reset" });
    syncState();
};

function startBPFromJudge(data) {
    matchType = data.state.matchType;
    maxRound = data.state.maxRound;
    matchSelect.value = matchType;
    clearSingleRound();
    currentRound = 1;
    battleStart = true;
    updateSideByRound();
    refreshAll();
    startTimer();
}

confirmSelectBtn.onclick = function () { if (preSelectItem) executeSelect(preSelectItem); };

matchSelect.onchange = function () {
    if (myRole !== "judge") { this.value = matchType || ""; return; }
    const val = this.value;
    if (val === "bo3") { matchType = "bo3"; maxRound = 3; }
    else if (val === "bo5") { matchType = "bo5"; maxRound = 5; }
    else if (val === "bo7") { matchType = "bo7"; maxRound = 7; }
    else { matchType = ""; maxRound = 0; }
    clearSingleRound();
};

window.onload = () => { fullResetAllSeries(); };

const poolTitleEl = document.getElementById("poolTitle");
const originRefresh = refreshAll;
refreshAll = function () {
    originRefresh();
    poolTitleEl.innerText = getNowStep() === "无" ? "" : getNowStep();
};
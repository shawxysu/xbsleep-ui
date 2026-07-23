const config = window.APP_CONFIG;

const API_VERSION = "2022-11-28";
const DEFAULT_CREDENTIAL_NAME = "local-demo";
const DEFAULT_STATE = Object.freeze({ version: 1, operations: [] });
const DEFAULT_SLEEP_TIME = "00:00";
const DEMO_STARTING_POINTS = 100;
const DRAW_VIDEO_BY_RARITY = Object.freeze({
  SSR: "assets/ssr.mp4",
  SR: "assets/sr.mp4",
  R: "assets/r.mp4"
});
const RESCUE_CARD_EVALUATION = Object.freeze({
  points: 1,
  lateReset: false,
  label: "救场卡生效：按 1:00 前入睡，+1 分"
});
let token = "";
let currentState = clone(DEFAULT_STATE);
let busy = false;
let demoMode = false;
let dataTarget = null;
let calendarMonth = startOfMonth(new Date());
let loadedRecordDate = null;

const elements = {
  appTitle: document.querySelector("#appTitle"),
  connectionBadge: document.querySelector("#connectionBadge"),
  connectPanel: document.querySelector("#connectPanel"),
  connectForm: document.querySelector("#connectForm"),
  credentialUsername: document.querySelector("#credentialUsername"),
  tokenInput: document.querySelector("#tokenInput"),
  connectionMessage: document.querySelector("#connectionMessage"),
  appPanel: document.querySelector("#appPanel"),
  balanceValue: document.querySelector("#balanceValue"),
  weekNightsValue: document.querySelector("#weekNightsValue"),
  weekBonusHint: document.querySelector("#weekBonusHint"),
  ssrPityValue: document.querySelector("#ssrPityValue"),
  ssrChanceHint: document.querySelector("#ssrChanceHint"),
  srPityValue: document.querySelector("#srPityValue"),
  gainForm: document.querySelector("#gainForm"),
  sleepDateInput: document.querySelector("#sleepDateInput"),
  sleepTimeInput: document.querySelector("#sleepTimeInput"),
  rescueCardInput: document.querySelector("#rescueCardInput"),
  gainPreview: document.querySelector("#gainPreview"),
  drawButton: document.querySelector("#drawButton"),
  drawModal: document.querySelector("#drawModal"),
  drawVideo: document.querySelector("#drawVideo"),
  drawRarity: document.querySelector("#drawRarity"),
  drawReward: document.querySelector("#drawReward"),
  confirmDrawButton: document.querySelector("#confirmDrawButton"),
  refreshButton: document.querySelector("#refreshButton"),
  prevMonthButton: document.querySelector("#prevMonthButton"),
  nextMonthButton: document.querySelector("#nextMonthButton"),
  calendarTitle: document.querySelector("#calendarTitle"),
  calendarGrid: document.querySelector("#calendarGrid"),
  repositoryLabel: document.querySelector("#repositoryLabel"),
  disconnectButton: document.querySelector("#disconnectButton")
};

initialize();

function initialize() {
  elements.appTitle.textContent = config?.APP_TITLE || "我们的早睡养肤小约定";
  elements.repositoryLabel.textContent = "每一次认真早睡，都会被好好记住。";
  elements.sleepDateInput.value = defaultSleepDate();
  elements.sleepDateInput.max = formatLocalDate(new Date());
  elements.sleepTimeInput.value = DEFAULT_SLEEP_TIME;
  updateGainPreview();

  elements.connectForm.addEventListener("submit", connect);
  elements.gainForm.addEventListener("submit", submitGain);
  elements.sleepDateInput.addEventListener("input", handleSleepDateChange);
  elements.sleepDateInput.addEventListener("change", handleSleepDateChange);
  elements.sleepTimeInput.addEventListener("input", updateGainPreview);
  elements.rescueCardInput.addEventListener("change", updateGainPreview);
  elements.drawButton.addEventListener("click", submitDraw);
  elements.confirmDrawButton.addEventListener("click", closeDrawModal);
  elements.refreshButton.addEventListener("click", refresh);
  elements.prevMonthButton.addEventListener("click", () => changeCalendarMonth(-1));
  elements.nextMonthButton.addEventListener("click", () => changeCalendarMonth(1));
  elements.disconnectButton.addEventListener("click", disconnect);

  try {
    validateConfig();
  } catch (error) {
    setStatus(formatError(error), "error");
    elements.connectForm.querySelector("button").disabled = false;
    elements.repositoryLabel.textContent = "填好后就能开始记录。";
    return;
  }
}

function validateConfig() {
  if (!config || !config.DATA_BRANCH || !config.STATE_PATH) {
    throw new Error("小站还没有准备好：私密小账本配置不完整。");
  }
}

async function connect(event) {
  event.preventDefault();
  const candidate = elements.tokenInput.value.trim();
  const targetValue = elements.credentialUsername.value.trim();

  if (isLocalDemoRequest(candidate, targetValue)) {
    startDemo();
    return;
  }
  const target = parseDataTarget(targetValue);
  if (!target) {
    setStatus("请输入小账本位置，例如 username/sleep-points-data。", "error");
    return;
  }
  if (!candidate) {
    setStatus(
      canUseLocalDemo()
        ? "请输入私密钥匙。只想本地试玩的话，把小账本位置留成 local-demo 或清空。"
        : "请输入私密钥匙。",
      "error"
    );
    return;
  }

  setBusy(true);
  setStatus("正在打开小站…", "");
  try {
    demoMode = false;
    dataTarget = target;
    token = candidate;
    const remote = await fetchState();
    currentState = remote.state;
    loadSelectedDateRecord();
    setConnected(true);
    render();
    setStatus("小站打开啦。如果 Chrome 询问是否保存钥匙，可以选择保存。", "success");
  } catch (error) {
    token = "";
    dataTarget = null;
    setConnected(false);
    setStatus(formatError(error), "error");
  } finally {
    setBusy(false);
  }
}

function startDemo() {
  demoMode = true;
  token = "";
  dataTarget = null;
  currentState = createDemoState();
  loadedRecordDate = null;
  closeDrawModal(false);
  setConnected(true);
  render();
  setStatus("本地试玩中：可以随便测试，刷新后会清空。", "success");
}

function disconnect() {
  const wasDemo = demoMode;
  demoMode = false;
  token = "";
  dataTarget = null;
  currentState = clone(DEFAULT_STATE);
  loadedRecordDate = null;
  elements.connectForm.reset();
  elements.credentialUsername.value = DEFAULT_CREDENTIAL_NAME;
  setConnected(false);
  closeDrawModal(false);
  setStatus(wasDemo ? "试玩已结束；本地记录已经清空。" : "小站已经锁上；私密钥匙也从页面里离开了。", "");
}

async function refresh() {
  if (demoMode) {
    render();
    setStatus("本地试玩记录还在当前页面里。", "success");
    return;
  }
  if (!token) return;
  setBusy(true);
  try {
    currentState = (await fetchState()).state;
    loadSelectedDateRecord();
    render();
  } catch (error) {
    setStatus(formatError(error), "error");
  } finally {
    setBusy(false);
  }
}

async function submitGain(event) {
  event.preventDefault();
  if ((!token && !demoMode) || busy) return;

  const sleepDate = elements.sleepDateInput.value;
  const sleepTime = elements.sleepTimeInput.value;
  const baseEvaluation = evaluateSleepTime(sleepTime);
  const useRescueCard = elements.rescueCardInput.checked;

  setBusy(true);
  setStatus("正在记下这一晚…", "");
  try {
    const transaction = await commitTransaction((state) => {
      assertState(state);
      if (useRescueCard && hasRescueCardForMonth(state.operations, sleepDate, sleepDate)) {
        throw new UserFacingError("这个月的救场卡已经用过啦。");
      }

      const evaluation = useRescueCard ? RESCUE_CARD_EVALUATION : baseEvaluation;

      const operation = {
        id: createOperationId(),
        type: "gain",
        sleepDate,
        sleepTime,
        points: evaluation.points,
        lateReset: evaluation.lateReset,
        rescueCard: useRescueCard || undefined,
        rescuedFrom: useRescueCard
          ? { points: baseEvaluation.points, lateReset: baseEvaluation.lateReset }
          : undefined,
        createdAt: new Date().toISOString()
      };
      state.operations.push(operation);

      return {
        state,
        message: `gain: ${sleepDate} ${sleepTime} (+${formatPoints(evaluation.points)}${useRescueCard ? ", rescue card" : ""})`,
        result: operation
      };
    });

    currentState = transaction.state;
    loadedRecordDate = sleepDate;
    render();
    updateGainPreview();
    setStatus(demoMode ? "试玩记录已更新；真实记录没有变化。" : "保存好啦，这一晚已经收进小账本。", "success");
  } catch (error) {
    setStatus(formatError(error), "error");
  } finally {
    setBusy(false);
  }
}

async function submitDraw() {
  if ((!token && !demoMode) || busy) return;

  let drawnOperation = null;
  setBusy(true);
  closeDrawModal(false);
  setStatus("正在抽取今晚的小奖励…", "");
  try {
    const transaction = await commitTransaction((state) => {
      assertState(state);
      const summary = calculateSummary(state.operations);
      if (summary.balance < 1) throw new UserFacingError("当前积分不足 1 分，无法抽奖。");

      const pity = calculatePity(state.operations);
      const draw = performDraw(pity);
      const operation = {
        id: createOperationId(),
        type: "consume",
        cost: 1,
        rarity: draw.rarity,
        reward: draw.reward,
        ssrPull: pity.ssrSince + 1,
        srPull: pity.srSince + 1,
        ssrProbability: draw.ssrProbability,
        createdAt: new Date().toISOString()
      };
      state.operations.push(operation);

      return {
        state,
        message: `consume: ${draw.rarity} - ${draw.reward}`,
        result: operation
      };
    });

    currentState = transaction.state;
    render();
    drawnOperation = transaction.result;
    setStatus(demoMode ? "试玩奖励已抽出；真实记录没有变化。" : "抽好啦，奖励已经写进小账本。", "success");
  } catch (error) {
    setStatus(formatError(error), "error");
  } finally {
    setBusy(false);
    if (drawnOperation) showDrawResult(drawnOperation);
  }
}

async function commitTransaction(mutator) {
  if (demoMode) {
    const transaction = mutator(clone(currentState));
    return {
      state: transaction.state,
      result: transaction.result,
      commitSha: "demo"
    };
  }

  let lastConflict = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remote = await fetchState();
    const transaction = mutator(clone(remote.state));
    const response = await putState(transaction.state, remote.sha, transaction.message);

    if (response.ok) {
      const body = await response.json();
      return {
        state: transaction.state,
        result: transaction.result,
        commitSha: body.commit?.sha || "unknown"
      };
    }

    if (response.status === 409) {
      lastConflict = new Error("小账本刚刚更新过，正在再试一次。");
      continue;
    }

    throw await githubError(response);
  }

  throw lastConflict || new Error("这次没有保存成功，请同步后再试。");
}

function createDemoState() {
  return {
    version: 1,
    operations: [{
      id: createOperationId(),
      type: "grant",
      points: DEMO_STARTING_POINTS,
      reason: "local-demo",
      createdAt: new Date().toISOString()
    }]
  };
}

async function fetchState() {
  const response = await githubFetch(contentsUrl(true), { method: "GET" });

  if (response.status === 404) {
    await verifyDataTarget();
    return { state: clone(DEFAULT_STATE), sha: null };
  }
  if (!response.ok) throw await githubError(response);

  const body = await response.json();
  const text = decodeBase64Utf8(body.content || "");
  const state = JSON.parse(text);
  assertState(state);
  return { state, sha: body.sha };
}

async function verifyDataTarget() {
  const target = requireDataTarget();
  const owner = encodeURIComponent(target.owner);
  const repo = encodeURIComponent(target.repo);
  const branch = encodeURIComponent(config.DATA_BRANCH);

  const repositoryResponse = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`, { method: "GET" });
  if (!repositoryResponse.ok) throw await githubError(repositoryResponse);

  const branchResponse = await githubFetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}`, { method: "GET" });
  if (!branchResponse.ok) throw await githubError(branchResponse);
}

async function putState(state, sha, message) {
  const payload = {
    message,
    content: encodeBase64Utf8(`${JSON.stringify(state, null, 2)}\n`),
    branch: config.DATA_BRANCH
  };
  if (sha) payload.sha = sha;

  return githubFetch(contentsUrl(false), {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

function githubFetch(url, options) {
  return fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": API_VERSION,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
}

function contentsUrl(includeRef) {
  const target = requireDataTarget();
  const path = config.STATE_PATH.split("/").map(encodeURIComponent).join("/");
  const base = `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/contents/${path}`;
  return includeRef ? `${base}?ref=${encodeURIComponent(config.DATA_BRANCH)}` : base;
}

function calculateSummary(operations) {
  const gains = effectiveGains(operations);
  const grants = operations.filter((operation) => operation.type === "grant");
  const consumes = operations.filter((operation) => operation.type === "consume");
  const gainPoints = gains.reduce((total, operation) => total + Number(operation.points || 0), 0);
  const grantPoints = grants.reduce((total, operation) => total + Number(operation.points || 0), 0);
  const basePoints = roundHalf(gainPoints + grantPoints);
  const weekly = calculateWeeklyBonuses(gains);
  const spent = consumes.reduce((total, operation) => total + Number(operation.cost || 1), 0);

  return {
    basePoints,
    weeklyBonus: weekly.confirmedBonus,
    spent,
    balance: roundHalf(basePoints + weekly.confirmedBonus - spent),
    currentWeek: weekly.currentWeek
  };
}

function calculateWeeklyBonuses(gains) {
  const weeks = new Map();
  for (const gain of gains) {
    const key = mondayKey(gain.sleepDate);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(gain);
  }

  const today = startOfDay(new Date());
  let confirmedBonus = 0;

  for (const [key, entries] of weeks) {
    const weekStart = parseLocalDate(key);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    if (weekEnd >= today) continue;
    confirmedBonus += bonusForWeek(entries);
  }

  const currentKey = mondayKey(formatLocalDate(today));
  const currentEntries = weeks.get(currentKey) || [];
  const qualifyingNights = currentEntries.filter((entry) => Number(entry.points) > 0).length;
  const invalidated = currentEntries.some((entry) => Boolean(entry.lateReset));

  return {
    confirmedBonus,
    currentWeek: {
      qualifyingNights,
      invalidated,
      projectedBonus: bonusForWeek(currentEntries)
    }
  };
}

function bonusForWeek(entries) {
  if (entries.some((entry) => Boolean(entry.lateReset))) return 0;
  const qualifying = entries.filter((entry) => Number(entry.points) > 0).length;
  if (qualifying === 7) return 2;
  if (qualifying >= 5) return 1;
  return 0;
}

function calculatePity(operations) {
  let ssrSince = 0;
  let srSince = 0;

  for (const operation of operations) {
    if (operation.type !== "consume") continue;
    if (operation.rarity === "SSR") {
      ssrSince = 0;
      srSince = 0;
    } else {
      ssrSince += 1;
      if (operation.rarity === "SR") srSince = 0;
      else srSince += 1;
    }
  }
  return { ssrSince, srSince };
}

function performDraw(pity) {
  const ssrPull = pity.ssrSince + 1;
  const srPull = pity.srSince + 1;
  const ssrProbability = probabilityForSsrPull(ssrPull);

  let rarity;
  if (secureRandom() < ssrProbability) rarity = "SSR";
  else if (srPull >= 9 || secureRandom() < 0.06) rarity = "SR";
  else rarity = "R";

  const pool = config.REWARDS?.[rarity];
  if (!Array.isArray(pool) || pool.length === 0) {
    throw new UserFacingError(`${rarityLabel(rarity)}还没有填奖励内容。`);
  }

  return {
    rarity,
    reward: pool[Math.floor(secureRandom() * pool.length)],
    ssrProbability
  };
}

function probabilityForSsrPull(pull) {
  if (pull <= 40) return 0.006;
  return Math.min(1, (pull - 40) * 0.1);
}

function evaluateSleepTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new UserFacingError("请选择有效的入睡时间。");
  const hour = Number(value.slice(0, 2));

  if (hour >= 18 || hour === 0) return { points: 1, lateReset: false, label: "超棒早睡夜：+1 分" };
  if (hour === 1) return { points: 0.5, lateReset: false, label: "认真早睡：+0.5 分" };
  if (hour === 2) return { points: 0, lateReset: false, label: "今晚不加分" };
  return { points: 0, lateReset: true, label: "0 分，本周连击奖励归零" };
}

function updateGainPreview() {
  const sleepDate = elements.sleepDateInput.value;
  const sleepTime = elements.sleepTimeInput.value;
  const useRescueCard = elements.rescueCardInput.checked;

  if (useRescueCard) {
    if (!sleepDate) {
      elements.gainPreview.textContent = "请选择是哪一晚，才能使用救场卡";
      return;
    }
    if (hasRescueCardForMonth(currentState.operations, sleepDate, sleepDate)) {
      elements.gainPreview.textContent = "这个月的救场卡已经用过啦";
      return;
    }
    if (!sleepTime) {
      elements.gainPreview.textContent = "救场卡已勾选，请再选择实际入睡时间";
      return;
    }
    elements.gainPreview.textContent = RESCUE_CARD_EVALUATION.label;
    return;
  }

  if (!sleepTime) {
    elements.gainPreview.textContent = "请选择入睡时间";
    return;
  }
  elements.gainPreview.textContent = evaluateSleepTime(sleepTime).label;
}

function handleSleepDateChange() {
  loadSelectedDateRecord();
  updateGainPreview();
}

function loadSelectedDateRecord() {
  const sleepDate = elements.sleepDateInput.value;
  if (!sleepDate) return false;

  const existing = effectiveGainForDate(currentState.operations, sleepDate);
  if (!existing) {
    elements.sleepTimeInput.value = DEFAULT_SLEEP_TIME;
    elements.rescueCardInput.checked = false;
    loadedRecordDate = null;
    return false;
  }

  elements.sleepTimeInput.value = existing.sleepTime || DEFAULT_SLEEP_TIME;
  elements.rescueCardInput.checked = Boolean(existing.rescueCard);
  loadedRecordDate = sleepDate;
  return true;
}

function render() {
  const summary = calculateSummary(currentState.operations);
  const pity = calculatePity(currentState.operations);
  const nextSsrPull = pity.ssrSince + 1;

  elements.balanceValue.textContent = formatPoints(summary.balance);
  elements.weekNightsValue.textContent = String(summary.currentWeek.qualifyingNights);
  elements.ssrPityValue.textContent = String(pity.ssrSince);
  elements.srPityValue.textContent = String(pity.srSince);
  elements.ssrChanceHint.textContent = `下抽概率 ${(probabilityForSsrPull(nextSsrPull) * 100).toFixed(nextSsrPull <= 40 ? 1 : 0)}%`;

  if (summary.currentWeek.invalidated) {
    elements.weekBonusHint.textContent = "本周奖励归零";
  } else if (summary.currentWeek.projectedBonus > 0) {
    elements.weekBonusHint.textContent = `周末 +${summary.currentWeek.projectedBonus} 分`;
  } else {
    elements.weekBonusHint.textContent = "满 5 晚有奖励";
  }

  elements.drawButton.disabled = busy || summary.balance < 1;
  renderCalendar(currentState.operations);
  updateGainPreview();
}

function changeCalendarMonth(offset) {
  calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + offset, 1);
  renderCalendar(currentState.operations);
}

function renderCalendar(operations) {
  const monthStart = startOfMonth(calendarMonth);
  const currentMonthStart = startOfMonth(new Date());
  const firstWeekday = monthStart.getDay();
  const daysBeforeMonth = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - daysBeforeMonth);
  const gainsByDate = effectiveGainsByDate(operations);
  const todayKey = formatLocalDate(new Date());

  elements.calendarTitle.textContent = formatMonthTitle(monthStart);
  elements.nextMonthButton.disabled = busy || monthStart >= currentMonthStart;
  elements.calendarGrid.replaceChildren();

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const dateKey = formatLocalDate(date);
    const gain = gainsByDate.get(dateKey);
    const day = document.createElement("div");
    const dayNumber = document.createElement("time");

    day.className = "calendar-day";
    dayNumber.className = "calendar-date";
    dayNumber.dateTime = dateKey;
    dayNumber.textContent = String(date.getDate());

    if (date.getMonth() !== monthStart.getMonth()) day.classList.add("calendar-day-muted");
    if (dateKey === todayKey) day.classList.add("calendar-day-today");

    if (gain) {
      day.classList.add(calendarClassForGain(gain));
      day.setAttribute("aria-label", `${dateKey}: ${calendarDescriptionForGain(gain)}`);
    } else {
      day.setAttribute("aria-label", `${dateKey}: 没有记录`);
    }

    day.append(dayNumber);
    elements.calendarGrid.append(day);
  }
}

function effectiveGains(operations) {
  return Array.from(effectiveGainsByDate(operations).values());
}

function effectiveGainForDate(operations, dateString) {
  return effectiveGainsByDate(operations).get(dateString) || null;
}

function effectiveGainsByDate(operations) {
  const gains = new Map();

  for (const operation of operations) {
    if (operation.type !== "gain" || !operation.sleepDate) continue;
    const existing = gains.get(operation.sleepDate);
    if (!existing || String(operation.createdAt || "").localeCompare(String(existing.createdAt || "")) >= 0) {
      gains.set(operation.sleepDate, operation);
    }
  }

  return gains;
}

function calendarClassForGain(gain) {
  if (gain.rescueCard) return "calendar-light-blue";
  if (gain.lateReset) return "calendar-light-red";
  if (Number(gain.points) >= 1) return "calendar-green";
  if (Number(gain.points) >= 0.5) return "calendar-light-green";
  return "calendar-light-yellow";
}

function calendarDescriptionForGain(gain) {
  if (gain.rescueCard) return `${gain.sleepTime} 入睡，救场卡生效，按 1:00 前计算`;
  if (gain.lateReset) return `${gain.sleepTime} 入睡，本周连击奖励归零`;
  if (Number(gain.points) >= 1) return `${gain.sleepTime} 入睡，超棒早睡夜`;
  if (Number(gain.points) >= 0.5) return `${gain.sleepTime} 入睡，认真早睡`;
  return `${gain.sleepTime} 入睡，今晚先不加分`;
}

function showDrawResult(operation) {
  elements.drawRarity.className = `rarity rarity-${operation.rarity}`;
  elements.drawRarity.textContent = rarityLabel(operation.rarity);
  elements.drawReward.textContent = operation.reward;
  elements.drawVideo.src = drawVideoForRarity(operation.rarity);
  elements.drawVideo.load();
  elements.drawModal.hidden = false;
  document.body.classList.add("modal-open");
  focusElement(elements.confirmDrawButton);

  const playPromise = elements.drawVideo.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {
      elements.drawVideo.controls = true;
    });
  }
}

function closeDrawModal(restoreFocus = true) {
  if (!elements.drawModal || elements.drawModal.hidden) return;
  elements.drawModal.hidden = true;
  document.body.classList.remove("modal-open");
  elements.drawVideo.pause();
  elements.drawVideo.removeAttribute("src");
  elements.drawVideo.controls = false;
  elements.drawVideo.load();
  if (restoreFocus) focusElement(elements.drawButton);
}

function drawVideoForRarity(rarity) {
  return DRAW_VIDEO_BY_RARITY[rarity] || DRAW_VIDEO_BY_RARITY.R;
}

function focusElement(element) {
  if (!element || typeof element.focus !== "function") return;
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

function rarityLabel(rarity) {
  if (rarity === "SSR") return "心动大奖";
  if (rarity === "SR") return "甜蜜小惊喜";
  return "暖暖小奖励";
}

function setConnected(connected) {
  elements.connectionBadge.textContent = connected ? (demoMode ? "试玩中" : "已开启") : "待开启";
  elements.connectionBadge.className = `badge ${connected ? "badge-online" : "badge-offline"}`;
  elements.connectPanel.hidden = connected;
  elements.appPanel.hidden = !connected;
  elements.disconnectButton.hidden = !connected;
}

function setBusy(value) {
  busy = value;
  for (const button of document.querySelectorAll("button")) button.disabled = value;
  if (!value && (token || demoMode)) render();
}

function setStatus(message, kind) {
  elements.connectionMessage.textContent = message;
  elements.connectionMessage.className = `status-message${kind ? ` ${kind}` : ""}`;
}

function assertState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.operations)) {
    throw new UserFacingError("私密小账本的格式不兼容，需要先整理一下。");
  }
}

function parseDataTarget(value) {
  const normalized = value
    .trim()
    .replace(/^https:\/\/github\.com\//i, "")
    .replace(/\/$/g, "")
    .replace(/\.git$/i, "");
  const parts = normalized.split("/");

  if (parts.length !== 2) return null;

  const [owner, repo] = parts;
  const validOwner = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner);
  const validRepo = /^[A-Za-z0-9._-]+$/.test(repo);

  if (!validOwner || !validRepo) return null;
  return { owner, repo };
}

function requireDataTarget() {
  if (!dataTarget) throw new UserFacingError("请先填写小账本位置。");
  return dataTarget;
}

function isLocalDemoRequest(candidate, targetValue) {
  return !candidate && (targetValue === DEFAULT_CREDENTIAL_NAME || (!targetValue && canUseLocalDemo()));
}

function canUseLocalDemo() {
  return ["localhost", "127.0.0.1", "::1", ""].includes(window.location.hostname);
}

async function githubError(response) {
  let detail = "";
  try {
    const body = await response.json();
    detail = body.message || "";
  } catch {
    detail = await response.text();
  }

  if (response.status === 401) return new UserFacingError("私密钥匙无效或已经过期。", response.status);
  if (response.status === 403) return new UserFacingError("这把钥匙暂时不能保存记录，请检查它是否有读写权限。", response.status);
  if (response.status === 404) return new UserFacingError("没有找到私密小账本，或者这把钥匙还打不开它。", response.status);
  if (response.status === 422) return new UserFacingError(`这次保存被拒绝了：${detail}`, response.status);
  return new UserFacingError(`小站暂时没有保存成功：${detail || response.statusText}`, response.status);
}

function formatError(error) {
  if (error instanceof SyntaxError) return "私密小账本暂时读不懂，需要整理一下。";
  return error?.message || "发生未知错误。";
}

function encodeBase64Utf8(value) {
  const bytes = encodeUtf8(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64Utf8(value) {
  const normalized = value.replace(/\s/g, "");
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return decodeUtf8(bytes);
}

function secureRandom() {
  const values = randomBytes(4);
  if (values.length < 4) return Math.random();
  const view = new DataView(values.buffer, values.byteOffset, values.byteLength);
  return view.getUint32(0) / 2 ** 32;
}

function createOperationId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = randomBytes(16);
  if (bytes.length === 16) {
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }

  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function randomBytes(length) {
  const values = new Uint8Array(length);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(values);
    return values;
  }
  for (let index = 0; index < values.length; index += 1) {
    values[index] = Math.floor(Math.random() * 256);
  }
  return values;
}

function encodeUtf8(value) {
  if (typeof TextEncoder === "function") return new TextEncoder().encode(value);

  const encoded = encodeURIComponent(value);
  const bytes = [];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === "%") {
      bytes.push(parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }
  return Uint8Array.from(bytes);
}

function decodeUtf8(bytes) {
  if (typeof TextDecoder === "function") return new TextDecoder().decode(bytes);

  let encoded = "";
  for (const byte of bytes) encoded += `%${byte.toString(16).padStart(2, "0")}`;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  }
}

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function roundHalf(value) {
  return Math.round((value + Number.EPSILON) * 2) / 2;
}

function formatPoints(value) {
  return Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1);
}

function defaultSleepDate() {
  const now = new Date();
  if (now.getHours() < 12) now.setDate(now.getDate() - 1);
  return formatLocalDate(now);
}

function mondayKey(dateString) {
  const date = parseLocalDate(dateString);
  const day = date.getDay();
  const distance = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + distance);
  return formatLocalDate(date);
}

function hasRescueCardForMonth(operations, dateString, ignoredDateString = null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const targetMonth = dateString.slice(0, 7);
  return effectiveGains(operations).some((operation) => {
    const operationDate = String(operation.sleepDate || "");
    return (
      operationDate !== ignoredDateString
      && operation.rescueCard
      && operationDate.slice(0, 7) === targetMonth
    );
  });
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthTitle(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long"
  }).format(date);
}

class UserFacingError extends Error {
  constructor(message, status = null) {
    super(message);
    this.name = "UserFacingError";
    this.status = status;
  }
}

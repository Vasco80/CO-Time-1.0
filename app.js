const clockElement = document.getElementById('clock');
const coLabelElement = document.getElementById('coLabel');
const coTimeElement = document.getElementById('coTime');
const countdownElement = document.getElementById('countdown');
const progressElement = document.getElementById('progress');
const flashElement = document.getElementById('flash');
const startButton = document.getElementById('startButton');
const setupScreen = document.getElementById('setupScreen');
const runScreen = document.getElementById('runScreen');
const finishScreen = document.getElementById('finishScreen');
const homeButton = document.getElementById('homeCoButton');
const setupButton = document.getElementById('setupButton');
const setupModal = document.getElementById('setupModal');
const saveSyncButton = document.getElementById('saveSyncButton');
const resetSyncButton = document.getElementById('resetSyncButton');
const closeSetupModalButton = document.getElementById('closeSetupModalButton');
const finishClockElement = document.getElementById('finishClock');
const STORAGE_KEY = 'co-time-checkpoints';
const SYNC_STORAGE_KEY = 'co-time-sync-offset';

let checkpoints = [];
let currentCheckpointIndex = 0;
let appState = 'SETUP';
let currentTargetTimestamp = 0;
let checkpointInputFields = [];
let timeOffsetMs = 0;
let syncOffsetValues = { minutes: 0, seconds: 0, centiseconds: 0 };

function setFieldInvalid(field) {
  field.style.borderColor = '#ff4d4f';
  field.style.boxShadow = '0 0 0 2px rgba(255, 77, 79, 0.2)';

  if (field.invalidTimer) {
    clearTimeout(field.invalidTimer);
  }

  field.invalidTimer = setTimeout(() => {
    field.style.borderColor = '';
    field.style.boxShadow = '';
  }, 600);
}

function clearFieldInvalid(field) {
  if (field.invalidTimer) {
    clearTimeout(field.invalidTimer);
  }

  field.style.borderColor = '';
  field.style.boxShadow = '';
}

function configureCheckpointInput(field) {
  field.setAttribute('inputmode', 'numeric');
  field.setAttribute('pattern', '[0-9]*');
  field.setAttribute('autocomplete', 'off');
  field.setAttribute('maxlength', '2');

  field.addEventListener('input', (event) => {
    const target = event.target;
    const value = target.value.replace(/\D/g, '').slice(0, 2);

    target.value = value;
    saveCheckpointInputsToStorage();

    if (!value) {
      clearFieldInvalid(target);
      return;
    }

    const suffix = target.id.slice(-2);
    const numericValue = Number.parseInt(value, 10);
    const isValid = suffix === 'hh'
      ? numericValue >= 0 && numericValue <= 23
      : numericValue >= 0 && numericValue <= 59;

    if (!isValid) {
      setFieldInvalid(target);
      return;
    }

    clearFieldInvalid(target);

    if (value.length === 2) {
      const currentIndex = checkpointInputFields.indexOf(target);
      const nextField = checkpointInputFields[currentIndex + 1];

      if (nextField) {
        nextField.focus();
        nextField.select();
      }
    }
  });

  field.addEventListener('keydown', (event) => {
    const target = event.target;
    const currentIndex = checkpointInputFields.indexOf(target);
    const previousField = checkpointInputFields[currentIndex - 1];
    const nextField = checkpointInputFields[currentIndex + 1];

    if (event.key === 'Backspace' && target.value === '') {
      event.preventDefault();
      if (previousField) {
        previousField.focus();
        previousField.select();
      }
      return;
    }

    if (event.key === 'ArrowRight' || event.key === 'Enter') {
      event.preventDefault();
      if (nextField) {
        nextField.focus();
        nextField.select();
      }
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (previousField) {
        previousField.focus();
        previousField.select();
      }
    }
  });

  field.addEventListener('focus', () => {
    field.select();
  });

  field.addEventListener('blur', () => {
    clearFieldInvalid(field);
    saveCheckpointInputsToStorage();
  });
}

function saveCheckpointInputsToStorage() {
  const checkpointValues = [];

  for (let index = 1; index <= 6; index += 1) {
    const hourInput = document.getElementById(`co${index}hh`);
    const minuteInput = document.getElementById(`co${index}mm`);
    const secondInput = document.getElementById(`co${index}ss`);

    checkpointValues.push({
      hour: hourInput ? hourInput.value : '',
      minute: minuteInput ? minuteInput.value : '',
      second: secondInput ? secondInput.value : '',
    });
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checkpointValues));
  } catch (error) {
    console.warn('Unable to save checkpoints', error);
  }
}

function loadCheckpointInputsFromStorage() {
  try {
    const savedValue = localStorage.getItem(STORAGE_KEY);

    if (!savedValue) {
      return;
    }

    const parsedValue = JSON.parse(savedValue);

    if (!Array.isArray(parsedValue)) {
      return;
    }

    parsedValue.forEach((checkpoint, index) => {
      const hourInput = document.getElementById(`co${index + 1}hh`);
      const minuteInput = document.getElementById(`co${index + 1}mm`);
      const secondInput = document.getElementById(`co${index + 1}ss`);

      if (hourInput) {
        hourInput.value = checkpoint && checkpoint.hour !== undefined && checkpoint.hour !== null ? String(checkpoint.hour) : '';
      }

      if (minuteInput) {
        minuteInput.value = checkpoint && checkpoint.minute !== undefined && checkpoint.minute !== null ? String(checkpoint.minute) : '';
      }

      if (secondInput) {
        secondInput.value = checkpoint && checkpoint.second !== undefined && checkpoint.second !== null ? String(checkpoint.second) : '';
      }
    });
  } catch (error) {
    console.warn('Unable to load checkpoints', error);
  }
}

function initCheckpointInputs() {
  checkpointInputFields = Array.from(document.querySelectorAll('input[id$="hh"], input[id$="mm"], input[id$="ss"]'));
  checkpointInputFields.forEach(configureCheckpointInput);
}

function getOffsetMillisecondsFromValues(values) {
  return (Number(values.minutes) || 0) * 60 * 1000 + (Number(values.seconds) || 0) * 1000 + (Number(values.centiseconds) || 0) * 10;
}

function getOffsetValuesFromMilliseconds(offsetMs) {
  const totalCentiseconds = Math.trunc(offsetMs / 10);
  const minutes = Math.trunc(totalCentiseconds / 6000);
  const seconds = Math.trunc((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return { minutes, seconds, centiseconds };
}

function getEffectiveTime() {
  return Date.now() + timeOffsetMs;
}

function updateSyncControls() {
  const minutesValueElement = document.getElementById('syncMinutesValue');
  const secondsValueElement = document.getElementById('syncSecondsValue');
  const centisecondsValueElement = document.getElementById('syncCentisecondsValue');

  if (minutesValueElement) {
    minutesValueElement.textContent = String(syncOffsetValues.minutes);
  }

  if (secondsValueElement) {
    secondsValueElement.textContent = String(syncOffsetValues.seconds);
  }

  if (centisecondsValueElement) {
    centisecondsValueElement.textContent = String(syncOffsetValues.centiseconds);
  }
}

function applyTimeOffset() {
  timeOffsetMs = getOffsetMillisecondsFromValues(syncOffsetValues);
  updateSyncControls();

  if (clockElement) {
    updateClock();
  }
}

function adjustSyncOffset(unit, delta) {
  syncOffsetValues[unit] = (syncOffsetValues[unit] || 0) + delta;
  applyTimeOffset();
}

function readCurrentSyncValuesFromControls() {
  const minutesValueElement = document.getElementById('syncMinutesValue');
  const secondsValueElement = document.getElementById('syncSecondsValue');
  const centisecondsValueElement = document.getElementById('syncCentisecondsValue');

  return {
    minutes: Number.parseInt(minutesValueElement ? minutesValueElement.textContent : '0', 10) || 0,
    seconds: Number.parseInt(secondsValueElement ? secondsValueElement.textContent : '0', 10) || 0,
    centiseconds: Number.parseInt(centisecondsValueElement ? centisecondsValueElement.textContent : '0', 10) || 0,
  };
}

function saveSyncOffsetToStorage() {
  const nextSyncValues = readCurrentSyncValuesFromControls();
  syncOffsetValues = nextSyncValues;
  applyTimeOffset();

  try {
    localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(syncOffsetValues));
  } catch (error) {
    console.warn('Unable to save time offset', error);
  }

  if (setupModal) {
    setupModal.hidden = true;
  }
}

function loadSyncOffsetFromStorage() {
  try {
    const savedValue = localStorage.getItem(SYNC_STORAGE_KEY);

    if (!savedValue) {
      return;
    }

    const parsedValue = JSON.parse(savedValue);

    if (parsedValue && typeof parsedValue === 'object') {
      syncOffsetValues = {
        minutes: Number(parsedValue.minutes) || 0,
        seconds: Number(parsedValue.seconds) || 0,
        centiseconds: Number(parsedValue.centiseconds) || 0,
      };
      applyTimeOffset();
      return;
    }

    const numericValue = Number.parseInt(savedValue, 10);

    if (!Number.isNaN(numericValue)) {
      syncOffsetValues = getOffsetValuesFromMilliseconds(numericValue);
      applyTimeOffset();
    }
  } catch (error) {
    console.warn('Unable to load time offset', error);
  }
}

function formatClock(now) {
  const date = now instanceof Date ? now : new Date(now);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const centiseconds = String(Math.floor(date.getMilliseconds() / 10)).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}.${centiseconds}`;
}

function updateClock() {
  if (!clockElement) {
    return;
  }

  const now = new Date(getEffectiveTime());
  clockElement.textContent = formatClock(now);

  if (finishClockElement) {
    finishClockElement.textContent = formatClock(now);
  }
}

function updateProgress(remainingMs) {
  if (!progressElement) {
    return;
  }

  if (remainingMs > 10000) {
    progressElement.style.width = '0%';
    progressElement.style.backgroundColor = '#00ff00';
    return;
  }

  const progressRatio = Math.max(0, Math.min(1, (10000 - remainingMs) / 10000));
  const hue = 120 * (1 - progressRatio);

  progressElement.style.width = `${progressRatio * 100}%`;
  progressElement.style.backgroundColor = `hsl(${hue}, 90%, 50%)`;
}

function buildTargetTimestamp(hour, minute, second) {
  const referenceTime = getEffectiveTime();
  const target = new Date(referenceTime);
  target.setHours(hour, minute, second, 0);

  if (target.getTime() <= referenceTime) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime();
}

function updateCountdown() {
  if (!countdownElement || appState !== 'RUNNING') {
    return;
  }

  if (checkpoints.length === 0) {
    return;
  }

  const checkpoint = checkpoints[currentCheckpointIndex];

  if (!checkpoint) {
    return;
  }

  const remainingMs = currentTargetTimestamp - getEffectiveTime();

  if (remainingMs <= 0) {
    if (!checkpoint.triggered) {
      checkpoint.triggered = true;
      nextCheckpoint();
    }

    countdownElement.textContent = '00:00.00';
    return;
  }

  const totalMinutes = Math.floor(remainingMs / (60 * 1000));
  const totalSeconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
  const centiseconds = Math.floor((remainingMs % 1000) / 10);

  const minutes = String(totalMinutes).padStart(2, '0');
  const seconds = String(totalSeconds).padStart(2, '0');
  const centisecondsText = String(centiseconds).padStart(2, '0');

  countdownElement.textContent = `${minutes}:${seconds}.${centisecondsText}`;

  if (remainingMs <= 10000 && remainingMs > 3000) {
    countdownElement.style.backgroundColor = '#C2410C';
    countdownElement.style.color = '#FFFFFF';
    countdownElement.style.textShadow = '0 0 8px rgba(255, 255, 255, 0.28)';
  } else if (remainingMs <= 3000) {
    countdownElement.style.backgroundColor = '#B91C1C';
    countdownElement.style.color = '#FFFFFF';
    countdownElement.style.textShadow = '0 0 8px rgba(255, 255, 255, 0.3)';
  } else {
    countdownElement.style.backgroundColor = 'transparent';
    countdownElement.style.color = '#f4e15a';
    countdownElement.style.textShadow = '0 0 6px rgba(244, 225, 90, 0.18)';
  }

  updateProgress(remainingMs);
}

function startClock() {
  if (!clockElement) {
    return;
  }

  let lastFrameTime = performance.now();

  updateClock();

  function tick(frameTime) {
    if (frameTime - lastFrameTime >= 8) {
      updateClock();
      lastFrameTime = frameTime;
    }

    if (appState === 'RUNNING') {
      updateCountdown();
    }

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function readCheckpoints() {
  checkpoints = [];

  for (let index = 1; index <= 6; index += 1) {
    const hourInput = document.getElementById(`co${index}hh`);
    const minuteInput = document.getElementById(`co${index}mm`);
    const secondInput = document.getElementById(`co${index}ss`);

    const hasValue = [hourInput, minuteInput, secondInput].some((input) => input && input.value.trim() !== '');

    if (!hasValue) {
      continue;
    }

    const hour = hourInput && hourInput.value !== '' ? parseInt(hourInput.value, 10) : 0;
    const minute = minuteInput && minuteInput.value !== '' ? parseInt(minuteInput.value, 10) : 0;
    const second = secondInput && secondInput.value !== '' ? parseInt(secondInput.value, 10) : 0;

    if (
      Number.isNaN(hour) || hour < 0 || hour > 23 ||
      Number.isNaN(minute) || minute < 0 || minute > 59 ||
      Number.isNaN(second) || second < 0 || second > 59
    ) {
      continue;
    }

    checkpoints.push({
      hour,
      minute,
      second,
      targetTimestamp: buildTargetTimestamp(hour, minute, second),
      triggered: false,
    });
  }
}

function showHomeScreen() {
  if (setupScreen) {
    setupScreen.hidden = true;
  }

  if (runScreen) {
    runScreen.hidden = false;
  }

  if (finishScreen) {
    finishScreen.hidden = true;
  }

  if (countdownElement) {
    countdownElement.hidden = true;
    countdownElement.textContent = '00:00.00';
  }

  if (coLabelElement) {
    coLabelElement.textContent = '';
  }

  if (coTimeElement) {
    coTimeElement.textContent = '';
  }
}

function showSetupScreen() {
  if (setupScreen) {
    setupScreen.hidden = false;
  }

  if (runScreen) {
    runScreen.hidden = true;
  }

  if (finishScreen) {
    finishScreen.hidden = true;
  }

  if (countdownElement) {
    countdownElement.hidden = true;
  }
}

function startMission() {
  saveCheckpointInputsToStorage();
  readCheckpoints();

  if (checkpoints.length === 0) {
    return;
  }

  appState = 'RUNNING';
  currentCheckpointIndex = 0;

  showHomeScreen();

  if (countdownElement) {
    countdownElement.hidden = false;
  }

  showCurrentCheckpoint();
}

function showCurrentCheckpoint() {
  if (!coLabelElement || !coTimeElement || checkpoints.length === 0) {
    return;
  }

  const checkpoint = checkpoints[currentCheckpointIndex];

  if (!checkpoint) {
    return;
  }

  coLabelElement.textContent = `CO ${currentCheckpointIndex + 1}/${checkpoints.length}`;
  coTimeElement.textContent = `${String(checkpoint.hour).padStart(2, '0')}:${String(checkpoint.minute).padStart(2, '0')}:${String(checkpoint.second).padStart(2, '0')}`;

  currentTargetTimestamp = checkpoint.targetTimestamp;

  if (progressElement) {
    progressElement.style.width = '0%';
    progressElement.style.backgroundColor = '#00ff00';
  }
}

function nextCheckpoint() {
  if (appState !== 'RUNNING') {
    return;
  }

  appState = 'TRANSITION';

  if (flashElement) {
    flashElement.classList.remove('flashOn');
    void flashElement.offsetWidth;
    flashElement.classList.add('flashOn');
  }

  setTimeout(() => {
    if (flashElement) {
      flashElement.classList.remove('flashOn');
    }

    currentCheckpointIndex += 1;

    if (currentCheckpointIndex < checkpoints.length) {
      showCurrentCheckpoint();
      appState = 'RUNNING';
    } else {
      finishMission();
    }
  }, 150);
}

function finishMission() {
  appState = 'FINISHED';

  if (runScreen) {
    runScreen.hidden = true;
  }

  if (finishScreen) {
    finishScreen.hidden = false;
  }

  if (progressElement) {
    progressElement.style.width = '0%';
    progressElement.style.backgroundColor = '';
  }
}

function resetMission() {
  appState = 'SETUP';
  showSetupScreen();

  for (let index = 1; index <= 6; index += 1) {
    const hourInput = document.getElementById(`co${index}hh`);
    const minuteInput = document.getElementById(`co${index}mm`);
    const secondInput = document.getElementById(`co${index}ss`);

    if (hourInput) {
      hourInput.value = '';
    }

    if (minuteInput) {
      minuteInput.value = '';
    }

    if (secondInput) {
      secondInput.value = '';
    }
  }

  checkpoints = [];
  currentCheckpointIndex = 0;
  currentTargetTimestamp = 0;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Unable to clear checkpoints', error);
  }

  if (countdownElement) {
    countdownElement.textContent = '00:00.00';
  }

  if (coLabelElement) {
    coLabelElement.textContent = '';
  }

  if (coTimeElement) {
    coTimeElement.textContent = '';
  }

  if (progressElement) {
    progressElement.style.width = '0%';
    progressElement.style.backgroundColor = '';
  }
}

if (startButton) {
  startButton.addEventListener('click', startMission);
}

if (homeButton) {
  homeButton.addEventListener('click', showSetupScreen);
}

const resetButton = document.getElementById('resetButton');
const backToHomeButton = document.getElementById('backToHomeButton');

if (setupButton) {
  setupButton.addEventListener('click', () => {
    if (setupModal) {
      setupModal.hidden = false;
    }
  });
}

if (setupModal) {
  setupModal.addEventListener('click', (event) => {
    if (event.target === setupModal) {
      setupModal.hidden = true;
    }
  });
}

if (closeSetupModalButton) {
  closeSetupModalButton.addEventListener('click', () => {
    if (setupModal) {
      setupModal.hidden = true;
    }
  });
}

if (saveSyncButton) {
  saveSyncButton.addEventListener('click', () => {
    saveSyncOffsetToStorage();
  });
}

if (resetSyncButton) {
  resetSyncButton.addEventListener('click', () => {
    syncOffsetValues = { minutes: 0, seconds: 0, centiseconds: 0 };
    applyTimeOffset();

    try {
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(syncOffsetValues));
    } catch (error) {
      console.warn('Unable to save time offset', error);
    }
  });
}

document.querySelectorAll('[data-sync-unit]').forEach((button) => {
  button.addEventListener('click', () => {
    const unit = button.getAttribute('data-sync-unit');
    const step = Number.parseInt(button.getAttribute('data-sync-step') || '1', 10);

    if (unit && Object.prototype.hasOwnProperty.call(syncOffsetValues, unit)) {
      adjustSyncOffset(unit, step);
    }
  });
});

if (resetButton) {
  resetButton.addEventListener('click', resetMission);
}

if (backToHomeButton) {
  backToHomeButton.addEventListener('click', () => {
    appState = 'SETUP';
    showHomeScreen();
  });
}

initCheckpointInputs();
loadCheckpointInputsFromStorage();
loadSyncOffsetFromStorage();
showHomeScreen();
startClock();

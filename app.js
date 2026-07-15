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

let checkpoints = [];
let currentCheckpointIndex = 0;
let appState = 'SETUP';

function formatClock(now) {
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const centiseconds = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}.${centiseconds}`;
}

function updateClock() {
  if (!clockElement) {
    return;
  }

  const now = new Date();
  clockElement.textContent = formatClock(now);
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

  const now = new Date();
  const currentTime = now.getTime();
  let targetTime = new Date(now);
  targetTime.setHours(checkpoint.hour, checkpoint.minute, checkpoint.second, 0);

  if (targetTime.getTime() <= currentTime) {
    const sameDayTime = new Date(targetTime.getTime());
    const nextDayTime = new Date(targetTime.getTime());
    nextDayTime.setDate(nextDayTime.getDate() + 1);

    const sameDayDelta = currentTime - sameDayTime.getTime();
    const nextDayDelta = currentTime - nextDayTime.getTime();

    if (sameDayDelta >= -100 && sameDayDelta <= 100) {
      countdownElement.textContent = '00:00.00';
      if (appState === 'RUNNING') {
        nextCheckpoint();
      }
      return;
    }

    if (nextDayDelta < 0) {
      targetTime = nextDayTime;
    } else {
      countdownElement.textContent = '00:00.00';
      if (appState === 'RUNNING') {
        nextCheckpoint();
      }
      return;
    }
  }

  let remainingMs = targetTime.getTime() - currentTime;

  if (remainingMs <= 0) {
    countdownElement.textContent = '00:00.00';
    if (appState === 'RUNNING') {
      nextCheckpoint();
    }
    return;
  }

  const totalMinutes = Math.floor(remainingMs / (60 * 1000));
  const totalSeconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
  const centiseconds = Math.floor((remainingMs % 1000) / 10);

  const minutes = String(totalMinutes).padStart(2, '0');
  const seconds = String(totalSeconds).padStart(2, '0');
  const centisecondsText = String(centiseconds).padStart(2, '0');

  countdownElement.textContent = `${minutes}:${seconds}.${centisecondsText}`;
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
      totalSeconds: hour * 3600 + minute * 60 + second,
    });
  }
}

function startMission() {
  readCheckpoints();

  if (checkpoints.length === 0) {
    return;
  }

  appState = 'RUNNING';
  currentCheckpointIndex = 0;

  if (setupScreen) {
    setupScreen.hidden = true;
  }

  if (runScreen) {
    runScreen.hidden = false;
  }

  if (finishScreen) {
    finishScreen.hidden = true;
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

function nextCheckpoint() {
  if (checkpoints.length === 0) {
    return;
  }

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
    } else {
      finishMission();
    }
  }, 150);
}

function resetMission() {
  if (setupScreen) {
    setupScreen.hidden = false;
  }

  if (runScreen) {
    runScreen.hidden = true;
  }

  if (finishScreen) {
    finishScreen.hidden = true;
  }

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
  appState = 'SETUP';

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

const resetButton = document.getElementById('resetButton');

if (resetButton) {
  resetButton.addEventListener('click', resetMission);
}

startClock();

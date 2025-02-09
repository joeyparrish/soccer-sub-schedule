(function() {
  const positions = {
    '231': ['GK', 'LD', 'RD', 'CM', 'LM', 'RM', 'ST', 'ALT'],
    '1212': ['GK', 'CB', 'LDM', 'RDM', 'CAM', 'LS', 'RS', 'ALT'],
  };

  function textInput(id) {
    return document.getElementById(id).value;
  }

  function numberInput(id) {
    const value = parseFloat(document.getElementById(id).value);
    return value;
  }

  function getPlayers() {
    const players = textInput('players')
        .trim().split('\n').filter(x => !!x.trim()).map(x => x.trim());
    players.sort();
    return players;
  }

  function getFormation() {
    const select = document.getElementById('formation');
    return select.value;
  }

  function forEachTime(callback) {
    const timePerHalf = numberInput('time-per-half');
    const schedulingInterval = numberInput('scheduling-interval');

    for (let time = 0; time < timePerHalf; time += schedulingInterval) {
      callback(time);
    }
  }

  function getPlayerAt(position, half, time) {
    const selectId = `select-${position}-${half}-${time}`;
    const select = document.getElementById(selectId);
    const player = select.value;
    const change = select.classList.contains('change');
    return {player, change, select};
  }

  function remakeRow(half, title, makeCell) {
    const schedule = document.getElementById(`schedule-${half}`);
    // Create the row if needed.
    const rowId = `row-${half}-${title}`;
    let row = document.getElementById(rowId);
    if (!row) {
      row = document.createElement('tr');
      row.id = rowId;
      schedule.appendChild(row);

      // Create the header and footer cells.
      const header = document.createElement('th');
      header.classList.add('header');
      header.innerText = title;
      row.appendChild(header);

      const footer = document.createElement('th');
      footer.classList.add('footer');
      footer.innerText = title;
      row.appendChild(footer);
    }

    // Mark the children so we can clean up unused children.
    for (const child of row.children) {
      child.visited = false;
    }
    // Exclude the header and footer cells.
    row.querySelector('th.header').visited = true;
    row.querySelector('th.footer').visited = true;

    // Create any cells that are missing.
    let colspan = 0;
    forEachTime((time) => {
      const cellId = `cell-${title}-${half}-${time}`;
      let cell = document.getElementById(cellId);
      if (!cell) {
        cell = makeCell(title, half, time);
        cell.id = cellId;
      }

      // If the cell is already in the list, it will be moved to the end.
      // This will have a side-effect or sorting all the cells.
      row.appendChild(cell);

      // Mark this cell so we don't clean it up later.
      cell.visited = true;
      colspan++;
    });

    const halfCell = document.getElementById(`half-${half}`);
    halfCell.setAttribute('colspan', colspan);

    // Clean up any cells we don't need.
    for (const child of Array.from(row.children)) {
      if (!child.visited) {
        row.removeChild(child);
      }
    }

    // Move the footer to the end.
    const footer = row.querySelector('th.footer');
    row.appendChild(footer);
  }

  function makeHeaderCell(_, half, time) {
    const cell = document.createElement('th');
    cell.classList.add(`half-${half}`);
    cell.innerText = time;
    return cell;
  }

  let shiftClick = false;
  let controlClick = false;

  function trackModifiers(event) {
    // Work around an ugly Chrome bug where key events don't fire while a
    // select field is open.  With this, we see the release of the modifier
    // while the select is still focused, and we activate the cascade after the
    // fact.  To keep it from happening multiple times, we then blur the
    // element.
    if (event.type == 'keyup' &&
        event.target.tagName.toLowerCase() == 'select') {
      const select = event.target;
      shiftClick =
          (event.code == 'ShiftLeft' || event.code == 'ShiftRight');
      controlClick =
          (event.code == 'ControlLeft' || event.code == 'ControlRight');

      if (shiftClick || controlClick) {
        cascadePlayer(select.value,
                      select.metadata.position,
                      select.metadata.half,
                      select.metadata.time,
                      /* overwrite= */ controlClick);
        computeOutputsAndErrors();
      }

      select.blur();
    }

    shiftClick = event.shiftKey;
    controlClick = event.ctrlKey;
  }

  function makeDataCell(position, half, time) {
    const cell = document.createElement('td');
    cell.classList.add(`half-${half}`);

    const select = document.createElement('select');
    select.id = `select-${position}-${half}-${time}`;
    select.metadata = { position, half, time };
    select.classList.add('player');

    select.addEventListener('mousedown', (event) => {
      trackModifiers(event);
      computeOutputsAndErrors();
    });

    select.addEventListener('change', () => {
      if (shiftClick || controlClick) {
        cascadePlayer(select.value, position, half, time,
                      /* overwrite */ controlClick);
      }
      computeOutputsAndErrors();
    });

    select.addEventListener('focus', computeOutputsAndErrors);
    select.addEventListener('blur', computeOutputsAndErrors);

    updatePlayerSelector(select);
    cell.appendChild(select);

    return cell;
  }

  function buildTables() {
    for (const half of [1, 2]) {
      remakeRow(half, '', makeHeaderCell);

      for (const position of positions[getFormation()]) {
        remakeRow(half, position, makeDataCell);
      }
    }
  }

  function updatePlayerSelector(select) {
    const players = getPlayers();

    // Mark the children and map their names so we can clean up unused children.
    const map = new Map();
    for (const option of select.children) {
      option.visited = false;
      map.set(option.value, option);
    }

    for (const player of [''].concat(players)) {
      let option = map.get(player);
      if (!option) {
        option = document.createElement('option');
        option.innerText = player;
        option.value = player;
      }

      // If the option is already in the list, it will be moved to the end.
      // This will have a side-effect or sorting all the options.
      select.appendChild(option);
      option.visited = true;
    }

    // Clean up any options we don't need.
    for (const option of Array.from(select.children)) {
      if (!option.visited) {
        select.removeChild(option);
      }
    }
  }

  function updatePlayerSelectors() {
    for (const select of document.querySelectorAll('select.player')) {
      updatePlayerSelector(select);
    }
  }

  function cascadePlayer(player, position, chosenHalf, chosenTime, overwrite) {
    forEachTime((time) => {
      if (time > chosenTime) {
        const selectId = `select-${position}-${chosenHalf}-${time}`;
        const select = document.getElementById(selectId);
        if (!select.value || overwrite) {
          select.value = player;
        }
      }
    });

    computeOutputsAndErrors();
  }

  function appendTimeline(timeline, message, style=null) {
    const div = document.createElement('div');
    div.innerText = message;
    div.style = style;
    timeline.appendChild(div);
  }

  function computeOutputsAndErrors() {
    const dupMap = new Map();
    const timeMap = new Map();
    const positionMap = new Map();
    const schedulingInterval = numberInput('scheduling-interval');
    const minTimePerPlayer = numberInput('min-time-per-player');

    for (const half of [1, 2]) {
      for (const position of positions[getFormation()]) {
        let previousPlayer = '';
        forEachTime((time) => {
          const {player, select} = getPlayerAt(position, half, time);

          if (player != previousPlayer) {
            select.classList.add('change');
          } else {
            select.classList.remove('change');
          }
          previousPlayer = player;

          if (!player) {
            select.classList.add('warning');
            return;
          } else {
            select.classList.remove('warning');
          }

          // Flag any player in two places at once.
          const playerTimeId = `${player}-${half}-${time}`;
          if (!dupMap.has(playerTimeId)) {
            dupMap.set(playerTimeId, position);
            select.classList.remove('error');
          } else {
            const position2 = dupMap.get(playerTimeId);
            const selectId2 = `select-${position2}-${half}-${time}`;
            const select2 = document.getElementById(selectId2);
            select.classList.add('error');
            select2.classList.add('error');
          }

          // Track player time.
          const previousTime = timeMap.get(player) || 0;
          timeMap.set(player, previousTime + schedulingInterval);

          // Track player positions.
          const playerPositions = positionMap.get(player) || new Set();
          playerPositions.add(position);
          positionMap.set(player, playerPositions);
        });
      }
    }

    const totals = document.getElementById('player-totals');
    const players = getPlayers();

    const count = document.getElementById('player-count');
    count.innerText = `${players.length} players`;

    // Mark the children so we can clean up unused children.
    for (const child of totals.children) {
      child.visited = false;
    }
    count.visited = true;

    for (const player of players) {
      const playerTotalId = `player-total-${player}`;
      let playerTotal = document.getElementById(playerTotalId);
      if (!playerTotal) {
        playerTotal = document.createElement('div');
        playerTotal.id = playerTotalId;
        totals.appendChild(playerTotal);
      }

      const minutes = timeMap.get(player) || 0;
      const playerPositions = Array.from(positionMap.get(player) || []).join(', ');

      playerTotal.innerText = `${player}: ${minutes} minutes at ${playerPositions}`;
      playerTotal.visited = true;
      if (minutes < minTimePerPlayer) {
        playerTotal.classList.add('error');
      } else {
        playerTotal.classList.remove('error');
      }
    }

    // Clean up any children we don't need.
    for (const child of Array.from(totals.children)) {
      if (!child.visited) {
        totals.removeChild(child);
      }
    }

    // Compute each player's timeline
    const playerTimeline = new Map();
    for (const player of players) {
      playerTimeline.set(player, new Map());
    }
    for (const half of [1, 2]) {
      forEachTime((time) => {
        for (const position of positions[getFormation()]) {
          const {player, change} = getPlayerAt(position, half, time);
          if (player) {
            playerTimeline.get(player).set(`${half}-${time}`, position);
          }
        }
      });
    }

    // Compute the substitution timeline
    const timeline = document.getElementById('timeline');
    for (const child of Array.from(timeline.children)) {
      if (child.tagName.toLowerCase() != 'h2') {
        timeline.removeChild(child);
      }
    }
    for (const half of [1, 2]) {
      const nth = ['', 'First', 'Second'][half];
      let previousTime = null;

      // Compute starters first
      const starters = [];
      for (const position of positions[getFormation()]) {
        const {player} = getPlayerAt(position, half, /* time= */ 0);
        starters.push(`${player} at ${position}`);
      }
      appendTimeline(timeline, `${nth} half start: ${starters.join(', ')}`,
                     'font-weight: bold');

      forEachTime((time) => {
        for (const position of positions[getFormation()]) {
          const {player, change} = getPlayerAt(position, half, time);

          const {player: previousPlayer} = previousTime != null ?
              getPlayerAt(position, half, previousTime) :
              {player: ''};

          const playerPreviousPosition = player ?
              playerTimeline.get(player).get(`${half}-${previousTime}`) :
              '';
          const previousPlayerNewPosition = previousPlayer ?
              playerTimeline.get(previousPlayer).get(`${half}-${time}`) :
              '';

          if (change) {
            if (time != 0) {  // starters already handled specially above
              if (playerPreviousPosition) {
                let message = `${time}: ${player} moves from ${playerPreviousPosition} to ${position}`;
                if (!previousPlayerNewPosition) {
                  message += `, ${previousPlayer} out`;
                }
                appendTimeline(timeline, message);
              } else {
                let message = `${time}: ${player} in at ${position}`;
                if (!previousPlayerNewPosition) {
                  message += `, ${previousPlayer} out`;
                }
                appendTimeline(timeline, message);
              }
            }
          }
        }

        previousTime = time;
      });

      appendTimeline(timeline, '', 'height: 1em');
    }

    checkSizes();

    updateHash();
  }

  function getState() {
    const state = {
      title: textInput('title'),
      timePerHalf: numberInput('time-per-half'),
      minTimePerPlayer: numberInput('min-time-per-player'),
      schedulingInterval: numberInput('scheduling-interval'),
      players: getPlayers(),
      formation: getFormation(),
      positions: {},
    };

    for (const position of positions[getFormation()]) {
      state.positions[position] = {};

      for (const half of [1, 2]) {
        forEachTime((time) => {
          const selectId = `select-${position}-${half}-${time}`;
          const select = document.getElementById(selectId);
          const player = select.value;

          state.positions[position][`${half}-${time}`] = player;
        });
      }
    }

    return state;
  }

  function loadState(state) {
    document.getElementById('time-per-half').value = state.timePerHalf;
    document.getElementById('min-time-per-player').value = state.minTimePerPlayer;
    document.getElementById('scheduling-interval').value = state.schedulingInterval;
    document.getElementById('players').value = state.players.join('\n') + '\n';
    document.getElementById('title').value = state.title || '';
    document.getElementById('formation').value = state.formation || '231';

    buildTables();
    updatePlayerSelectors();

    for (const position of positions[getFormation()]) {
      for (const half of [1, 2]) {
        forEachTime((time) => {
          const player = state.positions[position]?.[`${half}-${time}`] || '';
          const selectId = `select-${position}-${half}-${time}`;
          const select = document.getElementById(selectId);
          select.value = player;
        });
      }
    }
  }

  function buttonReaction(event, message) {
    const originalText = event.target.innerText;
    event.target.innerText = message;
    event.target.disabled = true;

    setTimeout(() => {
      event.target.innerText = originalText;
      event.target.disabled = false;
    }, 1000);
  }

  function compressState(state) {
    const stateU8 = new TextEncoder().encode(state);
    const stateZ = fflate.zlibSync(stateU8, { level: 9 });
    const stateZS = String.fromCharCode.apply(null, stateZ);
    const b64 = btoa(stateZS);
    return b64;
  }

  function decompressState(b64) {
    const stateZS = atob(b64);
    const stateZ = Uint8Array.from(stateZS, c => c.charCodeAt(0));
    const stateU8 = fflate.unzlibSync(stateZ);
    const state = new TextDecoder().decode(stateU8);
    return state;
  }

  function checkSizes() {
    const schedule = document.getElementById('schedule-1');
    if (schedule.clientWidth > document.body.clientWidth) {
      document.body.classList.add('too-small');
      console.error('TOO SMALL');
    } else {
      document.body.classList.remove('too-small');
      console.error('RIGHT SIZE');
    }
  }

  function updateHash() {
    const state = JSON.stringify(getState());
    console.log('Sharing state', state);
    const hash = compressState(state);
    console.log(`State compressed from ${state.length} to ${hash.length}`);

    location.hash = hash;
  }

  function loadHash() {
    const hash = location.hash.substr(1);
    if (hash) {
      const state = decompressState(hash);
      console.log('Loading from hash', state);
      loadState(JSON.parse(state));
    } else {
      const state = localStorage.getItem('state');
      if (state) {
        console.log('Loading state', state);
        loadState(JSON.parse(state));
      }
    }
  }

  function main() {
    window.addEventListener('resize', checkSizes);

    for (const input of document.querySelectorAll('input')) {
      input.addEventListener('change', () => {
        buildTables();
        computeOutputsAndErrors();
      });
    }

    document.getElementById('players').addEventListener('change', () => {
      updatePlayerSelectors();
      computeOutputsAndErrors();
    });

    document.getElementById('players').addEventListener('keypress', (event) => {
      if (event.code == 'Enter') {
        updatePlayerSelectors();
        computeOutputsAndErrors();
      }
    });

    document.addEventListener('keydown', trackModifiers);
    document.addEventListener('keyup', trackModifiers);

    document.getElementById('save').addEventListener('click', (event) => {
      localStorage.setItem('state', JSON.stringify(getState()));
      buttonReaction(event, 'Saved!');
    });

    document.getElementById('clear').addEventListener('click', () => {
      loadState({
        timePerHalf: 20,
        minTimePerPlayer: 14,
        schedulingInterval: 2,
        players: [],
        formation: document.getElementById('formation').options[0].value,
        positions: {},
      });
      computeOutputsAndErrors();
      buttonReaction(event, 'Cleared!');
    });

    document.getElementById('share').addEventListener('click', () => {
      updateHash();
      navigator.clipboard.writeText(location.href);
      buttonReaction(event, 'Link copied!');
    });

    document.getElementById('title').addEventListener('change', updateHash);

    document.getElementById('formation').addEventListener('change', () => {
      // Wipe the old tables.
      for (const half of [1, 2]) {
        const schedule = document.getElementById(`schedule-${half}`);
        for (const row of schedule.querySelectorAll('tr')) {
          if (row.id != 'halves') {
            schedule.removeChild(row);
          }
        }
      }

      // Build new ones.
      buildTables();
      computeOutputsAndErrors();
    });

    // The hashchange event fires on navigation, but not on location.hash=...
    window.addEventListener('hashchange', loadHash);

    loadHash();

    buildTables();

    computeOutputsAndErrors();
  }

  main();
})();

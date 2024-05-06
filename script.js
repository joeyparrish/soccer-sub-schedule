(function() {
  const positions = ['GK', 'LD', 'RD', 'LM', 'CM', 'RM', 'ST'];

  function numberInput(id) {
    const value = parseFloat(document.getElementById(id).value);
    return value;
  }

  function getPlayers() {
    const players = document.getElementById('players').value
        .trim().split('\n').filter(x => !!x.trim()).map(x => x.trim());
    players.sort();
    return players;
  }

  function forEachTime(callback) {
    const timePerHalf = numberInput('time-per-half');
    const schedulingInterval = numberInput('scheduling-interval');

    for (let time = 0; time < timePerHalf; time += schedulingInterval) {
      callback(time);
    }
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
      if (child.tagName.toLowerCase() == 'th') {
        child.visited = true;
        continue;
      }

      child.visited = false;
    }

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
        computeTotalsAndErrors();
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
      computeTotalsAndErrors();
    });

    select.addEventListener('change', () => {
      if (shiftClick || controlClick) {
        cascadePlayer(select.value, position, half, time,
                      /* overwrite */ controlClick);
      }
      computeTotalsAndErrors();
    });

    select.addEventListener('focus', computeTotalsAndErrors);
    select.addEventListener('blur', computeTotalsAndErrors);

    updatePlayerSelector(select);
    cell.appendChild(select);

    return cell;
  }

  function buildTables() {
    for (const half of [1, 2]) {
      remakeRow(half, '', makeHeaderCell);

      for (const position of positions) {
        remakeRow(half, position, makeDataCell);
      }
    }

    computeTotalsAndErrors();
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
    computeTotalsAndErrors();
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

    computeTotalsAndErrors();
  }

  function computeTotalsAndErrors() {
    const dupMap = new Map();
    const timeMap = new Map();
    const schedulingInterval = numberInput('scheduling-interval');
    const minTimePerPlayer = numberInput('min-time-per-player');

    for (const half of [1, 2]) {
      forEachTime((time) => {
        for (const position of positions) {
          const selectId = `select-${position}-${half}-${time}`;
          const select = document.getElementById(selectId);
          const player = select.value;
          if (!player) {
            select.classList.add('warning');
            continue;
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
        }
      });
    }

    const totals = document.getElementById('player-totals');
    const players = getPlayers();

    const countId = 'player-count';
    let count = document.getElementById(countId);
    if (!count) {
      count = document.createElement('div');
      count.id = countId;
      totals.appendChild(count);
    }
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
      playerTotal.innerText = `${player}: ${minutes} minutes`;
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

    dumpState();
  }

  function dumpState() {
    const state = {
      timePerHalf: numberInput('time-per-half'),
      minTimePerPlayer: numberInput('min-time-per-player'),
      schedulingInterval: numberInput('scheduling-interval'),
      players: getPlayers(),
      positions: {},
    };

    for (const position of positions) {
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

    console.log(JSON.stringify(state));
  }

  function loadState(state) {
    for (const position of positions) {
      for (const half of [1, 2]) {
        forEachTime((time) => {
          const player = state.positions[position][`${half}-${time}`] || '';

          const selectId = `select-${position}-${half}-${time}`;
          const select = document.getElementById(selectId);
          select.value = player;
        });
      }
    }

    document.getElementById('time-per-half').value = state.timePerHalf;
    document.getElementById('min-time-per-player').value = state.minTimePerPlayer;
    document.getElementById('scheduling-interval').value = state.schedulingInterval;
    document.getElementById('players').value = state.players.join('\n') + '\n';

    computeTotalsAndErrors();
  }

  function main() {
    for (const input of document.querySelectorAll('input')) {
      input.addEventListener('change', buildTables);
    }

    document.getElementById('players').addEventListener(
        'change', updatePlayerSelectors);
    document.getElementById('players').addEventListener(
        'keypress', (event) => {
      if (event.code == 'Enter') {
        updatePlayerSelectors();
      }
    });
    document.addEventListener('keydown', trackModifiers);
    document.addEventListener('keyup', trackModifiers);

    buildTables();
  }

  main();
})();

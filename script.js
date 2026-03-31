const board = document.getElementById('game-board');
const startBtn = document.getElementById('start-btn');

// 2. 몬스터가 이동할 경로(좌표) 배열 생성 (외곽을 따라 반시계 방향)
const path = [];

// 좌상단(0,0)에서 좌하단(0,7)으로 이동
for (let y = 0; y <= 7; y++) {
    path.push({ x: 0, y: y });
}
// 좌하단(1,7)에서 우하단(7,7)으로 이동 (0,7은 이미 들어갔으므로 x는 1부터 시작)
for (let x = 1; x <= 7; x++) {
    path.push({ x: x, y: 7 });
}
// 우하단(7,6)에서 우상단(7,0)으로 이동 (7,7은 이미 들어갔으므로 y는 6에서 0으로 감소)
for (let y = 6; y >= 0; y--) {
    path.push({ x: 7, y: y });
}

const tiles = [];

// 1. 보드판에 8x8(총 64개) 타일 생성 및 길 표시
for (let i = 0; i < 64; i++) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    const x = i % 8;
    const y = Math.floor(i / 8);
    // 경로에 해당하는 타일인지 확인하여 다른 색상 적용
    const isPath = path.some(p => p.x === x && p.y === y);
    if (isPath) {
        tile.classList.add('path-tile');
    }
    board.appendChild(tile);
    tiles.push(tile);
}

// 게임 상태 변수
let stage = 1;
let lives = 10;
let kills = 0;
let gold = 250; // 시작 골드 250 지급
let isGameOver = false;
let spawnInterval;
let spawnedCount = 0;
let baseMonsterHp = 100;
let currentMoveTime = 400; // 몬스터 기본 이동 시간 (0.4초)
const monsters = []; // 활성화된 몬스터 배열
const towers = []; // 설치된 타워 배열
const INITIAL_TOWER_COST = 100;
let currentTowerCost = INITIAL_TOWER_COST;

// UI 요소
const stageDisplay = document.getElementById('stage-display');
const livesDisplay = document.getElementById('lives-display');
const killsDisplay = document.getElementById('kills-display');
const goldDisplay = document.getElementById('gold-display');
const buildTowerBtn = document.getElementById('build-tower-btn');

// 초기 UI 업데이트
buildTowerBtn.style.display = 'none';
updateUI();

function updateUI() {
    stageDisplay.innerText = `Stage ${stage}`;
    killsDisplay.innerText = `☠️x${kills}`;
    livesDisplay.innerText = `❤️x${lives}`; // 하트 표시 방식 변경
    goldDisplay.innerText = `${Math.floor(gold)}🪙`; // 동전 이모티콘으로 변경
    buildTowerBtn.innerText = `타워 생성 (${currentTowerCost}🪙)`;
}

// 3. 게임 시작 버튼 클릭 이벤트 등록
startBtn.onclick = startGame; // 이벤트 중복 방지를 위해 onclick으로 수정
buildTowerBtn.addEventListener('click', buildTower);

function startGame() {
    // 게임 초기화
    stage = 1;
    lives = 10;
    kills = 0;
    gold = 250; // 초기 지급 골드
    baseMonsterHp = 100;
    currentMoveTime = 400; // 이동 시간 초기화
    currentTowerCost = INITIAL_TOWER_COST;
    isGameOver = false;

    // 기존 타워와 몬스터, 미사일 모두 제거
    resetBoard();

    updateUI();

    startWave();
}

function startNextStage() {
    stage++;
    baseMonsterHp = Math.floor(baseMonsterHp * 1.5); // 다음 스테이지 체력 50% 증가
    if (stage % 2 === 1) { // 2웨이브마다 (3, 5, 7...) 속도 10% 증가
        currentMoveTime = currentMoveTime / 1.1;
    }
    updateUI();
    startWave();
}

function startWave() {
    
    startBtn.style.display = 'none'; // 게임이 시작되면 시작 버튼 숨기기
    buildTowerBtn.style.display = 'block';
    
    spawnedCount = 0;
    const maxMonsters = 10; // 스테이지당 10마리

    // 1초 간격으로 몬스터 10마리를 순차적으로 생성하는 웨이브 로직
    spawnInterval = setInterval(() => {
        if (isGameOver) {
            clearInterval(spawnInterval);
            return;
        }
        if (spawnedCount >= maxMonsters) {
            clearInterval(spawnInterval); // 10마리가 다 나오면 생성 중지
            return;
        }
        spawnMonster();
        spawnedCount++;
    }, 1000); 
}

// 4. 몬스터 생성 및 이동 로직
function spawnMonster() {
    const monster = document.createElement('div');
    monster.className = 'monster';
    
    // 랜덤 속성 부여 (회오리, 얼음, 독가스)
    const types = ['tornado', 'ice', 'poison'];
    const randomType = types[Math.floor(Math.random() * types.length)];
    monster.classList.add(randomType);
    monster.pathIndex = 0; // Set initial path index
    
    // 체력 및 체력바 설정
    monster.maxHp = baseMonsterHp;
    monster.hp = baseMonsterHp;
    const hpContainer = document.createElement('div');
    hpContainer.className = 'hp-bar-container';
    const hpFill = document.createElement('div');
    hpFill.className = 'hp-bar-fill';
    hpContainer.appendChild(hpFill);
    monster.appendChild(hpContainer);

    board.appendChild(monster);
    monsters.push(monster); // 활성화된 몬스터 배열에 추가

    let pathIndex = 0;
    
    // 생성 직후 몬스터를 출발지점(경로의 첫번째 위치)에 배치합니다.
    updateMonsterPosition(monster, path[pathIndex]);

    // 렌더링 후 동적 계산된 시간에 맞춰 애니메이션 적용
    requestAnimationFrame(() => {
        monster.style.transition = `left ${currentMoveTime / 1000}s linear, top ${currentMoveTime / 1000}s linear`;
    });

    // currentMoveTime 간격으로 다음 칸으로 이동
    monster.moveInterval = setInterval(() => {
        // 게임 오버 상태면 이동 중지
        if (isGameOver) {
            clearInterval(monster.moveInterval);
            return;
        }

        pathIndex++;
        monster.pathIndex = pathIndex; // Update monster's own pathIndex property
        if (pathIndex >= path.length) {
            clearInterval(monster.moveInterval); // 경로의 끝에 다다르면 이동 타이머 정지
            // 몬스터 배열에서도 제거
            const monsterIndex = monsters.indexOf(monster);
            if (monsterIndex > -1) monsters.splice(monsterIndex, 1);
            monster.remove(); // 도착 지점(우상단)에서 화면에서 삭제
            
            // 몬스터가 무사히 통과하면 체력 감소
            loseLife();
            checkWaveComplete();
            return;
        }
        updateMonsterPosition(monster, path[pathIndex]);
    }, currentMoveTime); // CSS의 transition 속도와 맞춰서 부드럽게 이어지게 합니다.
}

// 체력 감소 및 게임 오버 처리
function loseLife() {
    lives--;
    updateUI();
    
    if (lives <= 0) {
        gameOver();
    }
}

function gameOver() {
    isGameOver = true;
    
    buildTowerBtn.style.display = 'none';
    resetBoard(); // 보드 위의 모든 게임 요소 초기화
    
    // 생성 인터벌 정지
    clearInterval(spawnInterval);
    
    // 시작 버튼을 다시 보여주기 (문구 변경)
    startBtn.innerText = 'Restart Game';
    startBtn.style.display = 'block';
    startBtn.onclick = startGame;
}

function checkWaveComplete() {
    // 스테이지의 몬스터가 다 나왔고, 보드상에 몬스터가 전부 죽었거나 골인한 경우
    if (spawnedCount >= 10 && monsters.length === 0 && !isGameOver) {
        buildTowerBtn.style.display = 'none';
        startBtn.innerText = `Next Stage ${stage + 1}`;
        startBtn.style.display = 'block';
        startBtn.onclick = startNextStage;
    }
}

function resetBoard() {
    // 남은 몬스터 모두 제거
    monsters.forEach(m => {
        clearInterval(m.moveInterval);
        m.remove();
    });
    monsters.length = 0; // 배열 비우기
    // 남은 타워 모두 제거
    towers.forEach(t => {
        clearInterval(t.attackInterval);
        t.element.remove();
    });
    towers.length = 0; // 배열 비우기
    // 남은 미사일 제거
    document.querySelectorAll('.missile').forEach(m => m.remove());
}

// 5. 몬스터를 특정 격자(x, y) 위치에 딱 맞게 배치하는 함수
function updateMonsterPosition(monster, coord) {
    const tileIndex = coord.y * 8 + coord.x; // (x,y) 좌표를 배열의 인덱스(0~63)로 변환
    const targetTile = tiles[tileIndex];
    
    // 실제 타일 요소(div)가 브라우저에 렌더링 된 위치(px 단위)를 그대로 가져와 몬스터에 적용합니다.
    monster.style.left = targetTile.offsetLeft + 'px';
    monster.style.top = targetTile.offsetTop + 'px';
    
    // 몬스터 크기를 타일 크기에 딱 맞춥니다 (선택 사항으로 조금 작게 할 수도 있습니다)
    monster.style.width = targetTile.offsetWidth + 'px';
    monster.style.height = targetTile.offsetHeight + 'px';
}

// 6. 타워 건설 및 공격 로직
function buildTower() {
    if (gold < currentTowerCost) {
        return;
    }

    // 중앙 4x4 영역의 타일 인덱스
    const buildableIndices = [];
    for (let y = 2; y <= 5; y++) {
        for (let x = 2; x <= 5; x++) {
            buildableIndices.push(y * 8 + x);
        }
    }

    // 이미 타워가 있는 타일 제외
    const occupiedIndices = towers.map(t => t.tileIndex);
    const availableIndices = buildableIndices.filter(i => !occupiedIndices.includes(i));

    if (availableIndices.length === 0) {
        // 지을 공간이 없으면 가장 레벨이 낮은 타워 중 하나를 골라 레벨업
        const minLevel = Math.min(...towers.map(t => t.level));
        const candidates = towers.filter(t => t.level === minLevel);
        const targetTower = candidates[Math.floor(Math.random() * candidates.length)];
        
        gold -= currentTowerCost;
        currentTowerCost += 50;

        const rand = Math.random();
        let levelUpAmount = 1; // 기본 +1 (나머지 19% 확률)

        if (rand < 0.01) { // 1% 확률로 +5
            levelUpAmount = 5;
        } else if (rand < 0.11) { // 10% 확률로 +4 (누적 11%)
            levelUpAmount = 4;
        } else if (rand < 0.31) { // 20% 확률로 +3 (누적 31%)
            levelUpAmount = 3;
        } else if (rand < 0.81) { // 50% 확률로 +2 (누적 81%)
            levelUpAmount = 2;
        }

        targetTower.level += levelUpAmount;
        targetTower.element.innerText = targetTower.level;
        updateUI();
        return;
    }

    gold -= currentTowerCost;
    currentTowerCost += 50;
    updateUI();

    // 랜덤 위치에 타워 생성
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    const targetTile = tiles[randomIndex];

    const towerElement = document.createElement('div');
    towerElement.className = 'tower';
    towerElement.innerText = '0'; // 초기 레벨 표기
    towerElement.style.left = targetTile.offsetLeft + 'px';
    towerElement.style.top = targetTile.offsetTop + 'px';
    towerElement.style.width = targetTile.offsetWidth + 'px';
    towerElement.style.height = targetTile.offsetHeight + 'px';
    board.appendChild(towerElement);

    const tower = {
        element: towerElement,
        tileIndex: randomIndex,
        level: 0,
        baseDamage: 10,
        attackInterval: setInterval(() => findAndAttack(towerElement), 500)
    };
    towers.push(tower);
}

function findAndAttack(towerElement) {
    const targetMonster = findTargetMonster(towerElement);
    if (targetMonster) {
        const towerData = towers.find(t => t.element === towerElement);
        const totalDamage = towerData.baseDamage + towerData.level; // 데미지 = 기본(10) + 레벨
        fireMissile(towerElement, targetMonster, totalDamage);
    }
}

function findTargetMonster(towerElement) {
    if (monsters.length === 0) return null;
    
    const towerX = towerElement.offsetLeft + towerElement.offsetWidth / 2;
    const towerY = towerElement.offsetTop + towerElement.offsetHeight / 2;

    // Sort monsters based on the priority criteria
    const sortedMonsters = [...monsters].sort((a, b) => {
        // 1. Furthest on path (higher pathIndex is better)
        if (a.pathIndex !== b.pathIndex) return b.pathIndex - a.pathIndex;
        // 2. Lowest HP
        if (a.hp !== b.hp) return a.hp - b.hp;
        // 3. Closest to tower
        const distA = Math.hypot(towerX - (a.offsetLeft + a.offsetWidth / 2), towerY - (a.offsetTop + a.offsetHeight / 2));
        const distB = Math.hypot(towerX - (b.offsetLeft + b.offsetWidth / 2), towerY - (b.offsetTop + b.offsetHeight / 2));
        return distA - distB;
    });

    return sortedMonsters[0];
}

function fireMissile(towerElement, targetMonster, damage) {
    const missile = document.createElement('div');
    missile.className = 'missile';
    board.appendChild(missile);

    const towerCenterX = towerElement.offsetLeft + towerElement.offsetWidth / 2 - 4;
    const towerCenterY = towerElement.offsetTop + towerElement.offsetHeight / 2 - 4;
    missile.style.left = towerCenterX + 'px';
    missile.style.top = towerCenterY + 'px';

    const monsterCenterX = targetMonster.offsetLeft + targetMonster.offsetWidth / 2 - 4;
    const monsterCenterY = targetMonster.offsetTop + targetMonster.offsetHeight / 2 - 4;

    requestAnimationFrame(() => {
        missile.style.left = monsterCenterX + 'px';
        missile.style.top = monsterCenterY + 'px';
    });

    setTimeout(() => {
        missile.remove();
        if (document.body.contains(targetMonster)) { // 미사일이 도달했을 때 몬스터가 살아있는지 확인
            damageMonster(targetMonster, damage);
        }
    }, 150); // CSS transition 시간과 동일하게 설정
}

function damageMonster(monster, damage) {
    monster.hp -= damage;
    if (monster.hp <= 0) {
        if (!monster.isDead) { // 몬스터가 여러번 죽는 것을 방지
            monster.isDead = true;
            gold += monster.maxHp;
            kills++;
            updateUI();
            clearInterval(monster.moveInterval);
            monster.remove();
            const index = monsters.indexOf(monster);
            if (index > -1) monsters.splice(index, 1);
            checkWaveComplete();
        }
    } else {
        const hpFill = monster.querySelector('.hp-bar-fill');
        hpFill.style.width = `${(monster.hp / monster.maxHp) * 100}%`;
    }
}
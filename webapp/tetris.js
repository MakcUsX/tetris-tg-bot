(function () {
    'use strict';

    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
    }

    const COLS = 10;
    const ROWS = 20;
    const BLOCK_SIZE = Math.floor(
        Math.min(
            (window.innerWidth - 32) / COLS,
            (window.innerHeight - 200) / ROWS
        )
    );

    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;

    const scoreEl = document.getElementById('score');
    const finalScoreEl = document.getElementById('final-score');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const restartBtn = document.getElementById('restart-btn');

    const COLORS = [
        null,
        '#00f0f0', // I - cyan
        '#f0f000', // O - yellow
        '#a000f0', // T - purple
        '#00f000', // S - green
        '#f00000', // Z - red
        '#0000f0', // J - blue
        '#f0a000', // L - orange
    ];

    // Each piece: array of rotation states, each state is a 2D matrix
    const PIECES = [
        // I
        [
            [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
            [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
            [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
            [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
        ],
        // O
        [
            [[1,1],[1,1]],
            [[1,1],[1,1]],
            [[1,1],[1,1]],
            [[1,1],[1,1]],
        ],
        // T
        [
            [[0,1,0],[1,1,1],[0,0,0]],
            [[0,1,0],[0,1,1],[0,1,0]],
            [[0,0,0],[1,1,1],[0,1,0]],
            [[0,1,0],[1,1,0],[0,1,0]],
        ],
        // S
        [
            [[0,1,1],[1,1,0],[0,0,0]],
            [[0,1,0],[0,1,1],[0,0,1]],
            [[0,0,0],[0,1,1],[1,1,0]],
            [[1,0,0],[1,1,0],[0,1,0]],
        ],
        // Z
        [
            [[1,1,0],[0,1,1],[0,0,0]],
            [[0,0,1],[0,1,1],[0,1,0]],
            [[0,0,0],[1,1,0],[0,1,1]],
            [[0,1,0],[1,1,0],[1,0,0]],
        ],
        // J
        [
            [[1,0,0],[1,1,1],[0,0,0]],
            [[0,1,1],[0,1,0],[0,1,0]],
            [[0,0,0],[1,1,1],[0,0,1]],
            [[0,1,0],[0,1,0],[1,1,0]],
        ],
        // L
        [
            [[0,0,1],[1,1,1],[0,0,0]],
            [[0,1,0],[0,1,0],[0,1,1]],
            [[0,0,0],[1,1,1],[1,0,0]],
            [[1,1,0],[0,1,0],[0,1,0]],
        ],
    ];

    let board, score, currentPiece, gameOver, animationId;
    let lastTime = 0;
    let dropAccumulator = 0;
    const DROP_INTERVAL = 600;

    // Line clear animation state
    let flashingRows = [];
    let flashTimer = 0;
    const FLASH_DURATION = 400;
    const FLASH_BLINKS = 4;

    function createBoard() {
        const b = [];
        for (let r = 0; r < ROWS; r++) {
            b.push(new Array(COLS).fill(0));
        }
        return b;
    }

    function randomPiece() {
        const idx = Math.floor(Math.random() * PIECES.length);
        return {
            type: idx,
            rotation: 0,
            x: Math.floor(COLS / 2) - Math.ceil(PIECES[idx][0][0].length / 2),
            y: 0,
        };
    }

    function getMatrix(piece) {
        return PIECES[piece.type][piece.rotation];
    }

    function collides(piece, offsetX, offsetY, rotation) {
        const matrix = PIECES[piece.type][rotation !== undefined ? rotation : piece.rotation];
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (!matrix[r][c]) continue;
                const newX = piece.x + c + (offsetX || 0);
                const newY = piece.y + r + (offsetY || 0);
                if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
                if (newY < 0) continue;
                if (board[newY][newX]) return true;
            }
        }
        return false;
    }

    function lockPiece() {
        const matrix = getMatrix(currentPiece);
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (!matrix[r][c]) continue;
                const y = currentPiece.y + r;
                const x = currentPiece.x + c;
                if (y < 0) {
                    showGameOver();
                    return;
                }
                board[y][x] = currentPiece.type + 1;
            }
        }

        const fullRows = [];
        for (let r = 0; r < ROWS; r++) {
            if (board[r].every((cell) => cell !== 0)) {
                fullRows.push(r);
            }
        }

        if (fullRows.length > 0) {
            flashingRows = fullRows;
            flashTimer = 0;
            currentPiece = null;
        } else {
            spawnNext();
        }
    }

    function removeFullRows() {
        let linesCleared = flashingRows.length;
        const rowsToRemove = [...flashingRows].sort((a, b) => b - a);
        for (const r of rowsToRemove) {
            board.splice(r, 1);
            board.unshift(new Array(COLS).fill(0));
        }
        if (linesCleared > 0) {
            const points = [0, 100, 300, 500, 800];
            score += points[linesCleared] || linesCleared * 200;
            scoreEl.textContent = score;
        }
        flashingRows = [];
    }

    function spawnNext() {
        currentPiece = randomPiece();
        if (collides(currentPiece, 0, 0)) {
            showGameOver();
        }
    }

    function isLocked() {
        return gameOver || flashingRows.length > 0 || !currentPiece;
    }

    function moveDown() {
        if (isLocked()) return;
        if (!collides(currentPiece, 0, 1)) {
            currentPiece.y++;
        } else {
            lockPiece();
        }
    }

    function moveLeft() {
        if (isLocked()) return;
        if (!collides(currentPiece, -1, 0)) {
            currentPiece.x--;
        }
    }

    function moveRight() {
        if (isLocked()) return;
        if (!collides(currentPiece, 1, 0)) {
            currentPiece.x++;
        }
    }

    function rotate() {
        if (isLocked()) return;
        const nextRotation = (currentPiece.rotation + 1) % 4;
        if (!collides(currentPiece, 0, 0, nextRotation)) {
            currentPiece.rotation = nextRotation;
            return;
        }
        // Wall kick: try shifting left/right by 1 or 2
        for (const kick of [-1, 1, -2, 2]) {
            if (!collides(currentPiece, kick, 0, nextRotation)) {
                currentPiece.x += kick;
                currentPiece.rotation = nextRotation;
                return;
            }
        }
    }

    function drawBlock(x, y, colorIdx) {
        const color = COLORS[colorIdx];
        ctx.fillStyle = color;
        ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        ctx.strokeStyle = '#0f0f23';
        ctx.lineWidth = 1;
        ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }

    function drawBoard() {
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // During flash animation, determine if flashing rows are visible this frame
        let flashVisible = true;
        if (flashingRows.length > 0) {
            const blinkIndex = Math.floor(flashTimer / (FLASH_DURATION / FLASH_BLINKS));
            flashVisible = blinkIndex % 2 === 0;
        }

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board[r][c]) {
                    if (flashingRows.includes(r)) {
                        if (flashVisible) {
                            ctx.fillStyle = '#ffffff';
                            ctx.fillRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                            ctx.strokeStyle = '#0f0f23';
                            ctx.lineWidth = 1;
                            ctx.strokeRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                        }
                    } else {
                        drawBlock(c, r, board[r][c]);
                    }
                }
            }
        }

        ctx.strokeStyle = '#1a1a3a';
        ctx.lineWidth = 0.5;
        for (let r = 0; r <= ROWS; r++) {
            ctx.beginPath();
            ctx.moveTo(0, r * BLOCK_SIZE);
            ctx.lineTo(canvas.width, r * BLOCK_SIZE);
            ctx.stroke();
        }
        for (let c = 0; c <= COLS; c++) {
            ctx.beginPath();
            ctx.moveTo(c * BLOCK_SIZE, 0);
            ctx.lineTo(c * BLOCK_SIZE, canvas.height);
            ctx.stroke();
        }
    }

    function drawPiece() {
        const matrix = getMatrix(currentPiece);
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (matrix[r][c]) {
                    drawBlock(currentPiece.x + c, currentPiece.y + r, currentPiece.type + 1);
                }
            }
        }
    }

    function draw() {
        drawBoard();
        if (currentPiece) {
            drawPiece();
        }
    }

    function showGameOver() {
        gameOver = true;
        cancelAnimationFrame(animationId);
        finalScoreEl.textContent = score;
        gameOverOverlay.classList.remove('hidden');
    }

    function gameLoop(timestamp) {
        if (gameOver) return;

        const delta = timestamp - lastTime;
        lastTime = timestamp;

        if (flashingRows.length > 0) {
            flashTimer += delta;
            if (flashTimer >= FLASH_DURATION) {
                removeFullRows();
                spawnNext();
                dropAccumulator = 0;
            }
        } else {
            dropAccumulator += delta;
            if (dropAccumulator >= DROP_INTERVAL) {
                moveDown();
                dropAccumulator -= DROP_INTERVAL;
            }
        }

        draw();
        animationId = requestAnimationFrame(gameLoop);
    }

    function startGame() {
        board = createBoard();
        score = 0;
        gameOver = false;
        flashingRows = [];
        flashTimer = 0;
        dropAccumulator = 0;
        scoreEl.textContent = '0';
        gameOverOverlay.classList.add('hidden');
        currentPiece = randomPiece();

        cancelAnimationFrame(animationId);
        lastTime = performance.now();
        animationId = requestAnimationFrame(gameLoop);
    }

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        switch (e.key) {
            case 'ArrowLeft':
                moveLeft();
                break;
            case 'ArrowRight':
                moveRight();
                break;
            case 'ArrowDown':
                moveDown();
                break;
            case 'ArrowUp':
                rotate();
                break;
        }
    });

    // Touch button controls
    document.getElementById('btn-left').addEventListener('click', moveLeft);
    document.getElementById('btn-right').addEventListener('click', moveRight);
    document.getElementById('btn-down').addEventListener('click', moveDown);
    document.getElementById('btn-rotate').addEventListener('click', rotate);
    restartBtn.addEventListener('click', startGame);

    startGame();
})();

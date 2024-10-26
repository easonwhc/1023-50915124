// 獲取畫布元素及其上下文
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const gameOverElement = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const timerElement = document.getElementById('timer');

// 遊戲配置：包含不同難度的設定
const gameConfig = {
    easy: {
        ballSpeed: 2,
        brickRows: 3,
        brickCols: 6,
        maxHits: 1,
        paddleSpeed: 7,
        lives: 3,
        scoreThreshold: 50
    },
    normal: {
        ballSpeed: 3,
        brickRows: 4,
        brickCols: 8,
        maxHits: 2,
        paddleSpeed: 8,
        lives: 2,
        scoreThreshold: 100
    },
    hard: {
        ballSpeed: 4,
        brickRows: 5,
        brickCols: 10,
        maxHits: 3,
        paddleSpeed: 10,
        lives: 1,
        scoreThreshold: 150
    }
};

// 遊戲全局變量
let currentConfig;
let score = 0;
let lives = 0;
let gameRunning = false;
let bricks = [];
let balls = [];
let backgroundImage = new Image();
let timer = 60; // 設置初始時間為60秒
let comboCount = 0;
let timerInterval;
let animationFrameId; // 新增：用於追蹤 requestAnimationFrame
let currentDifficulty = 'normal';

// 畫布和磚塊的佈局配置
const CANVAS_PADDING = 20;
const BRICK_PADDING = 5;

// 按鍵狀態
const keys = {
    left: false,
    right: false
};

// 球的屬性
const ball = {
    x: canvas.width / 2,
    y: canvas.height - 30,
    dx: 0,
    dy: 0,
    radius: 10,
    baseSpeed: 0
};

// 擋板屬性
const paddle = {
    width: 100,
    height: 10,
    x: canvas.width / 2 - 50,
    speed: 0,
    maxSpeed: 0,
    acceleration: 1,
    friction: 0.85,

};

// 加載背景圖片
function loadBackground(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        backgroundImage.src = e.target.result;
        backgroundImage.onload = draw;
    };
    reader.readAsDataURL(file);
}

// 更新計時器
function updateTimer() {
    timer--;
    if (timerElement) {
        timerElement.innerHTML = `倒數計時: ${timer}秒`;
    }
    if (timer <= 0) {
        endGame();
    }
}

// 結束遊戲
function endGame() {
    gameRunning = false;
    clearInterval(timerInterval);
    cancelAnimationFrame(animationFrameId); // 新增：取消動畫幀
    if (gameOverElement) {
        gameOverElement.style.display = 'block';
    }
}

// 獎勵時間或生命
function rewardTimeOrLife() {
    if (Math.random() > 0.5) {
        timer += 2;
        if (timerElement) {
            timerElement.innerHTML = `倒數計時: ${timer}秒`;
        }
    } else {
        lives += 1;
        updateLives();
    }
}

// 定义粒子类
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 2; // 粒子大小
        this.speedX = (Math.random() - 0.5) * 4; // 水平速度
        this.speedY = (Math.random() - 0.5) * 4; // 垂直速度
        this.color = color;
        this.alpha = 1; // 不透明度，初始为1
    }

    // 更新粒子位置和透明度
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.alpha -= 0.02; // 渐隐效果
    }

    // 绘制粒子
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha; // 应用透明度
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.closePath();
        ctx.restore();
    }
}

let particles = []; // 存储所有活动粒子的数组


// 計算磚塊的尺寸和位置
function calculateBrickDimensions() {
    const availableWidth = canvas.width - (2 * CANVAS_PADDING);
    const availableHeight = (canvas.height / 2) - (2 * CANVAS_PADDING);

    const brickWidth = Math.floor((availableWidth / currentConfig.brickCols) - BRICK_PADDING);
    const brickHeight = 20;

    const totalBricksWidth = currentConfig.brickCols * (brickWidth + BRICK_PADDING) - BRICK_PADDING;
    const totalBricksHeight = currentConfig.brickRows * (brickHeight + BRICK_PADDING) - BRICK_PADDING;

    const brickOffsetLeft = CANVAS_PADDING + (availableWidth - totalBricksWidth) / 2;
    const brickOffsetTop = CANVAS_PADDING + (availableHeight - totalBricksHeight) / 2;

    return {
        width: brickWidth,
        height: brickHeight,
        offsetLeft: brickOffsetLeft,
        offsetTop: brickOffsetTop
    };
}

// 初始化磚塊
function initBricks() {
    const dimensions = calculateBrickDimensions();
    bricks = [];

    for (let c = 0; c < currentConfig.brickCols; c++) {
        bricks[c] = [];
        for (let r = 0; r < currentConfig.brickRows; r++) {
            const hits = Math.floor(Math.random() * currentConfig.maxHits) + 1;

            const brickX = dimensions.offsetLeft + (c * (dimensions.width + BRICK_PADDING));
            const brickY = dimensions.offsetTop + (r * (dimensions.height + BRICK_PADDING));

            bricks[c][r] = {
                x: brickX,
                y: brickY,
                width: dimensions.width,
                height: dimensions.height,
                status: hits,
                maxHits: hits
            };
        }
    }
}

// 繪製磚塊
function drawBricks() {
    for (let c = 0; c < currentConfig.brickCols; c++) {
        for (let r = 0; r < currentConfig.brickRows; r++) {
            const brick = bricks[c][r];
            if (brick.status > 0) {
                const hitRatio = brick.status / brick.maxHits;
                const color = `rgb(${255 * (1 - hitRatio)}, ${255 * hitRatio}, 0)`;

                ctx.beginPath();
                ctx.rect(brick.x, brick.y, brick.width, brick.height);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.closePath();

                ctx.fillStyle = '#fff';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(brick.status, brick.x + brick.width / 2, brick.y + brick.height / 2);
            }
        }
    }
}
function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.update();
        particle.draw(ctx);

        // 删除透明度低的粒子
        if (particle.alpha <= 0) {
            particles.splice(i, 1);
        }
    }
}

// 更新擋板的位置
function updatePaddle() {
    if (keys.left && !keys.right) {
        paddle.speed -= paddle.acceleration;
        paddle.speed = Math.max(paddle.speed, -paddle.maxSpeed);
    } else if (keys.right && !keys.left) {
        paddle.speed += paddle.acceleration;
        paddle.speed = Math.min(paddle.speed, paddle.maxSpeed);
    } else {
        paddle.speed *= paddle.friction;
    }

    paddle.x += paddle.speed;

    if (paddle.x < 0) {
        paddle.x = 0;
        paddle.speed = 0;
    } else if (paddle.x + paddle.width > canvas.width) {
        paddle.x = canvas.width - paddle.width;
        paddle.speed = 0;
    }
}

// 添加新的粒子類別用於尾跡效果
class TrailParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = ball.radius * (0.3 + Math.random() * 0.3); // 尾跡粒子大小隨機變化
        this.alpha = 1; // 初始透明度
        this.fadeSpeed = 0.03 + Math.random() * 0.02; // 隨機衰減速度
        this.color = '#0095DD'; // 與球相同的顏色
    }

    update() {
        this.alpha -= this.fadeSpeed;
        this.size -= 0.1;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
        ctx.restore();
    }

    isDead() {
        return this.alpha <= 0 || this.size <= 0;
    }
}

let trailParticles = [];
const MAX_TRAIL_PARTICLES = 50;// 限制尾跡粒子數量
// 添加新的函數來管理尾跡效果
function createTrailParticle() {
    if (gameRunning && trailParticles.length < MAX_TRAIL_PARTICLES) {
        trailParticles.push(new TrailParticle(ball.x, ball.y));
    }
}
// 更新尾跡粒子
function updateTrailParticles() {
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        trailParticles[i].update();
        if (trailParticles[i].isDead()) {
            trailParticles.splice(i, 1);
        }
    }
}
// 繪製尾跡粒子
function drawTrailParticles() {
    trailParticles.forEach(particle => {
        particle.draw(ctx);
    });
}

// 碰撞檢測
function collisionDetection() {
    const ballX = ball.x;
    const ballY = ball.y;

    for (let c = 0; c < currentConfig.brickCols; c++) {
        for (let r = 0; r < currentConfig.brickRows; r++) {
            const brick = bricks[c][r];
            if (brick.status > 0) {
                if (ballX > brick.x &&
                    ballX < brick.x + brick.width &&
                    ballY > brick.y &&
                    ballY < brick.y + brick.height) {

                    ball.dy = -ball.dy;
                    brick.status--;
                    comboCount++;

                    if (brick.status === 0) {
                        score += 10 + comboCount * 2;
                        updateScore();

                        // 触发爆炸效果
                        createExplosion(brick.x + brick.width / 2, brick.y + brick.height / 2);

                        if (score >= currentConfig.scoreThreshold) {
                            rewardTimeOrLife();
                            currentConfig.scoreThreshold += 50;
                        }
                    }
                    return true;
                }
            }
        }
    }
    return false;
}

function createExplosion(x, y) {
    const colors = ['#FF6347', '#FFD700', '#FF4500', '#FF8C00']; // 红橙黄颜色
    for (let i = 0; i < 20; i++) { // 生成20个粒子
        const color = colors[Math.floor(Math.random() * colors.length)];
        particles.push(new Particle(x, y, color));
    }
}

// 檢查遊戲是否獲勝
function checkWin() {
    for (let c = 0; c < currentConfig.brickCols; c++) {
        for (let r = 0; r < currentConfig.brickRows; r++) {
            if (bricks[c][r].status > 0) {
                return false;
            }
        }
    }
    return true;
}

// 繪製球
function drawBall() {
    // 繪製發光效果
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius + 5, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
        ball.x, ball.y, ball.radius,
        ball.x, ball.y, ball.radius + 5
    );
    gradient.addColorStop(0, 'rgba(0, 149, 221, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 149, 221, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.closePath();

    // 繪製球體
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0095DD';
    ctx.fill();
    ctx.closePath();
    ctx.restore();
}

// 繪製擋板
function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddle.x, canvas.height - paddle.height, paddle.width, paddle.height);
    ctx.fillStyle = '#0095DD';
    ctx.fill();
    ctx.closePath();
}

// 更新分數顯示
function updateScore() {
    if (scoreElement) {
        scoreElement.innerHTML = `分數: ${score}`;
    }
    if (finalScoreElement) {
        finalScoreElement.innerHTML = score;
    }
    const comboElement = document.getElementById('combo');
    if (comboElement) {
        comboElement.innerHTML = `連擊：${comboCount}`;
    }
}


// 更新生命數顯示
function updateLives() {
    if (livesElement) {
        livesElement.innerHTML = `生命: ${lives}`;
    }
}

// 設定遊戲難度
function setDifficulty(difficulty) {
    currentDifficulty = difficulty;  // 保存當前難度
    currentConfig = gameConfig[difficulty];
    paddle.maxSpeed = currentConfig.paddleSpeed;
    lives = currentConfig.lives;

    ball.dx = currentConfig.ballSpeed;
    ball.dy = -currentConfig.ballSpeed;
    ball.baseSpeed = currentConfig.ballSpeed;  // 設置基礎速度

    startGame();
}
function restartGame() {
    setDifficulty(currentDifficulty);  // 使用當前難度重新開始
}

// 開始遊戲
function startGame() {

    cancelAnimationFrame(animationFrameId);
    clearInterval(timerInterval);

    score = 0;
    lives = currentConfig.lives;
    gameRunning = true;
    timer = 60;
    comboCount = 0;
    trailParticles = [];

    ball.x = canvas.width / 2;
    ball.y = canvas.height - 30;
    ball.dx = currentConfig.ballSpeed;
    ball.dy = -currentConfig.ballSpeed;
    ball.baseSpeed = currentConfig.ballSpeed;

    paddle.x = canvas.width / 2 - paddle.width / 2;
    paddle.speed = 0;

    if (gameOverElement) {
        gameOverElement.style.display = 'none'; // 隱藏遊戲結束畫面
    }

    clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);

    initBricks();
    updateScore();
    updateLives();
    gameRunning = true;
    draw(); // 确保游戏重新开始时调用绘图函数
}

// 事件監聽器設置，綁定重新開始按鈕
const restartButton = document.getElementById('restartButton');
if (restartButton) {
    restartButton.addEventListener('click', () => {
        setDifficulty('normal'); // 假設重新開始使用普通難度
    });
}

function handlePaddleCollision() {
    if (ball.y + ball.dy > canvas.height - ball.radius - paddle.height) {
        if (ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
            const hitPoint = (ball.x - paddle.x) / paddle.width;
            // 使用基礎速度計算新的速度向量
            ball.dx = ball.baseSpeed * (hitPoint - 0.5) * 2;
            ball.dy = -ball.baseSpeed;
            comboCount = 1;
        } else if (ball.y + ball.dy > canvas.height - ball.radius) {
            lives--;
            updateLives();

            if (lives <= 0) {
                endGame();
                return;
            }

            // 重置球的位置和速度
            ball.x = canvas.width / 2;
            ball.y = canvas.height - 30;
            ball.dx = ball.baseSpeed;
            ball.dy = -ball.baseSpeed;
            paddle.x = canvas.width / 2 - paddle.width / 2;
            comboCount = 1;
        }
    }
}

// 繪製畫面
function draw() {
    if (!gameRunning) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (backgroundImage.src) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }

    // 更新和繪製尾跡
    createTrailParticle();
    updateTrailParticles();
    drawTrailParticles();

    updatePaddle();
    drawBricks();
    drawBall();
    drawPaddle();
    drawParticles();

    // 碰撞檢測和邊界檢查
    if (ball.x + ball.dx > canvas.width - ball.radius || ball.x + ball.dx < ball.radius) {
        ball.dx = -ball.dx;
        createImpactEffect(ball.x, ball.y); // 添加碰撞效果
    }

    if (ball.y + ball.dy < ball.radius) {
        ball.dy = -ball.dy;
        createImpactEffect(ball.x, ball.y); // 添加碰撞效果
    }

    handlePaddleCollision();
    collisionDetection();

    if (checkWin()) {
        gameRunning = false;
        alert('恭喜你贏了！');
        return;
    }

    ball.x += ball.dx;
    ball.y += ball.dy;

    animationFrameId = requestAnimationFrame(draw);
}

// 添加碰撞效果函數
function createImpactEffect(x, y) {
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const particle = new TrailParticle(x, y);
        particle.x += Math.cos(angle) * 5;
        particle.y += Math.sin(angle) * 5;
        particle.fadeSpeed = 0.1;
        trailParticles.push(particle);
    }
}
// 事件監聽器設置
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        keys.left = true;
    } else if (e.key === 'ArrowRight') {
        keys.right = true;
    } else if (e.key === 'Enter' || e.key === ' ') {  // 添加空格鍵和回車鍵重新開始功能
        if (!gameRunning) {
            restartGame();
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') {
        keys.left = false;
    } else if (e.key === 'ArrowRight') {
        keys.right = false;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const relativeX = e.clientX - canvas.offsetLeft;
    if (relativeX > 0 && relativeX < canvas.width) {
        paddle.x = relativeX - paddle.width / 2;
    }
});
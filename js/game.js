const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

let player, bullets, zombies, lastFired = 0;
let score = 0;
let scoreText;
let ammoText;
let skillCooldown = 0;
let speedSkillCooldown = 0;
let isSpeedBoostActive = false;
let wave = 1;
let totalZombiesSpawned = 0;

const SKILL_COOLDOWN_TIME = 20000;
const SPEED_SKILL_COOLDOWN_TIME = 30000;
const SPEED_BOOST_DURATION = 15000;

// ====== TAMBAHAN UNTUK SKILL R ======
let skillRActive = false;
let skillRAutoFireEvent = null;
let skillRCooldown = 0;
const SKILL_R_DURATION = 10000; // 10 detik aktif
const SKILL_R_COOLDOWN_TIME = 35000; // 35 detik cooldown mwehehe (nguawor ygy)
// ====================================

let skillButton, skillButtonText;
let skillEText, skillQText, skillRText; // skillRText ditambah di sini
let wasd;
let bulletCount = 0;
const MAX_BULLETS = 10;
let isReloading = false;

const game = new Phaser.Game(config);

function preload() {
  this.load.image('player', 'assets/player.png');
  this.load.image('bullet', 'assets/bullet.png');
  this.load.image('zombie1', 'assets/zombie1.png');
  this.load.image('zombie2', 'assets/zombie2.png');
  this.load.audio('shoot', 'assets/shoot.mp3');
  this.load.audio('zombie_die', 'assets/zombie_die.mp3');
}

function create() {
  this.cameras.main.setBackgroundColor('#000011');

  for (let i = 0; i < 100; i++) {
    const x = Phaser.Math.Between(0, window.innerWidth);
    const y = Phaser.Math.Between(0, window.innerHeight);
    const star = this.add.circle(x, y, Phaser.Math.Between(1, 2), 0xffffff);
    star.setAlpha(Phaser.Math.FloatBetween(0.3, 0.9));
  }

  player = this.physics.add.sprite(300, 200, 'player').setCollideWorldBounds(true);
  player.setScale(0.3);

  wasd = this.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.W,
    down: Phaser.Input.Keyboard.KeyCodes.S,
    left: Phaser.Input.Keyboard.KeyCodes.A,
    right: Phaser.Input.Keyboard.KeyCodes.D
  });

  bullets = this.physics.add.group();
  zombies = this.physics.add.group();

  scoreText = this.add.text(16, 16, `Score: ${score}\nWave: ${wave}\nAmmo: ${MAX_BULLETS - bulletCount}/${MAX_BULLETS}`, {
    fontSize: '28px',
    fill: '#ffffff'
  });

  const scene = this;

  spawnZombies(scene);

  this.input.keyboard.on('keydown-SPACE', () => {
    if (this.time.now > lastFired && bulletCount < MAX_BULLETS && !isReloading && !skillRActive) {
      shootBullet(scene, player.x, player.y);
      lastFired = this.time.now + 300;
      bulletCount++;
      updateAmmoText();
      if (bulletCount >= MAX_BULLETS) {
        startReload(scene);
      }
    }
  });

  this.input.keyboard.on('keydown-E', () => {
    if (scene.time.now > skillCooldown) {
      shootTriple(scene, player.x, player.y);
      skillCooldown = scene.time.now + SKILL_COOLDOWN_TIME;
      updateSkillButtonCooldown();
    }
  });

  this.input.keyboard.on('keydown-Q', () => {
    if (scene.time.now > speedSkillCooldown && !isSpeedBoostActive) {
      activateSpeedBoost(scene);
    }
  });

  // ====== TAMBAHAN EVENT KEYDOWN-R untuk SKILL R ======
  this.input.keyboard.on('keydown-R', () => {
    if (scene.time.now > skillRCooldown && !skillRActive) {
      activateSkillR(scene);
    }
  });
  // =======================================================

  this.physics.add.overlap(bullets, zombies, (bullet, zombie) => {
    bullet.destroy();
    zombie.destroy();
    scene.sound.play('zombie_die');
    score += 10;

    if (score >= 1000) {
      gameOver(scene);
    } else {
      updateScoreText();
    }
  });

  createSkillButton(this);
}

function update() {
  if (!player.body.enable) return;

  const baseSpeed = 350;
  const speed = isSpeedBoostActive ? baseSpeed * 1.8 : baseSpeed;

  player.setVelocity(0);
  if (wasd.left.isDown) player.setVelocityX(-speed);
  if (wasd.right.isDown) player.setVelocityX(speed);
  if (wasd.up.isDown) player.setVelocityY(-speed);
  if (wasd.down.isDown) player.setVelocityY(speed);

  updateSkillButtonCooldown();
  updateAmmoText();
}

// ================== TAMBAHAN FUNCTION UNTUK SKILL R ====================
function activateSkillR(scene) {
  skillRActive = true;
  skillRCooldown = scene.time.now + SKILL_R_COOLDOWN_TIME + SKILL_R_DURATION;

  skillRAutoFireEvent = scene.time.addEvent({
    delay: 100, // tembak tiap 100 ms (lebih cepat)
    loop: true,
    callback: () => {
      shootAuto(scene, player.x, player.y);
    }
  });

  scene.time.delayedCall(SKILL_R_DURATION, () => {
    skillRActive = false;
    if (skillRAutoFireEvent) {
      skillRAutoFireEvent.remove();
      skillRAutoFireEvent = null;
    }
  });
}

function shootAuto(scene, x, y) {
  // Tembak peluru tanpa mengurangi ammo saat skill R aktif
  const bullet = bullets.create(x, y, 'bullet');
  bullet.setScale(0.3);
  bullet.setVelocityY(-500); // peluru lebih cepat
  scene.sound.play('shoot');
}
// =======================================================================

function shootBullet(scene, x, y) {
  if (bulletCount >= MAX_BULLETS || isReloading) return;

  const bullet = bullets.create(x, y, 'bullet');
  bullet.setScale(0.1);
  bullet.setVelocityY(-300);
  scene.sound.play('shoot');
}

function shootTriple(scene, x, y) {
  let b1 = bullets.create(x, y, 'bullet');
  b1.setScale(0.3);
  b1.setVelocity(0, -300);

  let b2 = bullets.create(x, y, 'bullet');
  b2.setScale(0.3);
  b2.setVelocity(-200, -200);

  let b3 = bullets.create(x, y, 'bullet');
  b3.setScale(0.3);
  b3.setVelocity(200, -200);

  scene.sound.play('shoot');
}

function startReload(scene) {
  if (isReloading) return;

  isReloading = true;
  scene.time.delayedCall(1500, () => {
    bulletCount = 0;
    isReloading = false;
    updateAmmoText();
  });
}

function spawnZombies(scene) {
  scene.time.addEvent({
    delay: 3000 - (wave * 400),
    loop: true,
    callback: () => {
      if (wave > 5) return;

      for (let i = 0; i < wave; i++) {
        const tipe = Phaser.Math.Between(1, 2);
        let zombie;

        if (tipe === 1) {
          zombie = zombies.create(
            Phaser.Math.Between(50, window.innerWidth - 50),
            0,
            'zombie1'
          );
          zombie.setScale(0.2);
          zombie.setVelocityY(Phaser.Math.Between(80, 130));
        } else {
          zombie = zombies.create(
            Phaser.Math.Between(50, window.innerWidth - 50),
            0,
            'zombie2'
          );
          zombie.setScale(0.5);
          zombie.setVelocityY(Phaser.Math.Between(30, 70));
        }
        totalZombiesSpawned++;

        if (totalZombiesSpawned % 20 === 0 && wave < 5) {
          wave++;
          updateScoreText();
        }
      }
    }
  });
}

function activateSpeedBoost(scene) {
  isSpeedBoostActive = true;
  speedSkillCooldown = scene.time.now + SPEED_SKILL_COOLDOWN_TIME;

  scene.time.delayedCall(SPEED_BOOST_DURATION, () => {
    isSpeedBoostActive = false;
  });
}

function createSkillButton(scene) {
  const btnSize = 70;
  const padding = 20;
  const x = window.innerWidth - btnSize - padding;
  const y = window.innerHeight - btnSize - padding;

  skillButton = scene.add.rectangle(x, y, btnSize, btnSize, 0x0099ff)
    .setOrigin(0, 0)
    .setAlpha(0.8)
    .setInteractive();
  skillButtonText = scene.add.text(x + btnSize / 2, y + btnSize / 2, 'SKILL', {
    fontSize: '20px',
    fill: '#fff'
  }).setOrigin(0.5);

  skillButton.on('pointerdown', () => {
    if (scene.time.now > skillCooldown) {
      shootTriple(scene, player.x, player.y);
      skillCooldown = scene.time.now + SKILL_COOLDOWN_TIME;
      updateSkillButtonCooldown();
    }
  });

  skillEText = scene.add.text(16, window.innerHeight - 80, '', {
    fontSize: '20px',
    fill: '#00ccff'
  });
  skillQText = scene.add.text(16, window.innerHeight - 50, '', {
    fontSize: '20px',
    fill: '#ffcc00'
  });
  // Tambah teks status skill R
  skillRText = scene.add.text(16, window.innerHeight - 110, '', {
    fontSize: '20px',
    fill: '#ff66cc'
  });
}

function updateSkillButtonCooldown() {
  const now = game.scene.scenes[0].time.now;

  const eRemaining = skillCooldown - now;
  if (eRemaining > 0) {
    skillButton.setFillStyle(0x555555);
    skillEText.setText('E Skill: ' + Math.ceil(eRemaining / 1000) + 's');
  } else {
    skillButton.setFillStyle(0x0099ff);
    skillEText.setText('E Skill: Ready');
  }

  const qRemaining = speedSkillCooldown - now;
  if (isSpeedBoostActive) {
    skillQText.setText('Q Skill: ACTIVE');
  } else if (qRemaining > 0) {
    skillQText.setText('Q Skill: ' + Math.ceil(qRemaining / 1000) + 's');
  } else {
    skillQText.setText('Q Skill: Ready');
  }

  // Skill R cooldown update
  const rRemaining = skillRCooldown - now;
  if (skillRActive) {
    skillRText.setText('R Skill: ACTIVE');
  } else if (rRemaining > 0) {
    skillRText.setText('R Skill: ' + Math.ceil(rRemaining / 1000) + 's');
  } else {
    skillRText.setText('R Skill: Ready');
  }

  skillButtonText.setText('SKILL');
}

function updateScoreText() {
  scoreText.setText(`Score: ${score}\nWave: ${wave}\nAmmo: ${MAX_BULLETS - bulletCount}/${MAX_BULLETS}`);
}

function updateAmmoText() {
  scoreText.setText(`Score: ${score}\nWave: ${wave}\nAmmo: ${MAX_BULLETS - bulletCount}/${MAX_BULLETS}`);
}

// FUNGSI GAME OVER DENGAN TOMBOL RESTART
function gameOver(scene) {
  player.setVelocity(0);
  player.body.enable = false;

  zombies.clear(true, true);
  scene.time.removeAllEvents();

  scene.input.keyboard.enabled = false;

  const centerX = scene.cameras.main.width / 2;
  const centerY = scene.cameras.main.height / 2;

  const finishText = scene.add.text(centerX, centerY - 40, 'Finished', {
    fontSize: '64px',
    fill: '#00ff00',
    fontWeight: 'bold'
  }).setOrigin(0.5).setAlpha(0);

  const btnWidth = 160;
  const btnHeight = 50;
  const btnY = centerY + 40;

  const restartBtn = scene.add.rectangle(centerX, btnY, btnWidth, btnHeight, 0x00aa00)
    .setOrigin(0.5)
    .setAlpha(0)
    .setInteractive({ useHandCursor: true });

  const restartText = scene.add.text(centerX, btnY, 'Restart', {
    fontSize: '28px',
    fill: '#ffffff',
    fontWeight: 'bold'
  }).setOrigin(0.5).setAlpha(0);

  scene.tweens.add({
    targets: [finishText, restartBtn, restartText],
    alpha: 1,
    duration: 1500,
    ease: 'Power2'
  });

  restartBtn.on('pointerdown', () => {
    window.location.href = 'menu.html';
  });
}

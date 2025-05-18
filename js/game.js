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
let bossSpawned = false;

const SKILL_COOLDOWN_TIME = 20000;
const SPEED_SKILL_COOLDOWN_TIME = 30000;
const SPEED_BOOST_DURATION = 15000;

let skillRActive = false;
let skillRAutoFireEvent = null;
let skillRCooldown = 0;
const SKILL_R_DURATION = 10000;
const SKILL_R_COOLDOWN_TIME = 35000;

let skillButton, skillButtonText;
let skillEText, skillQText, skillRText;
let wasd;
let bulletCount = 0;
const MAX_BULLETS = 10;
let isReloading = false;

const MAX_ZOMBIES = 30;  // batas zombie aktif maksimal

const game = new Phaser.Game(config);

function preload() {
  this.load.image('player', 'assets/player.png');
  this.load.image('bullet', 'assets/bullet.png');
  this.load.image('zombie1', 'assets/zombie1.png');
  this.load.image('zombie2', 'assets/zombie2.png');
  this.load.image('boss', 'assets/zombie_boss.png');
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

  this.input.keyboard.on('keydown-R', () => {
    if (scene.time.now > skillRCooldown && !skillRActive) {
      activateSkillR(scene);
    }
  });

  this.physics.add.overlap(bullets, zombies, (bullet, zombie) => {
    bullet.destroy();

    if (zombie.isBoss) {
      zombie.hp -= 1;
      updateBossHealthBar(zombie);
      if (zombie.hp <= 0) {
        if (zombie.healthBar) {
          zombie.healthBar.destroy();
        }
        zombie.destroy();
        scene.sound.play('zombie_die');
        score += 100;
      }
    } else {
      zombie.destroy();
      scene.sound.play('zombie_die');
      score += 10;
    }

    if (score >= 1000) {
      gameOver(scene, true);
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

  // Hapus bullet yang keluar layar
  bullets.getChildren().forEach(bullet => {
    if (bullet.y < -50) bullet.destroy();
  });

  // Hapus zombie yang keluar layar bawah
  zombies.getChildren().forEach(zombie => {
    if (zombie.y > window.innerHeight + 50) zombie.destroy();
  });

  // Batasi jumlah zombie di scene (spawnZombies juga sudah cek, ini double safety)
  if (zombies.getChildren().length > MAX_ZOMBIES) {
    zombies.getChildren().slice(MAX_ZOMBIES).forEach(z => z.destroy());
  }

  // Update health bar boss jika ada
  let boss = zombies.getChildren().find(z => z.isBoss);
  if (boss) {
    updateBossHealthBar(boss);
  }
}

function activateSkillR(scene) {
  skillRActive = true;
  skillRCooldown = scene.time.now + SKILL_R_COOLDOWN_TIME + SKILL_R_DURATION;

  skillRAutoFireEvent = scene.time.addEvent({
    delay: 100,
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
  const bullet = bullets.create(x, y, 'bullet');
  bullet.setScale(0.3);
  bullet.setVelocityY(-500);
  scene.sound.play('shoot');
}

function shootBullet(scene, x, y) {
  if (bulletCount >= MAX_BULLETS || isReloading) return;

  const bullet = bullets.create(x, y, 'bullet');
  bullet.setScale(0.3);
  bullet.setVelocityY(-400);
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
    delay: Math.max(500, 3000 - (wave * 400)),
    loop: true,
    callback: () => {
      if (wave > 5) return;

      if (bossSpawned) return;

      if (zombies.getChildren().length >= MAX_ZOMBIES) return;

      if (wave === 5 && !bossSpawned) {
        const boss = zombies.create(scene.cameras.main.centerX, 0, 'boss');
        boss.setScale(1);
        boss.setVelocityY(30);
        boss.hp = 20;
        boss.isBoss = true;
        bossSpawned = true;

        boss.healthBar = scene.add.graphics();
        updateBossHealthBar(boss);

        return;
      }

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
          zombie.setVelocityY(Phaser.Math.Between(70, 110));
        } else {
          zombie = zombies.create(
            Phaser.Math.Between(50, window.innerWidth - 50),
            0,
            'zombie2'
          );
          zombie.setScale(0.4);
          zombie.setVelocityY(Phaser.Math.Between(30, 70));
        }

        totalZombiesSpawned++;
      }

      if (totalZombiesSpawned > 0 && totalZombiesSpawned % 20 === 0 && wave < 5) {
        wave++;
        updateScoreText();
      }
    }
  });
}

function updateBossHealthBar(boss) {
  const barWidth = 100;
  const barHeight = 10;
  const x = boss.x - barWidth / 2;
  const y = boss.y - boss.height / 2 - 20;

  boss.healthBar.clear();

  boss.healthBar.fillStyle(0xff0000);
  boss.healthBar.fillRect(x, y, barWidth, barHeight);

  const hpWidth = (boss.hp / 20) * barWidth;
  boss.healthBar.fillStyle(0x00ff00);
  boss.healthBar.fillRect(x, y, hpWidth, barHeight);
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
  skillRText = scene.add.text(16, window.innerHeight - 110, '', {
    fontSize: '20px',
    fill: '#ff4444'
  });
}

function updateSkillButtonCooldown() {
  const scene = game.scene.scenes[0];
  if (!scene) return;

  let now = scene.time.now;

  let cdE = skillCooldown > now ? Math.ceil((skillCooldown - now) / 1000) : 0;
  let cdQ = speedSkillCooldown > now ? Math.ceil((speedSkillCooldown - now) / 1000) : 0;
  let cdR = skillRCooldown > now ? Math.ceil((skillRCooldown - now) / 1000) : 0;

  skillEText.setText(`E (Triple Shot): ${cdE > 0 ? cdE + 's' : 'Ready'}`);
  skillQText.setText(`Q (Speed Boost): ${cdQ > 0 ? cdQ + 's' : 'Ready'}`);
  skillRText.setText(`R (Auto Fire): ${cdR > 0 ? cdR + 's' : 'Ready'}`);
}

function updateScoreText() {
  scoreText.setText(`Score: ${score}\nWave: ${wave}\nAmmo: ${MAX_BULLETS - bulletCount}/${MAX_BULLETS}`);
}

function updateAmmoText() {
  scoreText.setText(`Score: ${score}\nWave: ${wave}\nAmmo: ${MAX_BULLETS - bulletCount}/${MAX_BULLETS}${isReloading ? ' (Reloading...)' : ''}`);
}

function gameOver(scene, isWin = false) {
  player.disableBody(true, true);

  let msg = isWin ? 'You Win!' : 'Game Over!';
  let msgText = scene.add.text(scene.cameras.main.centerX, scene.cameras.main.centerY, msg, {
    fontSize: '64px',
    fill: '#ff0000'
  });
  msgText.setOrigin(0.5);

  scene.time.addEvent({
    delay: 4000,
    callback: () => {
      scene.scene.restart();
      resetGameVariables();
    }
  });
}

function resetGameVariables() {
  score = 0;
  wave = 1;
  bulletCount = 0;
  isReloading = false;
  bossSpawned = false;
  skillCooldown = 0;
  speedSkillCooldown = 0;
  isSpeedBoostActive = false;
  skillRActive = false;
  skillRCooldown = 0;
  totalZombiesSpawned = 0;
}

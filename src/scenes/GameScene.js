// ============================================================
//  GameScene.js — Système de 3 niveaux
//  Tutos darties.fr : preload/create/update, animations,
//  timers, tweens, multi-niveaux, collisions, Tiled, chronomètre
// ============================================================
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }
    init(data) {
        // darties.fr — multi-niveaux : on reçoit le niveau via scene.start()
        this.level = data.level || 1;
    }
    preload() {
        // darties.fr — bases Phaser : chargement des assets dans preload()
        this.load.spritesheet('player', 'assets/darties.png', { frameWidth: 204, frameHeight: 256 });
        ['planet_alien','planet_crystal','planet_desert','planet_earth','planet_fire',
         'planet_forest','planet_ice','planet_jupiter','planet_lava','planet_mars',
         'planet_moon','planet_saturn','planet_snow'].forEach(n => this.load.image(n, `assets/planetes/${n}.png`));
        this.load.image('trump', 'assets/trump.png');
        this.load.image('epstein', 'assets/epstein.png');
        this.load.image('ship', 'assets/ship.png');
        // darties.fr — Tiled : chargement de la carte et du tileset
        this.load.tilemapTiledJSON('space_map', 'assets/space_map.json');
        this.load.image('space_tileset', 'assets/space_tileset.png');
        this.load.audio('music', 'assets/music.mp3');
    }
    create() {
        const W = this.level === 1 ? 4500 : this.level === 2 ? 5800 : 7500;
        // darties.fr — bases Phaser : limites du monde, gravité désactivée
        this.physics.world.setBounds(0, 0, W, 720);
        this.cameras.main.setBounds(0, 0, W, 720);
        this.physics.world.gravity.set(0, 0);
        // darties.fr — Tiled : fond étoilé
        const map = this.make.tilemap({ key: 'space_map' });
        map.createLayer('fond_etoile', map.addTilesetImage('space_tileset', 'space_tileset'), 0, 0).setDepth(-1);
        // darties.fr — tweens : bannière de niveau
        this.showLevelBanner();
        this.levelConfig = {
            1: { cometDelay: 9000 },
            2: { cometDelay: 6000 },
            3: { cometDelay: 3000 },
        }[this.level];
        this.planetData     = this.buildPlanetData();
        this.planetGraphics = [];
        this.planetAlive    = [];
        // darties.fr — collisions : staticGroup pour les hitboxes des planètes
        this.planetBodies = this.physics.add.staticGroup();
        this.planetData.forEach((data, i) => { this.createPlanet(data, i); this.planetAlive.push(true); });
        // darties.fr — bases Phaser : créer le joueur avec physics.add.image
        const start = this.planetData[0];
        this.player = this.physics.add.image(start.x, start.y - start.radius - 30, '__DEFAULT');
        this.player.setDisplaySize(36, 46).setDepth(10);
        this.player.body.setAllowGravity(false);
        // darties.fr — animations : sprite et spritesheet
        this.playerSprite = this.add.sprite(this.player.x, this.player.y, 'player').setDisplaySize(48, 60).setDepth(11);
        if (!this.anims.exists('idle')) {
            this.anims.create({ key: 'idle',       frames: [{ key: 'player', frame: 0 }], frameRate: 1,  repeat: 0  });
            this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('player', { start: 5,  end: 9  }), frameRate: 10, repeat: -1 });
            this.anims.create({ key: 'walk-left',  frames: this.anims.generateFrameNumbers('player', { start: 10, end: 14 }), frameRate: 10, repeat: -1 });
            this.anims.create({ key: 'jump',       frames: [{ key: 'player', frame: 15 }], frameRate: 1,  repeat: 0  });
        }
        this.playerSprite.anims.play('idle');
        this.angle = -Math.PI / 2;
        this.currentPlanetIndex = 0;
        this.isOnPlanet = true;
        this.isFlying   = false;
        this.gameOver   = false;
        this.G          = 28000; // constante gravitationnelle
        this.blackHoleActive = false;
        // darties.fr — bases Phaser : clavier
        this.cursors = this.input.keyboard.createCursorKeys();
        // darties.fr — collisions : overlap joueur ↔ planètes
        this.physics.add.overlap(this.player, this.planetBodies, (player, planetBody) => {
            if (!this.isFlying || this.justLaunched) return;
            const idx = planetBody.planetIndex;
            if (!this.planetAlive[idx]) return;
            this.snapToPlanet(idx, Math.atan2(this.player.y - this.planetData[idx].y, this.player.x - this.planetData[idx].x));
            this.onLanding(idx);
        }, null, this);
        // darties.fr — bases Phaser : caméra qui suit le joueur
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        // darties.fr — chronomètre : HUD avec setScrollFactor(0)
        const c = { 1:'#44aaff', 2:'#ffaa44', 3:'#ff4444' }[this.level];
        this.add.text(20, 20, `Niveau ${this.level}`, { fontSize: '16px', fontFamily: 'Arial Black', color: c }).setScrollFactor(0).setDepth(100);
        this.timerText = this.add.text(20, 42, 'Temps : 0s', { fontSize: '16px', color: '#ffffff' }).setScrollFactor(0).setDepth(100);
        this.startTime = this.time.now;
        this.jumpCharge = 0;
        this.justLaunched = false;
        // Barre de charge
        this.chargeBarBg  = this.add.rectangle(640, 690, 200, 18, 0x333333).setScrollFactor(0).setDepth(100).setVisible(false);
        this.chargeBar    = this.add.rectangle(541, 690, 0, 14, 0xffcc00).setScrollFactor(0).setDepth(101).setOrigin(0, 0.5).setVisible(false);
        this.chargeText   = this.add.text(640, 672, 'CHARGE', { fontSize: '13px', color: '#ffcc00' }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
        this.snapToPlanet(0, -Math.PI / 2);
        // Musique
        this.sound.stopAll();
        this.sound.add('music', { loop: true, volume: 0.5 }).play();
    }
    buildPlanetData() {
        const all = [
            { x: 300,  y: 370, radius: 90, image: 'planet_jupiter', debrisColor: 0xffaa44 },
            { x: 650,  y: 310, radius: 38, image: 'planet_moon',    debrisColor: 0xcccccc },
            { x: 980,  y: 420, radius: 62, image: 'planet_earth',   debrisColor: 0x44aaff },
            { x: 1260, y: 240, radius: 30, image: 'planet_fire',    debrisColor: 0xff4400 },
            { x: 1600, y: 410, radius: 85, image: 'planet_alien',   debrisColor: 0x88ff44 },
            { x: 1950, y: 290, radius: 34, image: 'planet_crystal', debrisColor: 0xaaddff },
            { x: 2200, y: 185, radius: 28, image: 'planet_ice',     debrisColor: 0x88eeff },
            { x: 2520, y: 390, radius: 58, image: 'planet_mars',    debrisColor: 0xcc4422 },
            { x: 2900, y: 460, radius: 80, image: 'planet_desert',  debrisColor: 0xddaa44 },
            { x: 3200, y: 175, radius: 28, image: 'planet_forest',  debrisColor: 0x44cc44 },
            { x: 3530, y: 350, radius: 55, image: 'planet_lava',    debrisColor: 0xff5500 },
            { x: 3960, y: 415, radius: 95, image: 'planet_saturn',  debrisColor: 0xddcc88 },
        ];
        const planets = all.slice(0, { 1:5, 2:7, 3:10 }[this.level]);
        const safeX = planets[planets.length - 1].x + Phaser.Math.Between(550, 700);
        // darties.fr — multi-niveaux : contenu différent selon le niveau
        planets.push(this.level === 3
            ? { x: safeX, y: 355, radius: 80,  image: 'ship',         debrisColor: 0xaaddff, type: 'safe' }
            : { x: safeX, y: 355, radius: 100, image: 'planet_earth', debrisColor: 0x44aaff, type: 'safe' }
        );
        planets.forEach((p, i) => { if (!p.type) p.type = i === 0 ? 'start' : 'normal'; });
        // Planètes répulsives (niveaux 2 et 3)
        if (this.level >= 2) {
            [
                { x: 820,  y: 500, radius: 22, image: 'planet_lava', debrisColor: 0xff5500, type: 'repulsive' },
                { x: 1420, y: 150, radius: 20, image: 'planet_lava', debrisColor: 0xff5500, type: 'repulsive' },
                { x: 2300, y: 530, radius: 25, image: 'planet_lava', debrisColor: 0xff5500, type: 'repulsive' },
                { x: 3050, y: 480, radius: 22, image: 'planet_lava', debrisColor: 0xff5500, type: 'repulsive' },
            ].forEach(p => planets.push(p));
        }
        return planets;
    }
    snapToPlanet(planetIndex, angle) {
        // Marche circulaire : cos/sin pour placer le joueur sur la surface
        const data = this.planetData[planetIndex];
        this.player.x = data.x + Math.cos(angle) * (data.radius + 24);
        this.player.y = data.y + Math.sin(angle) * (data.radius + 24);
        this.player.body.setVelocity(0, 0);
        this.currentPlanetIndex = planetIndex;
        this.angle = angle;
        this.isOnPlanet = true;
        this.isFlying   = false;
        this.jumpCharge = 0;
        if (this.chargeBar) {
            this.chargeBarBg.setVisible(false);
            this.chargeBar.setVisible(false);
            this.chargeText.setVisible(false);
            this.chargeBar.setSize(0, 14);
        }
    }
    createPlanet(data, index) {
        // darties.fr — tweens : anneau pulsant autour de la planète
        const pulseRing = this.add.circle(data.x, data.y, data.radius * 2.2, 0xffffff, 0);
        pulseRing.setStrokeStyle(1, data.type === 'repulsive' ? 0xff4400 : 0x88ccff, 0.4);
        this.tweens.add({ targets: pulseRing, scaleX: data.type === 'repulsive' ? 2.5 : 0.5, scaleY: data.type === 'repulsive' ? 2.5 : 0.5, alpha: 0, duration: 1000, repeat: -1, ease: 'Sine.easeOut' });
        // darties.fr — bases Phaser : add.image pour afficher la planète
        const img = this.add.image(data.x, data.y, data.image).setDisplaySize(data.radius * 2, data.radius * 2);
        if (data.type === 'repulsive') img.setTint(0xff3300);
        // darties.fr — collisions : staticImage invisible = hitbox carrée
        if (data.type !== 'repulsive') {
            const body = this.physics.add.staticImage(data.x, data.y, '__DEFAULT');
            body.setDisplaySize(data.radius * 2, data.radius * 2).setVisible(false);
            body.planetIndex = index;
            body.refreshBody();
            this.planetBodies.add(body);
        }
        // Décorations sur les répulsives
        if (data.type === 'repulsive' && this.level >= 2) {
            const key = this.level === 3 && index % 2 !== 0 ? 'epstein' : 'trump';
            const deco = this.add.image(data.x, data.y - data.radius - 5, key);
            deco.setDisplaySize(60, 75).setDepth(20).setOrigin(0.5, 1);
        }
        this.planetGraphics.push(img);
    }
    update() {
        // darties.fr — bases Phaser : boucle update() appelée chaque frame
        if (this.gameOver) return;
        if (this.isOnPlanet)    this.updateOnPlanet();
        else if (this.isFlying) this.updateFlying();
        this.playerSprite.x = this.player.x;
        this.playerSprite.y = this.player.y;
        this.playerSprite.rotation = this.player.rotation;
        // darties.fr — chronomètre
        this.timerText.setText('Temps : ' + Math.floor((this.time.now - this.startTime) / 1000) + 's');
        // darties.fr — borne du monde : mort si le joueur sort de la map
        if (this.player.y > 700 || this.player.y < -150 || this.player.x < -100 || this.player.x > 8000) this.onDeath();
    }
    updateOnPlanet() {
        const data = this.planetData[this.currentPlanetIndex];
        // darties.fr — bases Phaser : déplacement clavier
        if (this.cursors.right.isDown) { this.angle += 0.025; this.playerSprite.anims.play('walk-right', true); }
        else if (this.cursors.left.isDown) { this.angle -= 0.025; this.playerSprite.anims.play('walk-left', true); }
        else { this.playerSprite.anims.play('idle', true); }
        // Marche circulaire (cos/sin)
        this.player.x = data.x + Math.cos(this.angle) * (data.radius + 24);
        this.player.y = data.y + Math.sin(this.angle) * (data.radius + 24);
        this.player.rotation = this.angle + Math.PI / 2;
        this.player.body.setVelocity(0, 0);
        if (this.cursors.space.isDown) {
            if (this.jumpCharge === 0) this.jumpCharge = 0.05;
            // Barre de charge
            this.jumpCharge = Math.min(1, this.jumpCharge + 0.6 / data.radius);
            this.chargeBarBg.setVisible(true); this.chargeBar.setVisible(true); this.chargeText.setVisible(true);
            this.chargeBar.setSize(Math.floor(this.jumpCharge * 196), 14);
            this.chargeBar.setFillStyle(this.jumpCharge < 0.5 ? 0xffcc00 : this.jumpCharge < 0.85 ? 0xff8800 : 0xff2200);
        }
        // darties.fr — bases Phaser : JustUp = relâchement unique
        if (Phaser.Input.Keyboard.JustUp(this.cursors.space) && this.jumpCharge > 0) {
            const force = (300 + data.radius * 3.5) * Math.max(0.2, this.jumpCharge);
            // darties.fr — bases Phaser : setVelocity pour lancer le joueur
            this.player.body.setVelocity(Math.cos(this.angle) * force, Math.sin(this.angle) * force);
            this.jumpCharge = 0;
            this.chargeBarBg.setVisible(false); this.chargeBar.setVisible(false); this.chargeText.setVisible(false);
            this.isOnPlanet = false; this.isFlying = true; this.justLaunched = true;
            this.playerSprite.anims.play('jump', true);
            // darties.fr — timers : delayedCall
            this.time.delayedCall(400, () => { this.justLaunched = false; });
        }
    }
    updateFlying() {
        // Gravité custom : F = G * rayon / distance² (extension mathématique sur setVelocity Phaser)
        let closestIdx = -1, closestDist = Infinity;
        this.planetData.forEach((data, i) => {
            if (!this.planetAlive[i] || data.type === 'repulsive') return;
            const dist = Math.hypot(data.x - this.player.x, data.y - this.player.y);
            if (dist < closestDist) { closestDist = dist; closestIdx = i; }
        });
        if (closestIdx === -1) return;
        const t = this.planetData[closestIdx];
        const dx = t.x - this.player.x, dy = t.y - this.player.y;
        const dist = Math.hypot(dx, dy);
        const delta = this.game.loop.delta / 1000;
        // darties.fr — bases Phaser : setVelocityX/Y pour appliquer la gravité
        const force = Phaser.Math.Clamp(this.G * t.radius / (dist * dist) * 2, 0, 1200);
        this.player.body.setVelocityX(this.player.body.velocity.x + (dx / dist) * force * delta);
        this.player.body.setVelocityY(this.player.body.velocity.y + (dy / dist) * force * delta);
        // Répulsion des planètes répulsives
        this.planetData.forEach((data, i) => {
            if (!this.planetAlive[i] || data.type !== 'repulsive') return;
            const rdx = this.player.x - data.x, rdy = this.player.y - data.y;
            const rdist = Math.hypot(rdx, rdy);
            if (rdist < data.radius * 6 && rdist > 1) {
                const rep = Phaser.Math.Clamp(this.G * 1.5 * data.radius / (rdist * rdist), 0, 700);
                this.player.body.setVelocityX(this.player.body.velocity.x + (rdx / rdist) * rep * delta);
                this.player.body.setVelocityY(this.player.body.velocity.y + (rdy / rdist) * rep * delta);
            }
        });
        this.player.rotation = Math.atan2(this.player.body.velocity.y, this.player.body.velocity.x) + Math.PI / 2;
    }
    onLanding(planetIndex) {
        // darties.fr — animations : idle à l'atterrissage
        this.playerSprite.anims.play('idle', true);
        const data = this.planetData[planetIndex];
        if (data.type === 'safe') {
            // darties.fr — multi-niveaux : scene.start()
            if (this.level === 3) this.onVictory();
            else this.triggerBlackHole(planetIndex);
            return;
        }
        this.startPlanetDestruction(planetIndex);
    }
    onVictory() {
        if (this.gameOver) return;
        this.gameOver = true;
        const elapsed = Math.floor((this.time.now - this.startTime) / 1000);
        const shipData = this.planetData.find(p => p.type === 'safe');
        const shipGfx  = this.planetGraphics[this.planetData.indexOf(shipData)];
        this.playerSprite.anims.play('walk-right', true);
        // darties.fr — tweens : joueur glisse vers le vaisseau
        this.tweens.add({
            targets: [this.player, this.playerSprite], x: shipData.x, y: shipData.y, duration: 1000, ease: 'Sine.easeIn',
            onComplete: () => {
                this.tweens.add({ targets: [this.player, this.playerSprite], scaleX: 0, scaleY: 0, alpha: 0, duration: 400 });
                this.time.delayedCall(500, () => {
                    this.tweens.add({ targets: shipGfx, y: shipData.y - 500, scaleX: 0.2, scaleY: 0.2, alpha: 0, duration: 2000 });
                    this.time.delayedCall(1500, () => {
                        this.cameras.main.fade(500, 0, 0, 0);
                        this.time.delayedCall(500, () => { this.scene.start('WinScene', { time: elapsed }); });
                    });
                });
            }
        });
    }
    triggerBlackHole(planetIndex) {
        if (this.blackHoleActive) return;
        this.blackHoleActive = true;
        const data = this.planetData[planetIndex];
        const gfx  = this.planetGraphics[planetIndex];
        // darties.fr — tweens : animation trou noir
        this.tweens.add({
            targets: gfx, duration: 1200,
            onUpdate: (tween) => {
                const p = tween.progress;
                gfx.setTint(p < 0.5 ? Phaser.Display.Color.GetColor(Math.floor(120*(1-p*2)), 0, 150) : 0x110022);
                gfx.setScale(1 + p * 0.6);
            },
            onComplete: () => { gfx.setTint(0x000000); }
        });
        this.tweens.add({ targets: [this.player, this.playerSprite], scaleX: 0, scaleY: 0, alpha: 0, duration: 1400, ease: 'Sine.easeIn' });
        // darties.fr — timers : transition vers le niveau suivant
        this.time.delayedCall(1800, () => {
            this.cameras.main.fade(500, 0, 0, 0);
            this.time.delayedCall(500, () => { this.scene.start('GameScene', { level: this.level + 1 }); });
        });
    }
    startPlanetDestruction(planetIndex) {
        const data = this.planetData[planetIndex];
        const gfx  = this.planetGraphics[planetIndex];
        if (!gfx || !gfx.active) return;
        const steps = 8, totalTime = 3200;
        let step = 0;
        // darties.fr — timers : étapes de désintégration avec time.addEvent()
        this.time.addEvent({
            delay: totalTime / steps, repeat: steps - 1,
            callback: () => {
                step++;
                const p = step / steps;
                if (gfx.active) { gfx.setScale(1 - p * 0.45); gfx.setAlpha(1 - p * 0.5); gfx.setTint(Phaser.Display.Color.GetColor(255, Math.floor(255*(1-p)), 50)); }
                // darties.fr — tweens : débris qui s'envolent
                for (let i = 0; i < 4; i++) {
                    const a = Phaser.Math.FloatBetween(0, Math.PI*2);
                    const d = this.add.circle(data.x + Math.cos(a)*data.radius*0.5, data.y + Math.sin(a)*data.radius*0.5, Phaser.Math.Between(2,6), data.debrisColor, 0.85);
                    this.tweens.add({ targets: d, x: d.x + Phaser.Math.Between(-60,60), y: d.y + Phaser.Math.Between(20,80), alpha: 0, duration: 600, onComplete: () => d.destroy() });
                }
                if (step >= steps) {
                    this.planetAlive[planetIndex] = false;
                    if (gfx.active) gfx.destroy();
                    if (this.isOnPlanet && this.currentPlanetIndex === planetIndex) this.onDeath();
                }
            }
        });
    }
    onDeath() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.cameras.main.flash(400, 255, 0, 0);
        // darties.fr — timers + multi-niveaux : recommencer le niveau
        this.time.delayedCall(800, () => { this.scene.start('GameScene', { level: this.level }); });
    }
    showLevelBanner() {
        // darties.fr — tweens : bannière yoyo
        const { width, height } = this.scale;
        const banner = this.add.text(width/2, height/2, { 1:'NIVEAU 1', 2:'NIVEAU 2', 3:'NIVEAU FINAL' }[this.level],
            { fontSize: '56px', fontFamily: 'Arial Black', color: { 1:'#44aaff', 2:'#ffaa44', 3:'#ff4444' }[this.level] }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
        this.tweens.add({ targets: banner, alpha: 1, duration: 400, yoyo: true, hold: 1200, onComplete: () => banner.destroy() });
    }
}
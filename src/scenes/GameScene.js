// ============================================================
//  GameScene.js — Système de 3 niveaux
//
//  Niveau 1 : 6 planètes, peu de comètes, trump sur 1/3
//             → safe planet devient trou noir → niveau 2
//  Niveau 2 : 8 planètes, quelques comètes, trump sur 1/2
//             → safe planet devient trou noir → niveau 3
//  Niveau 3 : 10 planètes, beaucoup de comètes, trump+epstein partout
//             → vraie planète safe → écran de victoire
// ============================================================

class GameScene extends Phaser.Scene {

    constructor() {
        super({ key: 'GameScene' });
    }

    // ----------------------------------------------------------
    //  INIT — reçoit le numéro de niveau depuis scene.start()
    // ----------------------------------------------------------
    init(data) {
        this.level = data.level || 1;
    }

    // ----------------------------------------------------------
    //  PRELOAD
    // ----------------------------------------------------------
    preload() {
        this.load.spritesheet('player', 'assets/darties.png', {
            frameWidth: 204,
            frameHeight: 256
        });

        const planetNames = [
            'planet_alien', 'planet_crystal', 'planet_desert', 'planet_earth',
            'planet_fire',  'planet_forest',  'planet_ice',    'planet_jupiter',
            'planet_lava',  'planet_mars',    'planet_moon',   'planet_saturn',
            'planet_snow'
        ];
        planetNames.forEach(name => {
            this.load.image(name, `assets/planetes/${name}.png`);
        });

        this.load.image('trump',   'assets/trump.png');
        this.load.image('epstein', 'assets/epstein.png');
    }

    // ----------------------------------------------------------
    //  CREATE
    // ----------------------------------------------------------
    create() {
        const WORLD_WIDTH  = this.level === 1 ? 4500 :
                             this.level === 2 ? 5800 : 7500;
        const WORLD_HEIGHT = 720;

        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.physics.world.gravity.set(0, 0);

        this.createStarBackground(WORLD_WIDTH, WORLD_HEIGHT);
        this.showLevelBanner();

        // Config par niveau
        this.levelConfig = {
            1: { cometDelay: 9000,  trumpEvery: 3, epsteinEvery: 99 },
            2: { cometDelay: 6000,  trumpEvery: 2, epsteinEvery: 99 },
            3: { cometDelay: 3000,  trumpEvery: 2, epsteinEvery: 3  },
        }[this.level];

        // Planètes selon le niveau
        this.planetData = this.buildPlanetData();

        this.planetGraphics = [];
        this.planetAlive    = [];

        this.planetData.forEach((data, i) => {
            this.createPlanet(data, i);
            this.planetAlive.push(true);
        });

        // === JOUEUR ===
        const start = this.planetData[0];
        this.player = this.physics.add.image(
            start.x, start.y - start.radius - 30, '__DEFAULT'
        );
        this.player.setDisplaySize(36, 46);
        this.player.setTint(0xffffff);
        this.player.setDepth(10);
        this.player.body.setAllowGravity(false);

        this.playerSprite = this.add.sprite(this.player.x, this.player.y, 'player');
        this.playerSprite.setDisplaySize(48, 60);
        this.playerSprite.setDepth(11);

        // === ANIMATIONS ===
        if (!this.anims.exists('idle')) {
            this.anims.create({ key: 'idle',       frames: [{ key: 'player', frame: 0 }], frameRate: 1,  repeat: 0  });
            this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('player', { start: 5,  end: 9  }), frameRate: 10, repeat: -1 });
            this.anims.create({ key: 'walk-left',  frames: this.anims.generateFrameNumbers('player', { start: 10, end: 14 }), frameRate: 10, repeat: -1 });
            this.anims.create({ key: 'jump',       frames: [{ key: 'player', frame: 15 }], frameRate: 1, repeat: 0  });
        }
        this.playerSprite.anims.play('idle');

        // === ÉTAT ===
        this.angle              = -Math.PI / 2;
        this.currentPlanetIndex = 0;
        this.isOnPlanet         = true;
        this.isFlying           = false;
        this.gameOver           = false;
        this.G                  = 45000;
        this.blackHoleActive    = false;

        // === CLAVIER ===
        this.cursors = this.input.keyboard.createCursorKeys();

        // === CAMÉRA ===
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

        // === UI ===
        this.createUI();
        this.startTime = this.time.now;
        this.showControls();

        // === BARRE DE CHARGE ===
        this.jumpCharge   = 0;
        this.isCharging   = false;
        this.justLaunched = false;

        this.chargeBarBg = this.add.rectangle(640, 690, 200, 18, 0x333333)
            .setScrollFactor(0).setDepth(100).setVisible(false);
        this.chargeBar = this.add.rectangle(541, 690, 0, 14, 0xffcc00)
            .setScrollFactor(0).setDepth(101).setOrigin(0, 0.5).setVisible(false);
        this.chargeText = this.add.text(640, 672, 'CHARGE', {
            fontSize: '13px', fontFamily: 'Arial Black', color: '#ffcc00'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);

        this.snapToPlanet(0, -Math.PI / 2);

        // === COMÈTES & MÉTÉORITES ===
        this.flyingObjects = [];
        this.time.addEvent({
            delay: this.levelConfig.cometDelay,
            loop: true,
            callback: this.spawnFlyingObject,
            callbackScope: this
        });
    }

    // ----------------------------------------------------------
    //  Construction des planètes selon le niveau
    // ----------------------------------------------------------
    buildPlanetData() {
        const all = [
            { x: 300,  y: 370, radius: 90,  image: 'planet_jupiter', debrisColor: 0xffaa44 },
            { x: 650,  y: 310, radius: 38,  image: 'planet_moon',    debrisColor: 0xcccccc },
            { x: 980,  y: 420, radius: 62,  image: 'planet_earth',   debrisColor: 0x44aaff },
            { x: 1260, y: 240, radius: 30,  image: 'planet_fire',    debrisColor: 0xff4400 },
            { x: 1600, y: 410, radius: 85,  image: 'planet_alien',   debrisColor: 0x88ff44 },
            { x: 1950, y: 290, radius: 34,  image: 'planet_crystal', debrisColor: 0xaaddff },
            { x: 2200, y: 185, radius: 28,  image: 'planet_ice',     debrisColor: 0x88eeff },
            { x: 2520, y: 390, radius: 58,  image: 'planet_mars',    debrisColor: 0xcc4422 },
            { x: 2900, y: 460, radius: 80,  image: 'planet_desert',  debrisColor: 0xddaa44 },
            { x: 3200, y: 175, radius: 28,  image: 'planet_forest',  debrisColor: 0x44cc44 },
            { x: 3530, y: 350, radius: 55,  image: 'planet_lava',    debrisColor: 0xff5500 },
            { x: 3960, y: 415, radius: 95,  image: 'planet_saturn',  debrisColor: 0xddcc88 },
        ];

        const counts = { 1: 5, 2: 7, 3: 10 };
        const count  = counts[this.level];

        const planets = all.slice(0, count);

        // Planète safe
        const safeX = planets[planets.length - 1].x + Phaser.Math.Between(550, 700);
        planets.push({
            x: safeX, y: 355, radius: 100,
            image: 'planet_earth',
            debrisColor: 0x44aaff,
            type: 'safe'
        });

        // Marquer les autres comme 'normal' ou 'start'
        planets.forEach((p, i) => {
            if (!p.type) p.type = i === 0 ? 'start' : 'normal';
        });

        // Niveau 3 : ajouter 4 petites planètes répulsives
        // Placées entre les planètes normales pour gêner les sauts
        if (this.level === 3) {
            const repulsivePlanets = [
                { x: 820,  y: 500, radius: 22, image: 'planet_lava',    debrisColor: 0xff5500, type: 'repulsive' },
                { x: 1420, y: 150, radius: 20, image: 'planet_lava',    debrisColor: 0xff5500, type: 'repulsive' },
                { x: 2300, y: 530, radius: 25, image: 'planet_lava',    debrisColor: 0xff5500, type: 'repulsive' },
                { x: 3050, y: 480, radius: 22, image: 'planet_lava',    debrisColor: 0xff5500, type: 'repulsive' },
            ];
            repulsivePlanets.forEach(p => planets.push(p));
        }

        return planets;
    }

    // ----------------------------------------------------------
    //  Positionner le joueur à la surface
    // ----------------------------------------------------------
    snapToPlanet(planetIndex, angle) {
        const data   = this.planetData[planetIndex];
        const offset = data.radius + 24;

        this.player.x = data.x + Math.cos(angle) * offset;
        this.player.y = data.y + Math.sin(angle) * offset;
        this.player.body.setVelocity(0, 0);

        this.currentPlanetIndex = planetIndex;
        this.angle      = angle;
        this.isOnPlanet = true;
        this.isFlying   = false;

        this.jumpCharge = 0;
        this.isCharging = false;
        if (this.chargeBar) {
            this.chargeBarBg.setVisible(false);
            this.chargeBar.setVisible(false);
            this.chargeText.setVisible(false);
            this.chargeBar.setSize(0, 14);
        }
    }

    // ----------------------------------------------------------
    //  Création d'une planète
    // ----------------------------------------------------------
    createPlanet(data, index) {
        // Anneaux gravitationnels
        [2.2, 3.5, 5.0].forEach((factor, i) => {
            const alpha = [0.18, 0.10, 0.05][i];
            const ring  = this.add.circle(data.x, data.y, data.radius * factor, 0xffffff, 0);
            ring.setStrokeStyle(1.5, 0xaaddff, alpha);
        });

        const pulseRing = this.add.circle(data.x, data.y, data.radius * 2.2, 0xffffff, 0);
        pulseRing.setStrokeStyle(1, 0x88ccff, 0.3);
        this.tweens.add({
            targets: pulseRing,
            scaleX: 1 + (data.radius / 100) * 0.4,
            scaleY: 1 + (data.radius / 100) * 0.4,
            alpha: 0,
            duration: 1200 + data.radius * 10,
            repeat: -1,
            ease: 'Sine.easeOut'
        });

        // Image planète
        const img = this.add.image(data.x, data.y, data.image);
        img.setDisplaySize(data.radius * 2, data.radius * 2);

        // Planète répulsive : teinte rouge + anneaux rouges + icône ↑
        if (data.type === 'repulsive') {
            img.setTint(0xff3300);

            // Anneaux rouges répulsifs (vers l'extérieur)
            [2.0, 3.2, 4.5].forEach((factor, i) => {
                const ring = this.add.circle(data.x, data.y, data.radius * factor, 0xff0000, 0);
                ring.setStrokeStyle(1.5, 0xff4400, [0.25, 0.15, 0.07][i]);
            });

            // Anneau pulsant rouge
            const pulseRed = this.add.circle(data.x, data.y, data.radius * 2.0, 0xff0000, 0);
            pulseRed.setStrokeStyle(1.5, 0xff2200, 0.5);
            this.tweens.add({
                targets: pulseRed,
                scaleX: 2.5, scaleY: 2.5, alpha: 0,
                duration: 800, repeat: -1, ease: 'Sine.easeOut'
            });

            // Petit label "↑" au-dessus
            this.add.text(data.x, data.y - data.radius - 14, '↑ RÉPULSIF ↑', {
                fontSize: '10px', color: '#ff4400', fontFamily: 'Arial Black'
            }).setOrigin(0.5);

            this.planetGraphics.push(img);
            return; // pas de décorations trump/epstein sur une répulsive
        }

        // Label SAFE
        if (data.type === 'safe') {
            const label = this.level === 3 ? '★ SAFE' : '★ SAFE ?';
            const color = this.level === 3 ? '#44ff88' : '#ffcc44';
            this.add.text(data.x, data.y - data.radius - 28, label, {
                fontSize: '20px', color, fontFamily: 'Arial Black'
            }).setOrigin(0.5);
        }

        // Décorations selon le niveau — jamais sur la planète safe, jamais sur la planète de départ
        if (data.type !== 'start' && data.type !== 'safe') {
            const cfg = this.levelConfig;

            // Niveau 2 et 3 : Trump — toujours à gauche du sommet
            if (this.level >= 2 && index % cfg.trumpEvery === 0) {
                const size   = Math.max(80, data.radius * 1.8);
                const offsetX = this.level === 3 ? -data.radius * 0.55 : 0;
                const deco   = this.add.image(data.x + offsetX, data.y - data.radius, 'trump');
                deco.setDisplaySize(size * 0.8, size);
                deco.setDepth(9);
                deco.setOrigin(0.5, 1);
            }

            // Niveau 3 uniquement : Epstein — toujours à droite du sommet
            if (this.level === 3 && index % cfg.epsteinEvery === 0) {
                const size    = Math.max(120, data.radius * 2.6);
                const offsetX = data.radius * 0.55;
                const deco    = this.add.image(data.x + offsetX, data.y - data.radius, 'epstein');
                deco.setDisplaySize(size * 0.8, size);
                deco.setDepth(9);
                deco.setOrigin(0.5, 1);
            }
        }

        this.planetGraphics.push(img);
    }


    // ----------------------------------------------------------
    //  UPDATE
    // ----------------------------------------------------------
    update() {
        if (this.gameOver) return;

        if (this.isOnPlanet) {
            this.updateOnPlanet();
        } else if (this.isFlying) {
            this.updateFlying();
        }

        this.playerSprite.x        = this.player.x;
        this.playerSprite.y        = this.player.y;
        this.playerSprite.rotation = this.player.rotation;

        const elapsed = Math.floor((this.time.now - this.startTime) / 1000);
        this.timerText.setText('Temps : ' + elapsed + 's');

        this.updateFlyingObjects(this.game.loop.delta);

        if (this.player.y > 700 || this.player.y < -150 ||
            this.player.x < -100 || this.player.x > 8000) {
            this.onDeath();
        }
    }

    // ----------------------------------------------------------
    //  Sur planète
    // ----------------------------------------------------------
    updateOnPlanet() {
        const data       = this.planetData[this.currentPlanetIndex];
        const WALK_SPEED = 0.025;

        if (this.cursors.right.isDown) {
            this.angle += WALK_SPEED;
            this.playerSprite.anims.play('walk-right', true);
        } else if (this.cursors.left.isDown) {
            this.angle -= WALK_SPEED;
            this.playerSprite.anims.play('walk-left', true);
        } else {
            this.playerSprite.anims.play('idle', true);
        }

        const offset  = data.radius + 24;
        this.player.x = data.x + Math.cos(this.angle) * offset;
        this.player.y = data.y + Math.sin(this.angle) * offset;
        this.player.rotation = this.angle + Math.PI / 2;
        this.player.body.setVelocity(0, 0);

        if (this.cursors.space.isDown) {
            // Garantir une charge minimale dès le premier appui
            if (this.jumpCharge === 0) this.jumpCharge = 0.05;
            this.chargeJump();
        }

        // Lancer dès que ESPACE est relâché, même si la charge est très faible
        if (Phaser.Input.Keyboard.JustUp(this.cursors.space) && this.jumpCharge > 0) {
            this.launchFromPlanet();
        }
    }

    // ----------------------------------------------------------
    //  Charge saut
    // ----------------------------------------------------------
    chargeJump() {
        const data = this.planetData[this.currentPlanetIndex];
        this.jumpCharge = Math.min(1, this.jumpCharge + 0.6 / data.radius);
        this.isCharging = true;

        this.chargeBarBg.setVisible(true);
        this.chargeBar.setVisible(true);
        this.chargeText.setVisible(true);
        this.chargeBar.setSize(Math.floor(this.jumpCharge * 196), 14);

        if (this.jumpCharge < 0.5)       this.chargeBar.setFillStyle(0xffcc00);
        else if (this.jumpCharge < 0.85) this.chargeBar.setFillStyle(0xff8800);
        else                              this.chargeBar.setFillStyle(0xff2200);

        const shake = (this.jumpCharge * 2) * (Math.random() - 0.5);
        this.playerSprite.x = this.player.x + shake;
        this.playerSprite.y = this.player.y + shake;
    }

    // ----------------------------------------------------------
    //  Lancement
    // ----------------------------------------------------------
    launchFromPlanet() {
        const data   = this.planetData[this.currentPlanetIndex];
        const charge = this.jumpCharge;

        this.jumpCharge = 0;
        this.isCharging = false;
        this.chargeBarBg.setVisible(false);
        this.chargeBar.setVisible(false);
        this.chargeText.setVisible(false);
        this.chargeBar.setSize(0, 14);

        const radialX         = Math.cos(this.angle);
        const radialY         = Math.sin(this.angle);
        const chargeEffective = Math.max(0.2, charge);
        const launchForce     = (300 + data.radius * 3.5) * chargeEffective;

        let nextPlanet = null, minDist = Infinity;
        this.planetData.forEach((p, i) => {
            if (i !== this.currentPlanetIndex && this.planetAlive[i]) {
                const dist = Math.sqrt((p.x - data.x) ** 2 + (p.y - data.y) ** 2);
                if (dist < minDist) { minDist = dist; nextPlanet = p; }
            }
        });

        let vx, vy;
        if (nextPlanet && charge > 0.4) {
            const dx = nextPlanet.x - this.player.x;
            const dy = nextPlanet.y - this.player.y;
            const t  = 0.9 + (1 - charge) * 0.5;
            vx = (dx / t) * 0.55 + radialX * launchForce * 0.45;
            vy = (dy / t) * 0.55 + radialY * launchForce * 0.45;
            const speed = Math.sqrt(vx * vx + vy * vy);
            const MAX   = 200 + launchForce;
            if (speed > MAX) { vx = (vx / speed) * MAX; vy = (vy / speed) * MAX; }
        } else {
            vx = radialX * launchForce;
            vy = radialY * launchForce;
        }

        this.player.body.setVelocity(vx, vy);
        this.isOnPlanet   = false;
        this.isFlying     = true;
        this.justLaunched = true;
        this.playerSprite.anims.play('jump', true);
        this.time.delayedCall(400, () => { this.justLaunched = false; });
    }

    // ----------------------------------------------------------
    //  En vol
    // ----------------------------------------------------------
    updateFlying() {
        let closestIdx = -1, closestDist = Infinity;

        // Trouver la planète attractive la plus proche (exclure les répulsives)
        this.planetData.forEach((data, i) => {
            if (!this.planetAlive[i]) return;
            if (data.type === 'repulsive') return; // traitées séparément
            const dx   = data.x - this.player.x;
            const dy   = data.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < closestDist) { closestDist = dist; closestIdx = i; }
        });

        if (closestIdx === -1) return;

        const target = this.planetData[closestIdx];
        const dx     = target.x - this.player.x;
        const dy     = target.y - this.player.y;
        const dist   = Math.sqrt(dx * dx + dy * dy);
        const delta  = this.game.loop.delta / 1000;
        const force  = Phaser.Math.Clamp(this.G * target.radius / (dist * dist), 0, 900);

        // Attraction vers la planète normale la plus proche
        this.player.body.setVelocityX(this.player.body.velocity.x + (dx / dist) * force * delta);
        this.player.body.setVelocityY(this.player.body.velocity.y + (dy / dist) * force * delta);

        // === RÉPULSION des planètes répulsives ===
        this.planetData.forEach((data, i) => {
            if (!this.planetAlive[i] || data.type !== 'repulsive') return;

            const rdx  = this.player.x - data.x; // inversé : joueur → planète
            const rdy  = this.player.y - data.y;
            const rdist = Math.sqrt(rdx * rdx + rdy * rdy);

            // Zone d'influence = rayon * 6
            if (rdist < data.radius * 6 && rdist > 1) {
                // Force inversement proportionnelle — plus fort quand on est proche
                const repForce = Phaser.Math.Clamp(
                    this.G * 1.5 * data.radius / (rdist * rdist), 0, 700
                );
                this.player.body.setVelocityX(
                    this.player.body.velocity.x + (rdx / rdist) * repForce * delta
                );
                this.player.body.setVelocityY(
                    this.player.body.velocity.y + (rdy / rdist) * repForce * delta
                );
            }
        });

        const vx = this.player.body.velocity.x;
        const vy = this.player.body.velocity.y;
        this.player.rotation = Math.atan2(vy, vx) + Math.PI / 2;

        // Atterrissage — impossible sur les planètes répulsives
        if (dist < target.radius + 28 && !this.justLaunched) {
            const landAngle = Math.atan2(this.player.y - target.y, this.player.x - target.x);
            this.snapToPlanet(closestIdx, landAngle);
            this.onLanding(closestIdx);
        }

    }

    // ----------------------------------------------------------
    //  Atterrissage
    // ----------------------------------------------------------
    onLanding(planetIndex) {
        const data = this.planetData[planetIndex];
        this.playerSprite.anims.play('idle', true);

        if (data.type === 'safe') {
            if (this.level === 3) {
                // Vraie fin !
                this.onVictory();
            } else {
                // Transformation en trou noir → niveau suivant
                this.triggerBlackHole(planetIndex);
            }
            return;
        }

        this.startPlanetDestruction(planetIndex);
    }

    triggerBlackHole(planetIndex) {
        if (this.blackHoleActive) return;
        this.blackHoleActive = true;

        const data = this.planetData[planetIndex];
        const gfx  = this.planetGraphics[planetIndex];

        // La planète vire au violet puis devient noire et grossit
        // On crée un cercle noir qui recouvre progressivement la planète
        const blackCircle = this.add.circle(data.x, data.y, data.radius, 0x000000, 0);
        blackCircle.setDepth(gfx.depth + 1);

        this.tweens.add({
            targets: gfx,
            duration: 1200,
            onUpdate: (tween) => {
                const p = tween.progress;
                if (p < 0.5) {
                    // Phase 1 : violet progressif
                    const t = p * 2;
                    gfx.setTint(Phaser.Display.Color.GetColor(
                        Math.floor(120 * (1 - t)),
                        0,
                        Math.floor(200 * (1 - t * 0.3))
                    ));
                    blackCircle.setAlpha(0);
                } else {
                    // Phase 2 : le cercle noir recouvre la planète
                    const t = (p - 0.5) * 2; // 0 → 1
                    gfx.setTint(0x110022);
                    blackCircle.setAlpha(t);
                    blackCircle.setRadius(data.radius * (1 + p * 0.6));
                }
                gfx.setScale(1 + p * 0.6);
                blackCircle.setScale(1 + p * 0.6);
            },
            onComplete: () => {
                // S'assurer que c'est complètement noir à la fin
                blackCircle.setAlpha(1);
                gfx.setTint(0x000000);
            }
        });

        // === CERCLES VIOLETS qui s'élargissent ===
        const spawnRings = () => {
            [1.5, 2.5, 4.0].forEach((factor, i) => {
                const ring = this.add.circle(data.x, data.y, data.radius * factor, 0x6600ff, 0);
                ring.setStrokeStyle(3 - i * 0.5, 0xaa44ff, 0.9 - i * 0.2);
                ring.setDepth(25);
                this.tweens.add({
                    targets: ring,
                    scaleX: 3 + factor, scaleY: 3 + factor, alpha: 0,
                    duration: 1000 + i * 200, delay: i * 150,
                    ease: 'Sine.easeOut',
                    onComplete: () => ring.destroy()
                });
            });
        };

        spawnRings();
        this.time.delayedCall(400,  spawnRings);
        this.time.delayedCall(800,  spawnRings);
        this.time.delayedCall(1200, spawnRings);

        // Le joueur est aspiré et disparaît progressivement
        this.tweens.add({
            targets: [this.player, this.playerSprite],
            scaleX: 0, scaleY: 0,
            alpha: 0,
            duration: 1400,
            ease: 'Sine.easeIn'
        });

        this.time.addEvent({
            delay: 16,
            repeat: 80,
            callback: () => {
                const dx   = data.x - this.player.x;
                const dy   = data.y - this.player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5) {
                    this.player.x += (dx / dist) * 6;
                    this.player.y += (dy / dist) * 6;
                    this.playerSprite.x = this.player.x;
                    this.playerSprite.y = this.player.y;
                }
            }
        });

        // Fondu violet puis noir → niveau suivant
        this.time.delayedCall(1600, () => {
            spawnRings();

            const overlay = this.add.rectangle(
                this.cameras.main.scrollX + this.scale.width / 2,
                this.cameras.main.scrollY + this.scale.height / 2,
                this.scale.width, this.scale.height,
                0x220044, 0
            ).setScrollFactor(0).setDepth(50);

            this.tweens.add({ targets: overlay, alpha: 1, duration: 700, ease: 'Sine.easeIn' });

            this.time.delayedCall(400, () => {
                this.cameras.main.fade(500, 0, 0, 0);
                this.time.delayedCall(500, () => {
                    this.scene.start('GameScene', { level: this.level + 1 });
                });
            });
        });
    }


    // ----------------------------------------------------------
    //  Désintégration planète
    // ----------------------------------------------------------
    startPlanetDestruction(planetIndex) {
        const data = this.planetData[planetIndex];
        const gfx  = this.planetGraphics[planetIndex];
        if (!gfx || !gfx.active) return;

        const steps = 8, totalTime = 3200;
        let step = 0;

        const alert = this.add.text(data.x, data.y - data.radius - 35, '⚠ INSTABLE !',
            { fontSize: '14px', color: '#ffaa00', fontFamily: 'Arial Black' }
        ).setOrigin(0.5).setDepth(15);
        this.time.delayedCall(totalTime, () => { if (alert.active) alert.destroy(); });

        this.time.addEvent({
            delay: totalTime / steps,
            repeat: steps - 1,
            callback: () => {
                step++;
                const progress = step / steps;

                if (gfx.active) {
                    gfx.setScale(1 - progress * 0.45);
                    gfx.setAlpha(1 - progress * 0.5);
                    const g = Math.floor(255 * (1 - progress));
                    gfx.setTint(Phaser.Display.Color.GetColor(255, g, 50));
                }

                for (let i = 0; i < 5; i++) {
                    const angle  = Phaser.Math.FloatBetween(0, Math.PI * 2);
                    const r      = data.radius * Phaser.Math.FloatBetween(0.2, 1.0);
                    const debris = this.add.circle(
                        data.x + Math.cos(angle) * r,
                        data.y + Math.sin(angle) * r,
                        Phaser.Math.Between(2, 7) * (1 - progress * 0.3),
                        data.debrisColor, 0.85
                    );
                    this.tweens.add({
                        targets: debris,
                        x: debris.x + Phaser.Math.Between(-80, 80),
                        y: debris.y + Phaser.Math.Between(20, 100),
                        alpha: 0, duration: 700,
                        onComplete: () => debris.destroy()
                    });
                }

                if (step >= steps) {
                    this.planetAlive[planetIndex] = false;
                    if (gfx.active) gfx.destroy();

                    if (this.isOnPlanet && this.currentPlanetIndex === planetIndex) {
                        this.onDeath(); return;
                    }

                    const flash = this.add.circle(data.x, data.y, data.radius * 2.5, 0xffffff, 0.8);
                    this.tweens.add({
                        targets: flash, alpha: 0, scaleX: 3, scaleY: 3,
                        duration: 400, onComplete: () => flash.destroy()
                    });
                }
            }
        });
    }

    // ----------------------------------------------------------
    //  Victoire (niveau 3)
    // ----------------------------------------------------------
    onVictory() {
        this.gameOver = true;
        const elapsed = Math.floor((this.time.now - this.startTime) / 1000);
        this.time.delayedCall(1200, () => {
            this.scene.start('WinScene', { time: elapsed });
        });
    }

    // ----------------------------------------------------------
    //  Mort
    // ----------------------------------------------------------
    onDeath() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.cameras.main.flash(400, 255, 0, 0);
        this.time.delayedCall(800, () => {
            this.scene.start('GameScene', { level: this.level });
        });
    }

    // ----------------------------------------------------------
    //  Spawn comète/météorite
    // ----------------------------------------------------------
    spawnFlyingObject() {
        if (this.gameOver) return;

        const camX = this.cameras.main.scrollX;
        const camW = this.scale.width;
        const camH = this.scale.height;

        const isComet = Math.random() < 0.5;
        const config  = isComet ? {
            radius: Phaser.Math.Between(6, 12),  speed: Phaser.Math.Between(280, 450),
            color: 0x88ddff, tailColor: 0xaaeeff, mass: Phaser.Math.Between(15, 30)
        } : {
            radius: Phaser.Math.Between(18, 35), speed: Phaser.Math.Between(80, 160),
            color: 0xcc8844, tailColor: 0xff6622, mass: Phaser.Math.Between(50, 90)
        };

        const side = Phaser.Math.Between(0, 3);
        const margin = 100;
        let spawnX, spawnY, velX, velY;

        switch(side) {
            case 0: spawnX = camX - margin; spawnY = Phaser.Math.Between(camH*0.1, camH*0.9); velX = config.speed;  velY = Phaser.Math.Between(-config.speed*0.5, config.speed*0.5); break;
            case 1: spawnX = camX+camW+margin; spawnY = Phaser.Math.Between(camH*0.1, camH*0.9); velX = -config.speed; velY = Phaser.Math.Between(-config.speed*0.5, config.speed*0.5); break;
            case 2: spawnX = camX+Phaser.Math.Between(0,camW); spawnY = -margin; velX = Phaser.Math.Between(-config.speed*0.5, config.speed*0.5); velY = config.speed; break;
            default: spawnX = camX+Phaser.Math.Between(0,camW); spawnY = camH+margin; velX = Phaser.Math.Between(-config.speed*0.5, config.speed*0.5); velY = -config.speed; break;
        }

        const body = this.add.circle(spawnX, spawnY, config.radius, config.color, 1).setDepth(8);
        const tail = [];
        for (let i = 0; i < (isComet ? 8 : 4); i++) {
            const t = this.add.circle(spawnX, spawnY,
                config.radius * (1 - i / (isComet ? 8 : 4)) * 0.8,
                config.tailColor, 0.6 - i * (0.6 / (isComet ? 8 : 4))
            ).setDepth(7);
            tail.push(t);
        }

        let gravRing = null;
        if (!isComet) {
            gravRing = this.add.circle(spawnX, spawnY, config.mass * 2.5, 0xcc8844, 0).setDepth(6);
            gravRing.setStrokeStyle(1, 0xcc8844, 0.25);
            this.tweens.add({ targets: gravRing, scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: 1000, repeat: -1, ease: 'Sine.easeOut' });
        }

        this.flyingObjects.push({ x: spawnX, y: spawnY, vx: velX, vy: velY, radius: config.radius, mass: config.mass, body, tail, gravRing, isComet, age: 0, maxAge: 8000 });
    }

    // ----------------------------------------------------------
    //  Mise à jour comètes
    // ----------------------------------------------------------
    updateFlyingObjects(delta) {
        const toRemove = [];

        this.flyingObjects.forEach((obj, idx) => {
            obj.age += delta;
            obj.x   += obj.vx * delta / 1000;
            obj.y   += obj.vy * delta / 1000;
            obj.body.x = obj.x;
            obj.body.y = obj.y;

            const angle = Math.atan2(-obj.vy, -obj.vx);
            const speed = Math.sqrt(obj.vx ** 2 + obj.vy ** 2);
            obj.tail.forEach((t, i) => {
                t.x = obj.x + Math.cos(angle) * (i + 1) * (obj.radius * 1.2);
                t.y = obj.y + Math.sin(angle) * (i + 1) * (obj.radius * 1.2);
                t.setScale(1 + speed / 800, 0.7);
            });
            if (obj.gravRing) { obj.gravRing.x = obj.x; obj.gravRing.y = obj.y; }

            if (this.isFlying) {
                const dx   = obj.x - this.player.x;
                const dy   = obj.y - this.player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < obj.mass * 4 && dist > obj.radius) {
                    const force = Phaser.Math.Clamp(this.G * 0.8 * obj.mass / (dist * dist), 0, 300);
                    const dt    = delta / 1000;
                    this.player.body.setVelocityX(this.player.body.velocity.x + (dx / dist) * force * dt);
                    this.player.body.setVelocityY(this.player.body.velocity.y + (dy / dist) * force * dt);
                    if (dist < obj.mass * 2) obj.body.setAlpha(0.7 + Math.sin(Date.now() / 100) * 0.3);
                }
            }

            if (obj.age > obj.maxAge || obj.x < -500 || obj.x > 8500 || obj.y < -500 || obj.y > 1200) {
                toRemove.push(idx);
            }
        });

        toRemove.reverse().forEach(idx => {
            const obj = this.flyingObjects[idx];
            obj.body.destroy();
            obj.tail.forEach(t => t.destroy());
            if (obj.gravRing) obj.gravRing.destroy();
            this.flyingObjects.splice(idx, 1);
        });
    }

    // ----------------------------------------------------------
    //  Bannière de niveau
    // ----------------------------------------------------------
    showLevelBanner() {
        const { width, height } = this.scale;
        const labels = { 1: 'NIVEAU 1', 2: 'NIVEAU 2', 3: 'NIVEAU FINAL' };
        const colors = { 1: '#44aaff', 2: '#ffaa44', 3: '#ff4444' };

        const banner = this.add.text(width / 2, height / 2,
            labels[this.level],
            { fontSize: '56px', fontFamily: 'Arial Black', color: colors[this.level] }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);

        this.tweens.add({
            targets: banner,
            alpha: 1, duration: 400, yoyo: true, hold: 1200,
            onComplete: () => banner.destroy()
        });
    }

    // ----------------------------------------------------------
    //  Fond étoilé
    // ----------------------------------------------------------
    createStarBackground(w, h) {
        const count = this.level === 3 ? 600 : 400;
        for (let i = 0; i < count; i++) {
            this.add.circle(
                Phaser.Math.Between(0, w), Phaser.Math.Between(0, h),
                Phaser.Math.FloatBetween(0.5, 2.5), 0xffffff, Phaser.Math.FloatBetween(0.2, 0.9)
            );
        }
    }

    // ----------------------------------------------------------
    //  UI
    // ----------------------------------------------------------
    createUI() {
        const levelColors = { 1: '#44aaff', 2: '#ffaa44', 3: '#ff4444' };
        this.add.text(20, 20, `Niveau ${this.level}`, {
            fontSize: '16px', fontFamily: 'Arial Black', color: levelColors[this.level]
        }).setScrollFactor(0).setDepth(100);

        this.timerText = this.add.text(20, 42, 'Temps : 0s', {
            fontSize: '16px', fontFamily: 'Arial', color: '#ffffff'
        }).setScrollFactor(0).setDepth(100);

        this.add.text(20, 65, '← → marcher   ESPACE (maintenir) pour sauter', {
            fontSize: '12px', fontFamily: 'Arial', color: '#888888'
        }).setScrollFactor(0).setDepth(100);
    }

    showControls() {
        const msgs = {
            1: 'Atteins la planète safe !',
            2: 'Attention aux comètes — la safe cache un secret...',
            3: 'Dernier niveau — tout s\'effondre derrière toi !'
        };
        const { width, height } = this.scale;
        const hint = this.add.text(width / 2, height - 40, msgs[this.level],
            { fontSize: '16px', fontFamily: 'Arial', color: '#ffaa44' }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(100);

        this.time.delayedCall(4500, () => {
            this.tweens.add({ targets: hint, alpha: 0, duration: 800, onComplete: () => hint.destroy() });
        });
    }
}
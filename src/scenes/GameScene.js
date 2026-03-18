// ============================================================
//  GameScene.js — Système de 3 niveaux
//  Références tutos darties.fr utilisés :
//  - Bases Phaser (preload/create/update)  → darties.fr/creer-son-premier-jeu-de-plate-forme
//  - Animations spritesheet               → darties.fr/creer-son-premier-jeu-de-plate-forme
//  - Timers (addEvent / delayedCall)       → darties.fr/utiliser-des-timers-pour-programmer
//  - Tweens                                → darties.fr/utiliser-les-tweens-pour-activer
//  - Multi-niveaux / scenes               → darties.fr/creer-un-jeu-multi-niveaux
//  - Collisions (overlap staticGroup)     → darties.fr/sauter-sur-une-plate-forme
//  - Fond Tiled                           → darties.fr/creer-une-carte-sur-tiled
//  - Menu (MenuScene)                     → darties.fr/creer-une-page-daccueil
//  - Chronomètre                          → darties.fr/ajouter-un-chronometre
//  - Borne du monde (mort hors map)       → darties.fr/comment-faire-mourir-un-sprite
//  NOTE : la physique gravitationnelle orbitale (F = G*r/d²)
//         et la marche circulaire (cos/sin) sont des extensions
//         mathématiques construites par-dessus les bases Phaser.
// ============================================================
class GameScene extends Phaser.Scene {
    constructor() {
        // darties.fr — multi-niveaux : chaque niveau est une scène Phaser
        super({ key: 'GameScene' });
    }
    init(data) {
        // darties.fr — multi-niveaux : on reçoit le numéro de niveau via scene.start()
        this.level = data.level || 1;
    }
    preload() {
        // darties.fr — bases Phaser : chargement des assets dans preload()
        this.load.spritesheet('player', 'assets/darties.png', {
            frameWidth: 204,
            frameHeight: 256
        });
        const planetNames = [
            'planet_alien', 'planet_crystal', 'planet_desert', 'planet_earth',
            'planet_fire', 'planet_forest', 'planet_ice', 'planet_jupiter',
            'planet_lava', 'planet_mars', 'planet_moon', 'planet_saturn',
            'planet_snow'
        ];
        planetNames.forEach(name => {
            this.load.image(name, `assets/planetes/${name}.png`);
        });
        this.load.image('trump', 'assets/trump.png');
        this.load.image('epstein', 'assets/epstein.png');
        this.load.image('ship', 'assets/ship.png');
        // darties.fr — Tiled : chargement de la carte et du tileset
        this.load.tilemapTiledJSON('space_map', 'assets/space_map.json');
        this.load.image('space_tileset', 'assets/space_tileset.png');
        // Musique de fond
        this.load.audio('music', 'assets/music.mp3');
    }
    create() {
        const WORLD_WIDTH = this.level === 1 ? 4500 :
                            this.level === 2 ? 5800 : 7500;
        const WORLD_HEIGHT = 720;
        // darties.fr — bases Phaser : définir les limites du monde physique
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        // Gravité globale désactivée — on calcule la nôtre manuellement
        this.physics.world.gravity.set(0, 0);
        // darties.fr — Tiled : afficher le fond étoilé via la carte Tiled
        this.createTiledBackground();
        // darties.fr — tweens : animation de la bannière de niveau
        this.showLevelBanner();
        // Config par niveau (délais comètes et météorites)
        this.levelConfig = {
            1: { cometDelay: 9000, trumpEvery: 3, epsteinEvery: 99, meteorDelay: 4000 },
            2: { cometDelay: 6000, trumpEvery: 2, epsteinEvery: 99, meteorDelay: 3000 },
            3: { cometDelay: 3000, trumpEvery: 2, epsteinEvery: 3,  meteorDelay: 2000 },
        }[this.level];
        this.planetData    = this.buildPlanetData();
        this.planetGraphics = [];
        this.planetAlive    = [];
        // darties.fr — collisions : staticGroup pour les hitboxes carrées des planètes
        this.planetBodies = this.physics.add.staticGroup();
        this.planetData.forEach((data, i) => {
            this.createPlanet(data, i);
            this.planetAlive.push(true);
        });
        const start = this.planetData[0];
        // darties.fr — bases Phaser : créer le joueur avec physics.add.image
        this.player = this.physics.add.image(start.x, start.y - start.radius - 30, '__DEFAULT');
        this.player.setDisplaySize(36, 46);
        this.player.setTint(0xffffff);
        this.player.setDepth(10);
        this.player.body.setAllowGravity(false);
        // darties.fr — animations : sprite séparé pour les animations visuelles
        this.playerSprite = this.add.sprite(this.player.x, this.player.y, 'player');
        this.playerSprite.setDisplaySize(48, 60);
        this.playerSprite.setDepth(11);
        // darties.fr — animations : création des animations depuis une spritesheet
        if (!this.anims.exists('idle')) {
            this.anims.create({ key: 'idle',       frames: [{ key: 'player', frame: 0 }], frameRate: 1,  repeat: 0  });
            this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('player', { start: 5,  end: 9  }), frameRate: 10, repeat: -1 });
            this.anims.create({ key: 'walk-left',  frames: this.anims.generateFrameNumbers('player', { start: 10, end: 14 }), frameRate: 10, repeat: -1 });
            this.anims.create({ key: 'jump',       frames: [{ key: 'player', frame: 15 }], frameRate: 1,  repeat: 0  });
        }
        this.playerSprite.anims.play('idle');
        // Variables d'état du joueur
        this.angle              = -Math.PI / 2; // angle sur la planète (marche circulaire)
        this.currentPlanetIndex = 0;
        this.isOnPlanet         = true;
        this.isFlying           = false;
        this.gameOver           = false;
        this.G                  = 28000; // constante gravitationnelle custom
        this.blackHoleActive    = false;
        // darties.fr — bases Phaser : clavier avec createCursorKeys()
        this.cursors = this.input.keyboard.createCursorKeys();
        // darties.fr — collisions : overlap() détecte le contact joueur/planète sans rebond
        this.physics.add.overlap(
            this.player,
            this.planetBodies,
            (player, planetBody) => {
                if (!this.isFlying || this.justLaunched) return;
                const idx = planetBody.planetIndex;
                if (!this.planetAlive[idx]) return;
                const data      = this.planetData[idx];
                const landAngle = Math.atan2(this.player.y - data.y, this.player.x - data.x);
                this.snapToPlanet(idx, landAngle);
                this.onLanding(idx);
            },
            null, this
        );
        // darties.fr — bases Phaser : caméra qui suit le joueur
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);
        // darties.fr — chronomètre : UI avec texte mis à jour chaque frame
        this.createUI();
        this.startTime = this.time.now;
        this.showControls();
        this.jumpCharge   = 0;
        this.isCharging   = false;
        this.justLaunched = false;
        // Barre de charge visuelle (HUD fixe via setScrollFactor(0))
        this.chargeBarBg = this.add.rectangle(640, 690, 200, 18, 0x333333)
            .setScrollFactor(0).setDepth(100).setVisible(false);
        this.chargeBar = this.add.rectangle(541, 690, 0, 14, 0xffcc00)
            .setScrollFactor(0).setDepth(101).setOrigin(0, 0.5).setVisible(false);
        this.chargeText = this.add.text(640, 672, 'CHARGE', {
            fontSize: '13px', fontFamily: 'Arial Black', color: '#ffcc00'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
        this.snapToPlanet(0, -Math.PI / 2);
        // Musique de fond — repart à chaque début de niveau
        this.sound.stopAll();
        this.bgMusic = this.sound.add('music', { loop: true, volume: 0.5 });
        this.bgMusic.play();
        // darties.fr — tir/balles : physics.add.group() pour gérer les projectiles (comètes)
        // Même pattern que le tuto "Rajouter une fonction de tir, des balles et des cibles"
        this.cometsGroup = this.physics.add.group();

        // darties.fr — collisions : overlap() joueur ↔ comètes → mort du joueur
        // Même logique que balle touche une cible dans le tuto tir
        this.physics.add.overlap(
            this.player,
            this.cometsGroup,
            () => { this.onDeath(); },
            null, this
        );

        this.flyingObjects = [];
        // darties.fr — timers : spawn de comètes en boucle avec time.addEvent()
        this.time.addEvent({
            delay: this.levelConfig.cometDelay,
            loop: true,
            callback: this.spawnFlyingObject,
            callbackScope: this
        });
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
        const counts  = { 1: 5, 2: 7, 3: 10 };
        const planets = all.slice(0, counts[this.level]);
        const safeX   = planets[planets.length - 1].x + Phaser.Math.Between(550, 700);
        // darties.fr — multi-niveaux : contenu différent selon this.level
        if (this.level === 3) {
            planets.push({ x: safeX, y: 355, radius: 80, image: 'ship', debrisColor: 0xaaddff, type: 'safe' });
        } else {
            planets.push({ x: safeX, y: 355, radius: 100, image: 'planet_earth', debrisColor: 0x44aaff, type: 'safe' });
        }
        planets.forEach((p, i) => { if (!p.type) p.type = i === 0 ? 'start' : 'normal'; });
        if (this.level >= 2) {
            // Planètes répulsives — gravité inversée (extension custom)
            [
                { x: 820,  y: 500, radius: 22, image: 'planet_lava', debrisColor: 0xff5500, type: 'repulsive', antigrav: true },
                { x: 1420, y: 150, radius: 20, image: 'planet_lava', debrisColor: 0xff5500, type: 'repulsive', antigrav: true },
                { x: 2300, y: 530, radius: 25, image: 'planet_lava', debrisColor: 0xff5500, type: 'repulsive', antigrav: true },
                { x: 3050, y: 480, radius: 22, image: 'planet_lava', debrisColor: 0xff5500, type: 'repulsive', antigrav: true },
            ].forEach(p => planets.push(p));
            if (planets[2]) planets[2].antigrav = true;
            if (planets[5]) planets[5].antigrav = true;
        }
        return planets;
    }
    snapToPlanet(planetIndex, angle) {
        // Place le joueur à la surface d'une planète (marche circulaire custom : cos/sin)
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
    createPlanet(data, index) {
        // darties.fr — tweens : anneaux pulsants (attraction ou répulsion)
        if (data.type !== 'repulsive') {
            // Anneaux bleus rétrécissants → simule l'attraction vers le centre
            [5.0, 3.5, 2.2].forEach((factor, i) => {
                const ring = this.add.circle(data.x, data.y, data.radius * factor, 0xffffff, 0);
                ring.setStrokeStyle(1.5, 0xaaddff, [0.05, 0.10, 0.18][i]);
            });
            const pulseRing = this.add.circle(data.x, data.y, data.radius * 4.5, 0xffffff, 0);
            pulseRing.setStrokeStyle(1, 0x88ccff, 0.4);
            this.tweens.add({ targets: pulseRing, scaleX: 0.5, scaleY: 0.5, alpha: 0, duration: 1200 + data.radius * 10, repeat: -1, ease: 'Sine.easeIn' });
        } else {
            // Anneaux rouges s'élargissant → simule la répulsion vers l'extérieur
            [2.0, 3.2, 4.5].forEach((factor, i) => {
                const ring = this.add.circle(data.x, data.y, data.radius * factor, 0xff0000, 0);
                ring.setStrokeStyle(1.5, 0xff4400, [0.25, 0.15, 0.07][i]);
            });
            const pulseRed = this.add.circle(data.x, data.y, data.radius * 2.0, 0xff0000, 0);
            pulseRed.setStrokeStyle(1.5, 0xff2200, 0.5);
            this.tweens.add({ targets: pulseRed, scaleX: 2.5, scaleY: 2.5, alpha: 0, duration: 800, repeat: -1, ease: 'Sine.easeOut' });
        }
        // darties.fr — bases Phaser : add.image pour afficher la planète
        const img = this.add.image(data.x, data.y, data.image);
        img.setDisplaySize(data.radius * 2, data.radius * 2);
        if (data.type === 'repulsive') img.setTint(0xff3300);
        if (data.antigrav && data.type !== 'repulsive') img.setTint(0x88ff44);
        // darties.fr — collisions : staticImage invisible = hitbox carrée de la planète
        if (data.type !== 'repulsive') {
            const body = this.physics.add.staticImage(data.x, data.y, '__DEFAULT');
            body.setDisplaySize(data.radius * 2, data.radius * 2);
            body.setVisible(false);
            body.planetIndex = index;
            body.refreshBody();
            this.planetBodies.add(body);
        }
        // Labels et décorations
        if (data.type === 'safe') {
            if (this.level === 3) {
                this.add.text(data.x, data.y - data.radius - 28, '🚀 EMBARQUER !', { fontSize: '18px', color: '#44ffaa', fontFamily: 'Arial Black' }).setOrigin(0.5);
                const shipGlow = this.add.circle(data.x, data.y, data.radius * 1.4, 0x44ffaa, 0);
                shipGlow.setStrokeStyle(2, 0x44ffaa, 0.7);
                this.tweens.add({ targets: shipGlow, scaleX: 1.6, scaleY: 1.6, alpha: 0, duration: 900, repeat: -1, ease: 'Sine.easeOut' });
            } else {
                this.add.text(data.x, data.y - data.radius - 28, '★ SAFE ?', { fontSize: '20px', color: '#ffcc44', fontFamily: 'Arial Black' }).setOrigin(0.5);
            }
        }
        if (data.type === 'repulsive') {
            if (this.level === 2) {
                const deco = this.add.image(data.x, data.y - data.radius - 5, 'trump');
                deco.setDisplaySize(60, 75); deco.setDepth(20); deco.setOrigin(0.5, 1);
            } else if (this.level === 3) {
                const key = index % 2 === 0 ? 'trump' : 'epstein';
                const deco = this.add.image(data.x, data.y - data.radius - 5, key);
                deco.setDisplaySize(key === 'trump' ? 60 : 70, key === 'trump' ? 75 : 90);
                deco.setDepth(20); deco.setOrigin(0.5, 1);
            }
        }
        this.planetGraphics.push(img);
    }
    update() {
        // darties.fr — bases Phaser : boucle principale update() appelée chaque frame
        if (this.gameOver) return;
        if (this.isOnPlanet)    this.updateOnPlanet();
        else if (this.isFlying) this.updateFlying();
        this.playerSprite.x        = this.player.x;
        this.playerSprite.y        = this.player.y;
        this.playerSprite.rotation = this.player.rotation;
        // darties.fr — chronomètre : calcul du temps écoulé et mise à jour du texte
        const elapsed = Math.floor((this.time.now - this.startTime) / 1000);
        this.timerText.setText('Temps : ' + elapsed + 's');
        this.updateFlyingObjects(this.game.loop.delta);
        // darties.fr — borne du monde : mort si le joueur sort de la map
        if (this.player.y > 700 || this.player.y < -150 || this.player.x < -100 || this.player.x > 8000) {
            this.onDeath();
        }
    }
    updateOnPlanet() {
        const data = this.planetData[this.currentPlanetIndex];
        // darties.fr — bases Phaser : gestion clavier avec cursors.right/left.isDown
        if (this.cursors.right.isDown) {
            this.angle += 0.025; // marche circulaire : incrément de l'angle
            this.playerSprite.anims.play('walk-right', true);
        } else if (this.cursors.left.isDown) {
            this.angle -= 0.025;
            this.playerSprite.anims.play('walk-left', true);
        } else {
            this.playerSprite.anims.play('idle', true);
        }
        // Recalcul de la position sur la surface (cos/sin = coordonnées polaires → cartésiennes)
        const offset = data.radius + 24;
        this.player.x        = data.x + Math.cos(this.angle) * offset;
        this.player.y        = data.y + Math.sin(this.angle) * offset;
        this.player.rotation = this.angle + Math.PI / 2; // joueur toujours debout
        this.player.body.setVelocity(0, 0);
        // darties.fr — bases Phaser : JustUp = détection unique du relâchement touche
        if (this.cursors.space.isDown) {
            if (this.jumpCharge === 0) this.jumpCharge = 0.05;
            this.chargeJump();
        }
        if (Phaser.Input.Keyboard.JustUp(this.cursors.space) && this.jumpCharge > 0) {
            this.launchFromPlanet();
        }
    }
    chargeJump() {
        const data = this.planetData[this.currentPlanetIndex];
        this.jumpCharge = Math.min(1, this.jumpCharge + 0.6 / data.radius);
        this.isCharging = true;
        this.chargeBarBg.setVisible(true);
        this.chargeBar.setVisible(true);
        this.chargeText.setVisible(true);
        this.chargeBar.setSize(Math.floor(this.jumpCharge * 196), 14);
        if      (this.jumpCharge < 0.5)  this.chargeBar.setFillStyle(0xffcc00);
        else if (this.jumpCharge < 0.85) this.chargeBar.setFillStyle(0xff8800);
        else                              this.chargeBar.setFillStyle(0xff2200);
        const shake = (this.jumpCharge * 2) * (Math.random() - 0.5);
        this.playerSprite.x = this.player.x + shake;
        this.playerSprite.y = this.player.y + shake;
    }
    launchFromPlanet() {
        const data   = this.planetData[this.currentPlanetIndex];
        const charge = this.jumpCharge;
        this.jumpCharge = 0; this.isCharging = false;
        this.chargeBarBg.setVisible(false); this.chargeBar.setVisible(false);
        this.chargeText.setVisible(false);  this.chargeBar.setSize(0, 14);
        // Direction = vecteur radial (vers l'extérieur de la planète)
        const radialX     = Math.cos(this.angle);
        const radialY     = Math.sin(this.angle);
        const launchForce = (300 + data.radius * 3.5) * Math.max(0.2, charge);
        // darties.fr — bases Phaser : setVelocity pour lancer le joueur
        this.player.body.setVelocity(radialX * launchForce, radialY * launchForce);
        this.isOnPlanet = false; this.isFlying = true; this.justLaunched = true;
        this.playerSprite.anims.play('jump', true);
        // darties.fr — timers : delayedCall pour désactiver justLaunched après 400ms
        this.time.delayedCall(400, () => { this.justLaunched = false; });
    }
    updateFlying() {
        // Gravité custom : F = G * rayon / distance² vers la planète la plus proche
        // (extension mathématique — pas dans les tutos, mais basé sur setVelocityX/Y de Phaser)
        let closestIdx = -1, closestDist = Infinity;
        this.planetData.forEach((data, i) => {
            if (!this.planetAlive[i] || data.type === 'repulsive') return;
            const dist = Math.sqrt((data.x - this.player.x) ** 2 + (data.y - this.player.y) ** 2);
            if (dist < closestDist) { closestDist = dist; closestIdx = i; }
        });
        if (closestIdx === -1) return;
        const target = this.planetData[closestIdx];
        const dx     = target.x - this.player.x;
        const dy     = target.y - this.player.y;
        const dist   = Math.sqrt(dx * dx + dy * dy);
        const delta  = this.game.loop.delta / 1000;
        // darties.fr — bases Phaser : setVelocityX/Y pour appliquer la force
        const force = Phaser.Math.Clamp(this.G * target.radius / (dist * dist), 0, 900);
        this.player.body.setVelocityX(this.player.body.velocity.x + (dx / dist) * force * delta);
        this.player.body.setVelocityY(this.player.body.velocity.y + (dy / dist) * force * delta);
        // Répulsion des planètes répulsives (même logique, force inversée)
        this.planetData.forEach((data, i) => {
            if (!this.planetAlive[i] || data.type !== 'repulsive') return;
            const rdx   = this.player.x - data.x;
            const rdy   = this.player.y - data.y;
            const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
            if (rdist < data.radius * 6 && rdist > 1) {
                const repForce = Phaser.Math.Clamp(this.G * 1.5 * data.radius / (rdist * rdist), 0, 700);
                this.player.body.setVelocityX(this.player.body.velocity.x + (rdx / rdist) * repForce * delta);
                this.player.body.setVelocityY(this.player.body.velocity.y + (rdy / rdist) * repForce * delta);
            }
        });
        // Anti-gravité sur planètes normales marquées (niveau 2)
        this.planetData.forEach((data, i) => {
            if (!this.planetAlive[i] || !data.antigrav || data.type === 'repulsive') return;
            const rdx   = this.player.x - data.x;
            const rdy   = this.player.y - data.y;
            const rdist = Math.sqrt(rdx * rdx + rdy * rdy);
            if (rdist < data.radius * 5 && rdist > 1) {
                const repForce = Phaser.Math.Clamp(this.G * 1.2 * data.radius / (rdist * rdist), 0, 600);
                this.player.body.setVelocityX(this.player.body.velocity.x + (rdx / rdist) * repForce * delta);
                this.player.body.setVelocityY(this.player.body.velocity.y + (rdy / rdist) * repForce * delta);
            }
        });
        const vx = this.player.body.velocity.x;
        const vy = this.player.body.velocity.y;
        this.player.rotation = Math.atan2(vy, vx) + Math.PI / 2;
    }
    onLanding(planetIndex) {
        // darties.fr — animations : jouer l'animation idle à l'atterrissage
        this.playerSprite.anims.play('idle', true);
        const data = this.planetData[planetIndex];
        if (data.type === 'safe') {
            // darties.fr — multi-niveaux : scene.start() pour changer de niveau
            if (this.level === 3) this.onVictory();
            else this.triggerBlackHole(planetIndex);
            return;
        }
        this.startPlanetDestruction(planetIndex);
        this.startMeteorShower(planetIndex);
    }
    startMeteorShower(planetIndex) {
        const data  = this.planetData[planetIndex];
        const delay = this.levelConfig.meteorDelay;
        // darties.fr — timers : time.addEvent() en boucle pour les météorites
        const meteorTimer = this.time.addEvent({
            delay, loop: true,
            callback: () => {
                if (!this.planetAlive[planetIndex] || this.currentPlanetIndex !== planetIndex) {
                    meteorTimer.remove(); return;
                }
                const offsetX = Phaser.Math.Between(-data.radius * 2, data.radius * 2);
                const startX  = data.x + offsetX;
                const startY  = data.y - 380;
                const meteor  = this.add.circle(startX, startY, Phaser.Math.Between(5, 12), 0xff6622, 1).setDepth(15);
                const trail   = [];
                for (let i = 0; i < 5; i++) {
                    trail.push(this.add.circle(startX, startY, (5 - i) * 1.5, 0xff4400, 0.5 - i * 0.08).setDepth(14));
                }
                // darties.fr — tweens : chute de la météorite avec ease
                this.tweens.add({
                    targets: meteor, x: data.x + offsetX * 0.3, y: data.y - data.radius - 5,
                    duration: 600, ease: 'Sine.easeIn',
                    onUpdate: () => { trail.forEach((t, i) => { t.x = meteor.x; t.y = meteor.y + i * 8; }); },
                    onComplete: () => {
                        const impact = this.add.circle(meteor.x, meteor.y, 20, 0xff8844, 0.9);
                        this.tweens.add({ targets: impact, scaleX: 3, scaleY: 3, alpha: 0, duration: 300, onComplete: () => impact.destroy() });
                        for (let i = 0; i < 6; i++) {
                            const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
                            const d = this.add.circle(meteor.x, meteor.y, Phaser.Math.Between(2, 5), 0xff6622, 0.9);
                            this.tweens.add({ targets: d, x: meteor.x + Math.cos(a) * Phaser.Math.Between(20, 60), y: meteor.y + Math.sin(a) * Phaser.Math.Between(20, 60), alpha: 0, duration: 500, onComplete: () => d.destroy() });
                        }
                        meteor.destroy(); trail.forEach(t => t.destroy());
                    }
                });
            }
        });
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
            targets: [this.player, this.playerSprite], x: shipData.x, y: shipData.y,
            duration: 1000, ease: 'Sine.easeIn',
            onComplete: () => {
                this.tweens.add({ targets: [this.player, this.playerSprite], scaleX: 0, scaleY: 0, alpha: 0, duration: 400, ease: 'Sine.easeIn' });
                this.time.delayedCall(500, () => {
                    const glow = this.add.circle(shipData.x, shipData.y, shipData.radius * 2, 0x44ffaa, 0.5).setDepth(12);
                    this.tweens.add({ targets: glow, scaleX: 3, scaleY: 3, alpha: 0, duration: 500, onComplete: () => glow.destroy() });
                    this.tweens.add({ targets: shipGfx, y: shipData.y - 500, scaleX: 0.2, scaleY: 0.2, alpha: 0, duration: 2000, ease: 'Sine.easeIn' });
                    this.time.delayedCall(1500, () => {
                        this.cameras.main.fade(500, 0, 0, 0);
                        // darties.fr — multi-niveaux : scene.start() vers WinScene
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
        const blackCircle = this.add.circle(data.x, data.y, data.radius, 0x000000, 0);
        blackCircle.setDepth(gfx.depth + 1);
        // darties.fr — tweens : animation trou noir via onUpdate
        this.tweens.add({
            targets: gfx, duration: 1200,
            onUpdate: (tween) => {
                const p = tween.progress;
                if (p < 0.5) {
                    gfx.setTint(Phaser.Display.Color.GetColor(Math.floor(120*(1-p*2)), 0, Math.floor(200*(1-p*0.6))));
                    blackCircle.setAlpha(0);
                } else {
                    gfx.setTint(0x110022);
                    blackCircle.setAlpha((p-0.5)*2);
                    blackCircle.setRadius(data.radius * (1 + p * 0.6));
                }
                gfx.setScale(1 + p * 0.6); blackCircle.setScale(1 + p * 0.6);
            },
            onComplete: () => { blackCircle.setAlpha(1); gfx.setTint(0x000000); }
        });
        const spawnRings = () => {
            [1.5, 2.5, 4.0].forEach((factor, i) => {
                const ring = this.add.circle(data.x, data.y, data.radius * factor, 0x6600ff, 0);
                ring.setStrokeStyle(3 - i * 0.5, 0xaa44ff, 0.9 - i * 0.2);
                ring.setDepth(25);
                this.tweens.add({ targets: ring, scaleX: 3+factor, scaleY: 3+factor, alpha: 0, duration: 1000+i*200, delay: i*150, ease: 'Sine.easeOut', onComplete: () => ring.destroy() });
            });
        };
        spawnRings();
        // darties.fr — timers : delayedCall pour déclencher chaque vague de cercles
        this.time.delayedCall(400, spawnRings);
        this.time.delayedCall(800, spawnRings);
        this.time.delayedCall(1200, spawnRings);
        this.tweens.add({ targets: [this.player, this.playerSprite], scaleX: 0, scaleY: 0, alpha: 0, duration: 1400, ease: 'Sine.easeIn' });
        this.time.addEvent({
            delay: 16, repeat: 80,
            callback: () => {
                const dx = data.x - this.player.x, dy = data.y - this.player.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 5) { this.player.x += (dx/dist)*6; this.player.y += (dy/dist)*6; this.playerSprite.x = this.player.x; this.playerSprite.y = this.player.y; }
            }
        });
        this.time.delayedCall(1600, () => {
            spawnRings();
            const overlay = this.add.rectangle(this.cameras.main.scrollX + this.scale.width/2, this.cameras.main.scrollY + this.scale.height/2, this.scale.width, this.scale.height, 0x220044, 0).setScrollFactor(0).setDepth(50);
            this.tweens.add({ targets: overlay, alpha: 1, duration: 700, ease: 'Sine.easeIn' });
            this.time.delayedCall(400, () => {
                this.cameras.main.fade(500, 0, 0, 0);
                // darties.fr — multi-niveaux : scene.start() pour passer au niveau suivant
                this.time.delayedCall(500, () => { this.scene.start('GameScene', { level: this.level + 1 }); });
            });
        });
    }
    startPlanetDestruction(planetIndex) {
        const data = this.planetData[planetIndex];
        const gfx  = this.planetGraphics[planetIndex];
        if (!gfx || !gfx.active) return;
        const steps = 8, totalTime = 3200;
        let step = 0;
        this.add.text(data.x, data.y - data.radius - 35, '⚠ INSTABLE !', { fontSize: '14px', color: '#ffaa00', fontFamily: 'Arial Black' }).setOrigin(0.5).setDepth(15);
        // darties.fr — timers : time.addEvent() pour les étapes de désintégration
        this.time.addEvent({
            delay: totalTime / steps, repeat: steps - 1,
            callback: () => {
                step++;
                const progress = step / steps;
                if (gfx.active) {
                    gfx.setScale(1 - progress * 0.45); gfx.setAlpha(1 - progress * 0.5);
                    gfx.setTint(Phaser.Display.Color.GetColor(255, Math.floor(255*(1-progress)), 50));
                }
                for (let i = 0; i < 5; i++) {
                    const a = Phaser.Math.FloatBetween(0, Math.PI*2);
                    const r = data.radius * Phaser.Math.FloatBetween(0.2, 1.0);
                    const debris = this.add.circle(data.x + Math.cos(a)*r, data.y + Math.sin(a)*r, Phaser.Math.Between(2,7)*(1-progress*0.3), data.debrisColor, 0.85);
                    // darties.fr — tweens : débris s'envolent avec tweens
                    this.tweens.add({ targets: debris, x: debris.x + Phaser.Math.Between(-80,80), y: debris.y + Phaser.Math.Between(20,100), alpha: 0, duration: 700, onComplete: () => debris.destroy() });
                }
                if (step >= steps) {
                    this.planetAlive[planetIndex] = false;
                    if (gfx.active) gfx.destroy();
                    if (this.isOnPlanet && this.currentPlanetIndex === planetIndex) { this.onDeath(); return; }
                    const flash = this.add.circle(data.x, data.y, data.radius*2.5, 0xffffff, 0.8);
                    this.tweens.add({ targets: flash, alpha: 0, scaleX: 3, scaleY: 3, duration: 400, onComplete: () => flash.destroy() });
                }
            }
        });
    }
    onDeath() {
        if (this.gameOver) return;
        this.gameOver = true;
        this.cameras.main.flash(400, 255, 0, 0);
        // darties.fr — timers + multi-niveaux : recommencer le même niveau
        this.time.delayedCall(800, () => { this.scene.start('GameScene', { level: this.level }); });
    }
    spawnFlyingObject() {
        if (this.gameOver) return;
        const camX = this.cameras.main.scrollX, camW = this.scale.width, camH = this.scale.height;
        const isComet = Math.random() < 0.5;
        const config  = isComet
            ? { radius: Phaser.Math.Between(6,12),  speed: Phaser.Math.Between(280,450), color: 0x88ddff, tailColor: 0xaaeeff, mass: Phaser.Math.Between(15,30) }
            : { radius: Phaser.Math.Between(18,35), speed: Phaser.Math.Between(80,160),  color: 0xcc8844, tailColor: 0xff6622, mass: Phaser.Math.Between(50,90) };
        let spawnX, spawnY, velX, velY;
        const margin = 100;
        switch (Phaser.Math.Between(0, 3)) {
            case 0: spawnX=camX-margin;      spawnY=Phaser.Math.Between(camH*.1,camH*.9); velX=config.speed;  velY=Phaser.Math.Between(-config.speed*.5,config.speed*.5); break;
            case 1: spawnX=camX+camW+margin; spawnY=Phaser.Math.Between(camH*.1,camH*.9); velX=-config.speed; velY=Phaser.Math.Between(-config.speed*.5,config.speed*.5); break;
            case 2: spawnX=camX+Phaser.Math.Between(0,camW); spawnY=-margin;      velX=Phaser.Math.Between(-config.speed*.5,config.speed*.5); velY=config.speed;  break;
            default:spawnX=camX+Phaser.Math.Between(0,camW); spawnY=camH+margin;  velX=Phaser.Math.Between(-config.speed*.5,config.speed*.5); velY=-config.speed; break;
        }
        // darties.fr — tir/balles : physics.add.image pour créer un projectile physique
        // puis setVelocity pour lui donner une direction — même pattern que les balles du tuto
        const body = this.physics.add.image(spawnX, spawnY, '__DEFAULT');
        body.setDisplaySize(config.radius * 2, config.radius * 2);
        body.setTint(config.color);
        body.setDepth(8);
        body.body.setAllowGravity(false);
        // darties.fr — tir/balles : setVelocity pour lancer le projectile
        body.body.setVelocity(velX, velY);
        // darties.fr — borne du monde : setCollideWorldBounds + onWorldBounds
        // pour détecter quand la comète sort du monde et la détruire
        body.setCollideWorldBounds(false); // on veut qu'elle sorte, pas qu'elle rebondisse
        // darties.fr — tir/balles : on ajoute la comète au groupe pour que overlap() fonctionne
        this.cometsGroup.add(body);
        const tail = [];
        for (let i = 0; i < (isComet ? 8 : 4); i++) {
            tail.push(this.add.circle(spawnX, spawnY, config.radius*(1-i/(isComet?8:4))*0.8, config.tailColor, 0.6-i*(0.6/(isComet?8:4))).setDepth(7));
        }
        let gravRing = null;
        if (!isComet) {
            gravRing = this.add.circle(spawnX, spawnY, config.mass*2.5, 0xcc8844, 0).setDepth(6);
            gravRing.setStrokeStyle(1, 0xcc8844, 0.25);
            this.tweens.add({ targets: gravRing, scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: 1000, repeat: -1, ease: 'Sine.easeOut' });
        }
        this.flyingObjects.push({ body, tail, gravRing, isComet, mass: config.mass, radius: config.radius, age: 0, maxAge: 8000 });
    }
    updateFlyingObjects(delta) {
        const toRemove = [];
        this.flyingObjects.forEach((obj, idx) => {
            obj.age += delta;
            // darties.fr — tir/balles : la position est gérée automatiquement par Phaser
            // via setVelocity — on lit body.x/y pour positionner la traîne
            const x = obj.body.x, y = obj.body.y;
            const vx = obj.body.body.velocity.x, vy = obj.body.body.velocity.y;
            const angle = Math.atan2(-vy, -vx);
            const speed = Math.sqrt(vx**2 + vy**2);
            obj.tail.forEach((t, i) => { t.x=x+Math.cos(angle)*(i+1)*(obj.radius*1.2); t.y=y+Math.sin(angle)*(i+1)*(obj.radius*1.2); t.setScale(1+speed/800, 0.7); });
            if (obj.gravRing) { obj.gravRing.x=x; obj.gravRing.y=y; }
            // Attraction gravitationnelle de la météorite sur le joueur en vol
            if (this.isFlying) {
                const dx=x-this.player.x, dy=y-this.player.y, dist=Math.sqrt(dx*dx+dy*dy);
                if (dist < obj.mass*4 && dist > obj.radius) {
                    const force=Phaser.Math.Clamp(this.G*0.8*obj.mass/(dist*dist),0,300), dt=delta/1000;
                    this.player.body.setVelocityX(this.player.body.velocity.x+(dx/dist)*force*dt);
                    this.player.body.setVelocityY(this.player.body.velocity.y+(dy/dist)*force*dt);
                }
            }
            // darties.fr — borne du monde + tir/balles : on détruit le projectile
            // quand il est sorti du monde (body.active = false) ou trop vieux
            if (!obj.body.active || obj.age > obj.maxAge) toRemove.push(idx);
        });
        toRemove.reverse().forEach(idx => {
            const obj=this.flyingObjects[idx];
            // darties.fr — tir/balles : destroy() pour supprimer le projectile et le retirer du groupe
            obj.body.destroy();
            obj.tail.forEach(t=>t.destroy());
            if (obj.gravRing) obj.gravRing.destroy();
            this.flyingObjects.splice(idx,1);
        });
    }
    showLevelBanner() {
        // darties.fr — tweens : bannière qui apparaît puis disparaît (yoyo)
        const { width, height } = this.scale;
        const banner = this.add.text(width/2, height/2, { 1:'NIVEAU 1', 2:'NIVEAU 2', 3:'NIVEAU FINAL' }[this.level],
            { fontSize: '56px', fontFamily: 'Arial Black', color: { 1:'#44aaff', 2:'#ffaa44', 3:'#ff4444' }[this.level] }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
        this.tweens.add({ targets: banner, alpha: 1, duration: 400, yoyo: true, hold: 1200, onComplete: () => banner.destroy() });
    }
    createTiledBackground() {
        // darties.fr — Tiled : make.tilemap + addTilesetImage + createLayer
        const map     = this.make.tilemap({ key: 'space_map' });
        const tileset = map.addTilesetImage('space_tileset', 'space_tileset');
        const layer   = map.createLayer('fond_etoile', tileset, 0, 0);
        layer.setDepth(-1);
    }
    createUI() {
        // darties.fr — chronomètre : add.text avec setScrollFactor(0) pour HUD fixe
        const c = { 1:'#44aaff', 2:'#ffaa44', 3:'#ff4444' }[this.level];
        this.add.text(20, 20, `Niveau ${this.level}`, { fontSize: '16px', fontFamily: 'Arial Black', color: c }).setScrollFactor(0).setDepth(100);
        this.timerText = this.add.text(20, 42, 'Temps : 0s', { fontSize: '16px', fontFamily: 'Arial', color: '#ffffff' }).setScrollFactor(0).setDepth(100);
        this.add.text(20, 65, '← → marcher   ESPACE (maintenir) pour sauter', { fontSize: '12px', fontFamily: 'Arial', color: '#888888' }).setScrollFactor(0).setDepth(100);
    }
    showControls() {
        const msgs = { 1:'Atteins la planète safe !', 2:'Attention aux comètes — la safe cache un secret...', 3:"Dernier niveau — rejoins le vaisseau !" };
        const hint = this.add.text(this.scale.width/2, this.scale.height-40, msgs[this.level], { fontSize: '16px', fontFamily: 'Arial', color: '#ffaa44' }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        // darties.fr — timers + tweens : message qui disparaît après 4.5s
        this.time.delayedCall(4500, () => { this.tweens.add({ targets: hint, alpha: 0, duration: 800, onComplete: () => hint.destroy() }); });
    }
}
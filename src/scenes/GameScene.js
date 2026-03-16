    // ============================================================
    //  GameScene.js
    //  Physique planétaire réelle :
    //  - Gravité toujours vers le centre de la planète la plus proche
    //  - Le joueur tourne autour de la planète (marche circulaire)
    //  - Le joueur est orienté "debout" par rapport à la surface
    //  - La planète se désintègre dès que le joueur atterrit dessus
    //  - ESPACE = éjection tangentielle vers la prochaine planète
    // ============================================================

    class GameScene extends Phaser.Scene {

        constructor() {
            super({ key: 'GameScene' });
        }

        // ----------------------------------------------------------
        //  PRELOAD
        // ----------------------------------------------------------
        preload() {
            // Spritesheet joueur
            this.load.spritesheet('player', 'assets/darties.png', {
                frameWidth: 204,
                frameHeight: 250
            });

            // Images des planètes (depuis assets/planetes/)
            const planetNames = [
                'planet_alien', 'planet_crystal', 'planet_desert', 'planet_earth',
                'planet_fire',  'planet_forest',  'planet_ice',    'planet_jupiter',
                'planet_lava',  'planet_mars',    'planet_moon',   'planet_saturn',
                'planet_snow'
            ];
            planetNames.forEach(name => {
                this.load.image(name, `assets/planetes/${name}.png`);
            });
        }

        // ----------------------------------------------------------
        //  CREATE
        // ----------------------------------------------------------
        create() {

            const WORLD_WIDTH  = 7000;
            const WORLD_HEIGHT = 720;
            this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
            this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

            // On désactive la gravité globale de Phaser
            // On gère NOUS-MÊMES la gravité vers chaque planète
            this.physics.world.gravity.set(0, 0);

            this.createStarBackground(WORLD_WIDTH, WORLD_HEIGHT);

            // Chaque planète : position, rayon (= taille + gravité), image, type
            this.planetData = [
                { x: 300,  y: 380, radius: 90,  image: 'planet_jupiter', type: 'start'  },
                { x: 620,  y: 300, radius: 36,  image: 'planet_moon',    type: 'normal' },
                { x: 920,  y: 430, radius: 62,  image: 'planet_earth',   type: 'normal' },
                { x: 1180, y: 250, radius: 30,  image: 'planet_fire',    type: 'normal' },
                { x: 1550, y: 420, radius: 85,  image: 'planet_alien',   type: 'normal' },
                { x: 1870, y: 290, radius: 34,  image: 'planet_crystal', type: 'normal' },
                { x: 2090, y: 185, radius: 28,  image: 'planet_ice',     type: 'normal' },
                { x: 2410, y: 390, radius: 58,  image: 'planet_mars',    type: 'normal' },
                { x: 2800, y: 460, radius: 80,  image: 'planet_desert',  type: 'normal' },
                { x: 3100, y: 175, radius: 28,  image: 'planet_forest',  type: 'normal' },
                { x: 3430, y: 355, radius: 55,  image: 'planet_lava',    type: 'normal' },
                { x: 3860, y: 415, radius: 95,  image: 'planet_saturn',  type: 'normal' },
                { x: 4220, y: 270, radius: 33,  image: 'planet_snow',    type: 'normal' },
                { x: 4490, y: 155, radius: 28,  image: 'planet_ice',     type: 'normal' },
                { x: 4780, y: 370, radius: 60,  image: 'planet_crystal', type: 'normal' },
                { x: 5175, y: 435, radius: 78,  image: 'planet_alien',   type: 'normal' },
                { x: 5515, y: 248, radius: 32,  image: 'planet_fire',    type: 'normal' },
                { x: 5845, y: 380, radius: 55,  image: 'planet_mars',    type: 'normal' },
                { x: 6350, y: 345, radius: 100, image: 'planet_earth',   type: 'safe'   },
            ];

            // Tableaux pour stocker les objets visuels et physiques
            this.planetGraphics = []; // cercles visuels
            this.planetAlive    = []; // true/false : planète encore présente

            this.planetData.forEach((data, i) => {
                this.createPlanet(data, i);
                this.planetAlive.push(true);
            });

            // === JOUEUR ===
            // On utilise physics.add.image (pas sprite) pour contrôler
            // manuellement la position et rotation
            const start = this.planetData[0];

            this.player = this.physics.add.image(
                start.x,
                start.y - start.radius - 30,
                '__DEFAULT'
            );
            this.player.setDisplaySize(36, 46);
            this.player.setTint(0xffffff);
            this.player.setDepth(10);
            this.player.body.setAllowGravity(false);

            // On crée un sprite séparé juste pour l'animation
            // Il suit la position du player mais gère ses propres animations
            this.playerSprite = this.add.sprite(
                this.player.x, this.player.y, 'player'
            );
            this.playerSprite.setDisplaySize(48, 60);
            this.playerSprite.setDepth(11);

            // === ANIMATIONS ===
            this.anims.create({
                key: 'idle',
                frames: [{ key: 'player', frame: 0 }],
                frameRate: 1, repeat: 0
            });
            this.anims.create({
                key: 'walk-right',
                frames: this.anims.generateFrameNumbers('player', { start: 5, end: 9 }),
                frameRate: 10, repeat: -1
            });
            this.anims.create({
                key: 'walk-left',
                frames: this.anims.generateFrameNumbers('player', { start: 10, end: 14 }),
                frameRate: 10, repeat: -1
            });
            this.anims.create({
                key: 'jump',
                frames: [{ key: 'player', frame: 15 }],
                frameRate: 1, repeat: 0
            });
            this.playerSprite.anims.play('idle');

            // === ÉTAT DU JOUEUR ===
            this.angle          = -Math.PI / 2; // angle sur la planète (en radians)
                                                // -PI/2 = sommet de la planète
            this.currentPlanetIndex = 0;        // planète sur laquelle on est
            this.isOnPlanet     = true;          // sur une planète ?
            this.isFlying       = false;         // en vol entre planètes ?
            this.gameOver       = false;

            // Constante gravitationnelle — augmentée pour un effet bien visible
            this.G = 45000;

            // === MUR INVISIBLE ===
            this.createInvisibleWall();

            // === CLAVIER ===
            this.cursors = this.input.keyboard.createCursorKeys();

            // === CAMÉRA ===
            this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

            // === UI ===
            this.createUI();
            this.startTime = this.time.now;
            this.showControls();

            // Charge du saut (0 à 1)
            // Plus la planète est grosse, plus il faut maintenir ESPACE longtemps
            this.jumpCharge    = 0;
            this.isCharging    = false;
            this.justLaunched  = false; // empêche le re-atterrissage immédiat

            // Barre de charge visuelle (HUD)
            // Fond gris
            this.chargeBarBg = this.add.rectangle(640, 690, 200, 18, 0x333333)
                .setScrollFactor(0).setDepth(100).setVisible(false);
            // Barre colorée qui grandit
            this.chargeBar = this.add.rectangle(541, 690, 0, 14, 0xffcc00)
                .setScrollFactor(0).setDepth(101).setOrigin(0, 0.5).setVisible(false);
            // Texte "Charge"
            this.chargeText = this.add.text(640, 672, 'CHARGE', {
                fontSize: '13px', fontFamily: 'Arial Black', color: '#ffcc00'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);

            // On place le joueur correctement sur la planète de départ
            this.snapToPlanet(0, -Math.PI / 2);

            // === COMÈTES & MÉTÉORITES ===
            // Tableau des objets volants actifs
            this.flyingObjects = [];

            // Spawn aléatoire toutes les 4-8 secondes
            this.time.addEvent({
                delay: 5000,
                loop: true,
                callback: this.spawnFlyingObject,
                callbackScope: this
            });
        }

        // ----------------------------------------------------------
        //  Positionner le joueur exactement à la surface d'une planète
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

            // Reset de la charge au repos
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
        //  Création d'une planète avec vraie image
        // ----------------------------------------------------------
        createPlanet(data, index) {

            // === ANNEAUX DE CHAMP GRAVITATIONNEL ===
            const fieldFactor = [2.2, 3.5, 5.0];
            const fieldAlpha  = [0.18, 0.10, 0.05];

            fieldFactor.forEach((factor) => {
                const ring = this.add.circle(data.x, data.y, data.radius * factor, 0xffffff, 0);
                ring.setStrokeStyle(1.5, 0xaaddff, fieldAlpha[fieldFactor.indexOf(factor)]);
            });

            // Anneau pulsant — plus lent sur les grosses planètes
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

            // === IMAGE DE LA PLANÈTE ===
            // On utilise add.image() et on la redimensionne au diamètre voulu
            const img = this.add.image(data.x, data.y, data.image);
            img.setDisplaySize(data.radius * 2, data.radius * 2);

            // Label SAFE
            if (data.type === 'safe') {
                this.add.text(data.x, data.y - data.radius - 28, '★ SAFE', {
                    fontSize: '20px', color: '#44ff88', fontFamily: 'Arial Black'
                }).setOrigin(0.5);
            }

            // On stocke l'image (pas un cercle) dans planetGraphics
            this.planetGraphics.push(img);
        }

        // ----------------------------------------------------------
        //  Mur invisible
        // ----------------------------------------------------------
        createInvisibleWall() {
            const safe = this.planetData[this.planetData.length - 1];
            this.invisibleWall = this.physics.add.staticImage(
                safe.x - 320, safe.y, '__DEFAULT'
            );
            this.invisibleWall.setDisplaySize(15, 300);
            this.invisibleWall.setAlpha(0);
            this.invisibleWall.refreshBody();
            this.wallRevealed = false;
        }

        // ----------------------------------------------------------
        //  UPDATE — 60 fois/seconde
        // ----------------------------------------------------------
        update() {
            if (this.gameOver) return;

            if (this.isOnPlanet) {
                this.updateOnPlanet();
            } else if (this.isFlying) {
                this.updateFlying();
            }

            // Synchroniser le sprite visuel avec le corps physique
            this.playerSprite.x        = this.player.x;
            this.playerSprite.y        = this.player.y;
            this.playerSprite.rotation = this.player.rotation;

            // Timer
            const elapsed = Math.floor((this.time.now - this.startTime) / 1000);
            this.timerText.setText('Temps : ' + elapsed + 's');

            // Mise à jour comètes et météorites
            this.updateFlyingObjects(this.game.loop.delta);

            // Mort si sort de la map
            if (this.player.y > 700 || this.player.y < -150 ||
                this.player.x < -100 || this.player.x > 7100) {
                this.onDeath();
            }
        }

        // ----------------------------------------------------------
        //  Mise à jour quand le joueur est SUR une planète
        // ----------------------------------------------------------
        updateOnPlanet() {
            const data        = this.planetData[this.currentPlanetIndex];
            const WALK_SPEED  = 0.025; // vitesse angulaire (radians/frame)

            let moving = false;

            // Flèche droite = avancer dans le sens horaire (angle augmente)
            if (this.cursors.right.isDown) {
                this.angle += WALK_SPEED;
                this.playerSprite.anims.play('walk-right', true);
                moving = true;

            // Flèche gauche = avancer dans le sens anti-horaire (angle diminue)
            } else if (this.cursors.left.isDown) {
                this.angle -= WALK_SPEED;
                this.playerSprite.anims.play('walk-left', true);
                moving = true;

            } else {
                this.playerSprite.anims.play('idle', true);
            }

            // Recalculer la position du joueur selon l'angle
            const offset = data.radius + 24;
            this.player.x = data.x + Math.cos(this.angle) * offset;
            this.player.y = data.y + Math.sin(this.angle) * offset;

            // Orienter le joueur : il doit toujours pointer "vers l'extérieur"
            // L'angle de rotation = angle radial + 90° (car le sprite regarde vers le haut par défaut)
            this.player.rotation = this.angle + Math.PI / 2;

            // Stopper la vélocité (on gère la position manuellement)
            this.player.body.setVelocity(0, 0);

            // ESPACE maintenu = charger le saut
            if (this.cursors.space.isDown) {
                this.chargeJump();
            }

            // Relâcher ESPACE = lancer si on était en train de charger
            if (Phaser.Input.Keyboard.JustUp(this.cursors.space) && this.jumpCharge > 0) {
                this.launchFromPlanet();
            }
        }

        // ----------------------------------------------------------
        //  Charge progressive du saut
        // ----------------------------------------------------------
        chargeJump() {
            const data = this.planetData[this.currentPlanetIndex];

            // Plus la planète est grosse, plus il faut de temps pour charger
            // Petite planète (r=50) : charge rapide (~0.8s)
            // Grande planète (r=90) : charge lente (~1.8s)
            const chargeSpeed = 0.6 / data.radius; // radians/frame normalisé

            this.jumpCharge = Math.min(1, this.jumpCharge + chargeSpeed);
            this.isCharging = true;

            // Mettre à jour la barre visuelle
            this.chargeBarBg.setVisible(true);
            this.chargeBar.setVisible(true);
            this.chargeText.setVisible(true);

            // Largeur max de la barre = 196px
            const barWidth = Math.floor(this.jumpCharge * 196);
            this.chargeBar.setSize(barWidth, 14);

            // Couleur : jaune → orange → rouge selon la charge
            if (this.jumpCharge < 0.5) {
                this.chargeBar.setFillStyle(0xffcc00); // jaune
            } else if (this.jumpCharge < 0.85) {
                this.chargeBar.setFillStyle(0xff8800); // orange
            } else {
                this.chargeBar.setFillStyle(0xff2200); // rouge = charge max
            }

            // Le joueur "tremble" légèrement quand il charge
            const shake = (this.jumpCharge * 2) * (Math.random() - 0.5);
            this.playerSprite.x = this.player.x + shake;
            this.playerSprite.y = this.player.y + shake;
        }

        // ----------------------------------------------------------
        //  Lancement depuis une planète (force = charge × vitesse max)
        // ----------------------------------------------------------
        launchFromPlanet() {
            const data   = this.planetData[this.currentPlanetIndex];
            const charge = this.jumpCharge;

            // Réinitialiser la charge et cacher la barre
            this.jumpCharge = 0;
            this.isCharging = false;
            this.chargeBarBg.setVisible(false);
            this.chargeBar.setVisible(false);
            this.chargeText.setVisible(false);
            this.chargeBar.setSize(0, 14);

            // Direction radiale = vers l'extérieur de la planète
            const radialX = Math.cos(this.angle);
            const radialY = Math.sin(this.angle);

            // Vitesse max dépend de la charge (0.2 → 1.0)
            // On impose un minimum de 0.2 pour éviter un micro-saut
            const chargeEffective = Math.max(0.2, charge);

            // Force d'éjection : plus la planète est grosse, plus la gravité
            // est forte, donc on compense avec une force de base plus élevée
            const baseLaunchForce = 300 + data.radius * 3.5;
            const launchForce     = baseLaunchForce * chargeEffective;

            // Trouver la prochaine planète vivante
            let nextPlanet = null;
            let minDist    = Infinity;

            this.planetData.forEach((p, i) => {
                if (i !== this.currentPlanetIndex && this.planetAlive[i]) {
                    const dist = Math.sqrt((p.x - data.x) ** 2 + (p.y - data.y) ** 2);
                    if (dist < minDist) {
                        minDist    = dist;
                        nextPlanet = p;
                    }
                }
            });

            let vx, vy;

            if (nextPlanet && charge > 0.4) {
                // Charge suffisante : on vise la prochaine planète
                const dx = nextPlanet.x - this.player.x;
                const dy = nextPlanet.y - this.player.y;
                const t  = 0.9 + (1 - charge) * 0.5; // plus la charge est faible, plus c'est lent
                const g  = this.G * data.radius / (minDist * minDist);

                vx = (dx / t) * 0.55 + radialX * launchForce * 0.45;
                vy = (dy / t) * 0.55 + radialY * launchForce * 0.45;

                const speed = Math.sqrt(vx * vx + vy * vy);
                const MAX   = 200 + launchForce;
                if (speed > MAX) { vx = (vx / speed) * MAX; vy = (vy / speed) * MAX; }

            } else {
                // Charge insuffisante : éjection radiale pure (retombe sur la même planète)
                vx = radialX * launchForce;
                vy = radialY * launchForce;
            }

            this.player.body.setVelocity(vx, vy);
            this.isOnPlanet  = false;
            this.isFlying    = true;
            this.justLaunched = true; // immunité temporaire contre re-atterrissage immédiat
            this.playerSprite.anims.play('jump', true);

            // Après 400ms, on autorise à nouveau l'atterrissage
            this.time.delayedCall(400, () => {
                this.justLaunched = false;
            });
        }

        // ----------------------------------------------------------
        //  Mise à jour pendant le VOL
        // ----------------------------------------------------------
        updateFlying() {
            // Appliquer la gravité vers la planète la plus proche
            let closestIdx  = -1;
            let closestDist = Infinity;

            this.planetData.forEach((data, i) => {
                if (!this.planetAlive[i]) return;
                const dx   = data.x - this.player.x;
                const dy   = data.y - this.player.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist) {
                    closestDist = dist;
                    closestIdx  = i;
                }
            });

            if (closestIdx === -1) return;

            const target = this.planetData[closestIdx];
            const dx     = target.x - this.player.x;
            const dy     = target.y - this.player.y;
            const dist   = Math.sqrt(dx * dx + dy * dy);
            const delta  = this.game.loop.delta / 1000;

            // F = G * rayon / dist²  (le rayon = "masse" approx.)
            const force = Phaser.Math.Clamp(
                this.G * target.radius / (dist * dist), 0, 900
            );

            // Appliquer l'accélération gravitationnelle
            this.player.body.setVelocityX(
                this.player.body.velocity.x + (dx / dist) * force * delta
            );
            this.player.body.setVelocityY(
                this.player.body.velocity.y + (dy / dist) * force * delta
            );

            // Orienter le joueur vers sa direction de vol
            const vx = this.player.body.velocity.x;
            const vy = this.player.body.velocity.y;
            this.player.rotation = Math.atan2(vy, vx) + Math.PI / 2;

            // Détecter l'atterrissage — ignoré si on vient de décoller
            const landingDist = target.radius + 28;
            if (dist < landingDist && !this.justLaunched) {
                // Calcul de l'angle d'atterrissage
                const landAngle = Math.atan2(
                    this.player.y - target.y,
                    this.player.x - target.x
                );
                this.snapToPlanet(closestIdx, landAngle);
                this.onLanding(closestIdx);
            }

            // Vérifier le mur invisible
            this.checkInvisibleWall();
        }

        // ----------------------------------------------------------
        //  Atterrissage sur une planète
        // ----------------------------------------------------------
        onLanding(planetIndex) {
            const data = this.planetData[planetIndex];
            this.playerSprite.anims.play('idle', true);

            // Victoire si planète safe
            if (data.type === 'safe') {
                this.onVictory();
                return;
            }

            // La planète commence à se désintégrer DÈS L'ATTERRISSAGE
            this.startPlanetDestruction(planetIndex);
        }

        // ----------------------------------------------------------
        //  Vérification mur invisible
        // ----------------------------------------------------------
        checkInvisibleWall() {
            if (this.wallRevealed) return;
            const wall = this.invisibleWall;
            const dx = Math.abs(this.player.x - wall.x);
            const dy = Math.abs(this.player.y - wall.y);

            if (dx < 30 && dy < 150) {
                this.wallRevealed = true;
                wall.setAlpha(0.8);
                wall.setTint(0xff2222);

                // Rebond
                this.player.body.setVelocityX(-this.player.body.velocity.x * 0.8);
                this.player.body.setVelocityY(-this.player.body.velocity.y * 0.5);

                const msg = this.add.text(
                    this.player.x, this.player.y - 80,
                    '!! Trouve un autre chemin !!',
                    { fontSize: '18px', color: '#ff3333', fontFamily: 'Arial Black' }
                ).setOrigin(0.5).setDepth(20);
                this.time.delayedCall(2000, () => msg.destroy());
            }
        }

        // ----------------------------------------------------------
        //  Désintégration — démarre DÈS l'atterrissage
        // ----------------------------------------------------------
        startPlanetDestruction(planetIndex) {
            const data = this.planetData[planetIndex];
            const gfx  = this.planetGraphics[planetIndex];
            if (!gfx || !gfx.active) return;

            const steps     = 8;
            const totalTime = 3200; // 3.2 secondes pour se désintégrer
            let   step      = 0;

            // Afficher un message d'alerte
            const alert = this.add.text(data.x, data.y - data.radius - 35,
                '⚠ INSTABLE !',
                { fontSize: '14px', color: '#ffaa00', fontFamily: 'Arial Black' }
            ).setOrigin(0.5).setDepth(15);
            this.time.delayedCall(totalTime, () => { if (alert.active) alert.destroy(); });

            this.time.addEvent({
                delay: totalTime / steps,
                repeat: steps - 1,
                callback: () => {
                    step++;
                    const progress = step / steps; // 0.0 → 1.0

                    // La planète rétrécit et perd de l'alpha visuellement
                    if (gfx.active) {
                        gfx.setScale(1 - progress * 0.45);
                        gfx.setAlpha(1 - progress * 0.5);
                        // Teinte rouge progressive (setTint fonctionne sur les images)
                        const g = Math.floor(255 * (1 - progress));
                        gfx.setTint(Phaser.Display.Color.GetColor(255, g, 50));
                    }

                    // Débris visuels
                    for (let i = 0; i < 5; i++) {
                        const angle  = Phaser.Math.FloatBetween(0, Math.PI * 2);
                        const r      = data.radius * Phaser.Math.FloatBetween(0.2, 1.0);
                        const ex     = data.x + Math.cos(angle) * r;
                        const ey     = data.y + Math.sin(angle) * r;
                        const debris = this.add.circle(
                            ex, ey,
                            Phaser.Math.Between(2, 7) * (1 - progress * 0.3),
                            data.color, 0.85
                        );
                        this.tweens.add({
                            targets: debris,
                            x: ex + Phaser.Math.Between(-80, 80),
                            y: ey + Phaser.Math.Between(20, 100),
                            alpha: 0, duration: 700,
                            onComplete: () => debris.destroy()
                        });
                    }

                    // Étape finale : explosion et suppression
                    if (step >= steps) {
                        this.planetAlive[planetIndex] = false;
                        if (gfx.active) gfx.destroy();

                        // Si le joueur est encore sur cette planète → mort
                        if (this.isOnPlanet && this.currentPlanetIndex === planetIndex) {
                            this.onDeath();
                            return;
                        }

                        // Flash explosion
                        const flash = this.add.circle(
                            data.x, data.y, data.radius * 2.5, 0xffffff, 0.8
                        );
                        this.tweens.add({
                            targets: flash, alpha: 0, scaleX: 3, scaleY: 3,
                            duration: 400, onComplete: () => flash.destroy()
                        });
                    }
                }
            });
        }

        // ----------------------------------------------------------
        //  Victoire
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
            this.time.delayedCall(800, () => this.scene.restart());
        }

        // ----------------------------------------------------------
        //  Spawn d'une comète ou météorite
        // ----------------------------------------------------------
        spawnFlyingObject() {
            if (this.gameOver) return;

            // On spawn près du joueur (dans une zone visible)
            const camX  = this.cameras.main.scrollX;
            const camW  = this.scale.width;
            const camH  = this.scale.height;

            // Type aléatoire : comète (rapide, fine) ou météorite (lente, grosse)
            const isComet = Math.random() < 0.5;

            // Paramètres selon le type
            const config = isComet ? {
                // Comète : petite, rapide, traîne lumineuse
                radius   : Phaser.Math.Between(6, 12),
                speed    : Phaser.Math.Between(280, 450),
                color    : 0x88ddff,
                tailColor: 0xaaeeff,
                mass     : Phaser.Math.Between(15, 30),  // gravité faible
                label    : 'comète'
            } : {
                // Météorite : grosse, lente, gravité forte
                radius   : Phaser.Math.Between(18, 35),
                speed    : Phaser.Math.Between(80, 160),
                color    : 0xcc8844,
                tailColor: 0xff6622,
                mass     : Phaser.Math.Between(50, 90),  // gravité forte
                label    : 'météorite'
            };

            // Position de spawn : depuis un bord aléatoire (haut, bas, gauche, droite)
            const side = Phaser.Math.Between(0, 3);
            let spawnX, spawnY, velX, velY;

            const margin = 100;
            switch(side) {
                case 0: // depuis la gauche
                    spawnX = camX - margin;
                    spawnY = Phaser.Math.Between(camH * 0.1, camH * 0.9);
                    velX   = config.speed;
                    velY   = Phaser.Math.Between(-config.speed * 0.5, config.speed * 0.5);
                    break;
                case 1: // depuis la droite
                    spawnX = camX + camW + margin;
                    spawnY = Phaser.Math.Between(camH * 0.1, camH * 0.9);
                    velX   = -config.speed;
                    velY   = Phaser.Math.Between(-config.speed * 0.5, config.speed * 0.5);
                    break;
                case 2: // depuis le haut
                    spawnX = camX + Phaser.Math.Between(0, camW);
                    spawnY = -margin;
                    velX   = Phaser.Math.Between(-config.speed * 0.5, config.speed * 0.5);
                    velY   = config.speed;
                    break;
                case 3: // depuis le bas
                    spawnX = camX + Phaser.Math.Between(0, camW);
                    spawnY = camH + margin;
                    velX   = Phaser.Math.Between(-config.speed * 0.5, config.speed * 0.5);
                    velY   = -config.speed;
                    break;
            }

            // === VISUEL ===
            // Corps principal
            const body = this.add.circle(spawnX, spawnY, config.radius, config.color, 1);
            body.setDepth(8);

            // Traîne : plusieurs petits cercles derrière
            const tail = [];
            const tailCount = isComet ? 8 : 4;
            for (let i = 0; i < tailCount; i++) {
                const t = this.add.circle(spawnX, spawnY,
                    config.radius * (1 - i / tailCount) * 0.8,
                    config.tailColor,
                    0.6 - i * (0.6 / tailCount)
                );
                t.setDepth(7);
                tail.push(t);
            }

            // Anneau de gravité (visible si météorite)
            let gravRing = null;
            if (!isComet) {
                gravRing = this.add.circle(spawnX, spawnY, config.mass * 2.5, 0xcc8844, 0);
                gravRing.setStrokeStyle(1, 0xcc8844, 0.25);
                gravRing.setDepth(6);
                this.tweens.add({
                    targets: gravRing,
                    scaleX: 1.3, scaleY: 1.3, alpha: 0,
                    duration: 1000, repeat: -1, ease: 'Sine.easeOut'
                });
            }

            // Stocker l'objet
            const obj = {
                x: spawnX, y: spawnY,
                vx: velX,  vy: velY,
                radius: config.radius,
                mass: config.mass,
                body, tail, gravRing,
                isComet,
                age: 0,
                maxAge: 8000 // disparaît après 8 secondes
            };

            this.flyingObjects.push(obj);
        }

        // ----------------------------------------------------------
        //  Mise à jour des comètes et météorites
        // ----------------------------------------------------------
        updateFlyingObjects(delta) {
            const toRemove = [];

            this.flyingObjects.forEach((obj, idx) => {
                obj.age += delta;

                // Déplacement
                obj.x += obj.vx * delta / 1000;
                obj.y += obj.vy * delta / 1000;

                // Mettre à jour le visuel principal
                obj.body.x = obj.x;
                obj.body.y = obj.y;

                // Mettre à jour la traîne (chaque cercle suit le précédent avec un décalage)
                const angle  = Math.atan2(-obj.vy, -obj.vx);
                const speed  = Math.sqrt(obj.vx ** 2 + obj.vy ** 2);
                obj.tail.forEach((t, i) => {
                    const offset = (i + 1) * (obj.radius * 1.2);
                    t.x = obj.x + Math.cos(angle) * offset;
                    t.y = obj.y + Math.sin(angle) * offset;
                    // La traîne s'étire à grande vitesse
                    t.setScale(1 + speed / 800, 0.7);
                });

                // Mettre à jour l'anneau de gravité
                if (obj.gravRing) {
                    obj.gravRing.x = obj.x;
                    obj.gravRing.y = obj.y;
                }

                // === GRAVITÉ SUR LE JOUEUR ===
                // Si le joueur est en vol, la comète/météorite l'attire
                if (this.isFlying) {
                    const dx   = obj.x - this.player.x;
                    const dy   = obj.y - this.player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // La zone d'influence = mass * 4
                    if (dist < obj.mass * 4 && dist > obj.radius) {
                        const force = Phaser.Math.Clamp(
                            this.G * 0.8 * obj.mass / (dist * dist), 0, 300
                        );
                        const dt = delta / 1000;
                        this.player.body.setVelocityX(
                            this.player.body.velocity.x + (dx / dist) * force * dt
                        );
                        this.player.body.setVelocityY(
                            this.player.body.velocity.y + (dy / dist) * force * dt
                        );

                        // Effet visuel : flash quand assez proche
                        if (dist < obj.mass * 2) {
                            obj.body.setAlpha(0.7 + Math.sin(Date.now() / 100) * 0.3);
                        }
                    }
                }

                // Suppression si trop vieux ou hors map
                if (obj.age > obj.maxAge ||
                    obj.x < -500 || obj.x > 7500 ||
                    obj.y < -500 || obj.y > 1200) {
                    toRemove.push(idx);
                }
            });

            // Nettoyer les objets expirés (en partant de la fin pour ne pas décaler les index)
            toRemove.reverse().forEach(idx => {
                const obj = this.flyingObjects[idx];
                obj.body.destroy();
                obj.tail.forEach(t => t.destroy());
                if (obj.gravRing) obj.gravRing.destroy();
                this.flyingObjects.splice(idx, 1);
            });
        }

        // ----------------------------------------------------------
        //  Fond étoilé
        // ----------------------------------------------------------
        createStarBackground(w, h) {
            for (let i = 0; i < 400; i++) {
                this.add.circle(
                    Phaser.Math.Between(0, w),
                    Phaser.Math.Between(0, h),
                    Phaser.Math.FloatBetween(0.5, 2.5),
                    0xffffff,
                    Phaser.Math.FloatBetween(0.2, 0.9)
                );
            }
        }

        // ----------------------------------------------------------
        //  UI / HUD
        // ----------------------------------------------------------
        createUI() {
            this.timerText = this.add.text(20, 20, 'Temps : 0s', {
                fontSize: '20px', fontFamily: 'Arial', color: '#ffffff'
            }).setScrollFactor(0).setDepth(100);

            this.add.text(20, 50, '← → marcher sur la planète   ESPACE sauter', {
                fontSize: '14px', fontFamily: 'Arial', color: '#888888'
            }).setScrollFactor(0).setDepth(100);
        }

        showControls() {
            const { width, height } = this.scale;
            const hint = this.add.text(
                width / 2, height - 40,
                'Attention ! La planète s\'effondre dès que tu atterris !',
                { fontSize: '16px', fontFamily: 'Arial', color: '#ffaa44' }
            ).setOrigin(0.5).setScrollFactor(0).setDepth(100);

            this.time.delayedCall(4500, () => {
                this.tweens.add({
                    targets: hint, alpha: 0, duration: 800,
                    onComplete: () => hint.destroy()
                });
            });
        }
    }
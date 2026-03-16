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
        this.load.spritesheet('player', 'assets/images/darties.png', {
            frameWidth: 204,
            frameHeight: 250
        });
    }

    // ----------------------------------------------------------
    //  CREATE
    // ----------------------------------------------------------
    create() {

        const WORLD_WIDTH  = 8000;
        const WORLD_HEIGHT = 720;
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        // On désactive la gravité globale de Phaser
        // On gère NOUS-MÊMES la gravité vers chaque planète
        this.physics.world.gravity.set(0, 0);

        this.createStarBackground(WORLD_WIDTH, WORLD_HEIGHT);

        // === PLANÈTES ===
        this.planetData = [
            { x: 300,  y: 360, radius: 80,  color: 0x4488ff, type: 'start'  },
            { x: 780,  y: 340, radius: 60,  color: 0xaa66ff, type: 'normal' },
            { x: 1280, y: 370, radius: 70,  color: 0xff8844, type: 'normal' },
            { x: 1820, y: 330, radius: 55,  color: 0x44ffaa, type: 'normal' },
            { x: 2350, y: 360, radius: 65,  color: 0xff4488, type: 'normal' },
            { x: 2900, y: 345, radius: 50,  color: 0xffcc44, type: 'normal' },
            { x: 3450, y: 365, radius: 75,  color: 0x88aaff, type: 'normal' },
            { x: 4000, y: 340, radius: 60,  color: 0xff6644, type: 'normal' },
            { x: 4550, y: 355, radius: 55,  color: 0xaaff44, type: 'normal' },
            { x: 5100, y: 370, radius: 70,  color: 0xff44cc, type: 'normal' },
            { x: 5650, y: 345, radius: 50,  color: 0x44ccff, type: 'normal' },
            { x: 6200, y: 360, radius: 65,  color: 0xffaa44, type: 'normal' },
            { x: 6900, y: 355, radius: 90,  color: 0x44ff88, type: 'safe'   },
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

        // Constante gravitationnelle
        this.G = 18000;

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

        // On place le joueur correctement sur la planète de départ
        this.snapToPlanet(0, -Math.PI / 2);
    }

    // ----------------------------------------------------------
    //  Positionner le joueur exactement à la surface d'une planète
    // ----------------------------------------------------------
    snapToPlanet(planetIndex, angle) {
        const data   = this.planetData[planetIndex];
        const offset = data.radius + 24; // distance surface → centre joueur

        this.player.x = data.x + Math.cos(angle) * offset;
        this.player.y = data.y + Math.sin(angle) * offset;
        this.player.body.setVelocity(0, 0);

        this.currentPlanetIndex = planetIndex;
        this.angle = angle;
        this.isOnPlanet = true;
        this.isFlying   = false;
    }

    // ----------------------------------------------------------
    //  Création d'une planète
    // ----------------------------------------------------------
    createPlanet(data, index) {
        const circle = this.add.circle(data.x, data.y, data.radius, data.color);
        circle.setStrokeStyle(2, 0xffffff, 0.4);

        // Reflet lumineux
        this.add.circle(
            data.x - data.radius * 0.3,
            data.y - data.radius * 0.3,
            data.radius * 0.18,
            0xffffff, 0.35
        );

        if (data.type === 'safe') {
            this.add.text(data.x, data.y - data.radius - 28, '★ SAFE', {
                fontSize: '20px', color: '#44ff88', fontFamily: 'Arial Black'
            }).setOrigin(0.5);
        }

        this.planetGraphics.push(circle);
    }

    // ----------------------------------------------------------
    //  Mur invisible
    // ----------------------------------------------------------
    createInvisibleWall() {
        const safe = this.planetData[this.planetData.length - 1];
        this.invisibleWall = this.physics.add.staticImage(
            safe.x - 300, safe.y, '__DEFAULT'
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

        // Mort si sort de la map
        if (this.player.y > 750 || this.player.y < -100 ||
            this.player.x < -100 || this.player.x > 8100) {
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

        // ESPACE = saut catapulte
        if (Phaser.Input.Keyboard.JustDown(this.cursors.space)) {
            this.launchFromPlanet();
        }
    }

    // ----------------------------------------------------------
    //  Lancement depuis une planète
    // ----------------------------------------------------------
    launchFromPlanet() {
        const data = this.planetData[this.currentPlanetIndex];

        // Direction d'éjection = vers l'extérieur (radiale)
        // + légère composante tangentielle pour aller vers la prochaine planète
        const radialX = Math.cos(this.angle);
        const radialY = Math.sin(this.angle);

        // Trouver la prochaine planète vivante à droite
        let nextPlanet    = null;
        let nextPlanetIdx = -1;
        let minDist       = Infinity;

        this.planetData.forEach((p, i) => {
            if (i !== this.currentPlanetIndex && this.planetAlive[i] && p.x > data.x - 100) {
                const dist = Math.sqrt((p.x - data.x) ** 2 + (p.y - data.y) ** 2);
                if (dist < minDist) {
                    minDist       = dist;
                    nextPlanet    = p;
                    nextPlanetIdx = i;
                }
            }
        });

        let vx, vy;

        if (nextPlanet) {
            // Calculer la vélocité pour atteindre la prochaine planète
            const targetX = nextPlanet.x;
            const targetY = nextPlanet.y;
            const dx = targetX - this.player.x;
            const dy = targetY - this.player.y;
            const t  = 1.0; // durée de vol estimée

            // On ajoute une composante radiale (éjection) + direction vers cible
            vx = (dx / t) * 0.6 + radialX * 200;
            vy = (dy / t) * 0.6 + radialY * 200;

            // Limiter la vitesse max
            const speed = Math.sqrt(vx * vx + vy * vy);
            const MAX   = 550;
            if (speed > MAX) { vx = (vx / speed) * MAX; vy = (vy / speed) * MAX; }

        } else {
            // Pas de planète trouvée : éjection pure
            vx = radialX * 400;
            vy = radialY * 400;
        }

        this.player.body.setVelocity(vx, vy);
        this.isOnPlanet = false;
        this.isFlying   = true;
        this.playerSprite.anims.play('jump', true);
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
            this.G * target.radius / (dist * dist), 0, 600
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

        // Détecter l'atterrissage : si on est assez proche de la surface
        const landingDist = target.radius + 28;
        if (dist < landingDist) {
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
                    // Teinte qui vire au rouge
                    const r = Math.floor(255);
                    const g = Math.floor(255 * (1 - progress));
                    gfx.setFillStyle(Phaser.Display.Color.GetColor(r, g, 50));
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
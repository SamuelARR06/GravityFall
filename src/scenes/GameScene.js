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

        const WORLD_WIDTH  = 7000;
        const WORLD_HEIGHT = 720;
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        // On désactive la gravité globale de Phaser
        // On gère NOUS-MÊMES la gravité vers chaque planète
        this.physics.world.gravity.set(0, 0);

        this.createStarBackground(WORLD_WIDTH, WORLD_HEIGHT);

        // === PLANÈTES ===
        this.planetData = [
            // Départ — grosse planète facile pour apprendre
            { x: 300,  y: 380, radius: 90,  color: 0x4488ff, type: 'start'  },
            // Petite planète proche — premier saut facile
            { x: 620,  y: 310, radius: 38,  color: 0xaa66ff, type: 'normal' },
            // Moyenne en hauteur
            { x: 920,  y: 430, radius: 62,  color: 0xff8844, type: 'normal' },
            // Très petite — danger, peu de temps !
            { x: 1180, y: 260, radius: 30,  color: 0xff4444, type: 'normal' },
            // Grosse — refuge mais longue à quitter
            { x: 1550, y: 420, radius: 85,  color: 0x44ffaa, type: 'normal' },
            // Deux petites proches — îlots
            { x: 1880, y: 300, radius: 35,  color: 0xffcc44, type: 'normal' },
            { x: 2100, y: 200, radius: 32,  color: 0xff88cc, type: 'normal' },
            // Moyenne
            { x: 2420, y: 390, radius: 58,  color: 0x88aaff, type: 'normal' },
            // Grosse en bas
            { x: 2800, y: 470, radius: 80,  color: 0xff6644, type: 'normal' },
            // Petite haute — à viser précisément
            { x: 3100, y: 180, radius: 28,  color: 0xffee44, type: 'normal' },
            // Moyenne
            { x: 3430, y: 350, radius: 55,  color: 0xaaff44, type: 'normal' },
            // Très grosse — difficile à quitter
            { x: 3850, y: 410, radius: 95,  color: 0xff44cc, type: 'normal' },
            // Deux petites en escalier
            { x: 4220, y: 280, radius: 33,  color: 0x44ccff, type: 'normal' },
            { x: 4490, y: 160, radius: 28,  color: 0xffaa44, type: 'normal' },
            // Moyenne
            { x: 4780, y: 370, radius: 60,  color: 0xcc44ff, type: 'normal' },
            // Grosse
            { x: 5180, y: 430, radius: 78,  color: 0x44ff88, type: 'normal' },
            // Petite rapide
            { x: 5520, y: 250, radius: 32,  color: 0xff6688, type: 'normal' },
            // Avant-dernière — moyenne
            { x: 5850, y: 380, radius: 55,  color: 0x88ffcc, type: 'normal' },
            // Planète safe — grosse et verte, bien visible
            { x: 6350, y: 340, radius: 100, color: 0x44ff88, type: 'safe'   },
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
    //  Création d'une planète
    // ----------------------------------------------------------
    createPlanet(data, index) {

        // === ANNEAUX DE CHAMP GRAVITATIONNEL ===
        // Plus la planète est grosse, plus les anneaux sont grands et visibles
        // Rayon du champ = radius * facteur (3 anneaux concentriques)
        // Opacité décroissante vers l'extérieur (le champ s'affaiblit)
        const fieldFactor = [2.2, 3.5, 5.0]; // multiplicateurs de rayon
        const fieldAlpha  = [0.18, 0.10, 0.05]; // opacité de chaque anneau

        fieldFactor.forEach((factor, i) => {
            const ringRadius = data.radius * factor;
            const ring = this.add.circle(data.x, data.y, ringRadius, data.color, 0);
            ring.setStrokeStyle(1.5, data.color, fieldAlpha[i]);
        });

        // Animation de "pulsation" sur le premier anneau pour montrer l'attraction
        const pulseRing = this.add.circle(data.x, data.y, data.radius * 2.2, data.color, 0);
        pulseRing.setStrokeStyle(1, data.color, 0.25);
        this.tweens.add({
            targets: pulseRing,
            scaleX: 1 + (data.radius / 100) * 0.4, // plus la planète est grosse, plus ça pulse fort
            scaleY: 1 + (data.radius / 100) * 0.4,
            alpha: 0,
            duration: 1200 + data.radius * 10, // grosse planète = pulse plus lent
            repeat: -1,
            ease: 'Sine.easeOut'
        });

        // === VISUEL PLANÈTE ===
        const circle = this.add.circle(data.x, data.y, data.radius, data.color);
        circle.setStrokeStyle(2, 0xffffff, 0.4);

        // Reflet lumineux
        this.add.circle(
            data.x - data.radius * 0.3,
            data.y - data.radius * 0.3,
            data.radius * 0.18,
            0xffffff, 0.35
        );

        // Indicateur de taille de gravité : petit texte avec le rayon
        // Petite planète = "G faible", grosse = "G forte"
        let gravLabel = '';
        if (data.radius <= 35)       gravLabel = 'G faible';
        else if (data.radius <= 65)  gravLabel = 'G moyen';
        else                          gravLabel = 'G fort';

        const gravColor = data.radius <= 35 ? '#88ff88' :
                          data.radius <= 65 ? '#ffcc44' : '#ff6644';

        if (data.type !== 'safe') {
            this.add.text(data.x, data.y + data.radius + 14, gravLabel, {
                fontSize: '11px', color: gravColor, fontFamily: 'Arial'
            }).setOrigin(0.5).setAlpha(0.7);
        }

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
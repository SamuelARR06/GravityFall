// ============================================================
//  GameScene.js — Scène principale du jeu
// ============================================================

class GameScene extends Phaser.Scene {

    constructor() {
        super({ key: 'GameScene' });
    }

    // ----------------------------------------------------------
    //  PRELOAD — Chargement des assets
    // ----------------------------------------------------------
    preload() {
        // Si tu as des images dans assets/images/, tu les charges ici.
        // Exemple : this.load.image('planete', 'assets/images/planet_large.png')
        //
        // Pour l'instant on génère tout avec des formes géométriques
        // pour pouvoir tester la physique immédiatement.
        // On remplacera par de vrais sprites une fois la physique validée.
    }

    // ----------------------------------------------------------
    //  CREATE — Initialisation de la scène
    // ----------------------------------------------------------
    create() {

        // === MONDE (grande map scrollable) ===
        // On crée un monde plus grand que l'écran.
        // La caméra va suivre le joueur dans ce grand espace.
        const WORLD_WIDTH  = 8000;
        const WORLD_HEIGHT = 720;

        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        // === FOND ÉTOILÉ ===
        this.createStarBackground(WORLD_WIDTH, WORLD_HEIGHT);

        // === PLANÈTES ===
        // staticGroup = groupe d'objets FIXES (ne bougent pas)
        // Phaser ne calcule pas leur déplacement → plus rapide
        this.planets = this.physics.add.staticGroup();

        // Données des planètes : position X, Y, rayon, couleur, type
        // 'start'  = planète de départ
        // 'normal' = planète intermédiaire
        // 'safe'   = planète d'arrivée (objectif final)
        this.planetData = [
            { x: 300,  y: 400, radius: 70,  color: 0x4488ff, type: 'start'  },
            { x: 800,  y: 300, radius: 50,  color: 0xaa66ff, type: 'normal' },
            { x: 1300, y: 450, radius: 60,  color: 0xff8844, type: 'normal' },
            { x: 1900, y: 280, radius: 45,  color: 0x44ffaa, type: 'normal' },
            { x: 2500, y: 420, radius: 55,  color: 0xff4488, type: 'normal' },
            { x: 3100, y: 350, radius: 65,  color: 0xffcc44, type: 'normal' },
            { x: 3700, y: 480, radius: 40,  color: 0x88aaff, type: 'normal' },
            { x: 4300, y: 300, radius: 70,  color: 0xff6644, type: 'normal' },
            { x: 4900, y: 420, radius: 50,  color: 0xaaff44, type: 'normal' },
            { x: 5500, y: 350, radius: 55,  color: 0xff44cc, type: 'normal' },
            { x: 6100, y: 400, radius: 45,  color: 0x44ccff, type: 'normal' },
            { x: 6700, y: 320, radius: 60,  color: 0xffaa44, type: 'normal' },
            { x: 7500, y: 380, radius: 80,  color: 0x44ff88, type: 'safe'   },
        ];

        // On crée chaque planète visuellement et physiquement
        this.planetObjects = [];
        this.planetData.forEach((data, index) => {
            this.createPlanet(data, index);
        });

        // === JOUEUR ===
        // On place le joueur sur la première planète
        const startPlanet = this.planetData[0];
        this.player = this.physics.add.image(
            startPlanet.x,
            startPlanet.y - startPlanet.radius - 20, // au-dessus de la planète
            '__DEFAULT'   // sprite par défaut de Phaser (carré blanc)
        );
        this.player.setDisplaySize(28, 28);
        this.player.setTint(0xffffff);

        // On désactive la gravité Phaser sur le joueur
        // (on applique notre propre gravité dans update())
        this.player.body.setAllowGravity(false);

        // On donne au joueur une légère vélocité initiale
        // pour qu'il commence à orbiter
        this.player.body.setVelocity(80, 0);

        // === ÉTAT DU JEU ===
        this.currentPlanet = this.planetObjects[0]; // planète actuelle
        this.isOrbiting    = true;   // le joueur est-il en orbite ?
        this.isFlying      = false;  // le joueur est-il en vol libre ?
        this.gameOver      = false;  // partie terminée ?

        // Constante gravitationnelle (à ajuster pour le game feel)
        this.G = 15000;

        // === MUR INVISIBLE ===
        this.createInvisibleWall();

        // === COLLISIONS ===
        // overlap() = détection de chevauchement sans rebond physique
        // On gère le rebond manuellement dans le callback
        this.physics.add.overlap(
            this.player,
            this.planets,
            this.onPlayerHitPlanet,
            null,
            this
        );

        // === INPUT ===
        this.spaceKey = this.input.keyboard.addKey(
            Phaser.Input.Keyboard.KeyCodes.SPACE
        );

        // Clic de souris = même action que ESPACE
        this.input.on('pointerdown', this.launchPlayer, this);

        // === CAMÉRA ===
        // La caméra suit le joueur avec un léger décalage
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        // === UI (interface) ===
        // L'UI est en "fixed camera" — elle ne bouge pas avec le monde
        this.createUI();

        // Timer global — on compte le temps depuis le début
        this.startTime = this.time.now;

        // === TEXTE DE CONTRÔLES ===
        this.showControls();
    }

    // ----------------------------------------------------------
    //  Création d'une planète
    // ----------------------------------------------------------
    createPlanet(data, index) {
        // Cercle graphique (visuel)
        const circle = this.add.circle(data.x, data.y, data.radius, data.color);

        // Contour blanc pour les distinguer du fond
        circle.setStrokeStyle(2, 0xffffff, 0.5);

        // Effet de brillance (petit cercle clair en haut à gauche)
        this.add.circle(
            data.x - data.radius * 0.3,
            data.y - data.radius * 0.3,
            data.radius * 0.15,
            0xffffff, 0.4
        );

        // Étiquette sur la planète safe
        if (data.type === 'safe') {
            this.add.text(data.x, data.y - data.radius - 20, '⭐ SAFE', {
                fontSize: '18px',
                color: '#44ff88',
                fontFamily: 'Arial Black'
            }).setOrigin(0.5);
        }

        // Physique : on ajoute un corps statique invisible par-dessus
        // setCircle() = hitbox circulaire
        const body = this.physics.add.staticImage(data.x, data.y, '__DEFAULT');
        body.setDisplaySize(data.radius * 2, data.radius * 2);
        body.setCircle(data.radius);
        body.setVisible(false); // le corps physique est invisible (le visuel est le cercle)
        body.refreshBody();

        // On stocke les données utiles sur l'objet
        body.planetData  = data;
        body.planetIndex = index;
        body.isDestroying = false;     // est-elle en train de se désintégrer ?
        body.healthTimer  = null;      // timer de désintégration

        // On ajoute au groupe statique
        this.planets.add(body);
        this.planetObjects.push(body);

        return body;
    }

    // ----------------------------------------------------------
    //  Mur invisible juste avant la planète safe
    // ----------------------------------------------------------
    createInvisibleWall() {
        const safePlanet  = this.planetData[this.planetData.length - 1];

        // Position du mur : entre la dernière planète normale et la safe
        const wallX = safePlanet.x - 300;
        const wallY = safePlanet.y - 150;

        // On crée le mur comme un rectangle statique
        this.invisibleWall = this.physics.add.staticImage(wallX, wallY, '__DEFAULT');
        this.invisibleWall.setDisplaySize(20, 250);
        this.invisibleWall.setAlpha(0);        // invisible au départ
        this.invisibleWall.refreshBody();

        // Quand le joueur touche le mur → il devient visible + rebond
        this.physics.add.overlap(
            this.player,
            this.invisibleWall,
            this.onPlayerHitWall,
            null,
            this
        );
    }

    // ----------------------------------------------------------
    //  Callback : joueur touche le mur invisible
    // ----------------------------------------------------------
    onPlayerHitWall(player, wall) {
        // Le mur devient visible (rouge translucide)
        wall.setAlpha(0.7);
        wall.setTint(0xff3333);

        // Rebond : on inverse et réduit la vitesse horizontale
        player.body.setVelocityX(-player.body.velocity.x * 0.8);
        player.body.setVelocityY(-player.body.velocity.y * 0.6);

        // Message au joueur
        const { width, height } = this.scale;
        const msg = this.add.text(
            player.x, player.y - 60,
            '!? Trouve un autre chemin !',
            { fontSize: '18px', color: '#ff4444', fontFamily: 'Arial Black' }
        ).setOrigin(0.5);

        // Le message disparaît après 2 secondes
        this.time.delayedCall(2000, () => msg.destroy());
    }

    // ----------------------------------------------------------
    //  Lancer le joueur (saut)
    // ----------------------------------------------------------
    launchPlayer() {
        if (this.gameOver) return;
        if (!this.isOrbiting) return; // on ne peut sauter que si on est en orbite

        this.isOrbiting = false;
        this.isFlying   = true;

        // La direction du saut = la vitesse actuelle du joueur
        // (tangente à l'orbite = direction naturelle du mouvement)
        const speed = 350; // vitesse d'éjection en pixels/seconde
        const vx = this.player.body.velocity.x;
        const vy = this.player.body.velocity.y;
        const magnitude = Math.sqrt(vx * vx + vy * vy);

        if (magnitude > 0) {
            // On normalise le vecteur et on multiplie par la vitesse souhaitée
            this.player.body.setVelocity(
                (vx / magnitude) * speed,
                (vy / magnitude) * speed
            );
        }

        // On démarre la désintégration de la planète quittée
        if (this.currentPlanet && !this.currentPlanet.isDestroying) {
            this.startPlanetDestruction(this.currentPlanet);
        }
    }

    // ----------------------------------------------------------
    //  Callback : joueur atterrit sur une planète
    // ----------------------------------------------------------
    onPlayerHitPlanet(player, planetBody) {
        if (this.gameOver) return;
        if (!this.isFlying) return; // on ignore si on est déjà en orbite

        // On positionne le joueur à la surface de la planète
        const data   = planetBody.planetData;
        const dx     = player.x - data.x;
        const dy     = player.y - data.y;
        const dist   = Math.sqrt(dx * dx + dy * dy);
        const offset = data.radius + 16;

        player.x = data.x + (dx / dist) * offset;
        player.y = data.y + (dy / dist) * offset;

        // On passe en mode orbite
        this.isFlying   = false;
        this.isOrbiting = true;
        this.currentPlanet = planetBody;

        // Vitesse orbitale initiale (perpendiculaire à la surface)
        const perpX = -dy / dist;
        const perpY =  dx / dist;
        this.player.body.setVelocity(perpX * 120, perpY * 120);

        // Victoire si c'est la planète safe
        if (data.type === 'safe') {
            this.onVictory();
        }
    }

    // ----------------------------------------------------------
    //  Désintégration progressive d'une planète
    // ----------------------------------------------------------
    startPlanetDestruction(planetBody) {
        planetBody.isDestroying = true;
        const index = this.planetObjects.indexOf(planetBody);

        // On récupère le cercle graphique (il est à l'index correspondant)
        // et on l'anime avec un tween de "craquement"
        const data = planetBody.planetData;

        // Timer de 4 secondes avant explosion complète
        const totalTime = 4000;
        const steps     = 8;

        let step = 0;
        const interval = this.time.addEvent({
            delay: totalTime / steps,
            repeat: steps - 1,
            callback: () => {
                step++;
                const progress = step / steps; // 0 à 1

                // On crée des éclats visuels autour de la planète
                for (let i = 0; i < 3; i++) {
                    const angle  = Phaser.Math.FloatBetween(0, Math.PI * 2);
                    const dist   = data.radius * Phaser.Math.FloatBetween(0.5, 1.2);
                    const ex     = data.x + Math.cos(angle) * dist;
                    const ey     = data.y + Math.sin(angle) * dist;
                    const size   = Phaser.Math.Between(3, 8) * (1 - progress);
                    const debris = this.add.circle(ex, ey, size, data.color, 0.8);

                    // Les débris tombent et disparaissent
                    this.tweens.add({
                        targets: debris,
                        x: ex + Phaser.Math.Between(-60, 60),
                        y: ey + 80,
                        alpha: 0,
                        duration: 800,
                        onComplete: () => debris.destroy()
                    });
                }

                // Destruction finale
                if (step >= steps) {
                    // Suppression du corps physique
                    this.planets.remove(planetBody, true, true);

                    // Flash d'explosion
                    const flash = this.add.circle(data.x, data.y, data.radius * 1.5, 0xffffff, 0.8);
                    this.tweens.add({
                        targets: flash,
                        alpha: 0,
                        scaleX: 2,
                        scaleY: 2,
                        duration: 400,
                        onComplete: () => flash.destroy()
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

        // Légère pause dramatique avant l'écran de victoire
        this.time.delayedCall(1500, () => {
            this.scene.start('WinScene', { time: elapsed });
        });
    }

    // ----------------------------------------------------------
    //  Étoiles de fond (parallax simple)
    // ----------------------------------------------------------
    createStarBackground(worldWidth, worldHeight) {
        for (let i = 0; i < 400; i++) {
            const x     = Phaser.Math.Between(0, worldWidth);
            const y     = Phaser.Math.Between(0, worldHeight);
            const size  = Phaser.Math.FloatBetween(0.5, 2.5);
            const alpha = Phaser.Math.FloatBetween(0.2, 0.9);
            this.add.circle(x, y, size, 0xffffff, alpha);
        }
    }

    // ----------------------------------------------------------
    //  Interface utilisateur (HUD)
    // ----------------------------------------------------------
    createUI() {
        // Le HUD reste fixe à l'écran (setScrollFactor(0))
        this.timerText = this.add.text(20, 20, 'Temps : 0s', {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffffff'
        }).setScrollFactor(0); // ne suit pas la caméra

        this.add.text(20, 50, 'ESPACE ou CLIC pour sauter', {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#888888'
        }).setScrollFactor(0);
    }

    // ----------------------------------------------------------
    //  Affichage des contrôles au démarrage
    // ----------------------------------------------------------
    showControls() {
        const { width, height } = this.scale;
        const hint = this.add.text(width / 2, height - 40,
            'Saute de planète en planète avant qu\'elles s\'effondrent !', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#aaaaaa'
        }).setOrigin(0.5).setScrollFactor(0);

        // Le hint disparaît après 4 secondes
        this.time.delayedCall(4000, () => {
            this.tweens.add({
                targets: hint,
                alpha: 0,
                duration: 800,
                onComplete: () => hint.destroy()
            });
        });
    }

    // ----------------------------------------------------------
    //  UPDATE — Boucle principale (60 fois/seconde)
    // ----------------------------------------------------------
    update() {
        if (this.gameOver) return;

        // --- Lecture des inputs ---
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
            this.launchPlayer();
        }

        // --- Physique gravitationnelle ---
        // Si le joueur est en vol libre, on applique l'attraction
        // de la planète la plus proche
        if (this.isFlying) {
            this.applyGravity();
        }

        // --- Orbite autour de la planète courante ---
        if (this.isOrbiting && this.currentPlanet) {
            this.applyOrbit();
        }

        // --- Mise à jour du timer ---
        const elapsed = Math.floor((this.time.now - this.startTime) / 1000);
        this.timerText.setText('Temps : ' + elapsed + 's');

        // --- Mort si le joueur sort de la map ---
        if (this.player.y > 750 || this.player.y < -50) {
            this.onDeath();
        }
    }

    // ----------------------------------------------------------
    //  Physique : gravité pendant le vol libre
    // ----------------------------------------------------------
    applyGravity() {
        let closestPlanet = null;
        let closestDist   = Infinity;

        // Trouver la planète la plus proche (parmi celles qui existent encore)
        this.planets.getChildren().forEach(planet => {
            const data = planet.planetData;
            const dx   = data.x - this.player.x;
            const dy   = data.y - this.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < closestDist) {
                closestDist   = dist;
                closestPlanet = planet;
            }
        });

        if (!closestPlanet) return;

        const data = closestPlanet.planetData;

        // Vecteur direction : joueur → planète
        const dx   = data.x - this.player.x;
        const dy   = data.y - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Loi de gravitation : F = G * M / d²
        // On limite la force min/max pour éviter les bugs
        const force = Phaser.Math.Clamp(
            this.G * data.radius / (dist * dist),
            0,
            500
        );

        // On normalise le vecteur et on applique la force
        // delta = temps depuis la dernière frame (pour physique fluide)
        const delta = this.game.loop.delta / 1000; // en secondes

        this.player.body.setVelocityX(
            this.player.body.velocity.x + (dx / dist) * force * delta
        );
        this.player.body.setVelocityY(
            this.player.body.velocity.y + (dy / dist) * force * delta
        );
    }

    // ----------------------------------------------------------
    //  Physique : orbite autour de la planète courante
    // ----------------------------------------------------------
    applyOrbit() {
        const data = this.currentPlanet.planetData;

        // Distance actuelle entre le joueur et le centre de la planète
        const dx   = this.player.x - data.x;
        const dy   = this.player.y - data.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Distance cible = surface de la planète + offset
        const targetDist = data.radius + 16;

        // Correction douce : si le joueur s'éloigne, on le ramène
        const correction = (dist - targetDist) * 0.05;

        // Direction vers le centre de la planète
        const nx = dx / dist;
        const ny = dy / dist;

        // On ajuste la position (léger rappel vers l'orbite)
        this.player.x -= nx * correction;
        this.player.y -= ny * correction;

        // Vitesse tangentielle (perpendiculaire au rayon)
        // = ce qui crée l'effet de rotation autour de la planète
        const orbitSpeed = 130;
        this.player.body.setVelocity(-ny * orbitSpeed, nx * orbitSpeed);
    }

    // ----------------------------------------------------------
    //  Mort du joueur
    // ----------------------------------------------------------
    onDeath() {
        if (this.gameOver) return;
        this.gameOver = true;

        // Flash rouge
        this.cameras.main.flash(300, 255, 0, 0);

        this.time.delayedCall(800, () => {
            // Relancer la GameScene (recommencer depuis le début)
            this.scene.restart();
        });
    }
}

class GameScene extends Phaser.Scene {
    constructor() {
        // On donne un nom à cette scène pour pouvoir y accéder depuis les autres
        super({ key: 'GameScene' });
    }

    init(data) {
        // init() est appelé en premier, avant preload()
        // data contient ce qu'on a passé dans scene.start('GameScene', { level: 1 })
        this.level = data.level || 1; // si rien n'est passé, on démarre au niveau 1
    }

    preload() {
        // preload() charge tous les fichiers dont on a besoin AVANT de lancer le jeu
        this.load.spritesheet('player', 'assets/darties.png', { frameWidth: 204, frameHeight: 256 });

        // On charge toutes les images de planètes avec une boucle for classique
        const planetNames = ['planet_alien','planet_crystal','planet_desert','planet_earth','planet_fire',
         'planet_forest','planet_ice','planet_jupiter','planet_lava','planet_mars',
         'planet_moon','planet_saturn','planet_snow'];
        for (let i = 0; i < planetNames.length; i++) {
            this.load.image(planetNames[i], 'assets/planetes/' + planetNames[i] + '.png');
        }

        // Images des personnages posés sur les planètes répulsives
        this.load.image('trump', 'assets/trump.png');
        this.load.image('epstein', 'assets/epstein.png');

        // Image du vaisseau (planète finale du niveau 3)
        this.load.image('ship', 'assets/ship.png');

        // chargement de la carte Tiled (fond étoilé) et de son tileset
        this.load.tilemapTiledJSON('space_map', 'assets/space_map.json');
        this.load.image('space_tileset', 'assets/space_tileset.png');

        // Musique de fond
        this.load.audio('music', 'assets/music.mp3');
    }

    create() {
        // create() est appelé une fois quand la scène démarre
        // C'est ici qu'on crée tous les objets du jeu

        // Taille du monde différente selon le niveau (plus grand = plus de planètes); W = largeur du monde
        let W;
        if (this.level === 1) { W = 4500; }
        else if (this.level === 2) { W = 5800; }
        else { W = 7500; }

        //  limites du monde physique et de la caméra
        this.physics.world.setBounds(0, 0, W, 720); // le monde physique s'arrête ici
        this.cameras.main.setBounds(0, 0, W, 720);  // la caméra ne sort pas du monde
        this.physics.world.gravity.set(0, 0);        // on désactive la gravité de Phaser 

        //on crée le fond étoilé à partir de la carte Tiled
        const map = this.make.tilemap({ key: 'space_map' });
        map.createLayer('fond_etoile', map.addTilesetImage('space_tileset', 'space_tileset'), 0, 0).setDepth(-1);

        // bannière "NIVEAU 1 / 2 / FINAL" au démarrage
        this.showLevelBanner();

        // Configuration des délais selon le niveau 
        this.levelConfig = {
            1: { cometDelay: 90 },
            2: { cometDelay: 110 },
            3: { cometDelay: 150 },
        }[this.level];

        // On construit la liste des planètes pour ce niveau
        this.planetData     = this.buildPlanetData();
        this.planetGraphics = []; // stocke les images des planètes (pour les animer)
        this.planetAlive    = []; // true/false : la planète existe encore ?

        // collisions : staticGroup contient toutes les hitboxes des planètes
        // "static" = immobile, pas affectée par la physique
        this.planetBodies = this.physics.add.staticGroup();
        this.planetData.forEach((data, i) => {
            this.createPlanet(data, i);  // crée visuellement chaque planète
            this.planetAlive.push(true); // au départ toutes les planètes sont vivantes
        });

        // créer le joueur avec physics.add.image
        // physics.add.image = objet avec une hitbox physique
        const start = this.planetData[0]; // on commence sur la première planète
        this.player = this.physics.add.image(start.x, start.y - start.radius - 30, '__DEFAULT');
        this.player.setDisplaySize(36, 46).setDepth(10); // taille visuelle + profondeur
        this.player.body.setAllowGravity(false); // le joueur n'est pas affecté par la gravité Phaser

        // animations : on crée un sprite séparé pour afficher les animations
        // (le "player" est juste la hitbox, "playerSprite" c'est ce qu'on voit)
        this.playerSprite = this.add.sprite(this.player.x, this.player.y, 'player').setDisplaySize(48, 60).setDepth(11);

        // animations : on définit les animations depuis la spritesheet
        // chaque animation = une liste de frames dans l'image darties.png
        if (!this.anims.exists('idle')) {
            this.anims.create({ key: 'idle',       frames: [{ key: 'player', frame: 0 }], frameRate: 1,  repeat: 0  });
            this.anims.create({ key: 'walk-right', frames: this.anims.generateFrameNumbers('player', { start: 5,  end: 9  }), frameRate: 10, repeat: -1 });
            this.anims.create({ key: 'walk-left',  frames: this.anims.generateFrameNumbers('player', { start: 10, end: 14 }), frameRate: 10, repeat: -1 });
            this.anims.create({ key: 'jump',       frames: [{ key: 'player', frame: 15 }], frameRate: 1,  repeat: 0  });
        }
        this.playerSprite.anims.play('idle'); // animation par défaut au démarrage

        // Variables d'état : elles gardent en mémoire ce que fait le joueur
        this.angle = -Math.PI / 2;   // angle actuel sur la planète (en radians)
        this.currentPlanetIndex = 0; // index de la planète sur laquelle on est
        this.isOnPlanet = true;      // true = posé sur une planète
        this.isFlying   = false;     // true = en train de voler entre les planètes
        this.gameOver   = false;     // true = le jeu est terminé (mort ou victoire)
        this.G          = 40000;     // constante de gravité (plus grand = plus fort)
        this.blackHoleActive = false;// true = animation trou noir en cours

        // bases Phaser : createCursorKeys() gère les touches directionnelles + espace
        this.cursors = this.input.keyboard.createCursorKeys();

        // collisions : overlap() détecte quand le joueur touche une planète
        // Contrairement à collider(), overlap ne fait pas rebondir — il appelle juste une fonction
        this.physics.add.overlap(this.player, this.planetBodies, (player, planetBody) => {
            if (!this.isFlying || this.justLaunched) return; // on ignore si on vient de sauter
            const idx = planetBody.planetIndex;
            if (!this.planetAlive[idx]) return; // on ignore si la planète est détruite
            this.snapToPlanet(idx, Math.atan2(this.player.y - this.planetData[idx].y, this.player.x - this.planetData[idx].x));
            this.onLanding(idx); // déclenche l'atterrissage
        }, null, this);

        // bases Phaser : la caméra suit le joueur avec un léger délai (0.08)
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

        // chronomètre : textes du HUD, setScrollFactor(0) = collé à l'écran
        const c = { 1:'#44aaff', 2:'#ffaa44', 3:'#ff4444' }[this.level];
        this.add.text(20, 20, `Niveau ${this.level}`, { fontSize: '16px', fontFamily: 'Arial Black', color: c }).setScrollFactor(0).setDepth(100);
        this.timerText = this.add.text(20, 42, 'Temps : 0s', { fontSize: '16px', color: '#ffffff' }).setScrollFactor(0).setDepth(100);
        this.startTime = this.time.now; // on mémorise l'heure de départ pour le chrono

        // Variables liées au saut chargé
        this.jumpCharge   = 0;     // de 0 à 1 : niveau de charge actuel
        this.justLaunched = false; // true pendant 400ms après un saut (évite de re-atterrir immédiatement)

        // Barre de charge visuelle (affichée en bas de l'écran pendant qu'on charge)
        this.chargeBarBg  = this.add.rectangle(640, 690, 200, 18, 0x333333).setScrollFactor(0).setDepth(100).setVisible(false);
        this.chargeBar    = this.add.rectangle(541, 690, 0, 14, 0xffcc00).setScrollFactor(0).setDepth(101).setOrigin(0, 0.5).setVisible(false);
        this.chargeText   = this.add.text(640, 672, 'CHARGE', { fontSize: '13px', color: '#ffcc00' }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);

        // On place le joueur sur la première planète
        this.snapToPlanet(0, -Math.PI / 2);

        // Musique : stopAll() évite que la musique se superpose si on relance le niveau
        this.sound.stopAll();
        this.sound.add('music', { loop: true, volume: 0.5 }).play();
    }

    buildPlanetData() {
        // Cette fonction construit la liste de toutes les planètes du niveau
        // Chaque planète est un objet avec sa position, son rayon, son image...

        // Liste de toutes les planètes disponibles (on en prend un sous-ensemble selon le niveau)
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

        // On prend 5, 7 ou 10 planètes selon le niveau
        const planets = all.slice(0, { 1:5, 2:7, 3:10 }[this.level]);

        // La planète "safe" est placée après la dernière planète normale
        const safeX = planets[planets.length - 1].x + Phaser.Math.Between(550, 700);

        // darties.fr — multi-niveaux : au niveau 3 c'est un vaisseau, sinon une planète normale
        planets.push(this.level === 3
            ? { x: safeX, y: 355, radius: 80,  image: 'ship',         debrisColor: 0xaaddff, type: 'safe' }
            : { x: safeX, y: 355, radius: 100, image: 'planet_earth', debrisColor: 0x44aaff, type: 'safe' }
        );

        // On assigne un type à chaque planète : 'start', 'normal' ou 'safe'
        planets.forEach((p, i) => { if (!p.type) p.type = i === 0 ? 'start' : 'normal'; });

        // Planètes répulsives : elles repoussent le joueur au lieu de l'attirer (niveaux 2 et 3)
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
        // Place le joueur sur le dessus de la planète
        // C'est appelé au démarrage et à chaque atterrissage
        const data = this.planetData[planetIndex];
        this.player.x = data.x + Math.cos(angle) * (data.radius + 24); // position sur la surface
        this.player.y = data.y + Math.sin(angle) * (data.radius + 24);
        this.player.body.setVelocity(0, 0); // on stoppe le mouvement
        this.currentPlanetIndex = planetIndex;
        this.angle = angle;
        this.isOnPlanet = true;
        this.isFlying   = false;
        this.jumpCharge = 0;
        // On cache la barre de charge
        if (this.chargeBar) {
            this.chargeBarBg.setVisible(false);
            this.chargeBar.setVisible(false);
            this.chargeText.setVisible(false);
            this.chargeBar.setSize(0, 14);
        }
    }

    createPlanet(data, index) {
        // Crée l'affichage d'une planète + sa hitbox

        // darties.fr — tweens : anneau pulsant autour de la planète
        // Pour les répulsives l'anneau s'agrandit (répulsion), pour les autres il rétrécit (attraction)
        const pulseRing = this.add.circle(data.x, data.y, data.radius * 2.2, 0xffffff, 0);
        pulseRing.setStrokeStyle(1, data.type === 'repulsive' ? 0xff4400 : 0x88ccff, 0.4);
        this.tweens.add({ targets: pulseRing, scaleX: data.type === 'repulsive' ? 2.5 : 0.5, scaleY: data.type === 'repulsive' ? 2.5 : 0.5, alpha: 0, duration: 1000, repeat: -1, ease: 'Sine.easeOut' });

        // darties.fr — bases Phaser : add.image affiche l'image de la planète
        const img = this.add.image(data.x, data.y, data.image).setDisplaySize(data.radius * 2, data.radius * 2);
        if (data.type === 'repulsive') img.setTint(0xff3300); // les répulsives sont teintées en rouge

        // darties.fr — collisions : staticImage invisible = hitbox de la planète
        // On ne met pas de hitbox sur les répulsives car on ne peut pas y atterrir
        if (data.type !== 'repulsive') {
            const body = this.physics.add.staticImage(data.x, data.y, '__DEFAULT');
            body.setDisplaySize(data.radius * 2, data.radius * 2).setVisible(false);
            body.planetIndex = index; // on stocke l'index pour savoir quelle planète a été touchée
            body.refreshBody();       // obligatoire après avoir modifié une staticImage
            this.planetBodies.add(body);
        }

        // On pose trump ou epstein sur les planètes répulsives selon le niveau
        if (data.type === 'repulsive' && this.level >= 2) {
            const key = this.level === 3 && index % 2 !== 0 ? 'epstein' : 'trump';
            const deco = this.add.image(data.x, data.y - data.radius - 5, key);
            deco.setDisplaySize(60, 75).setDepth(20).setOrigin(0.5, 1);
        }

        this.planetGraphics.push(img); // on garde une référence pour animer la planète plus tard
    }

    update() {
        // update() est appelé automatiquement à chaque frame (environ 60 fois par seconde)
        // C'est ici qu'on gère tout ce qui bouge en temps réel

        // darties.fr — bases Phaser : boucle update() appelée chaque frame
        if (this.gameOver) return; // si le jeu est fini, on ne fait rien

        // On appelle la bonne fonction selon l'état du joueur
        if (this.isOnPlanet)    this.updateOnPlanet(); // le joueur est posé sur une planète
        else if (this.isFlying) this.updateFlying();   // le joueur est en vol

        // Le sprite suit la hitbox du joueur (position + rotation)
        this.playerSprite.x = this.player.x;
        this.playerSprite.y = this.player.y;
        this.playerSprite.rotation = this.player.rotation;

        // darties.fr — chronomètre : on calcule le temps écoulé et on met à jour le texte
        this.timerText.setText('Temps : ' + Math.floor((this.time.now - this.startTime) / 1000) + 's');

        // darties.fr — borne du monde : si le joueur sort de la map → mort
        if (this.player.y > 700 || this.player.y < -150 || this.player.x < -100 || this.player.x > 8000) this.onDeath();
    }

    updateOnPlanet() {
        // Gère le déplacement du joueur quand il est posé sur une planète
        const data = this.planetData[this.currentPlanetIndex];

        // darties.fr — bases Phaser : on lit les touches directionnelles
        if (this.cursors.right.isDown) { this.angle += 0.025; this.playerSprite.anims.play('walk-right', true); }
        else if (this.cursors.left.isDown) { this.angle -= 0.025; this.playerSprite.anims.play('walk-left', true); }
        else { this.playerSprite.anims.play('idle', true); }

        // Marche circulaire : on convertit l'angle en coordonnées x/y (cos/sin)
        // Le joueur tourne autour du centre de la planète
        this.player.x = data.x + Math.cos(this.angle) * (data.radius + 24);
        this.player.y = data.y + Math.sin(this.angle) * (data.radius + 24);
        this.player.rotation = this.angle + Math.PI / 2; // le joueur est toujours debout
        this.player.body.setVelocity(0, 0); // on bloque la physique pendant qu'on est posé

        // Gestion du saut chargé : on maintient ESPACE pour charger
        if (this.cursors.space.isDown) {
            if (this.jumpCharge === 0) this.jumpCharge = 0.05;
            // La charge monte plus vite sur les petites planètes (divisé par radius)
            this.jumpCharge = Math.min(1, this.jumpCharge + 0.6 / data.radius);
            // Affichage de la barre de charge
            this.chargeBarBg.setVisible(true); this.chargeBar.setVisible(true); this.chargeText.setVisible(true);
            this.chargeBar.setSize(Math.floor(this.jumpCharge * 196), 14);
            // La couleur change selon le niveau de charge : jaune → orange → rouge
            this.chargeBar.setFillStyle(this.jumpCharge < 0.5 ? 0xffcc00 : this.jumpCharge < 0.85 ? 0xff8800 : 0xff2200);
        }

        // darties.fr — bases Phaser : JustUp détecte le relâchement de la touche (une seule fois)
        if (Phaser.Input.Keyboard.JustUp(this.cursors.space) && this.jumpCharge > 0) {
            // Force de lancement = dépend de la taille de la planète et de la charge
            const force = (300 + data.radius * 3.5) * Math.max(0.2, this.jumpCharge);
            // darties.fr — bases Phaser : setVelocity lance le joueur dans la direction radiale
            this.player.body.setVelocity(Math.cos(this.angle) * force, Math.sin(this.angle) * force);
            this.jumpCharge = 0;
            this.chargeBarBg.setVisible(false); this.chargeBar.setVisible(false); this.chargeText.setVisible(false);
            this.isOnPlanet = false; this.isFlying = true; this.justLaunched = true;
            this.playerSprite.anims.play('jump', true);
            // darties.fr — timers : après 400ms on peut de nouveau atterrir
            this.time.delayedCall(400, () => { this.justLaunched = false; });
        }
    }

    updateFlying() {
        // Gère la physique du joueur en vol (gravité orbitale)
        // On cherche la planète normale la plus proche pour l'attirer vers elle

        // Gravité custom : F = G * rayon / distance²
        // Plus la planète est grande et proche, plus elle attire fort
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
        const delta = this.game.loop.delta / 1000; // temps écoulé depuis la dernière frame (en secondes)

        // darties.fr — bases Phaser : setVelocityX/Y pour modifier la trajectoire du joueur
        // On ajoute la force gravitationnelle à la vitesse actuelle
        const force = Phaser.Math.Clamp(this.G * t.radius / (dist * dist) * 2, 0, 1200);
        this.player.body.setVelocityX(this.player.body.velocity.x + (dx / dist) * force * delta);
        this.player.body.setVelocityY(this.player.body.velocity.y + (dy / dist) * force * delta);

        // Planètes répulsives : même formule mais force inversée (on repousse le joueur)
        this.planetData.forEach((data, i) => {
            if (!this.planetAlive[i] || data.type !== 'repulsive') return;
            const rdx = this.player.x - data.x, rdy = this.player.y - data.y;
            const rdist = Math.hypot(rdx, rdy);
            if (rdist < data.radius * 6 && rdist > 1) { // seulement dans la zone de répulsion
                const rep = Phaser.Math.Clamp(this.G * 1.5 * data.radius / (rdist * rdist), 0, 700);
                this.player.body.setVelocityX(this.player.body.velocity.x + (rdx / rdist) * rep * delta);
                this.player.body.setVelocityY(this.player.body.velocity.y + (rdy / rdist) * rep * delta);
            }
        });

        // Le joueur se tourne dans le sens de son mouvement
        this.player.rotation = Math.atan2(this.player.body.velocity.y, this.player.body.velocity.x) + Math.PI / 2;
    }

    onLanding(planetIndex) {
        // Appelé quand le joueur atterrit sur une planète

        // darties.fr — animations : on remet l'animation idle
        this.playerSprite.anims.play('idle', true);
        const data = this.planetData[planetIndex];

        if (data.type === 'safe') {
            // darties.fr — multi-niveaux : la planète safe déclenche la suite
            if (this.level === 3) this.onVictory();       // niveau 3 = victoire
            else this.triggerBlackHole(planetIndex);       // autres niveaux = trou noir → niveau suivant
            return;
        }
        // Planète normale : elle commence à se désintégrer
        this.startPlanetDestruction(planetIndex);
    }

    onVictory() {
        // Déclenché quand le joueur atteint le vaisseau au niveau 3
        if (this.gameOver) return;
        this.gameOver = true;
        const elapsed = Math.floor((this.time.now - this.startTime) / 1000);
        const shipData = this.planetData.find(p => p.type === 'safe');
        const shipGfx  = this.planetGraphics[this.planetData.indexOf(shipData)];
        this.playerSprite.anims.play('walk-right', true);

        // darties.fr — tweens : le joueur glisse vers le vaisseau puis disparaît
        this.tweens.add({
            targets: [this.player, this.playerSprite], x: shipData.x, y: shipData.y, duration: 1000, ease: 'Sine.easeIn',
            onComplete: () => {
                // Le joueur rétrécit jusqu'à disparaître (embarquement)
                this.tweens.add({ targets: [this.player, this.playerSprite], scaleX: 0, scaleY: 0, alpha: 0, duration: 400 });
                this.time.delayedCall(500, () => {
                    // Le vaisseau décolle
                    this.tweens.add({ targets: shipGfx, y: shipData.y - 500, scaleX: 0.2, scaleY: 0.2, alpha: 0, duration: 2000 });
                    this.time.delayedCall(1500, () => {
                        // Fondu au noir puis transition vers l'écran de victoire
                        this.cameras.main.fade(500, 0, 0, 0);
                        this.time.delayedCall(500, () => { this.scene.start('WinScene', { time: elapsed }); });
                    });
                });
            }
        });
    }

    triggerBlackHole(planetIndex) {
        // Animation de trou noir sur la planète safe des niveaux 1 et 2
        // Elle vire au noir, aspire le joueur, puis on passe au niveau suivant
        if (this.blackHoleActive) return;
        this.blackHoleActive = true;
        const data = this.planetData[planetIndex];
        const gfx  = this.planetGraphics[planetIndex];

        // darties.fr — tweens : la planète change de couleur et grossit
        this.tweens.add({
            targets: gfx, duration: 1200,
            onUpdate: (tween) => {
                const p = tween.progress;
                // La planète vire progressivement au violet puis au noir
                gfx.setTint(p < 0.5 ? Phaser.Display.Color.GetColor(Math.floor(120*(1-p*2)), 0, 150) : 0x110022);
                gfx.setScale(1 + p * 0.6);
            },
            onComplete: () => { gfx.setTint(0x000000); }
        });

        // Le joueur rétrécit et disparaît (aspiré)
        this.tweens.add({ targets: [this.player, this.playerSprite], scaleX: 0, scaleY: 0, alpha: 0, duration: 1400, ease: 'Sine.easeIn' });

        // darties.fr — timers : après l'animation, on passe au niveau suivant
        this.time.delayedCall(1800, () => {
            this.cameras.main.fade(500, 0, 0, 0);
            this.time.delayedCall(500, () => { this.scene.start('GameScene', { level: this.level + 1 }); });
        });
    }

    startPlanetDestruction(planetIndex) {
        // Lance la désintégration progressive d'une planète
        // Elle se dégrade en 8 étapes sur 3.2 secondes
        const data = this.planetData[planetIndex];
        const gfx  = this.planetGraphics[planetIndex];
        if (!gfx || !gfx.active) return;

        const steps = 8, totalTime = 3200; // 8 étapes en 3.2s
        let step = 0;

        // darties.fr — timers : time.addEvent() répète le callback toutes les 400ms (8 fois)
        this.time.addEvent({
            delay: totalTime / steps, repeat: steps - 1,
            callback: () => {
                step++;
                const p = step / steps; // progression de 0 à 1

                // La planète rétrécit, devient transparente et vire au rouge
                if (gfx.active) {
                    gfx.setScale(1 - p * 0.45);
                    gfx.setAlpha(1 - p * 0.5);
                    gfx.setTint(Phaser.Display.Color.GetColor(255, Math.floor(255*(1-p)), 50));
                }

                // darties.fr — tweens : 4 débris s'envolent à chaque étape
                for (let i = 0; i < 4; i++) {
                    const a = Phaser.Math.FloatBetween(0, Math.PI*2); // direction aléatoire
                    const d = this.add.circle(data.x + Math.cos(a)*data.radius*0.5, data.y + Math.sin(a)*data.radius*0.5, Phaser.Math.Between(2,6), data.debrisColor, 0.85);
                    this.tweens.add({ targets: d, x: d.x + Phaser.Math.Between(-60,60), y: d.y + Phaser.Math.Between(20,80), alpha: 0, duration: 600, onComplete: () => d.destroy() });
                }

                // À la dernière étape : la planète explose et est supprimée
                if (step >= steps) {
                    this.planetAlive[planetIndex] = false; // la planète n'existe plus
                    if (gfx.active) gfx.destroy();         // on supprime l'image
                    // Si le joueur est encore dessus → mort
                    if (this.isOnPlanet && this.currentPlanetIndex === planetIndex) this.onDeath();
                }
            }
        });
    }

    onDeath() {
        // Déclenché quand le joueur meurt (tombe dans l'espace ou planète explose sous lui)
        if (this.gameOver) return;
        this.gameOver = true;
        this.cameras.main.flash(400, 255, 0, 0); // flash rouge à l'écran
        // darties.fr — timers + multi-niveaux : on relance le même niveau après 800ms
        this.time.delayedCall(800, () => { this.scene.start('GameScene', { level: this.level }); });
    }

    showLevelBanner() {
        // Affiche brièvement le nom du niveau au centre de l'écran au démarrage
        // darties.fr — tweens : le texte apparaît puis disparaît (yoyo)
        const { width, height } = this.scale;
        const banner = this.add.text(width/2, height/2, { 1:'NIVEAU 1', 2:'NIVEAU 2', 3:'NIVEAU FINAL' }[this.level],
            { fontSize: '56px', fontFamily: 'Arial Black', color: { 1:'#44aaff', 2:'#ffaa44', 3:'#ff4444' }[this.level] }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0);
        // alpha: 1 = apparaît, yoyo: true = repart en arrière (disparaît), hold = temps d'attente au max
        this.tweens.add({ targets: banner, alpha: 1, duration: 400, yoyo: true, hold: 1200, onComplete: () => banner.destroy() });
    }
}
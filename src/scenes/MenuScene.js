// ============================================================
//  MenuScene.js — Écran d'accueil du jeu
// ============================================================

// Une scène Phaser = une classe qui étend Phaser.Scene
// "MenuScene" est le nom qu'on utilise pour y accéder depuis
// les autres scènes (ex: this.scene.start('MenuScene'))
class MenuScene extends Phaser.Scene {

    constructor() {
        // On donne une clé unique à cette scène
        super({ key: 'MenuScene' });
    }

    // preload() : chargement des assets de cette scène
    // Pour le menu on n'a pas besoin d'images — juste du texte
    preload() {
        // Rien à charger pour le menu
    }

    // create() : construction de l'écran d'accueil
    create() {
        const { width, height } = this.scale;

        // --- Titre du jeu ---
        this.add.text(width / 2, height / 3, 'PLANET HOPPER', {
            fontSize: '72px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#4488ff',
            strokeThickness: 6
        }).setOrigin(0.5); // setOrigin(0.5) = centré horizontalement et verticalement

        // --- Sous-titre ---
        this.add.text(width / 2, height / 3 + 90, 'Last Orbit', {
            fontSize: '28px',
            fontFamily: 'Arial',
            color: '#aaaaff',
            fontStyle: 'italic'
        }).setOrigin(0.5);

        // --- Texte "Appuyer pour jouer" avec animation clignotante ---
        const startText = this.add.text(width / 2, height * 0.65, 'Appuie sur ESPACE pour jouer', {
            fontSize: '24px',
            fontFamily: 'Arial',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Tweens = animations programmées dans Phaser
        // Ici on fait clignoter le texte en jouant sur son opacité (alpha)
        this.tweens.add({
            targets: startText,   // L'objet à animer
            alpha: 0,             // Valeur cible (0 = transparent)
            duration: 800,        // Durée en millisecondes
            yoyo: true,           // Revenir à la valeur d'origine automatiquement
            repeat: -1            // Répéter à l'infini (-1)
        });

        // --- Instructions ---
        this.add.text(width / 2, height * 0.80, 
            'ESPACE ou CLIC pour sauter entre les planètes\nSurvie avant que tout s\'effondre !', {
            fontSize: '16px',
            fontFamily: 'Arial',
            color: '#888888',
            align: 'center'
        }).setOrigin(0.5);

        // --- Input : touche ESPACE pour lancer le jeu ---
        // addKey() écoute une touche spécifique du clavier
        const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        spaceKey.once('down', () => {
            // once() = écouté une seule fois
            // On lance la scène principale
            this.scene.start('GameScene');
        });

        // On peut aussi cliquer/taper sur l'écran pour lancer le jeu
        this.input.once('pointerdown', () => {
            this.scene.start('GameScene');
        });

        // --- Étoiles de fond (générées aléatoirement) ---
        this.createStars();
    }

    // Méthode personnalisée : on crée des petits points blancs
    // pour simuler un ciel étoilé en arrière-plan
    createStars() {
        const { width, height } = this.scale;

        for (let i = 0; i < 150; i++) {
            const x = Phaser.Math.Between(0, width);
            const y = Phaser.Math.Between(0, height);
            const size = Phaser.Math.FloatBetween(0.5, 2);
            const alpha = Phaser.Math.FloatBetween(0.3, 1);

            // Cercle = forme Phaser.GameObjects.Arc
            const star = this.add.circle(x, y, size, 0xffffff, alpha);

            // Petite animation de scintillement aléatoire
            this.tweens.add({
                targets: star,
                alpha: 0.1,
                duration: Phaser.Math.Between(800, 2000),
                yoyo: true,
                repeat: -1,
                delay: Phaser.Math.Between(0, 2000)
            });
        }
    }

    update() {
        // Rien à mettre à jour dans le menu
    }
}
